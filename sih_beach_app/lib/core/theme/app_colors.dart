import 'package:flutter/material.dart';

/// Faded pastel sunset palette — warm oranges, soft pinks,
/// retro teal ocean blues, sandy beige. Evokes an old
/// beach-trip Polaroid rather than a crisp modern app.
class AppColors {
  AppColors._();

  // Backgrounds
  static const Color sand = Color(0xFFF3E4D2);
  static const Color sandDeep = Color(0xFFE7D2B4);
  static const Color creamPaper = Color(0xFFFAF1E4);

  // Sunset warms
  static const Color fadedOrange = Color(0xFFE8935B);
  static const Color coral = Color(0xFFE28C7B);
  static const Color softPink = Color(0xFFEBB6AE);
  static const Color dustyRose = Color(0xFFD98E8E);

  // Ocean cools
  static const Color retroTeal = Color(0xFF3F8C88);
  static const Color deepTeal = Color(0xFF2C6462);
  static const Color seaFoam = Color(0xFFA9CFC8);
  static const Color duskBlue = Color(0xFF4A6C82);

  // Text
  static const Color inkBrown = Color(0xFF4A3B31);
  static const Color mutedInk = Color(0xFF7C6B5F);

  // Suitability status colors (color-blind-considerate, muted to match theme)
  static const Color statusSafe = Color(0xFF3F8C88); // teal
  static const Color statusModerate = Color(0xFFE8935B); // faded orange
  static const Color statusUnsafe = Color(0xFFC4574B); // muted brick red

  static const List<Color> sunsetGradient = [
    Color(0xFFF3E4D2), // sand
    Color(0xFFE8B88F), // warm peach
    Color(0xFFE28C7B), // coral
    Color(0xFFD98E8E), // dusty rose
  ];
}
