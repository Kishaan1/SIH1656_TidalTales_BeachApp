import 'dart:math';
import 'package:dio/dio.dart';
import '../models/beach_model.dart';

/// Wraps INCOIS data access. Real endpoints (data.incois.gov.in /
/// Ocean State Forecast, ESSO-INCOIS High Wave Alert bulletins,
/// Coastal Water Quality dashboards) generally require registration
/// and don't expose a single unified real-time REST feed, so this
/// service:
///   1. Tries the configured live endpoint(s), if `useMockData` is false.
///   2. Falls back to realistic mock data on any failure — critical for
///      a hackathon demo where venue wifi/INCOIS uptime is not guaranteed.
class IncoisService {
  final Dio _dio;
  final bool useMockData;

  IncoisService({Dio? dio, this.useMockData = true})
      : _dio = dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 8)));

  static const String _baseUrl = 'https://your-incois-proxy.example.com/api';

  /// Returns the seed list of beaches with current mock/live readings.
  Future<List<Beach>> fetchNearbyBeaches({
    required double lat,
    required double lon,
    double radiusKm = 100,
  }) async {
    if (useMockData) {
      await Future.delayed(const Duration(milliseconds: 400)); // simulate latency
      return _mockBeaches();
    }

    try {
      final response = await _dio.get('$_baseUrl/beaches', queryParameters: {
        'lat': lat,
        'lon': lon,
        'radius_km': radiusKm,
      });
      final data = response.data as List;
      return data.map((e) => _beachFromApiJson(e)).toList();
    } catch (_) {
      // Live fetch failed (no network / API down) — demo must go on.
      return _mockBeaches();
    }
  }

  /// Polls a single beach's live reading — used by the background
  /// alert service to check for newly-issued hazard alerts.
  Future<IncoisReading> fetchReadingFor(String beachId) async {
    if (useMockData) {
      return _randomizedReading();
    }
    try {
      final response = await _dio.get('$_baseUrl/beaches/$beachId/reading');
      return IncoisReading.fromJson(response.data as Map<String, dynamic>);
    } catch (_) {
      return _randomizedReading();
    }
  }

  Beach _beachFromApiJson(Map<String, dynamic> json) => Beach(
        id: json['id'] as String,
        name: json['name'] as String,
        state: json['state'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        imageUrl: json['image_url'] as String? ?? '',
        reading: IncoisReading.fromJson(json['reading'] as Map<String, dynamic>),
      );

  final Random _rng = Random();

  IncoisReading _randomizedReading() => IncoisReading(
        waveHeightM: 0.2 + _rng.nextDouble() * 2.2,
        windSpeedKmph: 5 + _rng.nextDouble() * 45,
        swellPeriodSec: 4 + _rng.nextDouble() * 10,
        waterQualityIndex: 30 + _rng.nextDouble() * 70,
        highWaveAlert: _rng.nextDouble() < 0.05,
      );

  List<Beach> _mockBeaches() => [
        Beach(
          id: 'marina-chennai',
          name: 'Marina Beach',
          state: 'Tamil Nadu',
          latitude: 13.0500,
          longitude: 80.2824,
          imageUrl: 'https://images.unsplash.com/photo-1590050752117-3e0b2d9d5c1e',
          reading: const IncoisReading(
            waveHeightM: 0.9,
            windSpeedKmph: 18,
            swellPeriodSec: 7,
            waterQualityIndex: 62,
          ),
        ),
        Beach(
          id: 'calangute-goa',
          name: 'Calangute Beach',
          state: 'Goa',
          latitude: 15.5440,
          longitude: 73.7554,
          imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2',
          reading: const IncoisReading(
            waveHeightM: 0.4,
            windSpeedKmph: 11,
            swellPeriodSec: 6,
            waterQualityIndex: 85,
          ),
        ),
        Beach(
          id: 'kovalam-kerala',
          name: 'Kovalam Beach',
          state: 'Kerala',
          latitude: 8.4004,
          longitude: 76.9787,
          imageUrl: 'https://images.unsplash.com/photo-151708601594-c5a97913b21c',
          reading: const IncoisReading(
            waveHeightM: 1.6,
            windSpeedKmph: 33,
            swellPeriodSec: 11,
            waterQualityIndex: 58,
          ),
        ),
        Beach(
          id: 'puri-odisha',
          name: 'Puri Beach',
          state: 'Odisha',
          latitude: 19.7983,
          longitude: 85.8245,
          imageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206',
          reading: const IncoisReading(
            waveHeightM: 2.4,
            windSpeedKmph: 40,
            swellPeriodSec: 13,
            waterQualityIndex: 45,
            highWaveAlert: true,
          ),
        ),
        Beach(
          id: 'rk-vizag',
          name: 'RK Beach',
          state: 'Andhra Pradesh',
          latitude: 17.7104,
          longitude: 83.3244,
          imageUrl: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda',
          reading: const IncoisReading(
            waveHeightM: 0.6,
            windSpeedKmph: 14,
            swellPeriodSec: 5,
            waterQualityIndex: 74,
          ),
        ),
      ];
}
