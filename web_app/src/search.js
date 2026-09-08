/**
 * Universal Coastal Search, Fuzzy Autocomplete & Discovery Engine
 * SIH1656 - Tidal Tales
 */

import { haversineDistanceKm, evaluateSuitability } from './suitability.js';

const RECENT_SEARCHES_KEY = 'tidal_recent_searches';
const MAX_RECENT_SEARCHES = 5;

/**
 * Simple, robust Levenshtein distance for fuzzy typo tolerance
 */
export function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Fuzzy search across beaches by name, city/district, and state.
 * Returns up to maxResults matching beaches with match scoring and highlighted text ranges.
 */
export function fuzzySearchBeaches(query, beaches, userLocation, maxResults = 5) {
  if (!query || typeof query !== 'string') return [];
  const cleanQ = query.trim().toLowerCase();
  if (cleanQ.length === 0) return [];

  const scoredResults = [];

  beaches.forEach(beach => {
    const nameLower = beach.name.toLowerCase();
    const stateLower = (beach.state || '').toLowerCase();
    const countryLower = (beach.country || '').toLowerCase();
    const regionLower = (beach.region || '').toLowerCase();
    const descLower = (beach.description || '').toLowerCase();

    // Derive city/district from beach metadata or known patterns
    let cityLower = '';
    if (beach.city) cityLower = beach.city.toLowerCase();
    else if (nameLower.includes('marina') || nameLower.includes('besant')) cityLower = 'chennai';
    else if (nameLower.includes('calangute') || nameLower.includes('baga')) cityLower = 'north goa';
    else if (nameLower.includes('kovalam') || nameLower.includes('varkala')) cityLower = 'thiruvananthapuram';
    else if (nameLower.includes('puri')) cityLower = 'puri';
    else if (nameLower.includes('radhanagar')) cityLower = 'havelock island';
    else if (nameLower.includes('juhu')) cityLower = 'mumbai';

    let score = 0;
    let matchType = '';
    let matchedField = 'name';

    // 1. Exact Substring Match (Highest priority)
    if (nameLower.startsWith(cleanQ)) {
      score += 100 - cleanQ.length;
      matchType = 'prefix';
    } else if (nameLower.includes(cleanQ)) {
      score += 70;
      matchType = 'substring';
    } else if (cityLower.includes(cleanQ)) {
      score += 60;
      matchType = 'city';
      matchedField = 'city';
    } else if (countryLower.includes(cleanQ)) {
      score += 55;
      matchType = 'country';
      matchedField = 'country';
    } else if (stateLower.includes(cleanQ)) {
      score += 50;
      matchType = 'state';
      matchedField = 'state';
    } else if (regionLower.includes(cleanQ)) {
      score += 45;
      matchType = 'region';
      matchedField = 'region';
    } else if (descLower.includes(cleanQ)) {
      score += 30;
      matchType = 'description';
    } else {
      // 2. Fuzzy Typo Match (e.g. "kavalam" -> "Kovalam", "calangut" -> "Calangute")
      const words = nameLower.split(/\s+/);
      let bestDist = Infinity;

      words.forEach(w => {
        const targetLen = Math.min(w.length, cleanQ.length + 1);
        const sub = w.substring(0, targetLen);
        const dist = levenshteinDistance(cleanQ, sub);
        if (dist < bestDist) bestDist = dist;
      });

      if (cityLower) {
        const cityDist = levenshteinDistance(cleanQ, cityLower);
        if (cityDist < bestDist) bestDist = cityDist;
      }

      if (countryLower) {
        const countryDist = levenshteinDistance(cleanQ, countryLower);
        if (countryDist < bestDist) bestDist = countryDist;
      }

      const maxAllowedDist = cleanQ.length <= 4 ? 1 : 2;
      if (bestDist <= maxAllowedDist) {
        score += 40 - (bestDist * 10);
        matchType = 'fuzzy';
      }
    }

    if (score > 0) {
      const distKm = haversineDistanceKm(
        userLocation.lat,
        userLocation.lon,
        beach.latitude,
        beach.longitude
      );

      const suitability = evaluateSuitability(beach.reading);

      scoredResults.push({
        beach,
        score,
        matchType,
        matchedField,
        distKm,
        suitability,
      });
    }
  });

  scoredResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.distKm - b.distKm;
  });

  return scoredResults.slice(0, maxResults);
}

/**
 * Format beach name with bolded matched characters for visual feedback
 */
export function highlightMatchText(text, query) {
  if (!query || !text) return text;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;

  const before = text.substring(0, idx);
  const match = text.substring(idx, idx + q.length);
  const after = text.substring(idx + q.length);

  return `${before}<strong class="search-highlight">${match}</strong>${after}`;
}

/**
 * Recent Searches Management (localStorage)
 */
export const SearchHistory = {
  get() {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  add(beachId) {
    if (!beachId) return;
    try {
      let list = SearchHistory.get();
      list = list.filter(id => id !== beachId);
      list.unshift(beachId);
      if (list.length > MAX_RECENT_SEARCHES) {
        list = list.slice(0, MAX_RECENT_SEARCHES);
      }
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save search history', e);
    }
  },

  clear() {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (e) {
      console.warn('Failed to clear search history', e);
    }
  },
};

/**
 * Keystroke Debouncer
 */
export function debounce(func, wait = 200) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Web Speech API Voice Search Helper
 */
export function startVoiceSearch(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (onError) onError('Speech Recognition API is not supported in this browser.');
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; // Indian English default

    recognition.onresult = (event) => {
      if (event.results && event.results[0] && event.results[0][0]) {
        const transcript = event.results[0][0].transcript;
        if (onResult) onResult(transcript);
      }
    };

    recognition.onerror = (err) => {
      if (onError) onError(err.error || 'Voice input error');
    };

    recognition.start();
    return recognition;
  } catch (e) {
    if (onError) onError(e.message || 'Could not start voice search');
    return null;
  }
}
