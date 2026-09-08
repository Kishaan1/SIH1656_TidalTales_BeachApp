import 'package:flutter/material.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/suitability_algorithm.dart';

class SuitabilityBadge extends StatelessWidget {
  final SuitabilityResult result;
  const SuitabilityBadge({super.key, required this.result});

  IconData get _icon => switch (result.status) {
        SuitabilityStatus.safe => Icons.check_circle_rounded,
        SuitabilityStatus.moderate => Icons.warning_rounded,
        SuitabilityStatus.unsafe => Icons.dangerous_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final color = Color(result.statusColorValue);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon, size: 14, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            '${result.statusLabel} · ${result.score.toStringAsFixed(0)}',
            style: AppTextStyles.badge,
          ),
        ],
      ),
    );
  }
}
