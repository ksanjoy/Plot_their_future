import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/config.dart';
import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../data/live.dart';
import '../data/models.dart';
import '../state/providers.dart';
import '../widgets/common.dart';

/// Banquet LED display: live sq.ft. meter, room progress, scan-to-gift QR,
/// rotating blessings and a donor ticker. Respects the wedding's display mode.
class LiveStageScreen extends ConsumerStatefulWidget {
  final String slug;

  const LiveStageScreen({super.key, required this.slug});

  @override
  ConsumerState<LiveStageScreen> createState() => _LiveStageScreenState();
}

class _LiveStageScreenState extends ConsumerState<LiveStageScreen> {
  StagePayload? _data;
  Object? _error;
  LiveConnection? _live;
  WallEntry? _celebrate;
  int _spot = 0;
  Timer? _rotate;
  Timer? _celebrateTimer;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _load();
    _rotate = Timer.periodic(const Duration(seconds: 9), (_) {
      final n = _data?.blessings.length ?? 0;
      if (n > 1 && mounted) setState(() => _spot = (_spot + 1) % n);
    });
  }

  Future<void> _load() async {
    final repo = ref.read(repositoryProvider);
    try {
      final data = await repo.stage(widget.slug);
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
      });
      _live ??= LiveConnection.connect(
        slug: widget.slug,
        channel: 'stage',
        token: repo.api.tokens.access,
        handlers: {
          'registry.updated': (j) => setState(() => _data = _data?.copyWith(registry: RegistryState.fromJson(j))),
          'contribution.funded': (j) {
            final entry = WallEntry.fromJson(j);
            setState(() {
              _data = _data?.copyWith(donors: [entry, ...?_data?.donors.where((d) => d.id != entry.id)]);
              _celebrate = entry;
            });
            _celebrateTimer?.cancel();
            _celebrateTimer = Timer(const Duration(seconds: 8), () {
              if (mounted) setState(() => _celebrate = null);
            });
          },
          'blessing.approved': (j) {
            final b = Blessing.fromJson(j);
            setState(() {
              _data = _data?.copyWith(blessings: [b, ...?_data?.blessings.where((x) => x.id != b.id)]);
              _spot = 0;
            });
          },
        },
      );
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _rotate?.cancel();
    _celebrateTimer?.cancel();
    _live?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      backgroundColor: AppTheme.deepCrimson,
      body: data == null
          ? (_error != null
              ? ErrorPanel(message: errorText(_error!), onRetry: _load)
              : const Center(child: CircularProgressIndicator(color: AppTheme.lightGold)))
          : Stack(children: [
              Container(decoration: const BoxDecoration(gradient: AppTheme.maroonGradient)),
              SafeArea(child: _content(data)),
              Positioned(top: 8, left: 8, child: SafeArea(child: IconButton(icon: const Icon(Icons.close, color: AppTheme.palePine), onPressed: () => Navigator.of(context).pop()))),
              if (_celebrate != null && data.displayMode != 'PROGRESS_ONLY') _celebration(_celebrate!),
            ]),
    );
  }

  Widget _content(StagePayload data) {
    final r = data.registry.summary;
    final showPeople = data.displayMode != 'PROGRESS_ONLY';
    final blessing = showPeople && data.blessings.isNotEmpty ? data.blessings[_spot % data.blessings.length] : null;
    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth > 700;
      final meter = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('BUILDING THEIR FIRST HOME', style: GoogleFonts.outfit(fontSize: 12, letterSpacing: 4, color: AppTheme.lightGold)),
        const SizedBox(height: 6),
        Text(data.wedding.couple, style: GoogleFonts.cinzel(fontSize: wide ? 40 : 26, fontWeight: FontWeight.bold, color: AppTheme.palePine)),
        const SizedBox(height: 18),
        Text('${Formatters.number(r.fundedSft)} / ${Formatters.sqft(r.totalSft)}', style: GoogleFonts.cinzel(fontSize: wide ? 44 : 28, fontWeight: FontWeight.bold, color: AppTheme.lightGold)),
        const SizedBox(height: 10),
        GoldProgressBar(value: r.progress, height: 18, track: AppTheme.palePine.withValues(alpha: 0.24)),
        const SizedBox(height: 6),
        Text('${Formatters.percent(r.progress)} • ${Formatters.inr(r.raisedPaise)} gifted with love', style: GoogleFonts.outfit(fontSize: 16, color: AppTheme.palePine)),
        const SizedBox(height: 18),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final room in data.registry.rooms)
            Container(
              width: wide ? 200 : 150,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppTheme.palePine.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(roomIcon(room.icon), size: 16, color: AppTheme.palePine),
                  const SizedBox(width: 6),
                  Expanded(child: Text(room.name, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(color: AppTheme.palePine, fontWeight: FontWeight.w600))),
                ]),
                const SizedBox(height: 6),
                GoldProgressBar(value: room.sft == 0 ? 0 : room.fundedSft / room.sft, height: 6, track: AppTheme.palePine.withValues(alpha: 0.24)),
                Text('${room.fundedSft}/${room.sft} sq.ft.', style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.palePine)),
              ]),
            ),
        ]),
      ]);
      final side = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppTheme.palePine, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            Image.network('${AppConfig.apiBase}/weddings/${widget.slug}/stage/qr.png', width: 110, height: 110),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Scan to gift a square foot', style: GoogleFonts.cinzel(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon)),
                Text('${Formatters.inr(r.ratePerSftPaise)} per sq.ft.', style: GoogleFonts.outfit(color: AppTheme.textMuted)),
              ]),
            ),
          ]),
        ),
        if (blessing != null) ...[
          const SizedBox(height: 14),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 600),
            child: Container(
              key: ValueKey(blessing.id),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppTheme.palePine.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(18)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (blessing.photoUrl != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(blessing.photoUrl!, height: 140, width: double.infinity, fit: BoxFit.cover)),
                  ),
                if (blessing.message != null) Text('"${blessing.message}"', style: GoogleFonts.playfairDisplay(fontSize: 18, fontStyle: FontStyle.italic, color: AppTheme.palePine)),
                const SizedBox(height: 8),
                Text('— ${blessing.authorName}', style: GoogleFonts.outfit(color: AppTheme.lightGold)),
              ]),
            ),
          ),
        ],
      ]);
      return Column(children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 48, 24, 16),
            child: wide
                ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(flex: 3, child: meter), const SizedBox(width: 24), Expanded(flex: 2, child: side)])
                : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [meter, const SizedBox(height: 20), side]),
          ),
        ),
        if (showPeople && data.donors.isNotEmpty) _Ticker(donors: data.donors),
      ]);
    });
  }

  Widget _celebration(WallEntry e) => Positioned.fill(
        child: Container(
          color: AppTheme.deepBurgundy.withValues(alpha: 0.54),
          alignment: Alignment.center,
          child: Container(
            margin: const EdgeInsets.all(24),
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(gradient: AppTheme.goldGradient, borderRadius: BorderRadius.circular(28)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.auto_awesome, size: 48, color: AppTheme.textDark),
              const SizedBox(height: 10),
              Text(e.donorName, textAlign: TextAlign.center, style: GoogleFonts.cinzel(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              Text('just gifted ${e.units} sq.ft. of the ${e.roomName}!', textAlign: TextAlign.center, style: GoogleFonts.outfit(fontSize: 18, color: AppTheme.textDark)),
              if (e.blessing != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('"${e.blessing}"', textAlign: TextAlign.center, style: GoogleFonts.playfairDisplay(fontSize: 16, fontStyle: FontStyle.italic))),
            ]),
          ),
        ),
      );
}

class _Ticker extends StatefulWidget {
  final List<WallEntry> donors;

  const _Ticker({required this.donors});

  @override
  State<_Ticker> createState() => _TickerState();
}

class _TickerState extends State<_Ticker> {
  final _controller = ScrollController();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 40), (_) {
      if (!_controller.hasClients) return;
      final max = _controller.position.maxScrollExtent;
      final next = _controller.offset + 1.5;
      _controller.jumpTo(next >= max ? 0 : next);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items = [...widget.donors, ...widget.donors];
    return Container(
      height: 48,
      color: AppTheme.deepBurgundy.withValues(alpha: 0.26),
      child: ListView.separated(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 40),
        itemBuilder: (_, i) => Center(
          child: Text.rich(TextSpan(children: [
            TextSpan(text: items[i].donorName, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppTheme.lightGold, fontSize: 15)),
            TextSpan(text: ' gifted ${items[i].units} sq.ft. of the ${items[i].roomName}', style: GoogleFonts.outfit(color: AppTheme.palePine, fontSize: 15)),
          ])),
        ),
      ),
    );
  }
}
