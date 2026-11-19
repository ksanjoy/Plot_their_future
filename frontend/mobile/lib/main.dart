import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'data/api_client.dart';
import 'data/repository.dart';
import 'screens/home_screen.dart';
import 'screens/intro_screen.dart';
import 'screens/login_screen.dart';
import 'state/providers.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final tokens = TokenStore();
  await tokens.load();
  final repository = Repository(ApiClient(tokens));
  runApp(
    ProviderScope(
      overrides: [repositoryProvider.overrideWithValue(repository)],
      // Client errors (4xx) are final; only retry transient failures.
      retry: (count, error) => error is ApiException && error.status >= 400 && error.status < 500 ? null : (count < 2 ? const Duration(seconds: 1) : null),
      child: const PlotTheirFutureApp(),
    ),
  );
}

class PlotTheirFutureApp extends StatelessWidget {
  const PlotTheirFutureApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Plot Their Future',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.festiveLightTheme,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerStatefulWidget {
  const AuthGate({super.key});

  @override
  ConsumerState<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<AuthGate> {
  bool? _introSeen;

  @override
  void initState() {
    super.initState();
    ref.read(repositoryProvider).api.tokens.introSeen().then((seen) {
      if (mounted) setState(() => _introSeen = seen);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authProvider, (prev, next) {
      if (prev?.value != null && next is AsyncData<dynamic> && next.value == null) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    });
    if (_introSeen == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.royalGold)));
    }
    if (_introSeen == false) {
      return IntroScreen(onDone: () => setState(() => _introSeen = true));
    }
    final auth = ref.watch(authProvider);
    return switch (auth) {
      AsyncData(value: final session?) when !session.user.profileComplete => const CompleteProfileScreen(),
      AsyncData(value: final session?) => HomeScreen(session: session),
      AsyncData() => const LoginScreen(),
      AsyncError(:final error) => Scaffold(body: ErrorPanel(message: errorText(error), onRetry: () => ref.invalidate(authProvider))),
      _ => const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.royalGold))),
    };
  }
}
