import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config.dart';

typedef LiveHandler = void Function(Map<String, dynamic> payload);

/// Socket.IO subscription to a wedding's `wedding`, `admin` or `stage` channel.
/// Re-joins the room automatically after reconnects.
class LiveConnection {
  final io.Socket _socket;

  LiveConnection._(this._socket);

  factory LiveConnection.connect({required String slug, required String channel, required String? token, required Map<String, LiveHandler> handlers}) {
    final socket = io.io(
      '${AppConfig.apiUrl}/live',
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).disableAutoConnect().enableReconnection().build(),
    );
    socket.onConnect((_) => socket.emit('join', {'slug': slug, 'channel': channel}));
    handlers.forEach((event, handler) {
      socket.on(event, (data) {
        if (data is Map) handler(Map<String, dynamic>.from(data));
      });
    });
    socket.connect();
    return LiveConnection._(socket);
  }

  void dispose() {
    _socket.dispose();
  }
}
