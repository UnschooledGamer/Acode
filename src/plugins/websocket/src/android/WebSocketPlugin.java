package com.foxdebug.websocket;

import org.apache.cordova.*;
import org.json.*;

import java.util.HashMap;
import java.util.UUID;

// @TODO: plugin init & plugin destroy(closing okhttp clients) lifecycles.
public class WebSocketPlugin extends CordovaPlugin {
    private static final HashMap<String, WebSocketInstance> instances = new HashMap<>();

    @Override
    public boolean execute(String action, JSONArray args, final CallbackContext callbackContext) throws JSONException {
        switch (action) {
            case "connect":
                String url = args.optString(0);
                JSONArray protocols = args.optJSONArray(1);
                String id = UUID.randomUUID().toString();
                WebSocketInstance instance = new WebSocketInstance(url, protocols, cordova, id);
                instances.put(id, instance);
                callbackContext.success(id);
                return true;

            case "send":
                String instanceId = args.optString(0);
                String message = args.optString(1);
                WebSocketInstance inst = instances.get(instanceId);
                if (inst != null) {
                    inst.send(message);
                    callbackContext.success();
                } else {
                    callbackContext.error("Invalid instance ID");
                }
                return true;

            case "close":
                instanceId = args.optString(0);
                inst = instances.get(instanceId);
                if (inst != null) {
                    inst.close();
                    instances.remove(instanceId);
                    callbackContext.success();
                } else {
                    callbackContext.error("Invalid instance ID");
                }
                return true;

            case "registerListener":
                instanceId = args.optString(0);
                inst = instances.get(instanceId);
                if (inst != null) {
                    inst.setCallback(callbackContext);
                } else {
                    callbackContext.error("Invalid instance ID");
                }
                return true;

            default:
                return false;
        }
    }
}
