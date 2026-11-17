import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/config.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/luxury_card.dart';
import '../live_stage_screen.dart';

class HostTab extends ConsumerWidget {
  final Microsite site;

  const HostTab({super.key, required this.site});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slug = site.wedding.slug;
    final role = site.role;
    return RefreshIndicator(
      color: AppTheme.crimsonMaroon,
      onRefresh: () async {
        if (adminRoles.contains(role)) ref.invalidate(dashboardProvider(slug));
        if (senderRoles.contains(role)) ref.invalidate(dispatchesProvider(slug));
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            Expanded(
              child: ElevatedButton.icon(
                style: primaryButton(),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LiveStageScreen(slug: slug))),
                icon: const Icon(Icons.tv),
                label: const Text('Stage screen'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () => openLink(context, '${AppConfig.webUrl}/admin/$slug'),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Full console'),
              ),
            ),
          ]),
          if (adminRoles.contains(role)) ...[
            const SizedBox(height: 20),
            _DashboardCard(slug: slug),
          ],
          if (senderRoles.contains(role)) ...[
            const SizedBox(height: 20),
            _DispatchCard(slug: slug),
          ],
        ],
      ),
    );
  }
}

class _DashboardCard extends ConsumerWidget {
  final String slug;

  const _DashboardCard({required this.slug});

  Widget _stat(String label, String value, [String? sub]) => Expanded(
        child: LuxuryCard(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: GoogleFonts.outfit(fontSize: 10, letterSpacing: 1, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
            const SizedBox(height: 4),
            Text(value, style: GoogleFonts.playfairDisplay(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
            if (sub != null) Text(sub, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.textMuted)),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncView(
      value: ref.watch(dashboardProvider(slug)),
      onRetry: () => ref.invalidate(dashboardProvider(slug)),
      builder: (d) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SectionTitle('At a glance'),
        Row(children: [
          _stat('Home gifted', Formatters.percent(d.registry.progress), '${d.registry.fundedSft}/${d.registry.totalSft} sq.ft.'),
          const SizedBox(width: 8),
          _stat('In escrow', Formatters.inrCompact(d.creditedPaise), '${d.contributors} gifts'),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          _stat('Guests', '${d.guests}', '${d.responded} responded'),
          const SizedBox(width: 8),
          _stat('Attending', '${d.attending}', '${d.headcount} people'),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          _stat('Invites sent', '${d.sent}', d.failed > 0 ? '${d.failed} failed' : null),
          const SizedBox(width: 8),
          _stat('Available', Formatters.inrCompact(d.availablePaise), 'to settle'),
        ]),
      ]),
    );
  }
}

class _DispatchCard extends ConsumerStatefulWidget {
  final String slug;

  const _DispatchCard({required this.slug});

  @override
  ConsumerState<_DispatchCard> createState() => _DispatchCardState();
}

class _DispatchCardState extends ConsumerState<_DispatchCard> {
  final Set<String> _cohorts = {};
  final Set<String> _ceremonies = {};
  bool _includeRegistry = true;
  bool _onlyPending = false;
  int? _recipients;
  bool _sending = false;

  Map<String, dynamic> get _body => {
        if (_cohorts.isNotEmpty) 'cohorts': _cohorts.toList(),
        if (_ceremonies.isNotEmpty) 'ceremonyIds': _ceremonies.toList(),
        'includeRegistry': _includeRegistry,
        'onlyPendingRsvp': _onlyPending,
      };

  @override
  void initState() {
    super.initState();
    _preview();
  }

  Future<void> _preview() async {
    setState(() => _recipients = null);
    try {
      final n = await ref.read(repositoryProvider).dispatchPreview(widget.slug, _body);
      if (mounted) setState(() => _recipients = n);
    } catch (e) {
      if (mounted) showSnack(context, errorText(e), error: true);
    }
  }

  Future<void> _send() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Send invitations?'),
        content: Text('Personalised WhatsApp invitations will go to $_recipients guests.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _sending = true);
    try {
      final d = await ref.read(repositoryProvider).createDispatch(widget.slug, _body);
      ref.invalidate(dispatchesProvider(widget.slug));
      if (mounted) showSnack(context, 'Sending ${d.total} invitations');
    } catch (e) {
      if (mounted) showSnack(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ceremonies = ref.watch(ceremoniesProvider(widget.slug)).value ?? const [];
    final history = ref.watch(dispatchesProvider(widget.slug));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionTitle('WhatsApp invitations', subtitle: 'Each guest gets a private, personalised link'),
      LuxuryCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Cohorts (none = everyone)', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
          Wrap(spacing: 6, children: [
            for (final e in cohortLabels.entries)
              FilterChip(
                label: Text(e.value),
                selected: _cohorts.contains(e.key),
                selectedColor: AppTheme.lightGold,
                onSelected: (v) {
                  setState(() => v ? _cohorts.add(e.key) : _cohorts.remove(e.key));
                  _preview();
                },
              ),
          ]),
          if (ceremonies.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Invited to (none = any)', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
            Wrap(spacing: 6, children: [
              for (final c in ceremonies)
                FilterChip(
                  label: Text(c.title),
                  selected: _ceremonies.contains(c.id),
                  selectedColor: AppTheme.lightGold,
                  onSelected: (v) {
                    setState(() => v ? _ceremonies.add(c.id) : _ceremonies.remove(c.id));
                    _preview();
                  },
                ),
            ]),
          ],
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppTheme.crimsonMaroon,
            title: const Text('Mention the home gift registry'),
            value: _includeRegistry,
            onChanged: (v) {
              setState(() => _includeRegistry = v);
              _preview();
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppTheme.crimsonMaroon,
            title: const Text('Only guests who haven\'t replied'),
            value: _onlyPending,
            onChanged: (v) {
              setState(() => _onlyPending = v);
              _preview();
            },
          ),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            style: primaryButton(),
            onPressed: _sending || (_recipients ?? 0) == 0 ? null : _send,
            icon: const Icon(Icons.send),
            label: Text(_recipients == null ? 'Counting…' : 'Send to $_recipients guests'),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      AsyncView(
        value: history,
        builder: (list) => Column(
          children: list
              .map((d) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.history, color: AppTheme.royalGold),
                    title: Text(Formatters.dateTime(d.createdAt), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                    subtitle: Text('${d.sent}/${d.total} sent • ${d.queued} queued • ${d.failed} failed${d.cohorts.isEmpty ? '' : '\n${d.cohorts.map((c) => cohortLabels[c] ?? c).join(', ')}'}'),
                  ))
              .toList(),
        ),
      ),
    ]);
  }
}
