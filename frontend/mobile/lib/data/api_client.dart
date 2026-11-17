import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/config.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  final String? code;
  final Map<String, dynamic>? body;

  const ApiException(this.status, this.message, {this.code, this.body});

  static ApiException from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      final status = error.response?.statusCode ?? 0;
      if (data is Map<String, dynamic>) {
        final raw = data['message'];
        final message = raw is List ? raw.join(', ') : (raw?.toString() ?? 'Request failed');
        return ApiException(status, message, code: data['code'] as String?, body: data);
      }
      if (status == 0) return const ApiException(0, 'Could not reach the server. Check your connection.');
      return ApiException(status, error.message ?? 'Request failed');
    }
    return ApiException(0, error.toString());
  }

  @override
  String toString() => message;
}

/// Access + refresh tokens persisted in the platform keychain/keystore.
class TokenStore {
  static const _access = 'ptf.access';
  static const _refresh = 'ptf.refresh';
  final FlutterSecureStorage _storage;
  String? _cachedAccess;
  String? _cachedRefresh;

  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  Future<void> load() async {
    _cachedAccess = await _storage.read(key: _access);
    _cachedRefresh = await _storage.read(key: _refresh);
  }

  String? get access => _cachedAccess;
  String? get refresh => _cachedRefresh;

  Future<void> save(String access, String refresh) async {
    _cachedAccess = access;
    _cachedRefresh = refresh;
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    _cachedAccess = null;
    _cachedRefresh = null;
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}

/// Dio client that attaches the bearer token and transparently rotates the
/// refresh token once on a 401 (single-flight across concurrent requests).
class ApiClient {
  final Dio dio;
  final TokenStore tokens;
  void Function()? onSessionExpired;
  Future<bool>? _refreshing;

  ApiClient(this.tokens)
      : dio = Dio(BaseOptions(
          baseUrl: AppConfig.apiBase,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          contentType: 'application/json',
        )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = tokens.access;
        if (token != null && options.extra['auth'] != false) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final req = error.requestOptions;
        final retriable = error.response?.statusCode == 401 && req.extra['retried'] != true && req.extra['auth'] != false && tokens.refresh != null;
        if (!retriable) return handler.next(error);
        if (await _refresh()) {
          req.extra['retried'] = true;
          req.headers['Authorization'] = 'Bearer ${tokens.access}';
          try {
            return handler.resolve(await dio.fetch(req));
          } on DioException catch (e) {
            return handler.next(e);
          }
        }
        onSessionExpired?.call();
        handler.next(error);
      },
    ));
  }

  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final res = await dio.post<Map<String, dynamic>>(
          '/auth/refresh',
          data: {'refreshToken': tokens.refresh},
          options: Options(extra: {'auth': false}),
        );
        await tokens.save(res.data!['accessToken'] as String, res.data!['refreshToken'] as String);
        return true;
      } catch (_) {
        await tokens.clear();
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query, bool auth = true}) => _wrap(() => dio.get<T>(path, queryParameters: query, options: Options(extra: {'auth': auth})));

  Future<T> post<T>(String path, {Object? data, Map<String, dynamic>? query, bool auth = true}) =>
      _wrap(() => dio.post<T>(path, data: data, queryParameters: query, options: Options(extra: {'auth': auth})));

  Future<T> put<T>(String path, {Object? data}) => _wrap(() => dio.put<T>(path, data: data));

  Future<T> patch<T>(String path, {Object? data}) => _wrap(() => dio.patch<T>(path, data: data));

  Future<T> _wrap<T>(Future<Response<T>> Function() call) async {
    try {
      final res = await call();
      return res.data as T;
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}
