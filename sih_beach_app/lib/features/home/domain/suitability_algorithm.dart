import '../data/models/beach_model.dart';

enum SuitabilityStatus { safe, moderate, unsafe }

class SuitabilityResult {
  final double score; // 0–100, higher is safer
  final SuitabilityStatus status;
  final String statusLabel;
  final int statusColorValue; // ARGB int, avoids importing Flutter here
  final List<String> reasons; // human-readable drivers of the score

  const SuitabilityResult({
    required this.score,
    required this.status,
    required this.statusLabel,
    required this.statusColorValue,
    required this.reasons,
  });
}

/// Computes a "Beach Suitability Index" for recreational activities
/// (primarily swimming) from live INCOIS-style parameters.
///
/// Design notes:
/// - Any *hard* hazard alert (tsunami, storm surge, high wave, strong
///   current) is treated as an automatic override to Unsafe — these are
///   binary go/no-go signals from INCOIS, not something to "blend" into
///   a continuous score. Blending them in would let, say, great water
///   quality mathematically cancel out a live tsunami alert, which
///   would be actively dangerous.
/// - Everything else (wave height, wind speed, swell period, water
///   quality) is scored on independent 0–100 sub-scales, then combined
///   with weights reflecting swimmer-safety relevance, not just
///   "niceness" (e.g. wave height is weighted higher than water quality
///   because it drives drowning/rip-current risk more directly).
class SuitabilityAlgorithm {
  SuitabilityAlgorithm._();

  // Weights must sum to 1.0
  static const double _waveWeight = 0.40;
  static const double _windWeight = 0.20;
  static const double _swellWeight = 0.15;
  static const double _waterQualityWeight = 0.25;

  static SuitabilityResult evaluate(IncoisReading r) {
    final reasons = <String>[];

    // --- Hard override: active hazard alerts ---
    if (r.tsunamiAlert) {
      return _unsafe('Tsunami alert in effect — leave the beach immediately.');
    }
    if (r.stormSurgeAlert) {
      return _unsafe('Storm surge alert in effect.');
    }
    if (r.highWaveAlert) {
      return _unsafe('High wave alert issued by INCOIS.');
    }
    if (r.strongCurrentAlert) {
      return _unsafe('Strong / rip current alert issued.');
    }

    // --- Sub-scores (0–100, 100 = best) ---
    final waveScore = _scoreWaveHeight(r.waveHeightM, reasons);
    final windScore = _scoreWindSpeed(r.windSpeedKmph, reasons);
    final swellScore = _scoreSwellPeriod(r.swellPeriodSec, reasons);
    final waterScore = _scoreWaterQuality(r.waterQualityIndex, reasons);

    final composite = (waveScore * _waveWeight) +
        (windScore * _windWeight) +
        (swellScore * _swellWeight) +
        (waterScore * _waterQualityWeight);

    final status = _statusFromScore(composite);

    return SuitabilityResult(
      score: double.parse(composite.toStringAsFixed(1)),
      status: status,
      statusLabel: _labelFor(status),
      statusColorValue: _colorValueFor(status),
      reasons: reasons.isEmpty ? ['Conditions look pleasant today.'] : reasons,
    );
  }

  // Significant wave height thresholds tuned for recreational swimming
  // (not surfing) — rough real-world reference points:
  // <0.5m calm, 0.5–1.2m manageable, 1.2–2.0m caution, >2.0m dangerous.
  static double _scoreWaveHeight(double meters, List<String> reasons) {
    if (meters <= 0.5) return 100;
    if (meters <= 1.2) {
      return _lerp(100, 70, (meters - 0.5) / 0.7);
    }
    if (meters <= 2.0) {
      reasons.add('Wave height (${meters.toStringAsFixed(1)}m) — use caution.');
      return _lerp(70, 30, (meters - 1.2) / 0.8);
    }
    reasons.add('Wave height (${meters.toStringAsFixed(1)}m) is hazardous.');
    return _lerp(30, 0, ((meters - 2.0) / 2.0).clamp(0, 1));
  }

  static double _scoreWindSpeed(double kmph, List<String> reasons) {
    if (kmph <= 15) return 100;
    if (kmph <= 30) return _lerp(100, 65, (kmph - 15) / 15);
    if (kmph <= 45) {
      reasons.add('Strong winds (${kmph.toStringAsFixed(0)} km/h).');
      return _lerp(65, 25, (kmph - 30) / 15);
    }
    reasons.add('Very strong winds (${kmph.toStringAsFixed(0)} km/h).');
    return _lerp(25, 0, ((kmph - 45) / 25).clamp(0, 1));
  }

  // Longer swell periods at moderate heights can mean more powerful,
  // more dangerous breaking waves even if wave height alone looks tame.
  static double _scoreSwellPeriod(double seconds, List<String> reasons) {
    if (seconds <= 8) return 100;
    if (seconds <= 12) return _lerp(100, 60, (seconds - 8) / 4);
    reasons.add('Long-period swell (${seconds.toStringAsFixed(0)}s) — stronger breakers possible.');
    return _lerp(60, 20, ((seconds - 12) / 6).clamp(0, 1));
  }

  static double _scoreWaterQuality(double index, List<String> reasons) {
    if (index < 40) {
      reasons.add('Water quality index is low ($index) — possible contamination.');
    }
    return index.clamp(0, 100);
  }

  static double _lerp(double a, double b, double t) =>
      a + (b - a) * t.clamp(0.0, 1.0);

  static SuitabilityStatus _statusFromScore(double score) {
    if (score >= 70) return SuitabilityStatus.safe;
    if (score >= 40) return SuitabilityStatus.moderate;
    return SuitabilityStatus.unsafe;
  }

  static SuitabilityResult _unsafe(String reason) => SuitabilityResult(
        score: 0,
        status: SuitabilityStatus.unsafe,
        statusLabel: 'Unsafe',
        statusColorValue: _colorValueFor(SuitabilityStatus.unsafe),
        reasons: [reason],
      );

  static String _labelFor(SuitabilityStatus s) => switch (s) {
        SuitabilityStatus.safe => 'Safe',
        SuitabilityStatus.moderate => 'Moderate',
        SuitabilityStatus.unsafe => 'Unsafe',
      };

  // ARGB ints matching AppColors.statusSafe / statusModerate / statusUnsafe —
  // duplicated here (rather than imported) to keep this file Flutter-free
  // and unit-testable with plain `dart test`.
  static int _colorValueFor(SuitabilityStatus s) => switch (s) {
        SuitabilityStatus.safe => 0xFF3F8C88,
        SuitabilityStatus.moderate => 0xFFE8935B,
        SuitabilityStatus.unsafe => 0xFFC4574B,
      };
}
