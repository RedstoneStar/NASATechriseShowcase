/* ==========================================================================
   TR5 // WORLD 24 — IMMERSIVE 3D CESIUM FLIGHT VIEWER (V2)
   Real 3D Canyon Terrain · True July 1, 2026 Morning Sky & Sun ·
   Dynamic Glowing Past / Dashed Future Trail · Synced Expandable Payload Cam
   ========================================================================== */

(function () {
  'use strict';

  // Global unit state shared across page ('imperial' | 'metric')
  window.WORLD24_UNITS = 'imperial';
  const unitListeners = [];
  window.onWorld24UnitsChange = function (fn) {
    unitListeners.push(fn);
  };

  function setupGlobalUnitsToggle() {
    const btn = document.getElementById('globalUnitToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.WORLD24_UNITS = window.WORLD24_UNITS === 'imperial' ? 'metric' : 'imperial';
      btn.querySelectorAll('.unit-opt').forEach((el) => {
        el.classList.toggle('active', el.dataset.u === window.WORLD24_UNITS);
      });
      const isImp = window.WORLD24_UNITS === 'imperial';
      document.querySelectorAll('[data-imperial][data-metric]').forEach((el) => {
        el.textContent = isImp ? el.dataset.imperial : el.dataset.metric;
      });
      const peakSpan = document.querySelector('.u-alt-peak');
      if (peakSpan) peakSpan.textContent = isImp ? '84,185 ft' : '25,660 m';
      unitListeners.forEach((fn) => fn(window.WORLD24_UNITS));
    });
  }

  // Astronomical Solar Elevation & Azimuth calculator for exact balloon coordinates & UTC second
  function computeSolarAngles(utcUnixSec, latDeg, lonDeg) {
    const d = utcUnixSec / 86400.0 - 10957.5;
    const rad = Math.PI / 180;
    const g = ((357.529 + 0.98560028 * d) % 360) * rad;
    const q = (280.459 + 0.98564736 * d) % 360;
    const L = ((q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360) * rad;
    const e = (23.439 - 0.00000036 * d) * rad;
    const sinDec = Math.sin(e) * Math.sin(L);
    const dec = Math.asin(sinDec);
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;

    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    const lst = (gmst * 15 + lonDeg + 360) % 360;
    const ha = ((lst - ra + 540) % 360 - 180) * rad;

    const lat = latDeg * rad;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const elevDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;

    const y = -Math.sin(ha);
    const x = Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha);
    const azDeg = (Math.atan2(y, x) / rad + 360) % 360;
    return { elevDeg, azDeg };
  }

  function compassDir(deg) {
    if (deg == null || isNaN(deg)) return '--';
    const norm = ((deg % 360) + 360) % 360;
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(norm / 22.5) % 16];
  }

  function formatMissionClock(deltaSec) {
    const sign = deltaSec < 0 ? 'T- ' : 'T+ ';
    const abs = Math.abs(Math.round(deltaSec));
    const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
    const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
    const ss = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}:${ss}`;
  }

  function formatHMS(secTotal) {
    const s = Math.max(0, Math.round(secTotal));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function formatArizonaTime(utcUnixSec) {
    // Page, AZ observes MST year-round (UTC-7)
    const mstSec = utcUnixSec - 7 * 3600;
    const dt = new Date(mstSec * 1000);
    let h = dt.getUTCHours();
    const m = String(dt.getUTCMinutes()).padStart(2, '0');
    const s = String(dt.getUTCSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m}:${s} ${ampm} MST`;
  }

  function findRowIndexByElapsed(elapsedArr, targetEl) {
    let lo = 0;
    let hi = elapsedArr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (elapsedArr[mid] < targetEl) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(elapsedArr[lo - 1] - targetEl) < Math.abs(elapsedArr[lo] - targetEl)) {
      return lo - 1;
    }
    return lo;
  }

  // Soft procedural fair-weather cumulus wisp sprite for realistic 3D morning sky depth
  function createSoftCloudDataUrl() {
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 128;
    const ctx = cvs.getContext('2d');
    const puffs = [
      [128, 66, 54, 0.34],
      [82, 72, 42, 0.26],
      [174, 70, 44, 0.28],
      [52, 80, 28, 0.18],
      [204, 78, 30, 0.18]
    ];
    puffs.forEach(([cx, cy, r, alpha]) => {
      const g = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.08, cx, cy, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      g.addColorStop(0.55, `rgba(241, 245, 249, ${alpha * 0.42})`);
      g.addColorStop(1, 'rgba(241, 245, 249, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });
    return cvs.toDataURL('image/png');
  }

  function initFlightViewer() {
    setupGlobalUnitsToggle();

    const isFileProtocol = window.location.protocol === 'file:';
    const fileBanner = document.getElementById('fileProtocolBanner');
    if (isFileProtocol && fileBanner) {
      fileBanner.classList.remove('hidden');
      document.getElementById('dismissFileBannerBtn')?.addEventListener('click', () => {
        fileBanner.classList.add('hidden');
      });
    }

    const data = window.WORLD24_DATA;
    const container = document.getElementById('cesiumContainer');
    if (!data || !container || typeof Cesium === 'undefined') {
      console.error('Missing WORLD24_DATA or CesiumJS');
      return;
    }

    const fl = data.flight;
    const t0Utc = fl.t0Utc;             // 2026-07-01T13:22:30Z
    const liftoffEl = fl.liftoffElapsed;// 1611 s (06:49:21 AM MST)
    const maxElapsed = fl.elapsed[fl.n - 1]; // 18504 s

    Cesium.Ion.defaultAccessToken = '';

    // 1. Initialize Keyless Cesium 3D Viewer with Realistic Atmosphere & Daylight Sky
    const viewer = new Cesium.Viewer('cesiumContainer', {
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      contextOptions: {
        webgl: { antialias: true }
      }
    });

    const scene = viewer.scene;
    // Entire mission occurred in clear Arizona morning daylight (6:49 AM – 11:57 AM MST) — hide night starbox!
    if (scene.skyBox) scene.skyBox.show = false;
    scene.backgroundColor = Cesium.Color.fromCssColorString('#0a1930');
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#1c2a3a');
    scene.globe.enableLighting = true;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.globe.dynamicAtmosphereLightingFromSun = true;
    scene.globe.depthTestAgainstTerrain = false;
    scene.globe.maximumScreenSpaceError = 2.4;
    scene.globe.preloadAncestors = true;
    scene.globe.preloadSiblings = true;
    scene.verticalExaggeration = 1.28; // Accentuates real canyon walls of Lake Powell, Glen Canyon & Vermilion Cliffs

    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.brightnessShift = 0.08;
    scene.skyAtmosphere.saturationShift = 0.06;

    scene.fog.enabled = true;
    scene.fog.density = 0.00011;
    scene.fog.minimumBrightness = 0.25;

    scene.sun = new Cesium.Sun();
    scene.sun.show = true;
    scene.sun.glowFactor = 1.6;
    scene.highDynamicRange = false;

    if (viewer.camera.frustum && typeof viewer.camera.frustum.fov === 'number') {
      viewer.camera.frustum.fov = Cesium.Math.toRadians(68.0);
    }

    // 2. High-Resolution Keyless Satellite Imagery & Labels
    const layers = viewer.imageryLayers;
    function applyBasemap(mode) {
      layers.removeAll();
      let baseSatLayer = null;
      if (mode === 'usgs_sat') {
        baseSatLayer = layers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 16,
            credit: 'USGS The National Map'
          })
        );
        layers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 16,
            credit: 'Esri'
          })
        );
      } else {
        baseSatLayer = layers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://{s}.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            subdomains: ['services', 'server'],
            maximumLevel: 18,
            credit: 'Esri, Maxar, Earthstar Geographics'
          })
        );
        if (mode === 'esri_hybrid') {
          const lbl = layers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
              maximumLevel: 18,
              credit: 'Esri Reference'
            })
          );
          lbl.alpha = 0.86;
        }
      }
      if (baseSatLayer) {
        baseSatLayer.brightness = 1.05;
        baseSatLayer.contrast = 1.06;
        baseSatLayer.saturation = 1.08;
      }
    }
    applyBasemap('esri_hybrid');

    // 3. Real 3D Topographic Canyon Terrain (ArcGIS WorldElevation3D)
    try {
      const ArcGISTerrain =
        Cesium.ArcGISTiledElevationTerrainProvider || Cesium.ArcGisTiledElevationTerrainProvider;
      if (ArcGISTerrain && typeof ArcGISTerrain.fromUrl === 'function' && !isFileProtocol) {
        ArcGISTerrain.fromUrl(
          'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
        )
          .then((terrainProvider) => {
            viewer.terrainProvider = terrainProvider;
          })
          .catch((err) => {
            console.warn('3D Terrain fallback to ellipsoid:', err);
          });
      }
    } catch (err) {
      console.warn('Terrain init fallback:', err);
    }

    // 4. Build Clean Validated GPS Sample Table & Smooth Catmull-Rom 3D Spline Nodes
    const startJulian = Cesium.JulianDate.fromDate(new Date(t0Utc * 1000));

    // Collect every valid GPS point from Session 28 for continuous sub-second interpolation
    const validTrack = [];
    for (let i = 0; i < fl.n; i++) {
      if (fl.lat[i] != null && fl.lon[i] != null && fl.alt[i] != null) {
        validTrack.push({
          el: fl.elapsed[i],
          lat: fl.lat[i],
          lon: fl.lon[i],
          alt: fl.alt[i],
          cart: Cesium.Cartesian3.fromDegrees(fl.lon[i], fl.lat[i], fl.alt[i]),
          groundCart: Cesium.Cartesian3.fromDegrees(fl.lon[i], fl.lat[i], 1280)
        });
      }
    }

    // Build distance-filtered anchor points starting strictly at Liftoff (1611s) so stationary pre-launch pad points never tangle
    const anchorNodes = [];
    for (let i = 0; i < validTrack.length; i++) {
      const pt = validTrack[i];
      if (pt.el < liftoffEl) continue;
      if (
        anchorNodes.length === 0 ||
        i === validTrack.length - 1 ||
        Cesium.Cartesian3.distance(anchorNodes[anchorNodes.length - 1].cart, pt.cart) >= 68.0
      ) {
        anchorNodes.push(pt);
      }
    }

    // Catmull-Rom 3D cubic spline evaluator to subdivide corners into silky-smooth arcs (<1° per step)
    function catmullRomCartesian3(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      const c0 = -0.5 * t3 + t2 - 0.5 * t;
      const c1 = 1.5 * t3 - 2.5 * t2 + 1.0;
      const c2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
      const c3 = 0.5 * t3 - 0.5 * t2;
      return new Cesium.Cartesian3(
        p0.x * c0 + p1.x * c1 + p2.x * c2 + p3.x * c3,
        p0.y * c0 + p1.y * c1 + p2.y * c2 + p3.y * c3,
        p0.z * c0 + p1.z * c1 + p2.z * c2 + p3.z * c3
      );
    }

    const pathNodes = [];
    const subSteps = [0.25, 0.5, 0.75];
    for (let i = 0; i < anchorNodes.length - 1; i++) {
      const n0 = anchorNodes[Math.max(0, i - 1)];
      const n1 = anchorNodes[i];
      const n2 = anchorNodes[i + 1];
      const n3 = anchorNodes[Math.min(anchorNodes.length - 1, i + 2)];
      pathNodes.push(n1);
      for (let s = 0; s < subSteps.length; s++) {
        const f = subSteps[s];
        const subCart = catmullRomCartesian3(n0.cart, n1.cart, n2.cart, n3.cart, f);
        const subLon = n1.lon + (n2.lon - n1.lon) * f;
        const subLat = n1.lat + (n2.lat - n1.lat) * f;
        pathNodes.push({
          el: n1.el + (n2.el - n1.el) * f,
          lat: subLat,
          lon: subLon,
          alt: n1.alt + (n2.alt - n1.alt) * f,
          cart: subCart,
          groundCart: Cesium.Cartesian3.fromDegrees(subLon, subLat, 1280)
        });
      }
    }
    if (anchorNodes.length > 0) {
      pathNodes.push(anchorNodes[anchorNodes.length - 1]);
    }

    // Interpolate exact 3D Cartesian + Lat/Lon/Alt for ANY floating-point elapsed second
    function sampleBalloonAtElapsed(elSec) {
      if (validTrack.length === 0) {
        return {
          lat: 36.928,
          lon: -111.451,
          alt: 1272,
          cart: Cesium.Cartesian3.fromDegrees(-111.451, 36.928, 1272),
          groundCart: Cesium.Cartesian3.fromDegrees(-111.451, 36.928, 1272)
        };
      }
      if (elSec <= validTrack[0].el) return validTrack[0];
      const last = validTrack[validTrack.length - 1];
      if (elSec >= last.el) return last;

      let lo = 0;
      let hi = validTrack.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (validTrack[mid].el < elSec) lo = mid + 1;
        else hi = mid;
      }
      const b = validTrack[lo];
      const a = validTrack[Math.max(0, lo - 1)];
      const span = b.el - a.el;
      const t = span > 0 ? Math.max(0, Math.min(1, (elSec - a.el) / span)) : 0;

      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lon + (b.lon - a.lon) * t;
      const alt = a.alt + (b.alt - a.alt) * t;
      return {
        lat,
        lon,
        alt,
        cart: Cesium.Cartesian3.lerp(a.cart, b.cart, t, new Cesium.Cartesian3()),
        groundCart: Cesium.Cartesian3.fromDegrees(lon, lat, 1280)
      };
    }

    // 5. Simulation Playback State (Owned Directly for Zero-Bug Play/Pause/Scrub!)
    let simElapsed = liftoffEl; // Starts poised at Liftoff (06:49:21 AM MST, T+ 00:00:00)
    let isPlaying = false;      // Ready for user to press "▶ Play"
    let playSpeed = 120;        // Default 120x so pressing Play produces immediate, vivid 3D motion!
    let currentIndex = findRowIndexByElapsed(fl.elapsed, simElapsed);
    let currentSample = sampleBalloonAtElapsed(simElapsed);

    // Sync Cesium solar clock to initial liftoff time
    viewer.clock.currentTime = Cesium.JulianDate.addSeconds(startJulian, simElapsed, new Cesium.JulianDate());
    viewer.clock.shouldAnimate = false; // We advance viewer.clock.currentTime deterministically ourselves!

    // 6. Dynamic Flight Trail (ArcType.NONE + 35m Tip Guard for Zero Corner Miter Glitches):
    //    - PAST TRAVELED TRAIL = Bright Glowing Electric Blue Line
    //    - FUTURE UNTRAVELED PATH = Faint Dashed Blue Line
    let cachedPastPositions = [];
    let cachedFuturePositions = [];
    let lastTrailElapsed = -999;

    function rebuildTrailArrays(elSec) {
      if (Math.abs(elSec - lastTrailElapsed) < 0.05 && cachedPastPositions.length > 0) return;
      lastTrailElapsed = elSec;

      const past = [];
      const future = [];

      for (let i = 0; i < pathNodes.length; i++) {
        const nd = pathNodes[i];
        if (nd.el <= elSec) {
          past.push(nd.cart);
        } else {
          future.push(nd.cart);
        }
      }

      // Prevent short/degenerate tip segments (< 18m) that cause float32 miter spikes in WebGL PolylineVS.glsl
      while (
        past.length > 1 &&
        Cesium.Cartesian3.distance(past[past.length - 1], currentSample.cart) < 18.0
      ) {
        past.pop();
      }
      past.push(currentSample.cart);

      while (
        future.length > 1 &&
        Cesium.Cartesian3.distance(future[0], currentSample.cart) < 18.0
      ) {
        future.shift();
      }
      future.unshift(currentSample.cart);

      // Guarantee >= 2 well-separated vertices even right at T+00:00:00 Liftoff or Termination
      if (past.length < 2 || Cesium.Cartesian3.distance(past[0], past[past.length - 1]) < 15.0) {
        const padBase = Cesium.Cartesian3.fromDegrees(
          currentSample.lon,
          currentSample.lat - 0.0002,
          Math.max(1270, currentSample.alt - 25.0)
        );
        past.unshift(padBase);
      }
      if (future.length < 2 || Cesium.Cartesian3.distance(future[0], future[future.length - 1]) < 15.0) {
        future.push(
          Cesium.Cartesian3.fromDegrees(
            currentSample.lon - 0.0003,
            currentSample.lat,
            currentSample.alt
          )
        );
      }

      cachedPastPositions = past;
      cachedFuturePositions = future;
    }
    rebuildTrailArrays(simElapsed);

    // 6a. Deep Cobalt-Cyan Outer Glow on Traveled Trail (ArcType.NONE prevents EllipsoidGeodesic climb corruption!)
    viewer.entities.add({
      name: 'Traveled Flight Trail Glow',
      polyline: {
        positions: new Cesium.CallbackProperty(() => cachedPastPositions, false),
        arcType: Cesium.ArcType.NONE,
        width: 11.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.28,
          color: Cesium.Color.fromCssColorString('#00d8ff').withAlpha(0.96)
        })
      }
    });

    // 6b. Crisp Bright Ice-Blue / White Core on Traveled Trail
    viewer.entities.add({
      name: 'Traveled Flight Trail Core',
      polyline: {
        positions: new Cesium.CallbackProperty(() => cachedPastPositions, false),
        arcType: Cesium.ArcType.NONE,
        width: 3.2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#e0f2fe'))
      }
    });

    // 6c. Faint Dashed Untraveled Future Path (Ahead of Balloon — subtle contrast backing + glowing blue dashes)
    viewer.entities.add({
      name: 'Planned Trajectory Contrast Underlay',
      polyline: {
        positions: new Cesium.CallbackProperty(() => cachedFuturePositions, false),
        arcType: Cesium.ArcType.NONE,
        width: 4.0,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#082f49').withAlpha(0.34),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: 18.0
        })
      }
    });

    viewer.entities.add({
      name: 'Planned / Untraveled Trajectory',
      polyline: {
        positions: new Cesium.CallbackProperty(() => cachedFuturePositions, false),
        arcType: Cesium.ArcType.NONE,
        width: 2.6,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.58),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: 18.0
        })
      }
    });

    // 6d. Live Vertical Altitude Drop-Line right beneath the moving balloon
    const liveDropLineEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(
          () => [currentSample.groundCart, currentSample.cart],
          false
        ),
        arcType: Cesium.ArcType.NONE,
        width: 1.5,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.52),
          dashLength: 10.0
        })
      }
    });

    // Static reference curtain pillars along full route (toggleable)
    const curtainEntities = [liveDropLineEntity];
    for (let i = 0; i < validTrack.length; i += 520) {
      if (validTrack[i].el >= liftoffEl) {
        curtainEntities.push(
          viewer.entities.add({
            polyline: {
              positions: [validTrack[i].groundCart, validTrack[i].cart],
              arcType: Cesium.ArcType.NONE,
              width: 1.0,
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.14)
              )
            }
          })
        );
      }
    }

    // Optional Capsule 1–5 Zone Overlays (unchecked by default so glowing blue / dashed trail stays ultra-clean)
    const capsuleZoneEntities = [];
    data.capsuleWindows.forEach((cw) => {
      const segPositions = [];
      const step = cw.capsule === 5 ? 16 : 6;
      for (let i = 0; i < fl.n; i += step) {
        const el = fl.elapsed[i];
        if (el >= cw.startElapsed && el <= cw.endElapsed && fl.lat[i] != null) {
          segPositions.push(Cesium.Cartesian3.fromDegrees(fl.lon[i], fl.lat[i], fl.alt[i]));
        }
      }
      if (segPositions.length > 1) {
        const zEnt = viewer.entities.add({
          name: cw.name,
          show: false,
          polyline: {
            positions: segPositions,
            arcType: Cesium.ArcType.NONE,
            width: 6.5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              color: Cesium.Color.fromCssColorString(cw.color)
            })
          }
        });
        capsuleZoneEntities.push(zEnt);
      }
    });

    // 7. Subtle 3D Fair-Weather Morning Clouds over Distant High Plateaus (sizeInMeters: true for natural 3D perspective)
    const cloudEntities = [];
    try {
      const cloudImg = createSoftCloudDataUrl();
      const distantCloudSpots = [
        [-112.55, 37.68, 5600, 1.3],
        [-111.72, 37.75, 5800, 1.1],
        [-113.35, 37.62, 5500, 1.2],
        [-110.85, 37.35, 5700, 1.0],
        [-113.85, 37.32, 5600, 1.15]
      ];
      distantCloudSpots.forEach(([clon, clat, calt, sc]) => {
        cloudEntities.push(
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(clon, clat, calt),
            billboard: {
              image: cloudImg,
              sizeInMeters: true,
              width: 9200 * sc,
              height: 2900 * sc,
              color: Cesium.Color.WHITE.withAlpha(0.72),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(12000, 360000)
            }
          })
        );
      });
    } catch (_) {}

    // 8. Interactive 3D Milestone Pins
    const milestoneEntities = [];
    const keyPins = [
      { label: 'LAUNCH · Page, AZ', lat: 36.928, lon: -111.451, alt: 1320, color: '#10b981', el: 1611, ox: -12, oy: 16 },
      { label: 'CAP 1 · 14,008 ft', lat: data.capsuleWindows[0].startLat, lon: data.capsuleWindows[0].startLon, alt: data.capsuleWindows[0].startAltM, color: '#38bdf8', el: 2185, ox: -58, oy: -4 },
      { label: 'CAP 2 · 28,006 ft', lat: data.capsuleWindows[1].startLat, lon: data.capsuleWindows[1].startLon, alt: data.capsuleWindows[1].startAltM, color: '#22d3ee', el: 2976, ox: -58, oy: -18 },
      { label: 'CAP 3 · 42,009 ft', lat: data.capsuleWindows[2].startLat, lon: data.capsuleWindows[2].startLon, alt: data.capsuleWindows[2].startAltM, color: '#818cf8', el: 3727, ox: -58, oy: -6 },
      { label: 'CAP 4 · 56,001 ft', lat: data.capsuleWindows[3].startLat, lon: data.capsuleWindows[3].startLon, alt: data.capsuleWindows[3].startAltM, color: '#a78bfa', el: 4456, ox: -58, oy: -18 },
      { label: 'CAP 5 · Float', lat: data.capsuleWindows[4].startLat, lon: data.capsuleWindows[4].startLon, alt: data.capsuleWindows[4].startAltM, color: '#f59e0b', el: 5203, ox: -42, oy: -20 },
      { label: 'PEAK · 84,185 ft', lat: 36.8036, lon: -113.107, alt: 25659.7, color: '#fbbf24', el: 17014, ox: 0, oy: -18 },
      { label: 'TERMINATION · 83,679 ft', lat: 36.8079, lon: -113.428, alt: 25505.5, color: '#ef4444', el: 18504, ox: 28, oy: 16 }
    ];

    keyPins.forEach((pin) => {
      const exactPos = sampleBalloonAtElapsed(pin.el);
      const ent = viewer.entities.add({
        position: exactPos.cart,
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString(pin.color),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.8,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: pin.label,
          font: '600 10.5px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.fromCssColorString('#030712'),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#050a16').withAlpha(0.8),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          pixelOffset: new Cesium.Cartesian2(pin.ox || 0, pin.oy || -16),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 420000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      ent._jumpElapsed = pin.el;
      milestoneEntities.push(ent);
    });

    const clickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && typeof picked.id._jumpElapsed === 'number') {
        seekToElapsed(picked.id._jumpElapsed);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 9. Dynamic 3D Expanding High-Altitude Balloon & Beacon Entity
    const balloonEntity = viewer.entities.add({
      name: 'World View N141WV — Payload World 24',
      position: new Cesium.CallbackProperty(() => currentSample.cart, false),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#38bdf8'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      ellipsoid: {
        radii: new Cesium.CallbackProperty(() => {
          const p = fl.bmePress[currentIndex] || 868.8;
          const expansion = Math.pow(868.8 / Math.max(22.2, p), 1 / 3); // 1.0x pad -> ~3.4x linear (39x vol) at float!
          const horizRadius = 22 * expansion;
          const vertRadius = 30 * Math.min(expansion, 2.6);
          return new Cesium.Cartesian3(horizRadius, horizRadius, vertRadius);
        }, false),
        material: Cesium.Color.fromCssColorString('#e0f2fe').withAlpha(0.84),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#7dd3fc').withAlpha(0.6)
      },
      label: {
        text: new Cesium.CallbackProperty(() => {
          const altM = currentSample.alt || 1272;
          const val =
            window.WORLD24_UNITS === 'imperial'
              ? `${Math.round(altM * 3.28084).toLocaleString()} ft`
              : `${Math.round(altM).toLocaleString()} m`;
          return `● N141WV · ${val}`;
        }, false),
        font: '700 12px "JetBrains Mono", monospace',
        fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#030712').withAlpha(0.9),
        backgroundPadding: new Cesium.Cartesian2(9, 5),
        pixelOffset: new Cesium.Cartesian2(0, -28),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    // 10. Signature Camera Modes (Default = Oblique Orbit Overview showing Sky + 3D Canyons + Full Path!)
    let activeCamMode = 'orbit';

    function flyToOrbitOverview(duration = 1.5) {
      viewer.trackedEntity = undefined;
      // Positioned inside the atmosphere (66 km) looking north across Grand Canyon, Lake Powell, Vermilion Cliffs & Kaibab Plateau:
      // Frames the entire 186 km trajectory from Launch (x ≈ 71%) to Termination (x ≈ 9%) completely clear of the right HUD sidebar!
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-112.12, 34.88, 67500),
        orientation: {
          heading: Cesium.Math.toRadians(0.4),
          pitch: Cesium.Math.toRadians(-19.4),
          roll: 0.0
        },
        duration
      });
    }

    flyToOrbitOverview(0);

    function setCameraMode(mode) {
      activeCamMode = mode;
      document.querySelectorAll('.cam-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.cam === mode);
      });

      if (mode === 'orbit') {
        flyToOrbitOverview(1.4);
      } else if (mode === 'chase') {
        balloonEntity.viewFrom = new Cesium.Cartesian3(-850, -1350, 220);
        viewer.trackedEntity = balloonEntity;
      } else if (mode === 'pov' || mode === 'pad') {
        viewer.trackedEntity = undefined;
      }
    }

    document.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => setCameraMode(btn.dataset.cam));
    });

    // 11. DOM References for Live HUD & Controls
    const dom = {
      loading: document.getElementById('viewerLoadingOverlay'),
      phaseBadge: document.getElementById('hudPhaseBadge'),
      missionClock: document.getElementById('hudMissionClock'),
      localTime: document.getElementById('hudLocalTime'),
      sunAngle: document.getElementById('hudSunAngle'),
      weatherChip: document.getElementById('hudWeatherChip'),
      coords: document.getElementById('hudCoords'),
      alt: document.getElementById('hudAlt'),
      altSec: document.getElementById('hudAltSecondary'),
      speed: document.getElementById('hudSpeed'),
      heading: document.getElementById('hudHeading'),
      vertRate: document.getElementById('hudVertRate'),
      balloonScale: document.getElementById('hudBalloonScale'),
      extTemp: document.getElementById('hudExtTemp'),
      intTemp: document.getElementById('hudIntTemp'),
      press: document.getElementById('hudPress'),
      pressPct: document.getElementById('hudPressPct'),
      uv: document.getElementById('hudUv'),
      hum: document.getElementById('hudHum'),
      pumpBadge: document.getElementById('hudPumpBadge'),
      shutterArm: document.getElementById('svgShutterArm'),
      diskState: document.getElementById('hudDiskState'),
      layerDesc: document.getElementById('hudLayerDesc'),
      lastEvent: document.getElementById('hudLastEvent'),
      playBtn: document.getElementById('btnPlayPause'),
      playIcon: document.getElementById('playIcon'),
      playLabel: document.getElementById('playLabel'),
      playhead: document.getElementById('timelinePlayhead'),
      timelineCanvas: document.getElementById('timelineCanvas'),
      timelineWrap: document.getElementById('timelineTrackWrap'),
      hoverTip: document.getElementById('timelineHoverTip')
    };

    const svgCaps = Array.from(document.querySelectorAll('.svg-cap'));
    const miniPills = Array.from(document.querySelectorAll('#hudCapsulePills span'));

    // Dismiss loading screen smoothly once globe begins rendering tiles
    let hiddenLoader = false;
    const hideLoader = () => {
      if (hiddenLoader || !dom.loading) return;
      hiddenLoader = true;
      dom.loading.style.opacity = '0';
      setTimeout(() => dom.loading.classList.add('hidden'), 420);
    };
    scene.globe.tileLoadProgressEvent.addEventListener((remaining) => {
      if (remaining < 14) hideLoader();
    });
    setTimeout(hideLoader, 2200);

    function updatePlayButtonUI() {
      if (dom.playIcon) dom.playIcon.textContent = isPlaying ? '❚❚' : '▶';
      if (dom.playLabel) dom.playLabel.textContent = isPlaying ? 'Pause' : 'Play';
      dom.playBtn?.classList.toggle('is-playing', isPlaying);
    }

    // 5-Capsule Rotary Disk Animation
    const capAngles = { 1: 0, 2: 72, 3: 144, 4: 216, 5: 288 };
    const inFlightEvents = data.capsuleEvents.filter((e) => e.inFlight && e.elapsed != null);

    function updateRotarySamplerHUD(el) {
      let activeCap = null;
      let diskLabel = 'Closed (Pre-Launch Pos)';
      let subDesc = 'Awaiting 14,000 ft (4,267 m) Troposphere trigger';
      let armAngle = -36;

      for (const cw of data.capsuleWindows) {
        if (el >= cw.startElapsed && el <= cw.endElapsed) {
          activeCap = cw.capsule;
          armAngle = capAngles[cw.capsule];
          diskLabel = `Capsule ${cw.capsule} OPEN · Drawing Air`;
          subDesc = cw.layer;
          break;
        } else if (el > cw.endElapsed) {
          armAngle = capAngles[cw.capsule] + 36;
          diskLabel = cw.capsule < 5 ? `${cw.sealName} Engaged (Isolated)` : 'All 5 Capsules Sealed (Pos 6)';
          subDesc =
            cw.capsule < 5
              ? `Awaiting Capsule ${cw.capsule + 1} altitude threshold`
              : 'Sampling sequence complete at float';
        }
      }

      dom.shutterArm?.setAttribute('transform', `rotate(${armAngle} 80 80)`);

      if (activeCap !== null) {
        dom.pumpBadge.textContent = `PUMP ON · CAP ${activeCap}`;
        dom.pumpBadge.className = 'pump-badge active';
      } else {
        dom.pumpBadge.textContent = el >= 17803 ? 'ALL SEALED' : 'PUMP STANDBY';
        dom.pumpBadge.className = 'pump-badge standby';
      }

      dom.diskState.textContent = diskLabel;
      dom.layerDesc.textContent = subDesc;

      svgCaps.forEach((g) => {
        const cNum = Number(g.dataset.cap);
        const cw = data.capsuleWindows[cNum - 1];
        g.classList.toggle('pumping', activeCap === cNum);
        g.classList.toggle('completed', el > cw.endElapsed);
      });

      miniPills.forEach((sp) => {
        const cNum = Number(sp.dataset.c);
        const cw = data.capsuleWindows[cNum - 1];
        sp.classList.toggle('pumping', activeCap === cNum);
        sp.classList.toggle('done', el > cw.endElapsed);
      });

      let latestEv = null;
      for (let i = 0; i < inFlightEvents.length; i++) {
        if (inFlightEvents[i].elapsed <= el) latestEv = inFlightEvents[i];
        else break;
      }
      dom.lastEvent.textContent = latestEv
        ? `WV ${latestEv.wvTime}s: ${latestEv.action}`
        : 'LOG: Standing by on Page, AZ launch pad';
    }

    function refreshHUD(idx, elapsedExact) {
      const isImp = window.WORLD24_UNITS === 'imperial';
      const phaseName = fl.phaseNames[fl.phase[idx]] || 'Ground';

      dom.phaseBadge.textContent = phaseName.toUpperCase();
      dom.phaseBadge.className =
        'clock-tag ' +
        (phaseName === 'Floating'
          ? 'phase-floating'
          : phaseName === 'Terminating'
          ? 'phase-terminating'
          : '');

      dom.missionClock.textContent = formatMissionClock(elapsedExact - liftoffEl);
      const utcNow = t0Utc + elapsedExact;
      dom.localTime.textContent = formatArizonaTime(utcNow);

      const lat = currentSample.lat;
      const lon = currentSample.lon;
      const altM = currentSample.alt;

      const sun = computeSolarAngles(utcNow, lat, lon);
      dom.sunAngle.textContent = `Sun: ${sun.elevDeg.toFixed(1)}° ${compassDir(sun.azDeg)}`;
      dom.coords.textContent = `${lat.toFixed(4)}°N, ${Math.abs(lon).toFixed(4)}°W`;

      // Dynamic Sky & Weather condition chip replicating July 1, 2026 morning atmosphere
      const hum = fl.bmeHum[idx];
      if (dom.weatherChip) {
        const rhTxt = hum != null ? `${Math.round(hum)}% RH` : '0% RH';
        let skyRegime = 'Clear Sky';
        if (altM > 20000) skyRegime = 'Stratosphere';
        else if (altM > 11000) skyRegime = 'Tropopause';
        else if (sun.elevDeg < 22) skyRegime = 'Clear Dawn';
        dom.weatherChip.textContent = `${skyRegime} · ${rhTxt}`;
      }

      // Subtle solar elevation brightness progression (golden dawn -> bright noon desert sky)
      const sunNorm = Math.max(0, Math.min(1, (sun.elevDeg - 10) / 60));
      scene.skyAtmosphere.brightnessShift = 0.03 + sunNorm * 0.11;

      const aglM = Math.max(0, altM - 1271.8);
      if (isImp) {
        dom.alt.textContent = `${Math.round(altM * 3.28084).toLocaleString()} ft`;
        dom.altSec.textContent = `${altM.toFixed(1)} m · +${Math.round(aglM * 3.28084).toLocaleString()} ft above pad`;
      } else {
        dom.alt.textContent = `${altM.toFixed(1)} m`;
        dom.altSec.textContent = `${Math.round(altM * 3.28084).toLocaleString()} ft · +${Math.round(aglM).toLocaleString()} m above pad`;
      }

      let gIdx = idx;
      while (gIdx > 0 && fl.speed[gIdx] == null) gIdx--;
      const spdMs = fl.speed[gIdx] ?? 0;
      const hdg = fl.heading[gIdx];
      dom.speed.textContent = isImp ? `${(spdMs * 2.23694).toFixed(1)} mph` : `${spdMs.toFixed(1)} m/s`;
      dom.heading.textContent = hdg != null ? `Heading: ${((hdg + 360) % 360).toFixed(0)}° (${compassDir(hdg)})` : 'Heading: --';

      const climbMs = -(fl.velDown[gIdx] ?? 0);
      const sign = climbMs >= 0 ? '+' : '';
      dom.vertRate.textContent = isImp
        ? `${sign}${(climbMs * 3.28084).toFixed(1)} ft/s`
        : `${sign}${climbMs.toFixed(2)} m/s`;

      const pressHpa = fl.bmePress[idx] ?? (fl.wvPressPsi[gIdx] != null ? fl.wvPressPsi[gIdx] * 68.9476 : 868.8);
      const volRatio = 868.8 / Math.max(22.2, pressHpa);
      dom.balloonScale.textContent = `Gas Expansion: ${volRatio.toFixed(1)}× pad vol`;

      const extC = fl.wvTemp[gIdx];
      const intC = fl.bmeTemp[idx];
      dom.extTemp.textContent =
        extC != null ? (isImp ? `${((extC * 9) / 5 + 32).toFixed(1)} °F` : `${extC.toFixed(1)} °C`) : '--';
      dom.intTemp.textContent =
        intC != null
          ? `Inside Box: ${isImp ? ((intC * 9) / 5 + 32).toFixed(1) + ' °F' : intC.toFixed(1) + ' °C'}`
          : 'Inside Box: I²C Retry';

      dom.press.textContent = `${pressHpa.toFixed(1)} hPa`;
      dom.pressPct.textContent = `${((pressHpa / 1013.25) * 100).toFixed(1)}% Sea Level`;

      const uva = fl.uva[idx];
      const uvb = fl.uvb[idx];
      dom.uv.textContent = uva != null && uvb != null ? `${Math.round(uva)} / ${uvb.toFixed(1)}` : 'I²C Gap';
      dom.hum.textContent = `RH: ${hum != null ? hum.toFixed(1) + '%' : '--'} · Stage ${fl.stage[idx]}`;

      updateRotarySamplerHUD(elapsedExact);

      const pct = Math.max(0, Math.min(100, (elapsedExact / maxElapsed) * 100));
      dom.playhead.style.left = `${pct}%`;

      updateVideoSyncBadge(elapsedExact);
    }

    window.onWorld24UnitsChange(() => {
      refreshHUD(currentIndex, simElapsed);
      drawTimelineCanvas();
    });

    // 12. Master 60-FPS Simulation Loop (Advances Clock, Trail, Sun, POV Cam & Video Sync)
    let lastWallMs = performance.now();
    let lastHudWallMs = 0;

    scene.preUpdate.addEventListener(() => {
      const nowMs = performance.now();
      const dtSec = Math.min(0.1, Math.max(0, (nowMs - lastWallMs) / 1000));
      lastWallMs = nowMs;

      if (isPlaying) {
        simElapsed += dtSec * playSpeed;
        if (simElapsed >= maxElapsed) {
          simElapsed = maxElapsed;
          setPlayingState(false);
        }
        viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
          startJulian,
          simElapsed,
          viewer.clock.currentTime
        );
        currentSample = sampleBalloonAtElapsed(simElapsed);
        currentIndex = findRowIndexByElapsed(fl.elapsed, simElapsed);
        rebuildTrailArrays(simElapsed);

        if (nowMs - lastHudWallMs > 55) {
          lastHudWallMs = nowMs;
          refreshHUD(currentIndex, simElapsed);
        }
        syncYoutubeDuringPlayback(simElapsed, nowMs);
      }

      // Dynamic camera tracking for Payload Horizon POV & Pad Ground View
      if (activeCamMode === 'pov') {
        let gIdx = currentIndex;
        while (gIdx > 0 && fl.heading[gIdx] == null) gIdx--;
        const hdgDeg = fl.heading[gIdx] ?? -75;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            currentSample.lon,
            currentSample.lat,
            Math.max(1310, currentSample.alt - 8)
          ),
          orientation: {
            heading: Cesium.Math.toRadians(hdgDeg),
            pitch: Cesium.Math.toRadians(-13),
            roll: 0
          }
        });
      } else if (activeCamMode === 'pad') {
        const padPos = Cesium.Cartesian3.fromDegrees(-111.462, 36.919, 1315);
        const dir = Cesium.Cartesian3.subtract(currentSample.cart, padPos, new Cesium.Cartesian3());
        if (Cesium.Cartesian3.magnitude(dir) > 1) {
          Cesium.Cartesian3.normalize(dir, dir);
          const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(padPos, new Cesium.Cartesian3());
          const right = Cesium.Cartesian3.cross(dir, up, new Cesium.Cartesian3());
          Cesium.Cartesian3.normalize(right, right);
          const orthoUp = Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3());
          viewer.camera.setView({
            destination: padPos,
            orientation: { direction: dir, up: orthoUp }
          });
        }
      }
    });

    // 13. Altitude Scrubber Canvas & Transport Controls
    function drawTimelineCanvas() {
      const cvs = dom.timelineCanvas;
      if (!cvs) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = cvs.getBoundingClientRect();
      if (rect.width < 10) return;
      cvs.width = Math.round(rect.width * dpr);
      cvs.height = Math.round(rect.height * dpr);
      const ctx = cvs.getContext('2d');
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      data.capsuleWindows.forEach((cw) => {
        const x0 = (cw.startElapsed / maxElapsed) * w;
        const x1 = (cw.endElapsed / maxElapsed) * w;
        ctx.fillStyle = cw.color + '28';
        ctx.fillRect(x0, 0, Math.max(2, x1 - x0), h);
        ctx.fillStyle = cw.color;
        ctx.fillRect(x0, 0, Math.max(2, x1 - x0), 3);
      });

      ctx.beginPath();
      let started = false;
      const maxAlt = 27000;
      for (let i = 0; i < fl.n; i += 25) {
        const alt = fl.alt[i];
        if (alt == null) continue;
        const x = (fl.elapsed[i] / maxElapsed) * w;
        const y = h - 4 - (alt / maxAlt) * (h - 10);
        if (!started) {
          ctx.moveTo(x, h);
          ctx.lineTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      started = false;
      for (let i = 0; i < fl.n; i += 25) {
        const alt = fl.alt[i];
        if (alt == null) continue;
        const x = (fl.elapsed[i] / maxElapsed) * w;
        const y = h - 4 - (alt / maxAlt) * (h - 10);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    setTimeout(drawTimelineCanvas, 120);
    window.addEventListener('resize', drawTimelineCanvas);

    function setPlayingState(playBool) {
      isPlaying = Boolean(playBool);
      lastWallMs = performance.now();
      updatePlayButtonUI();
      syncYoutubePlayState();
    }

    function setPlaybackSpeed(newSpeed) {
      playSpeed = Number(newSpeed) || 60;
      document.querySelectorAll('.spd-btn').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.spd) === playSpeed);
      });
      document.getElementById('btnRealTimeSync')?.classList.toggle('active', playSpeed === 1 && isPlaying);
      applyYoutubePlaybackRate();
    }

    function seekToElapsed(targetSec, immediateVideoSeek = true) {
      simElapsed = Math.max(0, Math.min(maxElapsed, targetSec));
      viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
        startJulian,
        simElapsed,
        viewer.clock.currentTime
      );
      currentSample = sampleBalloonAtElapsed(simElapsed);
      currentIndex = findRowIndexByElapsed(fl.elapsed, simElapsed);
      rebuildTrailArrays(simElapsed);
      refreshHUD(currentIndex, simElapsed);
      if (immediateVideoSeek) {
        seekYoutubeToElapsed(simElapsed, true);
      }
    }

    window.jumpFlightViewerToElapsed = function (elSec) {
      const section = document.getElementById('flight-viewer');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      seekToElapsed(elSec, true);
      setPlayingState(true);
    };

    // Scrubber drag & hover tooltip
    let isScrubbing = false;
    let lastScrubYtMs = 0;

    function scrubFromPointer(clientX, isFinal) {
      const rect = dom.timelineWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const target = ratio * maxElapsed;
      const now = performance.now();
      const doYt = isFinal || now - lastScrubYtMs > 280;
      if (doYt) lastScrubYtMs = now;
      seekToElapsed(target, doYt);
    }

    dom.timelineWrap?.addEventListener('pointerdown', (e) => {
      isScrubbing = true;
      dom.timelineWrap.setPointerCapture(e.pointerId);
      scrubFromPointer(e.clientX, true);
    });
    dom.timelineWrap?.addEventListener('pointermove', (e) => {
      const rect = dom.timelineWrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const hoverEl = ratio * maxElapsed;
      const smp = sampleBalloonAtElapsed(hoverEl);
      const altTxt =
        window.WORLD24_UNITS === 'imperial'
          ? `${Math.round(smp.alt * 3.28084).toLocaleString()} ft`
          : `${Math.round(smp.alt).toLocaleString()} m`;
      dom.hoverTip.textContent = `${formatMissionClock(hoverEl - liftoffEl)} · ${altTxt}`;
      dom.hoverTip.style.left = `${ratio * 100}%`;
      dom.hoverTip.classList.remove('hidden');

      if (isScrubbing) scrubFromPointer(e.clientX, false);
    });
    dom.timelineWrap?.addEventListener('pointerup', (e) => {
      if (isScrubbing) {
        isScrubbing = false;
        scrubFromPointer(e.clientX, true);
      }
    });
    dom.timelineWrap?.addEventListener('pointerleave', () => {
      dom.hoverTip.classList.add('hidden');
    });

    // Transport buttons
    dom.playBtn?.addEventListener('click', () => {
      if (!isPlaying && simElapsed >= maxElapsed - 1) {
        seekToElapsed(liftoffEl, true);
      }
      setPlayingState(!isPlaying);
    });

    document.getElementById('btnResetLiftoff')?.addEventListener('click', () => {
      seekToElapsed(liftoffEl, true);
    });

    document.getElementById('btnStepBack')?.addEventListener('click', () => {
      seekToElapsed(simElapsed - 30, true);
    });

    document.getElementById('btnStepFwd')?.addEventListener('click', () => {
      seekToElapsed(simElapsed + 30, true);
    });

    document.querySelectorAll('.spd-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setPlaybackSpeed(Number(btn.dataset.spd));
      });
    });

    document.querySelectorAll('.ms-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        seekToElapsed(Number(pill.dataset.el), true);
      });
    });

    // 14. Layers Dropdown & Fullscreen Controls
    const layerBtn = document.getElementById('layerMenuBtn');
    const layerDrop = document.getElementById('layerDropdown');
    layerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      layerDrop?.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (layerDrop && !layerDrop.contains(e.target) && e.target !== layerBtn) {
        layerDrop.classList.remove('open');
      }
    });

    document.querySelectorAll('input[name="basemap"]').forEach((radio) => {
      radio.addEventListener('change', () => applyBasemap(radio.value));
    });

    document.getElementById('chkCurtain')?.addEventListener('change', (e) => {
      curtainEntities.forEach((ent) => {
        ent.show = e.target.checked;
      });
    });

    document.getElementById('chkMilestones')?.addEventListener('change', (e) => {
      milestoneEntities.forEach((ent) => {
        ent.show = e.target.checked;
      });
    });

    document.getElementById('chkCapsuleZones')?.addEventListener('change', (e) => {
      capsuleZoneEntities.forEach((ent) => {
        ent.show = e.target.checked;
      });
    });

    document.getElementById('chkClouds')?.addEventListener('change', (e) => {
      cloudEntities.forEach((ent) => {
        ent.show = e.target.checked;
      });
    });

    document.getElementById('chkRealSun')?.addEventListener('change', (e) => {
      scene.globe.enableLighting = e.target.checked;
    });

    const hudSidebar = document.getElementById('viewerHudSidebar');
    document.getElementById('chkHUD')?.addEventListener('change', (e) => {
      if (hudSidebar) {
        hudSidebar.style.display = e.target.checked ? 'flex' : 'none';
      }
    });

    const viewerShell = document.getElementById('viewerShell');
    document.getElementById('fullscreenViewerBtn')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (viewerShell.requestFullscreen) {
          viewerShell.requestFullscreen().catch(() => {
            viewerShell.classList.toggle('theater-fullscreen');
          });
        } else {
          viewerShell.classList.toggle('theater-fullscreen');
        }
      } else {
        document.exitFullscreen?.();
      }
      setTimeout(drawTimelineCanvas, 250);
    });

    // 15. Expandable, Resizable & Tightly Synchronized Live Payload Video (YouTube IFrame API)
    const pipModal = document.getElementById('onboardVideoModal');
    const toggleVidBtn = document.getElementById('toggleOnboardVideoBtn');
    const closePipBtn = document.getElementById('closePipBtn');
    const minPipBtn = document.getElementById('minPipBtn');
    const expandPipBtn = document.getElementById('expandPipBtn');
    const resizeGrip = document.getElementById('pipResizeGrip');
    const chkSyncVideo = document.getElementById('chkSyncVideo');
    const pipSyncBadge = document.getElementById('pipSyncBadge');
    const btnRealTimeSync = document.getElementById('btnRealTimeSync');
    const pipChapters = document.getElementById('pipChaptersOnboard');
    const pipTitle = document.getElementById('pipFeedTitle');
    const pipNote = document.getElementById('pipStatusNote');
    const pipFileWarning = document.getElementById('pipFileWarning');
    const pipExternalLink = document.getElementById('pipExternalFallbackLink');

    let ytPlayer = null;
    let ytReady = false;
    let activeFeed = 'onboard'; // 'onboard' | 'livestream'
    let lastYtAutoSyncMs = 0;
    let pipSizeMode = 'compact'; // 'compact' | 'large' | 'theater'

    // Exact alignment offset: Session 28 Liftoff (Elapsed = 1611s) === Onboard Video Liftoff (1:38:40 = 5920s)
    const ONBOARD_VIDEO_OFFSET_SEC = 4309;

    function getTargetVideoSec(elapsedSec) {
      if (activeFeed === 'livestream') {
        return Math.max(0, Math.min(7460, Math.round(6340 + (elapsedSec - liftoffEl))));
      }
      return Math.max(0, Math.min(23020, Math.round(elapsedSec + ONBOARD_VIDEO_OFFSET_SEC)));
    }

    function updateVideoSyncBadge(elapsedSec) {
      const vSec = getTargetVideoSec(elapsedSec);
      if (pipSyncBadge) {
        pipSyncBadge.textContent = `Vid ${formatHMS(vSec)}`;
      }
      if (pipExternalLink) {
        const vidId = activeFeed === 'onboard' ? data.meta.onboardYoutubeId : data.meta.livestreamYoutubeId;
        pipExternalLink.href = `https://www.youtube.com/watch?v=${vidId}&t=${vSec}s`;
      }
    }

    function applyYoutubePlaybackRate() {
      if (!ytReady || !ytPlayer || typeof ytPlayer.setPlaybackRate !== 'function') return;
      try {
        // YouTube supports 0.25x..2x natively; use 1x for real-time and 2x when fast-forwarding
        ytPlayer.setPlaybackRate(playSpeed <= 1 ? 1 : 2);
      } catch (_) {}
    }

    function syncYoutubePlayState() {
      if (!ytReady || !ytPlayer || pipModal.classList.contains('hidden')) return;
      if (!chkSyncVideo || !chkSyncVideo.checked) return;
      try {
        if (isPlaying) {
          applyYoutubePlaybackRate();
          ytPlayer.playVideo?.();
        } else {
          ytPlayer.seekTo?.(getTargetVideoSec(simElapsed), true);
          ytPlayer.pauseVideo?.();
        }
      } catch (_) {}
    }

    function seekYoutubeToElapsed(elapsedSec, allowSeekAhead) {
      if (!ytReady || !ytPlayer || pipModal.classList.contains('hidden')) return;
      if (!chkSyncVideo || !chkSyncVideo.checked) return;
      try {
        const target = getTargetVideoSec(elapsedSec);
        ytPlayer.seekTo(target, Boolean(allowSeekAhead));
        lastYtAutoSyncMs = performance.now();
      } catch (_) {}
    }

    function syncYoutubeDuringPlayback(elapsedSec, nowMs) {
      if (!ytReady || !ytPlayer || pipModal.classList.contains('hidden')) return;
      if (!chkSyncVideo || !chkSyncVideo.checked) return;

      // At 1x real-time speed, check every 1.2s and only nudge if drifted > 2.2s;
      // At fast-forward (15x..360x), step smoothly every 1.8s so frames update without constant rebuffering
      const intervalMs = playSpeed <= 1 ? 1200 : 1800;
      if (nowMs - lastYtAutoSyncMs < intervalMs) return;

      const desiredSec = getTargetVideoSec(elapsedSec);
      const curVidSec = typeof ytPlayer.getCurrentTime === 'function' ? ytPlayer.getCurrentTime() : 0;
      const driftThreshold = playSpeed <= 1 ? 2.2 : 4.5;

      if (Math.abs(curVidSec - desiredSec) > driftThreshold) {
        try {
          ytPlayer.seekTo(desiredSec, true);
        } catch (_) {}
      }
      lastYtAutoSyncMs = nowMs;
    }

    function loadYouTubeApiOnce() {
      if (isFileProtocol) {
        pipFileWarning?.classList.remove('hidden');
        return;
      }
      pipFileWarning?.classList.add('hidden');

      if (window.YT && window.YT.Player) {
        createOrCuePlayer();
        return;
      }
      if (document.getElementById('ytIframeApiScript')) return;
      const tag = document.createElement('script');
      tag.id = 'ytIframeApiScript';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = function () {
        createOrCuePlayer();
      };
    }

    function createOrCuePlayer() {
      const startSec = getTargetVideoSec(simElapsed);
      const vidId = activeFeed === 'onboard' ? data.meta.onboardYoutubeId : data.meta.livestreamYoutubeId;
      const playerVars = {
        autoplay: 1,
        mute: 1,
        controls: 1,
        start: startSec,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1
      };
      if (window.location.protocol.startsWith('http')) {
        playerVars.origin = window.location.origin;
      }

      ytPlayer = new window.YT.Player('ytPlayerContainer', {
        width: '100%',
        height: '100%',
        host: 'https://www.youtube.com',
        videoId: vidId,
        playerVars,
        events: {
          onReady: (ev) => {
            ytReady = true;
            const ifr = ev.target.getIframe?.();
            if (ifr) {
              ifr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            }
            applyYoutubePlaybackRate();
            ev.target.seekTo(getTargetVideoSec(simElapsed), true);
            if (isPlaying) {
              ev.target.playVideo();
            }
          },
          onError: (err) => {
            console.warn('YouTube Embed Error code:', err.data);
            if (err.data === 153 || isFileProtocol) {
              pipFileWarning?.classList.remove('hidden');
            }
          }
        }
      });
    }

    toggleVidBtn?.addEventListener('click', () => {
      const opening = pipModal.classList.contains('hidden');
      pipModal.classList.toggle('hidden', !opening);
      pipModal.classList.remove('minimized');
      toggleVidBtn.classList.toggle('active', opening);
      if (opening) {
        updateVideoSyncBadge(simElapsed);
        if (!ytPlayer) {
          loadYouTubeApiOnce();
        } else if (ytReady) {
          seekYoutubeToElapsed(simElapsed, true);
          if (isPlaying) ytPlayer.playVideo?.();
        }
      } else if (ytReady && ytPlayer) {
        ytPlayer.pauseVideo?.();
      }
    });

    closePipBtn?.addEventListener('click', () => {
      pipModal.classList.add('hidden');
      toggleVidBtn?.classList.remove('active');
      ytPlayer?.pauseVideo?.();
    });

    // Minimize / Collapse button
    minPipBtn?.addEventListener('click', () => {
      const isMin = pipModal.classList.toggle('minimized');
      minPipBtn.textContent = isMin ? '▢' : '—';
      minPipBtn.title = isMin ? 'Restore Video Window' : 'Minimize / Collapse Video';
    });

    // Expand / Cycle Window Size (Compact PiP -> Large 760px -> Theater Full Stage)
    function applyPipSizeMode(mode) {
      pipSizeMode = mode;
      pipModal.classList.remove('minimized', 'size-large', 'size-theater');
      pipModal.style.width = ''; // Clear custom drag width when using preset button
      if (minPipBtn) minPipBtn.textContent = '—';

      if (mode === 'large') {
        pipModal.classList.add('size-large');
        if (expandPipBtn) expandPipBtn.textContent = '⛶ Theater';
      } else if (mode === 'theater') {
        pipModal.classList.add('size-theater');
        if (expandPipBtn) expandPipBtn.textContent = '⤡ Compact';
      } else {
        if (expandPipBtn) expandPipBtn.textContent = '⤢ Expand';
      }
    }

    expandPipBtn?.addEventListener('click', () => {
      if (pipSizeMode === 'compact') applyPipSizeMode('large');
      else if (pipSizeMode === 'large') applyPipSizeMode('theater');
      else applyPipSizeMode('compact');
    });

    // Double-click PiP header to toggle Expand quickly
    document.getElementById('pipDragHandle')?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      applyPipSizeMode(pipSizeMode === 'compact' ? 'large' : 'compact');
    });

    // 1x Real-Time Sync button: plays both 3D globe and onboard video at true 1x real-time lockstep!
    btnRealTimeSync?.addEventListener('click', () => {
      if (chkSyncVideo) chkSyncVideo.checked = true;
      setPlaybackSpeed(1);
      setPlayingState(true);
      seekYoutubeToElapsed(simElapsed, true);
      ytPlayer?.playVideo?.();
    });

    document.querySelectorAll('.pip-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeFeed = tab.dataset.feed;
        document.querySelectorAll('.pip-tab').forEach((t) => t.classList.toggle('active', t === tab));
        const isOnboard = activeFeed === 'onboard';
        pipTitle.textContent = isOnboard
          ? 'Payload Camera (1080p)'
          : 'NASA / World View Stream';
        pipChapters.style.display = isOnboard ? 'flex' : 'none';
        pipNote.textContent = isOnboard
          ? 'Recovered from the Kapton-taped 128 GB SanDisk Extreme microSD card inside the crushed enclosure · Drag corner to resize.'
          : 'Official Future Engineers & World View broadcast from Page, AZ (Tail N141WV, July 1, 2026).';

        updateVideoSyncBadge(simElapsed);
        if (ytReady && ytPlayer) {
          const vidId = isOnboard ? data.meta.onboardYoutubeId : data.meta.livestreamYoutubeId;
          ytPlayer.loadVideoById({ videoId: vidId, startSeconds: getTargetVideoSec(simElapsed) });
        }
      });
    });

    document.querySelectorAll('.pip-jump').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = Number(btn.dataset.el);
        const vsec = Number(btn.dataset.vsec);
        seekToElapsed(el, false);
        if (ytReady && ytPlayer) {
          ytPlayer.seekTo(vsec, true);
          if (isPlaying) ytPlayer.playVideo?.();
        }
      });
    });

    // Drag-Move PiP Window anywhere inside Viewer Shell
    const dragHandle = document.getElementById('pipDragHandle');
    let dragOffset = null;
    dragHandle?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || pipSizeMode === 'theater') return;
      const box = pipModal.getBoundingClientRect();
      dragOffset = {
        dx: e.clientX - box.left,
        dy: e.clientY - box.top,
        bw: box.width,
        bh: box.height
      };
      dragHandle.setPointerCapture(e.pointerId);
    });
    dragHandle?.addEventListener('pointermove', (e) => {
      if (!dragOffset) return;
      const parentBox = viewerShell.getBoundingClientRect();
      const left = Math.max(8, Math.min(parentBox.width - dragOffset.bw - 8, e.clientX - parentBox.left - dragOffset.dx));
      const top = Math.max(58, Math.min(parentBox.height - 64, e.clientY - parentBox.top - dragOffset.dy));
      pipModal.style.left = `${left}px`;
      pipModal.style.top = `${top}px`;
    });
    dragHandle?.addEventListener('pointerup', () => {
      dragOffset = null;
    });

    // Drag-Resize Corner Grip for Arbitrary Custom Video Window Sizing
    let resizeState = null;
    resizeGrip?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const box = pipModal.getBoundingClientRect();
      pipModal.classList.remove('size-large', 'size-theater');
      pipModal.classList.add('resizing');
      pipSizeMode = 'compact';
      if (expandPipBtn) expandPipBtn.textContent = '⤢ Expand';
      resizeState = {
        startX: e.clientX,
        startW: box.width
      };
      resizeGrip.setPointerCapture(e.pointerId);
    });
    resizeGrip?.addEventListener('pointermove', (e) => {
      if (!resizeState) return;
      const parentBox = viewerShell.getBoundingClientRect();
      const box = pipModal.getBoundingClientRect();
      const maxW = parentBox.width - (box.left - parentBox.left) - 12;
      const newW = Math.max(320, Math.min(maxW, resizeState.startW + (e.clientX - resizeState.startX)));
      pipModal.style.width = `${Math.round(newW)}px`;
    });
    resizeGrip?.addEventListener('pointerup', () => {
      resizeState = null;
      pipModal.classList.remove('resizing');
    });

    // Keyboard shortcuts when viewer is visible (Space = Play/Pause, Arrows = -30s/+30s, F = Fullscreen)
    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      const rect = viewerShell?.getBoundingClientRect();
      if (!rect || rect.bottom < 80 || rect.top > window.innerHeight - 80) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying && simElapsed >= maxElapsed - 1) seekToElapsed(liftoffEl, true);
        setPlayingState(!isPlaying);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekToElapsed(simElapsed - 30, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekToElapsed(simElapsed + 30, true);
      } else if (e.key === 'f' || e.key === 'F') {
        document.getElementById('fullscreenViewerBtn')?.click();
      }
    });

    // Initial render state
    window.WORLD24_VIEWER = viewer;
    window.seekFlightViewer = seekToElapsed;
    updatePlayButtonUI();
    refreshHUD(currentIndex, simElapsed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlightViewer);
  } else {
    initFlightViewer();
  }
})();
