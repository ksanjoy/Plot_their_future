import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repository.dart';

/// Overridden in `main()` once tokens have been loaded from secure storage.
final repositoryProvider = Provider<Repository>((ref) => throw UnimplementedError('repositoryProvider must be overridden'));

class AuthNotifier extends AsyncNotifier<Session?> {
  Repository get _repo => ref.read(repositoryProvider);

  @override
  Future<Session?> build() async {
    _repo.api.onSessionExpired = () => state = const AsyncData(null);
    if (_repo.api.tokens.access == null) return null;
    try {
      return await _repo.me();
    } on ApiException catch (e) {
      if (e.status == 401) {
        await _repo.api.tokens.clear();
        return null;
      }
      rethrow;
    }
  }

  Future<OtpRequest> requestOtp(String phone) => _repo.requestOtp(phone);

  Future<void> verify(String phone, String otp, {String? name}) async {
    final session = await _repo.verifyOtp(phone, otp, name: name);
    state = AsyncData(session);
  }

  Future<void> reload() async {
    state = AsyncData(await _repo.me());
  }

  Future<void> signOut() async {
    await _repo.logout();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, Session?>(AuthNotifier.new);

final micrositeProvider = FutureProvider.autoDispose.family<Microsite, String>((ref, slug) => ref.watch(repositoryProvider).microsite(slug));
final registryProvider = FutureProvider.autoDispose.family<RegistryState, String>((ref, slug) => ref.watch(repositoryProvider).registry(slug));
final donorWallProvider = FutureProvider.autoDispose.family<List<WallEntry>, String>((ref, slug) => ref.watch(repositoryProvider).donorWall(slug));
final blessingsProvider = FutureProvider.autoDispose.family<List<Blessing>, String>((ref, slug) => ref.watch(repositoryProvider).blessings(slug));
final myGiftsProvider = FutureProvider.autoDispose.family<List<Contribution>, String>((ref, slug) => ref.watch(repositoryProvider).myGifts(slug));
final dashboardProvider = FutureProvider.autoDispose.family<Dashboard, String>((ref, slug) => ref.watch(repositoryProvider).dashboard(slug));
final dispatchesProvider = FutureProvider.autoDispose.family<List<DispatchSummary>, String>((ref, slug) => ref.watch(repositoryProvider).dispatches(slug));
final ceremoniesProvider = FutureProvider.autoDispose.family<List<Ceremony>, String>((ref, slug) => ref.watch(repositoryProvider).ceremonies(slug));
