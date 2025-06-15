// PropHunt/server/core/ServerGameManager.js
import { players, playerConnections, getSeekerId, getHiderCount, setCurrentGameState, getCurrentGameState, getAllPlayersState, resetGameState, initializeServerPropsAvailability, addPlayer, removePlayer, getPlayer } from './ServerGameState.js';
import { startGame, endGame, processSeekerHit, processHiderMorph, setWssInstance as setGameLogicWssInstance } from './ServerGameLogic.js';
import { initTimers, startCountdownTimer, stopAllTimers } from './ServerTimer.js';
import { MIN_PLAYERS, MAX_PLAYERS, SERVER_TICK_RATE_MS, SEEKER_PAUSE_DURATION_SECONDS, PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY, SERVER_PLAYER_SPEED, SERVER_MOUSE_SENSITIVITY, SERVER_GRAVITY, SERVER_JUMP_FORCE } from '../config/ServerConfig.js';
import { GameStates } from '../utils/GameEnums.js';

export class ServerGameManager {
    constructor(wss) {
        this.wss = wss; 
        this.gameLoopIntervalId = null;
        this.lastTickTime = Date.now();

        // Stores the LATEST raw input received from each client
        // Map<clientId, { keyboard: Map, mouseDelta: {x,y} }>
        this.playerInputs = new Map(); 

        setGameLogicWssInstance(this.wss); 
        initTimers(this.wss, playerConnections); // playerConnections needed for initTimers
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
        // Only process game logic if game is PLAYING
        if (getCurrentGameState() === GameStates.PLAYING) { 
            this.processPlayerPhysics(deltaTime);
        }

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
                // Keyboard: Overwrite player's authoritative keyboard state with the latest full state from client.
                player.input.keyboard = latestRawInputFromClient.keyboard; 
                
                // Mouse Delta: Accumulate client's latest delta into player's accumulated mouse delta for *this* server tick
                player.input.mouseDelta.x += latestRawInputFromClient.mouseDelta.x;
                player.input.mouseDelta.y += latestRawInputFromClient.mouseDelta.y;
                
                // CRUCIAL: Clear the `latestRawInputFromClient`'s mouseDelta after it has been transferred
                // This ensures each client's sent `mouseDelta` is only applied once per client network send
                latestRawInputFromClient.mouseDelta = {x:0, y:0}; // Clear the map entry's mouseDelta
            } else {
                // If no new input received from client this tick, treat movement keys as released (false)
                // This forces player to stop if client stops sending input
                player.input.keyboard.forEach((value, key) => {
                    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key) && value === true) { // Only clear movement keys. 'Space' for jump is consumed in ServerPlayer.
                        player.input.keyboard.set(key, false);
                    }
                });
                player.input.mouseDelta = {x:0, y:0}; // Clear mouse delta if no input received
            }

            // Perform player's physics update
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
                    type: 'playerUpdateBatch', // This message type contains the authoritative states
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
        this.playerInputs.set(clientId, { keyboard: new Map(), mouseDelta: {x:0, y:0} }); // Initialize player input state
        console.log(`[ServerGameManager] Client connected: ${clientId}. Total clients: ${players.size}`);

        // 1. Send initial connection info to the new client (its own ID)
        ws.send(JSON.stringify({
            type: 'connected',
            clientId: clientId,
            message: `Welcome, ${clientId}!`
        }));

        // 2. Send current state of ALL players (including self) to the new client
        ws.send(JSON.stringify({
            type: 'initialState', // This message includes all player states from ServerGameState
            players: getAllPlayersState(),
        }));

        // 3. Inform ALL other existing clients about the new client's connection
        this.wss.clients.forEach(client => {
            if (client !== ws && client.readyState === this.wss.OPEN) {
                const newPlayerData = getPlayer(clientId); 
                client.send(JSON.stringify({
                    type: 'playerConnected', // Message for other clients about a new player
                    playerId: clientId,
                    position: newPlayerData.position,
                    rotation: newPlayerData.rotation,
                    role: newPlayerData.role,
                    morphedInto: newPlayerData.morphedInto,
                    health: newPlayerData.health
                }));
            }
        });

        // Game Logic on New Connection: Determine pause state for all clients
        if (players.size < MIN_PLAYERS) {
            // Only send 'waiting' message if game is still in LOBBY
            if (getCurrentGameState() === GameStates.LOBBY) { 
                this.wss.clients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                        client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` }));
                    }
                });
            } else { // Game is already ongoing (PLAYING or ENDED), new player joins
                ws.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'Game in progress.' })); // Join as unpaused spectator or later assign role
            }
        } else if (players.size >= MIN_PLAYERS && getCurrentGameState() === GameStates.LOBBY) { 
            startGame(this.wss); // Start game if enough players and in lobby state
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

        // Store player input for the next server tick
        if (data.type === 'playerInput') {
            const currentInputInMap = this.playerInputs.get(senderId); 
            if (currentInputInMap) { 
                currentInputInMap.keyboard = new Map(Object.entries(data.keyboard)); // Overwrite keyboard state
                currentInputInMap.mouseDelta.x = data.mouseDelta.x; // Overwrite mouse delta
                currentInputInMap.mouseDelta.y = data.mouseDelta.y;
            }
            return; 
        }

        // Handle other message types (actions)
        if (getCurrentGameState() === GameStates.PLAYING) { 
            switch (data.type) {
                case 'seekerSwing':
                    processSeekerHit(senderId, data.swingData, this.wss); 
                    break;
                case 'hiderMorph':
                    processHiderMorph(senderId, data.targetPropId, this.wss); 
                    break;
                default:
                    console.log(`[ServerGameManager] Unhandled message type from ${senderId} during PLAYING:`, data.type);
            }
        } else {
            console.log(`[ServerGameManager] Message type ${data.type} from ${senderId} ignored (game not PLAYING).`);
        }
    }

    /**
     * Handles a client disconnection.
     * @param {WebSocket} ws The disconnected WebSocket connection.
     */
    handleClientDisconnected(ws) {
        const disconnectedId = removePlayer(ws); 
        if (disconnectedId) {
            this.playerInputs.delete(disconnectedId); // Remove input state of disconnected player
            console.log(`[ServerGameManager] Client disconnected: ${disconnectedId}. Total clients: ${players.size}`); // Debug log

            // Broadcast player disconnection to all remaining clients
            this.wss.clients.forEach(client => {
                if (client.readyState === this.wss.OPEN) {
                    client.send(JSON.stringify({
                        type: 'playerDisconnected',
                        playerId: disconnectedId
                    }));
                }
            });

            // Re-evaluate game end/pause conditions for remaining clients
            if (players.size < MIN_PLAYERS) {
                if (getCurrentGameState() === GameStates.PLAYING) { 
                    endGame(`Not enough players (below ${MIN_PLAYERS}).`, this.wss); 
                } else if (getCurrentGameState() === GameStates.LOBBY) { 
                    // Update lobby message for remaining clients
                    this.wss.clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` }));
                        }
                    });
                }
            }
            if (disconnectedId === getSeekerId() && getCurrentGameState() === GameStates.PLAYING) { 
                 endGame('Seeker disconnected.', this.wss); 
            }
        }
    }
}