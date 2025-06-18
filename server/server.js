// /server/server.js
import { WebSocketServer } from 'ws';
import { PORT } from './config/ServerConfig.js';
import { ServerGameManager } from './core/ServerGameManager.js';

const wss = new WebSocketServer({ port: PORT });
const serverGameManager = new ServerGameManager(wss);

console.log(`WebSocket server started on port ${PORT}`);

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

serverGameManager.startGameLoop();
