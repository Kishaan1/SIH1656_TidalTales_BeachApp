import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// Exposes the user's current position as a Riverpod stream so any
/// widget (map, distance labels, background alert checker) can react
/// to movement without manually wiring callbacks.
final locationProvider = StreamProvider<Position>((ref) async* {
  final hasPermission = await _ensurePermission();
  if (!hasPermission) {
    throw Exception(
      'Location permission denied — enable it in Settings to see nearby beaches.',
    );
  }

  // Emit the last known fix immediately for a fast first paint, then
  // switch to the live stream for subsequent updates.
  final last = await Geolocator.getLastKnownPosition();
  if (last != null) yield last;

  yield* Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 100, // meters — re-emit only on meaningful movement
    ),
  );
});

Future<bool> _ensurePermission() async {
  if (!await Geolocator.isLocationServiceEnabled()) return false;

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  return permission == LocationPermission.always ||
      permission == LocationPermission.whileInUse;
}
