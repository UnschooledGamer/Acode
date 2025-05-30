var exec = require('cordova/exec');

class WebSocketInstance {
    constructor(url, instanceId) {
        this.instanceId = instanceId;
        this.extensions = '';
        this.readyState = WebSocketInstance.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.url = url;

        exec((event) => {
            if (event.type === 'open') {
                this.readyState = WebSocketInstance.OPEN;
                this.extensions = event.extensions || '';
                if (this.onopen) this.onopen(event);
            }
            if (event.type === 'message' && this.onmessage) this.onmessage(event);
            if (event.type === 'close') {
                this.readyState = WebSocketInstance.CLOSED;
                if (this.onclose) this.onclose(event);
            }
            if (event.type === 'error' && this.onerror) this.onerror(event);
        }, null, "WebSocketPlugin", "registerListener", [this.instanceId]);
    }

    send(message) {
        if (this.readyState === WebSocketInstance.OPEN) {
            exec(null, null, "WebSocketPlugin", "send", [this.instanceId, message]);
        } else {
            throw new Error("WebSocket is not open");
        }
    }

    close() {
        this.readyState = WebSocketInstance.CLOSING;
        exec(null, null, "WebSocketPlugin", "close", [this.instanceId]);
    }
}

WebSocketInstance.CONNECTING = 0;
WebSocketInstance.OPEN = 1;
WebSocketInstance.CLOSING = 2;
WebSocketInstance.CLOSED = 3;

const connect = function(url, protocols = null) {
    return new Promise((resolve, reject) => {
        exec(instanceId => resolve(new WebSocketInstance(url, instanceId)), reject, "WebSocketPlugin", "connect", [url, protocols]);
    });
};

module.exports = { connect };
