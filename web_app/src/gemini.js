/**
 * Gemini AI Coastal Safety Assistant for Tidal Tales (SIH1656)
 * Powered by Google Gemini 3.6 Flash
 */

import { evaluateSuitability } from './suitability.js';

// Gemini API Key (configurable via import.meta.env.VITE_GEMINI_API_KEY or localStorage 'tidal_gemini_key')
export const DEFAULT_GEMINI_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';

export function getActiveGeminiKey() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('tidal_gemini_key');
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_GEMINI_KEY;
}

export const GEMINI_API_KEY = DEFAULT_GEMINI_KEY;

export function saveCustomGeminiKey(key) {
  if (typeof localStorage !== 'undefined' && key && key.trim()) {
    localStorage.setItem('tidal_gemini_key', key.trim());
  }
}

/**
 * Ask Gemini for an intelligent real-time beach safety briefing grounded in live INCOIS telemetry
 */
export async function askGeminiAboutBeach(userQuery, beach) {
  const beachName = beach?.name || 'Coastal Beach';
  const location = beach?.location || (beach?.state ? `${beach.state}, ${beach?.country || 'India'}` : (beach?.country || 'Coastal Coastline'));
  
  // Extract live oceanographic numbers (support flat or nested reading properties)
  const waveHeight = beach?.waveHeight !== undefined 
    ? beach.waveHeight 
    : (beach?.reading?.waveHeightM ?? 0.9);
    
  const windSpeed = beach?.windSpeed !== undefined 
    ? beach.windSpeed 
    : (beach?.reading?.windSpeedKmph ? Math.round(beach.reading.windSpeedKmph * 0.539957 * 10) / 10 : 9.7);
    
  const swellPeriod = beach?.swellPeriod !== undefined 
    ? beach.swellPeriod 
    : (beach?.reading?.swellPeriodSec ?? 7);
    
  const wqi = beach?.wqi !== undefined 
    ? beach.wqi 
    : (beach?.reading?.waterQualityIndex ?? 62);

  // Collect any active emergency alerts for this beach or the coastline
  const activeAlerts = Array.isArray(beach?.activeAlerts) ? [...beach.activeAlerts] : [];
  if (beach?.reading?.highWaveAlert && !activeAlerts.some(a => a.toLowerCase().includes('high wave'))) {
    activeAlerts.push('High wave alert issued by INCOIS — swimming prohibited');
  }
  if (beach?.reading?.tsunamiAlert && !activeAlerts.some(a => a.toLowerCase().includes('tsunami'))) {
    activeAlerts.push('Tsunami alert issued by INCOIS — evacuate coastal zones');
  }
  if (beach?.reading?.stormSurgeAlert && !activeAlerts.some(a => a.toLowerCase().includes('storm surge'))) {
    activeAlerts.push('Storm surge alert issued by INCOIS');
  }
  if (beach?.reading?.strongCurrentAlert && !activeAlerts.some(a => a.toLowerCase().includes('current') || a.toLowerCase().includes('rip'))) {
    activeAlerts.push('Strong rip current warning issued by INCOIS');
  }

  // Cross-reference active dashboard emergency banner
  if (typeof document !== 'undefined') {
    const banner = document.getElementById('top-alert-banner');
    const bannerText = document.getElementById('top-alert-text')?.textContent;
    if (banner && banner.classList.contains('active') && bannerText) {
      const cleanAlert = bannerText.replace('🚨', '').trim();
      if (!activeAlerts.includes(cleanAlert)) {
        activeAlerts.push(cleanAlert);
      }
    }
  }

  const isAlertActive = activeAlerts.length > 0;

  const systemContext = `
You are Tidal AI, a coastal safety advisor for Indian beaches.
Current Location: ${beachName} (${location})
Live Telemetry:
- Significant Wave Height: ${waveHeight} m (Threshold: Safe < 1.2m, Rough > 2.0m)
- Wind Speed: ${windSpeed} kts
- Swell Period: ${swellPeriod} s
- Water Quality Index: ${wqi} / 100
- Active Emergency Alerts: ${isAlertActive ? activeAlerts.join(', ') : 'None'}

Rules:
1. If any emergency alert (e.g., HIGH WAVE, TSUNAMI, STORM SURGE) is active, prioritize safety and advise against entering the water.
2. Keep responses concise, helpful, and under 3 sentences.
3. Explicitly advise whether swimming, wading, or watersports are safe based on these numbers.
`.trim();

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${systemContext}\n\nUser Question: ${userQuery}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    }
  };

  const apiKey = getActiveGeminiKey();
  const models = ['gemini-3.6-flash', 'gemini-flash-latest'];

  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        let answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer && answer.trim()) {
          answer = answer.trim();
          // Guarantee clean terminal punctuation if cut off mid-sentence
          if (/[,:;\-\(]\s*$/.test(answer)) {
            answer = answer.replace(/[,:;\-\(]\s*$/, '') + '.';
          }
          return answer;
        }
      }
    } catch (err) {
      // try fallback model
    }
  }

  // Deterministic grounded safety advice if external network is unavailable
  if (isAlertActive) {
    return `⚠️ ${activeAlerts.join('; ')} is in effect for ${beachName}. With wave heights at ${waveHeight}m, entering the water for swimming, wading, or watersports is strictly prohibited. Please enjoy the shoreline safely from dry sand and heed coastal guards.`;
  } else if (waveHeight < 1.2 && windSpeed < 15) {
    return `Safe to Swim: ${beachName} currently reports calm conditions with wave height of ${waveHeight}m and ${windSpeed} kts winds. Swimming and family wading are safe within patrolled zones. Always keep children supervised close to shore.`;
  } else {
    return `Caution Advised: Moderate surf at ${beachName} with ${waveHeight}m waves and ${windSpeed} kts winds. Swimming is risky due to active breaker chop; stay in shallow water and avoid strong rip currents.`;
  }
}

/**
 * Backward-compatible alias for existing callers
 */
export async function askGeminiCoastalAI(beach, question) {
  return askGeminiAboutBeach(question, beach);
}
