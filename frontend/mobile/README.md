# PlotTheirFuture — mobile app (Flutter)

Guest and host companion app for PlotTheirFuture. It talks to the NestJS API in
[`../../backend`](../../backend) and shares the same accounts (WhatsApp/SMS OTP).

## What it does

| Area | Guests | Hosts, co-hosts, family leads, venue staff |
| --- | --- | --- |
| Sign-in | Phone + one-time code, tokens kept in the platform keychain/keystore | same |
| Invitation | Hero, countdown, welcome note, video, personal itinerary, maps, live-stream and add-to-calendar links | all ceremonies |
| RSVP | Party size within the invitation's seat limit, ceremonies, dietary, travel, stay, shuttle | — |
| Home gift | Live floor plan (one tile per sq.ft.), gift sheet, reserve-and-pay, "your gifts" with certificate links | — |
| Blessings | Post a blessing, wall of love, approved blessings | — |
| Host tab | — | Dashboard (admins), WhatsApp invitation dispatch (admins and leads), live stage screen, link to the full web console |

Payments and receipts open in the browser on the web app (`/pay/…`, `/thank-you/…`), so the
same Razorpay checkout, receipt PDF and verification pages serve web and mobile. The app refreshes
the registry and "your gifts" when it returns to the foreground. Live updates (new gifts, tile holds,
approved blessings) arrive over Socket.IO.

## Configuration

Both values are compile-time `--dart-define`s:

| Name | Default | Purpose |
| --- | --- | --- |
| `API_URL` | `http://localhost:5000` | API origin (without `/api/v1`). Use `http://10.0.2.2:5000` on the Android emulator. |
| `WEB_URL` | `http://localhost:3000` | Web app origin, used for the "Full console" link. |

## Run

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:5000 --dart-define=WEB_URL=http://10.0.2.2:3000
```

For Flutter web, the web origin (for example `http://localhost:8080`) must be listed in the API's
`CORS_ORIGINS`.

## Quality checks

```bash
flutter analyze
flutter test
flutter build web --dart-define=API_URL=https://api.example.com
```

## Release builds

- Android: `flutter build appbundle --release --dart-define=API_URL=https://api.example.com --dart-define=WEB_URL=https://example.com`.
  Configure your upload keystore in `android/app/build.gradle.kts`. Release builds disallow cleartext HTTP, so the API must use HTTPS.
- iOS: `flutter build ipa --release --dart-define=...`. Only local-network HTTP is allowed (`NSAllowsLocalNetworking`).

## Layout

```
lib/
  core/        config (dart-defines), theme, formatters
  data/        API client (dio + token refresh), models, repository, Socket.IO live connection
  state/       Riverpod providers (auth session, per-wedding data)
  screens/     login, home (my weddings), wedding (tabs), live stage, why-gift, security FAQ
  widgets/     gift sheet, RSVP sheet, tile grid, shared UI
```
