/**
 * Beach Suitability Index Algorithm — SIH1656 Master Prompt Specification
 *
 * Parameters & Weights:
 * - Wave Height (40% weight): Ideal < 1.2m; penalize heavily above 2.0m.
 * - Wind Speed (20% weight): Ideal < 15 knots; penalize if > 18 knots.
 * - Swell Period (15% weight): Ideal < 12s; penalize periods > 14s due to undertow/rip risk.
 * - Water Quality Index (25% weight): Direct 0–100 rating.
 * - Hard Safety Override: Tsunami, Storm Surge, High Wave, Strong Current forces 0 & "Hazardous".
 */

export const SuitabilityStatus = {
  SAFE: 'Safe to Swim',
  MODERATE: 'Caution Advised',
  UNSAFE: 'Hazardous',
};

export const STATUS_COLORS = {
  [SuitabilityStatus.SAFE]: '#3F8C88',      // Vintage Sea Teal
  [SuitabilityStatus.MODERATE]: '#E8935B',  // Sunset Ochre
  [SuitabilityStatus.UNSAFE]: '#C4574B',    // Brick Red
};

export const WEIGHTS = {
  WAVE: 0.40,
  WIND: 0.20,
  SWELL: 0.15,
  WATER_QUALITY: 0.25,
};

// 1 knot = 1.852 km/h
export function kmphToKnots(kmph) {
  return Math.round((kmph / 1.852) * 10) / 10;
}

export function knotsToKmph(knots) {
  return Math.round(knots * 1.852 * 10) / 10;
}

function lerp(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return a + (b - a) * clamped;
}

/**
 * Wave Height (40%): Ideal < 1.2m; penalize heavily above 2.0m.
 */
function scoreWaveHeight(meters, reasons) {
  if (meters <= 0.5) return 100;
  if (meters <= 1.2) {
    // 0.5m to 1.2m is still ideal/manageable
    return lerp(100, 75, (meters - 0.5) / 0.7);
  }
  if (meters <= 2.0) {
    reasons.push(`Wave height (${meters.toFixed(1)}m) — caution advised for casual swimmers.`);
    return lerp(75, 30, (meters - 1.2) / 0.8);
  }
  // Penalize heavily above 2.0m
  reasons.push(`Wave height (${meters.toFixed(1)}m) is hazardous with dangerous breakers.`);
  return lerp(30, 0, (meters - 2.0) / 1.5);
}

/**
 * Wind Speed (20%): Ideal < 15 knots; penalize if > 18 knots.
 */
function scoreWindSpeed(knots, reasons) {
  if (knots <= 10) return 100;
  if (knots <= 15) {
    return lerp(100, 75, (knots - 10) / 5);
  }
  if (knots <= 18) {
    reasons.push(`Wind speed (${knots.toFixed(0)} kts) — choppy coastal surface.`);
    return lerp(75, 40, (knots - 15) / 3);
  }
  // Penalize if > 18 knots
  reasons.push(`High coastal wind (${knots.toFixed(0)} kts) creating strong surface chop.`);
  return lerp(40, 0, (knots - 18) / 15);
}

/**
 * Swell Period (15%): Ideal < 12s; penalize periods > 14s due to undertow/rip risk.
 */
function scoreSwellPeriod(seconds, reasons) {
  if (seconds <= 8) return 100;
  if (seconds <= 12) {
    return lerp(100, 70, (seconds - 8) / 4);
  }
  if (seconds <= 14) {
    reasons.push(`Swell period (${seconds.toFixed(0)}s) — elevated breaker energy.`);
    return lerp(70, 35, (seconds - 12) / 2);
  }
  // Penalize periods > 14s due to undertow and rip risk
  reasons.push(`Long-period groundswell (${seconds.toFixed(0)}s) — severe undertow and rip-current risk.`);
  return lerp(35, 0, (seconds - 14) / 6);
}

/**
 * Water Quality Index (25%): Direct 0-100 rating.
 */
function scoreWaterQuality(index, reasons) {
  if (index < 40) {
    reasons.push(`Water quality index is low (${index}/100) — runoff or contamination suspected.`);
  }
  return Math.max(0, Math.min(100, index));
}

function statusFromScore(score) {
  if (score >= 70) return SuitabilityStatus.SAFE;
  if (score >= 40) return SuitabilityStatus.MODERATE;
  return SuitabilityStatus.UNSAFE;
}

export function evaluateSuitability(reading) {
  const reasons = [];

  // Hard Safety Overrides: force score to 0 and flag as Hazardous (Unsafe)
  if (reading.tsunamiAlert || reading.tsunami_alert) {
    return {
      score: 0,
      status: SuitabilityStatus.UNSAFE,
      statusColor: STATUS_COLORS[SuitabilityStatus.UNSAFE],
      reasons: ['Tsunami alert in effect — leave the beach immediately.'],
      subScores: { wave: 0, wind: 0, swell: 0, water: 0 },
      isHazardOverride: true,
    };
  }
  if (reading.stormSurgeAlert || reading.storm_surge_alert) {
    return {
      score: 0,
      status: SuitabilityStatus.UNSAFE,
      statusColor: STATUS_COLORS[SuitabilityStatus.UNSAFE],
      reasons: ['Storm surge alert in effect along the coast.'],
      subScores: { wave: 0, wind: 0, swell: 0, water: 0 },
      isHazardOverride: true,
    };
  }
  if (reading.highWaveAlert || reading.high_wave_alert) {
    return {
      score: 0,
      status: SuitabilityStatus.UNSAFE,
      statusColor: STATUS_COLORS[SuitabilityStatus.UNSAFE],
      reasons: ['High wave alert issued by INCOIS — swimming prohibited.'],
      subScores: { wave: 0, wind: 0, swell: 0, water: 0 },
      isHazardOverride: true,
    };
  }
  if (reading.strongCurrentAlert || reading.strong_current_alert) {
    return {
      score: 0,
      status: SuitabilityStatus.UNSAFE,
      statusColor: STATUS_COLORS[SuitabilityStatus.UNSAFE],
      reasons: ['Strong rip current warning issued for this coastal sector.'],
      subScores: { wave: 0, wind: 0, swell: 0, water: 0 },
      isHazardOverride: true,
    };
  }

  const waveHeight = Number(reading.waveHeightM ?? reading.wave_height_m ?? 0.8);
  // Support either knots directly or convert from km/h
  const windKnots = reading.windSpeedKnots !== undefined
    ? Number(reading.windSpeedKnots)
    : kmphToKnots(Number(reading.windSpeedKmph ?? reading.wind_speed_kmph ?? 18));
  const swellPeriod = Number(reading.swellPeriodSec ?? reading.swell_period_sec ?? 7);
  const waterQuality = Number(reading.waterQualityIndex ?? reading.water_quality_index ?? 70);

  const waveScore = scoreWaveHeight(waveHeight, reasons);
  const windScore = scoreWindSpeed(windKnots, reasons);
  const swellScore = scoreSwellPeriod(swellPeriod, reasons);
  const waterScore = scoreWaterQuality(waterQuality, reasons);

  const composite = (
    waveScore * WEIGHTS.WAVE +
    windScore * WEIGHTS.WIND +
    swellScore * WEIGHTS.SWELL +
    waterScore * WEIGHTS.WATER_QUALITY
  );

  const roundedScore = Math.round(composite * 10) / 10;
  const status = statusFromScore(roundedScore);

  return {
    score: roundedScore,
    status,
    statusColor: STATUS_COLORS[status],
    reasons: reasons.length > 0 ? reasons : ['Calm ocean state. Conditions look pleasant for beachgoers.'],
    subScores: {
      wave: Math.round(waveScore),
      wind: Math.round(windScore),
      swell: Math.round(swellScore),
      water: Math.round(waterScore),
    },
    windKnots,
    isHazardOverride: false,
  };
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
