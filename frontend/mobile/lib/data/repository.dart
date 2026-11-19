import 'api_client.dart';
import 'models.dart';

/// Typed wrappers over the PlotTheirFuture REST API (`/api/v1`).
class Repository {
  final ApiClient api;

  Repository(this.api);

  String _s(String slug) => Uri.encodeComponent(slug);

  Future<OtpRequest> requestOtp(String phone) async => OtpRequest.fromJson(await api.post<Json>('/auth/request-otp', data: {'phone': phone}, auth: false));

  Future<Session> loginPassword(String phone, String password) async {
    final j = await api.post<Json>('/auth/login', data: {'phone': phone, 'password': password}, auth: false);
    await api.tokens.save(j['accessToken'] as String, j['refreshToken'] as String);
    return Session.fromJson(j);
  }

  Future<void> completeProfile({required String name, required String occupation, required String password}) async {
    await api.post<Json>('/auth/complete-profile', data: {'name': name, 'occupation': occupation, 'password': password});
  }

  Future<List<Json>> flats() async => (await api.get<List<dynamic>>('/flats')).map((e) => e as Json).toList();

  Future<void> registerWedding(Json body) async {
    await api.post<dynamic>('/weddings/registrations', data: body);
  }

  Future<List<({String title, String body})>> introScreens() async {
    try {
      final j = await api.get<Json>('/public/content', auth: false);
      final screens = (j['intro'] as List?) ?? const [];
      return screens.map((raw) {
        final e = raw as Json;
        return (title: e['title'] as String? ?? '', body: e['body'] as String? ?? '');
      }).toList();
    } catch (_) {
      return const [
        (title: 'The wedding gift that becomes their forever.', body: 'Loved ones contribute toward a couple\'s first home.'),
        (title: 'Blessings come first.', body: 'Gifting is completely voluntary. Your presence is the greatest gift.'),
      ];
    }
  }

  Future<Session> verifyOtp(String phone, String otp, {String? name}) async {
    final j = await api.post<Json>('/auth/verify-otp', data: {'phone': phone, 'otp': otp, if (name != null && name.isNotEmpty) 'name': name}, auth: false);
    await api.tokens.save(j['accessToken'] as String, j['refreshToken'] as String);
    return Session.fromJson(j);
  }

  Future<Session> me() async => Session.fromJson(await api.get<Json>('/auth/me'));

  Future<void> logout() async {
    final refresh = api.tokens.refresh;
    if (refresh != null) {
      try {
        await api.post<dynamic>('/auth/logout', data: {'refreshToken': refresh});
      } catch (_) {}
    }
    await api.tokens.clear();
  }

  Future<Microsite> microsite(String slug) async => Microsite.fromJson(await api.get<Json>('/weddings/${_s(slug)}'));

  Future<RegistryState> registry(String slug) async => RegistryState.fromJson(await api.get<Json>('/weddings/${_s(slug)}/registry'));

  Future<List<WallEntry>> donorWall(String slug) async => (await api.get<List<dynamic>>('/weddings/${_s(slug)}/donor-wall')).map((e) => WallEntry.fromJson(e as Json)).toList();

  Future<List<Contribution>> myGifts(String slug) async =>
      (await api.get<List<dynamic>>('/weddings/${_s(slug)}/contributions/mine')).map((e) => Contribution.fromJson(e as Json)).toList();

  Future<Contribution> lockTiles({
    required String slug,
    required String roomKey,
    required int units,
    String mode = 'SQFT',
    int? amountPaise,
    bool hideAmount = false,
    String? donorName,
    String? relationship,
    String? blessing,
    bool anonymous = false,
    String? refLead,
  }) async {
    final j = await api.post<Json>('/registry/lock-tile', data: {
      'slug': slug,
      'roomKey': roomKey,
      'mode': mode,
      if (mode != 'AMOUNT') 'units': units,
      if (amountPaise != null) 'amountPaise': amountPaise,
      'hideAmount': hideAmount,
      if (donorName != null && donorName.isNotEmpty) 'donorName': donorName,
      if (relationship != null && relationship.isNotEmpty) 'relationship': relationship,
      if (blessing != null && blessing.isNotEmpty) 'blessing': blessing,
      'anonymous': anonymous,
      'refLead': ?refLead,
    });
    return Contribution.fromJson(j['contribution'] as Json, j['links'] as Json);
  }

  Future<List<Blessing>> blessings(String slug) async =>
      (await api.get<List<dynamic>>('/weddings/${_s(slug)}/blessings', query: {'limit': 100})).map((e) => Blessing.fromJson(e as Json)).toList();

  Future<Blessing> postBlessing(String slug, String message) async => Blessing.fromJson(await api.post<Json>('/weddings/${_s(slug)}/blessings', data: {'message': message}));

  Future<MyRsvp> myRsvp(String slug) async => MyRsvp.fromJson(await api.get<Json>('/weddings/${_s(slug)}/rsvp/me'));

  Future<void> saveRsvp(String slug, Json body) => api.put<dynamic>('/weddings/${_s(slug)}/rsvp/me', data: body);

  Future<StagePayload> stage(String slug) async => StagePayload.fromJson(await api.get<Json>('/weddings/${_s(slug)}/stage'));

  Future<Dashboard> dashboard(String slug) async => Dashboard.fromJson(await api.get<Json>('/weddings/${_s(slug)}/dashboard'));

  Future<List<DispatchSummary>> dispatches(String slug) async =>
      (await api.get<List<dynamic>>('/weddings/${_s(slug)}/dispatches')).map((e) => DispatchSummary.fromJson(e as Json)).toList();

  Future<int> dispatchPreview(String slug, Json body) async => ((await api.post<Json>('/weddings/${_s(slug)}/dispatches/preview', data: body))['recipients'] as num).toInt();

  Future<DispatchSummary> createDispatch(String slug, Json body) async => DispatchSummary.fromJson(await api.post<Json>('/weddings/${_s(slug)}/dispatches', data: body));

  Future<List<Ceremony>> ceremonies(String slug) async => (await api.get<List<dynamic>>('/weddings/${_s(slug)}/ceremonies')).map((e) => Ceremony.fromJson(e as Json)).toList();
}
