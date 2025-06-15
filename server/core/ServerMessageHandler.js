// PropHunt/server/core/ServerMessageHandler.js

import { getPlayer, players, playerConnections, addPlayer, removePlayer, getAllPlayersState, getCurrentGameState, getSeekerId } from './ServerGameState.js'; 
import { startGame, endGame, processSeekerHit, processHiderMorph } from './ServerGameLogic.js'; 
import { MIN_PLAYERS, MAX_PLAYERS } from '../config/ServerConfig.js'; 
import { GameStates } from '../utils/GameEnums.js'; 

let wssInstance = null; 
export function setWssInstance(wss) {
    wssInstance = wss;
}

export function handleClientConnection(ws, clientId) {
    addPlayer(clientId, ws); 
    console.log(`[ServerMessageHandler] Client connected: ${clientId}. Total clients: ${players.size}`);

    // 1. Send initial connection info to the new client (its own ID)
    ws.send(JSON.stringify({
        type: 'connected',
        clientId: clientId,
        message: `Welcome, ${clientId}!`
    }));

    // 2. Send current state of ALL players (including self) to the new client
    ws.send(JSON.stringify({
        type: 'initialState',
        players: getAllPlayersState(), 
    }));

    // 3. Inform ALL other existing clients about the new client's connection
    wssInstance.clients.forEach(client => {
        if (client !== ws && client.readyState === ws.OPEN) {
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

    if (players.size < MIN_PLAYERS) { 
        wssInstance.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` }));
            }
        });
    } else if (players.size >= MIN_PLAYERS && getCurrentGameState() === GameStates.LOBBY) { 
        startGame(wssInstance); 
    } else { 
        ws.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'Game in progress.' })); 
    }
}

export function handleClientMessage(ws, message) {
    const data = JSON.parse(message);
    const senderId = playerConnections.get(ws); 

    // Revert to processing playerUpdate messages for client-authoritative movement
    if (data.type === 'playerUpdate') { // Expecting playerUpdate now
        const player = getPlayer(senderId); // Get player object from state
        if (player) {
            player.position = data.position; // Update server's authoritative position
            player.rotation = data.rotation; // Update server's authoritative rotation
            player.role = data.role; // Update server's authoritative role
            player.morphedInto = data.morphedInto; // Update server's authoritative morph state
            player.health = data.health; // Update server's authoritative health
        }

        // Broadcast this update to other clients
        wssInstance.clients.forEach(client => {
            if (client !== ws && client.readyState === wssInstance.OPEN) {
                client.send(JSON.stringify({
                    type: 'playerUpdate', // Broadcast individual playerUpdate
                    playerId: senderId,
                    position: player.position,
                    rotation: player.rotation,
                    role: player.role,
                    morphedInto: player.morphedInto,
                    health: player.health
                }));
            }
        });
        return; // Consume playerUpdate message
    }

    if (getCurrentGameState() === GameStates.PLAYING) { 
        switch (data.type) {
            case 'seekerSwing':
                processSeekerHit(senderId, data.swingData, wssInstance); 
                break;
            case 'hiderMorph':
                processHiderMorph(senderId, data.targetPropId, wssInstance); 
                break;
            default:
                console.log(`[ServerMessageHandler] Unhandled message type from ${senderId} during PLAYING:`, data.type);
        }
    } else {
        console.log(`[ServerMessageHandler] Message type ${data.type} from ${senderId} ignored (game not PLAYING).`);
    }
}

export function handleClientDisconnected(ws) {
    const disconnectedId = removePlayer(ws); 
    if (disconnectedId) {
        console.log(`[ServerMessageHandler] Client disconnected: ${disconnectedId}. Total clients: ${players.size}`);

        wssInstance.clients.forEach(client => {
            if (client.readyState === wssInstance.OPEN) {
                client.send(JSON.stringify({
                    type: 'playerDisconnected',
                    playerId: disconnectedId
                }));
            }
        });

        if (getCurrentGameState() === GameStates.PLAYING) { 
            if (players.size < MIN_PLAYERS) {
                endGame(`Not enough players (below ${MIN_PLAYERS}).`, wssInstance); 
            } else if (disconnectedId === getSeekerId()) { 
                endGame('Seeker disconnected.', wssInstance); 
            }
        } else if (getCurrentGameState() === GameStates.LOBBY) { 
            wssInstance.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...` }));
                }
            });
        }
    }
}