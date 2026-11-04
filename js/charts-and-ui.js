/* ==========================================================================
   TR5 // WORLD 24 — TELEMETRY ANALYTICS, SEM/EDS EXPLORER & UI INTERACTIVITY
   All values sourced directly from WORLD_24.txt, error_log.txt & UW–Madison SEM
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. NAVIGATION, MOBILE MENU, TABLE JUMP LINKS & LIGHTBOX
     ------------------------------------------------------------------------ */
  function initPageChrome() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.querySelector('.main-nav');

    mobileBtn?.addEventListener('click', () => {
      mainNav?.classList.toggle('open');
    });

    document.querySelectorAll('.main-nav .nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav?.classList.remove('open');
      });
    });

    // Scroll-spy for top navigation links
    const navLinks = Array.from(document.querySelectorAll('.main-nav .nav-link'));
    const sectionIds = navLinks
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('#'))
      .map((h) => h.slice(1));

    if ('IntersectionObserver' in window) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.id;
              navLinks.forEach((a) => {
                const href = a.getAttribute('href');
                const match = href === `#${id}`;
                if (href === '#flight-viewer') {
                  a.classList.add('active-cta');
                } else {
                  a.classList.remove('active-cta');
                  a.style.color = match ? '#38bdf8' : '';
                }
              });
            }
          });
        },
        { rootMargin: '-28% 0px -60% 0px', threshold: 0.02 }
      );

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) spy.observe(el);
      });
    }

    // "View in 3D ->" buttons in the In-Flight Capsule Actuation table
    document.querySelectorAll('.table-jump-btn[data-jump-el]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetEl = Number(btn.dataset.jumpEl);
        if (!Number.isNaN(targetEl) && typeof window.jumpFlightViewerToElapsed === 'function') {
          window.jumpFlightViewerToElapsed(targetEl);
        }
      });
    });

    // Engineering Iteration Tabs (Final Flight Payload / V2 / V1 / Wiring)
    const engTabs = document.querySelectorAll('.eng-tab[data-etab]');
    const engPanels = document.querySelectorAll('.eng-panel');
    engTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.etab;
        engTabs.forEach((t) => t.classList.toggle('active', t === tab));
        engPanels.forEach((p) => p.classList.toggle('active', p.id === `epanel-${key}`));
      });
    });

    // High-Resolution Image Lightbox Modal
    const modal = document.getElementById('lightboxModal');
    const modalImg = document.getElementById('lightboxImg');
    const modalCap = document.getElementById('lightboxCaption');
    const closeBtn = document.getElementById('lightboxClose');

    function openLightbox(src, caption, altText) {
      if (!modal || !modalImg || !src) return;
      modalImg.src = src;
      modalImg.alt = altText || caption || 'TR5 World 24 Project Image';
      if (modalCap) modalCap.textContent = caption || '';
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (!modal || modal.classList.contains('hidden')) return;
      modal.classList.add('hidden');
      modalImg.src = '';
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-lightbox]').forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const src = card.getAttribute('data-lightbox');
        const cap = card.getAttribute('data-caption') || '';
        const innerImg = card.querySelector('img');
        openLightbox(src, cap, innerImg ? innerImg.alt : '');
      });
    });

    closeBtn?.addEventListener('click', closeLightbox);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });

    // Global Keyboard Shortcuts (Escape, Space for 3D replay, F for Fullscreen)
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        closeLightbox();
        document.getElementById('layerDropdown')?.classList.remove('open');
        const shell = document.getElementById('viewerShell');
        if (shell?.classList.contains('theater-fullscreen')) {
          shell.classList.remove('theater-fullscreen');
        }
        return;
      }

      // Check if 3D Flight Viewer is prominently visible on screen
      const shell = document.getElementById('viewerShell');
      if (!shell) return;
      const r = shell.getBoundingClientRect();
      const viewerVisible =
        document.fullscreenElement === shell ||
        shell.classList.contains('theater-fullscreen') ||
        (r.top < window.innerHeight * 0.65 && r.bottom > window.innerHeight * 0.35);

      if (!viewerVisible) return;

      if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('btnPlayPause')?.click();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        document.getElementById('fullscreenViewerBtn')?.click();
      }
    });
  }

  /* ------------------------------------------------------------------------
     2. UW–MADISON SEM & 8-ELEMENT EDS INTERACTIVE EXPLORER
     ------------------------------------------------------------------------ */
  function initSemExplorer() {
    const semViewport = document.getElementById('semViewport');
    const semBaseImg = document.getElementById('semBaseImg');
    const semEdsOverlay = document.getElementById('semEdsOverlay');
    const semMagnifier = document.getElementById('semMagnifier');
    const chkSemLoupe = document.getElementById('chkSemLoupe');
    const edsSlider = document.getElementById('edsOverlaySlider');
    const overlayPctVal = document.getElementById('overlayPctVal');
    const overlayElemLabel = document.getElementById('overlayElemLabel');
    const edsSelectedCardImg = document.getElementById('edsSelectedCardImg');
    const edsDetailTitle = document.getElementById('edsDetailTitle');
    const edsDetailBody = document.getElementById('edsDetailBody');

    if (!semViewport || !semBaseImg || !semEdsOverlay) return;

    // Exact physical scan ROI coordinates matching Aztec 'Map Data 1' (~2.13 µm wide)
    // onto both the 34.97 KX (3.270 µm wide) and 29.46 KX (3.881 µm wide) micrographs
    const semModes = {
      '35kx': {
        src: 'assets/images/sem/zirconium_sem_35kx.jpg',
        roi: { top: '5.86%', left: '16.80%', width: '65.14%', height: '64.45%' }
      },
      '29kx': {
        src: 'assets/images/sem/zirconium_sem_29kx.jpg',
        roi: { top: '13.50%', left: '20.50%', width: '54.88%', height: '54.31%' }
      }
    };

    const edsElements = {
      Zr: {
        line: 'Zr Lα1',
        color: '#2dd4bf',
        title: 'Zirconium (Zr Lα1) — Primary Discovery',
        body: 'Intense, sharply bounded Zr Lα1 X-ray emission maps directly to the ~1.8 µm crystalline/agglomerated grain sitting atop the 0.1 µm polycarbonate pores. Co-localized with Oxygen and Phosphorus (consistent with a zirconium phosphate/oxide or refractory zircon-type mineral/aerospace phase).'
      },
      O: {
        line: 'O Kα1',
        color: '#4ade80',
        title: 'Oxygen (O Kα1) — Oxide / Phosphate Matrix',
        body: 'Strong O Kα1 X-ray emission fills the entire ~1.8 µm particle contour above the faint polycarbonate oxygen background, confirming the Zirconium-bearing grain is an oxidized mineral or refractory oxide/phosphate compound rather than bare metal.'
      },
      P: {
        line: 'P Kα1',
        color: '#3b82f6',
        title: 'Phosphorus (P Kα1) — Co-Localized Major Phase',
        body: 'Bright P Kα1 X-ray counts mirror the Zr Lα1 and O Kα1 spatial silhouette lobe-for-lobe across the grain, pointing strongly toward a zirconium-phosphate compound or phosphorus-bearing refractory mineral.'
      },
      Ni: {
        line: 'Ni Lα1,2',
        color: '#d946ef',
        title: 'Nickel (Ni Lα1,2) — Co-Localized Transition Metal',
        body: 'Distinct Ni Lα1,2 X-ray signal enriched across the particle body relative to the surrounding filter membrane, accompanying the Iron and Chromium transition-metal signatures.'
      },
      Ce: {
        line: 'Ce Lα1',
        color: '#84cc16',
        title: 'Cerium (Ce Lα1) — Trace Rare-Earth Signal',
        body: 'Moderate lanthanide Ce Lα1 counts distributed across the grain contour. Rare-earth elements such as Cerium frequently substitute into natural zircon/phosphate crystal lattices and specialized high-temperature ceramics.'
      },
      Fe: {
        line: 'Fe Kα1',
        color: '#f97316',
        title: 'Iron (Fe Kα1) — Grain Signal & Upper-Left Hotspot',
        body: 'Diffuse Fe Kα1 emission spans the main particle mass with a concentrated sub-micron iron-rich sub-grain visible near the upper-left crest of the cluster.'
      },
      Cr: {
        line: 'Cr Kα1',
        color: '#eab308',
        title: 'Chromium (Cr Kα1) — Trace Refractory / Alloy Signal',
        body: 'Low-level Cr Kα1 counts lightly outline the particle cluster alongside Iron and Nickel, typical of trace stainless/superalloy or refractory oxide particulates.'
      },
      C: {
        line: 'C Kα1,2',
        color: '#ef4444',
        title: 'Carbon (C Kα1,2) — Polycarbonate Filter Shadow',
        body: 'Bright red C Kα1,2 emission comes from the surrounding 0.1 µm track-etched polycarbonate membrane filter, while the dense Zirconium-rich particle blocks underlying carbon X-rays—casting a crisp dark silhouette!'
      }
    };

    let activeElement = 'Zr';

    function applyOverlayOpacity(valNum) {
      const pct = Math.max(0, Math.min(85, Number(valNum) || 0));
      semEdsOverlay.style.opacity = (pct / 100).toFixed(2);
      semEdsOverlay.style.borderColor =
        pct > 0 ? edsElements[activeElement].color + '99' : 'transparent';
      if (overlayPctVal) overlayPctVal.textContent = `${pct}%`;
    }

    // Initialize border hidden when slider starts at 0%
    applyOverlayOpacity(edsSlider ? edsSlider.value : 0);

    // SEM Magnification View Switcher (34.97 KX vs 29.46 KX)
    document.querySelectorAll('.sem-vbtn[data-sem]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = semModes[btn.dataset.sem];
        if (!mode) return;
        document.querySelectorAll('.sem-vbtn').forEach((b) => b.classList.toggle('active', b === btn));
        semBaseImg.src = mode.src;
        semEdsOverlay.style.top = mode.roi.top;
        semEdsOverlay.style.left = mode.roi.left;
        semEdsOverlay.style.width = mode.roi.width;
        semEdsOverlay.style.height = mode.roi.height;
        if (semMagnifier) {
          semMagnifier.style.backgroundImage = `url("${mode.src}")`;
        }
      });
    });

    // EDS Slider Blend Control
    edsSlider?.addEventListener('input', (e) => {
      applyOverlayOpacity(e.target.value);
    });

    // 8-Element EDS Selector Pills
    document.querySelectorAll('.eds-pill[data-el]').forEach((pill) => {
      pill.addEventListener('click', () => {
        const el = pill.dataset.el;
        const meta = edsElements[el];
        if (!meta) return;
        activeElement = el;

        document.querySelectorAll('.eds-pill').forEach((p) => p.classList.toggle('active', p === pill));
        semEdsOverlay.src = `assets/images/sem/eds_map_${el}.png`;
        if (edsSelectedCardImg) edsSelectedCardImg.src = `assets/images/sem/eds_card_${el}.png`;
        if (overlayElemLabel) overlayElemLabel.textContent = meta.line;
        if (edsDetailTitle) edsDetailTitle.textContent = meta.title;
        if (edsDetailBody) edsDetailBody.textContent = meta.body;

        // If user clicks an element pill while overlay is at 0%, gently preview at 58% blend
        if (edsSlider && Number(edsSlider.value) === 0) {
          edsSlider.value = '58';
        }
        applyOverlayOpacity(edsSlider ? edsSlider.value : 58);
      });
    });

    // 2.8x Optical Hover Magnifier Loupe on SEM Micrograph
    const ZOOM = 2.8;
    const LOUPE_SIZE = 170;
    if (semMagnifier) {
      semMagnifier.style.backgroundImage = `url("${semBaseImg.src}")`;
    }

    function updateMagnifier(e) {
      if (!semMagnifier || (chkSemLoupe && !chkSemLoupe.checked)) {
        semMagnifier?.classList.add('hidden');
        return;
      }
      const rect = semViewport.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Keep loupe within the electron image region (above bottom white data bar)
      if (x < 0 || y < 0 || x > rect.width || y > rect.height * 0.885) {
        semMagnifier.classList.add('hidden');
        return;
      }

      semMagnifier.classList.remove('hidden');
      semMagnifier.style.backgroundSize = `${rect.width * ZOOM}px ${rect.height * ZOOM}px`;
      const bgX = -(x * ZOOM - LOUPE_SIZE / 2);
      const bgY = -(y * ZOOM - LOUPE_SIZE / 2);
      semMagnifier.style.backgroundPosition = `${bgX}px ${bgY}px`;

      const left = Math.max(6, Math.min(rect.width - LOUPE_SIZE - 6, x - LOUPE_SIZE / 2));
      const top = Math.max(6, Math.min(rect.height * 0.885 - LOUPE_SIZE - 6, y - LOUPE_SIZE / 2));
      semMagnifier.style.left = `${left}px`;
      semMagnifier.style.top = `${top}px`;
    }

    semViewport.addEventListener('pointermove', updateMagnifier);
    semViewport.addEventListener('pointerleave', () => {
      semMagnifier?.classList.add('hidden');
    });
    chkSemLoupe?.addEventListener('change', () => {
      if (!chkSemLoupe.checked) semMagnifier?.classList.add('hidden');
    });
  }

  /* ------------------------------------------------------------------------
     3. CHART.JS TELEMETRY & CRASH FORENSICS CHARTS
     ------------------------------------------------------------------------ */
  function initTelemetryCharts() {
    const data = window.WORLD24_DATA;
    if (!data || typeof window.Chart === 'undefined') {
      console.warn('Chart.js or WORLD24_DATA unavailable');
      return;
    }

    const Chart = window.Chart;
    const fl = data.flight;
    const liftoffEl = fl.liftoffElapsed; // 1611 s

    // Global Dark Aerospace Chart Styling
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = '"JetBrains Mono", monospace';
    Chart.defaults.font.size = 11;

    const gridColor = 'rgba(148, 163, 184, 0.11)';
    const tooltipTheme = {
      backgroundColor: 'rgba(5, 10, 22, 0.95)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(56, 189, 248, 0.42)',
      borderWidth: 1,
      padding: 10,
      displayColors: true
    };

    const cToF = (c) => (c * 9) / 5 + 32;
    const mToFt = (m) => m * 3.28084;

    function fmtTPlusMin(elSec) {
      const m = Math.round((elSec - liftoffEl) / 60);
      return m < 0 ? `T${m}m` : `T+${m}m`;
    }

    // Subsample Session 28 every 30 rows (~30s) for responsive 60fps interactive charts
    const stepIndices = [];
    for (let i = 0; i < fl.n; i += 30) {
      stepIndices.push(i);
    }
    if (stepIndices[stepIndices.length - 1] !== fl.n - 1) {
      stepIndices.push(fl.n - 1);
    }

    const timeLabels = stepIndices.map((idx) => fmtTPlusMin(fl.elapsed[idx]));

    /* --- CHART 1: Vertical Temperature Inversion Sounding (Temp vs Altitude) --- */
    let tempChart = null;
    const ctxTemp = document.getElementById('chartTempProfile');

    function buildTempProfileDatasets(isImp) {
      const extPoints = [];
      const intPoints = [];

      for (let k = 0; k < stepIndices.length; k++) {
        const i = stepIndices[k];
        if (fl.elapsed[i] < liftoffEl - 120) continue; // From launch prep through termination
        const altM = fl.alt[i];
        if (altM == null) continue;
        const yAlt = isImp ? Math.round(mToFt(altM)) : Math.round(altM);

        if (fl.wvTemp[i] != null) {
          extPoints.push({
            x: Number((isImp ? cToF(fl.wvTemp[i]) : fl.wvTemp[i]).toFixed(1)),
            y: yAlt,
            tLabel: fmtTPlusMin(fl.elapsed[i])
          });
        }
        if (fl.bmeTemp[i] != null) {
          intPoints.push({
            x: Number((isImp ? cToF(fl.bmeTemp[i]) : fl.bmeTemp[i]).toFixed(1)),
            y: yAlt,
            tLabel: fmtTPlusMin(fl.elapsed[i])
          });
        }
      }

      return [
        {
          label: 'Outside Ambient (WV Sensor)',
          data: extPoints,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderWidth: 2.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          showLine: true,
          tension: 0.2
        },
        {
          label: 'Inside Payload Box (BME688)',
          data: intPoints,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          borderWidth: 2.0,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          showLine: true,
          tension: 0.2
        }
      ];
    }

    if (ctxTemp) {
      const isImpInit = window.WORLD24_UNITS !== 'metric';
      tempChart = new Chart(ctxTemp, {
        type: 'scatter',
        data: {
          datasets: buildTempProfileDatasets(isImpInit)
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              labels: { boxWidth: 12, usePointStyle: true, color: '#cbd5e1' }
            },
            tooltip: {
              ...tooltipTheme,
              callbacks: {
                label: (ctx) => {
                  const isImp = window.WORLD24_UNITS !== 'metric';
                  const raw = ctx.raw;
                  const tUnit = isImp ? '°F' : '°C';
                  const aUnit = isImp ? 'ft' : 'm';
                  return `${ctx.dataset.label}: ${raw.x} ${tUnit} at ${raw.y.toLocaleString()} ${aUnit} (${raw.tLabel})`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: isImpInit ? 'Temperature (°F)' : 'Temperature (°C)',
                color: '#94a3b8'
              },
              grid: { color: gridColor }
            },
            y: {
              type: 'linear',
              title: {
                display: true,
                text: isImpInit ? 'Altitude MSL (ft)' : 'Altitude MSL (m)',
                color: '#94a3b8'
              },
              grid: { color: gridColor },
              ticks: {
                callback: (v) => v.toLocaleString()
              }
            }
          }
        }
      });
    }

    /* --- CHART 2: Barometric Pressure & Desert Humidity vs Flight Time --- */
    const ctxPress = document.getElementById('chartPressure');
    if (ctxPress) {
      const pressSeries = stepIndices.map((i) => fl.bmePress[i]);
      const humSeries = stepIndices.map((i) => fl.bmeHum[i]);

      new Chart(ctxPress, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [
            {
              label: 'Barometric Pressure (hPa)',
              data: pressSeries,
              yAxisID: 'yPress',
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.14)',
              fill: true,
              borderWidth: 2.2,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.25
            },
            {
              label: 'Relative Humidity (%)',
              data: humSeries,
              yAxisID: 'yHum',
              borderColor: '#10b981',
              borderWidth: 1.9,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { boxWidth: 12, usePointStyle: true, color: '#cbd5e1' } },
            tooltip: {
              ...tooltipTheme,
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed.y;
                  if (val == null) return `${ctx.dataset.label}: I²C Gap`;
                  if (ctx.datasetIndex === 0) {
                    const psi = (val * 0.0145038).toFixed(2);
                    return `Pressure: ${val.toFixed(1)} hPa (${psi} PSI)`;
                  }
                  return `Humidity: ${val.toFixed(1)}% RH`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { maxTicksLimit: 8 }
            },
            yPress: {
              type: 'linear',
              position: 'left',
              min: 0,
              max: 920,
              title: { display: true, text: 'Pressure (hPa)', color: '#38bdf8' },
              grid: { color: gridColor }
            },
            yHum: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 20,
              title: { display: true, text: 'Humidity (% RH)', color: '#10b981' },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    /* --- CHART 3: Stratospheric UV Surge (AS7331 UVA & UVB) --- */
    const ctxUv = document.getElementById('chartUv');
    if (ctxUv) {
      const uvaSeries = stepIndices.map((i) => fl.uva[i]);
      const uvbSeries = stepIndices.map((i) => fl.uvb[i]);

      new Chart(ctxUv, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [
            {
              label: 'UVA Channel (AS7331)',
              data: uvaSeries,
              yAxisID: 'yUva',
              borderColor: '#a78bfa',
              backgroundColor: 'rgba(167, 139, 250, 0.12)',
              fill: true,
              borderWidth: 1.8,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.2
            },
            {
              label: 'UVB Channel (Ozone Sensitive)',
              data: uvbSeries,
              yAxisID: 'yUvb',
              borderColor: '#38bdf8',
              borderWidth: 2.0,
              pointRadius: 0,
              spanGaps: true,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { boxWidth: 12, usePointStyle: true, color: '#cbd5e1' } },
            tooltip: tooltipTheme
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { maxTicksLimit: 8 }
            },
            yUva: {
              type: 'linear',
              position: 'left',
              min: 0,
              title: { display: true, text: 'UVA Counts / Irradiance', color: '#a78bfa' },
              grid: { color: gridColor }
            },
            yUvb: {
              type: 'linear',
              position: 'right',
              min: 0,
              title: { display: true, text: 'UVB Counts / Irradiance', color: '#38bdf8' },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    /* --- CHART 4: Post-Termination Rapid Descent Forensics (Sessions 29 & 30) --- */
    let descentChart = null;
    const ctxDescent = document.getElementById('chartDescent');

    function buildDescentDatasets(isImp) {
      const s29 = data.descentSessions[0]; // 139 rows: 10,747.1 m -> 3,111.6 m
      const s30 = data.descentSessions[1]; // 12 rows:  2,676.1 m -> 2,325.9 m

      // Extrapolated ~8s brownout/reboot gap between 3,111.6 m and 2,676.1 m at 55.3 m/s
      const s30TimeOffset = 147;

      const pts29 = [];
      for (let i = 0; i < s29.rows; i++) {
        if (s29.bmeAlt[i] == null) continue;
        pts29.push({
          x: s29.elapsed[i],
          y: Number((isImp ? mToFt(s29.bmeAlt[i]) : s29.bmeAlt[i]).toFixed(1)),
          press: s29.bmePress[i]
        });
      }

      const pts30 = [];
      for (let i = 0; i < s30.rows; i++) {
        if (s30.bmeAlt[i] == null) continue;
        pts30.push({
          x: s30TimeOffset + s30.elapsed[i],
          y: Number((isImp ? mToFt(s30.bmeAlt[i]) : s30.bmeAlt[i]).toFixed(1)),
          press: s30.bmePress[i]
        });
      }

      return [
        {
          label: 'Session 29 Mid-Air Reboot (139s @ 124 mph)',
          data: pts29,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.16)',
          fill: true,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          showLine: true
        },
        {
          label: 'Session 30 Final Reboot Before Impact (12s)',
          data: pts30,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.25)',
          fill: true,
          borderWidth: 3.0,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          showLine: true
        }
      ];
    }

    if (ctxDescent) {
      const isImpInit = window.WORLD24_UNITS !== 'metric';
      descentChart = new Chart(ctxDescent, {
        type: 'scatter',
        data: {
          datasets: buildDescentDatasets(isImpInit)
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: { labels: { boxWidth: 12, usePointStyle: true, color: '#cbd5e1' } },
            tooltip: {
              ...tooltipTheme,
              callbacks: {
                label: (ctx) => {
                  const isImp = window.WORLD24_UNITS !== 'metric';
                  const raw = ctx.raw;
                  const unit = isImp ? 'ft' : 'm';
                  const rateStr = isImp ? '~124 mph down' : '~55.3 m/s down';
                  return `t+${raw.x}s: ${raw.y.toLocaleString()} ${unit} (${raw.press} hPa · ${rateStr})`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              min: 0,
              max: 162,
              title: { display: true, text: 'Seconds Since Mid-Air Reboot (s)', color: '#94a3b8' },
              grid: { color: gridColor }
            },
            y: {
              type: 'linear',
              min: isImpInit ? 5000 : 1500,
              title: {
                display: true,
                text: isImpInit ? 'BME688 Barometric Altitude (ft)' : 'BME688 Barometric Altitude (m)',
                color: '#fca5a5'
              },
              grid: { color: gridColor },
              ticks: { callback: (v) => v.toLocaleString() }
            }
          }
        }
      });
    }

    /* --- CHART 5: I2C [Errno 5] Error Burst Histogram (error_log.txt) --- */
    const ctxErrors = document.getElementById('chartErrors');
    if (ctxErrors && data.errorHistogram) {
      const hist = data.errorHistogram;
      const errLabels = hist.binMinutes.map((min) => `${min}m`);

      new Chart(ctxErrors, {
        type: 'bar',
        data: {
          labels: errLabels,
          datasets: [
            {
              label: '[Errno 5] I²C Retry Count',
              data: hist.counts,
              backgroundColor: 'rgba(245, 158, 11, 0.58)',
              borderColor: '#f59e0b',
              borderWidth: 1,
              borderRadius: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipTheme,
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const m0 = hist.binMinutes[idx];
                  return `Elapsed ${m0}–${m0 + 10} min`;
                },
                label: (ctx) => `${ctx.parsed.y} logged [Errno 5] events`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxTicksLimit: 7 }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { maxTicksLimit: 5 }
            }
          }
        }
      });
    }

    // React dynamically when user toggles FT · °F / M · °C in sticky header!
    if (typeof window.onWorld24UnitsChange === 'function') {
      window.onWorld24UnitsChange((unitMode) => {
        const isImp = unitMode === 'imperial';

        if (tempChart) {
          tempChart.data.datasets = buildTempProfileDatasets(isImp);
          tempChart.options.scales.x.title.text = isImp ? 'Temperature (°F)' : 'Temperature (°C)';
          tempChart.options.scales.y.title.text = isImp ? 'Altitude MSL (ft)' : 'Altitude MSL (m)';
          tempChart.update('none');
        }

        if (descentChart) {
          descentChart.data.datasets = buildDescentDatasets(isImp);
          descentChart.options.scales.y.min = isImp ? 5000 : 1500;
          descentChart.options.scales.y.title.text = isImp
            ? 'BME688 Barometric Altitude (ft)'
            : 'BME688 Barometric Altitude (m)';
          descentChart.update('none');
        }
      });
    }
  }

  function ensureChartJsAndInit(retriesLeft = 12) {
    if (window.WORLD24_DATA && typeof window.Chart !== 'undefined') {
      initTelemetryCharts();
      return;
    }
    if (retriesLeft === 8 && typeof window.Chart === 'undefined' && !document.getElementById('chartJsFallback')) {
      const fb = document.createElement('script');
      fb.id = 'chartJsFallback';
      fb.src = 'https://unpkg.com/chart.js@4.4.4/dist/chart.umd.js';
      document.head.appendChild(fb);
    }
    if (retriesLeft > 0) {
      setTimeout(() => ensureChartJsAndInit(retriesLeft - 1), 250);
    }
  }

  function bootAll() {
    initPageChrome();
    initSemExplorer();
    ensureChartJsAndInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }
})();
