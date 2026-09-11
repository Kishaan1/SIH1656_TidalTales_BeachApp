# 🏖️ Tidal Tales — Coastal Recreation & Beach Safety Engine
> **Smart India Hackathon (SIH 2024) — Problem Statement SIH1656**  
> *Real-time recreational suitability, INCOIS oceanographic telemetry, live turn-by-turn navigation, grounded Gemini AI coastal intelligence, and universal search wrapped in a nostalgic 16mm warm vintage aesthetic.*

[![Live Web Application](https://img.shields.io/badge/Live_Deployment-Render-2ea44f?style=for-the-badge&logo=render)](https://sih1656-tidaltales-beachapp-1.onrender.com)
[![Status](https://img.shields.io/badge/Status-Live_%2F_Active-brightgreen?style=for-the-badge)](https://sih1656-tidaltales-beachapp-1.onrender.com)

🌐 **Live Web Application**: [https://sih1656-tidaltales-beachapp-1.onrender.com](https://sih1656-tidaltales-beachapp-1.onrender.com)

---

### 💻 Languages & Technologies Used

#### Core Languages
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Dart](https://img.shields.io/badge/Dart-0175C2?style=for-the-badge&logo=dart&logoColor=white)

#### Frameworks, Libraries & Services
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)
![Globe.gl](https://img.shields.io/badge/Globe.gl-2B4C56?style=for-the-badge&logo=globe&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Render](https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=white)

---

## 🧭 Table of Contents
1. [Live Production Deployment](#-live-production-deployment)
2. [Languages & Technologies Used](#-languages--technologies-used)
3. [Project Overview & Problem Statement](#-project-overview--problem-statement)
4. [Monorepo Architecture](#-monorepo-architecture)
5. [Key Features & Capabilities](#-key-features--capabilities)
6. [3D Google Earth-Style Globe Engine](#-3d-google-earth-style-globe-engine)
7. [Oceanographic Suitability Scoring Algorithm](#-oceanographic-suitability-scoring-algorithm)
8. [Quickstart & Local Setup](#-quickstart--local-setup)
   - [Web Application (Vite + Vanilla JS + Leaflet + Globe.gl)](#1-web-application-web_app)
   - [Mobile Application (Flutter + Riverpod)](#2-mobile-application-sih_beach_app)
   - [Python Algorithm Prototype](#3-python-scoring-prototype)
9. [Evaluator & Test Guide (Secret Backdoors)](#-evaluator--test-guide-secret-backdoors)
10. [Assets, Fonts & Custom Map Styling](#-assets-fonts--custom-map-styling)
11. [Settings, Localization & Disclosures](#-settings-localization--disclosures)
12. [INCOIS Data Integration & Disclaimer](#-incois-data-integration--disclaimer)

---

## 🚀 Live Production Deployment

The web application is deployed live on **Render**:

- 🌐 **Primary Live URL**: [https://sih1656-tidaltales-beachapp-1.onrender.com](https://sih1656-tidaltales-beachapp-1.onrender.com)
- 🔑 **Evaluator Passcode**: Use `1234` (or `2026`) on the passcode screen to unlock the full cockpit dashboard.
- 📱 **Mobile Frame Preview**: Toggle between full responsive widescreen and mobile device frame mode via the top bar control.

---

## 🌊 Project Overview & Problem Statement

**Problem Statement SIH1656**: Millions of domestic and international travelers visit India's vast 7,500+ km coastline each year. However, dynamic marine hazards—such as unpredictable rip currents, sudden monsoon swells, high wave surges, and localized water quality degradation—pose severe risks to swimmers, families, and watersport enthusiasts. Currently, tourists lack accessible, centralized, and recreational-friendly ocean safety guidance.

**The Solution — Tidal Tales**:
Tidal Tales bridges the gap between raw scientific marine forecasts issued by the **Indian National Centre for Ocean Information Services (INCOIS)** and everyday beachgoers. It computes a normalized **Recreational Suitability Index (0–100)** for coastal zones across India, categorizes them into clear safety verdicts (**Safe to Swim**, **Swim with Caution**, or **Hazardous / Prohibited**), and integrates live turn-by-turn navigation, grounded Gemini AI safety advisories, and multi-lingual localization into a sun-bleached, nostalgic coastal interface.

---

## 🏛️ Monorepo Architecture

The repository contains two coordinated client implementations alongside pure mathematical scoring models:

```
SIH1656_TidalTales_BeachApp/
├── README.md                          # Single Master Project Documentation
│
├── web_app/                           # 🌐 Production Modern Web Application
│   ├── index.html                     # Semantic HTML5 shell, auth cards & HUD containers
│   ├── package.json                   # Web dependencies (Vite, Leaflet)
│   ├── src/
│   │   ├── main.js                    # Core controller, event wiring & auth guards
│   │   ├── style.css                  # 16mm vintage design system, HUD & modal styles
│   │   ├── beaches.js                 # Coastal database (coordinates, readings, metadata)
│   │   ├── suitability.js             # Client-side INCOIS scoring engine & verdict badges
│   │   ├── navigation.js              # Google Maps-style turn-by-turn routing engine
│   │   ├── search.js                  # Typo-tolerant Levenshtein omnibox search & history
│   │   ├── gemini.js                  # Grounded Google Gemini 2.5/3-Flash coastal advisor
│   │   ├── geminiService.js           # AI service re-export interface
│   │   └── settings.js                # Multi-lingual dictionary, storage & user preferences
│   └── test/                          # Unit and integration test suites
│
└── sih_beach_app/                     # 📱 Cross-Platform Mobile Application (Flutter)
    ├── pubspec.yaml                   # Flutter dependencies (Riverpod, Geolocator, Google Maps)
    ├── assets/
    │   ├── fonts/                     # Retro display fonts (Pacifico, Recoleta)
    │   ├── images/                    # Local bundled beach photography & icons
    │   └── map_style/
    │       ├── vintage_map_style.json # Google Maps raw JSON sepia/parchment style
    │       └── mapbox_vintage_notes.md# Mapbox Studio vector styling instructions
    ├── lib/
    │   ├── main.dart                  # Flutter entry point & theme initialization
    │   ├── core/                      # Global theme tokens, constants & Haversine utils
    │   └── features/
    │       ├── home/                  # Polaroid carousel, suitability cards & providers
    │       └── map/                   # Vector vintage map views & buoy markers
    └── scripts/
        └── suitability_algorithm.py   # Pure Python oceanographic scoring prototype
```

---

## ⚡ Key Features & Capabilities

### 1. 🏖️ Real-Time Oceanographic Safety Scoring
- Computes multi-parameter suitability from INCOIS telemetry: **Significant Wave Height ($H_s$)**, **Wind Speed ($V_w$)**, **Swell Period ($T_p$)**, and **Water Quality Index (WQI)**.
- Tri-color verdict classification:
  - 🟢 **SAFE TO SWIM** (Score $\ge 75$): Ideal conditions for families, swimming, and wading.
  - 🟠 **SWIM WITH CAUTION** (Score $50–74$): Moderate waves or currents; shallow wading only.
  - 🔴 **HAZARDOUS // NO SWIM** (Score $< 50$ or active alert): Rough breakers or INCOIS high wave/tsunami alert in effect.

### 2. 🧭 Turn-by-Turn Navigation Engine (Google Maps Style)
- **Multi-Modal Transit Routing**: Driving ($48\text{ km/h}$), Two-Wheeler ($36\text{ km/h}$), Cycling ($16\text{ km/h}$), and Walking ($4.8\text{ km/h}$).
- **Multi-Criteria Route Selection**: Compare **Fastest** (highway corridors), **Shortest** (urban grid), and **Scenic** (coastal boulevards) paths.
- **Ultra-Slim Telemetry Dock**: Collapses under 75px during active navigation, displaying live ETA, remaining distance, suitability verdict, and pull-handle chevron to expand route options.
- **Live GPS & Voice Guidance**: Web Speech API announces turn maneuvers and 500m / 100m milestones. Tracks real device GPS with dynamic off-route recalculation if deviation exceeds $30\text{m}$. Includes optional manual demo simulation.
- **Traffic Overlays & Incident Hazards**: Real-time traffic congestion colors (teal, ochre, brick) and interactive incident pins (road resurfacing, speed cameras, coastal surge alerts).

### 3. 🔍 Universal Coastal Omnibox Search & Autocomplete
- **Fuzzy Typo-Tolerant Matching**: Powered by Levenshtein distance algorithm (e.g. typing `"kavalam"` matches *Kovalam Beach*; `"calangut"` matches *Calangute Beach*).
- **Multi-Field Querying**: Searches across Beach Name, City/District, State, and description keywords with bolded match range highlights.
- **Voice Search (`🎙️`)**: Web Speech API speech recognition for hands-free coastal exploration.
- **Filter Chips**: Instant filtering by *All Coastlines*, *Safe to Swim*, *Popular Spots*, *Near Me (<50 km)*, and *Surfing / Sports*.
- **Offline History Caching**: Persists recent searches in `localStorage` with quick-clear utilities.

### 4. 🤖 Grounded Gemini AI Coastal Safety Assistant
- Integrates Google Gemini (`gemini-2.5-flash`, `gemini-3-flash`) grounded directly with **live INCOIS ocean telemetry**.
- Injects active emergency banners, wave heights, and swell periods into the system prompt to eliminate context hallucinations.
- Pre-set prompt chips for quick safety queries: *"Can kids swim safely?"*, *"Explain rip current risks"*, and *"Best safe activities today"*.
- Auto-expanding, scrollable response card preventing text clipping on mobile displays.

### 5. ⚙️ Adaptive Settings & Localization Panel
- **Responsive Layout**: Slides up as a draggable bottom sheet on mobile, centered modal on tablet, and flyout drawer on desktop.
- **Multi-Lingual Localization**: Real-time translation for **English (`en`)**, **Tamil (`ta`)**, **Hindi (`hi`)**, and **Malayalam (`ml`)**.
- **System Storage & Offline Tools**: One-click tile cache purging with reclaimed megabyte calculation, Data Saver Mode toggle, and safety threshold selectors.

### 6. 🔒 Standalone PIN Passcode Gate & Boot Guard
- Strict boot barrier prevents dashboard exposure until an authenticated session is confirmed.
- Clean 2-step verification: Coastal Handle input followed by a 4-digit PIN matrix (`#pin-0` to `#pin-3`) with auto-advance, backspace navigation, and paste support.
- Synchronized session states across `tidal_session` and `tidal_user_session` in `localStorage`.

---

## 🌍 3D Google Earth-Style Globe Engine

The application features a photorealistic 3D interactive globe powered by **Globe.gl** and **Three.js**:

- **Photorealistic Imagery & Lighting**: NASA Blue Marble 8K daytime imagery paired with high-resolution topographical relief bump mapping (`earth-topology.png`), atmospheric blue glow (`#6db3f2`), and Three.js directional sunlight for realistic specular ocean reflections.
- **Continuous LOD Zoom Navigation**:
  - **Orbital View (`Altitude > 1.5`)**: Continents and ocean labels.
  - **Country View (`Altitude 0.6 – 1.5`)**: National boundaries and capital names in English.
  - **Regional View (`Altitude 0.2 – 0.6`)**: State/province borders, coastal cities, and regional landmarks.
  - **Local Shoreline View (`Altitude < 0.2`)**: Seamlessly cross-fades into high-resolution 2D satellite/street tiles with district lines, roads, and beach access points.
- **Backface Horizon Occlusion**: Strict surface normal calculation (`isPointOnVisibleFrontHemisphere`) and complete DOM element hiding (`display: 'none'`) to prevent far-side marker stacking along the Earth's curvature.
- **Unified Card Interactivity**: Clicking any beach card in the left sidebar triggers a smooth 1800ms camera flight to `altitude: 0.45` and opens the INCOIS telemetry & AI briefing sheet.

---

## 🧮 Oceanographic Suitability Scoring Algorithm

The suitability algorithm transforms raw marine telemetry into an intuitive index:

$$\text{Suitability Score} = 100 - (P_{\text{wave}} + P_{\text{wind}} + P_{\text{swell}} + P_{\text{wqi}})$$

### Penalty Breakdown:
1. **Significant Wave Height ($H_s$)**:
   - $H_s \le 0.8\text{ m}$: $0\text{ pts}$ penalty (Calm)
   - $0.8\text{ m} < H_s \le 1.5\text{ m}$: Linear scaling from $0$ to $25\text{ pts}$
   - $1.5\text{ m} < H_s \le 2.5\text{ m}$: Linear scaling from $25$ to $55\text{ pts}$
   - $H_s > 2.5\text{ m}$: $60\text{ pts}$ penalty (Rough / Dangerous)
2. **Wind Speed ($V_w$)**:
   - $V_w \le 10\text{ kts}$: $0\text{ pts}$ penalty
   - $10\text{ kts} < V_w \le 20\text{ kts}$: Linear scaling up to $20\text{ pts}$
   - $V_w > 20\text{ kts}$: $25\text{ pts}$ penalty
3. **Swell Period ($T_p$)**:
   - Short/choppy waves ($T_p < 6\text{ s}$) or long energetic groundswells ($T_p > 14\text{ s}$) incur up to $15\text{ pts}$ penalty.
4. **Water Quality Index (WQI)**:
   - Evaluates bacterial and turbidity levels ($100 - \text{WQI}$) scaled to a max $20\text{ pts}$ penalty.
5. **Critical Hazard Overrides**:
   - Any active INCOIS **High Wave Alert**, **Tsunami Warning**, or **Storm Surge Advisory** automatically forces the score to $<25$ and marks the beach as **HAZARDOUS // NO SWIM**.

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.19+ for mobile client)
- [Python](https://www.python.org/) (v3.9+ for algorithmic testing)

---

### 1. Web Application (`web_app/`)

```bash
# Navigate to web application directory
cd web_app

# Install dependencies (Vite, Leaflet)
npm install

# Start development server
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```
The application will launch on `http://localhost:5173`.

---

### 2. Mobile Application (`sih_beach_app/`)

```bash
# Navigate to Flutter client directory
cd sih_beach_app

# Fetch dependencies
flutter pub get

# Launch on connected Android/iOS device or emulator
flutter run
```

#### API Keys & Setup:
- **Google Maps**: Add your Google Maps API key to:
  - Android: `android/app/src/main/AndroidManifest.xml` (`com.google.android.geo.API_KEY`)
  - iOS: `ios/Runner/AppDelegate.swift` (`GMSServices.provideAPIKey("YOUR_KEY")`)
- **Offline Mock Fallback**: The service layer includes built-in mock telemetry so the application is fully functional for offline evaluation without an active INCOIS network connection.

---

### 3. Python Scoring Prototype

```bash
# Run standalone suitability algorithm test
python sih_beach_app/scripts/suitability_algorithm.py
```

---

## 🕵️ Evaluator & Test Guide (Secret Backdoors)

For hackathon judges and evaluation panels, the visible *"Quick-Fill Owner"* button is omitted from the public login screen to preserve production realism. You can trigger evaluator access using either of two built-in methods:

### Method 1: Secret Triple-Tap Header Gesture
1. On the authentication screen, locate the **"Tidal Tales"** title or the **🐚 shell emblem**.
2. **Click or tap 3 times consecutively within 1.5 seconds**.
3. The app automatically fills `owner@tidaltales.in`, advances to Step 2, and populates PIN `2026`.
4. Click **"Step Ashore & Unlock Shoreline"** to enter.

### Method 2: Developer URL Query Parameter
Append `?mode=owner` or `?dev=true` to the application URL:
```
http://localhost:5173/?mode=owner
```
This dynamically reveals the **🔑 Quick-Fill Owner / Test Account** button in the DOM.

### Demo Accounts & Credentials

| Role | Handle / Email | PIN / Password | Capabilities Unlocked |
| :--- | :--- | :--- | :--- |
| **Owner / Judge** | `owner@tidaltales.in` | `2026` | Full simulation sandbox sliders (up to 6.0m waves, 65 kts winds), `[OWNER TEST PASS]` badge, instant bypass. |
| **Verified Explorer** | Any email (e.g. `user@example.com`) | Any 4 digits | Standard verified user session, telemetry access, favorites. |
| **Guest Explorer** | Click *"Enter as Guest / Demo Pass →"* | None | One-click instant preview mode without login. |

---

## 🎨 Assets, Fonts & Custom Map Styling

### Display Fonts
- **Default CDN**: The app loads Google Fonts (*Pacifico*, *Space Mono*, *Inter*) at runtime.
- **Offline Bundling (Optional)**: To bundle fonts locally for venues without reliable internet:
  1. Download `Pacifico-Regular.ttf` from [Google Fonts Pacifico](https://fonts.google.com/specimen/Pacifico).
  2. Drop the `.ttf` file into `sih_beach_app/assets/fonts/`.
  3. Ensure it is declared under the `fonts` section in `pubspec.yaml`.

### Image Assets
- Remote photos are loaded from high-resolution Unsplash beach collections.
- For fully offline builds, place local hero photos into `sih_beach_app/assets/images/`.

### Vintage Map Styling (Parchment & Sepia)
- **Google Maps**: Uses `sih_beach_app/assets/map_style/vintage_map_style.json` applied via `.setMapStyle()` in Flutter or styled Leaflet tile filters in Web.
- **Mapbox Studio Vector Styling**:
  1. Open [Mapbox Studio](https://studio.mapbox.com) and create a style using the **Monochrome (Light)** template.
  2. Recolor the core layer groups:
     - **Water**: `#A9CFC8` (seafoam fill), `#3F8C88` (teal labels)
     - **Land**: `#E7D2B4` (sand deep)
     - **Roads**: `#F5EAD3` fill, `#D9C29B` casing
     - **Highways**: `#E8935B` (faded sunset ochre)
     - **Parks**: `#B7CDB0` (soft coastal sage)
     - **Labels**: `#8A7156` with `#FAF1E4` halo
  3. Reduce global saturation by ~30% and copy your custom style URL into `MapWidget(styleUri: "...")`.

---

## 🌐 Settings, Localization & Disclosures

- **Multi-Lingual Engine**: Supports English, Tamil, Hindi, and Malayalam. Switching languages instantly re-renders navigation labels, suitability verdicts, and search placeholders.
- **Audible Sirens & Safety Overrides**: Evaluators can toggle audible hazard alarms and customize suitability thresholds from the settings modal (`⚙️` icon).
- **Storage Management**: Calculates real-time `localStorage` usage and provides a one-click tile cache flush tool.

---

## 🏛️ INCOIS Data Integration & Disclaimer

- **Data Attribution**: Ocean state forecasts, wave predictions, and swell alerts are modeled after official data structures from the **Indian National Centre for Ocean Information Services (INCOIS)**, Ministry of Earth Sciences, Government of India.
- **Safety Disclaimer**: *Tidal Tales* is developed for recreational planning and educational evaluation under Smart India Hackathon. Always heed on-ground coastal safety guards, physical beach warning flags, and official INCOIS marine bulletins before entering the water.

---

<div align="center">
  <sub>Built with 🌊 for the <b>Smart India Hackathon (SIH 2024)</b> · Problem Statement SIH1656</sub>
</div>
