import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/gift_sheet.dart';
import '../../widgets/luxury_card.dart';
import '../../widgets/tile_grid.dart';

class RegistryTab extends ConsumerWidget {
  final Microsite site;

  const RegistryTab({super.key, required this.site});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slug = site.wedding.slug;
    final registry = ref.watch(registryProvider(slug));
    final gifts = ref.watch(myGiftsProvider(slug));
    return RefreshIndicator(
      color: AppTheme.crimsonMaroon,
      onRefresh: () async {
        ref.invalidate(myGiftsProvider(slug));
        ref.invalidate(registryProvider(slug));
        await ref.read(registryProvider(slug).future);
      },
      child: AsyncView(
        value: registry,
        onRetry: () => ref.invalidate(registryProvider(slug)),
        builder: (reg) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Summary(site: site, registry: reg),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              style: primaryButton(),
              onPressed: () => showGiftSheet(context, site: site, registry: reg),
              icon: const Icon(Icons.card_giftcard),
              label: const Text('Gift square feet'),
            ),
            const SizedBox(height: 20),
            const SectionTitle('Floor plan', subtitle: 'Tap a room to gift a piece of it'),
            ...reg.rooms.map((room) => _RoomCard(room: room, onTap: room.openSft > 0 ? () => showGiftSheet(context, site: site, registry: reg, roomKey: room.key) : null)),
            if (gifts.value?.isNotEmpty == true) ...[
              const SizedBox(height: 20),
              const SectionTitle('Your gifts'),
              ...gifts.value!.map((c) => _MyGift(gift: c)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  final Microsite site;
  final RegistryState registry;

  const _Summary({required this.site, required this.registry});

  @override
  Widget build(BuildContext context) {
    final s = registry.summary;
    final w = site.wedding;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(gradient: AppTheme.maroonGradient, borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(w.propertyName ?? 'Their first home', style: GoogleFonts.playfairDisplay(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.palePine)),
        if (w.propertyLocation != null) Text(w.propertyLocation!, style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.palePine)),
        const SizedBox(height: 14),
        Text('${Formatters.number(s.fundedSft)} / ${Formatters.sqft(s.totalSft)}', style: GoogleFonts.cinzel(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.lightGold)),
        const SizedBox(height: 8),
        GoldProgressBar(value: s.progress, height: 12, track: AppTheme.palePine.withValues(alpha: 0.24)),
        const SizedBox(height: 6),
        Text('${Formatters.percent(s.progress)} gifted • ${Formatters.inr(s.raisedPaise)} of ${Formatters.inrCompact(s.targetPaise)} • ${Formatters.inr(s.ratePerSftPaise)}/sq.ft.',
            style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.palePine)),
        const SizedBox(height: 10),
        Row(children: [
          const Icon(Icons.shield, size: 14, color: AppTheme.lightGold),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              [w.escrowBankName ?? 'RBI tripartite escrow', if (w.reraRegId != null) 'RERA ${w.reraRegId}'].join(' • '),
              style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.palePine),
            ),
          ),
        ]),
      ]),
    );
  }
}

class _RoomCard extends StatelessWidget {
  final RoomState room;
  final VoidCallback? onTap;

  const _RoomCard({required this.room, this.onTap});

  @override
  Widget build(BuildContext context) {
    final full = room.openSft <= 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: LuxuryCard(
        padding: const EdgeInsets.all(14),
        onTap: onTap,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(radius: 18, backgroundColor: full ? AppTheme.lightGold : AppTheme.crimsonMaroon.withValues(alpha: 0.08), child: Icon(roomIcon(room.icon), size: 18, color: AppTheme.crimsonMaroon)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(room.name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.textDark)),
                Text(Formatters.sqft(room.sft), style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted)),
              ]),
            ),
            Text(full ? 'Fully gifted' : '${room.openSft} open', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: full ? AppTheme.greenVerified : AppTheme.deepGold)),
          ]),
          if (room.description != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(room.description!, style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted))),
          const SizedBox(height: 10),
          TileGrid(cells: room.cells),
          const SizedBox(height: 8),
          GoldProgressBar(value: room.sft == 0 ? 0 : room.fundedSft / room.sft, height: 6),
          const SizedBox(height: 4),
          Text('${room.fundedSft}/${room.sft} gifted${room.heldSft > 0 ? ' • ${room.heldSft} being gifted now' : ''}', style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.textMuted)),
        ]),
      ),
    );
  }
}

class _MyGift extends StatelessWidget {
  final Contribution gift;

  const _MyGift({required this.gift});

  @override
  Widget build(BuildContext context) {
    final links = gift.links;
    Widget action;
    if (gift.status == 'SUCCESS' && links.thankYouUrl != null) {
      action = TextButton(onPressed: () => openLink(context, links.thankYouUrl!), child: const Text('Certificate'));
    } else if (gift.status == 'PENDING' && links.checkoutUrl != null) {
      action = ElevatedButton(style: primaryButton(), onPressed: () => openLink(context, links.checkoutUrl!), child: const Text('Pay now'));
    } else {
      action = Text(gift.status == 'REFUND_REQUIRED' ? 'Refund in progress' : gift.status.toLowerCase(), style: GoogleFonts.outfit(color: AppTheme.textMuted));
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: LuxuryCard(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${gift.units} sq.ft. • ${gift.roomName}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              Text('${Formatters.inr(gift.amountPaise)} • ${Formatters.dateTime(gift.paidAt ?? gift.createdAt)}', style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.textMuted)),
              if (gift.receiptNumber != null) Text(gift.receiptNumber!, style: GoogleFonts.outfit(fontSize: 11, color: AppTheme.deepGold)),
            ]),
          ),
          action,
        ]),
      ),
    );
  }
}
