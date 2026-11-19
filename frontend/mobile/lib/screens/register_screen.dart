import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../data/models.dart';
import '../state/providers.dart';
import '../widgets/common.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _bride = TextEditingController();
  final _groom = TextEditingController();
  final _story = TextEditingController();
  final _city = TextEditingController();
  final _mobile = TextEditingController();
  final _title = TextEditingController(text: 'Wedding');
  final _venue = TextEditingController();
  final _address = TextEditingController();
  final _maps = TextEditingController();
  DateTime? _when;
  String? _flatId;
  List<Json> _flats = const [];
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await ref.read(repositoryProvider).flats();
      if (mounted) setState(() => _flats = rows);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  @override
  void dispose() {
    for (final c in [_bride, _groom, _story, _city, _mobile, _title, _venue, _address, _maps]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final when = _when;
    final flatId = _flatId;
    if (when == null || flatId == null) {
      setState(() => _error = 'Choose a date and a flat.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(repositoryProvider).registerWedding({
        'brideName': _bride.text.trim(),
        'groomName': _groom.text.trim(),
        'welcomeNote': _story.text.trim(),
        'city': _city.text.trim(),
        'contactMobile': _mobile.text.trim(),
        'flatId': flatId,
        'ceremonies': [
          {
            'title': _title.text.trim(),
            'startsAt': when.toUtc().toIso8601String(),
            'venueName': _venue.text.trim(),
            'venueAddress': _address.text.trim(),
            'venueMapsUrl': _maps.text.trim(),
          },
        ],
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'Submitted for approval. We will message you when it is reviewed.');
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register a marriage')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('This goes to the admin. The flat stays available until the registration is approved.', style: GoogleFonts.outfit(color: AppTheme.textMuted)),
          const SizedBox(height: 12),
          TextField(controller: _bride, decoration: const InputDecoration(labelText: 'Bride')),
          TextField(controller: _groom, decoration: const InputDecoration(labelText: 'Groom')),
          TextField(controller: _story, maxLines: 3, decoration: const InputDecoration(labelText: 'Your story')),
          TextField(controller: _city, decoration: const InputDecoration(labelText: 'City')),
          TextField(controller: _mobile, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Contact mobile for the admin')),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Ceremony')),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_when == null ? 'Date and time' : Formatters.dateTime(_when!)),
            trailing: const Icon(Icons.event),
            onTap: () async {
              final now = DateTime.now();
              final day = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 900)), initialDate: _when ?? now.add(const Duration(days: 30)));
              if (day == null || !context.mounted) return;
              final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 11, minute: 0));
              if (time == null) return;
              setState(() => _when = DateTime(day.year, day.month, day.day, time.hour, time.minute));
            },
          ),
          TextField(controller: _venue, decoration: const InputDecoration(labelText: 'Venue')),
          TextField(controller: _address, decoration: const InputDecoration(labelText: 'Address')),
          TextField(controller: _maps, decoration: const InputDecoration(labelText: 'Map link')),
          const SizedBox(height: 8),
          Text('CHOOSE A FLAT', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
          if (_flats.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No flats are listed yet.')),
          ..._flats.map((flat) {
            final id = flat['id'] as String;
            final selected = _flatId == id;
            return ListTile(
              selected: selected,
              leading: Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: AppTheme.crimsonMaroon),
              title: Text(flat['name'] as String? ?? 'Flat'),
              subtitle: Text('${flat['flatType']} • ${flat['location']} • ${flat['totalSft']} sq.ft. • ${Formatters.inr((flat['pricePerSftPaise'] as num?)?.toInt() ?? 0)} / sq.ft.'),
              onTap: () => setState(() => _flatId = id),
            );
          }),
          if (_error != null) Text(_error!, style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Submitting…' : 'Submit for approval')),
        ],
      ),
    );
  }
}
