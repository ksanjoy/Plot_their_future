import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../data/models.dart';
import '../state/providers.dart';
import 'common.dart';

Future<void> showRsvpSheet(BuildContext context, String slug) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppTheme.ivoryBackground,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      builder: (_, controller) => _RsvpLoader(slug: slug, controller: controller),
    ),
  );
}

class _RsvpLoader extends ConsumerStatefulWidget {
  final String slug;
  final ScrollController controller;

  const _RsvpLoader({required this.slug, required this.controller});

  @override
  ConsumerState<_RsvpLoader> createState() => _RsvpLoaderState();
}

class _RsvpLoaderState extends ConsumerState<_RsvpLoader> {
  late Future<MyRsvp> _future = ref.read(repositoryProvider).myRsvp(widget.slug);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MyRsvp>(
      future: _future,
      builder: (context, snap) {
        if (snap.hasError) {
          return ErrorPanel(message: errorText(snap.error!), onRetry: () => setState(() => _future = ref.read(repositoryProvider).myRsvp(widget.slug)));
        }
        if (!snap.hasData) return const Center(child: CircularProgressIndicator(color: AppTheme.royalGold));
        return _RsvpForm(slug: widget.slug, data: snap.data!, controller: widget.controller);
      },
    );
  }
}

class _RsvpForm extends ConsumerStatefulWidget {
  final String slug;
  final MyRsvp data;
  final ScrollController controller;

  const _RsvpForm({required this.slug, required this.data, required this.controller});

  @override
  ConsumerState<_RsvpForm> createState() => _RsvpFormState();
}

class _RsvpFormState extends ConsumerState<_RsvpForm> {
  late String _status;
  late int _adults;
  late int _children;
  late int _infants;
  late Set<String> _ceremonies;
  late Map<String, String> _ceremonyStatus;
  late Set<String> _dietary;
  String? _food;
  int _rooms = 1;
  int _people = 1;
  String? _arrivalMode;
  late bool _accommodation;
  late bool _shuttle;
  DateTime? _checkIn;
  DateTime? _checkOut;
  late final TextEditingController _occupation;
  late final TextEditingController _name;
  late final TextEditingController _allergies;
  late final TextEditingController _arrivalDetails;
  late final TextEditingController _note;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final r = widget.data.rsvp;
    _status = r?.status ?? 'ATTENDING';
    _adults = (r?.adults ?? 0) > 0 ? r!.adults : 1;
    _children = r?.children ?? 0;
    _infants = r?.infants ?? 0;
    _ceremonies = {...(r?.attendingCeremonyIds ?? widget.data.invitedCeremonies.map((c) => c.id))};
    _ceremonyStatus = {for (final c in widget.data.invitedCeremonies) c.id: _ceremonies.contains(c.id) ? 'ATTENDING' : 'DECLINED'};
    _dietary = {...?r?.dietary};
    _arrivalMode = r?.arrivalMode;
    _accommodation = r?.needsAccommodation ?? false;
    _shuttle = r?.needsShuttle ?? false;
    _checkIn = r?.checkInDate;
    _checkOut = r?.checkOutDate;
    _name = TextEditingController(text: widget.data.guestName);
    _occupation = TextEditingController();
    _allergies = TextEditingController(text: r?.allergies ?? '');
    _arrivalDetails = TextEditingController(text: r?.arrivalDetails ?? '');
    _note = TextEditingController(text: r?.note ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _occupation.dispose();
    _allergies.dispose();
    _arrivalDetails.dispose();
    _note.dispose();
    super.dispose();
  }

  String? _day(DateTime? d) => d == null ? null : '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(repositoryProvider).saveRsvp(widget.slug, {
        'status': _status,
        'adults': _adults,
        'children': _children,
        'infants': _infants,
        'attendingCeremonyIds': _status == 'DECLINED' ? <String>[] : _ceremonyStatus.entries.where((e) => e.value != 'DECLINED').map((e) => e.key).toList(),
        'ceremonyResponses': _status == 'DECLINED'
            ? <Json>[]
            : _ceremonyStatus.entries
                .map((e) => {'ceremonyId': e.key, 'status': e.value, 'adults': e.value == 'DECLINED' ? 0 : _adults, 'children': e.value == 'DECLINED' ? 0 : _children})
                .toList(),
        'dietary': _dietary.toList(),
        'foodPreference': _status == 'DECLINED' ? null : _food,
        'occupation': _occupation.text.trim().isEmpty ? null : _occupation.text.trim(),
        'accommodationRooms': _status != 'DECLINED' && _accommodation ? _rooms : 0,
        'accommodationGuests': _status != 'DECLINED' && _accommodation ? _people : 0,
        'allergies': _allergies.text.trim().isEmpty ? null : _allergies.text.trim(),
        'arrivalMode': _arrivalMode,
        'arrivalDetails': _arrivalDetails.text.trim().isEmpty ? null : _arrivalDetails.text.trim(),
        'needsAccommodation': _accommodation,
        'checkInDate': _accommodation ? _day(_checkIn) : null,
        'checkOutDate': _accommodation ? _day(_checkOut) : null,
        'needsShuttle': _shuttle,
        'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
        'guestName': _name.text.trim(),
      });
      ref.invalidate(micrositeProvider(widget.slug));
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, _status == 'DECLINED' ? 'Thank you for letting us know.' : 'RSVP confirmed! A WhatsApp confirmation is on its way.');
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _counter(String label, int value, int min, int max, ValueChanged<int> onChanged) {
    return Row(children: [
      Expanded(child: Text(label, style: GoogleFonts.outfit(fontWeight: FontWeight.w600))),
      IconButton(onPressed: value > min ? () => onChanged(value - 1) : null, icon: const Icon(Icons.remove_circle_outline)),
      SizedBox(width: 24, child: Text('$value', textAlign: TextAlign.center, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16))),
      IconButton(onPressed: value < max ? () => onChanged(value + 1) : null, icon: const Icon(Icons.add_circle_outline)),
    ]);
  }

  Future<DateTime?> _pickDate(DateTime? initial) {
    final now = DateTime.now();
    return showDatePicker(context: context, initialDate: initial ?? now, firstDate: now.subtract(const Duration(days: 1)), lastDate: now.add(const Duration(days: 730)));
  }

  @override
  Widget build(BuildContext context) {
    final max = widget.data.maxAttendees;
    final attending = _status != 'DECLINED';
    final label = GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8);
    return ListView(
      controller: widget.controller,
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)))),
        const SizedBox(height: 12),
        Text('RSVP', style: GoogleFonts.cinzel(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'ATTENDING', label: Text('Accept')),
            ButtonSegment(value: 'MAYBE', label: Text('Tentative')),
            ButtonSegment(value: 'DECLINED', label: Text('Decline')),
          ],
          selected: {_status},
          onSelectionChanged: (s) => setState(() => _status = s.first),
        ),
        const SizedBox(height: 16),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
        TextField(controller: _occupation, decoration: const InputDecoration(labelText: 'Occupation')),
        if (attending) ...[
          const SizedBox(height: 16),
          Text('PARTY SIZE (UP TO $max)', style: label),
          _counter('Adults', _adults, 1, max - _children, (v) => setState(() => _adults = v)),
          _counter('Children', _children, 0, max - _adults, (v) => setState(() => _children = v)),
          _counter('Infants', _infants, 0, 4, (v) => setState(() => _infants = v)),
          if (widget.data.invitedCeremonies.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('CEREMONIES', style: label),
            ...widget.data.invitedCeremonies.map((c) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(c.title, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  subtitle: Text('${Formatters.dateTime(c.startsAt)} • ${c.venueName}', style: GoogleFonts.outfit(fontSize: 12)),
                  trailing: DropdownButton<String>(
                    value: _ceremonyStatus[c.id] ?? 'DECLINED',
                    items: const [
                      DropdownMenuItem(value: 'ATTENDING', child: Text('Yes')),
                      DropdownMenuItem(value: 'MAYBE', child: Text('Maybe')),
                      DropdownMenuItem(value: 'DECLINED', child: Text('No')),
                    ],
                    onChanged: (v) => setState(() => _ceremonyStatus[c.id] = v ?? 'DECLINED'),
                  ),
                )),
          ],
          const SizedBox(height: 8),
          Text('DIETARY PREFERENCES', style: label),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final e in dietaryLabels.entries)
              FilterChip(
                label: Text(e.value),
                selected: _dietary.contains(e.key),
                selectedColor: AppTheme.lightGold,
                onSelected: (v) => setState(() => v ? _dietary.add(e.key) : _dietary.remove(e.key)),
              ),
          ]),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _food,
            decoration: const InputDecoration(labelText: 'Food preference'),
            items: const [
              DropdownMenuItem(value: 'VEG', child: Text('Veg')),
              DropdownMenuItem(value: 'NON_VEG', child: Text('Non-veg')),
              DropdownMenuItem(value: 'JAIN', child: Text('Jain')),
              DropdownMenuItem(value: 'OTHER', child: Text('Other')),
            ],
            onChanged: (v) => setState(() => _food = v),
          ),
          const SizedBox(height: 12),
          TextField(controller: _allergies, decoration: const InputDecoration(labelText: 'Allergies or special needs')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _arrivalMode,
            decoration: const InputDecoration(labelText: 'Arriving by'),
            items: const [
              DropdownMenuItem(value: 'FLIGHT', child: Text('Flight')),
              DropdownMenuItem(value: 'TRAIN', child: Text('Train')),
              DropdownMenuItem(value: 'ROAD', child: Text('Road')),
              DropdownMenuItem(value: 'LOCAL', child: Text('I\'m local')),
            ],
            onChanged: (v) => setState(() => _arrivalMode = v),
          ),
          const SizedBox(height: 12),
          TextField(controller: _arrivalDetails, decoration: const InputDecoration(labelText: 'Flight / train number')),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppTheme.crimsonMaroon,
            title: const Text('I need accommodation'),
            value: _accommodation,
            onChanged: (v) => setState(() => _accommodation = v),
          ),
          if (_accommodation) ...[
            _counter('Rooms', _rooms, 1, 20, (v) => setState(() => _rooms = v)),
            _counter('People staying', _people, 1, 40, (v) => setState(() => _people = v)),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    final d = await _pickDate(_checkIn);
                    if (d != null) setState(() => _checkIn = d);
                  },
                  child: Text(_checkIn == null ? 'Check-in' : 'In: ${_day(_checkIn)}'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    final d = await _pickDate(_checkOut ?? _checkIn);
                    if (d != null) setState(() => _checkOut = d);
                  },
                  child: Text(_checkOut == null ? 'Check-out' : 'Out: ${_day(_checkOut)}'),
                ),
              ),
            ]),
          ],
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppTheme.crimsonMaroon,
            title: const Text('I\'d like the venue shuttle'),
            value: _shuttle,
            onChanged: (v) => setState(() => _shuttle = v),
          ),
        ],
        const SizedBox(height: 8),
        TextField(controller: _note, maxLines: 3, maxLength: 500, decoration: const InputDecoration(labelText: 'Note to the couple')),
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon))),
        ElevatedButton(style: primaryButton(), onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : (widget.data.rsvp == null ? 'Send RSVP' : 'Update RSVP'))),
      ],
    );
  }
}
