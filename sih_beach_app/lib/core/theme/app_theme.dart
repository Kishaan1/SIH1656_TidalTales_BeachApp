import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_text_styles.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.creamPaper,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.retroTeal,
          primary: AppColors.retroTeal,
          secondary: AppColors.fadedOrange,
          surface: AppColors.creamPaper,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.sand,
          elevation: 0,
          titleTextStyle: AppTextStyles.heading,
          iconTheme: const IconThemeData(color: AppColors.inkBrown),
        ),
        textTheme: TextTheme(
          headlineMedium: AppTextStyles.heading,
          titleMedium: AppTextStyles.subheading,
          bodyMedium: AppTextStyles.body,
          bodyLarge: AppTextStyles.bodyBold,
          labelSmall: AppTextStyles.caption,
        ),
        fontFamily: 'Inter',
      );
}
