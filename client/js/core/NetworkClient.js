// PropHunt/client/js/core/NetworkClient.js
export class NetworkClient { 
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.onMessageCallback = null;
        this.clientId = null;
    }

    connect(serverUrl) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('Already connected to server.');
            return;
        }

        this.socket = new WebSocket(serverUrl);

        this.socket.onopen = (event) => {
            this.isConnected = true;
            console.log('Connected to server!');
        };

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'connected') {
                this.clientId = message.clientId;
                console.log(`Assigned Client ID: ${this.clientId}`);
            }
            if (this.onMessageCallback) {
                this.onMessageCallback(message);
            }
        };

        this.socket.onclose = (event) => {
            this.isConnected = false;
            console.log('Disconnected from server:', event.reason);
            this.clientId = null;
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };
    }

    sendMessage(data) {
        if (this.isConnected) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn('Not connected to server, message not sent:', data);
        }
    }

    setOnMessageCallback(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * Sends the local player's input state to the server. (For server-authoritative physics)
     * @param {Object} keyboardState Plain object representing keyboard state (e.g., {KeyW: true}).
     * @param {{x:number, y:number}} mouseDelta Accumulated mouse movement delta.
     */
    sendPlayerInput(keyboardState, mouseDelta) { // <--- THIS IS THE MISSING FUNCTION
        this.sendMessage({
            type: 'playerInput', // Message type for raw input
            keyboard: keyboardState,
            mouseDelta: mouseDelta
        });
    }

    // sendPlayerState is NO LONGER needed in the server-authoritative client
    // because the client sends raw input, not its own calculated position/state.
    // However, if other parts of code still expect it, it would need to be re-added or its calls removed.
    // For now, let's just make sure it's not present if it's causing issues.
    // If main.js calls sendPlayerState, it will cause an error.
    // main.js is currently calling networkClient.sendPlayerInput. So sendPlayerState is not needed.

    sendSeekerSwing(swingData) {
        this.sendMessage({
            type: 'seekerSwing',
            swingData: swingData
        });
    }

    sendHiderMorph(targetPropId) {
        this.sendMessage({
            type: 'hiderMorph',
            targetPropId: targetPropId
        });
    }
}