package com.foxdebug.websocket;

import android.util.Log;

import androidx.annotation.NonNull;

import org.apache.cordova.*;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

import okhttp3.*;

public class WebSocketInstance extends WebSocketListener {
    private WebSocket webSocket;
    private CallbackContext callbackContext;
    private CordovaInterface cordova;
    private String instanceId;
    private String extensions = "";
    private int readyState = 0; // CONNECTING

    public WebSocketInstance(String url, JSONArray protocols, CordovaInterface cordova, String instanceId) {
        this.cordova = cordova;
        this.instanceId = instanceId;

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .build();

        Request.Builder requestBuilder = new Request.Builder().url(url);
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
        if (webSocket != null) {
            webSocket.send(message);
        }
    }

    public void close() {
        if (webSocket != null) {
            readyState = 2; // CLOSING
            webSocket.close(1000, "Normal closure");
            Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received close() action call");
        }

        Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId + " received close() action call, ignoring... as webSocket is null (not present)");
    }

    @Override
    public void onOpen(@NonNull WebSocket webSocket, Response response) {
        this.webSocket = webSocket;
        this.readyState = 1; // OPEN
        this.extensions = response.headers("Sec-WebSocket-Extensions").toString();
        Log.i("WebSocketInstance", "websocket instanceId=" + this.instanceId + " Opened" + "received extensions=" + this.extensions);
        sendEvent("open", null);
    }

    @Override
    public void onMessage(@NonNull WebSocket webSocket, String text) {
        sendEvent("message", text);
        Log.d("WebSocketInstance", "websocket instanceId=" + this.instanceId +  " Received message: " + text);
    }

    @Override
    public void onClosing(WebSocket webSocket, int code, String reason) {
        this.readyState = 2; // CLOSING
        sendEvent("close", reason);
        Log.i("WebSocketInstance", "websocket instanceId=" + this.instanceId + " is Closing code: " + code + " reason: " + reason);
    }

    @Override
    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
        this.readyState = 3; // CLOSED
        sendEvent("error", t.getMessage());
        Log.e("WebSocketInstance", "websocket instanceId=" + this.instanceId + " Error: " + t.getMessage());
    }

    private void sendEvent(String type, String data) {
        if (callbackContext != null) {
            try {
                JSONObject event = new JSONObject();
                event.put("type", type);
                event.put("extensions", this.extensions);
                event.put("readyState", this.readyState);
                if (data != null) event.put("data", data);
                PluginResult result = new PluginResult(PluginResult.Status.OK, event);
                result.setKeepCallback(true);
                callbackContext.sendPluginResult(result);
            } catch (Exception e) {
                Log.e("WebSocketInstance", "Error sending event", e);
            }
        }
    }
}
