/// Build-time configuration. Override with
/// `flutter run --dart-define=API_URL=https://api.example.com --dart-define=WEB_URL=https://example.com`.
class AppConfig {
  static const String apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000');
  static const String webUrl = String.fromEnvironment('WEB_URL', defaultValue: 'http://localhost:3000');

  static String get apiBase => '$apiUrl/api/v1';
}
