import '../../../../core/utils/distance_utils.dart';
import '../../domain/suitability_algorithm.dart';

/// Raw oceanic/meteorological readings for a single beach, shaped to
/// mirror the kind of parameters INCOIS publishes (Ocean State Forecast,
/// High Wave Alerts, Storm Surge Alerts, Water Quality bulletins).
class IncoisReading {
  final double waveHeightM; // significant wave height, meters
  final double windSpeedKmph;
  final double swellPeriodSec;
  final double waterQualityIndex; // 0 (poor) – 100 (excellent)
  final bool tsunamiAlert;
  final bool stormSurgeAlert;
  final bool highWaveAlert;
  final bool strongCurrentAlert;

  const IncoisReading({
    required this.waveHeightM,
    required this.windSpeedKmph,
    required this.swellPeriodSec,
    required this.waterQualityIndex,
    this.tsunamiAlert = false,
    this.stormSurgeAlert = false,
    this.highWaveAlert = false,
    this.strongCurrentAlert = false,
  });

  factory IncoisReading.fromJson(Map<String, dynamic> json) => IncoisReading(
        waveHeightM: (json['wave_height_m'] as num).toDouble(),
        windSpeedKmph: (json['wind_speed_kmph'] as num).toDouble(),
        swellPeriodSec: (json['swell_period_sec'] as num?)?.toDouble() ?? 6.0,
        waterQualityIndex:
            (json['water_quality_index'] as num?)?.toDouble() ?? 70.0,
        tsunamiAlert: json['tsunami_alert'] as bool? ?? false,
        stormSurgeAlert: json['storm_surge_alert'] as bool? ?? false,
        highWaveAlert: json['high_wave_alert'] as bool? ?? false,
        strongCurrentAlert: json['strong_current_alert'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'wave_height_m': waveHeightM,
        'wind_speed_kmph': windSpeedKmph,
        'swell_period_sec': swellPeriodSec,
        'water_quality_index': waterQualityIndex,
        'tsunami_alert': tsunamiAlert,
        'storm_surge_alert': stormSurgeAlert,
        'high_wave_alert': highWaveAlert,
        'strong_current_alert': strongCurrentAlert,
      };
}

class Beach {
  final String id;
  final String name;
  final String state;
  final double latitude;
  final double longitude;
  final String imageUrl;
  final IncoisReading reading;

  const Beach({
    required this.id,
    required this.name,
    required this.state,
    required this.latitude,
    required this.longitude,
    required this.imageUrl,
    required this.reading,
  });

  /// Computed on demand from the current reading — never cached stale,
  /// since suitability must reflect the latest INCOIS poll.
  SuitabilityResult get suitability => SuitabilityAlgorithm.evaluate(reading);

  double distanceKmFrom(double lat, double lon) =>
      haversineDistanceKm(lat, lon, latitude, longitude);

  Beach copyWith({IncoisReading? reading}) => Beach(
        id: id,
        name: name,
        state: state,
        latitude: latitude,
        longitude: longitude,
        imageUrl: imageUrl,
        reading: reading ?? this.reading,
      );
}
