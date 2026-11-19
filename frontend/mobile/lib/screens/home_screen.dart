import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../data/models.dart';
import '../state/providers.dart';
import '../widgets/luxury_card.dart';
import 'register_screen.dart';
import 'security_faq_screen.dart';
import 'wedding_screen.dart';
import 'why_gift_sqft_screen.dart';

const _roleLabels = {'HOST': 'Host', 'CO_HOST': 'Co-host', 'LEAD': 'Family lead', 'VENUE': 'Venue', 'GUEST': 'Guest', 'PLATFORM': 'Platform'};

class HomeScreen extends ConsumerWidget {
  final Session session;

  const HomeScreen({super.key, required this.session});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = session.user;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.ivoryBackground,
        surfaceTintColor: Colors.transparent,
        title: Text('Plot Their Future', style: GoogleFonts.playfairDisplay(fontStyle: FontStyle.italic, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: AppTheme.crimsonMaroon),
            onSelected: (v) {
              switch (v) {
                case 'why':
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WhyGiftSqFtScreen()));
                case 'faq':
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SecurityFaqScreen()));
                case 'logout':
                  ref.read(authProvider.notifier).signOut();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'why', child: Text('Why gift a sq.ft.')),
              PopupMenuItem(value: 'faq', child: Text('Escrow, tax & privacy FAQ')),
              PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.crimsonMaroon,
        onRefresh: () => ref.read(authProvider.notifier).reload(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Namaste${user.name != null ? ', ${user.name!.split(' ').first}' : ''}', style: GoogleFonts.cinzel(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
            Text(user.phone, style: GoogleFonts.outfit(color: AppTheme.textMuted)),
            const SizedBox(height: 16),
            Text('Celebrate the wedding. Build the future.', style: GoogleFonts.playfairDisplay(fontSize: 18, fontStyle: FontStyle.italic, color: AppTheme.crimsonMaroon)),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
              icon: const Icon(Icons.favorite),
              label: const Text('Register a marriage'),
            ),
            const SizedBox(height: 12),
            const _HowCard(title: 'Gift-a-Square-Foot', body: 'Guests fund square feet, or smaller bricks, and the floor plan fills in as blessings arrive.'),
            const _HowCard(title: 'Invites and RSVP', body: 'After approval, add guests, choose ceremonies, and send the wedding link on WhatsApp.'),
            const _HowCard(title: 'Voluntary, always', body: 'Presence comes first. Gifting is optional and a square foot is not ownership of the home.'),
            const SizedBox(height: 8),
            if (session.weddings.isEmpty)
              LuxuryCard(
                child: Column(children: [
                  const Icon(Icons.mail_outline, color: AppTheme.crimsonMaroon, size: 40),
                  const SizedBox(height: 8),
                  Text('No invitations yet', style: GoogleFonts.playfairDisplay(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(
                    'Celebrations appear here once the couple adds ${user.phone} to their guest list. Pull down to refresh.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(color: AppTheme.textMuted),
                  ),
                ]),
              )
            else
              ...session.weddings.map((w) => _WeddingCard(wedding: w)),
          ],
        ),
      ),
    );
  }
}

class _HowCard extends StatelessWidget {
  final String title;
  final String body;

  const _HowCard({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: LuxuryCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(body, style: GoogleFonts.outfit(fontSize: 13, color: AppTheme.textMuted)),
        ]),
      ),
    );
  }
}

class _WeddingCard extends StatelessWidget {
  final AccessibleWedding wedding;

  const _WeddingCard({required this.wedding});

  @override
  Widget build(BuildContext context) {
    final cover = wedding.coverPhotoUrl;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: LuxuryCard(
        padding: EdgeInsets.zero,
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WeddingScreen(slug: wedding.slug))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            child: SizedBox(
              height: 150,
              child: cover != null
                  ? Image.network(cover, fit: BoxFit.cover, errorBuilder: (_, _, _) => Image.asset('assets/images/couple_portrait.jpg', fit: BoxFit.cover))
                  : Image.asset('assets/images/couple_portrait.jpg', fit: BoxFit.cover),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(wedding.couple, style: GoogleFonts.playfairDisplay(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
                  Text(wedding.weddingDate != null ? Formatters.dateLong(wedding.weddingDate!) : 'Date to be announced', style: GoogleFonts.outfit(color: AppTheme.textMuted)),
                  if (wedding.approvalStatus != null && wedding.approvalStatus != 'APPROVED')
                    Text(wedding.approvalStatus!.replaceAll('_', ' '), style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.deepGold, fontWeight: FontWeight.bold)),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppTheme.lightGold, borderRadius: BorderRadius.circular(20)),
                child: Text(_roleLabels[wedding.role] ?? wedding.role, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.deepGold)),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
