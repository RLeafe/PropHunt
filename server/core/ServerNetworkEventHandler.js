// /server/core/ServerNetworkEventHandler.js
import * as State from './ServerGameState.js';
import * as GameLogic from './ServerGameLogic.js';
import { GameStates } from '../../client/shared/utils/GameEnums.js';

/**
 * Handles all incoming messages from clients and routes them to the appropriate game logic.
 */
export class ServerNetworkEventHandler {
    constructor(gameManager) {
        if (!gameManager) {
            throw new Error("ServerNetworkEventHandler requires a gameManager instance.");
        }
        this.gameManager = gameManager;
    }

    /**
     * Parses a raw message from a client and triggers the correct action.
     * @param {WebSocket} ws - The WebSocket connection the message came from.
     * @param {Buffer} rawMessage - The raw message data from the client.
     */
    handle(ws, rawMessage) {
        try {
            const messageString = rawMessage.toString();
            const data = JSON.parse(messageString);

            const senderId = State.playerConnections.get(ws);
            if (!senderId) return;
            const player = State.getPlayer(senderId);

            switch (data.type) {
                case 'playerInput': {
                    const input = this.gameManager.playerInputs.get(senderId);
                    if (input) {
                        input.keyboard = new Map(Object.entries(data.keyboard || {}));
                        if (data.mouseDelta) {
                            input.mouseDelta.x += data.mouseDelta.x || 0;
                            input.mouseDelta.y += data.mouseDelta.y || 0;
                        }
                    }
                    break;
                }
                case 'togglePauseRequest': {
                    if (player) {
                        player.isFrozen = !player.isFrozen;
                        this.gameManager.broadcaster.toClient(senderId, {
                            type: 'playerFreezeStateUpdate',
                            isFrozen: player.isFrozen,
                            message: player.isFrozen ? "Game Paused" : "Game Resumed"
                        });
                    }
                    break;
                }
                case 'seekerSwing':
                    if (State.getCurrentGameState() === GameStates.PLAYING) {
                        GameLogic.processSeekerHit(senderId);
                    }
                    break;
                case 'hiderMorph':
                    const currentState = State.getCurrentGameState();
                    if (currentState === GameStates.PLAYING || currentState === GameStates.STARTING) {
                        GameLogic.processHiderMorph(senderId, data.targetPropId);
                    }
                    break;
            }
        } catch (error) {
            console.error("Failed to parse client message:", rawMessage.toString(), error);
        }
    }
}