import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plot_their_future/data/api_client.dart';
import 'package:plot_their_future/data/models.dart';
import 'package:plot_their_future/data/repository.dart';
import 'package:plot_their_future/main.dart';
import 'package:plot_their_future/screens/security_faq_screen.dart';
import 'package:plot_their_future/state/providers.dart';
import 'package:plot_their_future/widgets/tile_grid.dart';

Widget _app() => ProviderScope(
      overrides: [repositoryProvider.overrideWithValue(Repository(ApiClient(TokenStore())))],
      child: const PlotTheirFutureApp(),
    );

void main() {
  testWidgets('signed-out users land on the OTP login', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Plot Their Future'), findsOneWidget);
    expect(find.text('Sign in with your WhatsApp number'), findsOneWidget);
    expect(find.text('Send code'), findsOneWidget);
  });

  testWidgets('login renders on a narrow 320px screen without overflow', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('SecurityFaqScreen renders on narrow screen without overflow', (tester) async {
    tester.view.physicalSize = const Size(340, 700);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MaterialApp(home: SecurityFaqScreen()));
    await tester.pumpAndSettle();

    expect(find.text('WHAT HAPPENS TO YOUR MONEY?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('TileGrid paints one tile per square foot', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox(width: 110, child: TileGrid(cells: 'FFFHHOOOOOOO', tile: 9)))));
    final paint = tester.widget<CustomPaint>(find.descendant(of: find.byType(TileGrid), matching: find.byType(CustomPaint)));
    // 110px fits 10 tiles of 9px + 2px gap per row, so 12 cells need 2 rows.
    expect(paint.size.height, 22);
  });

  test('Microsite parses the API payload', () {
    final site = Microsite.fromJson({
      'role': 'GUEST',
      'wedding': {'id': 'w1', 'slug': 'sanvi-santosh', 'brideName': 'Sanvi Rao', 'groomName': 'Santosh Kumar', 'weddingDate': '2026-11-15T00:15:00.000Z'},
      'invitation': {'id': 'i1', 'guestName': 'Ravi Teja', 'cohort': 'FRIENDS', 'maxAttendees': 2, 'enableRegistry': false, 'refLead': null},
      'ceremonies': [
        {'id': 'c1', 'title': 'Muhurtham', 'startsAt': '2026-11-15T00:15:00.000Z', 'venueName': 'Palace Grounds'},
      ],
      'rsvp': null,
      'registry': {'totalSft': 1200, 'fundedSft': 420, 'heldSft': 0, 'progress': 0.35, 'ratePerSftPaise': 450000, 'raisedPaise': 189000000, 'targetPaise': 540000000, 'presetTiers': [1, 5], 'holdTtlSec': 900},
    });
    expect(site.wedding.firstNames, 'Sanvi & Santosh');
    expect(site.registryEnabled, isFalse);
    expect(site.isStaff, isFalse);
    expect(site.ceremonies.single.title, 'Muhurtham');
    expect(site.registry.fundedSft, 420);
  });

  test('ApiException surfaces server message and code', () {
    const e = ApiException(410, 'Your reservation expired', code: 'HOLD_EXPIRED');
    expect(e.toString(), 'Your reservation expired');
    expect(e.code, 'HOLD_EXPIRED');
  });
}
