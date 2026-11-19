import 'dart:math';

import 'package:material_ui/material_ui.dart';

import '../core/theme/app_theme.dart';

/// One square per sq.ft.: gold = gifted (F), maroon = being paid for (H), outline = open (O).
class TileGrid extends StatelessWidget {
  final String cells;
  final double tile;

  const TileGrid({super.key, required this.cells, this.tile = 9});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final perRow = max(1, ((constraints.maxWidth + 2) / (tile + 2)).floor());
      final rows = (cells.length / perRow).ceil();
      return CustomPaint(
        size: Size(constraints.maxWidth, rows * (tile + 2)),
        painter: _TilePainter(cells, perRow, tile),
      );
    });
  }
}

class _TilePainter extends CustomPainter {
  final String cells;
  final int perRow;
  final double tile;

  _TilePainter(this.cells, this.perRow, this.tile);

  @override
  void paint(Canvas canvas, Size size) {
    final funded = Paint()..color = AppTheme.royalGold;
    final partial = Paint()..color = AppTheme.royalGold.withValues(alpha: 0.45);
    final held = Paint()..color = AppTheme.crimsonMaroon.withValues(alpha: 0.7);
    final open = Paint()..color = AppTheme.palePine;
    final border = Paint()
      ..color = AppTheme.deepBurgundy
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < cells.length; i++) {
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH((i % perRow) * (tile + 2), (i ~/ perRow) * (tile + 2), tile, tile),
        const Radius.circular(2),
      );
      switch (cells[i]) {
        case 'F':
          canvas.drawRRect(rect, funded);
        case 'P':
          canvas.drawRRect(rect, partial);
          canvas.drawRRect(rect, border);
        case 'H':
          canvas.drawRRect(rect, held);
        default:
          canvas.drawRRect(rect, open);
          canvas.drawRRect(rect, border);
      }
    }
  }

  @override
  bool shouldRepaint(_TilePainter old) => old.cells != cells || old.perRow != perRow;
}
