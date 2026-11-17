import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'data/api_client.dart';
import 'data/repository.dart';
import 'screens/home_screen.dart';
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

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authProvider, (prev, next) {
      if (prev?.value != null && next is AsyncData<dynamic> && next.value == null) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    });
    final auth = ref.watch(authProvider);
    return switch (auth) {
      AsyncData(value: final session?) => HomeScreen(session: session),
      AsyncData() => const LoginScreen(),
      AsyncError(:final error) => Scaffold(body: ErrorPanel(message: errorText(error), onRetry: () => ref.invalidate(authProvider))),
      _ => const Scaffold(body: Center(child: CircularProgressIndicator(color: AppTheme.royalGold))),
    };
  }
}
