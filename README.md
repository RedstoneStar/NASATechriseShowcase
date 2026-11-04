# 🚀 "What’s Up There?" — NASA TechRise Flight World 24 (`N141WV`)

[![NASA TechRise](https://img.shields.io/badge/NASA%20TechRise-Student%20Challenge%202025--2026-blue?style=for-the-badge&logo=nasa)](https://www.futureengineers.org/nasatechrise)
[![Live Site](https://img.shields.io/badge/Live%20Website-GitHub%20Pages-brightgreen?style=for-the-badge&logo=githubpages)](https://redstonestar.github.io/NASATechriseShowcase/)
[![Flight Tail](https://img.shields.io/badge/Stratollite-N141WV%20%7C%20World%2024-informational?style=for-the-badge)](https://flightaware.com)
[![Apogee](https://img.shields.io/badge/Max%20Altitude-84%2C185%20ft%20(25%2C659.7%20m)-purple?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)]()

An interactive, high-fidelity **3D stratospheric flight reconstruction and scientific research showcase** for **Oconomowoc High School's NASA TechRise Student Challenge** experiment aboard World View Stratollite high-altitude balloon **`N141WV`** (*Flight World 24 / TR5*, launched July 1, 2026, from Page Municipal Airport, Arizona).

🌐 **Live Showcase Website:** [**https://redstonestar.github.io/NASATechriseShowcase/**](https://redstonestar.github.io/NASATechriseShowcase/)

> **⚠️ Beta & AI Disclosure:** This showcase website is currently in **Beta** and will continue to change as we refine our post-flight analysis. Artificial Intelligence (AI) was heavily utilized in designing, coding, and building this website, while all flight telemetry (`WORLD_24`), onboard video, hardware imagery, and UW–Madison SEM/EDS microscopy data come directly from our physical experiment.

---

## 📖 Table of Contents

- [Mission Overview](#-mission-overview)
- [Key Features](#-key-features)
- [Interactive 3D Flight Viewer](#-interactive-3d-flight-viewer)
- [Payload Hardware Architecture](#-payload-hardware-architecture)
- [Crash Forensics & Recovery](#-crash-forensics--recovery)
- [Microscopy & Scientific Findings (SEM / EDS)](#-microscopy--scientific-findings-sem--eds)
- [Tech Stack](#-tech-stack)
- [Local Preview & Development](#-local-preview--development)
- [Deployment](#-deployment)
- [Acknowledgments](#-acknowledgments)

---

## 🛰 Mission Overview

| Parameter | Flight Specification |
| :--- | :--- |
| **Mission Program** | NASA Flight Opportunities & Future Engineers TechRise Student Challenge |
| **Flight ID / Platform** | World 24 (TR5) · World View Stratollite `N141WV` |
| **Launch Site** | Page Municipal Airport (KPGA), Page, AZ (`36.9267°N, 111.4480°W`) |
| **Launch Date & Time** | July 1, 2026 · `06:49:20 AM MST` (`13:49:20 UTC`) |
| **Apogee (Peak Altitude)** | **84,185 ft MSL (25,659.7 m)** at `10:37:13 AM MST` |
| **Flight Duration** | 5 hr 19 min 32 sec (Session 28) + descent tracking |
| **Termination & Landing** | `12:08:52 PM MST` over the Arizona Strip (`36.9396°N, 112.4870°W`) |
| **Experiment Objective** | Multi-layer stratospheric particulate capture using a custom rotary filter carousel |

---

## ✨ Key Features

- **Real Telemetry 3D Replay:** Reconstructs all 16,461 seconds of 1-Hz flight telemetry from `WORLD_24.txt` across Lake Powell, Glen Canyon Dam, Vermilion Cliffs, and Kaibab Plateau.
- **Glowing Blue Flight Trail:** Continuous spline-interpolated flight ribbon displaying the traveled path in glowing cyan-blue and the upcoming trajectory in faint dashed blue.
- **Synchronized Onboard Video:** Draggable, resizable Picture-in-Picture window streaming the recovered 1080p payload camera footage in real-time lockstep with the 3D simulation.
- **Dynamic Solar Lighting:** Accurate sun position and atmospheric scattering calibrated to the exact solar coordinates of Northern Arizona on the morning of July 1, 2026.
- **Interactive 5-Capsule Rotary Sampler HUD:** Real-time visualization of the servo shutter disk and vacuum pump cycles corresponding to flight altitude bands.
- **Forensic Crash Analysis:** Reconstructed high-velocity descent data (Session 29 reboot showing descent rates up to 124 mph / 55.3 m/s) and photographic teardown documentation.
- **SEM / EDS Explorer:** High-resolution electron micrographs (up to 34.97 KX) and multi-element X-ray spectroscopy maps of the surviving 0.1 µm polycarbonate control filter from the UW–Madison Materials Science Center.

---

## 🌍 Interactive 3D Flight Viewer

The 3D viewer is built on **CesiumJS 1.122** with keyless high-resolution satellite imagery (Esri World Imagery) and a custom terrarium-based elevation model for realistic canyon terrain.

### Camera Modes
- **Orbit Overview (Default):** Free-orbit vantage point centered on the balloon's active position with mouse drag/wheel controls.
- **Chase Balloon:** First-person follow camera locked behind `N141WV`, tracking altitude and velocity changes.
- **Payload Horizon:** Low-angle perspective looking toward the Earth's limb and thin stratospheric atmosphere.
- **Pad Ground View:** Static observer positioned on Runway 15 at Page Municipal Airport looking up at liftoff.

---

## ⚙️ Payload Hardware Architecture

The experiment was engineered to fit within NASA TechRise size, weight, and power constraints (4.0" × 4.0" × 8.0", < 1.0 kg):

```text
┌─────────────────────────────────────────────────────────────┐
│              NASA Payload Interface Board (PIB)             │
│            Power Delivery & UART Telemetry Downlink          │
└──────────────┬────────────────────────────────┬─────────────┘
               │                                │
┌──────────────▼──────────────┐   ┌─────────────▼─────────────┐
│  Adafruit Metro M4 Express  │   │ 1080p Onboard Flight Cam  │
│  (SAMD51 Cortex-M4F @120MHz)│   │ 128 GB SanDisk MicroSD    │
└──────┬───────────────┬──────┘   └───────────────────────────┘
       │               │
┌──────▼──────┐ ┌──────▼──────────────────────────────────────┐
│ Dual Driver │ │ STEMMA QT Sensor Chain & SPI MicroSD Logger │
│   H-Bridges │ │ • Sensirion SPS30 Optical Particulate       │
└──────┬──────┘ │ • Bosch BME688 (Temp / Press / Humidity)    │
       │        │ • Sensirion SGP30 (Air Quality / TVOC)      │
       │        │ • ScioSense ENS160 Multi-Gas Sensor         │
       │        │ • AMS AS7331 Solar UVA / UVB / UVC          │
       │        └─────────────────────────────────────────────┘
┌──────▼──────────────────────────────────────────────┐
│ Actuation & Pneumatic Manifold                      │
│ • MG90S Precision Rotary Shutter Disk               │
│ • 4.5 V High-Torque Diaphragm Vacuum Air Pump       │
│ • 5 Active Altitude Capsules + 1 Control Filter     │
└─────────────────────────────────────────────────────┘
```

### Altitude Sampling Profile
1. **Capsule 1 (14,000 – 28,000 ft):** Troposphere boundary layer
2. **Capsule 2 (28,000 – 42,000 ft):** Upper troposphere & commercial jet cruise altitudes
3. **Capsule 3 (42,000 – 56,000 ft):** Tropopause cold trap (minimum recorded temperature of `-63.5 °C / -82.3 °F` at 50,829 ft)
4. **Capsule 4 (56,000 – 70,000 ft):** Lower stratosphere & ozone transition
5. **Capsule 5 (82,000+ ft Float):** Stratospheric float (3.5 hours at ~22.2 hPa)
6. **Capsule C (Shielded Control):** Enclosed reference baseline with zero active airflow

---

## 💥 Crash Forensics & Recovery

Following flight termination at `12:08:52 PM MST`, the payload experienced severe parachute separation/tumbling resulting in high-G ground impact.
- **Recovered Intact:** Microcontroller SD card log, 128 GB camera card (wrapped in Kapton tape), and the internal **Control Filter Capsule**.
- **Impact Telemetry:** Microcontroller auto-rebooted twice mid-fall; Session 29 recorded a freefall terminal descent velocity of **124 mph (55.3 m/s)** before final power cutoff.
- **Teardown Findings:** Aluminum chassis crushed and sheared; active filter housing shattered; control filter sealed inside the interior manifold survived intact without breach.

---

## 🔬 Microscopy & Scientific Findings (SEM / EDS)

Post-flight analysis was performed at the **University of Wisconsin–Madison Materials Science Center**:
- **Field Emission SEM:** Visual inspection of 0.1 µm track-etched polycarbonate membrane up to **34,970× magnification** at 10.0 kV.
- **Energy Dispersive X-ray Spectroscopy (EDS):** Multi-channel elemental mapping identifying:
  - Background matrix: **Carbon (C)** and **Oxygen (O)** (polycarbonate filter structure).
  - High-mass particulate signatures: **Zirconium (Zr)**, **Cerium (Ce)**, **Iron (Fe)**, **Nickel (Ni)**, and **Chromium (Cr)**.

---

## 💻 Tech Stack

- **3D Graphics & Globe:** [CesiumJS 1.122](https://cesium.com/platform/cesiumjs/) (WebGL)
- **Data Visualizations:** [Chart.js 4.4.4](https://www.chartjs.org/)
- **Mapping:** [Leaflet 1.9.4](https://leafletjs.com/) with USGS Topo tiles
- **Terrain Provider:** Custom AWS Terrarium DEM tiles (`elevation-tiles-prod`)
- **Imagery:** Esri World Imagery (High-Resolution Satellite)
- **Video Integration:** YouTube IFrame Player API with sub-second clock synchronization
- **Architecture:** Zero-dependency static web application (HTML5, CSS3, Vanilla ES6+)

---

## 🛠 Local Preview & Development

To run the project locally on your machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/RedstoneStar/NASATechriseShowcase.git
   cd NASATechriseShowcase
   ```

2. Start a local HTTP server:
   ```bash
   # Windows batch shortcut:
   launch_local_preview.bat

   # Or using Python:
   python -m http.server 8080
   ```

3. Open your browser to `http://localhost:8080`.

*(Running via a local HTTP server ensures the YouTube IFrame API functions without browser `file://` security policy blocks.)*

---

## 🚀 Deployment

The site is hosted automatically on **GitHub Pages**:
- Branch: `main`
- Directory: `/ (root)`
- Automatic HTTPS via Let's Encrypt

---

## 👥 Acknowledgments

- **NASA Flight Opportunities Program** & **Future Engineers** for sponsoring the TechRise Student Challenge and providing payload integration.
- **World View Enterprises** for balloon launch operations from Page, AZ on tail number `N141WV`.
- **University of Wisconsin–Madison Materials Science Center** for Scanning Electron Microscopy (SEM) and Energy Dispersive X-ray Spectroscopy (EDS) instrumentation access.
- **Oconomowoc High School** student engineering team and faculty advisor.
