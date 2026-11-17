import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme/app_theme.dart';
import '../data/api_client.dart';

String errorText(Object error) => error is ApiException ? error.message : 'Something went wrong. Please try again.';

void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message, style: GoogleFonts.outfit()),
      backgroundColor: error ? AppTheme.crimsonMaroon : AppTheme.textDark,
      behavior: SnackBarBehavior.floating,
    ));
}

Future<void> openLink(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showSnack(context, 'Could not open $url', error: true);
}

/// Renders loading / error / data for an [AsyncValue], with pull-to-retry on errors.
class AsyncView<T> extends StatelessWidget {
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;

  const AsyncView({super.key, required this.value, required this.builder, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return switch (value) {
      AsyncData(:final value) => builder(value),
      AsyncError(:final error) => ErrorPanel(message: errorText(error), onRetry: onRetry),
      _ => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: AppTheme.royalGold))),
    };
  }
}

class ErrorPanel extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const ErrorPanel({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off, color: AppTheme.royalGold, size: 40),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: GoogleFonts.outfit(color: AppTheme.textMuted)),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ]),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final String? subtitle;

  const SectionTitle(this.title, {super.key, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: GoogleFonts.cinzel(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
      if (subtitle != null) Text(subtitle!, style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted)),
      const SizedBox(height: 12),
    ]);
  }
}

class GoldProgressBar extends StatelessWidget {
  final double value;
  final double height;
  final Color track;

  const GoldProgressBar({super.key, required this.value, this.height = 10, this.track = const Color(0xFFEADFCB)});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Container(
        height: height,
        color: track,
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: value.clamp(0.0, 1.0),
          child: Container(decoration: const BoxDecoration(gradient: AppTheme.goldGradient)),
        ),
      ),
    );
  }
}

IconData roomIcon(String? icon) => switch (icon) {
      'weekend' => Icons.weekend_outlined,
      'king_bed' => Icons.king_bed_outlined,
      'single_bed' => Icons.single_bed_outlined,
      'balcony' => Icons.balcony_outlined,
      'kitchen' => Icons.kitchen_outlined,
      'bathtub' => Icons.bathtub_outlined,
      _ => Icons.home_outlined,
    };

ButtonStyle primaryButton({bool gold = false}) => ElevatedButton.styleFrom(
      backgroundColor: gold ? AppTheme.royalGold : AppTheme.crimsonMaroon,
      foregroundColor: gold ? AppTheme.textDark : Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      textStyle: GoogleFonts.outfit(fontWeight: FontWeight.bold),
    );
