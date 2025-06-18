// /client/js/core/NetworkClient.js
export class NetworkClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.onMessageCallback = null;
    }

    connect(serverUrl) {
        if (this.socket?.readyState === WebSocket.OPEN) return;

        this.socket = new WebSocket(serverUrl);

        this.socket.onopen = () => {
            this.isConnected = true;
            console.log('Successfully connected to server!');
        };

        this.socket.onmessage = (event) => {
            if (this.onMessageCallback) {
                this.onMessageCallback(JSON.parse(event.data));
            }
        };

        this.socket.onclose = () => {
            this.isConnected = false;
            if (this.onMessageCallback) {
                this.onMessageCallback({ type: 'disconnectedFromServer' });
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };
    }

    sendMessage(data) {
        if (this.isConnected) {
            this.socket.send(JSON.stringify(data));
        }
    }

    setOnMessageCallback(callback) {
        this.onMessageCallback = callback;
    }

    sendPlayerInput(keyboardState, mouseDelta) {
        this.sendMessage({
            type: 'playerInput',
            keyboard: keyboardState,
            mouseDelta: mouseDelta
        });
    }

    sendTogglePauseRequest() {
        this.sendMessage({ type: 'togglePauseRequest' });
    }

    sendSeekerSwing() {
        this.sendMessage({ type: 'seekerSwing' });
    }

    sendHiderMorph(targetPropId) {
        this.sendMessage({
            type: 'hiderMorph',
            targetPropId: targetPropId
        });
    }
}