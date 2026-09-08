/**
 * Settings & Preferences Controller for Tidal Tales (SIH1656)
 * Manages user preferences, i18n translations, storage maintenance, and navigation defaults.
 */

// Default settings state
export const DEFAULT_SETTINGS = {
  // Account & Identity
  activeProfile: 'owner', // 'owner' | 'registered' | 'guest'
  
  // Coastal Safety & Alerts
  criticalHazardAlerts: true,
  proximitySiren: true,
  suitabilityThreshold: 'moderate', // 'strict' (85+) | 'moderate' (70+) | 'adventurous' (50+)
  
  // Navigation & Routing Defaults
  defaultTravelMode: 'driving', // 'driving' | 'bike' | 'bicycle' | 'walking'
  avoidTolls: false,
  avoidHighways: false,
  preferScenic: true,
  voiceGuidance: true,
  voiceVolume: 'normal', // 'muted' | 'normal' | 'loud'
  units: 'metric', // 'metric' (km, m, km/h) | 'nautical' (miles, ft, knots)
  
  // Localization & Regional Setup
  language: 'en', // 'en' | 'ta' | 'hi' | 'ml'
  homeDistrict: 'Chennai, Tamil Nadu',
  
  // System Storage & Data
  dataSaver: false,
};

// Storage keys prefix
const STORAGE_PREFIX = 'tidal_settings_';

/**
 * Load all settings from localStorage with fallback to defaults
 */
export function loadSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      if (stored !== null) {
        try {
          settings[key] = JSON.parse(stored);
        } catch {
          settings[key] = stored;
        }
      }
    });
  } catch (e) {
    console.warn('Could not read settings from localStorage:', e);
  }
  return settings;
}

/**
 * Save a specific setting to localStorage
 */
export function saveSetting(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not save setting ${key}:`, e);
  }
}

/**
 * Retrieve a specific setting value
 */
export function getSetting(key) {
  const current = loadSettings();
  return current[key] !== undefined ? current[key] : DEFAULT_SETTINGS[key];
}

/**
 * Reset all settings to factory defaults
 */
export function resetAllSettings() {
  try {
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      localStorage.removeItem(STORAGE_PREFIX + key);
    });
  } catch (e) {
    console.warn('Error resetting settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

// --------------------------------------------------------------------------
// Multi-lingual i18n Translation Dictionary
// --------------------------------------------------------------------------
export const TRANSLATIONS = {
  en: {
    appTitle: 'Tidal Tales',
    appSubtitle: 'Your beach day, checked in advance ☀️',
    searchPlaceholder: 'Search beach, district, or coastal zone...',
    filterAll: 'All Coastlines',
    filterSafe: 'Safe to Swim',
    filterPopular: 'Popular Spots',
    filterNearMe: 'Near Me (<50 km)',
    filterSurfing: 'Surfing / Sports',
    settingsTitle: 'Settings & Preferences',
    navStart: 'Start Navigation',
    endJourney: 'End Journey',
    safeVerdict: 'SAFE TO SWIM',
    moderateVerdict: 'SWIM WITH CAUTION',
    hazardousVerdict: 'HAZARDOUS // NO SWIM',
    waveHeightLabel: 'Wave Height',
    windSpeedLabel: 'Wind Speed',
    swellPeriodLabel: 'Swell Period',
    waterQualityLabel: 'Water Quality',
  },
  ta: {
    appTitle: 'டைடல் டேல்ஸ் (Tidal Tales)',
    appSubtitle: 'உங்கள் கடற்கரை பயணம், முன்கூட்டியே சரிபார்க்கப்பட்டது ☀️',
    searchPlaceholder: 'கடற்கரை, மாவட்டம் அல்லது மண்டலத்தைத் தேடுங்கள்...',
    filterAll: 'அனைத்து கடற்கரைகள்',
    filterSafe: 'நீந்த பாதுகாப்பானது',
    filterPopular: 'பிரபலமான இடங்கள்',
    filterNearMe: 'அருகில் (<50 கி.மீ)',
    filterSurfing: 'அலைச்சறுக்கு / விளையாட்டுகள்',
    settingsTitle: 'அமைப்புகள் & விருப்பத்தேர்வுகள்',
    navStart: 'வழிகாட்டலைத் தொடங்கு',
    endJourney: 'பயணத்தை முடி',
    safeVerdict: 'நீந்த பாதுகாப்பானது',
    moderateVerdict: 'கவனத்துடன் நீந்தவும்',
    hazardousVerdict: 'ஆபத்தானது // நீந்த வேண்டாம்',
    waveHeightLabel: 'அலை உயரம்',
    windSpeedLabel: 'காற்றின் வேகம்',
    swellPeriodLabel: 'அலை காலம்',
    waterQualityLabel: 'நீரின் தரம்',
  },
  hi: {
    appTitle: 'टाइडल टेल्स (Tidal Tales)',
    appSubtitle: 'समुद्र तट की स्थिति, पहले से जांची गई ☀️',
    searchPlaceholder: 'समुद्र तट, जिला या तटीय क्षेत्र खोजें...',
    filterAll: 'सभी समुद्र तट',
    filterSafe: 'तैरने के लिए सुरक्षित',
    filterPopular: 'लोकप्रिय स्थान',
    filterNearMe: 'मेरे पास (<50 किमी)',
    filterSurfing: 'सर्फिंग / जलक्रीड़ा',
    settingsTitle: 'सेटिंग्स और प्राथमिकताएं',
    navStart: 'नेविगेशन शुरू करें',
    endJourney: 'यात्रा समाप्त करें',
    safeVerdict: 'तैरने के लिए सुरक्षित',
    moderateVerdict: 'सावधानी से तैरें',
    hazardousVerdict: 'खतरनाक // तैरना मना है',
    waveHeightLabel: 'लहर की ऊंचाई',
    windSpeedLabel: 'हवा की गति',
    swellPeriodLabel: 'लहर की अवधि',
    waterQualityLabel: 'पानी की गुणवत्ता',
  },
  ml: {
    appTitle: 'ടൈഡൽ ടെയിൽസ് (Tidal Tales)',
    appSubtitle: 'നിങ്ങളുടെ കടൽത്തീര ദിനം മുൻകൂട്ടി ഉറപ്പാക്കൂ ☀️',
    searchPlaceholder: 'ബീച്ച്, ജില്ല അല്ലെങ്കിൽ തീരദേശ മേഖല തിരയുക...',
    filterAll: 'എല്ലാ തീരങ്ങളും',
    filterSafe: 'നീന്താൻ സുരക്ഷിതം',
    filterPopular: 'പ്രശസ്ത സ്ഥലങ്ങൾ',
    filterNearMe: 'എന്റെ അടുത്ത് (<50 കി.മീ)',
    filterSurfing: 'സർഫിംഗ് / കായിക വിനോദങ്ങൾ',
    settingsTitle: 'ക്രമീകരണങ്ങളും മുൻഗണനകളും',
    navStart: 'നാവിഗേഷൻ ആരംഭിക്കുക',
    endJourney: 'യാത്ര അവസാനിപ്പിക്കുക',
    safeVerdict: 'നീന്താൻ സുരക്ഷിതം',
    moderateVerdict: 'ശ്രദ്ധയോടെ നീന്തുക',
    hazardousVerdict: 'അപകടകരം // നീന്തരുത്',
    waveHeightLabel: 'തിരമാല ഉയരം',
    windSpeedLabel: 'കാറ്റിന്റെ വേഗത',
    swellPeriodLabel: 'തിരമാല ദൈർഘ്യം',
    waterQualityLabel: 'ജല ഗുണനിലവാരം',
  },
};

/**
 * Translate key with fallback to English
 */
export function t(key, lang = null) {
  const currentLang = lang || getSetting('language') || 'en';
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}

/**
 * Storage Usage Calculator & Cache Wiper simulation
 */
export function calculateStorageUsageMB() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      bytes += (key.length + (val ? val.length : 0)) * 2;
    }
  } catch (e) {
    console.warn(e);
  }
  // Base cache simulation: 38.4 MB (tiles + photo forecast cache) + real localStorage size
  const simulatedTileCacheMB = 42.6;
  const localMb = bytes / (1024 * 1024);
  return (simulatedTileCacheMB + localMb).toFixed(1);
}

/**
 * Wipe temporary tile, photo, and forecast cache
 */
export function clearSystemTileCache() {
  const reclaimedMB = calculateStorageUsageMB();
  
  // Clear any temporary tiles or search caches without wiping user auth
  try {
    const keysToPurge = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tile_') || key.startsWith('cache_') || key.startsWith('forecast_'))) {
        keysToPurge.push(key);
      }
    }
    keysToPurge.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error purging tile cache:', e);
  }

  return reclaimedMB;
}
