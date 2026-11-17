import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/luxury_card.dart';

class BlessingsTab extends ConsumerStatefulWidget {
  final Microsite site;

  const BlessingsTab({super.key, required this.site});

  @override
  ConsumerState<BlessingsTab> createState() => _BlessingsTabState();
}

class _BlessingsTabState extends ConsumerState<BlessingsTab> {
  final _message = TextEditingController();
  bool _posting = false;

  String get slug => widget.site.wedding.slug;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    final text = _message.text.trim();
    if (text.isEmpty) return;
    setState(() => _posting = true);
    try {
      final b = await ref.read(repositoryProvider).postBlessing(slug, text);
      _message.clear();
      ref.invalidate(blessingsProvider(slug));
      if (mounted) showSnack(context, b.status == 'APPROVED' ? 'Your blessing is live!' : 'Thank you! It will appear once the hosts approve it.');
    } catch (e) {
      if (mounted) showSnack(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final blessings = ref.watch(blessingsProvider(slug));
    final wall = widget.site.registryEnabled ? ref.watch(donorWallProvider(slug)) : null;
    return RefreshIndicator(
      color: AppTheme.crimsonMaroon,
      onRefresh: () async {
        ref.invalidate(donorWallProvider(slug));
        ref.invalidate(blessingsProvider(slug));
        await ref.read(blessingsProvider(slug).future);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionTitle('Bless the couple', subtitle: 'Your message appears on the wall and the venue screen'),
          LuxuryCard(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              TextField(controller: _message, maxLines: 3, maxLength: 280, decoration: const InputDecoration(hintText: 'Write your blessing…')),
              ElevatedButton.icon(style: primaryButton(), onPressed: _posting ? null : _post, icon: const Icon(Icons.send, size: 16), label: Text(_posting ? 'Sending…' : 'Send blessing')),
            ]),
          ),
          if (wall != null) ...[
            const SizedBox(height: 24),
            const SectionTitle('Wall of love', subtitle: 'Everyone who gifted a piece of the home'),
            AsyncView(
              value: wall,
              builder: (entries) => entries.isEmpty
                  ? Text('Be the first to gift a square foot!', style: GoogleFonts.outfit(color: AppTheme.textMuted))
                  : Column(
                      children: entries
                          .map((d) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(backgroundColor: AppTheme.lightGold, child: Text(d.initials, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppTheme.deepGold))),
                                title: Text('${d.donorName}${d.relationship != null ? ' • ${d.relationship}' : ''}', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                                subtitle: Text([
                                  '${d.units} sq.ft. in the ${d.roomName}',
                                  if (d.blessing != null) '"${d.blessing}"',
                                ].join('\n')),
                              ))
                          .toList(),
                    ),
            ),
          ],
          const SizedBox(height: 24),
          const SectionTitle('Blessings'),
          AsyncView(
            value: blessings,
            onRetry: () => ref.invalidate(blessingsProvider(slug)),
            builder: (list) => list.isEmpty
                ? Text('No blessings yet — be the first!', style: GoogleFonts.outfit(color: AppTheme.textMuted))
                : Column(children: list.map((b) => _BlessingCard(blessing: b)).toList()),
          ),
        ],
      ),
    );
  }
}

class _BlessingCard extends StatelessWidget {
  final Blessing blessing;

  const _BlessingCard({required this.blessing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LuxuryCard(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (blessing.photoUrl != null)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: Image.network(blessing.photoUrl!, height: 200, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (blessing.message != null) Text('"${blessing.message}"', style: GoogleFonts.playfairDisplay(fontSize: 15, fontStyle: FontStyle.italic, color: AppTheme.textDark)),
              const SizedBox(height: 6),
              Text('— ${blessing.authorName}${blessing.tableNumber != null ? ' • Table ${blessing.tableNumber}' : ''}', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
            ]),
          ),
        ]),
      ),
    );
  }
}
