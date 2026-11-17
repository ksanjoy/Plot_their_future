import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../data/models.dart';
import '../state/providers.dart';
import 'common.dart';

const _relationships = ['Family', 'Cousin', 'Uncle / Aunt', 'Friend', 'Colleague', 'Neighbour', 'Family friend'];

Future<void> showGiftSheet(BuildContext context, {required Microsite site, required RegistryState registry, String? roomKey}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppTheme.ivoryBackground,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      builder: (_, controller) => _GiftForm(site: site, registry: registry, initialRoom: roomKey, controller: controller),
    ),
  );
}

class _GiftForm extends ConsumerStatefulWidget {
  final Microsite site;
  final RegistryState registry;
  final String? initialRoom;
  final ScrollController controller;

  const _GiftForm({required this.site, required this.registry, this.initialRoom, required this.controller});

  @override
  ConsumerState<_GiftForm> createState() => _GiftFormState();
}

class _GiftFormState extends ConsumerState<_GiftForm> {
  late String? _roomKey;
  late int _units;
  final _custom = TextEditingController();
  late final TextEditingController _name;
  final _blessing = TextEditingController();
  String? _relationship;
  bool _anonymous = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final open = widget.registry.rooms.where((r) => r.openSft > 0);
    _roomKey = widget.initialRoom ?? (open.isEmpty ? null : open.first.key);
    final tiers = widget.registry.summary.presetTiers;
    _units = tiers.isEmpty ? 1 : tiers.first;
    _name = TextEditingController(text: widget.site.invitation?.guestName ?? '');
  }

  @override
  void dispose() {
    _custom.dispose();
    _name.dispose();
    _blessing.dispose();
    super.dispose();
  }

  int get _selectedUnits => _custom.text.isNotEmpty ? (int.tryParse(_custom.text) ?? 0) : _units;

  Future<void> _submit() async {
    final roomKey = _roomKey;
    if (roomKey == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final c = await ref.read(repositoryProvider).lockTiles(
            slug: widget.site.wedding.slug,
            roomKey: roomKey,
            units: _selectedUnits,
            donorName: _name.text.trim(),
            relationship: _relationship,
            blessing: _blessing.text.trim(),
            anonymous: _anonymous,
            refLead: widget.site.invitation?.refLead,
          );
      ref.invalidate(registryProvider(widget.site.wedding.slug));
      ref.invalidate(myGiftsProvider(widget.site.wedding.slug));
      if (!mounted) return;
      Navigator.of(context).pop();
      final url = c.links.checkoutUrl;
      if (url != null) {
        showSnack(context, 'Square feet reserved. Complete the payment in your browser.');
        await openLink(context, url);
      }
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reg = widget.registry;
    final rate = reg.summary.ratePerSftPaise;
    final room = reg.rooms.where((r) => r.key == _roomKey).firstOrNull;
    final units = _selectedUnits;
    final over = room == null || units > room.openSft;
    final label = GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8);

    if (reg.rooms.every((r) => r.openSft <= 0)) {
      return Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('Every square foot has been gifted. Thank you for your love!', textAlign: TextAlign.center, style: GoogleFonts.playfairDisplay(fontSize: 18, color: AppTheme.crimsonMaroon))));
    }

    return ListView(
      controller: widget.controller,
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)))),
        const SizedBox(height: 12),
        Text('Gift square feet', style: GoogleFonts.cinzel(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
        const SizedBox(height: 16),
        Text('1. CHOOSE A ROOM', style: label),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final r in reg.rooms)
            ChoiceChip(
              avatar: Icon(roomIcon(r.icon), size: 16, color: _roomKey == r.key ? Colors.white : AppTheme.crimsonMaroon),
              label: Text('${r.name} • ${r.openSft} open'),
              selected: _roomKey == r.key,
              selectedColor: AppTheme.crimsonMaroon,
              labelStyle: GoogleFonts.outfit(color: _roomKey == r.key ? Colors.white : AppTheme.textDark, fontSize: 12),
              onSelected: r.openSft > 0 ? (_) => setState(() => _roomKey = r.key) : null,
            ),
        ]),
        const SizedBox(height: 16),
        Text('2. HOW MANY SQUARE FEET?', style: label),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final t in reg.summary.presetTiers)
            ChoiceChip(
              label: Text('$t sq.ft. • ${Formatters.inr(t * rate)}'),
              selected: _custom.text.isEmpty && _units == t,
              selectedColor: AppTheme.lightGold,
              onSelected: (_) => setState(() {
                _units = t;
                _custom.clear();
              }),
            ),
        ]),
        const SizedBox(height: 8),
        TextField(
          controller: _custom,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Or enter custom sq.ft.'),
          onChanged: (_) => setState(() {}),
        ),
        if (over && room != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Only ${room.openSft} sq.ft. are still open in the ${room.name}.', style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon, fontSize: 12))),
        const SizedBox(height: 16),
        TextField(controller: _name, maxLength: 80, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Your name on the gift', counterText: '')),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _relationship,
          decoration: const InputDecoration(labelText: 'Relationship to the couple'),
          items: _relationships.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
          onChanged: (v) => setState(() => _relationship = v),
        ),
        const SizedBox(height: 12),
        TextField(controller: _blessing, maxLines: 3, maxLength: 500, decoration: const InputDecoration(labelText: 'Your blessing (optional)')),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: AppTheme.crimsonMaroon,
          title: const Text('Gift anonymously'),
          subtitle: const Text('Shown as "A Well-Wisher" on the wall'),
          value: _anonymous,
          onChanged: (v) => setState(() => _anonymous = v),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: AppTheme.maroonGradient, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('YOUR GIFT', style: GoogleFonts.outfit(fontSize: 11, letterSpacing: 2, color: AppTheme.lightGold)),
                Text(Formatters.inr(units * rate), style: GoogleFonts.cinzel(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
                Text('$units sq.ft. • held ${(reg.summary.holdTtlSec / 60).round()} min while you pay', style: GoogleFonts.outfit(fontSize: 11, color: Colors.white70)),
              ]),
            ),
            ElevatedButton(
              style: primaryButton(gold: true),
              onPressed: _busy || over || units < 1 || (!_anonymous && _name.text.trim().isEmpty) ? null : _submit,
              child: Text(_busy ? 'Reserving…' : 'Reserve & pay'),
            ),
          ]),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon))),
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.verified_user, size: 14, color: AppTheme.greenVerified),
          const SizedBox(width: 6),
          Expanded(child: Text('Paid into RBI tripartite escrow • Sec 56(2)(x) marriage-gift exemption', style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.textMuted))),
        ]),
      ],
    );
  }
}
