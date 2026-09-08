import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Blend of a bubbly/retro display font (Pacifico, via Google Fonts —
/// swap for the bundled Cooper-Black-alike asset if you want a licensed
/// look-alike) for headings, and Inter for data-dense, readable body text.
class AppTextStyles {
  AppTextStyles._();

  static TextStyle heading = GoogleFonts.pacifico(
    fontSize: 28,
    color: AppColors.inkBrown,
    height: 1.2,
  );

  static TextStyle subheading = GoogleFonts.pacifico(
    fontSize: 18,
    color: AppColors.deepTeal,
  );

  static TextStyle bodyBold = GoogleFonts.inter(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppColors.inkBrown,
  );

  static TextStyle body = GoogleFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.mutedInk,
  );

  static TextStyle caption = GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.mutedInk,
    letterSpacing: 0.4,
  );

  static TextStyle badge = GoogleFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.5,
  );
}
