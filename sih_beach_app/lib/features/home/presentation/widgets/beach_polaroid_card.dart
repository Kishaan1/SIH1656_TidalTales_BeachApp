import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/models/beach_model.dart';
import 'suitability_badge.dart';

/// A single beach rendered as a tilted Polaroid photo — white photo
/// "frame", thicker bottom border (like a caption strip), soft shadow,
/// and a slight rotation for that pinned-to-a-corkboard nostalgia.
class BeachPolaroidCard extends StatelessWidget {
  final Beach beach;
  final double distanceKm;
  final VoidCallback? onTap;
  final double rotationDegrees;

  const BeachPolaroidCard({
    super.key,
    required this.beach,
    required this.distanceKm,
    this.onTap,
    this.rotationDegrees = -3,
  });

  @override
  Widget build(BuildContext context) {
    final result = beach.suitability;

    return Transform.rotate(
      angle: rotationDegrees * 3.14159 / 180,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 190,
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 16),
          decoration: BoxDecoration(
            color: AppColors.creamPaper,
            borderRadius: BorderRadius.circular(4),
            boxShadow: [
              BoxShadow(
                color: AppColors.inkBrown.withValues(alpha: 0.18),
                blurRadius: 10,
                offset: const Offset(2, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: Stack(
                  children: [
                    SizedBox(
                      height: 120,
                      width: double.infinity,
                      child: CachedNetworkImage(
                        imageUrl: beach.imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.sandDeep,
                          child: const Center(
                            child: Icon(Icons.beach_access_rounded,
                                color: AppColors.creamPaper, size: 32),
                          ),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.sandDeep,
                          child: const Center(
                            child: Icon(Icons.image_not_supported_rounded,
                                color: AppColors.creamPaper),
                          ),
                        ),
                        // Faded / sun-bleached tint to match the vintage theme.
                        color: AppColors.fadedOrange.withValues(alpha: 0.08),
                        colorBlendMode: BlendMode.overlay,
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: SuitabilityBadge(result: result),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                beach.name,
                style: AppTextStyles.bodyBold,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  const Icon(Icons.place_rounded,
                      size: 12, color: AppColors.mutedInk),
                  const SizedBox(width: 2),
                  Expanded(
                    child: Text(
                      '${beach.state} · ${distanceKm.toStringAsFixed(1)} km away',
                      style: AppTextStyles.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
