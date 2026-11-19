import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/countdown_timer.dart';
import '../../widgets/luxury_card.dart';
import '../../widgets/rsvp_sheet.dart';

String _calendarUrl(Ceremony c, Wedding w) {
  String fmt(DateTime d) => '${d.toUtc().toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.').first}Z';
  final end = c.endsAt ?? c.startsAt.add(const Duration(hours: 3));
  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': '${c.title} • ${w.firstNames}',
    'dates': '${fmt(c.startsAt)}/${fmt(end)}',
    'location': [c.venueName, c.venueAddress].whereType<String>().join(', '),
    'details': c.description ?? '',
  }).toString();
}

class InvitationTab extends ConsumerWidget {
  final Microsite site;

  const InvitationTab({super.key, required this.site});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final w = site.wedding;
    final cover = w.coverPhotoUrl;
    return RefreshIndicator(
      color: AppTheme.crimsonMaroon,
      onRefresh: () => ref.refresh(micrositeProvider(w.slug).future),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Stack(children: [
            Positioned.fill(
              child: cover != null
                  ? Image.network(cover, fit: BoxFit.cover, errorBuilder: (_, _, _) => Image.asset('assets/images/hero_banner.jpg', fit: BoxFit.cover))
                  : Image.asset('assets/images/hero_banner.jpg', fit: BoxFit.cover),
            ),
            Positioned.fill(child: Container(decoration: BoxDecoration(gradient: LinearGradient(colors: [AppTheme.deepBurgundy.withValues(alpha: 0.25), AppTheme.deepCrimson.withValues(alpha: 0.92)], begin: Alignment.topCenter, end: Alignment.bottomCenter)))),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 48, 20, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  site.invitation != null ? 'NAMASTE ${site.invitation!.guestName.split(' ').first.toUpperCase()}, YOU\'RE INVITED' : 'THE WEDDING OF',
                  style: GoogleFonts.outfit(fontSize: 11, letterSpacing: 2.5, fontWeight: FontWeight.w600, color: AppTheme.lightGold),
                ),
                const SizedBox(height: 8),
                Text(w.brideName, style: GoogleFonts.cinzel(fontSize: 30, fontWeight: FontWeight.bold, color: AppTheme.palePine)),
                Text('&', style: GoogleFonts.playfairDisplay(fontSize: 24, fontStyle: FontStyle.italic, color: AppTheme.lightGold)),
                Text(w.groomName, style: GoogleFonts.cinzel(fontSize: 30, fontWeight: FontWeight.bold, color: AppTheme.palePine)),
                const SizedBox(height: 10),
                if (w.weddingDate != null)
                  Text('${Formatters.weekday(w.weddingDate!)}, ${Formatters.dateLong(w.weddingDate!)}${w.city != null ? ' • ${w.city}' : ''}',
                      style: GoogleFonts.outfit(color: AppTheme.palePine.withValues(alpha: 0.9))),
                if (w.weddingDate != null) ...[
                  const SizedBox(height: 16),
                  CountdownTimerWidget(target: w.weddingDate!),
                ],
                const SizedBox(height: 18),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  if (site.invitation != null)
                    ElevatedButton.icon(
                      style: primaryButton(gold: true),
                      onPressed: () => showRsvpSheet(context, w.slug),
                      icon: const Icon(Icons.how_to_reg, size: 18),
                      label: Text(site.rsvp == null ? 'RSVP now' : 'RSVP: ${site.rsvp!.status.toLowerCase()}'),
                    ),
                  if (w.videoInviteUrl != null)
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(foregroundColor: AppTheme.palePine, side: const BorderSide(color: AppTheme.palePine), shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
                      onPressed: () => openLink(context, w.videoInviteUrl!),
                      icon: const Icon(Icons.play_circle_outline, size: 18),
                      label: const Text('Video invitation'),
                    ),
                ]),
              ]),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (w.welcomeNote != null) ...[
                LuxuryCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('A note from the couple', style: GoogleFonts.cinzel(fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
                    const SizedBox(height: 8),
                    Text(w.welcomeNote!, style: GoogleFonts.playfairDisplay(fontSize: 15, fontStyle: FontStyle.italic, height: 1.5, color: AppTheme.textDark)),
                  ]),
                ),
                const SizedBox(height: 20),
              ],
              SectionTitle('Your itinerary', subtitle: site.isStaff ? 'All ceremonies' : 'The ceremonies you\'re invited to'),
              if (site.ceremonies.isEmpty)
                Text('The itinerary will be shared soon.', style: GoogleFonts.outfit(color: AppTheme.textMuted))
              else
                ...site.ceremonies.map((c) => _CeremonyCard(ceremony: c, wedding: w)),
            ]),
          ),
        ],
      ),
    );
  }
}

class _CeremonyCard extends StatelessWidget {
  final Ceremony ceremony;
  final Wedding wedding;

  const _CeremonyCard({required this.ceremony, required this.wedding});

  @override
  Widget build(BuildContext context) {
    final c = ceremony;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: LuxuryCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 64,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(gradient: AppTheme.goldGradient, borderRadius: BorderRadius.circular(12)),
              child: Column(children: [
                Text(Formatters.dayShort(c.startsAt).toUpperCase(), style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                Text(Formatters.time(c.startsAt), style: GoogleFonts.cinzel(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              ]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.title, style: GoogleFonts.playfairDisplay(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                Text([c.venueName, c.venueAddress].whereType<String>().join(', '), style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted)),
                if (c.dressCode != null) Text('Dress code: ${c.dressCode}', style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.deepGold)),
                if (c.description != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(c.description!, style: GoogleFonts.outfit(fontSize: 13, color: AppTheme.textDark))),
              ]),
            ),
          ]),
          const SizedBox(height: 8),
          Wrap(spacing: 4, children: [
            if (c.venueMapsUrl != null) TextButton.icon(onPressed: () => openLink(context, c.venueMapsUrl!), icon: const Icon(Icons.map_outlined, size: 16), label: const Text('Map')),
            if (c.streamUrl != null) TextButton.icon(onPressed: () => openLink(context, c.streamUrl!), icon: const Icon(Icons.live_tv, size: 16), label: const Text('Live')),
            TextButton.icon(onPressed: () => openLink(context, _calendarUrl(c, wedding)), icon: const Icon(Icons.event_available, size: 16), label: const Text('Add to calendar')),
          ]),
        ]),
      ),
    );
  }
}
