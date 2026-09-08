import 'package:flutter_test/flutter_test.dart';
import 'package:tidal_tales/features/home/data/models/beach_model.dart';
import 'package:tidal_tales/features/home/domain/suitability_algorithm.dart';

void main() {
  group('SuitabilityAlgorithm', () {
    test('calm conditions => Safe', () {
      final reading = IncoisReading(
        waveHeightM: 0.3,
        windSpeedKmph: 10,
        swellPeriodSec: 6,
        waterQualityIndex: 90,
      );
      final result = SuitabilityAlgorithm.evaluate(reading);
      expect(result.status, SuitabilityStatus.safe);
      expect(result.score, greaterThan(90));
    });

    test('choppy but not alerted conditions => Moderate', () {
      final reading = IncoisReading(
        waveHeightM: 1.5,
        windSpeedKmph: 35,
        swellPeriodSec: 11,
        waterQualityIndex: 55,
      );
      final result = SuitabilityAlgorithm.evaluate(reading);
      expect(result.status, SuitabilityStatus.moderate);
    });

    test('high wave alert forces Unsafe regardless of other params', () {
      final reading = IncoisReading(
        waveHeightM: 0.4, // otherwise perfect
        windSpeedKmph: 8,
        swellPeriodSec: 5,
        waterQualityIndex: 98,
        highWaveAlert: true,
      );
      final result = SuitabilityAlgorithm.evaluate(reading);
      expect(result.status, SuitabilityStatus.unsafe);
      expect(result.score, 0);
    });

    test('tsunami alert overrides everything', () {
      final reading = IncoisReading(
        waveHeightM: 0.2,
        windSpeedKmph: 5,
        swellPeriodSec: 4,
        waterQualityIndex: 100,
        tsunamiAlert: true,
      );
      final result = SuitabilityAlgorithm.evaluate(reading);
      expect(result.status, SuitabilityStatus.unsafe);
      expect(result.reasons.first, contains('Tsunami'));
    });

    test('poor water quality alone can drag score down without alerts', () {
      final reading = IncoisReading(
        waveHeightM: 0.4,
        windSpeedKmph: 10,
        swellPeriodSec: 5,
        waterQualityIndex: 15,
      );
      final result = SuitabilityAlgorithm.evaluate(reading);
      expect(result.score, lessThan(100));
      expect(result.reasons.any((r) => r.contains('Water quality')), isTrue);
    });
  });
}
