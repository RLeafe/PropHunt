// /server/core/ServerGameManager.js
import * as State from './ServerGameState.js';
import * as GameLogic from './ServerGameLogic.js';
import { TimerManager } from './TimerManager.js';
import { MIN_PLAYERS, SERVER_TICK_RATE_MS } from '../config/ServerConfig.js';
import { GameStates } from '../../client/shared/utils/GameEnums.js';

export class ServerGameManager {
    constructor(wss) {
        this.wss = wss;
        this.timerManager = new TimerManager();
        this.playerInputs = new Map();
        this.lastTickTime = Date.now();
        this.gameLoopIntervalId = null;

        GameLogic.initializeGameLogic({
            wss: this.wss,
            timerManager: this.timerManager,
            playerConnections: State.playerConnections,
        });
    }

    startGameLoop() {
        if (this.gameLoopIntervalId) return;
        this.gameLoopIntervalId = setInterval(() => {
            const now = Date.now();
            const deltaTime = (now - this.lastTickTime) / 1000.0;
            this.lastTickTime = now;
            this.update(deltaTime);
        }, SERVER_TICK_RATE_MS);
    }

    update(deltaTime) {
        this.processPlayerPhysics(deltaTime);
        this.broadcastPlayerStates();
    }

    processPlayerPhysics(deltaTime) {
        State.players.forEach(player => {
            const input = this.playerInputs.get(player.playerId);
            if (input) {
                // We still gather input even if frozen, we just don't apply it in ServerPlayer
                player.input.keyboard = input.keyboard;
                player.input.mouseDelta = { ...input.mouseDelta };
                input.mouseDelta = { x: 0, y: 0 };
            } else {
                player.input.keyboard.clear();
                player.input.mouseDelta = { x: 0, y: 0 };
            }
            player.updatePhysics(deltaTime);
        });
    }

    broadcastPlayerStates() {
        const payload = { type: 'playerUpdateBatch', players: State.getAllPlayersState() };
        const message = JSON.stringify(payload);
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) client.send(message);
        });
    }

    handleClientConnected(ws, clientId) {
        State.addPlayer(clientId, ws);
        this.playerInputs.set(clientId, { keyboard: new Map(), mouseDelta: { x: 0, y: 0 } });
        console.log(`[Server] Client connected: ${clientId}. Total: ${State.players.size}`);

        ws.send(JSON.stringify({ type: 'connected', clientId }));
        ws.send(JSON.stringify({ type: 'initialState', players: State.getAllPlayersState(), gameState: State.getCurrentGameState() }));

        this.broadcastToAllButOne(ws, { type: 'playerConnected', player: State.getPlayer(clientId) });

        if (State.players.size >= MIN_PLAYERS && State.getCurrentGameState() === GameStates.LOBBY) {
            GameLogic.startGame();
        }
    }

    handleClientMessage(ws, rawMessage) {
        try {
            const data = JSON.parse(rawMessage);
            const senderId = State.playerConnections.get(ws);
            if (!senderId) return;
            const player = State.getPlayer(senderId);

            switch (data.type) {
                case 'playerInput': {
                    const input = this.playerInputs.get(senderId);
                    if (input) {
                        input.keyboard = new Map(Object.entries(data.keyboard || {}));
                        input.mouseDelta.x += data.mouseDelta.x || 0;
                        input.mouseDelta.y += data.mouseDelta.y || 0;
                    }
                    break;
                }
                case 'togglePauseRequest': {
                    if (player) {
                        player.isFrozen = !player.isFrozen;
                        const clientSocket = GameLogic.findSocketById(senderId);
                        if (clientSocket) {
                            clientSocket.send(JSON.stringify({
                                type: 'playerFreezeStateUpdate',
                                isFrozen: player.isFrozen,
                                message: player.isFrozen ? "Game Paused" : "Game Resumed"
                            }));
                        }
                    }
                    break;
                }
                case 'seekerSwing':
                    if (State.getCurrentGameState() === GameStates.PLAYING) GameLogic.processSeekerHit(senderId);
                    break;
                case 'hiderMorph':
                    if (State.getCurrentGameState() === GameStates.PLAYING) GameLogic.processHiderMorph(senderId, data.targetPropId);
                    break;
            }
        } catch (error) {
            console.error("Failed to parse client message:", rawMessage, error);
        }
    }

    handleClientDisconnected(ws) {
        const disconnectedId = State.removePlayer(ws);
        if (disconnectedId) {
            this.playerInputs.delete(disconnectedId);
            this.broadcastToAllButOne(null, { type: 'playerDisconnected', playerId: disconnectedId });
            if (State.getCurrentGameState() === GameStates.PLAYING && (State.players.size < MIN_PLAYERS || State.getHiderCount() <= 0)) {
                GameLogic.endGame('A player left or all hiders were found.');
            }
        }
    }
    
    broadcastToAllButOne(exceptWs, payload) {
        const message = JSON.stringify(payload);
        this.wss.clients.forEach(client => {
            if (client !== exceptWs && client.readyState === 1) {
                client.send(message);
            }
        });
    }
}