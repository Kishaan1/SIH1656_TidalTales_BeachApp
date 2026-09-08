import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/models/beach_model.dart';
import '../providers/beach_list_provider.dart';
import '../providers/location_provider.dart';
import '../widgets/beach_polaroid_card.dart';
import '../widgets/vintage_map_view.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locationAsync = ref.watch(locationProvider);
    final beachesAsync = ref.watch(nearbyBeachesProvider);

    return Scaffold(
      backgroundColor: AppColors.creamPaper,
      body: SafeArea(
        child: Column(
          children: [
            _Header(),
            Expanded(
              child: locationAsync.when(
                loading: () => const _CenteredLoader(
                  message: 'Finding your spot on the coast…',
                ),
                error: (err, _) => _LocationError(message: err.toString()),
                data: (position) {
                  final center = LatLng(position.latitude, position.longitude);
                  return Stack(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: beachesAsync.when(
                          loading: () => VintageMapView(center: center, beaches: const []),
                          error: (_, __) => VintageMapView(center: center, beaches: const []),
                          data: (beaches) => VintageMapView(
                            center: center,
                            beaches: beaches,
                            onMarkerTap: (beach) =>
                                ref.read(selectedBeachIdProvider.notifier).state = beach.id,
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: _BeachCardStrip(
                          beachesAsync: beachesAsync,
                          userLat: position.latitude,
                          userLon: position.longitude,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Tidal Tales', style: AppTextStyles.heading),
              Text('Your beach day, checked in advance ☀️',
                  style: AppTextStyles.caption),
            ],
          ),
          CircleAvatar(
            backgroundColor: AppColors.sandDeep,
            child: const Icon(Icons.notifications_rounded,
                color: AppColors.inkBrown),
          ),
        ],
      ),
    );
  }
}

class _CenteredLoader extends StatelessWidget {
  final String message;
  const _CenteredLoader({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.retroTeal),
          const SizedBox(height: 12),
          Text(message, style: AppTextStyles.body),
        ],
      ),
    );
  }
}

class _LocationError extends StatelessWidget {
  final String message;
  const _LocationError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_off_rounded,
                size: 40, color: AppColors.dustyRose),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.body,
            ),
          ],
        ),
      ),
    );
  }
}

/// Horizontal scroll strip of Polaroid beach cards, docked to the
/// bottom of the map like a stack of photos from a beach trip.
class _BeachCardStrip extends StatelessWidget {
  final AsyncValue<List<Beach>> beachesAsync;
  final double userLat;
  final double userLon;

  const _BeachCardStrip({
    required this.beachesAsync,
    required this.userLat,
    required this.userLon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 220,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, AppColors.creamPaper],
          stops: [0.0, 0.35],
        ),
      ),
      child: beachesAsync.when(
        loading: () => const _CenteredLoader(message: 'Checking live ocean conditions…'),
        error: (err, _) => Center(
          child: Text('Could not load beaches.\n$err',
              textAlign: TextAlign.center, style: AppTextStyles.caption),
        ),
        data: (beaches) => ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
          itemCount: beaches.length,
          itemBuilder: (context, index) {
            final beach = beaches[index];
            return BeachPolaroidCard(
              beach: beach,
              distanceKm: beach.distanceKmFrom(userLat, userLon),
              rotationDegrees: index.isEven ? -3 : 2,
              onTap: () => _showBeachDetail(context, beach),
            );
          },
        ),
      ),
    );
  }

  void _showBeachDetail(BuildContext context, Beach beach) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.creamPaper,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(beach.name, style: AppTextStyles.heading),
            const SizedBox(height: 4),
            Text(beach.state, style: AppTextStyles.caption),
            const SizedBox(height: 16),
            ...beach.suitability.reasons.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    const Icon(Icons.circle, size: 6, color: AppColors.mutedInk),
                    const SizedBox(width: 8),
                    Expanded(child: Text(r, style: AppTextStyles.body)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
