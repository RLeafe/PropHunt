// PropHunt/server/core/ServerGameManager.js
import { players, playerConnections, getSeekerId, getHiderCount, setCurrentGameState, getCurrentGameState, getAllPlayersState, resetGameState, initializeServerPropsAvailability, addPlayer, removePlayer, getPlayer } from './ServerGameState.js';
import { startGame, endGame, processSeekerHit, processHiderMorph, setWssInstance as setGameLogicWssInstance } from './ServerGameLogic.js';
import { initTimers, startCountdownTimer, stopAllTimers } from './ServerTimer.js';
import { MIN_PLAYERS, MAX_PLAYERS, SERVER_TICK_RATE_MS, SEEKER_PAUSE_DURATION_SECONDS, PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY, SERVER_PLAYER_SPEED, SERVER_MOUSE_SENSITIVITY, SERVER_GRAVITY, SERVER_JUMP_FORCE } from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../utils/GameEnums.js';

export class ServerGameManager {
    constructor(wss) {
        this.wss = wss;
        this.gameLoopIntervalId = null;
        this.lastTickTime = Date.now();

        // Stores the LATEST raw input received from each client
        // Map<clientId, { keyboard: Map, mouseDelta: {x,y} }>
        this.playerInputs = new Map();

        setGameLogicWssInstance(this.wss);
        initTimers(this.wss);
    }

    /**
     * Starts the main server game loop.
     */
    startGameLoop() {
        if (this.gameLoopIntervalId) {
            console.warn('[ServerGameManager] Game loop already running.');
            return;
        }
        console.log('[ServerGameManager] Starting server game loop...');
        this.gameLoopIntervalId = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastTickTime; // Delta time in milliseconds
            this.lastTickTime = currentTime;

            this.update(deltaTime);

        }, SERVER_TICK_RATE_MS); // Run at fixed tick rate
    }

    /**
     * The main server update loop, responsible for authoritative physics and state updates.
     * @param {number} deltaTime Time since last server tick in milliseconds.
     */
    update(deltaTime) {
        // NEW: Always process player physics (movement), even in lobby.
        this.processPlayerPhysics(deltaTime); // <-- MOVED OUTSIDE THE IF BLOCK

        // Only process game logic that requires game to be actively PLAYING
        // Actions like swinging/morphing are handled in handleClientMessage based on GameStates.PLAYING
        // The primary physics loop for movement runs continuously.

        // Always broadcast player states (even if paused or in lobby, positions might update)
        this.broadcastPlayerStates();
    }

    /**
     * Processes player inputs and updates their authoritative positions and states.
     * This is where server-authoritative physics will live.
     * @param {number} deltaTime Time since last tick.
     */
    processPlayerPhysics(deltaTime) {
        players.forEach(player => { // 'player' here is the ServerPlayer object
            const latestRawInputFromClient = this.playerInputs.get(player.playerId);

            if (latestRawInputFromClient) {
                player.input.keyboard = latestRawInputFromClient.keyboard;
                player.input.mouseDelta.x += latestRawInputFromClient.mouseDelta.x;
                player.input.mouseDelta.y += latestRawInputFromClient.mouseDelta.y;
                latestRawInputFromClient.mouseDelta = {x:0, y:0};
            } else {
                player.input.keyboard.forEach((value, key) => {
                    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key) && value === true) {
                        player.input.keyboard.set(key, false);
                    }
                });
                player.input.mouseDelta = {x:0, y:0};
            }
            player.updatePhysics(deltaTime);
        });
    }

    /**
     * Broadcasts the current authoritative state of all players to all connected clients.
     */
    broadcastPlayerStates() {
        const allPlayersState = getAllPlayersState();
        this.wss.clients.forEach(client => {
            if (client.readyState === this.wss.OPEN) {
                client.send(JSON.stringify({
                    type: 'playerUpdateBatch',
                    players: allPlayersState
                }));
            }
        });
    }

    /**
     * Handles a new client connection.
     * @param {WebSocket} ws The new WebSocket connection.
     * @param {string} clientId The ID assigned to the client.
     */
    handleClientConnected(ws, clientId) {
        addPlayer(clientId, ws);
        this.playerInputs.set(clientId, { keyboard: new Map(), mouseDelta: {x:0, y:0} });
        console.log(`[ServerGameManager] Client connected: ${clientId}. Total clients: ${players.size}`);

        ws.send(JSON.stringify({
            type: 'connected',
            clientId: clientId,
            message: `Welcome, ${clientId}!`
        }));

        ws.send(JSON.stringify({
            type: 'initialState',
            players: getAllPlayersState(),
            currentGameState: getCurrentGameState(),
            minPlayers: MIN_PLAYERS,
            currentPlayers: players.size,
            seekerId: getSeekerId(),
            hiderCount: getHiderCount(),
            message: (getCurrentGameState() === GameStates.LOBBY) ? `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` : 'Game in progress.'
        }));

        this.wss.clients.forEach(client => {
            if (client !== ws && client.readyState === this.wss.OPEN) {
                const newPlayerData = getPlayer(clientId);
                client.send(JSON.stringify({
                    type: 'playerConnected',
                    playerId: clientId,
                    position: newPlayerData.position,
                    rotation: newPlayerData.rotation,
                    role: newPlayerData.role,
                    morphedInto: newPlayerData.morphedInto,
                    health: newPlayerData.health
                }));
            }
        });

        if (players.size >= MIN_PLAYERS && getCurrentGameState() === GameStates.LOBBY) {
            startGame();
        }
    }

    /**
     * Handles an incoming message from a client.
     * @param {WebSocket} ws The WebSocket connection the message came from.
     * @param {string} message The raw message string.
     */
    handleClientMessage(ws, message) {
        const data = JSON.parse(message);
        const senderId = playerConnections.get(ws);

        if (!senderId) {
            console.warn('[ServerGameManager] Message received from unmapped WebSocket connection.');
            return;
        }

        if (data.type === 'playerInput') {
            const currentInputInMap = this.playerInputs.get(senderId);
            if (currentInputInMap) {
                currentInputInMap.keyboard = new Map(Object.entries(data.keyboard));
                currentInputInMap.mouseDelta.x = data.mouseDelta.x;
                currentInputInMap.mouseDelta.y = data.mouseDelta.y;
            }
            return;
        }

        // Game actions (swing, morph) should still ONLY be processed if game is PLAYING
        if (getCurrentGameState() === GameStates.PLAYING) {
            switch (data.type) {
                case 'seekerSwing':
                    if (senderId === getSeekerId()) {
                        processSeekerHit(senderId, data.swingData);
                    } else {
                        console.warn(`[ServerGameManager] Player ${senderId} (not seeker) attempted seekerSwing.`);
                        ws.send(JSON.stringify({ type: 'gameMessage', message: 'You are not the seeker.' }));
                    }
                    break;
                case 'hiderMorph':
                    const player = getPlayer(senderId);
                    if (player && player.role === PlayerRoles.HIDER) {
                        processHiderMorph(senderId, data.targetPropId);
                    } else {
                        console.warn(`[ServerGameManager] Player ${senderId} (not hider or not found) attempted hiderMorph.`);
                        ws.send(JSON.stringify({ type: 'gameMessage', message: 'You are not a hider or cannot morph at this time.' }));
                    }
                    break;
                default:
                    console.log(`[ServerGameManager] Unhandled message type from ${senderId} during PLAYING:`, data.type);
            }
        } else {
            console.log(`[ServerGameManager] Message type ${data.type} from ${senderId} ignored (game not PLAYING or action not allowed in current state).`);
            ws.send(JSON.stringify({ type: 'gameMessage', message: `Action ${data.type} not allowed in current game state (${getCurrentGameState()}).` }));
        }
    }

    /**
     * Handles a client disconnection.
     * @param {WebSocket} ws The disconnected WebSocket connection.
     */
    handleClientDisconnected(ws) {
        const disconnectedId = removePlayer(ws);
        if (disconnectedId) {
            this.playerInputs.delete(disconnectedId);
            console.log(`[ServerGameManager] Client disconnected: ${disconnectedId}. Total clients: ${players.size}`);

            this.wss.clients.forEach(client => {
                if (client.readyState === this.wss.OPEN) {
                    client.send(JSON.stringify({
                        type: 'playerDisconnected',
                        playerId: disconnectedId
                    }));
                }
            });

            if (getCurrentGameState() === GameStates.PLAYING) {
                if (disconnectedId === getSeekerId()) {
                     endGame('Seeker disconnected.');
                } else if (getHiderCount() <= 0) {
                    endGame('All hiders caught or disconnected.');
                }
                if (players.size < MIN_PLAYERS) {
                    endGame(`Not enough players (below ${MIN_PLAYERS}).`);
                }
            } else if (getCurrentGameState() === GameStates.LOBBY) {
                this.wss.clients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                        client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` }));
                    }
                });
            }
        }
    }
}