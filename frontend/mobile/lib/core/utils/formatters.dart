import 'package:intl/intl.dart';

/// All money values from the API are integer paise; dates are ISO-8601 UTC and
/// shown in India Standard Time, which is where every wedding on the platform happens.
class Formatters {
  static final NumberFormat _inr = NumberFormat.currency(symbol: '₹', decimalDigits: 0, locale: 'en_IN');
  static final NumberFormat _inrCompact = NumberFormat.compactCurrency(symbol: '₹', decimalDigits: 1, locale: 'en_IN');
  static final NumberFormat _number = NumberFormat('#,##,##0', 'en_IN');
  static const Duration _ist = Duration(hours: 5, minutes: 30);

  static String inr(int paise) => _inr.format(paise / 100);
  static String inrCompact(int paise) => _inrCompact.format(paise / 100);
  static String sqft(int n) => '${_number.format(n)} sq.ft.';
  static String number(int n) => _number.format(n);
  static String percent(double ratio) => '${(ratio * 100).round()}%';

  static DateTime toIst(DateTime utc) => utc.toUtc().add(_ist);

  static String dateLong(DateTime d) => DateFormat('d MMMM yyyy').format(toIst(d));
  static String dateTime(DateTime d) => DateFormat('d MMM yyyy • h:mm a').format(toIst(d));
  static String time(DateTime d) => DateFormat('h:mm a').format(toIst(d));
  static String dayShort(DateTime d) => DateFormat('MMM d').format(toIst(d));
  static String weekday(DateTime d) => DateFormat('EEEE').format(toIst(d));

  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}
