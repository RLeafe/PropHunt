// PropHunt/server/server.js
import { WebSocketServer } from 'ws';
import { PORT } from './config/ServerConfig.js';
import { initTimers } from './core/ServerTimer.js';
// playerConnections is imported in ServerTimer.js directly now, no need to pass it here
import { ServerGameManager } from './core/ServerGameManager.js';

const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on port ${PORT}`);

// Initialize Timer module (needs wss for broadcasting)
initTimers(wss); // Removed playerConnections parameter as it's imported in ServerTimer.js directly

// Instantiate and start the ServerGameManager
const serverGameManager = new ServerGameManager(wss);

let clientCounter = 0;

wss.on('connection', ws => {
    const clientId = `player_${++clientCounter}`;
    serverGameManager.handleClientConnected(ws, clientId);

    ws.on('message', message => {
        serverGameManager.handleClientMessage(ws, message);
    });

    ws.on('close', () => {
        serverGameManager.handleClientDisconnected(ws);
    });

    ws.on('error', error => {
        console.error('[Server] WebSocket error:', error);
    });
});

// Start the main server game loop (physics updates, state broadcasting)
// This is now the authoritative game loop.
serverGameManager.startGameLoop();