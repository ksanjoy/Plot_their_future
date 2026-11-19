import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_theme.dart';
import '../data/models.dart';
import '../state/providers.dart';
import '../widgets/common.dart';
import 'security_faq_screen.dart';
import 'why_gift_sqft_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();
  bool _usePassword = false;
  OtpRequest? _request;
  bool _busy = false;
  String? _error;
  int _resendIn = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _phone.dispose();
    _otp.dispose();
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _resendIn = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _resendIn = _resendIn > 0 ? _resendIn - 1 : 0);
      if (_resendIn == 0) t.cancel();
    });
  }

  Future<void> _sendOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final req = await ref.read(authProvider.notifier).requestOtp(_phone.text.trim());
      setState(() => _request = req);
      _startCooldown(req.resendAfterSec);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _passwordLogin() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).loginPassword(_phone.text.trim(), _password.text);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final req = _request;
    if (req == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).verify(req.phone, _otp.text.trim(), name: _name.text.trim());
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final req = _request;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.maroonGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: Image.asset('assets/images/couple_portrait.jpg', height: 180, fit: BoxFit.cover),
                  ),
                  const SizedBox(height: 20),
                  Text('Plot Their Future', textAlign: TextAlign.center, style: GoogleFonts.cinzel(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.lightGold)),
                  Text('Skip the boxed gifts, gift a square foot.', textAlign: TextAlign.center, style: GoogleFonts.playfairDisplay(fontSize: 15, fontStyle: FontStyle.italic, color: Colors.white70)),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: AppTheme.ivoryBackground, borderRadius: BorderRadius.circular(24)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(req == null ? 'Sign in with your WhatsApp number' : 'Enter the code sent to ${req.maskedPhone}',
                          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.textDark)),
                      const SizedBox(height: 4),
                      Text(
                        req == null ? 'Use the number your invitation was sent to.' : 'Sent via ${req.channel == 'whatsapp' ? 'WhatsApp' : 'SMS'}.',
                        style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted),
                      ),
                      const SizedBox(height: 16),
                      if (req == null) ...[
                        TextField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          autofillHints: const [AutofillHints.telephoneNumber],
                          decoration: const InputDecoration(labelText: 'Mobile number', prefixIcon: Icon(Icons.phone_android), hintText: '98480 12345'),
                          onSubmitted: (_) => _usePassword ? _passwordLogin() : _sendOtp(),
                        ),
                        if (_usePassword) ...[
                          const SizedBox(height: 10),
                          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password'), onSubmitted: (_) => _passwordLogin()),
                        ],
                      ] else ...[
                        TextField(
                          controller: _otp,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          autofillHints: const [AutofillHints.oneTimeCode],
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          style: GoogleFonts.outfit(fontSize: 22, letterSpacing: 8, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(labelText: 'One-time code', counterText: ''),
                          onSubmitted: (_) => _verify(),
                        ),
                        const SizedBox(height: 10),
                        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Your name (first sign-in only)')),
                        if (req.devOtp != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text('Development code: ${req.devOtp}', style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.deepGold, fontWeight: FontWeight.w600)),
                          ),
                      ],
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(_error!, style: GoogleFonts.outfit(color: AppTheme.crimsonMaroon, fontSize: 13)),
                        ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        style: primaryButton(),
                        onPressed: _busy ? null : (req == null ? (_usePassword ? _passwordLogin : _sendOtp) : _verify),
                        child: Text(_busy ? 'Please wait…' : (req == null ? (_usePassword ? 'Sign in' : 'Send code') : 'Verify & continue')),
                      ),
                      if (req == null)
                        TextButton(onPressed: () => setState(() => _usePassword = !_usePassword), child: Text(_usePassword ? 'Use a one-time code instead' : 'Sign in with password')),
                      if (req != null)
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          TextButton(onPressed: () => setState(() => _request = null), child: const Text('Change number')),
                          TextButton(onPressed: _resendIn > 0 || _busy ? null : _sendOtp, child: Text(_resendIn > 0 ? 'Resend in ${_resendIn}s' : 'Resend code')),
                        ]),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  Wrap(alignment: WrapAlignment.center, spacing: 8, children: [
                    TextButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WhyGiftSqFtScreen())),
                      child: Text('Why gift a sq.ft.?', style: GoogleFonts.outfit(color: AppTheme.lightGold)),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SecurityFaqScreen())),
                      child: Text('Escrow & security', style: GoogleFonts.outfit(color: AppTheme.lightGold)),
                    ),
                  ]),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
