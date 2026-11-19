import 'package:material_ui/material_ui.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color palePine = Color(0xFFFDF0D6);
  static const Color deepBurgundy = Color(0xFF731328);
  static const Color butterYellow = Color(0xFFFEC40B);

  static const Color ivoryBackground = palePine;
  static const Color surfaceWhite = palePine;
  static const Color crimsonMaroon = deepBurgundy;
  static const Color deepCrimson = deepBurgundy;
  static const Color royalGold = butterYellow;
  static const Color primaryGold = butterYellow;
  static const Color lightGold = butterYellow;
  static const Color deepGold = deepBurgundy;
  static const Color goldBorder = deepBurgundy;
  static const Color goldCardFill = palePine;
  static const Color marigoldOrange = butterYellow;
  static const Color marigoldYellow = butterYellow;
  static const Color textDark = deepBurgundy;
  static const Color textLight = palePine;
  static const Color textMuted = deepBurgundy;
  static const Color greenVerified = deepBurgundy;
  static const Color accentEmerald = butterYellow;
  static const Color accentRose = deepBurgundy;
  static const Color surfaceCard = palePine;
  static const Color surfaceCardElevated = palePine;
  static const Color darkSurface = deepBurgundy;
  static const Color darkBackground = deepBurgundy;

  static const LinearGradient goldGradient = LinearGradient(
    colors: [butterYellow, butterYellow],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient maroonGradient = LinearGradient(
    colors: [deepBurgundy, deepBurgundy],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static ThemeData get festiveLightTheme {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: deepBurgundy,
      onPrimary: palePine,
      secondary: butterYellow,
      onSecondary: deepBurgundy,
      error: deepBurgundy,
      onError: palePine,
      surface: palePine,
      onSurface: deepBurgundy,
    );
    final text = GoogleFonts.outfit(color: deepBurgundy);
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: palePine,
      primaryColor: deepBurgundy,
      colorScheme: scheme,
      dividerColor: deepBurgundy,
      splashColor: butterYellow.withValues(alpha: 0.2),
      highlightColor: butterYellow.withValues(alpha: 0.15),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.cinzel(fontSize: 28, fontWeight: FontWeight.bold, color: deepBurgundy, letterSpacing: 1.0),
        displayMedium: GoogleFonts.playfairDisplay(fontSize: 24, fontWeight: FontWeight.w700, color: deepBurgundy),
        displaySmall: GoogleFonts.cinzel(fontSize: 20, fontWeight: FontWeight.w600, color: deepBurgundy),
        headlineMedium: text.copyWith(fontSize: 18, fontWeight: FontWeight.w600),
        titleLarge: text.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
        titleMedium: text.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
        bodyLarge: text.copyWith(fontSize: 15, height: 1.4),
        bodyMedium: text.copyWith(fontSize: 13, height: 1.4),
        bodySmall: text.copyWith(fontSize: 11),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: palePine,
        foregroundColor: deepBurgundy,
        surfaceTintColor: palePine,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: palePine,
        elevation: 0,
        shadowColor: deepBurgundy.withValues(alpha: 0.12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: deepBurgundy),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palePine,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: deepBurgundy)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: deepBurgundy)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: butterYellow, width: 2)),
        hintStyle: GoogleFonts.outfit(color: deepBurgundy.withValues(alpha: 0.55), fontSize: 13),
        labelStyle: GoogleFonts.outfit(color: deepBurgundy),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(backgroundColor: deepBurgundy, foregroundColor: palePine),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: deepBurgundy)),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(foregroundColor: deepBurgundy, side: const BorderSide(color: deepBurgundy)),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: deepBurgundy),
      dividerTheme: const DividerThemeData(color: deepBurgundy),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? deepBurgundy : palePine),
        trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? butterYellow : deepBurgundy.withValues(alpha: 0.35)),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? deepBurgundy : palePine),
        checkColor: const WidgetStatePropertyAll(palePine),
        side: const BorderSide(color: deepBurgundy),
      ),
      radioTheme: RadioThemeData(fillColor: WidgetStateProperty.all(deepBurgundy)),
      chipTheme: ChipThemeData(
        backgroundColor: palePine,
        selectedColor: butterYellow,
        labelStyle: GoogleFonts.outfit(color: deepBurgundy),
        side: const BorderSide(color: deepBurgundy),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: palePine,
        selectedItemColor: deepBurgundy,
        unselectedItemColor: deepBurgundy,
      ),
    );
  }
}
