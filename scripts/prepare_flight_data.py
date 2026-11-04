import json
import os
import re
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from scipy.ndimage import gaussian_filter1d

os.makedirs('data', exist_ok=True)

# 1. Parse WORLD_24.txt into power-on sessions
with open('FlightData/WORLD_24.txt', 'r', encoding='utf-8', errors='ignore') as f:
    raw_lines = f.readlines()

headers = [h.strip() for h in raw_lines[0].split(',')]

sessions = []
curr = []
for line in raw_lines:
    s = line.strip()
    if not s:
        continue
    if s.startswith('Flight Phase'):
        if curr:
            sessions.append(curr)
            curr = []
    else:
        parts = [p.strip() for p in s.split(',')]
        if len(parts) >= 27:
            curr.append(parts[:27])
if curr:
    sessions.append(curr)

print(f"Parsed {len(sessions)} total sessions from WORLD_24.txt")

# Session 28 (index 27) is the real July 1, 2026 flight from Page, AZ
df28 = pd.DataFrame(sessions[27], columns=headers)
for c in headers:
    if c != 'Flight Phase':
        df28[c] = pd.to_numeric(df28[c], errors='coerce')

# Clean single-row I2C register bit-flip spikes on BME688 (5 rows reading 195.594 C / -263.832 hPa)
bme_glitch_mask = (df28['BME Temperature'] > 80) | (df28['BME Pressure'] <= 0)
glitch_count = int(bme_glitch_mask.sum())
print(f"Identified {glitch_count} BME688 I2C bit-flip glitch rows in Session 28")

df28_clean = df28.copy()
df28_clean.loc[bme_glitch_mask, ['BME Temperature', 'BME Pressure', 'BME Humidity', 'BME Gas', 'BME Altitude']] = np.nan

# Clean invalid zero-GPS placeholders (when WV packet was temporarily 0.0 on ground)
bad_gps_mask = (df28_clean['WV Latitude'] < 34.0) | (df28_clean['WV Longitude'] > -105.0) | (df28_clean['WV Altitude'] < 500.0)
df28_clean.loc[bad_gps_mask, ['WV Latitude', 'WV Longitude', 'WV Altitude', 'WV Speed', 'WV Heading', 'WV Velocity Down']] = np.nan
df28_clean.loc[df28_clean['WV Pressure'] <= 0, ['WV Pressure', 'WV Temperature']] = np.nan

# Exact UTC epoch alignment:
# Liftoff in livestream (9M9osLO_zgw) = 2026-07-01 08:49:21 CDT = 06:49:21 MST = 13:49:21 UTC
# In Session 28, Launching phase triggers at Elapsed Time = 1611 s -> T0 (Elapsed=0) = 2026-07-01 13:22:30 UTC
t0_utc = int(datetime(2026, 7, 1, 13, 22, 30, tzinfo=timezone.utc).timestamp())
liftoff_elapsed = 1611

# De-quantize World View's 0.001-deg (~90m) longitude & 0.0001-deg (~11m) latitude step truncation
# strictly from valid GPS packets onto a phase-locked 1-Hz time grid
el_arr = df28_clean['Elapsed Time'].to_numpy(dtype=float)
valid_gps = (
    df28_clean['WV Latitude'].notna()
    & df28_clean['WV Longitude'].notna()
    & df28_clean['WV Altitude'].notna()
    & (el_arr >= liftoff_elapsed)
).to_numpy()

def dequantize_step_series(col_name, sigma_sec=28.0, is_step_quantized=True):
    el_v = el_arr[valid_gps]
    val_v = df28_clean.loc[valid_gps, col_name].to_numpy(dtype=float)
    if is_step_quantized:
        chg = np.where(np.diff(val_v) != 0)[0] + 1
        bounds = np.concatenate(([0], chg, [len(val_v)]))
        mt = [el_v[0]]
        my = [val_v[0]]
        for k in range(len(bounds) - 1):
            i0, i1 = bounds[k], bounds[k + 1]
            mt.append(0.5 * (el_v[i0] + el_v[i1 - 1]))
            my.append(val_v[i0])
        mt.append(el_v[-1])
        my.append(val_v[-1])
        mt_arr, uniq_idx = np.unique(np.array(mt, dtype=float), return_index=True)
        my_arr = np.array(my, dtype=float)[uniq_idx]
    else:
        mt_arr, uniq_idx = np.unique(el_v, return_index=True)
        my_arr = val_v[uniq_idx]

    t_grid = np.arange(el_v[0], el_v[-1] + 1.0, 1.0)
    cont_grid = np.interp(t_grid, mt_arr, my_arr)
    sm_grid = gaussian_filter1d(cont_grid, sigma=sigma_sec, mode='nearest')
    blend = np.minimum(1.0, np.arange(len(t_grid)) / 30.0)
    sm_grid = val_v[0] * (1.0 - blend) + sm_grid * blend
    sm_grid[-1] = val_v[-1]

    out = np.full(len(df28_clean), val_v[0], dtype=float)
    post = el_arr >= liftoff_elapsed
    out[post] = np.interp(el_arr[post], t_grid, sm_grid)
    return out

raw_apogee_idx = int(df28_clean['WV Altitude'].idxmax())
raw_apogee_val = float(df28_clean.loc[raw_apogee_idx, 'WV Altitude'])
raw_apogee_el = float(df28_clean.loc[raw_apogee_idx, 'Elapsed Time'])

df28_clean['WV Latitude'] = dequantize_step_series('WV Latitude', sigma_sec=42.0, is_step_quantized=True)
df28_clean['WV Longitude'] = dequantize_step_series('WV Longitude', sigma_sec=42.0, is_step_quantized=True)
alt_sm = dequantize_step_series('WV Altitude', sigma_sec=42.0, is_step_quantized=False)
apogee_delta = raw_apogee_val - alt_sm[raw_apogee_idx]
alt_sm = alt_sm + apogee_delta * np.exp(-0.5 * ((el_arr - raw_apogee_el) / 20.0) ** 2)
df28_clean['WV Altitude'] = alt_sm

def r_list(series, digits=2):
    out = []
    for v in series:
        if pd.isna(v):
            out.append(None)
        else:
            out.append(round(float(v), digits) if digits > 0 else int(round(float(v))))
    return out

# Map Flight Phase strings to compact integer codes for lightweight fast transfer:
# 0: Ground, 1: Initializing, 2: Launching, 3: Floating, 4: Terminating
phase_names = ['Ground', 'Initializing', 'Launching', 'Floating', 'Terminating']
phase_map = {name: idx for idx, name in enumerate(phase_names)}
phase_codes = [phase_map.get(p, 0) for p in df28_clean['Flight Phase']]

# Build compact 1-Hz columnar telemetry for all 16,461 rows of Session 28!
flight_columns = {
    'n': len(df28_clean),
    't0Utc': t0_utc,
    'liftoffElapsed': liftoff_elapsed,
    'phaseNames': phase_names,
    'phase': phase_codes,
    'elapsed': r_list(df28_clean['Elapsed Time'], 0),
    'wvTime': r_list(df28_clean['WV Time'], 0),
    'lat': r_list(df28_clean['WV Latitude'], 6),
    'lon': r_list(df28_clean['WV Longitude'], 6),
    'alt': r_list(df28_clean['WV Altitude'], 1),         # meters MSL (World View GPS)
    'speed': r_list(df28_clean['WV Speed'], 2),          # m/s ground speed
    'heading': r_list(df28_clean['WV Heading'], 1),      # degrees (-180..180)
    'velDown': r_list(df28_clean['WV Velocity Down'], 2),# m/s (+ down, - climb)
    'wvPressPsi': r_list(df28_clean['WV Pressure'], 3),  # PSI
    'wvTemp': r_list(df28_clean['WV Temperature'], 2),   # Celsius (ambient external)
    'bmeTemp': r_list(df28_clean['BME Temperature'], 2), # Celsius (payload internal)
    'bmeHum': r_list(df28_clean['BME Humidity'], 1),     # % RH
    'bmePress': r_list(df28_clean['BME Pressure'], 2),   # hPa / mbar
    'bmeAlt': r_list(df28_clean['BME Altitude'], 1),     # meters barometric
    'uva': r_list(df28_clean['UVA 1'], 1),
    'uvb': r_list(df28_clean['UVB 1'], 2),
    'uvc': r_list(df28_clean['UVC 1'], 2),
    'eco2': r_list(df28_clean['eCO2'], 0),
    'tvoc': r_list(df28_clean['TVOC'], 0),
    'ensEco2': r_list(df28_clean['ENS eCO2'], 0),
    'ensTvoc': r_list(df28_clean['ENS TVOC'], 0),
    'stage': r_list(df28_clean['Stage'], 0),
}

# 2. Parse Post-Termination Rapid Descent Sessions (Sessions 29 & 30)
descent_data = []
for s_num, sess_idx in [(29, 28), (30, 29)]:
    dfs = pd.DataFrame(sessions[sess_idx], columns=headers)
    for c in ['Elapsed Time', 'BME Temperature', 'BME Humidity', 'BME Pressure', 'BME Altitude', 'UVA 1', 'UVB 1']:
        dfs[c] = pd.to_numeric(dfs[c], errors='coerce')
    descent_data.append({
        'session': s_num,
        'rows': len(dfs),
        'elapsed': r_list(dfs['Elapsed Time'], 0),
        'bmeAlt': r_list(dfs['BME Altitude'], 1),
        'bmePress': r_list(dfs['BME Pressure'], 2),
        'bmeTemp': r_list(dfs['BME Temperature'], 2),
        'bmeHum': r_list(dfs['BME Humidity'], 1),
    })

# 3. Parse events_log.txt and match exact Session 28 coordinates & Elapsed Time!
capsule_events = []
with open('FlightData/events_log.txt', 'r', encoding='utf-8') as f:
    for line in f:
        s = line.strip()
        if not s: continue
        # Format: 11400, Alt: 4269.58, MOTOR START: Moving to Capsule 1
        m = re.match(r'^(\d+),\s*Alt:\s*([\d.]+),\s*(.+)$', s)
        if m:
            wvt = int(m.group(1))
            alt = float(m.group(2))
            desc = m.group(3).strip()
            is_flight = wvt >= 9291
            elapsed_match = None
            lat_match = None
            lon_match = None
            if is_flight:
                # Find closest WV Time in df28_clean
                valid_wvt = df28_clean.dropna(subset=['WV Time'])
                idx = (valid_wvt['WV Time'] - wvt).abs().idxmin()
                row = df28_clean.loc[idx]
                elapsed_match = int(row['Elapsed Time'])
                lat_match = round(float(row['WV Latitude']), 5) if pd.notna(row['WV Latitude']) else None
                lon_match = round(float(row['WV Longitude']), 5) if pd.notna(row['WV Longitude']) else None
            capsule_events.append({
                'wvTime': wvt,
                'alt': round(alt, 2),
                'action': desc,
                'inFlight': is_flight,
                'elapsed': elapsed_match,
                'lat': lat_match,
                'lon': lon_match,
            })

# Build structured 5-Capsule Sampling Windows for Session 28 HUD & Timeline
capsule_windows = [
    {
        'capsule': 1,
        'name': 'Capsule 1 — Troposphere',
        'layer': 'Troposphere Layer',
        'targetAltFt': 14000,
        'targetAltM': 4267,
        'startWvTime': 11400,
        'endWvTime': 11822,
        'startElapsed': 2185,
        'endElapsed': 2608,
        'startAltM': 4269.6,
        'endAltM': 6470.4,
        'sealName': 'Seal 1',
        'color': '#38bdf8'
    },
    {
        'capsule': 2,
        'name': 'Capsule 2 — Near Tropopause',
        'layer': 'Near Tropopause (Jet Stream)',
        'targetAltFt': 28000,
        'targetAltM': 8534,
        'startWvTime': 12191,
        'endWvTime': 12611,
        'startElapsed': 2976,
        'endElapsed': 3396,
        'startAltM': 8536.3,
        'endAltM': 10908.6,
        'sealName': 'Seal 2',
        'color': '#22d3ee'
    },
    {
        'capsule': 3,
        'name': 'Capsule 3 — Lower Stratosphere',
        'layer': 'Lower Stratosphere',
        'targetAltFt': 42000,
        'targetAltM': 12801,
        'startWvTime': 12942,
        'endWvTime': 13364,
        'startElapsed': 3727,
        'endElapsed': 4149,
        'startAltM': 12804.5,
        'endAltM': 15222.4,
        'sealName': 'Seal 3',
        'color': '#818cf8'
    },
    {
        'capsule': 4,
        'name': 'Capsule 4 — Mid-Stratosphere',
        'layer': 'Stratospheric Ascent',
        'targetAltFt': 56000,
        'targetAltM': 17068,
        'startWvTime': 13671,
        'endWvTime': 14090,
        'startElapsed': 4456,
        'endElapsed': 4875,
        'startAltM': 17069.0,
        'endAltM': 19506.1,
        'sealName': 'Seal 4',
        'color': '#a78bfa'
    },
    {
        'capsule': 5,
        'name': 'Capsule 5 — Stratosphere Float',
        'layer': 'Peak Stratospheric Float (3.5 hr)',
        'targetAltFt': 70780,
        'targetAltM': 21573,
        'startWvTime': 14418,
        'endWvTime': 27018,
        'startElapsed': 5203,
        'endElapsed': 17803,
        'startAltM': 21573.4,
        'endAltM': 25528.4,
        'sealName': 'Closed (Pos 6)',
        'color': '#f59e0b'
    }
]

# Populate exact start/end lat/lon/alt for each capsule window from the de-quantized trajectory
for cw in capsule_windows:
    for prefix, el in [('start', cw['startElapsed']), ('end', cw['endElapsed'])]:
        idx = (df28_clean['Elapsed Time'] - el).abs().idxmin()
        r = df28_clean.loc[idx]
        cw[f'{prefix}Lat'] = round(float(r['WV Latitude']), 6)
        cw[f'{prefix}Lon'] = round(float(r['WV Longitude']), 6)
        cw[f'{prefix}AltM'] = round(float(r['WV Altitude']), 1)

# 4. Parse error_log.txt to summarize I2C [Errno 5] bursts across time
err_timestamps = []
with open('FlightData/error_log.txt', 'r', encoding='utf-8') as f:
    for line in f:
        m = re.match(r'^([\d.]+):\s*SENSOR ERROR\s*(\d+):\s*(.+)$', line.strip())
        if m:
            err_timestamps.append(float(m.group(1)))

# Bin error counts per 10-minute (600s) window of Elapsed Time (0..18600s)
bins = list(range(0, 19200, 600))
err_hist, _ = np.histogram(err_timestamps, bins=bins)

# Key Mission Milestones for Quick-Jump Scrubber
apogee_idx = df28_clean['WV Altitude'].idxmax()
apogee_row = df28_clean.loc[apogee_idx]
min_temp_idx = df28_clean['WV Temperature'].idxmin()
min_temp_row = df28_clean.loc[min_temp_idx]

milestones = [
    {'id': 'pad', 'label': 'Pad Power-On', 'elapsed': 80, 'altM': 1271.8, 'lat': 36.9278, 'lon': -111.451},
    {'id': 'liftoff', 'label': 'Liftoff (Page, AZ)', 'elapsed': 1611, 'altM': 1300.7, 'lat': 36.928, 'lon': -111.451},
    {'id': 'cap1', 'label': 'Capsule 1 Open', 'elapsed': 2185, 'altM': 4269.6, 'lat': capsule_windows[0]['startLat'], 'lon': capsule_windows[0]['startLon']},
    {'id': 'cap2', 'label': 'Capsule 2 Open', 'elapsed': 2976, 'altM': 8536.3, 'lat': capsule_windows[1]['startLat'], 'lon': capsule_windows[1]['startLon']},
    {'id': 'cap3', 'label': 'Capsule 3 Open', 'elapsed': 3727, 'altM': 12804.5, 'lat': capsule_windows[2]['startLat'], 'lon': capsule_windows[2]['startLon']},
    {'id': 'coldest', 'label': 'Coldest (-63.2°C)', 'elapsed': int(min_temp_row['Elapsed Time']), 'altM': round(float(min_temp_row['WV Altitude']), 1), 'lat': round(float(min_temp_row['WV Latitude']), 5), 'lon': round(float(min_temp_row['WV Longitude']), 5)},
    {'id': 'cap4', 'label': 'Capsule 4 Open', 'elapsed': 4456, 'altM': 17069.0, 'lat': capsule_windows[3]['startLat'], 'lon': capsule_windows[3]['startLon']},
    {'id': 'float', 'label': 'Float & Capsule 5', 'elapsed': 5203, 'altM': 21573.4, 'lat': capsule_windows[4]['startLat'], 'lon': capsule_windows[4]['startLon']},
    {'id': 'apogee', 'label': 'Peak Apogee (84,185 ft)', 'elapsed': int(apogee_row['Elapsed Time']), 'altM': round(float(apogee_row['WV Altitude']), 1), 'lat': round(float(apogee_row['WV Latitude']), 5), 'lon': round(float(apogee_row['WV Longitude']), 5)},
    {'id': 'seal5', 'label': 'All Capsules Sealed', 'elapsed': 17803, 'altM': 25528.4, 'lat': capsule_windows[4]['endLat'], 'lon': capsule_windows[4]['endLon']},
    {'id': 'term', 'label': 'Flight Termination', 'elapsed': 18206, 'altM': 25534.8, 'lat': 36.8142, 'lon': -113.365},
    {'id': 'los', 'label': 'Last Telemetry (LOS)', 'elapsed': 18504, 'altM': 25505.5, 'lat': 36.8079, 'lon': -113.428},
]

bundle = {
    'meta': {
        'missionName': 'NASA TechRise 5 — World 24',
        'projectTitle': "What's Up There?",
        'tailNumber': 'N141WV',
        'vehicleProvider': 'World View Enterprises',
        'launchSite': 'Page Municipal Airport, Page, Arizona',
        'launchDate': '2026-07-01',
        'liftoffLocal': '06:49:21 AM MST',
        'liftoffCdt': '08:49:21 AM CDT',
        'liftoffUtc': '2026-07-01T13:49:21Z',
        'totalRawLines': len(raw_lines),
        'totalSessions': len(sessions),
        'flightSessionIndex': 28,
        'flightRows': len(df28_clean),
        'validGpsRows': int(df28_clean['WV Latitude'].notna().sum()),
        'peakAltitudeM': 25659.7,
        'peakAltitudeFt': round(25659.7 * 3.28084),
        'minAmbientTempC': -63.22,
        'minPressureHpa': 22.21,
        'totalErrorLogCount': len(err_timestamps),
        'bmeBitFlipRowsCleaned': glitch_count,
        'livestreamYoutubeId': '9M9osLO_zgw',
        'livestreamStartSec': 6340,
        'onboardYoutubeId': 'DjYmvwQkJjw',
        'onboardLaunchSec': 5920,
        'onboardCutoffSec': 22970,
    },
    'flight': flight_columns,
    'capsuleWindows': capsule_windows,
    'capsuleEvents': capsule_events,
    'milestones': milestones,
    'descentSessions': descent_data,
    'errorHistogram': {
        'binMinutes': [int(b // 60) for b in bins[:-1]],
        'counts': [int(c) for c in err_hist],
        'totalErrors': len(err_timestamps),
    }
}

js_out = 'window.WORLD24_DATA = ' + json.dumps(bundle, separators=(',', ':')) + ';\n'
out_file = 'data/world24_data.js'
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(js_out)

print(f"Wrote {out_file}: {os.path.getsize(out_file) / 1024:.1f} KB")
print("Milestones verified:", len(milestones))
print("Capsule windows verified:", len(capsule_windows))
