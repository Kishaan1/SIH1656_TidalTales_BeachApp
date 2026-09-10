/**
 * 3D Interactive Rotating Globe for Tidal Tales (SIH1656)
 * - Standard Natural Earth 110m smooth coastlines (#F5EBE0 land, #2B4C56 deep ocean)
 * - Soft atmosphere glow (#FAF1E4, altitude 0.15)
 * - Sleek surface beacon markers & glowing ripple rings (no bulky barrels)
 * - Distance-based label collision avoidance & culling (prevents Varkala/Kovalam overlap)
 * - 0.7rem billboarded HTML labels offset cleanly above pin anchors (no 3D curvature skew)
 * - Smooth spherical interpolation camera fly-to (altitude: 1.2, 1500ms)
 */

import Globe from 'globe.gl';
import * as THREE from 'three';
import countriesGeoJson from './assets/ne_110m_countries.json';
import {
  stateBorderPaths,
  districtBorderPaths,
  administrativeLabels,
} from './adminBoundaries.js';

let globeInstance = null;
let activeSelectedBeach = null;
let autoRotateTimeout = null;
let currentBeachesList = [];
let onSelectBeachCallback = null;
let onExtremeZoomCallback = null;
let lastZoomTransitionTime = 0;

/**
 * Filter beaches to prevent label collision and overlap on clustered locations.
 * The currently active/selected beach is always given top priority.
 */
let admin1Data = null;

async function loadStateBoundaries() {
  if (!admin1Data) {
    try {
      const res = await fetch('/data/ne_50m_admin_1_states_provinces_lines.json');
      if (res.ok) {
        admin1Data = await res.json();
      }
    } catch (e) {
      console.warn('Could not load Admin-1 boundaries, using fallback paths:', e);
    }
  }
  return admin1Data;
}

/**
 * Spherical horizon visibility check to cull far-side markers behind Earth curvature
 */
export function isPointOnVisibleFrontHemisphere(lat, lng, povLat, povLng) {
  if (povLat === undefined || povLng === undefined || povLat === null || povLng === null) return true;
  const rad = Math.PI / 180;
  const phi1 = lat * rad;
  const lambda1 = lng * rad;
  const phi2 = povLat * rad;
  const lambda2 = povLng * rad;

  const dot = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(lambda1 - lambda2);
  return dot > 0.05; // 0.05 cutoff (~87 deg) filters out points past the horizon curvature
}

export function filterNonCollidingBeaches(beachesList, activeBeachId, minDistanceDeg = 0.35) {
  if (!beachesList || beachesList.length === 0) return [];
  const visible = [];

  // 1. Always prioritize the currently selected beach
  const active = beachesList.find(b => b.id === activeBeachId);
  if (active) {
    visible.push(active);
  }

  // 2. Iterate through other beaches and cull if too close to an already placed label
  for (const b of beachesList) {
    if (b.id === activeBeachId) continue;

    const bLat = b.latitude ?? b.lat;
    const bLng = b.longitude ?? b.lng;

    const collides = visible.some(v => {
      const vLat = v.latitude ?? v.lat;
      const vLng = v.longitude ?? v.lng;
      const dLat = bLat - vLat;
      const dLng = (bLng - vLng) * Math.cos((bLat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      return dist < minDistanceDeg;
    });

    if (!collides) {
      visible.push(b);
    }
  }

  return visible;
}

/**
 * Procedurally generate deep ocean canvas texture in warm vintage teal (#2B4C56)
 * with fine gold nautical graticules and subtle paper texture
 */
function createOceanTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Warm Deep Ocean Teal Shading
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#1F3840');    // Polar deep teal
  oceanGrad.addColorStop(0.25, '#26444E'); // Temperate ocean
  oceanGrad.addColorStop(0.5, '#2B4C56');  // Equatorial warm ocean teal
  oceanGrad.addColorStop(0.75, '#26444E');
  oceanGrad.addColorStop(1, '#1F3840');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial vignette
  const radial = ctx.createRadialGradient(width * 0.5, height * 0.5, 80, width * 0.5, height * 0.5, width * 0.7);
  radial.addColorStop(0, 'rgba(245, 235, 224, 0.05)');
  radial.addColorStop(1, 'rgba(10, 20, 25, 0.38)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  // 2. Fine Nautical Graticules (Latitude & Longitude)
  ctx.strokeStyle = 'rgba(245, 235, 224, 0.10)';
  ctx.lineWidth = 1;

  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Equator & Prime Meridian
  ctx.strokeStyle = 'rgba(232, 147, 91, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.5);
  ctx.lineTo(width, height * 0.5);
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(width * 0.5, height);
  ctx.stroke();

  // 3. Subtle vintage paper grain
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Color mapping by suitability verdict
 */
function getSuitabilityColor(beach) {
  const wave = beach?.reading?.waveHeightM ?? 1.0;
  const isAlert = beach?.reading?.highWaveAlert || beach?.reading?.tsunamiAlert || beach?.reading?.stormSurgeAlert;
  if (isAlert || wave > 2.0) return '#C4574B'; // Coral / Red Hazard
  if (wave >= 1.2) return '#E8935B';          // Sunset Ochre Caution
  return '#2E7D72';                            // Emerald / Teal Safe
}

/**
 * Initialize 3D Globe with 110m Natural Earth polygons, sleek markers, and non-colliding labels
 */
export function initGlobe(container, beaches, onSelectBeach, onExtremeZoom = null) {
  if (!container) return null;

  try {
    currentBeachesList = beaches || [];
    onSelectBeachCallback = onSelectBeach;
    onExtremeZoomCallback = onExtremeZoom;

    // Cleanup prior instance
    if (globeInstance) {
      try {
        const controls = globeInstance.controls();
        if (controls) controls.dispose();
      } catch (e) {}
      container.innerHTML = '';
    }

    const oceanTextureUrl = createOceanTexture();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 500;

    // Initialize Globe.gl
    globeInstance = Globe()(container)
      .width(width)
      .height(height)
      .globeImageUrl(oceanTextureUrl)
      .bumpImageUrl(null)
      .backgroundImageUrl(null)
      .showAtmosphere(true)
      .atmosphereColor('#FAF1E4')
      .atmosphereAltitude(0.15)
      .showGraticules(false);

    // Expose globally for unified mapping interactions
    if (typeof window !== 'undefined') {
      window.myGlobe = globeInstance;
    }

    // 1. Natural Earth 110m Coastlines & Landmasses (Isolate GeoJSON errors)
    try {
      if (countriesGeoJson && countriesGeoJson.features) {
        globeInstance
          .polygonsData(countriesGeoJson.features)
          .polygonCapColor(() => '#F5EBE0') // Parchment cream land
          .polygonSideColor(() => '#E0D5C1')
          .polygonStrokeColor(() => '#A89F91') // Thin solid terracotta/slate country border line
          .polygonAltitude(0.005)
          .polygonCapCurvatureResolution(2);
      }
    } catch (geoErr) {
      console.warn('GeoJSON boundary load or parse failed, proceeding without polygons:', geoErr);
    }

    // Attempt loading fine Admin-1 boundary lines
    loadStateBoundaries().then(() => {
      updateGlobeBorders({ showStates: true, showDistrictsAndCities: false });
    });

    // 2. High-Visibility Tactile Surface Beacon Pins
    globeInstance
      .pointsData(currentBeachesList)
      .pointLat(d => d.latitude ?? d.lat)
      .pointLng(d => d.longitude ?? d.lng)
      .pointColor(d => getSuitabilityColor(d))
      .pointAltitude(0.020)     // Prominent altitude off globe surface
      .pointRadius(d => (d.id === (activeSelectedBeach?.id || currentBeachesList[0]?.id) ? 0.95 : 0.65))
      .pointResolution(32)
      .pointLabel(d => `
        <div class="globe-marker-tooltip">
          <div class="tooltip-header">
            <span class="tooltip-title">${d.name}</span>
            <span class="tooltip-flag">${d.country === 'India' ? '🇮🇳' : (d.country === 'Indonesia' ? '🇮🇩' : (d.country === 'Australia' ? '🇦🇺' : (d.country === 'France' ? '🇫🇷' : (d.country === 'United States' ? '🇺🇸' : '🏖️'))))}</span>
          </div>
          <div class="tooltip-location">${d.state ? d.state + ', ' : ''}${d.country || 'India'}</div>
          <div class="tooltip-metrics">
            <span>🌊 ${d.reading?.waveHeightM ?? 0.9}m</span>
            <span>💨 ${d.reading?.windSpeedKmph ?? 18} km/h</span>
            <span>⏱️ ${d.reading?.swellPeriodSec ?? 7}s</span>
          </div>
          <div class="tooltip-badge-source ${d.source === 'INCOIS Certified' ? 'incois' : 'global'}">
            ${d.source === 'INCOIS Certified' ? '🏛️ INCOIS Certified' : '🌐 Global Oceanic Grid'}
          </div>
        </div>
      `)
      .onPointClick(beach => {
        if (!beach) return;
        const lat = beach.latitude ?? beach.lat;
        const lng = beach.longitude ?? beach.lng;
        globeInstance.pointOfView({ lat, lng, altitude: 1.1 }, 1000);
        flyToBeach(beach, 1.1, 1000);
        if (typeof window.openBeachDetailSheet === 'function') {
          window.openBeachDetailSheet(beach);
        } else if (onSelectBeachCallback && beach.id) {
          onSelectBeachCallback(beach.id);
        }
      });

    // 3. Glowing 3D Beacon Rings
    const initialActive = currentBeachesList.slice(0, 1);
    globeInstance
      .ringsData(initialActive)
      .ringLat(d => d.latitude ?? d.lat)
      .ringLng(d => d.longitude ?? d.lng)
      .ringAltitude(0.015)
      .ringColor(() => '#FAF1E4')
      .ringMaxRadius(3.5)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(900);

    // 4. Hierarchical Administrative Boundaries Line Paths
    globeInstance
      .pathsData([])
      .pathPoints(d => d.coords)
      .pathPointLat(p => p[0])
      .pathPointLng(p => p[1])
      .pathColor(d => d.color || 'rgba(168, 159, 145, 0.65)')
      .pathStroke(d => d.stroke || 0.7)
      .pathAltitude(0.007)
      .pathDashLength(d => d.dashLength ?? 0.015)
      .pathDashGap(d => d.dashGap ?? 0.01);

    // 5. Progressive Administrative Place Names
    globeInstance
      .labelsData([])
      .labelLat(d => d.lat)
      .labelLng(d => d.lng)
      .labelText(d => d.name)
      .labelSize(d => (d.type === 'state' ? 1.0 : (d.type === 'city' ? 0.85 : 0.75)))
      .labelDotRadius(d => (d.type === 'city' || d.type === 'district' ? 0.25 : 0))
      .labelColor(() => 'rgba(43, 76, 86, 0.80)')
      .labelAltitude(0.010)
      .labelResolution(2);

    // 6. Billboarded Non-Colliding HTML Labels
    updateHtmlLabels(currentBeachesList, currentBeachesList[0]?.id);

    // 7. Dynamic Zoom & Camera Rotation Listener
    globeInstance.onZoom(({ lat, lng, altitude }) => {
      const showStates = altitude < 3.2;
      const showDistrictsAndCities = altitude < 1.4;
      updateGlobeBorders({ showStates, showDistrictsAndCities });
      updateGlobeLabels(altitude);

      const pov = { lat, lng, altitude };
      updateHtmlLabels(currentBeachesList, activeSelectedBeach?.id, pov);

      if (altitude < 0.25) {
        const now = Date.now();
        if (now - lastZoomTransitionTime > 3000) {
          lastZoomTransitionTime = now;
          if (typeof onExtremeZoomCallback === 'function') {
            onExtremeZoomCallback({ lat, lng, altitude });
          } else if (typeof window !== 'undefined' && typeof window.onGlobeExtremeZoom === 'function') {
            window.onGlobeExtremeZoom({ lat, lng, altitude });
          }
        }
      }
    });

    // Initial state lines & place names visible on boot
    updateGlobeBorders({ showStates: true, showDistrictsAndCities: false });
    updateGlobeLabels(2.5);

    // 8. OrbitControls & Ambient Auto-Rotation Listener
    const controls = globeInstance.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 115;
      controls.maxDistance = 450;

      // Real-time horizon culling update on camera rotation/pan
      controls.addEventListener('change', () => {
        if (!globeInstance) return;
        const pov = typeof globeInstance.pointOfView === 'function' ? globeInstance.pointOfView() : null;
        if (pov && pov.lat !== undefined && pov.lng !== undefined) {
          updateHtmlLabels(currentBeachesList, activeSelectedBeach?.id, pov);
          updateGlobeLabels(pov.altitude);
        }
      });

      const onUserInteraction = () => {
        controls.autoRotate = false;
        clearTimeout(autoRotateTimeout);
        autoRotateTimeout = setTimeout(() => {
          controls.autoRotate = true;
        }, 3000);
      };

      container.addEventListener('mousedown', onUserInteraction);
      container.addEventListener('touchstart', onUserInteraction, { passive: true });
      container.addEventListener('wheel', onUserInteraction, { passive: true });
    }

    // Point of View centered over India
    globeInstance.pointOfView({ lat: 14.0, lng: 77.0, altitude: 1.85 }, 1200);

    const handleResize = () => {
      if (!globeInstance || !container) return;
      globeInstance.width(container.clientWidth || window.innerWidth);
      globeInstance.height(container.clientHeight || 500);
    };
    window.addEventListener('resize', handleResize);

    return globeInstance;
  } catch (fatalErr) {
    console.error('Fatal globe initialization error, falling back to 2D map:', fatalErr);
    if (typeof window !== 'undefined') {
      if (typeof window.switchTo2DMap === 'function') {
        window.switchTo2DMap();
      } else if (typeof window.setProjectionView === 'function') {
        window.setProjectionView('2d');
      }
    }
    return null;
  }
}

/**
 * Async helper to safely mount 3D Globe with fallbacks
 */
export async function initGlobeView(containerTarget = 'globe-3d-container', beaches = [], onSelect = null, onZoom = null) {
  const container = typeof containerTarget === 'string'
    ? (document.getElementById(containerTarget) || document.getElementById('globe-container'))
    : containerTarget;
  if (!container) return null;
  return initGlobe(container, beaches, onSelect, onZoom);
}

/**
 * Update administrative boundary line paths (Level 1 States & Level 2 Districts)
 */
export function updateGlobeBorders({ showStates = true, showDistrictsAndCities = false } = {}) {
  if (!globeInstance) return;

  if (admin1Data && admin1Data.features && showStates) {
    globeInstance
      .pathsData(admin1Data.features)
      .pathPoints(d => (d.geometry ? d.geometry.coordinates : d.coords))
      .pathPointLat(p => p[1])
      .pathPointLng(p => p[0])
      .pathColor(() => 'rgba(168, 159, 145, 0.55)')
      .pathStroke(0.6)
      .pathDashLength(0.015)
      .pathDashGap(0.008);
  } else {
    const activePaths = [];
    if (showStates) {
      activePaths.push(...stateBorderPaths);
    }
    if (showDistrictsAndCities) {
      activePaths.push(...districtBorderPaths);
    }

    globeInstance
      .pathsData(activePaths)
      .pathPoints(d => d.coords)
      .pathPointLat(p => p[0])
      .pathPointLng(p => p[1])
      .pathColor(d => d.color || 'rgba(168, 159, 145, 0.65)')
      .pathStroke(d => d.stroke || 0.7)
      .pathAltitude(0.007)
      .pathDashLength(d => d.dashLength ?? 0.015)
      .pathDashGap(d => d.dashGap ?? 0.01)
      .pathTransitionDuration(350);
  }
}

/**
 * Update progressive geographic place names based on current camera altitude
 */
export function updateGlobeLabels(currentAltitude = 2.5) {
  if (!globeInstance) return;

  let visible = [];
  if (currentAltitude < 0.9) {
    visible = administrativeLabels; // Show both states and districts/cities
  } else if (currentAltitude < 1.8) {
    visible = administrativeLabels.filter(p => p.type === 'state' || p.minAltitude >= 1.8);
  } else {
    visible = administrativeLabels.filter(p => p.type === 'state');
  }

  // Filter visible labels against current camera point of view
  const pov = typeof globeInstance.pointOfView === 'function' ? globeInstance.pointOfView() : null;
  if (pov && pov.lat !== undefined && pov.lng !== undefined) {
    visible = visible.filter(item => isPointOnVisibleFrontHemisphere(item.lat, item.lng, pov.lat, pov.lng));
  }

  globeInstance
    .labelsData(visible)
    .labelLat(d => d.lat)
    .labelLng(d => d.lng)
    .labelText(d => d.name)
    .labelSize(d => (d.type === 'state' ? 1.0 : (d.type === 'city' ? 0.85 : 0.75)))
    .labelDotRadius(d => (d.type === 'city' || d.type === 'district' ? 0.25 : 0))
    .labelColor(() => 'rgba(43, 76, 86, 0.80)')
    .labelAltitude(0.010)
    .labelResolution(2)
    .labelsTransitionDuration(300);
}

if (typeof window !== 'undefined') {
  window.updateGlobeBorders = updateGlobeBorders;
  window.updateGlobeLabels = updateGlobeLabels;
  window.administrativeLabels = administrativeLabels;
}

/**
 * Update HTML marker labels with horizon culling and collision culling
 */
function updateHtmlLabels(beaches, activeBeachId, pov = null) {
  if (!globeInstance) return;

  const currentPov = pov || (typeof globeInstance.pointOfView === 'function' ? globeInstance.pointOfView() : null);

  // 1. Filter out beaches that are on the far side / behind horizon curvature
  const frontBeaches = (currentPov && currentPov.lat !== undefined && currentPov.lng !== undefined)
    ? beaches.filter(b => isPointOnVisibleFrontHemisphere(b.latitude ?? b.lat, b.longitude ?? b.lng, currentPov.lat, currentPov.lng))
    : beaches;

  // 2. Prevent overlapping labels on clustered locations
  const nonColliding = filterNonCollidingBeaches(frontBeaches, activeBeachId, 0.35);

  globeInstance
    .htmlElementsData(nonColliding)
    .htmlLat(d => d.latitude ?? d.lat)
    .htmlLng(d => d.longitude ?? d.lng)
    .htmlAltitude(0.022)
    .htmlElement(d => {
      const isSelected = d.id === (activeSelectedBeach?.id || activeBeachId);
      const color = getSuitabilityColor(d);

      const el = document.createElement('div');
      el.className = `globe-marker-node ${isSelected ? 'is-selected' : ''}`;
      el.setAttribute('data-beach-id', d.id);
      el.setAttribute('title', `${d.name} (${d.country || 'India'})`);

      el.innerHTML = `
        <div class="marker-caption-text">${d.name}</div>
        <div class="marker-beacon-halo" style="border-color: ${color};"></div>
        <div class="marker-beacon-dot" style="background-color: ${color};"></div>
      `;

      el.onclick = (e) => {
        e.stopPropagation();
        const lat = d.latitude ?? d.lat;
        const lng = d.longitude ?? d.lng;
        globeInstance.pointOfView({ lat, lng, altitude: 1.1 }, 1000);
        flyToBeach(d, 1.1, 1000);
        if (typeof window.openBeachDetailSheet === 'function') {
          window.openBeachDetailSheet(d);
        } else if (onSelectBeachCallback && d.id) {
          onSelectBeachCallback(d.id);
        }
      };

      return el;
    })
    .htmlElementVisibilityModifier((el, isVisible) => {
      if (isVisible) {
        el.style.display = 'flex';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      } else {
        // Complete DOM hide eliminates horizon stacking completely
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      }
    });
}

/**
 * Smooth spherical camera flight to a specific beach
 */
export function flyToBeach(beach, altitude = 1.2, durationMs = 1500) {
  if (!globeInstance || !beach) return;
  activeSelectedBeach = beach;

  // Temporarily pause auto-rotation during flight
  const controls = globeInstance.controls();
  if (controls) {
    controls.autoRotate = false;
    clearTimeout(autoRotateTimeout);
    autoRotateTimeout = setTimeout(() => {
      controls.autoRotate = true;
    }, durationMs + 2500);
  }

  // Smooth spherical interpolation camera fly-to
  globeInstance.pointOfView(
    {
      lat: beach.latitude ?? beach.lat,
      lng: beach.longitude ?? beach.lng,
      altitude,
    },
    durationMs
  );

  // Update pulsing ripple ring to highlight selected beach
  globeInstance.ringsData([beach]);

  // Re-cull labels so the selected beach label is guaranteed visible
  const pov = typeof globeInstance.pointOfView === 'function' ? globeInstance.pointOfView() : null;
  updateHtmlLabels(currentBeachesList, beach.id, pov);
}

/**
 * Update the points, rings, and labels when beaches or filters change
 */
export function updateGlobeData(beaches, selectedBeach = null) {
  if (!globeInstance) return;
  currentBeachesList = beaches || [];
  if (selectedBeach) activeSelectedBeach = selectedBeach;

  const pov = typeof globeInstance.pointOfView === 'function' ? globeInstance.pointOfView() : null;
  const frontBeaches = (pov && pov.lat !== undefined && pov.lng !== undefined)
    ? currentBeachesList.filter(b => isPointOnVisibleFrontHemisphere(b.latitude ?? b.lat, b.longitude ?? b.lng, pov.lat, pov.lng))
    : currentBeachesList;

  globeInstance.pointsData(frontBeaches);

  if (selectedBeach) {
    globeInstance.ringsData([selectedBeach]);
  } else if (frontBeaches.length > 0) {
    globeInstance.ringsData(frontBeaches.slice(0, 1));
  } else {
    globeInstance.ringsData([]);
  }

  updateHtmlLabels(currentBeachesList, activeSelectedBeach?.id, pov);
}

/**
 * Resize the 3D globe to fit container
 */
export function resizeGlobe() {
  if (!globeInstance) return;
  const container = document.getElementById('globe-3d-container');
  if (container) {
    globeInstance.width(container.clientWidth || window.innerWidth);
    globeInstance.height(container.clientHeight || 500);
  }
}
