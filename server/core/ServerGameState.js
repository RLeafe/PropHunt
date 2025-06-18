// /server/core/ServerGameState.js
import { PLAYER_HEIGHT_OFFSET } from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../../client/shared/utils/GameEnums.js';
import { PropTypes } from '../../client/shared/props/SharedPropsConfig.js';
import { ServerPlayer } from './ServerPlayer.js';

// --- Authoritative State ---
export const players = new Map();
export const playerConnections = new Map();
export const serverPropsAvailability = new Map();

// Encapsulate state variables into an object to prevent ReferenceError from circular imports.
const state = {
    currentGameState: GameStates.LOBBY,
    seekerId: null,
    hiderCount: 0,
};

// --- State Management Functions ---

export function addPlayer(clientId, ws) {
    const newPlayer = new ServerPlayer(clientId);
    players.set(clientId, newPlayer);
    playerConnections.set(ws, clientId);
}

export function removePlayer(ws) {
    const clientId = playerConnections.get(ws);
    if (clientId) {
        const player = players.get(clientId);
        if (player?.morphedInto) markPropAvailable(player.morphedInto);
        if (clientId === state.seekerId) state.seekerId = null;
        if (player?.role === PlayerRoles.HIDER) state.hiderCount--;
        
        players.delete(clientId);
        playerConnections.delete(ws);
        return clientId;
    }
    return null;
}

export function assignRolesAndReturnSeekerId() {
    const playerIds = Array.from(players.keys());
    const seekerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    state.hiderCount = 0;
    
    playerIds.forEach(id => {
        const player = getPlayer(id);
        if(!player) return;
        player.role = (id === seekerId) ? PlayerRoles.SEEKER : PlayerRoles.HIDER;
        if (player.role === PlayerRoles.HIDER) state.hiderCount++;
    });

    setSeekerId(seekerId);
    return seekerId;
}


export function getPlayer(clientId) { return players.get(clientId); }

export function getAllPlayersState() {
    return Array.from(players.values()).map(p => ({
        playerId: p.playerId,
        position: p.position,
        rotation: p.rotation,
        role: p.role,
        morphedInto: p.morphedInto,
        health: p.health,
        isFrozen: p.isFrozen,
    }));
}

export function getCurrentGameState() { return state.currentGameState; }
export function setCurrentGameState(newState) { state.currentGameState = newState; }
export function getHiderCount() { return state.hiderCount; }
export function decrementHiderCount() { state.hiderCount = Math.max(0, state.hiderCount - 1); }
export function getSeekerId() { return state.seekerId; }
export function setSeekerId(id) { state.seekerId = id; }

export function setPlayerHealth(playerId, health) {
    const player = getPlayer(playerId);
    if (player) player.health = health;
}

export function resetGameState() {
    setCurrentGameState(GameStates.LOBBY);
    setSeekerId(null);
    state.hiderCount = 0;
    players.forEach(p => {
        p.role = null;
        p.morphedInto = null;
        p.health = 100;
        p.position = { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 };
        p.rotation = { x: 0, y: 0 };
        p.velocity = { x: 0, y: 0, z: 0 };
        p.isOnGround = true;
        p.isFrozen = false;
    });
    initializeServerPropsAvailability();
}

export function initializeServerPropsAvailability() {
    serverPropsAvailability.clear();
    Object.values(PropTypes).forEach(prop => serverPropsAvailability.set(prop.id, true));
}

export function isPropAvailable(propId) { return serverPropsAvailability.get(propId) === true; }
export function markPropTaken(propId) { serverPropsAvailability.set(propId, false); }
export function markPropAvailable(propId) { serverPropsAvailability.set(propId, true); }