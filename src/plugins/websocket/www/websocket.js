var exec = require('cordova/exec');
/**
 * Whether to log debug messages
 */
let DEBUG = false;

const logIfDebug = (...args) => {
    if (DEBUG) {
        console.log(...args);
    }
};

class WebSocketInstance extends EventTarget {
    constructor(url, instanceId) {
        super();
        this.instanceId = instanceId;
        this.extensions = '';
        this.readyState = WebSocketInstance.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.url = url;
        this.binaryType = ''; // empty as Default is string.

        exec((event) => {
            logIfDebug(`[Cordova WebSocket - ID=${this.instanceId}] Event from native:`, event);

            if (event.type === 'open') {
                this.readyState = WebSocketInstance.OPEN;
                this.extensions = event.extensions || '';
                if (this.onopen) this.onopen(event);
                this.dispatchEvent(new Event('open'));
            }

            if (event.type === 'message') {
                let msgData = event.data;
                if (event.isBinary && this.binaryType === 'arraybuffer') {
                    let binary = atob(msgData);
                    let bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    msgData = bytes.buffer;
                }
                logIfDebug(`[Cordova WebSocket - ID=${this.instanceId}] msg Event:`, event, msgData);
                const msgEvent = new MessageEvent('message', { data: msgData });
                if (this.onmessage) this.onmessage(msgEvent);
                this.dispatchEvent(msgEvent);
            }

            if (event.type === 'close') {
                this.readyState = WebSocketInstance.CLOSED;
                const closeEvent = new CloseEvent('close', { code: event.data?.code, reason: event.data?.reason });
                if (this.onclose) this.onclose(closeEvent);
                this.dispatchEvent(closeEvent);
            }

            if (event.type === 'error') {
                const errorEvent = new Event('error', { message: event?.data });
                if (this.onerror) this.onerror(errorEvent);
                this.dispatchEvent(errorEvent);
            }
        }, null, "WebSocketPlugin", "registerListener", [this.instanceId]);
    }

    send(message) {
        if (this.readyState !== WebSocketInstance.OPEN) {
            throw new Error(`WebSocket is not open/connected`);
        }

        let finalMessage = null;
        if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
            const uint8Array = message instanceof ArrayBuffer ? new Uint8Array(message) : message;
            finalMessage = btoa(String.fromCharCode.apply(null, uint8Array));
            
            exec(() => logIfDebug(`[Cordova WebSocket - ID=${this.instanceId}] Sent message:`, finalMessage), (err) => console.error(`[Cordova WebSocket - ID=${this.instanceId}] Send error:`, err), "WebSocketPlugin", "send", [this.instanceId, finalMessage]);
        } else if (typeof message === 'string') {
            finalMessage = message;

            exec(() => logIfDebug(`[Cordova WebSocket - ID=${this.instanceId}] Sent message:`, finalMessage), (err) => console.error(`[Cordova WebSocket - ID=${this.instanceId}] Send error:`, err), "WebSocketPlugin", "send", [this.instanceId, finalMessage]);
        } else {
            throw new Error(`Unsupported message type: ${typeof message}`);
        }
    }

    /**
     * Closes the WebSocket connection.
     *
     * @param {number} code The status code explaining why the connection is being closed.
     * @param {string} reason A human-readable string explaining why the connection is being closed.
     */
    close(code, reason) {
        this.readyState = WebSocketInstance.CLOSING;
        exec(() => logIfDebug(`[Cordova WebSocket - ID=${this.instanceId}] Close requested`, code, reason), (err) => console.error(`[Cordova WebSocket - ID=${this.instanceId}] Close error`, err), "WebSocketPlugin", "close", [this.instanceId, code, reason]);
    }
}

WebSocketInstance.CONNECTING = 0;
WebSocketInstance.OPEN = 1;
WebSocketInstance.CLOSING = 2;
WebSocketInstance.CLOSED = 3;

const connect = function(url, protocols = null, headers = null, binaryType) {
    return new Promise((resolve, reject) => {
        exec(instanceId => resolve(new WebSocketInstance(url, instanceId)), reject, "WebSocketPlugin", "connect", [url, protocols, binaryType, headers]);
    });
};

const listClients = function() {
    return new Promise((resolve, reject) => {
        exec(resolve, reject, "WebSocketPlugin", "listClients", []);
    });
};

/** Utility functions, in-case you lost the websocketInstance returned from the connect function */

const send = function(instanceId, message) {
    return new Promise((resolve, reject) => {
        if (typeof message === 'string') {
            exec(resolve, reject, "WebSocketPlugin", "send", [instanceId, message]);
        } else if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
            const uint8Array = message instanceof ArrayBuffer ? new Uint8Array(message) : message;
            const base64Message = btoa(String.fromCharCode.apply(null, uint8Array));
            
            exec(resolve, reject, "WebSocketPlugin", "send", [instanceId, base64Message]);
        } else {
            reject(`Unsupported message type: ${typeof message}`);
        }
    });
};

/**
 * Closes the WebSocket connection.
 *
 * @param {string} instanceId The ID of the WebSocketInstance to close.
 * @param {number} [code] (optional) The status code explaining why the connection is being closed.
 * @param {string} [reason] (optional) A human-readable string explaining why the connection is being closed.
 *
 * @returns {Promise} A promise that resolves when the close operation has completed.
 */
const close = function(instanceId, code, reason) {
    return new Promise((resolve, reject) => {
        exec(resolve, reject, "WebSocketPlugin", "close", [instanceId, code, reason]);
    });
};

module.exports = { connect, listClients, send, close, DEBUG };
