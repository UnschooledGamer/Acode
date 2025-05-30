# Cordova Plugin: OkHttp WebSocket

A Cordova plugin that uses [OkHttp](https://square.github.io/okhttp/) to provide WebSocket support in your Cordova app.
It aims to mimic the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) in JavaScript, with additional features.

## Features

* ✅ WebSocket API-like interface
* ✅ Event support: `onopen`, `onmessage`, `onerror`, `onclose`
* ✅ `extensions` and `readyState` properties
* ✅ Support for protocols
* ✅ Compatible with Cordova for Android

---

## Usage

### Import

```javascript
const WebSocketPlugin = cordova.websocket;
```

### Connect to WebSocket

```javascript
WebSocketPlugin.connect("wss://example.com/socket", ["protocol1", "protocol2"])
  .then(ws => {
    ws.onopen = (e) => console.log("Connected!", e);
    ws.onmessage = (e) => console.log("Message:", e.data);
    ws.onerror = (e) => console.error("Error:", e);
    ws.onclose = (e) => console.log("Closed:", e);
    
    ws.send("Hello from Cordova!");
    ws.close();
  })
  .catch(err => console.error("WebSocket connection failed:", err));
```

---

## API Reference

### Methods

* `WebSocketPlugin.connect(url, protocols)`

    * Connects to a WebSocket server.
    * `url`: The WebSocket server URL.
    * `protocols`: (Optional) An array of subprotocol strings.
    * Returns: A Promise that resolves to a `WebSocketInstance`.

* `WebSocketInstance.send(message)`

    * Sends a message to the server.
    * Throws an error if the connection is not open.

* `WebSocketInstance.close()`

    * Closes the connection.

---

### Properties of `WebSocketInstance`

* `onopen`: Event listener for connection open.
* `onmessage`: Event listener for messages received.
* `onclose`: Event listener for connection close.
* `onerror`: Event listener for errors.
* `readyState`: (number) The state of the connection.

    * 0 (`CONNECTING`): Socket created, not yet open.
    * 1 (`OPEN`): Connection is open and ready.
    * 2 (`CLOSING`): Connection is closing.
    * 3 (`CLOSED`): Connection is closed or couldn't be opened.
* `extensions`: (string) Extensions negotiated by the server (usually empty or a list).

---

## Notes

* Only supported on Android (via OkHttp).
* Make sure to handle connection lifecycle properly (close sockets when done).

---