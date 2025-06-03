package com.foxdebug.websocket;

import android.util.Log;

import androidx.annotation.NonNull;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.concurrent.TimeUnit;

import okhttp3.*;

import okio.ByteString;

public class WebSocketInstance extends WebSocketListener {
    private static final int DEFAULT_CLOSE_CODE = 1000;
    private static final String DEFAULT_CLOSE_REASON = "Normal closure";

    private WebSocket webSocket;
    private CallbackContext callbackContext;
    private final CordovaInterface cordova;
    private final String instanceId;
    private String extensions = "";
    private String protocol = "";
    private String binaryType = "";
    private int readyState = 0; // CONNECTING

    // okHttpMainClient parameter is used. To have a single main client(singleton), with per-websocket configuration using newBuilder method.
    public WebSocketInstance(String url, JSONArray protocols, JSONObject headers, String binaryType, OkHttpClient okHttpMainClient, CordovaInterface cordova, String instanceId) {
        this.cordova = cordova;
        this.instanceId = instanceId;
        this.binaryType = binaryType;

        OkHttpClient client = okHttpMainClient.newBuilder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .build();

        Request.Builder requestBuilder = new Request.Builder().url(url);

        // custom headers support.
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.optString(key);
                requestBuilder.addHeader(key, value);
            }
        }

        // adds Sec-WebSocket-Protocol header if protocols is present.
        if (protocols != null) {
            StringBuilder protocolHeader = new StringBuilder();
            for (int i = 0; i < protocols.length(); i++) {
                protocolHeader.append(protocols.optString(i)).append(",");
            }
            if (protocolHeader.length() > 0) {
                protocolHeader.setLength(protocolHeader.length() - 1);
                requestBuilder.addHeader("Sec-WebSocket-Protocol", protocolHeader.toString());
            }
        }

        client.newWebSocket(requestBuilder.build(), this);
    }

    public void setCallback(CallbackContext callbackContext) {
        this.callbackContext = callbackContext;
        PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT);
        result.setKeepCallback(true);
        callbackContext.sendPluginResult(result);
    }

    public void send(String message) {
        if (this.webSocket != null) {
            this.webSocket.send(message);
            Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received send() action call, sending message=" + message);
        } else {
            Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received send() action call, ignoring... as webSocket is null (not present)");
        }
    }

    public String close(int code, String reason) {
        if (this.webSocket != null) {
            this.readyState = 2; // CLOSING
            try {
                boolean result = this.webSocket.close(code, reason);
                Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received close() action call");

                // if a graceful shutdown was already underway...
                // or if the web socket is already closed or canceled. do nothing.
                if(!result) {
                    return null;
                }
            } catch (Exception e) {
                return e.getMessage();
            }

            return null;
        } else {
            Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received close() action call, ignoring... as webSocket is null (not present)");
            // TODO: finding a better way of telling it wasn't successful.
            return "";
        }
    }

    public String close() {
        Log.d("WebSocketInstance", "WebSocket instanceId=" + this.instanceId + " close() called with no arguments. Using defaults.");
        // Calls the more specific version with default values
        return close(DEFAULT_CLOSE_CODE, DEFAULT_CLOSE_REASON);
    }

    @Override
    public void onOpen(@NonNull WebSocket webSocket, Response response) {
        this.webSocket = webSocket;
        this.readyState = 1; // OPEN
        this.extensions = response.headers("Sec-WebSocket-Extensions").toString();
        this.protocol = response.header("Sec-WebSocket-Protocol");
        Log.i("WebSocketInstance", "websocket instanceId=" + this.instanceId + " Opened" + "received extensions=" + this.extensions);
        sendEvent("open", null, false);
    }

    @Override
    public void onMessage(@NonNull WebSocket webSocket, @NonNull String text) {
        Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId +  " Received message: " + text);
        sendEvent("message", text, false);
    }

    // This is called when the Websocket server sends a binary(type 0x2) message.
    @Override
    public void onMessage(@NonNull WebSocket webSocket, @NonNull ByteString bytes) {
        Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId +  " Received message(bytes): " + bytes.toString());

        try {
            if ("arraybuffer".equals(this.binaryType)) {
                String base64 = bytes.base64();
                sendEvent("message", base64, true);
            } else {
                sendEvent("message", bytes.utf8(), true);
            }
        } catch (Exception e) {
            Log.e("WebSocketInstance", "Error sending message", e);
        }

    }

    @Override
    public void onClosing(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
        this.readyState = 2; // CLOSING
        Log.i("WebSocketInstance", "websocket instanceId=" + this.instanceId + " is Closing code: " + code + " reason: " + reason);
    }

    @Override
    public void onClosed(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
        this.readyState = 3; // CLOSED
        Log.i("WebSocketInstance", "websocket instanceId=" + this.instanceId + " Closed code: " + code + " reason: " + reason);
        JSONObject closedEvent = new JSONObject();
        try {
            closedEvent.put("code", code);
            closedEvent.put("reason", reason);
        } catch (JSONException e) {
            Log.e("WebSocketInstance", "Error creating close event", e);
        }
        sendEvent("close", closedEvent.toString(), false);
    }

    @Override
    public void onFailure(@NonNull WebSocket webSocket, Throwable t, Response response) {
        this.readyState = 3; // CLOSED
        sendEvent("error", t.getMessage(), false);
        Log.e("WebSocketInstance", "websocket instanceId=" + this.instanceId + " Error: " + t.getMessage());
    }

    private void sendEvent(String type, String data, boolean isBinary) {
        if (callbackContext != null) {
            try {
                JSONObject event = new JSONObject();
                event.put("type", type);
                event.put("extensions", this.extensions);
                event.put("readyState", this.readyState);
                event.put("isBinary", isBinary ? true : false);
                if (data != null) event.put("data", data);
                Log.d("WebSocketInstance", "sending event: " + type + " eventObj " + event.toString());
                PluginResult result = new PluginResult(PluginResult.Status.OK, event);
                result.setKeepCallback(true);
                callbackContext.sendPluginResult(result);
            } catch (Exception e) {
                Log.e("WebSocketInstance", "Error sending event", e);
            }
        }
    }
}
