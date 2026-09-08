import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/beach_model.dart';
import '../../data/services/incois_service.dart';
import 'location_provider.dart';

final incoisServiceProvider = Provider<IncoisService>((ref) {
  // Flip useMockData to false once your INCOIS proxy endpoint is live.
  return IncoisService(useMockData: true);
});

const _pollInterval = Duration(minutes: 5);

/// Streams the nearby-beach list, re-polling INCOIS on [_pollInterval]
/// and whenever the user's location changes meaningfully. Sorted by
/// distance so the closest beach's Polaroid card leads the scroll view.
final nearbyBeachesProvider = StreamProvider<List<Beach>>((ref) async* {
  final service = ref.watch(incoisServiceProvider);
  final locationAsync = ref.watch(locationProvider);

  final position = locationAsync.value;
  final lat = position?.latitude ?? 13.0827; // fallback: Chennai coastline
  final lon = position?.longitude ?? 80.2707;

  Future<List<Beach>> loadAndSort() async {
    final beaches = await service.fetchNearbyBeaches(lat: lat, lon: lon);
    beaches.sort(
      (a, b) => a.distanceKmFrom(lat, lon).compareTo(b.distanceKmFrom(lat, lon)),
    );
    return beaches;
  }

  yield await loadAndSort();

  yield* Stream.periodic(_pollInterval).asyncMap((_) => loadAndSort());
});

/// Currently focused beach (tapped card / map marker) for detail views.
final selectedBeachIdProvider = StateProvider<String?>((ref) => null);
