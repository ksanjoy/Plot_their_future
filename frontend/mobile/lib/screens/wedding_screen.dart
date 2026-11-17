import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_theme.dart';
import '../data/api_client.dart';
import '../data/live.dart';
import '../state/providers.dart';
import '../widgets/common.dart';
import 'tabs/blessings_tab.dart';
import 'tabs/host_tab.dart';
import 'tabs/invitation_tab.dart';
import 'tabs/registry_tab.dart';

class WeddingScreen extends ConsumerStatefulWidget {
  final String slug;

  const WeddingScreen({super.key, required this.slug});

  @override
  ConsumerState<WeddingScreen> createState() => _WeddingScreenState();
}

class _WeddingScreenState extends ConsumerState<WeddingScreen> with WidgetsBindingObserver {
  int _index = 0;
  LiveConnection? _live;

  String get slug => widget.slug;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _live = LiveConnection.connect(
      slug: slug,
      channel: 'wedding',
      token: ref.read(repositoryProvider).api.tokens.access,
      handlers: {
        'registry.updated': (_) => ref.invalidate(registryProvider(slug)),
        'contribution.funded': (_) {
          ref.invalidate(donorWallProvider(slug));
          ref.invalidate(myGiftsProvider(slug));
        },
        'blessing.approved': (_) => ref.invalidate(blessingsProvider(slug)),
      },
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _live?.dispose();
    super.dispose();
  }

  /// Payment happens in the browser; refresh gifts when the guest comes back.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.invalidate(registryProvider(slug));
      ref.invalidate(myGiftsProvider(slug));
    }
  }

  @override
  Widget build(BuildContext context) {
    final site = ref.watch(micrositeProvider(slug));
    return site.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.royalGold))),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: e is ApiException && e.code == 'NOT_INVITED'
            ? const ErrorPanel(message: 'This celebration is private and your number is not on the guest list. Sign in with the number your invitation was sent to.')
            : ErrorPanel(message: errorText(e), onRetry: () => ref.invalidate(micrositeProvider(slug))),
      ),
      data: (data) {
        final tabs = <({String label, IconData icon, Widget body})>[
          (label: 'Invitation', icon: Icons.mail_outline, body: InvitationTab(site: data)),
          if (data.registryEnabled) (label: 'Home gift', icon: Icons.architecture, body: RegistryTab(site: data)),
          (label: 'Blessings', icon: Icons.favorite_border, body: BlessingsTab(site: data)),
          if (data.isStaff) (label: 'Host', icon: Icons.dashboard_outlined, body: HostTab(site: data)),
        ];
        final index = _index.clamp(0, tabs.length - 1);
        return Scaffold(
          appBar: AppBar(
            backgroundColor: AppTheme.ivoryBackground,
            surfaceTintColor: Colors.transparent,
            title: Text(data.wedding.firstNames, style: GoogleFonts.cinzel(fontWeight: FontWeight.bold, color: AppTheme.crimsonMaroon, fontSize: 18)),
          ),
          body: IndexedStack(index: index, children: tabs.map((t) => t.body).toList()),
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            backgroundColor: Colors.white,
            indicatorColor: AppTheme.lightGold,
            onDestinationSelected: (i) => setState(() => _index = i),
            destinations: tabs.map((t) => NavigationDestination(icon: Icon(t.icon), label: t.label)).toList(),
          ),
        );
      },
    );
  }
}
