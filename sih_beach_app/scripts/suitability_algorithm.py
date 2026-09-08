"""
Beach Suitability Index — Python reference implementation.

Mirrors lib/features/home/domain/suitability_algorithm.dart exactly, so it
can be used to prototype scoring logic quickly (e.g. in a Jupyter notebook
against real INCOIS bulletin data) before it's ported to Dart, or reused
directly if suitability scoring is later moved server-side (e.g. a Cloud
Function that pre-computes scores for all beaches on a cron schedule
instead of computing them on-device).

Run directly for a demo:
    python3 suitability_algorithm.py
"""

from dataclasses import dataclass, field
from enum import Enum


class SuitabilityStatus(Enum):
    SAFE = "Safe"
    MODERATE = "Moderate"
    UNSAFE = "Unsafe"


STATUS_COLORS = {
    SuitabilityStatus.SAFE: "#3F8C88",      # retro teal
    SuitabilityStatus.MODERATE: "#E8935B",  # faded orange
    SuitabilityStatus.UNSAFE: "#C4574B",    # muted brick red
}

# Weights must sum to 1.0
WAVE_WEIGHT = 0.40
WIND_WEIGHT = 0.20
SWELL_WEIGHT = 0.15
WATER_QUALITY_WEIGHT = 0.25


@dataclass
class IncoisReading:
    wave_height_m: float
    wind_speed_kmph: float
    swell_period_sec: float = 6.0
    water_quality_index: float = 70.0
    tsunami_alert: bool = False
    storm_surge_alert: bool = False
    high_wave_alert: bool = False
    strong_current_alert: bool = False


@dataclass
class SuitabilityResult:
    score: float
    status: SuitabilityStatus
    status_color: str
    reasons: list = field(default_factory=list)


def _lerp(a: float, b: float, t: float) -> float:
    t = max(0.0, min(1.0, t))
    return a + (b - a) * t


def _score_wave_height(meters: float, reasons: list) -> float:
    if meters <= 0.5:
        return 100.0
    if meters <= 1.2:
        return _lerp(100, 70, (meters - 0.5) / 0.7)
    if meters <= 2.0:
        reasons.append(f"Wave height ({meters:.1f}m) — use caution.")
        return _lerp(70, 30, (meters - 1.2) / 0.8)
    reasons.append(f"Wave height ({meters:.1f}m) is hazardous.")
    return _lerp(30, 0, (meters - 2.0) / 2.0)


def _score_wind_speed(kmph: float, reasons: list) -> float:
    if kmph <= 15:
        return 100.0
    if kmph <= 30:
        return _lerp(100, 65, (kmph - 15) / 15)
    if kmph <= 45:
        reasons.append(f"Strong winds ({kmph:.0f} km/h).")
        return _lerp(65, 25, (kmph - 30) / 15)
    reasons.append(f"Very strong winds ({kmph:.0f} km/h).")
    return _lerp(25, 0, (kmph - 45) / 25)


def _score_swell_period(seconds: float, reasons: list) -> float:
    if seconds <= 8:
        return 100.0
    if seconds <= 12:
        return _lerp(100, 60, (seconds - 8) / 4)
    reasons.append(f"Long-period swell ({seconds:.0f}s) — stronger breakers possible.")
    return _lerp(60, 20, (seconds - 12) / 6)


def _score_water_quality(index: float, reasons: list) -> float:
    if index < 40:
        reasons.append(f"Water quality index is low ({index:g}) — possible contamination.")
    return max(0.0, min(100.0, index))


def _status_from_score(score: float) -> SuitabilityStatus:
    if score >= 70:
        return SuitabilityStatus.SAFE
    if score >= 40:
        return SuitabilityStatus.MODERATE
    return SuitabilityStatus.UNSAFE


def evaluate(reading: IncoisReading) -> SuitabilityResult:
    """Compute the Beach Suitability Index for one INCOIS reading."""
    reasons: list = []

    # Hard override: any active hazard alert forces Unsafe. These are
    # binary go/no-go signals — they should never be diluted by an
    # otherwise-good composite score.
    if reading.tsunami_alert:
        return SuitabilityResult(0.0, SuitabilityStatus.UNSAFE,
                                  STATUS_COLORS[SuitabilityStatus.UNSAFE],
                                  ["Tsunami alert in effect — leave the beach immediately."])
    if reading.storm_surge_alert:
        return SuitabilityResult(0.0, SuitabilityStatus.UNSAFE,
                                  STATUS_COLORS[SuitabilityStatus.UNSAFE],
                                  ["Storm surge alert in effect."])
    if reading.high_wave_alert:
        return SuitabilityResult(0.0, SuitabilityStatus.UNSAFE,
                                  STATUS_COLORS[SuitabilityStatus.UNSAFE],
                                  ["High wave alert issued by INCOIS."])
    if reading.strong_current_alert:
        return SuitabilityResult(0.0, SuitabilityStatus.UNSAFE,
                                  STATUS_COLORS[SuitabilityStatus.UNSAFE],
                                  ["Strong / rip current alert issued."])

    wave_score = _score_wave_height(reading.wave_height_m, reasons)
    wind_score = _score_wind_speed(reading.wind_speed_kmph, reasons)
    swell_score = _score_swell_period(reading.swell_period_sec, reasons)
    water_score = _score_water_quality(reading.water_quality_index, reasons)

    composite = (
        wave_score * WAVE_WEIGHT
        + wind_score * WIND_WEIGHT
        + swell_score * SWELL_WEIGHT
        + water_score * WATER_QUALITY_WEIGHT
    )

    status = _status_from_score(composite)
    return SuitabilityResult(
        score=round(composite, 1),
        status=status,
        status_color=STATUS_COLORS[status],
        reasons=reasons or ["Conditions look pleasant today."],
    )


if __name__ == "__main__":
    demo_readings = [
        IncoisReading(wave_height_m=0.3, wind_speed_kmph=10, swell_period_sec=6, water_quality_index=90),
        IncoisReading(wave_height_m=1.5, wind_speed_kmph=35, swell_period_sec=11, water_quality_index=55),
        IncoisReading(wave_height_m=0.4, wind_speed_kmph=8, swell_period_sec=5, water_quality_index=98, high_wave_alert=True),
    ]
    for i, r in enumerate(demo_readings, start=1):
        result = evaluate(r)
        print(f"Beach reading #{i}: {result.status.value} ({result.score}/100) — {result.status_color}")
        for reason in result.reasons:
            print(f"   • {reason}")
