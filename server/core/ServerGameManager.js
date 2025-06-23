// /server/core/ServerGameManager.js
import * as State from './ServerGameState.js';
import * as GameLogic from './ServerGameLogic.js';
import { TimerManager } from './TimerManager.js';
import { MIN_PLAYERS, SERVER_TICK_RATE_MS } from '../config/ServerConfig.js';
import { GameStates } from '../../client/shared/utils/GameEnums.js';
import { ServerNetworkBroadcaster } from './ServerNetworkBroadcaster.js';

/**
 * Manages the core game loop, player state, and physics updates.
 */
export class ServerGameManager {
    constructor(wss) {
        this.wss = wss;
        this.timerManager = new TimerManager();
        this.playerInputs = new Map();
        this.lastTickTime = Date.now();
        this.gameLoopIntervalId = null;

        this.broadcaster = new ServerNetworkBroadcaster(this.wss, State.playerConnections);

        GameLogic.initializeGameLogic({
            broadcaster: this.broadcaster,
            timerManager: this.timerManager,
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
                player.input.keyboard = input.keyboard;
                player.input.mouseDelta = { ...input.mouseDelta };
                input.mouseDelta = { x: 0, y: 0 }; 
            } else {
                player.input.keyboard?.clear?.();
                player.input.mouseDelta = { x: 0, y: 0 };
            }
            player.updatePhysics(deltaTime);
        });
    }

    broadcastPlayerStates() {
        const payload = { type: 'playerUpdateBatch', players: State.getAllPlayersState() };
        this.broadcaster.toAll(payload);
    }

    /**
     * Adds a new player to the game world and informs other clients.
     * @param {WebSocket} ws The WebSocket connection for the new player.
     * @param {string} clientId The unique ID for the new player.
     */
    addNewPlayer(ws, clientId) {
        State.addPlayer(clientId, ws);
        this.playerInputs.set(clientId, { keyboard: new Map(), mouseDelta: { x: 0, y: 0 } });
        console.log(`[Server] Client connected: ${clientId}. Total: ${State.players.size}`);

        this.broadcaster.toClient(clientId, { type: 'connected', clientId });
        this.broadcaster.toClient(clientId, { type: 'initialState', players: State.getAllPlayersState(), gameState: State.getCurrentGameState() });

        const newPlayer = State.getPlayer(clientId);
        const playerState = {
            playerId: newPlayer.playerId,
            position: newPlayer.position,
            rotation: newPlayer.rotation,
            role: newPlayer.role,
            morphedInto: newPlayer.morphedInto,
            health: newPlayer.health,
            isFrozen: newPlayer.isFrozen,
            timestamp: Date.now()
        };
        this.broadcaster.toAllButOne(ws, { type: 'playerConnected', player: playerState });

        if (State.getCurrentGameState() === GameStates.LOBBY) {
            if (State.players.size < MIN_PLAYERS) {
                const waitingMessage = `Waiting for more players... (${State.players.size}/${MIN_PLAYERS})`;
                this.broadcaster.toAll({ type: 'showPersistentMessage', message: waitingMessage });
            } else {
                GameLogic.startGame();
            }
        }
    }

    /**
     * Removes a player from the game world and informs other clients.
     * @param {WebSocket} ws The WebSocket connection of the player who disconnected.
     */
    removePlayer(ws) {
        const disconnectedId = State.removePlayer(ws);
        if (disconnectedId) {
            this.playerInputs.delete(disconnectedId);
            this.broadcaster.toAll({ type: 'playerDisconnected', playerId: disconnectedId });
            
            if (State.getCurrentGameState() !== GameStates.LOBBY && State.players.size < MIN_PLAYERS) {
                 GameLogic.endGame('Not enough players remain.');
            } else if (State.getCurrentGameState() === GameStates.LOBBY && State.players.size < MIN_PLAYERS) {
                 const waitingMessage = `Waiting for more players... (${State.players.size}/${MIN_PLAYERS})`;
                 this.broadcaster.toAll({ type: 'showPersistentMessage', message: waitingMessage });
            }
        }
    }
}