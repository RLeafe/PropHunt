// /server/server.js
import { WebSocketServer } from 'ws';
import { PORT } from './config/ServerConfig.js';
import { ServerGameManager } from './core/ServerGameManager.js';
import { ServerNetworkEventHandler } from './core/ServerNetworkEventHandler.js';

// --- Initialisation ---
const wss = new WebSocketServer({ port: PORT });
const serverGameManager = new ServerGameManager(wss);
const serverNetworkEventHandler = new ServerNetworkEventHandler(serverGameManager);

console.log(`WebSocket server started on port ${PORT}`);

// --- WebSocket Connection Handling ---
let clientCounter = 0;

wss.on('connection', ws => {
    const clientId = `player_${++clientCounter}`;
    
    // The Game Manager handles adding the new player to the game world.
    serverGameManager.addNewPlayer(ws, clientId);

    // The Network Event Handler handles all incoming messages from this player.
    ws.on('message', message => {
        serverNetworkEventHandler.handle(ws, message);
    });

    // The Game Manager handles removing the player from the game world.
    ws.on('close', () => {
        serverGameManager.removePlayer(ws);
    });

    ws.on('error', error => {
        console.error('[Server] WebSocket error:', error);
    });
});

// --- Start the Game ---
serverGameManager.startGameLoop();
