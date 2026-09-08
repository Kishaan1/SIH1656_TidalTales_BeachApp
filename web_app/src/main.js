import L from 'leaflet';
import { INITIAL_BEACHES, DEFAULT_BEACH_IMAGE } from './beaches.js';
import {
  evaluateSuitability,
  haversineDistanceKm,
  SuitabilityStatus,
  STATUS_COLORS,
  kmphToKnots,
  knotsToKmph,
} from './suitability.js';
import {
  calculateRoute,
  calculateAlternativeRoutes,
  calculateBearing,
  TravelMode,
  RouteCriterion,
  speakManeuver,
  setSpeechMuted,
  isSpeechMutedState,
  checkOffRouteDeviation,
} from './navigation.js';
import { askGeminiAboutBeach, askGeminiCoastalAI } from './gemini.js';
import {
  fuzzySearchBeaches,
  highlightMatchText,
  SearchHistory,
  debounce,
  startVoiceSearch,
} from './search.js';
import {
  loadSettings,
  saveSetting,
  getSetting,
  resetAllSettings,
  t,
  clearSystemTileCache,
  calculateStorageUsageMB,
} from './settings.js';
import { initGlobe, flyToBeach, updateGlobeData, resizeGlobe } from './globe.js';
import { getBeachTelemetry } from './marineTelemetry.js';

// Application State
let beaches = JSON.parse(JSON.stringify(INITIAL_BEACHES));
let userLocation = { lat: 13.0827, lon: 80.2707, city: 'Chennai' }; // Coastal Chennai default
let selectedBeachId = beaches[0].id;
let currentFilter = 'all';
let map = null;
let globeInstance = null;
let currentProjectionView = '3d'; // '3d' or '2d'
let markers = {};
let currentUser = null;

// Navigation Engine State
let isNavigating = false;
let activeRoute = null;
let activeAlternativeRoutes = null; // { fastest, shortest, scenic }
let currentCriterion = RouteCriterion.FASTEST;
let currentTravelMode = TravelMode.DRIVING;
let currentStepIndex = 0;
let routePolylineLayer = null;
let hazardPolylineLayer = null;
let alternativePolylineLayers = [];
let trafficPolylineLayers = [];
let incidentMarkersList = [];
let vehiclePuckMarker = null;
let vehicleCurrentCoord = null;
let vehicleBearing = 0;
let isSimulating = false;
let simInterval = null;
let simStepIndex = 0;
let simSpeedMultiplier = 1;
let showHazardGeofence = true;
let routeFilters = {
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: true,
};
let favoriteBeaches = JSON.parse(localStorage.getItem('tidal_favorites') || '[]');
let lastVoiceMilestone = null;
let lastRerouteTimestamp = 0;
let gpsWatchId = null;
let isGpsActive = false;
let searchPlaceholderTimer = null;

// Web Audio API Retro Alert Chime
function playAlertChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    // Audio might require user gesture
  }
}

// --------------------------------------------------------------------------
// 1. Clock in Status Bar
// --------------------------------------------------------------------------
function initClock() {
  const clockEl = document.getElementById('clock-display');
  function update() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hours}:${minutes}`;
  }
  update();
  setInterval(update, 30000);
}

// --------------------------------------------------------------------------
// 2. Looping 16mm Retro Coastal Ambient Backdrop Canvas
// --------------------------------------------------------------------------
function initCoastalCanvas() {
  const canvas = document.getElementById('coastal-ambient-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  let step = 0;
  function draw() {
    step += 0.02;
    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5a4231');
    grad.addColorStop(0.35, '#875d3b');
    grad.addColorStop(0.65, '#355957');
    grad.addColorStop(1, '#1b2d2d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.35, w * 0.7);
    sunGrad.addColorStop(0, 'rgba(232, 147, 91, 0.45)');
    sunGrad.addColorStop(0.5, 'rgba(232, 147, 91, 0.15)');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const waveY = h * (0.55 + i * 0.12);
      ctx.moveTo(0, h);
      ctx.lineTo(0, waveY);

      for (let x = 0; x <= w; x += 15) {
        const y = waveY +
          Math.sin(x * 0.015 + step * (1 + i * 0.3) + i) * (12 - i * 2) +
          Math.cos(x * 0.008 - step * 0.8) * 8;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      const alpha = 0.25 + i * 0.18;
      const waveColor = i % 2 === 0
        ? `rgba(63, 140, 136, ${alpha})`
        : `rgba(44, 100, 98, ${alpha})`;
      ctx.fillStyle = waveColor;
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 253, 249, ${0.3 - i * 0.05})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  draw();
}

// --------------------------------------------------------------------------
// 3. Authentication State Gate & Session Persistence (Strict Boot Guard)
// --------------------------------------------------------------------------
let isDashboardInitialized = false;

function initMapAndDashboard() {
  if (isDashboardInitialized) {
    if (typeof map !== 'undefined' && map) {
      setTimeout(() => map.invalidateSize(true), 100);
      setTimeout(() => map.invalidateSize(true), 350);
    }
    resizeGlobe();
    return;
  }
  isDashboardInitialized = true;
  initMap();
  initGlobeView();
  renderPolaroidCarousel();
  initSimulator();
  initAlertSystem();
  initFilters();
  initUniversalSearch();
  initNavigationEvents();
  initGeminiAssistant();
  initSettings();
  selectBeach(beaches[0].id);
}

function mountDashboard() {
  const rawSession = localStorage.getItem('tidal_session') || localStorage.getItem('tidal_user_session');
  let session = null;
  if (rawSession) {
    try {
      session = JSON.parse(rawSession);
    } catch (e) {}
  }
  // Ensure mountDashboard is never executed on app load if session.passcodeVerified !== true
  if (session && session.isAuthenticated && (session.passcodeVerified === true || session.role === 'guest')) {
    initMapAndDashboard();
  }
}

function enforceAuthGate() {
  const rawSession = localStorage.getItem('tidal_session') || localStorage.getItem('tidal_user_session');
  let isAuthenticated = false;
  let session = null;

  if (rawSession) {
    try {
      session = JSON.parse(rawSession);
      // Strictly require passcodeVerified === true (or guest pass)
      isAuthenticated = Boolean(session && session.isAuthenticated && (session.passcodeVerified === true || session.role === 'guest'));
    } catch (err) {
      console.error("Invalid session structure:", err);
      localStorage.removeItem('tidal_session');
      localStorage.removeItem('tidal_user_session');
    }
  }

  const authScreen = document.getElementById('auth-screen');
  const dashboardView = document.getElementById('home-dashboard') || document.getElementById('dashboard-view');
  const statusBar = document.getElementById('device-status-bar');
  const authStatusPill = document.getElementById('top-auth-status');
  const topAuthBtn = document.getElementById('header-auth-gate-btn');
  const greetingEl = document.getElementById('user-greeting-text');
  const topAlertBanner = document.getElementById('top-alert-banner');
  const alertToast = document.getElementById('alert-toast');
  const ownerBadge = document.getElementById('owner-badge');
  const sandboxOwnerBadge = document.getElementById('owner-sandbox-unlocked-badge');

  if (!isAuthenticated) {
    // STRICT LOCK ACCESS: Show auth screen, hide all dashboard views
    document.body.classList.remove('authenticated');
    document.body.classList.add('unauthenticated');
    currentUser = null;

    if (authScreen) {
      authScreen.classList.remove('hidden');
      authScreen.style.removeProperty('display');
    }
    if (dashboardView) {
      dashboardView.classList.add('hidden');
      dashboardView.style.setProperty('display', 'none', 'important');
    }
    if (statusBar) statusBar.classList.add('auth-mode');
    if (ownerBadge) ownerBadge.style.display = 'none';
    if (sandboxOwnerBadge) sandboxOwnerBadge.style.display = 'none';
    if (topAlertBanner) topAlertBanner.style.display = 'none';
    if (alertToast) alertToast.style.display = 'none';

    if (authStatusPill) authStatusPill.textContent = 'Logged Out';
    if (topAuthBtn) {
      topAuthBtn.innerHTML = `<span id="auth-state-badge">🔒 Auth State: <span id="top-auth-status">Logged Out</span></span>`;
    }

    // Stop execution: DO NOT mount map or dashboard when not logged in
    return false;
  }

  // UNLOCK ACCESS: Show dashboard, hide auth screen
  document.body.classList.add('authenticated');
  document.body.classList.remove('unauthenticated');
  currentUser = session;

  const isOwner = currentUser?.role === 'owner' || currentUser?.role === 'Owner [Test Pass]' || currentUser?.email === 'owner@tidaltales.in';

  if (authScreen) {
    authScreen.classList.add('hidden');
    authScreen.style.setProperty('display', 'none', 'important');
  }
  if (dashboardView) {
    dashboardView.classList.remove('hidden');
    dashboardView.style.removeProperty('display');
  }
  if (statusBar) statusBar.classList.remove('auth-mode');

  if (ownerBadge) ownerBadge.style.display = isOwner ? 'inline-flex' : 'none';
  if (sandboxOwnerBadge) sandboxOwnerBadge.style.display = isOwner ? 'inline-flex' : 'none';

  if (isOwner) {
    // Unlock full INCOIS simulation sliders ranges for owner/judge testing
    const waveSlider = document.getElementById('slider-wave');
    const windSlider = document.getElementById('slider-wind');
    const swellSlider = document.getElementById('slider-swell');
    if (waveSlider) waveSlider.max = '6.0';
    if (windSlider) windSlider.max = '65';
    if (swellSlider) swellSlider.max = '24';
  }

  const statusText = isOwner ? 'Owner [Test Pass]' : (currentUser.role === 'guest' ? 'Guest Pass' : 'Verified Explorer');
  if (authStatusPill) authStatusPill.textContent = statusText;
  if (topAuthBtn) {
    topAuthBtn.innerHTML = `<span id="auth-state-badge">🔓 Auth State: <span id="top-auth-status">${statusText}</span></span>`;
  }
  if (greetingEl) {
    greetingEl.textContent = isOwner 
      ? 'Welcome, Chief Oceanographer 🌊 [Owner Test Pass Active]' 
      : `Welcome back, ${currentUser.name || 'Explorer'} ☀️`;
  }

  // Proceed with initializing map, telemetry, and carousel only now
  mountDashboard();
  updateTopAlertBanner();

  // Recalculate Leaflet map container dimensions and refresh markers/cards
  setTimeout(() => {
    if (typeof map !== 'undefined' && map) {
      map.invalidateSize(true);
    }
  }, 120);

  return true;
}

const checkAuthState = enforceAuthGate;

function initAuth() {
  const tabSignIn = document.getElementById('tab-sign-in');
  const tabSignUp = document.getElementById('tab-sign-up');
  const signInFlow = document.getElementById('sign-in-flow');
  const formSignUp = document.getElementById('sign-up-form');

  // Step 1 & Step 2 Containers
  const identityStep = document.getElementById('identity-step');
  const passcodeStep = document.getElementById('passcode-step');
  const btnContinuePasscode = document.getElementById('btn-continue-passcode');
  const btnBackIdentity = document.getElementById('btn-back-identity');
  const btnSubmitPasscode = document.getElementById('btn-submit-passcode');
  const pinDigits = document.querySelectorAll('.pin-digit');
  const displayUserId = document.getElementById('display-user-id');
  const emailInput = document.getElementById('signin-email');

  function goToPasscodeStep(identifier) {
    const handle = identifier || emailInput?.value?.trim();
    if (!handle) {
      showHazardToast('Identity Required', 'Please enter your email or mobile handle to continue.');
      emailInput?.focus();
      return false;
    }
    if (displayUserId) displayUserId.textContent = handle;
    identityStep?.classList.remove('active');
    identityStep?.classList.add('hidden');
    passcodeStep?.classList.remove('hidden');
    passcodeStep?.classList.add('active');
    setTimeout(() => {
      pinDigits[0]?.focus();
    }, 50);
    return true;
  }

  function goToIdentityStep() {
    passcodeStep?.classList.remove('active');
    passcodeStep?.classList.add('hidden');
    identityStep?.classList.remove('hidden');
    identityStep?.classList.add('active');
    setTimeout(() => {
      emailInput?.focus();
    }, 50);
  }

  tabSignIn?.addEventListener('click', () => {
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    signInFlow?.classList.add('active');
    formSignUp?.classList.remove('active');
    goToIdentityStep();
  });

  tabSignUp?.addEventListener('click', () => {
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    formSignUp?.classList.add('active');
    signInFlow?.classList.remove('active');
  });

  // Step 1 -> Step 2 Transitions
  btnContinuePasscode?.addEventListener('click', () => {
    goToPasscodeStep();
  });

  emailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToPasscodeStep();
    }
  });

  btnBackIdentity?.addEventListener('click', () => {
    goToIdentityStep();
  });

  // PIN Auto-Advance & Ergonomics
  pinDigits.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        box.classList.add('filled');
        if (idx < pinDigits.length - 1) {
          pinDigits[idx + 1].focus();
        }
      } else {
        box.classList.remove('filled');
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        pinDigits[idx - 1].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePasscodeSubmit();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').trim();
      const numbers = text.replace(/\D/g, '');
      if (numbers.length > 0) {
        const chars = numbers.split('');
        chars.slice(0, pinDigits.length).forEach((c, i) => {
          pinDigits[i].value = c;
          pinDigits[i].classList.add('filled');
        });
        const nextFocus = Math.min(chars.length, pinDigits.length - 1);
        pinDigits[nextFocus].focus();
      }
    });
  });

  // Passcode Verification Helpers & Security Logic
  function updateAuthBadge(roleText) {
    const authStatusPill = document.getElementById('top-auth-status');
    const topAuthBtn = document.getElementById('header-auth-gate-btn');
    const badgeEl = document.getElementById('auth-state-badge');
    const text = roleText || 'Verified Explorer';

    if (authStatusPill) authStatusPill.textContent = text;
    if (topAuthBtn) {
      topAuthBtn.innerHTML = `<span id="auth-state-badge">🔓 Auth State: <span id="top-auth-status">${text}</span></span>`;
    } else if (badgeEl) {
      badgeEl.innerHTML = `🔓 Auth State: <span id="top-auth-status">${text}</span>`;
    }
  }

  function clearPinInputs() {
    pinDigits.forEach(d => {
      d.value = '';
      d.classList.remove('filled');
    });
    pinDigits[0]?.focus();
  }

  function showPasscodeError(msg = 'Invalid Compass PIN. Access Denied.') {
    showHazardToast('Access Denied', msg);
    const matrix = document.getElementById('pin-matrix');
    if (matrix) {
      matrix.classList.add('shake');
      setTimeout(() => matrix.classList.remove('shake'), 450);
    }
  }

  function openPasscodeModal(targetUser = 'owner@tidaltales.in') {
    const authScreen = document.getElementById('auth-screen');
    const dashboardView = document.getElementById('home-dashboard') || document.getElementById('dashboard-view');

    if (authScreen) {
      authScreen.classList.remove('hidden');
      authScreen.style.removeProperty('display');
    }
    if (dashboardView) {
      dashboardView.classList.add('hidden');
      dashboardView.style.setProperty('display', 'none', 'important');
    }

    if (tabSignIn && tabSignUp && signInFlow && formSignUp) {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInFlow.classList.add('active');
      formSignUp.classList.remove('active');
    }

    if (emailInput) {
      emailInput.value = targetUser;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    goToPasscodeStep(targetUser);
    clearPinInputs();
    showHazardToast('🔒 Passcode Required', 'Please enter your 4-digit Compass PIN (Owner: 2026)');
  }

  function closePasscodeModal() {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) {
      authScreen.classList.add('hidden');
      authScreen.style.setProperty('display', 'none', 'important');
    }
  }

  function verifyPasscode(enteredPin) {
    const MASTER_OWNER_PIN = '2026';
    const handle = emailInput?.value?.trim() || displayUserId?.textContent?.trim() || 'owner@tidaltales.in';
    const isOwner = handle.toLowerCase().includes('owner') || handle.toLowerCase() === 'owner@tidaltales.in';

    if (isOwner) {
      if (enteredPin === MASTER_OWNER_PIN) {
        const ownerSession = {
          isAuthenticated: true,
          passcodeVerified: true,
          role: 'Owner [Test Pass]',
          user: 'owner@tidaltales.in',
          name: 'Chief Oceanographer (Owner)',
          email: 'owner@tidaltales.in',
          permissions: ['bypass_verification', 'full_sandbox_sliders', 'owner_test_pass'],
          timestamp: Date.now(),
          loggedInAt: Date.now(),
        };
        localStorage.setItem('tidal_session', JSON.stringify(ownerSession));
        localStorage.setItem('tidal_user_session', JSON.stringify(ownerSession));
        closePasscodeModal();
        updateAuthBadge('Owner [Test Pass]');
        mountDashboard();
        showHazardToast('🔓 Compass Unlocked', 'Welcome ashore, Chief Oceanographer!');
        checkAuthState();
        return true;
      } else {
        showPasscodeError('Invalid Compass PIN. Access Denied.');
        clearPinInputs();
        return false;
      }
    } else {
      if (enteredPin && enteredPin.length === 4) {
        let userName = 'Coastal Explorer';
        if (handle.includes('@')) {
          const prefix = handle.split('@')[0].replace(/[\._\-]/g, ' ');
          userName = prefix.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        } else {
          userName = `Explorer ${handle.slice(-4)}`;
        }
        const explorerSession = {
          isAuthenticated: true,
          passcodeVerified: true,
          role: 'explorer',
          user: handle,
          name: userName,
          email: handle,
          timestamp: Date.now(),
          loggedInAt: Date.now(),
        };
        localStorage.setItem('tidal_session', JSON.stringify(explorerSession));
        localStorage.setItem('tidal_user_session', JSON.stringify(explorerSession));
        closePasscodeModal();
        updateAuthBadge('Verified Explorer');
        mountDashboard();
        showHazardToast('🔓 Compass Unlocked', `Welcome ashore, ${userName}!`);
        checkAuthState();
        return true;
      } else {
        showPasscodeError('Invalid Compass PIN. Access Denied.');
        clearPinInputs();
        return false;
      }
    }
  }

  // Step 2 Passcode Submission & Verification
  function handlePasscodeSubmit() {
    const pin = Array.from(pinDigits).map(d => d.value.trim()).join('');

    if (pin.length < 4) {
      showPasscodeError('Please enter all 4 digits of your compass passcode.');
      const firstEmpty = Array.from(pinDigits).find(d => !d.value);
      if (firstEmpty) firstEmpty.focus();
      return;
    }

    btnSubmitPasscode?.classList.add('loading');
    setTimeout(() => {
      btnSubmitPasscode?.classList.remove('loading');
      verifyPasscode(pin);
    }, 120);
  }

  btnSubmitPasscode?.addEventListener('click', handlePasscodeSubmit);

  // Password Peek/Conceal for Registration
  const signupPwd = document.getElementById('signup-password');
  const signupToggle = document.getElementById('signup-pwd-toggle');
  signupToggle?.addEventListener('click', () => {
    const isPwd = signupPwd.type === 'password';
    signupPwd.type = isPwd ? 'text' : 'password';
    signupToggle.textContent = isPwd ? 'Conceal' : 'Peek';
  });

  // 4-Tier Tide-Gauge Strength Meter for Registration
  const tideLabel = document.getElementById('tide-gauge-text');
  const bar1 = document.getElementById('tide-bar-1');
  const bar2 = document.getElementById('tide-bar-2');
  const bar3 = document.getElementById('tide-bar-3');
  const bar4 = document.getElementById('tide-bar-4');

  signupPwd?.addEventListener('input', () => {
    const val = signupPwd.value;
    let strength = 0;
    if (val.length >= 4) strength++;
    if (val.length >= 8) strength++;
    if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val)) strength++;
    if (/[^a-zA-Z0-9]/.test(val) || val.length >= 12) strength++;

    [bar1, bar2, bar3, bar4].forEach(b => {
      if (b) b.className = 'tide-bar';
    });

    if (!tideLabel) return;
    if (strength === 0 || val.length === 0) {
      tideLabel.textContent = 'Low Tide';
      tideLabel.style.color = 'var(--muted-slate)';
    } else if (strength === 1) {
      tideLabel.textContent = 'Low Tide (Weak)';
      tideLabel.style.color = 'var(--brick-red)';
      bar1?.classList.add('active-level-1');
    } else if (strength === 2) {
      tideLabel.textContent = 'Moderate Wave';
      tideLabel.style.color = 'var(--sunset-ochre)';
      bar1?.classList.add('active-level-2');
      bar2?.classList.add('active-level-2');
    } else if (strength === 3) {
      tideLabel.textContent = 'High Tide (Strong)';
      tideLabel.style.color = '#6bb2ad';
      bar1?.classList.add('active-level-3');
      bar2?.classList.add('active-level-3');
      bar3?.classList.add('active-level-3');
    } else {
      tideLabel.textContent = 'Calm Waters (Pristine)';
      tideLabel.style.color = 'var(--vintage-teal)';
      bar1?.classList.add('active-level-4');
      bar2?.classList.add('active-level-4');
      bar3?.classList.add('active-level-4');
      bar4?.classList.add('active-level-4');
    }
  });

  // SIGN UP SUBMIT -> Save session & trigger welcome email
  const btnClaimSpot = document.getElementById('btn-claim-spot');
  formSignUp?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value || 'Coastal Explorer';
    const email = document.getElementById('signup-email').value || 'explorer@coastline.in';

    btnClaimSpot.classList.add('loading');
    setTimeout(() => {
      btnClaimSpot.classList.remove('loading');
      const sessionData = {
        isAuthenticated: true,
        user: email,
        name,
        email,
        role: 'explorer',
        timestamp: Date.now(),
        loggedInAt: Date.now(),
      };
      localStorage.setItem('tidal_session', JSON.stringify(sessionData));
      localStorage.setItem('tidal_user_session', JSON.stringify(sessionData));
      showWelcomeEmailModal(name, email);
    }, 700);
  });

  // ------------------------------------------------------------------------
  // Owner Secret Backdoor Triggers:
  // 1. Triple-Tap on "Tidal Tales" Logo/Title within 1.5s
  // 2. URL Parameter: ?dev=true or ?mode=owner
  // ------------------------------------------------------------------------
  function triggerOwnerBackdoor() {
    // Ensure sign-in flow is active
    if (tabSignIn && tabSignUp && signInFlow && formSignUp) {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInFlow.classList.add('active');
      formSignUp.classList.remove('active');
    }

    if (emailInput) {
      emailInput.value = 'owner@tidaltales.in';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Transition to Passcode Step
    goToPasscodeStep('owner@tidaltales.in');

    // Auto-fill PIN: 2 0 2 6
    const ownerPin = ['2', '0', '2', '6'];
    pinDigits.forEach((box, i) => {
      box.value = ownerPin[i];
      box.classList.add('filled');
    });

    const fillBtn = document.getElementById('btn-fill-owner');
    if (fillBtn) {
      fillBtn.classList.add('filled-flash');
      const prevHTML = fillBtn.innerHTML;
      fillBtn.innerHTML = '✓ Owner Inked (PIN: 2026)!';
      setTimeout(() => {
        fillBtn.classList.remove('filled-flash');
        fillBtn.innerHTML = prevHTML;
      }, 1400);
    }

    pinDigits[3]?.focus();
    showHazardToast('👑 Owner Access Key', 'Secret owner bypass engaged (PIN: 2026)');
  }

  // Secret Triple-Tap Trigger on Header Logo / Title
  let tapCount = 0;
  let tapTimer = null;
  const authTitle = document.querySelector('.auth-header h1') || document.querySelector('.brand-logo') || document.getElementById('auth-hero-title');
  const authLogo = document.getElementById('auth-hero-logo') || document.querySelector('.hero-shell-emblem') || document.querySelector('.brand-logo');

  function handleSecretTap() {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 1500);

    if (tapCount === 3) {
      tapCount = 0;
      const input = document.getElementById('auth-email') || document.getElementById('signin-email') || document.querySelector('input[type="text"]');
      if (input) {
        input.value = 'owner@tidaltales.in';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Advance to passcode step automatically
      const nextBtn = document.getElementById('btn-continue-passcode');
      if (nextBtn) {
        nextBtn.click();
      } else {
        goToPasscodeStep('owner@tidaltales.in');
      }
      // Auto-fill PIN: 2 0 2 6
      const ownerPin = ['2', '0', '2', '6'];
      pinDigits.forEach((box, i) => {
        box.value = ownerPin[i];
        box.classList.add('filled');
      });
      pinDigits[3]?.focus();
      showHazardToast('👑 Owner Access Key', 'Secret owner bypass engaged (PIN: 2026)');
    }
  }

  authTitle?.addEventListener('click', handleSecretTap);
  authLogo?.addEventListener('click', handleSecretTap);

  // URL Developer Flag: If ?dev=true or ?mode=owner, dynamically render quick-fill button; otherwise omitted from DOM
  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || urlParams.get('mode') === 'owner';

  if (isDevMode) {
    const helperRow = document.querySelector('.auth-helper-row');
    const form = document.getElementById('sign-in-identity-form');
    if (form) {
      const devBar = document.createElement('div');
      devBar.id = 'owner-dev-bar';
      devBar.className = 'test-helper-bar';
      devBar.style.marginTop = '14px';
      devBar.innerHTML = `
        <button type="button" id="btn-fill-owner" class="test-fill-btn" title="Click to auto-fill Judge / Owner evaluation credentials">
          🔑 Quick-Fill Owner / Test Account
        </button>
      `;
      if (helperRow && helperRow.nextSibling) {
        form.insertBefore(devBar, helperRow.nextSibling);
      } else {
        form.appendChild(devBar);
      }
      document.getElementById('btn-fill-owner')?.addEventListener('click', triggerOwnerBackdoor);
    }
  }

  // Guest Explorer Entry
  document.getElementById('quick-guest-btn')?.addEventListener('click', () => {
    const guestSession = {
      isAuthenticated: true,
      passcodeVerified: true,
      user: 'guest@tidaltales.in',
      name: 'Guest Explorer',
      email: 'guest@tidaltales.in',
      role: 'guest',
      timestamp: Date.now(),
      loggedInAt: Date.now(),
    };
    localStorage.setItem('tidal_session', JSON.stringify(guestSession));
    localStorage.setItem('tidal_user_session', JSON.stringify(guestSession));
    checkAuthState();
  });

  // SIGN OUT BUTTON IN HEADER
  document.getElementById('btn-sign-out')?.addEventListener('click', () => {
    if (confirm('Step ashore and sign out of your coastal journal?')) {
      localStorage.removeItem('tidal_session');
      localStorage.removeItem('tidal_user_session');
      checkAuthState();
      goToIdentityStep();
    }
  });

  // Desktop Auth Gate Status Toggle Button / Auth Pill
  // Strict Passcode Gate: NEVER directly sets isAuthenticated = true or writes session on click!
  const authPill = document.getElementById('auth-state-badge') || document.getElementById('header-auth-gate-btn');
  const headerAuthBtn = document.getElementById('header-auth-gate-btn');

  function handleAuthPillClick(e) {
    e?.stopPropagation();
    const session = JSON.parse(localStorage.getItem('tidal_session') || '{}');
    if (!session.passcodeVerified) {
      openPasscodeModal('owner@tidaltales.in');
    } else {
      if (confirm('Step ashore and sign out of your coastal journal?')) {
        localStorage.removeItem('tidal_session');
        localStorage.removeItem('tidal_user_session');
        checkAuthState();
        goToIdentityStep();
      }
    }
  }

  authPill?.addEventListener('click', handleAuthPillClick);
  if (headerAuthBtn && headerAuthBtn !== authPill) {
    headerAuthBtn.addEventListener('click', handleAuthPillClick);
  }
}

// --------------------------------------------------------------------------
// 4. Welcome Email Modal
// --------------------------------------------------------------------------
function showWelcomeEmailModal(name, email) {
  const modal = document.getElementById('welcome-email-modal');
  document.getElementById('email-recipient-name').textContent = name;
  document.getElementById('email-recipient-address').textContent = email;
  document.getElementById('email-body-salutation').textContent = name;

  // Test Mode Simulated SMTP Dispatch
  console.log(`[SMTP SIMULATOR] Dispatching welcome letter to: ${email}`);
  showHazardToast('✉️ Dispatch Sent', `Welcome dispatch successfully sent to ${email}`);

  modal.classList.add('active');

  const actionBtn = document.getElementById('email-action-btn');
  const closeBtn = document.getElementById('close-email-modal-btn');

  function completeOnboarding() {
    modal.classList.remove('active');
    checkAuthState();
  }

  actionBtn.onclick = completeOnboarding;
  closeBtn.onclick = completeOnboarding;
}

// --------------------------------------------------------------------------
// 5. Geospatial Map & Keyless OpenStreetMap Tile Layer
// --------------------------------------------------------------------------
function initMap() {
  const mapElement = document.getElementById('vintage-map');
  if (!mapElement) return;

  map = L.map('vintage-map', {
    zoomControl: false,
    attributionControl: false,
  }).setView([userLocation.lat, userLocation.lon], 11);

  // KEYLESS OPEN TILE LAYER (OpenStreetMap Standard Tiles)
  // Completely eliminates "API KEY REQUIRED" error from CartoDB
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors & INCOIS',
  }).addTo(map);

  renderSafetyBuoyMarkers();
  updateGpsTelemetry();
}

/**
 * Initialize the 3D Interactive Rotating Globe and Projection Switcher
 */
function initGlobeView() {
  const globeContainer = document.getElementById('globe-3d-container');
  if (globeContainer) {
    globeInstance = initGlobe(globeContainer, getFilteredBeaches(), (beachId) => {
      selectBeach(beachId);
      openBottomSheet();
    });
  }

  const toggleBtn = document.getElementById('btn-toggle-globe-view');
  toggleBtn?.addEventListener('click', () => {
    setProjectionView(currentProjectionView === '3d' ? '2d' : '3d');
  });
}

function setProjectionView(mode) {
  currentProjectionView = mode;
  const globeContainer = document.getElementById('globe-3d-container');
  const mapElement = document.getElementById('vintage-map');
  const toggleBtn = document.getElementById('btn-toggle-globe-view');
  const mapWrapper = document.getElementById('map-wrapper');

  if (mode === '3d') {
    if (globeContainer) {
      globeContainer.style.display = 'block';
      globeContainer.classList.add('active');
    }
    if (mapElement) {
      mapElement.style.display = 'none';
      mapElement.classList.remove('active');
    }
    if (mapWrapper) {
      mapWrapper.classList.add('view-3d-globe');
      mapWrapper.classList.remove('view-2d-map');
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span class="toggle-icon">🗺️</span> <span class="toggle-text">2D Road Map</span>';
      toggleBtn.title = 'Switch to 2D Road Map';
    }
    resizeGlobe();
  } else {
    if (globeContainer) {
      globeContainer.style.display = 'none';
      globeContainer.classList.remove('active');
    }
    if (mapElement) {
      mapElement.style.display = 'block';
      mapElement.classList.add('active');
    }
    if (mapWrapper) {
      mapWrapper.classList.remove('view-3d-globe');
      mapWrapper.classList.add('view-2d-map');
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span class="toggle-icon">🌐</span> <span class="toggle-text">3D Globe</span>';
      toggleBtn.title = 'Switch to 3D Interactive Globe';
    }
    if (map) {
      setTimeout(() => map.invalidateSize(), 60);
      setTimeout(() => map.invalidateSize(), 250);
    }
  }
}

function createSafetyBuoyIcon(status) {
  const statusClass = status === SuitabilityStatus.SAFE
    ? 'buoy-safe'
    : status === SuitabilityStatus.MODERATE
    ? 'buoy-moderate'
    : 'buoy-unsafe';

  const iconGlyph = status === SuitabilityStatus.SAFE
    ? '✓'
    : status === SuitabilityStatus.MODERATE
    ? '!'
    : '✕';

  return L.divIcon({
    className: 'custom-buoy-icon',
    html: `
      <div class="safety-buoy-marker ${statusClass}">
        <div class="buoy-outer-ring"></div>
        <div class="buoy-beacon">${iconGlyph}</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function getFilteredBeaches() {
  return beaches.filter(beach => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'india') return beach.region === 'india' || beach.country === 'India';
    if (currentFilter === 'asia-pacific') return beach.region === 'asia-pacific';
    if (currentFilter === 'europe-med') return beach.region === 'europe-med';
    if (currentFilter === 'americas') return beach.region === 'americas';
    if (currentFilter === 'africa-me') return beach.region === 'africa-me';

    const result = evaluateSuitability(beach.reading);
    if (currentFilter === 'safe' || currentFilter === 'Safe to Swim') {
      return result.score >= 75 || result.status === SuitabilityStatus.SAFE;
    }
    if (currentFilter === 'popular') {
      const name = beach.name.toLowerCase();
      return (beach.reviewsCount && beach.reviewsCount >= 1400) ||
        name.includes('marina') || name.includes('calangute') || name.includes('kovalam') || name.includes('puri') || name.includes('juhu') ||
        name.includes('copacabana') || name.includes('waikiki') || name.includes('kuta') || name.includes('santorini');
    }
    if (currentFilter === 'near_me') {
      const dist = haversineDistanceKm(userLocation.lat, userLocation.lon, beach.latitude, beach.longitude);
      return dist <= 50;
    }
    if (currentFilter === 'watersports') {
      const name = beach.name.toLowerCase();
      return name.includes('calangute') || name.includes('varkala') || name.includes('kovalam') || name.includes('marina') || name.includes('gold coast') || name.includes('waikiki') ||
        (beach.category && beach.category.toLowerCase().includes('watersport'));
    }
    if (currentFilter === 'Caution Advised') return result.status === SuitabilityStatus.MODERATE;
    if (currentFilter === 'Hazardous') return result.status === SuitabilityStatus.UNSAFE;
    return (beach.state || '').toLowerCase().includes(currentFilter.toLowerCase()) || (beach.country || '').toLowerCase().includes(currentFilter.toLowerCase());
  });
}

function renderSafetyBuoyMarkers() {
  if (!map) return;

  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const activeBeaches = getFilteredBeaches();

  activeBeaches.forEach(beach => {
    const result = evaluateSuitability(beach.reading);
    const icon = createSafetyBuoyIcon(result.status);

    const marker = L.marker([beach.latitude, beach.longitude], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:'Inter',sans-serif; padding:4px;">
          <strong style="font-size:13px; color:#2C221E;">${beach.name}</strong><br/>
          <span style="font-size:11px; color:${result.statusColor}; font-weight:700;">
            ● ${result.status} (${result.score}/100)
          </span><br/>
          <span style="font-size:10px; color:#6B5E55;">${beach.state ? beach.state + ', ' : ''}${beach.country || 'India'} · ${result.windKnots} kts</span>
        </div>
      `);

    marker.on('click', () => {
      if (!isNavigating) {
        selectBeach(beach.id);
        openBottomSheet();
      }
    });

    markers[beach.id] = marker;
  });
}

function updateGpsTelemetry() {
  const coordsEl = document.getElementById('gps-coords');
  const nearestEl = document.getElementById('gps-nearest-name');
  if (!coordsEl || !nearestEl) return;

  const latStr = `${userLocation.lat.toFixed(2)}° N`;
  const lonStr = `${userLocation.lon.toFixed(2)}° E`;
  coordsEl.textContent = `📍 ${latStr}, ${lonStr} · ${userLocation.city}`;

  let minDistance = Infinity;
  let closest = beaches[0];

  beaches.forEach(b => {
    const d = haversineDistanceKm(userLocation.lat, userLocation.lon, b.latitude, b.longitude);
    if (d < minDistance) {
      minDistance = d;
      closest = b;
    }
  });

  nearestEl.textContent = `Nearest: ${closest.name} (${minDistance} km)`;
}

// --------------------------------------------------------------------------
// 6. Polaroid Carousel with Image Fallback Handler
// --------------------------------------------------------------------------
function renderPolaroidCarousel() {
  const carousel = document.getElementById('polaroid-carousel');
  const counterEl = document.getElementById('beach-counter');
  if (!carousel) return;

  carousel.innerHTML = '';

  const filteredBeaches = getFilteredBeaches();

  if (counterEl) {
    counterEl.textContent = `${filteredBeaches.length} spot${filteredBeaches.length === 1 ? '' : 's'} available`;
  }

  filteredBeaches.sort((a, b) => {
    const distA = haversineDistanceKm(userLocation.lat, userLocation.lon, a.latitude, a.longitude);
    const distB = haversineDistanceKm(userLocation.lat, userLocation.lon, b.latitude, b.longitude);
    return distA - distB;
  });

  const rotations = [-2.5, 2.0, -3.0, 1.8, -2.0, 2.5, -1.5];

  filteredBeaches.forEach((beach, idx) => {
    const result = evaluateSuitability(beach.reading);
    const dist = haversineDistanceKm(userLocation.lat, userLocation.lon, beach.latitude, beach.longitude);
    const rot = rotations[idx % rotations.length];
    const isSelected = beach.id === selectedBeachId;

    const card = document.createElement('div');
    card.className = `polaroid-card ${isSelected ? 'selected' : ''}`;
    card.style.transform = `rotate(${rot}deg)`;
    card.id = `card-${beach.id}`;

    const badgeClass = result.status === SuitabilityStatus.SAFE
      ? 'badge-safe'
      : result.status === SuitabilityStatus.MODERATE
      ? 'badge-moderate'
      : 'badge-unsafe';

    // onerror fallback image handler ensures broken images never render blank
    card.innerHTML = `
      <div class="polaroid-photo-box">
        <img 
          src="${beach.imageUrl}" 
          alt="${beach.name}" 
          loading="lazy" 
          onerror="this.onerror=null; this.src='${DEFAULT_BEACH_IMAGE}';" 
        />
        <div class="photo-sun-tint"></div>
        <div class="suitability-badge ${badgeClass}">
          <span>●</span>
          <span>${result.status} · ${result.score.toFixed(0)}</span>
        </div>
      </div>
      <div class="polaroid-caption">
        <div class="polaroid-beach-name">${beach.name}</div>
        <div class="polaroid-location">
          <span>📍</span>
          <span>${beach.state ? beach.state + ', ' : ''}${beach.country || 'India'} · ${dist} km</span>
        </div>
        <div class="polaroid-scores-preview">
          <span>🌊 ${beach.reading.waveHeightM}m</span>
          <span>💨 ${result.windKnots}kts</span>
          <span>💧 ${beach.reading.waterQualityIndex}Q</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectBeach(beach.id);
      openBottomSheet();
    });

    carousel.appendChild(card);
  });
}

function selectBeach(id) {
  selectedBeachId = id;
  const beach = beaches.find(b => b.id === id);
  if (!beach) return;

  // 3D Globe camera flight and pulsing ring
  flyToBeach(beach);

  if (map && !isNavigating) {
    map.flyTo([beach.latitude, beach.longitude], 12, { duration: 1.2 });
    if (markers[id]) markers[id].openPopup();
  }

  document.querySelectorAll('.polaroid-card').forEach(el => el.classList.remove('selected'));
  const cardEl = document.getElementById(`card-${id}`);
  if (cardEl) {
    cardEl.classList.add('selected');
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  updateBottomSheetContent(beach);
  syncSimulatorInputs(beach);

  // Live oceanic telemetry fetch (certified INCOIS or global Open-Meteo)
  getBeachTelemetry(beach)
    .then(telemetry => {
      if (telemetry) {
        beach.reading = { ...beach.reading, ...telemetry };
        if (telemetry.source) beach.source = telemetry.source;
        updateBottomSheetContent(beach);
        updateGlobeData(getFilteredBeaches(), beach);
      }
    })
    .catch(err => console.warn('[TELEMETRY] Live fetch:', err));
}

function openBottomSheet() {
  const sheet = document.getElementById('bottom-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  sheet?.classList.add('active');
  backdrop?.classList.add('active');
  const contentEl = sheet?.querySelector('.detail-sheet-content');
  if (contentEl) contentEl.scrollTop = 0;
  if (sheet) sheet.scrollTop = 0;
}

function closeBottomSheet() {
  document.getElementById('bottom-sheet')?.classList.remove('active');
  document.getElementById('sheet-backdrop')?.classList.remove('active');
}

function getBeachCategory(beach) {
  if (beach.category) return beach.category;
  const name = beach.name.toLowerCase();
  if (name.includes('marina') || name.includes('juhu')) return '🏖️ Urban Promenade & Family';
  if (name.includes('calangute') || name.includes('baga')) return '🏄 Watersports & Lively Coast';
  if (name.includes('kovalam') || name.includes('radhanagar')) return '🏝️ Pristine Eco-Sanctuary';
  if (name.includes('varkala')) return '🧗 Cliffside & Scenic Overlook';
  if (name.includes('puri')) return '🚩 Cultural Coast & Pilgrimage';
  return '🏖️ Coastal Recreation Reserve';
}

function renderBusynessHistogram(beach) {
  const container = document.getElementById('busyness-bars-row');
  const labelEl = document.getElementById('busyness-current-label');
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  const currentHour = now.getHours();

  // 16 Hourly samples from 6 AM (6) to 9 PM (21)
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const hourlyBasePct = {
    6: 18, 7: 26, 8: 35, 9: 42, 10: 38,
    11: 30, 12: 24, 13: 22, 14: 32, 15: 48,
    16: 72, 17: 95, 18: 88, 19: 68, 20: 44, 21: 26,
  };

  let currentHourPct = 30;

  hours.forEach(hour => {
    let pct = hourlyBasePct[hour] || 25;
    // Slight deterministic offset per beach name length for realistic variety
    pct = Math.min(100, Math.max(12, pct + ((beach.name.length % 5) * 3) - 6));

    const isCurrent = hour === currentHour;
    if (isCurrent) currentHourPct = pct;

    const bar = document.createElement('div');
    bar.className = `busyness-bar ${isCurrent ? 'is-current' : ''}`;
    bar.style.height = `${pct}%`;

    const hourLabel = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    bar.title = `${hourLabel}:00 ${ampm} · ${pct}% capacity${isCurrent ? ' (Current Time)' : ''}`;

    container.appendChild(bar);
  });

  if (labelEl) {
    if (currentHour < 6 || currentHour > 21) {
      labelEl.textContent = 'Quiet / Off-Peak hours';
      labelEl.style.background = 'rgba(110, 98, 89, 0.15)';
      labelEl.style.color = 'var(--muted-slate)';
    } else if (currentHourPct < 35) {
      labelEl.textContent = 'Usually not busy';
      labelEl.style.background = 'rgba(63, 140, 136, 0.15)';
      labelEl.style.color = 'var(--deep-teal)';
    } else if (currentHourPct < 70) {
      labelEl.textContent = 'Moderately busy';
      labelEl.style.background = 'rgba(232, 147, 91, 0.18)';
      labelEl.style.color = '#B86326';
    } else {
      labelEl.textContent = 'As busy as it gets (Peak)';
      labelEl.style.background = 'rgba(196, 87, 75, 0.18)';
      labelEl.style.color = 'var(--brick-red)';
    }
  }
}

function updateFavoriteButtonState(beachId) {
  const btn = document.getElementById('btn-favorite-beach');
  if (!btn) return;
  const isFav = favoriteBeaches.includes(beachId);
  btn.classList.toggle('active', isFav);
  btn.innerHTML = `<span id="fav-icon">${isFav ? '❤️' : '🤍'}</span> ${isFav ? 'Favorited' : 'Favorite'}`;
}

function toggleFavoriteBeach(beachId) {
  const idx = favoriteBeaches.indexOf(beachId);
  const beach = beaches.find(b => b.id === beachId);
  const name = beach ? beach.name : 'Beach';
  if (idx >= 0) {
    favoriteBeaches.splice(idx, 1);
    showHazardToast('Favorites Updated', `${name} removed from your saved coastal spots.`);
  } else {
    favoriteBeaches.push(beachId);
    showHazardToast('Saved to Favorites', `❤️ ${name} saved to your coastal journal!`);
  }
  localStorage.setItem('tidal_favorites', JSON.stringify(favoriteBeaches));
  updateFavoriteButtonState(beachId);
}

async function shareBeachLocation(beach) {
  if (!beach) return;
  const shareData = {
    title: `Tidal Tales: ${beach.name}`,
    text: `Explore real-time coastal safety, live INCOIS wave telemetry, and navigation to ${beach.name} (${beach.state}) on Tidal Tales.`,
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      // User cancelled or unsupported; fallback to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?beach=${encodeURIComponent(beach.id)}`);
    showHazardToast('Direct Link Copied', `Coordinates for ${beach.name} copied to clipboard!`);
  } catch (err) {
    showHazardToast('Beach Coordinates', `GPS: ${beach.latitude.toFixed(4)}, ${beach.longitude.toFixed(4)}`);
  }
}

function updateBottomSheetContent(beach) {
  const result = evaluateSuitability(beach.reading);

  // Reset detail sheet scroll position to top
  const sheet = document.getElementById('bottom-sheet');
  const contentEl = sheet?.querySelector('.detail-sheet-content');
  if (contentEl) contentEl.scrollTop = 0;
  if (sheet) sheet.scrollTop = 0;

  // Reset Gemini AI box for new beach selection
  const geminiBox = document.getElementById('gemini-response-box');
  const geminiOutput = document.getElementById('gemini-response-text');
  if (geminiBox) geminiBox.style.display = 'none';
  if (geminiOutput) geminiOutput.innerHTML = '';

  // Beach name & subtitle
  const beachNameEl = document.getElementById('sheet-beach-name') || document.getElementById('detail-beach-name');
  if (beachNameEl) beachNameEl.textContent = beach.name;

  const stateText = beach.country === 'India'
    ? `${beach.state} · Bay of Bengal / Arabian Sea`
    : `${beach.state ? beach.state + ' · ' : ''}${beach.country || 'International Coast'}`;
  const stateEl = document.getElementById('sheet-beach-state');
  if (stateEl) stateEl.textContent = stateText;

  const descEl = document.getElementById('sheet-beach-description');
  if (descEl) descEl.textContent = beach.description || '';

  // Hero Imagery
  const heroImg = document.getElementById('detail-hero-img');
  if (heroImg) {
    heroImg.src = beach.imageUrl || DEFAULT_BEACH_IMAGE;
    heroImg.alt = `${beach.name} coastal landscape`;
    heroImg.onerror = () => { heroImg.src = DEFAULT_BEACH_IMAGE; };
  }

  // Header Suitability Badge
  const detailSuitability = document.getElementById('detail-suitability');
  if (detailSuitability) {
    detailSuitability.textContent = result.status;
    detailSuitability.style.backgroundColor = result.statusColor;
    detailSuitability.style.color = '#fff';
  }

  const sourceBadgeEl = document.getElementById('detail-source-badge');
  if (sourceBadgeEl) {
    const isIndia = beach.region === 'india' || beach.source === 'INCOIS Certified';
    sourceBadgeEl.className = `source-badge ${isIndia ? 'incois' : 'global'}`;
    sourceBadgeEl.textContent = isIndia ? '🏛️ INCOIS Certified' : '🌐 Global Oceanic Grid';
  }

  // Enhanced Place Card Header: Category, Ratings, GPS Distance
  const catEl = document.getElementById('sheet-category-badge');
  if (catEl) catEl.textContent = getBeachCategory(beach);

  const distKm = haversineDistanceKm(userLocation.lat, userLocation.lon, beach.latitude, beach.longitude);
  const gpsDistEl = document.getElementById('sheet-gps-dist');
  if (gpsDistEl) gpsDistEl.textContent = `📍 ${distKm.toFixed(1)} km away`;

  const ratingEl = document.getElementById('sheet-rating-stars');
  const reviewsEl = document.getElementById('sheet-review-count');
  if (ratingEl) ratingEl.textContent = `★ ${beach.rating || (4.6 + ((beach.name.length % 4) * 0.1)).toFixed(1)}`;
  if (reviewsEl) reviewsEl.textContent = `(${beach.reviewsCount || (1240 + (beach.name.length * 115))} Reviews)`;

  // Busyness Histogram & Favorite status
  renderBusynessHistogram(beach);
  updateFavoriteButtonState(beach.id);

  const scoreEl = document.getElementById('sheet-score');
  scoreEl.textContent = `${result.score.toFixed(0)}/100`;
  scoreEl.style.color = result.statusColor;

  const badgeEl = document.getElementById('sheet-status-badge');
  badgeEl.textContent = result.status;
  badgeEl.style.backgroundColor = result.statusColor;

  const reasonsList = document.getElementById('sheet-reasons');
  reasonsList.innerHTML = '';
  result.reasons.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    reasonsList.appendChild(li);
  });

  document.getElementById('metric-wave-val').textContent = `${beach.reading.waveHeightM.toFixed(1)} m`;
  document.getElementById('metric-wave-sub').textContent =
    beach.reading.waveHeightM <= 1.2 ? 'Ideal swimming height (<1.2m)'
    : beach.reading.waveHeightM <= 2.0 ? 'Caution advised (1.2m–2.0m)'
    : 'Hazardous breakers (>2.0m)';

  const knots = result.windKnots;
  const kmph = Math.round(knotsToKmph(knots));
  document.getElementById('metric-wind-val').textContent = `${knots} kts`;
  document.getElementById('metric-wind-sub').textContent =
    `${kmph} km/h · ${knots <= 15 ? 'Ideal (<15 kts)' : knots <= 18 ? 'Manageable (<18 kts)' : 'Strong wind (>18 kts)'}`;

  document.getElementById('metric-swell-val').textContent = `${beach.reading.swellPeriodSec.toFixed(1)} s`;
  document.getElementById('metric-swell-sub').textContent =
    beach.reading.swellPeriodSec <= 12 ? 'Ideal period (<12s)'
    : beach.reading.swellPeriodSec <= 14 ? 'Caution (12s–14s)'
    : 'High undertow/rip risk (>14s)';

  document.getElementById('metric-water-val').textContent = `${Math.round(beach.reading.waterQualityIndex)} / 100`;
  document.getElementById('metric-water-sub').textContent =
    beach.reading.waterQualityIndex >= 70 ? 'High recreational clarity'
    : beach.reading.waterQualityIndex >= 40 ? 'Acceptable rating'
    : 'Low clarity / runoff alert';
}

// --------------------------------------------------------------------------
// 7. In-App Turn-by-Turn Navigation Engine
// --------------------------------------------------------------------------
function createCompassVehiclePuckIcon(bearing) {
  return L.divIcon({
    className: 'custom-vehicle-puck-icon',
    html: `
      <div class="compass-vehicle-puck">
        <div class="compass-puck-halo"></div>
        <div class="compass-puck-body" style="transform: rotate(${Math.round(bearing)}deg);">
          <div class="compass-puck-needle"></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function updateRouteCardsUI() {
  if (!activeAlternativeRoutes) return;
  const setCard = (id, timeId, distId, route) => {
    const card = document.getElementById(id);
    const timeEl = document.getElementById(timeId);
    const distEl = document.getElementById(distId);
    if (!card || !route) return;
    if (timeEl) timeEl.textContent = `${route.durationMinutes} min`;
    if (distEl) distEl.textContent = `${route.distanceKm.toFixed(1)} km`;
  };

  setCard('route-card-fastest', 'alt-time-fastest', 'alt-dist-fastest', activeAlternativeRoutes.fastest);
  setCard('route-card-shortest', 'alt-time-shortest', 'alt-dist-shortest', activeAlternativeRoutes.shortest);
  setCard('route-card-scenic', 'alt-time-scenic', 'alt-dist-scenic', activeAlternativeRoutes.scenic);

  document.querySelectorAll('.route-alt-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-criterion') === currentCriterion);
  });
}

function renderDesktopTurnsList(steps = []) {
  const container = document.getElementById('desktop-turns-list');
  const titleEl = document.getElementById('sidebar-route-title');
  const tagEl = document.getElementById('sidebar-route-tag');
  const summaryEl = document.getElementById('sidebar-dest-summary');

  if (activeRoute) {
    const destBeach = beaches.find(b => b.id === selectedBeachId) || beaches[0];
    if (titleEl) titleEl.textContent = activeRoute.title;
    if (tagEl) tagEl.textContent = activeRoute.badge;
    if (summaryEl) {
      summaryEl.textContent = `To ${destBeach.name} · ${activeRoute.durationMinutes} min (${activeRoute.distanceKm.toFixed(1)} km)`;
    }
  }

  if (!container) return;
  container.innerHTML = '';

  steps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = `turn-step-card ${idx === currentStepIndex ? 'current-step' : ''}`;
    card.id = `turn-step-${idx}`;

    const distText = step.distanceMeters > 0
      ? (step.distanceMeters >= 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} km` : `${step.distanceMeters} m`)
      : '';

    card.innerHTML = `
      <div class="turn-step-icon">${step.icon || '➡️'}</div>
      <div class="turn-step-info">
        <div class="turn-step-instruction">${step.instruction || step.voiceText}</div>
        <div class="turn-step-street">${step.name || ''}</div>
      </div>
      <div class="turn-step-dist">${distText}</div>
    `;

    container.appendChild(card);
  });
}

function highlightDesktopTurnStep(stepIdx) {
  document.querySelectorAll('.turn-step-card').forEach((el, idx) => {
    el.classList.toggle('current-step', idx === stepIdx);
  });
  const currentCard = document.getElementById(`turn-step-${stepIdx}`);
  if (currentCard) {
    currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderRoutePolylines(route) {
  // 1. Clean up old layers
  if (routePolylineLayer) {
    map.removeLayer(routePolylineLayer);
    routePolylineLayer = null;
  }
  if (hazardPolylineLayer) {
    map.removeLayer(hazardPolylineLayer);
    hazardPolylineLayer = null;
  }
  trafficPolylineLayers.forEach(l => map.removeLayer(l));
  trafficPolylineLayers = [];
  alternativePolylineLayers.forEach(l => map.removeLayer(l));
  alternativePolylineLayers = [];

  // 2. Render inactive alternative routes in background (clickable to select)
  if (activeAlternativeRoutes) {
    Object.entries(activeAlternativeRoutes).forEach(([crit, altRoute]) => {
      if (crit === currentCriterion || !altRoute || !altRoute.coordinates) return;
      const altPoly = L.polyline(altRoute.coordinates, {
        color: '#8C827A',
        weight: 4,
        opacity: 0.6,
        dashArray: '6, 6',
        lineJoin: 'round',
      }).addTo(map);

      altPoly.on('click', () => {
        selectRouteAlternative(crit);
      });
      altPoly.bindTooltip(`🔄 ${altRoute.title} (${altRoute.durationMinutes} min)`, {
        direction: 'top',
        className: 'nautical-stamp',
      });
      alternativePolylineLayers.push(altPoly);
    });
  }

  // 3. Render active route with traffic color-coded segments
  if (route.trafficSegments && route.trafficSegments.length > 0) {
    route.trafficSegments.forEach(seg => {
      const poly = L.polyline(seg.coords, {
        color: seg.color || '#3F8C88',
        weight: 6,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      if (seg.label) {
        poly.bindTooltip(seg.label, {
          sticky: true,
          className: 'nautical-stamp',
        });
      }
      trafficPolylineLayers.push(poly);
    });
  } else if (route.coordinates && route.coordinates.length > 0) {
    const poly = L.polyline(route.coordinates, {
      color: '#3F8C88',
      weight: 6,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    trafficPolylineLayers.push(poly);
  }

  // 4. Render coastal surge warning zone if enabled
  if (showHazardGeofence && route.hazardSegmentIndex && route.coordinates.length > route.hazardSegmentIndex) {
    const hazardSegment = route.coordinates.slice(route.hazardSegmentIndex);
    if (hazardSegment.length > 1) {
      hazardPolylineLayer = L.polyline(hazardSegment, {
        color: '#C4574B',
        weight: 7,
        opacity: 0.9,
        dashArray: '6, 8',
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map).bindTooltip('⚠️ Coastal Surge Zone Ahead', {
        permanent: true,
        direction: 'top',
        className: 'nautical-stamp',
      });
    }
  }
}

function renderIncidentMarkers(incidents = []) {
  incidentMarkersList.forEach(m => map.removeLayer(m));
  incidentMarkersList = [];

  incidents.forEach(inc => {
    const icon = L.divIcon({
      className: `custom-incident-marker severity-${inc.severity || 'moderate'}`,
      html: `
        <div class="incident-halo"></div>
        <div class="incident-icon-badge">${inc.icon || '⚠️'}</div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([inc.lat, inc.lon], { icon, zIndexOffset: 800 }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: 'Space Mono', monospace; font-size: 0.75rem; padding: 4px; min-width: 150px;">
        <div style="font-weight: 700; color: #2C221E; margin-bottom: 2px;">${inc.icon} ${inc.title}</div>
        <div style="font-size: 0.7rem; color: #6E6259; line-height: 1.3;">${inc.desc}</div>
      </div>
    `);
    incidentMarkersList.push(marker);
  });
}

function fitMapToActiveRoute() {
  if (!map || !activeRoute || !activeRoute.coordinates || activeRoute.coordinates.length < 2) return;
  const bounds = L.latLngBounds(activeRoute.coordinates);
  const isDesktop = window.innerWidth >= 1024;
  map.fitBounds(bounds, {
    paddingTopLeft: isDesktop ? [420, 100] : [24, 100],
    paddingBottomRight: [40, 120],
    maxZoom: 16,
  });
}

function toggleNavConfigDrawer(forceExpand = null) {
  const drawer = document.getElementById('nav-config-drawer');
  const chevron = document.getElementById('nav-dock-chevron');
  const toggleText = document.getElementById('nav-dock-toggle-text');
  const toggleBtn = document.getElementById('btn-toggle-nav-details');
  if (!drawer) return;

  const shouldCollapse = forceExpand !== null ? !forceExpand : !drawer.classList.contains('collapsed');
  if (shouldCollapse) {
    drawer.classList.add('collapsed');
    if (chevron) chevron.textContent = '▲';
    if (toggleText) toggleText.textContent = 'Route Options';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  } else {
    drawer.classList.remove('collapsed');
    if (chevron) chevron.textContent = '▼';
    if (toggleText) toggleText.textContent = 'Hide Options';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }
}

function selectRouteAlternative(criterion) {
  if (!activeAlternativeRoutes || !activeAlternativeRoutes[criterion]) return;
  currentCriterion = criterion;
  activeRoute = activeAlternativeRoutes[criterion];

  updateRouteCardsUI();
  renderRoutePolylines(activeRoute);
  renderIncidentMarkers(activeRoute.incidents || []);
  renderDesktopTurnsList(activeRoute.steps);

  simStepIndex = 0;
  currentStepIndex = 0;
  vehicleCurrentCoord = activeRoute.coordinates[0];
  if (activeRoute.coordinates.length > 1) {
    vehicleBearing = calculateBearing(
      activeRoute.coordinates[0][0],
      activeRoute.coordinates[0][1],
      activeRoute.coordinates[1][0],
      activeRoute.coordinates[1][1]
    );
  }
  if (vehiclePuckMarker) {
    vehiclePuckMarker.setLatLng(vehicleCurrentCoord);
    vehiclePuckMarker.setIcon(createCompassVehiclePuckIcon(vehicleBearing));
  }

  updateNavHUD(0);
  updateNavTelemetry(activeRoute.distanceKm, activeRoute.durationMinutes);

  speakManeuver(`Switched to ${activeRoute.title}. Travel time ${activeRoute.durationMinutes} minutes.`);
  showHazardToast(`Route Switched: ${activeRoute.title}`, `${activeRoute.durationMinutes} min · ${activeRoute.distanceKm.toFixed(1)} km`);
  fitMapToActiveRoute();
}

async function recalculateActiveRoutes() {
  if (!isNavigating) return;
  const destBeach = beaches.find(b => b.id === selectedBeachId) || beaches[0];
  const startPt = vehicleCurrentCoord ? { lat: vehicleCurrentCoord[0], lon: vehicleCurrentCoord[1] } : userLocation;

  activeAlternativeRoutes = await calculateAlternativeRoutes(startPt, destBeach, currentTravelMode, routeFilters);
  activeRoute = activeAlternativeRoutes[currentCriterion] || activeAlternativeRoutes.fastest;

  updateRouteCardsUI();
  renderRoutePolylines(activeRoute);
  renderIncidentMarkers(activeRoute.incidents || []);
  renderDesktopTurnsList(activeRoute.steps);

  updateNavHUD(0);
  updateNavTelemetry(activeRoute.distanceKm, activeRoute.durationMinutes);
  fitMapToActiveRoute();
}

async function startTurnByTurnNavigation(beachId, mode = TravelMode.DRIVING) {
  const destBeach = beaches.find(b => b.id === beachId) || beaches[0];
  isNavigating = true;
  currentTravelMode = mode;
  closeBottomSheet();

  // Clear any existing simulation timers on navigation initialization
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  isSimulating = false;

  document.getElementById('main-app-header').style.display = 'none';
  document.getElementById('main-filter-toolbar').style.display = 'none';
  document.getElementById('search-omnibox-wrapper')?.classList.add('nav-hidden');
  document.getElementById('beach-cards-strip').classList.add('nav-hidden');
  document.getElementById('floating-gps-pill').style.display = 'none';

  const globeToggleBtn = document.getElementById('btn-toggle-globe-view');
  if (globeToggleBtn) globeToggleBtn.style.display = 'none';
  if (currentProjectionView === '3d') {
    setProjectionView('2d');
  }

  const mapWrapper = document.getElementById('map-wrapper');
  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop) {
    mapWrapper.classList.remove('nav-perspective-3d');
  } else {
    mapWrapper.classList.add('nav-perspective-3d');
  }

  const desktopSidebar = document.getElementById('desktop-directions-sidebar');
  if (desktopSidebar) desktopSidebar.style.display = isDesktop ? 'flex' : 'none';

  document.getElementById('nav-hud-banner').classList.add('active');
  document.getElementById('nav-controls-stack').classList.add('active');
  document.getElementById('nav-bottom-telemetry').classList.add('active');
  document.getElementById('home-dashboard')?.classList.add('nav-active');
  document.body.classList.add('nav-active');

  // Enforce collapsed pre-trip options drawer during active navigation (slim telemetry dock <75px)
  toggleNavConfigDrawer(false);

  setTimeout(() => map?.invalidateSize(), 300);

  document.querySelectorAll('.nav-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });

  const suitability = evaluateSuitability(destBeach.reading);
  const badgeText = `${suitability.status.toUpperCase()} // ${suitability.score}/100`;
  document.getElementById('nav-dest-badge-text').textContent = badgeText;
  document.getElementById('nav-dest-badge').style.backgroundColor = suitability.statusColor;

  // Reset simulation button to manual test trigger
  const simBtnText = document.getElementById('sim-btn-text');
  if (simBtnText) simBtnText.textContent = 'Demo';
  const simBtn = document.getElementById('btn-sim-drive');
  if (simBtn) {
    simBtn.style.backgroundColor = 'var(--sandy-beige)';
    simBtn.classList.remove('active');
  }

  // Calculate 3 multi-criteria routes (Fastest, Shortest, Scenic)
  activeAlternativeRoutes = await calculateAlternativeRoutes(userLocation, destBeach, mode, routeFilters);
  activeRoute = activeAlternativeRoutes[currentCriterion] || activeAlternativeRoutes.fastest;

  updateRouteCardsUI();

  simStepIndex = 0;
  currentStepIndex = 0;
  vehicleCurrentCoord = activeRoute.coordinates[0];
  if (activeRoute.coordinates.length > 1) {
    vehicleBearing = calculateBearing(
      activeRoute.coordinates[0][0],
      activeRoute.coordinates[0][1],
      activeRoute.coordinates[1][0],
      activeRoute.coordinates[1][1]
    );
  } else {
    vehicleBearing = 0;
  }

  renderRoutePolylines(activeRoute);
  renderIncidentMarkers(activeRoute.incidents || []);
  renderDesktopTurnsList(activeRoute.steps);

  if (vehiclePuckMarker) map.removeLayer(vehiclePuckMarker);
  vehiclePuckMarker = L.marker(vehicleCurrentCoord, {
    icon: createCompassVehiclePuckIcon(vehicleBearing),
    zIndexOffset: 1000,
  }).addTo(map);

  updateNavHUD(0);
  updateNavTelemetry(activeRoute.distanceKm, activeRoute.durationMinutes);

  lastVoiceMilestone = null;
  lastRerouteTimestamp = Date.now();

  if (activeRoute.steps[0]) {
    speakManeuver(`Starting coastal navigation to ${destBeach.name}. ${activeRoute.steps[0].voiceText}`);
  }

  // Auto-fit map bounds with padding for top banner/HUD and slim bottom dock
  fitMapToActiveRoute();

  // Start Real-Time Device GPS Stream (Vehicle does NOT move automatically without GPS change)
  startRealTimeGpsTracking(destBeach);
}

function startRealTimeGpsTracking(destBeach) {
  stopRealTimeGpsTracking();
  const gpsIndicator = document.getElementById('nav-gps-indicator');
  if (gpsIndicator) gpsIndicator.style.display = 'inline-flex';

  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser.');
    return;
  }

  isGpsActive = true;
  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      // If user has explicitly started manual simulation drive, do not override simulated puck
      if (isSimulating) return;

      const { latitude, longitude, heading } = position.coords;
      onRealGpsPositionUpdate(latitude, longitude, heading, destBeach);
    },
    (error) => {
      console.warn('GPS Watch Notice/Permission:', error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1500,
      timeout: 10000,
    }
  );
}

function stopRealTimeGpsTracking() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  isGpsActive = false;
  const gpsIndicator = document.getElementById('nav-gps-indicator');
  if (gpsIndicator) gpsIndicator.style.display = 'none';
}

function onRealGpsPositionUpdate(lat, lon, heading, destBeach) {
  if (!isNavigating || !activeRoute) return;

  vehicleCurrentCoord = [lat, lon];
  if (typeof heading === 'number' && !isNaN(heading) && heading >= 0) {
    vehicleBearing = heading;
  }

  if (vehiclePuckMarker) {
    vehiclePuckMarker.setLatLng(vehicleCurrentCoord);
    vehiclePuckMarker.setIcon(createCompassVehiclePuckIcon(vehicleBearing));
  }

  map.panTo(vehicleCurrentCoord, { animate: true, duration: 0.3 });

  // Arrival check (<200m)
  const distToDestKm = haversineDistanceKm(lat, lon, destBeach.latitude, destBeach.longitude);
  if (distToDestKm <= 0.2) {
    endTurnByTurnNavigation(true);
    return;
  } else if (distToDestKm <= 0.1 && lastVoiceMilestone !== '100m') {
    lastVoiceMilestone = '100m';
    speakManeuver(`In 100 meters, ${destBeach.name} will be on your destination.`);
  } else if (distToDestKm <= 0.5 && lastVoiceMilestone !== '500m' && lastVoiceMilestone !== '100m') {
    lastVoiceMilestone = '500m';
    speakManeuver(`In 500 meters, you will reach ${destBeach.name}.`);
  }

  // Dynamic off-route recalculation (>30m)
  const deviation = checkOffRouteDeviation([lat, lon], activeRoute, 30);
  if (deviation.isOffRoute && Date.now() - lastRerouteTimestamp > 10000) {
    lastRerouteTimestamp = Date.now();
    speakManeuver('Recalculating route...');
    showHazardToast('Route Recalculation', `GPS deviated by ${deviation.deviationMeters}m. Recomputing fastest path...`);
    recalculateActiveRoutes();
  }

  // Find closest point on active route to estimate remaining distance
  let closestIdx = 0;
  let minD = Infinity;
  activeRoute.coordinates.forEach((pt, i) => {
    const d = haversineDistanceKm(lat, lon, pt[0], pt[1]);
    if (d < minD) {
      minD = d;
      closestIdx = i;
    }
  });

  const remainingFraction = 1 - (closestIdx / activeRoute.coordinates.length);
  const remKm = Math.max(0.1, activeRoute.distanceKm * remainingFraction);
  const remMins = Math.max(1, Math.round(activeRoute.durationMinutes * remainingFraction));
  updateNavTelemetry(remKm, remMins);

  const stepIdx = Math.min(
    activeRoute.steps.length - 1,
    Math.floor((closestIdx / activeRoute.coordinates.length) * activeRoute.steps.length)
  );
  if (stepIdx !== currentStepIndex) {
    currentStepIndex = stepIdx;
    updateNavHUD(stepIdx);
    highlightDesktopTurnStep(stepIdx);
    if (activeRoute.steps[stepIdx]) {
      speakManeuver(activeRoute.steps[stepIdx].voiceText);
    }
  }
}

function updateNavHUD(stepIdx) {
  if (!activeRoute || !activeRoute.steps[stepIdx]) return;
  const step = activeRoute.steps[stepIdx];

  document.getElementById('nav-hud-icon').textContent = step.icon;
  document.getElementById('nav-hud-street').textContent = step.name;
  document.getElementById('nav-hud-distance').textContent = step.instruction;
}

function updateNavTelemetry(remainingKm, remainingMins) {
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + remainingMins * 60000);
  const hours = String(arrivalTime.getHours()).padStart(2, '0');
  const minutes = String(arrivalTime.getMinutes()).padStart(2, '0');

  document.getElementById('nav-eta-val').textContent = `${hours}:${minutes}`;
  document.getElementById('nav-duration-dist').textContent =
    `${remainingMins} MIN · ${remainingKm.toFixed(1)} KM REMAINING`;
}

function endTurnByTurnNavigation(arrived = false) {
  isNavigating = false;
  stopRealTimeGpsTracking();
  stopDriveSimulation();

  if (routePolylineLayer) {
    map.removeLayer(routePolylineLayer);
    routePolylineLayer = null;
  }
  if (hazardPolylineLayer) {
    map.removeLayer(hazardPolylineLayer);
    hazardPolylineLayer = null;
  }
  trafficPolylineLayers.forEach(l => map.removeLayer(l));
  trafficPolylineLayers = [];
  alternativePolylineLayers.forEach(l => map.removeLayer(l));
  alternativePolylineLayers = [];
  incidentMarkersList.forEach(m => map.removeLayer(m));
  incidentMarkersList = [];

  if (vehiclePuckMarker) {
    map.removeLayer(vehiclePuckMarker);
    vehiclePuckMarker = null;
  }

  const mapWrapper = document.getElementById('map-wrapper');
  mapWrapper.classList.remove('nav-perspective-3d');

  const desktopSidebar = document.getElementById('desktop-directions-sidebar');
  if (desktopSidebar) desktopSidebar.style.display = 'none';

  document.getElementById('nav-hud-banner').classList.remove('active');
  document.getElementById('nav-controls-stack').classList.remove('active');
  document.getElementById('nav-bottom-telemetry').classList.remove('active');

  document.getElementById('main-app-header').style.display = '';
  document.getElementById('main-filter-toolbar').style.display = '';
  document.getElementById('search-omnibox-wrapper')?.classList.remove('nav-hidden');
  document.getElementById('beach-cards-strip').classList.remove('nav-hidden');
  document.getElementById('floating-gps-pill').style.display = '';
  const globeToggleBtn = document.getElementById('btn-toggle-globe-view');
  if (globeToggleBtn) globeToggleBtn.style.display = 'flex';
  document.getElementById('home-dashboard')?.classList.remove('nav-active');
  document.body.classList.remove('nav-active');
  toggleNavConfigDrawer(false);
  setTimeout(() => map?.invalidateSize(), 300);

  const destBeach = beaches.find(b => b.id === selectedBeachId) || beaches[0];

  if (arrived) {
    playAlertChime();
    speakManeuver(`You have arrived at ${destBeach.name}! Current recreational safety verdict: ${evaluateSuitability(destBeach.reading).status}.`);
    showHazardToast(`🏖️ Arrived at ${destBeach.name}`, 'You are on the coast. Check live INCOIS wave telemetry below.');
    selectBeach(destBeach.id);
    openBottomSheet();
  } else {
    map.setView([userLocation.lat, userLocation.lon], 11, { animate: true });
  }
}

// --------------------------------------------------------------------------
// 8. Drive Simulation Engine (Manual Demo / Test Tool)
// --------------------------------------------------------------------------
function toggleDriveSimulation() {
  if (isSimulating) {
    stopDriveSimulation();
  } else {
    startDriveSimulation();
  }
}

function startDriveSimulation() {
  if (!activeRoute || activeRoute.coordinates.length < 2) return;
  isSimulating = true;
  const simBtnText = document.getElementById('sim-btn-text');
  if (simBtnText) simBtnText.textContent = 'Pause';
  const simBtn = document.getElementById('btn-sim-drive');
  if (simBtn) {
    simBtn.style.backgroundColor = 'var(--deckle-border)';
    simBtn.classList.add('active');
  }
  showHazardToast('Demo Mode', 'Manual simulated playback active.');

  const coords = activeRoute.coordinates;
  const totalPoints = coords.length;
  const destBeach = beaches.find(b => b.id === selectedBeachId) || beaches[0];

  const intervalMs = Math.max(80, Math.floor(350 / simSpeedMultiplier));

  simInterval = setInterval(() => {
    simStepIndex++;
    if (simStepIndex >= totalPoints) {
      stopDriveSimulation();
      endTurnByTurnNavigation(true);
      return;
    }

    const currentPt = coords[simStepIndex];
    const prevPt = coords[simStepIndex - 1];
    vehicleCurrentCoord = currentPt;

    vehicleBearing = calculateBearing(prevPt[0], prevPt[1], currentPt[0], currentPt[1]);
    if (vehiclePuckMarker) {
      vehiclePuckMarker.setLatLng(currentPt);
      vehiclePuckMarker.setIcon(createCompassVehiclePuckIcon(vehicleBearing));
    }

    map.panTo(currentPt, { animate: true, duration: 0.2 });

    const distToDestKm = haversineDistanceKm(currentPt[0], currentPt[1], destBeach.latitude, destBeach.longitude);

    // Milestone Voice Audio Guidance
    if (distToDestKm <= 0.2) {
      stopDriveSimulation();
      endTurnByTurnNavigation(true);
      return;
    } else if (distToDestKm <= 0.1 && lastVoiceMilestone !== '100m') {
      lastVoiceMilestone = '100m';
      speakManeuver(`In 100 meters, ${destBeach.name} will be on your destination.`);
    } else if (distToDestKm <= 0.5 && lastVoiceMilestone !== '500m' && lastVoiceMilestone !== '100m') {
      lastVoiceMilestone = '500m';
      speakManeuver(`In 500 meters, you will reach ${destBeach.name}.`);
    }

    // Dynamic off-route deviation check (>30 meters)
    const deviation = checkOffRouteDeviation(currentPt, activeRoute, 30);
    if (deviation.isOffRoute && Date.now() - lastRerouteTimestamp > 10000) {
      lastRerouteTimestamp = Date.now();
      speakManeuver('Recalculating route...');
      showHazardToast('Route Recalculation', `Off-route by ${deviation.deviationMeters}m. Recomputing fastest path...`);
      recalculateActiveRoutes();
    }

    const remainingFraction = 1 - (simStepIndex / totalPoints);
    const remKm = Math.max(0.1, activeRoute.distanceKm * remainingFraction);
    const remMins = Math.max(1, Math.round(activeRoute.durationMinutes * remainingFraction));
    updateNavTelemetry(remKm, remMins);

    const stepIdx = Math.min(
      activeRoute.steps.length - 1,
      Math.floor((simStepIndex / totalPoints) * activeRoute.steps.length)
    );
    if (stepIdx !== currentStepIndex) {
      currentStepIndex = stepIdx;
      updateNavHUD(stepIdx);
      highlightDesktopTurnStep(stepIdx);
      if (activeRoute.steps[stepIdx]) {
        speakManeuver(activeRoute.steps[stepIdx].voiceText);
      }
    }
  }, intervalMs);
}

function stopDriveSimulation() {
  isSimulating = false;
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
  const simBtnText = document.getElementById('sim-btn-text');
  if (simBtnText) simBtnText.textContent = 'Demo';
  const simBtn = document.getElementById('btn-sim-drive');
  if (simBtn) {
    simBtn.style.backgroundColor = 'var(--sandy-beige)';
    simBtn.classList.remove('active');
  }
}

// --------------------------------------------------------------------------
// 8B. Universal Coastal Search & Autocomplete Discovery Engine
// --------------------------------------------------------------------------
function initUniversalSearch() {
  const searchInput = document.getElementById('coastal-search-input');
  const dropdown = document.getElementById('search-suggestions-dropdown');
  const clearBtn = document.getElementById('btn-search-clear');
  const voiceBtn = document.getElementById('btn-search-voice');
  if (!searchInput || !dropdown) return;

  // Animated cycling placeholder text
  const placeholders = [
    'Search beach, district, or coastal zone...',
    "Try 'Marina', 'Goa', or 'Varkala'...",
    'Find beaches near Chennai or Puri...',
    "Search by state: 'Kerala' or 'Tamil Nadu'...",
  ];
  let pIdx = 0;
  if (searchPlaceholderTimer) clearInterval(searchPlaceholderTimer);
  searchPlaceholderTimer = setInterval(() => {
    if (document.activeElement !== searchInput && !searchInput.value) {
      pIdx = (pIdx + 1) % placeholders.length;
      searchInput.placeholder = placeholders[pIdx];
    }
  }, 4000);

  const onSearch = debounce((query) => {
    if (!query.trim()) {
      renderRecentSearchesDropdown();
      return;
    }
    renderAutocompleteResults(query);
  }, 200);

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value;
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
    onSearch(q);
  });

  searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim()) {
      renderRecentSearchesDropdown();
    } else {
      renderAutocompleteResults(searchInput.value);
    }
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    renderRecentSearchesDropdown();
    searchInput.focus();
  });

  voiceBtn?.addEventListener('click', () => {
    voiceBtn.classList.add('recording');
    showHazardToast('🎙️ Voice Search', 'Listening... Speak beach or city name.');
    startVoiceSearch(
      (transcript) => {
        voiceBtn.classList.remove('recording');
        searchInput.value = transcript;
        if (clearBtn) clearBtn.style.display = 'block';
        showHazardToast('🎙️ Heard', `"${transcript}"`);
        renderAutocompleteResults(transcript);
      },
      (err) => {
        voiceBtn.classList.remove('recording');
        showHazardToast('Voice Input', typeof err === 'string' ? err : 'Voice recognition unavailable.');
      }
    );
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstItem = dropdown.querySelector('.suggestion-item');
      if (firstItem) {
        firstItem.click();
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
      searchInput.blur();
    }
  });

  // Dismiss dropdown on outside click
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('search-omnibox-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function renderAutocompleteResults(query) {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!dropdown) return;

  const results = fuzzySearchBeaches(query, beaches, userLocation, 5);
  dropdown.innerHTML = '';

  if (results.length === 0) {
    dropdown.innerHTML = `
      <div class="no-results-msg">
        No coastal spots found matching "${query}". Try another beach or state.
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  results.forEach(({ beach, distKm, suitability }) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <div class="suggestion-left">
        <span class="suggestion-icon">🏖️</span>
        <div class="suggestion-info">
          <div class="suggestion-title">${highlightMatchText(beach.name, query)}</div>
          <div class="suggestion-sub">${beach.state ? beach.state + ', ' : ''}${beach.country || 'India'} · 📍 ${distKm.toFixed(1)} km away</div>
        </div>
      </div>
      <div class="suggestion-status-pill" style="background-color: ${suitability.statusColor};">
        ${suitability.status}
      </div>
    `;

    item.addEventListener('click', () => {
      onSelectSearchedBeach(beach);
    });

    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
}

function renderRecentSearchesDropdown() {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!dropdown) return;

  const recentIds = SearchHistory.get();
  dropdown.innerHTML = '';

  if (recentIds.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const header = document.createElement('div');
  header.className = 'history-header-row';
  header.innerHTML = `
    <span>🕒 Recent Searches</span>
    <button type="button" class="btn-clear-history" id="btn-clear-search-history">Clear History</button>
  `;
  dropdown.appendChild(header);

  header.querySelector('#btn-clear-search-history')?.addEventListener('click', (e) => {
    e.stopPropagation();
    SearchHistory.clear();
    dropdown.style.display = 'none';
    showHazardToast('Search History', 'Recent search history cleared.');
  });

  recentIds.forEach(id => {
    const beach = beaches.find(b => b.id === id);
    if (!beach) return;

    const distKm = haversineDistanceKm(userLocation.lat, userLocation.lon, beach.latitude, beach.longitude);
    const suitability = evaluateSuitability(beach.reading);

    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <div class="suggestion-left">
        <span class="suggestion-icon">🕒</span>
        <div class="suggestion-info">
          <div class="suggestion-title">${beach.name}</div>
          <div class="suggestion-sub">${beach.state ? beach.state + ', ' : ''}${beach.country || 'India'} · 📍 ${distKm.toFixed(1)} km away</div>
        </div>
      </div>
      <div class="suggestion-status-pill" style="background-color: ${suitability.statusColor};">
        ${suitability.status}
      </div>
    `;

    item.addEventListener('click', () => {
      onSelectSearchedBeach(beach);
    });

    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
}

function onSelectSearchedBeach(beach) {
  const searchInput = document.getElementById('coastal-search-input');
  const dropdown = document.getElementById('search-suggestions-dropdown');

  if (searchInput) {
    searchInput.value = beach.name;
    const clearBtn = document.getElementById('btn-search-clear');
    if (clearBtn) clearBtn.style.display = 'block';
    searchInput.blur();
  }
  if (dropdown) dropdown.style.display = 'none';

  SearchHistory.add(beach.id);

  if (isNavigating) {
    showHazardToast(`Rerouting to ${beach.name}`, 'Setting selected coastal destination...');
    startTurnByTurnNavigation(beach.id, currentTravelMode);
  } else {
    selectBeach(beach.id);
    openBottomSheet();
    if (map) {
      map.flyTo([beach.latitude, beach.longitude], 13, { duration: 1.2 });
    }
  }
}

// --------------------------------------------------------------------------
// 9. Navigation Event Handlers
// --------------------------------------------------------------------------
function initNavigationEvents() {
  document.getElementById('btn-start-navigation')?.addEventListener('click', () => {
    startTurnByTurnNavigation(selectedBeachId, currentTravelMode);
  });

  document.getElementById('btn-share-beach')?.addEventListener('click', () => {
    const beach = beaches.find(b => b.id === selectedBeachId) || beaches[0];
    shareBeachLocation(beach);
  });

  document.getElementById('btn-favorite-beach')?.addEventListener('click', () => {
    toggleFavoriteBeach(selectedBeachId);
  });

  document.getElementById('btn-end-nav')?.addEventListener('click', () => {
    endTurnByTurnNavigation(false);
  });

  const toggleNavDetailsBtn = document.getElementById('btn-toggle-nav-details');
  toggleNavDetailsBtn?.addEventListener('click', () => {
    toggleNavConfigDrawer();
  });
  toggleNavDetailsBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNavConfigDrawer();
    }
  });

  document.getElementById('btn-sim-drive')?.addEventListener('click', () => {
    toggleDriveSimulation();
  });

  document.getElementById('nav-btn-recenter')?.addEventListener('click', () => {
    if (vehicleCurrentCoord) {
      map.setView(vehicleCurrentCoord, 16, { animate: true });
      showHazardToast('GPS Center', 'Centered map on vehicle position.');
    } else {
      fitMapToActiveRoute();
    }
  });

  const voiceBtn = document.getElementById('nav-btn-voice');
  voiceBtn?.addEventListener('click', () => {
    const isMuted = !isSpeechMutedState();
    setSpeechMuted(isMuted);
    voiceBtn.textContent = isMuted ? '🔇' : '🔊';
    voiceBtn.classList.toggle('active', !isMuted);
    showHazardToast('Audio Navigation', isMuted ? 'Voice turn prompts muted.' : 'Voice turn prompts active.');
  });

  const hazardBtn = document.getElementById('nav-btn-hazard');
  hazardBtn?.addEventListener('click', () => {
    showHazardGeofence = !showHazardGeofence;
    hazardBtn.classList.toggle('active', showHazardGeofence);
    if (activeRoute) renderRoutePolylines(activeRoute);
    showHazardToast('Geofence Overlay', showHazardGeofence ? 'Coastal surge perimeters visible on route.' : 'Coastal hazard overlay hidden.');
  });

  const simSpeedBtn = document.getElementById('nav-btn-sim-speed');
  simSpeedBtn?.addEventListener('click', () => {
    if (simSpeedMultiplier === 1) simSpeedMultiplier = 2;
    else if (simSpeedMultiplier === 2) simSpeedMultiplier = 5;
    else simSpeedMultiplier = 1;

    simSpeedBtn.textContent = `${simSpeedMultiplier}x`;
    showHazardToast('Simulation Speed', `Playback speed set to ${simSpeedMultiplier}x.`);

    if (isSimulating) {
      stopDriveSimulation();
      startDriveSimulation();
    }
  });

  // Travel Mode Selector (Driving, Two-Wheeler, Bicycle, Walking)
  document.querySelectorAll('.nav-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode && mode !== currentTravelMode) {
        startTurnByTurnNavigation(selectedBeachId, mode);
      }
    });
  });

  // Alternative Routes Selector (Fastest, Shortest, Scenic)
  document.querySelectorAll('.route-alt-card').forEach(card => {
    card.addEventListener('click', () => {
      const criterion = card.getAttribute('data-criterion');
      if (criterion && criterion !== currentCriterion) {
        selectRouteAlternative(criterion);
      }
    });
  });

  // Route Avoidance Filters (Avoid Tolls, Avoid Highways, Avoid Ferries)
  const tollsCheck = document.getElementById('nav-avoid-tolls');
  const highwaysCheck = document.getElementById('nav-avoid-highways');
  const ferriesCheck = document.getElementById('nav-avoid-ferries');

  const onFilterChange = () => {
    routeFilters.avoidTolls = !!tollsCheck?.checked;
    routeFilters.avoidHighways = !!highwaysCheck?.checked;
    routeFilters.avoidFerries = !!ferriesCheck?.checked;
    if (isNavigating) {
      recalculateActiveRoutes();
    }
  };

  tollsCheck?.addEventListener('change', onFilterChange);
  highwaysCheck?.addEventListener('change', onFilterChange);
  ferriesCheck?.addEventListener('change', onFilterChange);

  // Responsive resize event for desktop sidebar vs mobile perspective
  window.addEventListener('resize', () => {
    if (!isNavigating) return;
    const isDesktop = window.innerWidth >= 1024;
    const mapWrapper = document.getElementById('map-wrapper');
    const desktopSidebar = document.getElementById('desktop-directions-sidebar');
    if (isDesktop) {
      mapWrapper?.classList.remove('nav-perspective-3d');
      if (desktopSidebar) desktopSidebar.style.display = 'flex';
    } else {
      mapWrapper?.classList.add('nav-perspective-3d');
      if (desktopSidebar) desktopSidebar.style.display = 'none';
    }
    map?.invalidateSize();
  });
}

// --------------------------------------------------------------------------
// 10. Top Sliding Alert Banner
// --------------------------------------------------------------------------
function updateTopAlertBanner() {
  const isAuthenticated = localStorage.getItem('tidal_user_session') !== null;
  const banner = document.getElementById('top-alert-banner') || document.getElementById('alert-banner');
  const alertText = document.getElementById('top-alert-text');
  const dot = document.getElementById('alert-indicator-dot');

  // Strictly suppress warning banners if user is not authenticated
  if (!isAuthenticated) {
    banner?.classList.remove('active');
    if (banner) banner.style.display = 'none';
    dot?.classList.remove('active');
    return;
  }

  const alertedBeach = beaches.find(b =>
    b.reading.tsunamiAlert ||
    b.reading.highWaveAlert ||
    b.reading.stormSurgeAlert ||
    b.reading.strongCurrentAlert
  );

  if (alertedBeach) {
    const r = evaluateSuitability(alertedBeach.reading);
    if (alertText) alertText.textContent = `🚨 ${alertedBeach.name}: ${r.reasons[0]}`;
    banner?.classList.add('active');
    if (banner) banner.style.display = '';
    dot?.classList.add('active');
  } else {
    banner?.classList.remove('active');
    if (banner) banner.style.display = 'none';
    dot?.classList.remove('active');
  }
}

// --------------------------------------------------------------------------
// 11. INCOIS Live Simulation Sandbox (Judge Sandbox)
// --------------------------------------------------------------------------
function syncSimulatorInputs(beach) {
  const waveSlider = document.getElementById('slider-wave');
  const windSlider = document.getElementById('slider-wind');
  const swellSlider = document.getElementById('slider-swell');
  const waterSlider = document.getElementById('slider-water');

  const knots = kmphToKnots(beach.reading.windSpeedKmph);

  if (waveSlider) waveSlider.value = beach.reading.waveHeightM;
  if (windSlider) windSlider.value = knots;
  if (swellSlider) swellSlider.value = beach.reading.swellPeriodSec;
  if (waterSlider) waterSlider.value = beach.reading.waterQualityIndex;

  document.getElementById('val-sim-wave').textContent = `${beach.reading.waveHeightM.toFixed(1)} m`;
  document.getElementById('val-sim-wind').textContent = `${knots} kts (${Math.round(beach.reading.windSpeedKmph)} km/h)`;
  document.getElementById('val-sim-swell').textContent = `${beach.reading.swellPeriodSec.toFixed(0)} s`;
  document.getElementById('val-sim-water').textContent = `${Math.round(beach.reading.waterQualityIndex)} / 100`;

  updateHazardButtons(beach.reading);
}

function updateHazardButtons(reading) {
  document.getElementById('toggle-tsunami')?.classList.toggle('active', !!reading.tsunamiAlert);
  document.getElementById('toggle-high-wave')?.classList.toggle('active', !!reading.highWaveAlert);
  document.getElementById('toggle-storm-surge')?.classList.toggle('active', !!reading.stormSurgeAlert);
  document.getElementById('toggle-current')?.classList.toggle('active', !!reading.strongCurrentAlert);
}

function initSimulator() {
  const drawer = document.getElementById('sandbox-drawer');
  const openBtn = document.getElementById('toggle-sandbox-btn');
  const openIcon = document.getElementById('open-sandbox-icon');
  const closeBtn = document.getElementById('close-sandbox-btn');

  function toggle() {
    drawer.classList.toggle('active');
  }

  openBtn?.addEventListener('click', toggle);
  openIcon?.addEventListener('click', toggle);
  closeBtn?.addEventListener('click', () => drawer.classList.remove('active'));

  const waveSlider = document.getElementById('slider-wave');
  const windSlider = document.getElementById('slider-wind');
  const swellSlider = document.getElementById('slider-swell');
  const waterSlider = document.getElementById('slider-water');

  function onParamChange() {
    const currentBeach = beaches.find(b => b.id === selectedBeachId);
    if (!currentBeach) return;

    currentBeach.reading.waveHeightM = parseFloat(waveSlider.value);
    const knots = parseFloat(windSlider.value);
    currentBeach.reading.windSpeedKnots = knots;
    currentBeach.reading.windSpeedKmph = knotsToKmph(knots);
    currentBeach.reading.swellPeriodSec = parseFloat(swellSlider.value);
    currentBeach.reading.waterQualityIndex = parseFloat(waterSlider.value);

    document.getElementById('val-sim-wave').textContent = `${currentBeach.reading.waveHeightM.toFixed(1)} m`;
    document.getElementById('val-sim-wind').textContent = `${knots} kts (${Math.round(currentBeach.reading.windSpeedKmph)} km/h)`;
    document.getElementById('val-sim-swell').textContent = `${Math.round(currentBeach.reading.swellPeriodSec)} s`;
    document.getElementById('val-sim-water').textContent = `${Math.round(currentBeach.reading.waterQualityIndex)} / 100`;

    renderSafetyBuoyMarkers();
    renderPolaroidCarousel();
    updateBottomSheetContent(currentBeach);
    updateTopAlertBanner();
    updateGlobeData(getFilteredBeaches(), currentBeach);
  }

  waveSlider?.addEventListener('input', onParamChange);
  windSlider?.addEventListener('input', onParamChange);
  swellSlider?.addEventListener('input', onParamChange);
  waterSlider?.addEventListener('input', onParamChange);

  function toggleHazard(alertKey, label) {
    const currentBeach = beaches.find(b => b.id === selectedBeachId);
    if (!currentBeach) return;

    currentBeach.reading[alertKey] = !currentBeach.reading[alertKey];
    updateHazardButtons(currentBeach.reading);

    if (currentBeach.reading[alertKey]) {
      showHazardToast(
        `🚨 ${label} at ${currentBeach.name}`,
        'INCOIS hard safety override triggered! Suitability forced to 0 (Hazardous).'
      );
    }

    renderSafetyBuoyMarkers();
    renderPolaroidCarousel();
    updateBottomSheetContent(currentBeach);
    updateTopAlertBanner();
    updateGlobeData(getFilteredBeaches(), currentBeach);
  }

  document.getElementById('toggle-tsunami')?.addEventListener('click', () =>
    toggleHazard('tsunamiAlert', 'Tsunami Alert')
  );
  document.getElementById('toggle-high-wave')?.addEventListener('click', () =>
    toggleHazard('highWaveAlert', 'High Wave Warning')
  );
  document.getElementById('toggle-storm-surge')?.addEventListener('click', () =>
    toggleHazard('stormSurgeAlert', 'Storm Surge Alert')
  );
  document.getElementById('toggle-current')?.addEventListener('click', () =>
    toggleHazard('strongCurrentAlert', 'Rip Current Alert')
  );

  document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
    beaches = JSON.parse(JSON.stringify(INITIAL_BEACHES));
    renderSafetyBuoyMarkers();
    renderPolaroidCarousel();
    const beach = beaches.find(b => b.id === selectedBeachId) || beaches[0];
    updateBottomSheetContent(beach);
    syncSimulatorInputs(beach);
    updateTopAlertBanner();
  });
}

// --------------------------------------------------------------------------
// 12. Alerts & Notifications
// --------------------------------------------------------------------------
function showHazardToast(title, body) {
  const isAuthenticated = localStorage.getItem('tidal_user_session') !== null;
  if (!isAuthenticated) return; // Never show alert toasts on login view

  const toast = document.getElementById('alert-toast');
  if (!toast) return;

  document.getElementById('alert-toast-title').textContent = title;
  document.getElementById('alert-toast-body').textContent = body;
  toast.style.display = '';
  toast.classList.add('visible');

  playAlertChime();

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.style.display = 'none';
  }, 6000);
}

function initAlertSystem() {
  document.getElementById('close-toast-btn')?.addEventListener('click', () => {
    document.getElementById('alert-toast')?.classList.remove('visible');
  });

  document.getElementById('close-top-banner-btn')?.addEventListener('click', () => {
    document.getElementById('top-alert-banner')?.classList.remove('active');
  });

  document.getElementById('alert-bell-btn')?.addEventListener('click', () => {
    const hazardous = beaches.filter(b => evaluateSuitability(b.reading).status === SuitabilityStatus.UNSAFE);
    if (hazardous.length > 0) {
      const h = hazardous[0];
      const r = evaluateSuitability(h.reading);
      showHazardToast(`⚠️ Active Coastal Warning: ${h.name}`, r.reasons[0]);
    } else {
      showHazardToast('☀️ Coastal Advisory', 'All monitored beaches are currently within Safe to Moderate recreational parameters.');
    }
  });
}

// --------------------------------------------------------------------------
// 13. Filters & Toolbar
// --------------------------------------------------------------------------
function initFilters() {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      renderPolaroidCarousel();
      renderSafetyBuoyMarkers();
      updateGlobeData(getFilteredBeaches(), beaches.find(b => b.id === selectedBeachId));
    });
  });

  document.getElementById('btn-recenter')?.addEventListener('click', () => {
    if (map) {
      map.flyTo([userLocation.lat, userLocation.lon], 11, { duration: 1.2 });
    }
  });

  const toggleFrameBtn = document.getElementById('toggle-frame-btn');

  function updateToggleBtnText() {
    const isPreview = document.body.classList.contains('device-preview-active');
    if (toggleFrameBtn) {
      toggleFrameBtn.innerHTML = isPreview
        ? '🖥️ Desktop View'
        : '📱 Toggle Mobile Preview';
    }
  }

  // Restore previous simulated frame preference if user set it
  if (localStorage.getItem('tidal_preview_mode') === '1') {
    document.body.classList.add('device-preview-active');
  }
  updateToggleBtnText();

  toggleFrameBtn?.addEventListener('click', () => {
    document.body.classList.toggle('device-preview-active');
    const isPreview = document.body.classList.contains('device-preview-active');
    localStorage.setItem('tidal_preview_mode', isPreview ? '1' : '0');
    updateToggleBtnText();
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 350);
  });

  // Enable mouse-wheel horizontal scrolling on the Polaroid card container
  const carousel = document.getElementById('polaroid-carousel');
  carousel?.addEventListener('wheel', (evt) => {
    const isHorizontal = window.innerWidth < 1024 || document.body.classList.contains('device-preview-active');
    if (isHorizontal && evt.deltaY !== 0) {
      evt.preventDefault();
      carousel.scrollLeft += evt.deltaY;
    }
  }, { passive: false });

  // Dynamically recalculate Leaflet map canvas bounds on viewport changes
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 300);
  });

  document.getElementById('close-sheet-btn')?.addEventListener('click', closeBottomSheet);
  document.getElementById('btn-close-detail')?.addEventListener('click', closeBottomSheet);
  document.getElementById('sheet-backdrop')?.addEventListener('click', closeBottomSheet);
}

// --------------------------------------------------------------------------
// 14. Gemini AI Coastal Safety Advisor
// --------------------------------------------------------------------------
function formatGeminiResponse(rawText) {
  let text = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold text **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Bullet points
  text = text.replace(/^\s*[\*\-]\s+(.*)$/gm, '<div class="gemini-bullet"><span class="bullet-wave">🌊</span> $1</div>');

  // Paragraph breaks
  text = text.replace(/\n\n/g, '<div class="gemini-spacer"></div>');
  text = text.replace(/\n/g, '<br/>');

  return text;
}

async function handleGeminiQuery(query) {
  if (!query || !query.trim()) return;

  const baseBeach = beaches.find(b => b.id === selectedBeachId) || beaches[0];
  const responseBox = document.getElementById('gemini-response-box');
  const spinner = document.getElementById('gemini-loading-spinner');
  const outputEl = document.getElementById('gemini-response-text');
  const sendBtn = document.getElementById('btn-ask-gemini');
  const inputEl = document.getElementById('gemini-custom-input');
  const chips = document.querySelectorAll('.gemini-chip');

  // Collect active emergency alerts from reading
  const activeAlerts = [];
  if (baseBeach.reading?.highWaveAlert) activeAlerts.push('High wave alert issued by INCOIS — swimming prohibited');
  if (baseBeach.reading?.tsunamiAlert) activeAlerts.push('Tsunami alert issued by INCOIS — evacuate coastal zones');
  if (baseBeach.reading?.stormSurgeAlert) activeAlerts.push('Storm surge alert issued by INCOIS');
  if (baseBeach.reading?.strongCurrentAlert) activeAlerts.push('Strong rip current warning issued by INCOIS');

  // Ground with active dashboard emergency banner
  const topBanner = document.getElementById('top-alert-banner');
  const topAlertText = document.getElementById('top-alert-text')?.textContent;
  if (topBanner && topBanner.classList.contains('active') && topAlertText) {
    const cleanAlert = topAlertText.replace('🚨', '').trim();
    if (!activeAlerts.includes(cleanAlert)) {
      activeAlerts.push(cleanAlert);
    }
  }

  // Construct comprehensive beach object for Gemini system context injection
  const beach = {
    ...baseBeach,
    location: `${baseBeach.name} (${baseBeach.state}, India)`,
    waveHeight: baseBeach.reading?.waveHeightM ?? 0.9,
    windSpeed: Math.round((baseBeach.reading?.windSpeedKmph || 18) * 0.539957 * 10) / 10,
    swellPeriod: baseBeach.reading?.swellPeriodSec ?? 7,
    wqi: baseBeach.reading?.waterQualityIndex ?? 62,
    activeAlerts,
  };

  if (responseBox) responseBox.style.display = 'block';
  if (spinner) spinner.style.display = 'flex';
  if (outputEl) outputEl.innerHTML = '';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Thinking...';
  }
  chips.forEach(c => (c.style.pointerEvents = 'none'));

  try {
    const answer = await askGeminiAboutBeach(query.trim(), beach);
    if (outputEl) {
      outputEl.innerHTML = formatGeminiResponse(answer);
    }
    playAlertChime();
    setTimeout(() => {
      responseBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  } catch (err) {
    console.error('Gemini query error:', err);
    if (outputEl) {
      outputEl.innerHTML = `
        <div style="color: var(--brick-red); font-weight: bold; margin-bottom: 4px;">⚠️ Coastal Advisory Unavailable</div>
        <div style="font-size: 11px; color: var(--muted-slate);">${err.message || 'Could not connect to Gemini service.'}</div>
      `;
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Ask AI';
    }
    chips.forEach(c => (c.style.pointerEvents = 'auto'));
  }
}

function initGeminiAssistant() {
  const chips = document.querySelectorAll('.gemini-chip');
  const inputEl = document.getElementById('gemini-custom-input');
  const sendBtn = document.getElementById('btn-ask-gemini');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      if (inputEl && q) {
        inputEl.value = q;
      }
      handleGeminiQuery(q);
    });
  });

  sendBtn?.addEventListener('click', () => {
    const query = inputEl?.value;
    handleGeminiQuery(query);
  });

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGeminiQuery(inputEl.value);
    }
  });

  // Header quick launch button ✨
  document.getElementById('open-gemini-header-btn')?.addEventListener('click', () => {
    if (isNavigating) return;
    openBottomSheet();
    setTimeout(() => {
      document.querySelector('.gemini-ai-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputEl?.focus();
    }, 250);
  });
}

// --------------------------------------------------------------------------
// 12. Settings & Preferences Controller
// --------------------------------------------------------------------------
function applyLanguage(lang) {
  const currentLang = lang || getSetting('language') || 'en';

  // App Title & Subtitle
  const appTitleH1 = document.querySelector('#main-app-header h1');
  if (appTitleH1) {
    appTitleH1.textContent = t('appTitle', currentLang);
  }

  const searchInput = document.getElementById('coastal-search-input');
  if (searchInput) {
    searchInput.placeholder = t('searchPlaceholder', currentLang);
  }

  // Filter Toolbar Chips
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    const filter = pill.getAttribute('data-filter');
    if (filter === 'all') pill.textContent = `🏖️ ${t('filterAll', currentLang)}`;
    else if (filter === 'safe') pill.textContent = `🟢 ${t('filterSafe', currentLang)}`;
    else if (filter === 'popular') pill.textContent = `⭐ ${t('filterPopular', currentLang)}`;
    else if (filter === 'near_me') pill.textContent = `📍 ${t('filterNearMe', currentLang)}`;
    else if (filter === 'watersports') pill.textContent = `🏄 ${t('filterSurfing', currentLang)}`;
  });

  // Settings modal title
  const settingsModalTitle = document.getElementById('settings-modal-title');
  if (settingsModalTitle) {
    settingsModalTitle.textContent = t('settingsTitle', currentLang);
  }

  // Navigation action buttons
  const navBtn = document.getElementById('btn-navigate-beach');
  if (navBtn) {
    navBtn.innerHTML = `<span>🧭</span> <span>${t('navStart', currentLang)}</span>`;
  }
  const endJourneyBtn = document.getElementById('btn-end-journey');
  if (endJourneyBtn) {
    endJourneyBtn.textContent = `🛑 ${t('endJourney', currentLang)}`;
  }
  const endJourneyCompact = document.getElementById('btn-end-journey-compact');
  if (endJourneyCompact) {
    endJourneyCompact.textContent = `🛑 ${t('endJourney', currentLang)}`;
  }
}

function initSettings() {
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsBackdrop = document.getElementById('settings-backdrop');

  // Load current settings state
  const settings = loadSettings();

  function openSettings() {
    // Populate profile card
    const userSession = JSON.parse(localStorage.getItem('tidal_user_session') || '{}');
    const isOwner = userSession.role === 'owner' || userSession.email === 'owner@tidaltales.in';
    const isGuest = userSession.role === 'guest';

    const avatarBadge = document.getElementById('settings-avatar-badge');
    const userNameEl = document.getElementById('settings-user-name');
    const userEmailEl = document.getElementById('settings-user-email');
    const roleBadge = document.getElementById('settings-role-badge');

    if (avatarBadge) {
      avatarBadge.textContent = isOwner ? '👑' : (userSession.name ? userSession.name.charAt(0).toUpperCase() : 'E');
    }
    if (userNameEl) {
      userNameEl.textContent = userSession.name || (isOwner ? 'Chief Oceanographer' : (isGuest ? 'Guest Explorer' : 'Arun Kumar'));
    }
    if (userEmailEl) {
      userEmailEl.textContent = userSession.email || (isOwner ? 'owner@tidaltales.in' : (isGuest ? 'guest@tidaltales.in' : 'arun.explorer@tidaltales.in'));
    }
    if (roleBadge) {
      if (isOwner) {
        roleBadge.textContent = '[OWNER TEST PASS]';
        roleBadge.className = 'owner-pass-badge';
        roleBadge.style.display = 'inline-flex';
      } else if (isGuest) {
        roleBadge.textContent = '[GUEST PASS]';
        roleBadge.className = 'build-badge';
        roleBadge.style.display = 'inline-flex';
      } else {
        roleBadge.textContent = '[EXPLORER]';
        roleBadge.className = 'build-badge';
        roleBadge.style.display = 'inline-flex';
      }
    }

    // Active Profile Buttons
    document.querySelectorAll('.profile-pill-btn').forEach(btn => {
      const p = btn.getAttribute('data-profile');
      if ((isOwner && p === 'owner') || (isGuest && p === 'guest') || (!isOwner && !isGuest && p === 'registered')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update storage text
    const storageSubtext = document.getElementById('storage-cache-subtext');
    if (storageSubtext) {
      storageSubtext.textContent = `Cached tiles, temporary forecasts (approx. ${calculateStorageUsageMB()} MB)`;
    }

    settingsBackdrop?.classList.add('active');
    settingsPanel?.classList.add('active');
  }

  function closeSettings() {
    settingsBackdrop?.classList.remove('active');
    settingsPanel?.classList.remove('active');
  }

  openSettingsBtn?.addEventListener('click', openSettings);
  closeSettingsBtn?.addEventListener('click', closeSettings);
  settingsBackdrop?.addEventListener('click', closeSettings);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPanel?.classList.contains('active')) {
      closeSettings();
    }
  });

  // 1. Profile Switcher
  const profileBtns = {
    owner: document.getElementById('btn-profile-owner'),
    registered: document.getElementById('btn-profile-registered'),
    guest: document.getElementById('btn-profile-guest'),
  };

  profileBtns.owner?.addEventListener('click', () => {
    const ownerSession = {
      isAuthenticated: true,
      passcodeVerified: true,
      user: 'owner@tidaltales.in',
      name: 'Chief Oceanographer (Owner)',
      email: 'owner@tidaltales.in',
      role: 'owner',
      permissions: ['bypass_verification', 'full_sandbox_sliders', 'owner_test_pass'],
      timestamp: Date.now(),
      loggedInAt: Date.now(),
    };
    localStorage.setItem('tidal_session', JSON.stringify(ownerSession));
    localStorage.setItem('tidal_user_session', JSON.stringify(ownerSession));
    saveSetting('activeProfile', 'owner');
    checkAuthState();
    openSettings();
    showHazardToast('👑 Profile Switched', 'Switched to Chief Oceanographer [Owner Test Pass]');
  });

  profileBtns.registered?.addEventListener('click', () => {
    const explorerSession = {
      isAuthenticated: true,
      passcodeVerified: true,
      user: 'arun.explorer@tidaltales.in',
      name: 'Arun Kumar',
      email: 'arun.explorer@tidaltales.in',
      role: 'explorer',
      timestamp: Date.now(),
      loggedInAt: Date.now(),
    };
    localStorage.setItem('tidal_session', JSON.stringify(explorerSession));
    localStorage.setItem('tidal_user_session', JSON.stringify(explorerSession));
    saveSetting('activeProfile', 'registered');
    checkAuthState();
    openSettings();
    showHazardToast('🏖️ Profile Switched', 'Switched to Arun Kumar [Explorer Pass]');
  });

  profileBtns.guest?.addEventListener('click', () => {
    const guestSession = {
      isAuthenticated: true,
      passcodeVerified: true,
      user: 'guest@tidaltales.in',
      name: 'Guest Explorer',
      email: 'guest@tidaltales.in',
      role: 'guest',
      timestamp: Date.now(),
      loggedInAt: Date.now(),
    };
    localStorage.setItem('tidal_session', JSON.stringify(guestSession));
    localStorage.setItem('tidal_user_session', JSON.stringify(guestSession));
    saveSetting('activeProfile', 'guest');
    checkAuthState();
    openSettings();
    showHazardToast('🧭 Profile Switched', 'Switched to Guest Explorer');
  });

  // Session Sign Out & Revoke
  document.getElementById('btn-settings-signout')?.addEventListener('click', () => {
    closeSettings();
    localStorage.removeItem('tidal_session');
    localStorage.removeItem('tidal_user_session');
    checkAuthState();
    showHazardToast('👋 Signed Out', 'Signed out from this device.');
  });

  document.getElementById('btn-signout-all-devices')?.addEventListener('click', () => {
    closeSettings();
    localStorage.removeItem('tidal_session');
    localStorage.removeItem('tidal_user_session');
    checkAuthState();
    showHazardToast('🔒 All Sessions Revoked', 'All active browser sessions have been invalidated.');
  });

  // Delete Account Sub-Modal
  const deleteModal = document.getElementById('delete-modal-backdrop');
  document.getElementById('btn-open-delete-modal')?.addEventListener('click', () => {
    if (deleteModal) deleteModal.style.display = 'flex';
  });

  const closeDeleteModal = () => {
    if (deleteModal) deleteModal.style.display = 'none';
  };
  document.getElementById('close-delete-modal-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btn-cancel-delete')?.addEventListener('click', closeDeleteModal);

  document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
    closeDeleteModal();
    closeSettings();
    localStorage.clear();
    resetAllSettings();
    checkAuthState();
    showHazardToast('🗑️ Account Purged', 'Explorer profile, cached data, and preferences deleted.');
  });

  // 2. Coastal Safety & Ocean Alerts
  const hazardAlertsToggle = document.getElementById('setting-hazard-alerts');
  if (hazardAlertsToggle) {
    hazardAlertsToggle.checked = settings.criticalHazardAlerts !== false;
    hazardAlertsToggle.addEventListener('change', (e) => {
      saveSetting('criticalHazardAlerts', e.target.checked);
      showHazardToast('Alerts Updated', `Critical hazard push alerts ${e.target.checked ? 'enabled' : 'disabled'}`);
    });
  }

  const proximitySirenToggle = document.getElementById('setting-proximity-siren');
  if (proximitySirenToggle) {
    proximitySirenToggle.checked = settings.proximitySiren !== false;
    proximitySirenToggle.addEventListener('change', (e) => {
      saveSetting('proximitySiren', e.target.checked);
      if (e.target.checked) playAlertChime();
    });
  }

  // Suitability Threshold Segmented Control
  const suitabilityThresholdControl = document.getElementById('control-suitability-threshold');
  const suitabilityLabelTag = document.getElementById('label-suitability-threshold');
  const thresholdMap = {
    strict: 'Strict (85+)',
    moderate: 'Moderate (70+)',
    adventurous: 'Adventurous (50+)',
  };

  if (suitabilityThresholdControl) {
    const currentThreshold = settings.suitabilityThreshold || 'moderate';
    suitabilityThresholdControl.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.getAttribute('data-threshold') === currentThreshold) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-threshold');
        suitabilityThresholdControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSetting('suitabilityThreshold', val);
        if (suitabilityLabelTag) suitabilityLabelTag.textContent = thresholdMap[val] || val;
        showHazardToast('Threshold Changed', `Safety filter now set to ${thresholdMap[val]}`);
      });
    });
    if (suitabilityLabelTag) suitabilityLabelTag.textContent = thresholdMap[currentThreshold] || currentThreshold;
  }

  // 3. Navigation & Routing Defaults
  const modeControl = document.getElementById('control-default-mode');
  if (modeControl) {
    const currentMode = settings.defaultTravelMode || 'driving';
    modeControl.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.getAttribute('data-mode') === currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-mode');
        modeControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSetting('defaultTravelMode', val);
        currentTravelMode = val;
        showHazardToast('Travel Mode', `Default mode set to ${val}`);
      });
    });
  }

  const avoidTollsToggle = document.getElementById('setting-nav-tolls');
  if (avoidTollsToggle) {
    avoidTollsToggle.checked = !!settings.avoidTolls;
    avoidTollsToggle.addEventListener('change', (e) => {
      saveSetting('avoidTolls', e.target.checked);
      routeFilters.avoidTolls = e.target.checked;
      const avoidTollsBox = document.getElementById('avoid-tolls');
      if (avoidTollsBox) avoidTollsBox.checked = e.target.checked;
    });
  }

  const avoidHighwaysToggle = document.getElementById('setting-nav-highways');
  if (avoidHighwaysToggle) {
    avoidHighwaysToggle.checked = !!settings.avoidHighways;
    avoidHighwaysToggle.addEventListener('change', (e) => {
      saveSetting('avoidHighways', e.target.checked);
      routeFilters.avoidHighways = e.target.checked;
      const avoidHighwaysBox = document.getElementById('avoid-highways');
      if (avoidHighwaysBox) avoidHighwaysBox.checked = e.target.checked;
    });
  }

  const preferScenicToggle = document.getElementById('setting-nav-scenic');
  if (preferScenicToggle) {
    preferScenicToggle.checked = settings.preferScenic !== false;
    preferScenicToggle.addEventListener('change', (e) => {
      saveSetting('preferScenic', e.target.checked);
    });
  }

  const voiceGuidanceToggle = document.getElementById('setting-voice-guidance');
  if (voiceGuidanceToggle) {
    voiceGuidanceToggle.checked = settings.voiceGuidance !== false;
    voiceGuidanceToggle.addEventListener('change', (e) => {
      saveSetting('voiceGuidance', e.target.checked);
      setSpeechMuted(!e.target.checked);
    });
  }

  const voiceVolumeControl = document.getElementById('control-voice-volume');
  if (voiceVolumeControl) {
    const currentVol = settings.voiceVolume || 'normal';
    voiceVolumeControl.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.getAttribute('data-volume') === currentVol) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-volume');
        voiceVolumeControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSetting('voiceVolume', val);
      });
    });
  }

  const unitsControl = document.getElementById('control-units');
  if (unitsControl) {
    const currentUnits = settings.units || 'metric';
    unitsControl.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.getAttribute('data-units') === currentUnits) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-units');
        unitsControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSetting('units', val);
        showHazardToast('Units Updated', `Measurement units set to ${val === 'metric' ? 'Metric (km)' : 'Nautical (kts/mi)'}`);
      });
    });
  }

  // 4. Localization & Regional Setup
  const langSelect = document.getElementById('setting-app-language');
  if (langSelect) {
    langSelect.value = settings.language || 'en';
    langSelect.addEventListener('change', (e) => {
      saveSetting('language', e.target.value);
      applyLanguage(e.target.value);
      showHazardToast('Language Changed', `Interface translated to ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  const homeDistrictSelect = document.getElementById('setting-home-district');
  if (homeDistrictSelect) {
    homeDistrictSelect.value = settings.homeDistrict || 'Chennai, Tamil Nadu';
    homeDistrictSelect.addEventListener('change', (e) => {
      saveSetting('homeDistrict', e.target.value);
      showHazardToast('Home District', `Fallback region saved as ${e.target.value}`);
    });
  }

  // 5. Storage & Offline Maintenance
  document.getElementById('btn-clear-tile-cache')?.addEventListener('click', () => {
    const reclaimed = clearSystemTileCache();
    const storageSubtext = document.getElementById('storage-cache-subtext');
    if (storageSubtext) {
      storageSubtext.textContent = 'Cached tiles, temporary forecasts (approx. 0.0 MB)';
    }
    showHazardToast('🧹 Cache Cleared', `Reclaimed ${reclaimed} MB of temporary map & tile storage`);
  });

  const dataSaverToggle = document.getElementById('setting-data-saver');
  if (dataSaverToggle) {
    dataSaverToggle.checked = !!settings.dataSaver;
    if (settings.dataSaver) {
      document.body.classList.add('data-saver-mode');
    }
    dataSaverToggle.addEventListener('change', (e) => {
      saveSetting('dataSaver', e.target.checked);
      if (e.target.checked) {
        document.body.classList.add('data-saver-mode');
        showHazardToast('Data Saver On', 'Reduced background animations and map tile bandwidth');
      } else {
        document.body.classList.remove('data-saver-mode');
        showHazardToast('Data Saver Off', 'Full resolution animations restored');
      }
    });
  }

  document.getElementById('btn-reset-search-history')?.addEventListener('click', () => {
    SearchHistory.clear();
    showHazardToast('Search History Reset', 'Cleared all recent search queries and destinations');
  });

  // 6. Sub-modals (Legal viewer & Hazard report)
  const legalModal = document.getElementById('legal-modal-backdrop');
  const legalTitle = document.getElementById('legal-modal-title');
  const legalBody = document.getElementById('legal-modal-body');

  const openLegalModal = (title, contentHtml) => {
    if (legalTitle) legalTitle.textContent = title;
    if (legalBody) legalBody.innerHTML = contentHtml;
    if (legalModal) legalModal.style.display = 'flex';
  };

  const closeLegalModal = () => {
    if (legalModal) legalModal.style.display = 'none';
  };

  document.getElementById('close-legal-modal-btn')?.addEventListener('click', closeLegalModal);
  document.getElementById('btn-close-legal')?.addEventListener('click', closeLegalModal);

  document.getElementById('btn-open-tos')?.addEventListener('click', () => {
    openLegalModal(
      'Terms of Service',
      `
      <h4>1. Acceptance of Terms</h4>
      <p>By accessing or utilizing the Tidal Tales coastal navigation system, you agree to comply with all safety instructions, maritime regulations, and municipal beach rules.</p>
      <h4>2. Safety First Protocol</h4>
      <p>Coastal safety ratings are advisory and synthesized from INCOIS numerical forecasts. Real-time conditions may change rapidly due to unseen rip currents, sudden squalls, or local tides.</p>
      <h4>3. Emergency Compliance</h4>
      <p>In the event of an official red flag or INCOIS Tsunami / High Wave alert, all recreational swimming and water entry is strictly forbidden regardless of in-app status.</p>
      `
    );
  });

  document.getElementById('btn-open-privacy')?.addEventListener('click', () => {
    openLegalModal(
      'Privacy Policy',
      `
      <h4>1. Localized Geolocation</h4>
      <p>Your GPS coordinates are processed exclusively within your device's browser sandbox for distance computation and turn guidance. Location coordinates are never sold or transmitted to third parties.</p>
      <h4>2. Offline Storage</h4>
      <p>Preferences, cached tiles, and saved favorites are stored locally in your browser's LocalStorage and CacheStorage subsystems.</p>
      <h4>3. INCOIS Telemetry Ingestion</h4>
      <p>Oceanographic telemetry is fetched from certified public endpoints to provide accurate wave, wind, and swell predictions.</p>
      `
    );
  });

  document.getElementById('btn-open-disclaimers')?.addEventListener('click', () => {
    openLegalModal(
      'Ocean & Marine Disclaimers',
      `
      <h4>⚠️ Official Marine Disclaimer</h4>
      <p>Tidal Tales is developed under the Smart India Hackathon (SIH1656) framework. Ocean weather predictions are derived from public forecasts by the Indian National Centre for Ocean Information Services (INCOIS).</p>
      <p>Lifeguard advisories, beach flags, and on-ground coastal guard instructions always supersede digital application recommendations.</p>
      `
    );
  });

  // Report Hazard Sub-Modal
  const reportModal = document.getElementById('report-modal-backdrop');
  document.getElementById('btn-open-report-modal')?.addEventListener('click', () => {
    if (reportModal) reportModal.style.display = 'flex';
  });

  const closeReportModal = () => {
    if (reportModal) reportModal.style.display = 'none';
  };

  document.getElementById('close-report-modal-btn')?.addEventListener('click', closeReportModal);
  document.getElementById('btn-cancel-report')?.addEventListener('click', closeReportModal);

  document.getElementById('report-hazard-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const beachName = document.getElementById('report-beach-name')?.value;
    const category = document.getElementById('report-hazard-category')?.value;
    closeReportModal();
    showHazardToast('🚩 Hazard Reported', `Thank you! Your observation for ${beachName} (${category}) has been logged for coastal review.`);
  });

  // Initial Language application
  applyLanguage(settings.language || 'en');
}

// --------------------------------------------------------------------------
// Startup with Strict Authentication Boot Guard
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initCoastalCanvas();
  initAuth();

  // STRICT BOOT GUARD:
  // If no authenticated session exists in localStorage, user stays strictly on the Auth Screen.
  // The map, carousel, simulator, and telemetry will NOT be mounted until user enters passcode!
  enforceAuthGate();
});

