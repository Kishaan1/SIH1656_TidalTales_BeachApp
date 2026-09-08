import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import '../features/home/data/services/incois_service.dart';
import '../features/home/domain/suitability_algorithm.dart';

/// Watches the user's live location and background-polls INCOIS for the
/// nearest beach, firing a push notification the moment a hazard alert
/// (tsunami, storm surge, high wave, strong current) appears for that
/// location — even if the app is backgrounded.
///
/// Wire-up notes for production:
/// - Register this against `flutter_background_service` so the polling
///   loop below survives app backgrounding/termination on Android.
/// - On iOS, background execution is time-limited by the OS; pair this
///   with a silent push (APNs) trigger from your backend for reliable
///   wake-ups, since iOS won't run arbitrary background Dart loops
///   indefinitely.
class AlertService {
  AlertService._();
  static final AlertService instance = AlertService._();

  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  final IncoisService _incois = IncoisService(useMockData: true);

  String? _lastKnownStatusForNearestBeach;

  Future<void> initialize() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _notifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );
  }

  /// Call this from a periodic background task (WorkManager / BGTaskScheduler
  /// via flutter_background_service) — checks the nearest beach's live
  /// reading and notifies only on a *worsening* status transition, so the
  /// user isn't spammed every poll while conditions stay Unsafe.
  Future<void> checkNearestBeachAndNotify() async {
    final position = await Geolocator.getLastKnownPosition();
    if (position == null) return;

    final beaches = await _incois.fetchNearbyBeaches(
      lat: position.latitude,
      lon: position.longitude,
      radiusKm: 15, // "at or near a coastal location"
    );
    if (beaches.isEmpty) return;

    final nearest = beaches.first;
    final result = nearest.suitability;

    final statusKey = '${nearest.id}:${result.status.name}';
    final isNewOrWorsened = _lastKnownStatusForNearestBeach != statusKey &&
        result.status != SuitabilityStatus.safe;

    if (isNewOrWorsened) {
      await _showAlert(
        title: '⚠️ ${result.statusLabel} conditions at ${nearest.name}',
        body: result.reasons.first,
      );
    }
    _lastKnownStatusForNearestBeach = statusKey;
  }

  Future<void> _showAlert({required String title, required String body}) async {
    const androidDetails = AndroidNotificationDetails(
      'ocean_alerts',
      'Ocean Hazard Alerts',
      channelDescription: 'Tsunami, high wave, and storm surge warnings',
      importance: Importance.max,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    await _notifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(android: androidDetails, iOS: iosDetails),
    );
  }
}
