import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

import '../core/theme/app_theme.dart';
import '../state/providers.dart';

class IntroScreen extends ConsumerStatefulWidget {
  final VoidCallback onDone;

  const IntroScreen({super.key, required this.onDone});

  @override
  ConsumerState<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends ConsumerState<IntroScreen> {
  late final Future<List<({String title, String body})>> _screens = ref.read(repositoryProvider).introScreens();
  int _step = 0;

  Future<void> _finish() async {
    await ref.read(repositoryProvider).api.tokens.markIntroSeen();
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.maroonGradient),
        child: SafeArea(
          child: FutureBuilder(
            future: _screens,
            builder: (context, snap) {
              final screens = snap.data ?? const [(title: 'The wedding gift that becomes their forever.', body: 'Loved ones contribute toward a couple\'s first home.')];
              final current = screens[_step.clamp(0, screens.length - 1)];
              final last = _step >= screens.length - 1;
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Spacer(),
                  Text('Plot Their Future', style: GoogleFonts.outfit(color: AppTheme.lightGold, letterSpacing: 2, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Text(current.title, style: GoogleFonts.cinzel(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 12),
                  Text(current.body, style: GoogleFonts.playfairDisplay(fontSize: 16, color: Colors.white70, height: 1.4)),
                  const Spacer(),
                  Row(children: [
                    TextButton(onPressed: _finish, child: Text('Skip', style: GoogleFonts.outfit(color: Colors.white70))),
                    const Spacer(),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.royalGold, foregroundColor: AppTheme.crimsonMaroon),
                      onPressed: () {
                        if (!last) {
                          setState(() => _step += 1);
                        } else {
                          _finish();
                        }
                      },
                      child: Text(last ? 'Get started' : 'Next'),
                    ),
                  ]),
                ]),
              );
            },
          ),
        ),
      ),
    );
  }
}

class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _name = TextEditingController();
  final _occupation = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _occupation.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).completeProfile(name: _name.text.trim(), occupation: _occupation.text.trim(), password: _password.text);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Name, occupation and a password. Next time you can sign in with the password or a one-time code.', style: GoogleFonts.outfit(color: AppTheme.textMuted)),
          const SizedBox(height: 16),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 12),
          TextField(controller: _occupation, decoration: const InputDecoration(labelText: 'Occupation')),
          const SizedBox(height: 12),
          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password (8+ characters)')),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon))),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Continue')),
        ],
      ),
    );
  }
}
