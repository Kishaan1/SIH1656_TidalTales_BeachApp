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

let globeInstance = null;
let activeSelectedBeach = null;
let autoRotateTimeout = null;
let currentBeachesList = [];
let onSelectBeachCallback = null;

/**
 * Filter beaches to prevent label collision and overlap on clustered locations.
 * The currently active/selected beach is always given top priority.
 */
export function filterNonCollidingBeaches(beachesList, activeBeachId, minDistanceDeg = 2.8) {
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

    const collides = visible.some(v => {
      const dLat = b.latitude - v.latitude;
      const dLng = (b.longitude - v.longitude) * Math.cos((b.latitude * Math.PI) / 180);
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
export function initGlobe(container, beaches, onSelectBeach) {
  if (!container) return null;

  currentBeachesList = beaches || [];
  onSelectBeachCallback = onSelectBeach;

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

  // 1. Natural Earth 110m Coastlines & Landmasses
  if (countriesGeoJson && countriesGeoJson.features) {
    globeInstance
      .polygonsData(countriesGeoJson.features)
      .polygonCapColor(() => '#F5EBE0') // Parchment cream land
      .polygonSideColor(() => '#E0D5C1')
      .polygonStrokeColor(() => 'rgba(180, 160, 135, 0.45)')
      .polygonAltitude(0.005)
      .polygonCapCurvatureResolution(2);
  }

  // 2. Miniature Sleek Surface Beacon Markers (drastically reduced from bulky cylinders)
  globeInstance
    .pointsData(currentBeachesList)
    .pointLat('latitude')
    .pointLng('longitude')
    .pointColor(d => getSuitabilityColor(d))
    .pointAltitude(0.014)     // Low-profile surface beacon
    .pointRadius(0.24)       // Miniature pin radius (down from 0.85)
    .pointResolution(32)     // Smooth round beacon
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
    .onPointClick(d => {
      if (onSelectBeachCallback && d?.id) {
        onSelectBeachCallback(d.id);
        flyToBeach(d);
      }
    });

  // 3. Glowing 3D Beacon Rings on the Surface (active pulse ring)
  const initialActive = currentBeachesList.slice(0, 1);
  globeInstance
    .ringsData(initialActive)
    .ringLat('latitude')
    .ringLng('longitude')
    .ringAltitude(0.008)
    .ringColor(() => '#FAF1E4')
    .ringMaxRadius(2.2)
    .ringPropagationSpeed(1.4)
    .ringRepeatPeriod(1000);

  // 4. Billboarded Non-Colliding HTML Labels (0.7rem, offset above pin anchor, zero 3D tilt distortion)
  updateHtmlLabels(currentBeachesList, currentBeachesList[0]?.id);

  // 5. OrbitControls & Ambient Auto-Rotation
  const controls = globeInstance.controls();
  if (controls) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 140;
    controls.maxDistance = 450;

    // Pause rotation during user interaction and resume after 3s of idle
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

  // Initial Point of View centered comfortably over the Indian Ocean
  globeInstance.pointOfView({ lat: 14.0, lng: 77.0, altitude: 1.85 }, 1200);

  // Window Resize
  const handleResize = () => {
    if (!globeInstance || !container) return;
    globeInstance.width(container.clientWidth || window.innerWidth);
    globeInstance.height(container.clientHeight || 500);
  };
  window.addEventListener('resize', handleResize);

  return globeInstance;
}

/**
 * Update HTML marker labels with automatic collision culling
 */
function updateHtmlLabels(beaches, activeBeachId) {
  if (!globeInstance) return;

  const nonColliding = filterNonCollidingBeaches(beaches, activeBeachId, 2.8);

  globeInstance
    .htmlElementsData(nonColliding)
    .htmlLat('latitude')
    .htmlLng('longitude')
    .htmlAltitude(0.016)
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
        if (onSelectBeachCallback) {
          onSelectBeachCallback(d.id);
          flyToBeach(d);
        }
      };

      return el;
    })
    .htmlElementVisibilityModifier((el, isVisible) => {
      el.style.opacity = isVisible ? '1' : '0';
      el.style.pointerEvents = isVisible ? 'auto' : 'none';
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
      lat: beach.latitude,
      lng: beach.longitude,
      altitude,
    },
    durationMs
  );

  // Update pulsing ripple ring to highlight selected beach
  globeInstance.ringsData([beach]);

  // Re-cull labels so the selected beach label is guaranteed visible
  updateHtmlLabels(currentBeachesList, beach.id);
}

/**
 * Update the points, rings, and labels when beaches or filters change
 */
export function updateGlobeData(beaches, selectedBeach = null) {
  if (!globeInstance) return;
  currentBeachesList = beaches || [];
  if (selectedBeach) activeSelectedBeach = selectedBeach;

  globeInstance.pointsData(currentBeachesList);

  if (selectedBeach) {
    globeInstance.ringsData([selectedBeach]);
  } else if (currentBeachesList.length > 0) {
    globeInstance.ringsData(currentBeachesList.slice(0, 1));
  } else {
    globeInstance.ringsData([]);
  }

  updateHtmlLabels(currentBeachesList, activeSelectedBeach?.id);
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
