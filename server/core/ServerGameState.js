// /server/core/ServerGameState.js
import { PLAYER_HEIGHT_OFFSET } from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../../client/shared/utils/GameEnums.js';
import { PropTypes } from '../../client/shared/props/SharedPropsConfig.js';
import { ServerPlayer } from './ServerPlayer.js';
import { spawnPoints } from '../config/SpawnPoints.js';

// --- Authoritative State ---
export const players = new Map();
export const playerConnections = new Map();
export const serverPropsAvailability = new Map();

const state = {
    currentGameState: GameStates.LOBBY,
    seekerId: null,
    hiderCount: 0,
    lastSeekerId: null, 
    // A set to track which spawn points are currently in use.
    occupiedSpawnIndices: new Set(),
};

// --- Spawn Point Management ---
/**
 * Finds a random, unoccupied spawn point.
 * @returns An object containing the position of the spawn point and its index.
 */
function getAvailableSpawnPoint() {
    const availableIndices = spawnPoints
        .map((_, index) => index)
        .filter(index => !state.occupiedSpawnIndices.has(index));

    if (availableIndices.length === 0) {
        console.warn("No available spawn points; reusing points. Consider adding more spawn points.");
        // just use a random point if all are taken.
        const randomIndex = Math.floor(Math.random() * spawnPoints.length);
        return { position: spawnPoints[randomIndex], index: randomIndex };
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    state.occupiedSpawnIndices.add(randomIndex);
    return { position: spawnPoints[randomIndex], index: randomIndex };
}

// --- Player and State Management ---
export function addPlayer(clientId, ws) {
    // Assign a unique spawn point when a player is created.
    const { position, index } = getAvailableSpawnPoint();
    const initialPosition = { x: position.x, y: PLAYER_HEIGHT_OFFSET, z: position.z };

    const newPlayer = new ServerPlayer(clientId, initialPosition);
    newPlayer.spawnIndex = index; // Track the player's spawn index.

    players.set(clientId, newPlayer);
    playerConnections.set(ws, clientId);
}

export function removePlayer(ws) {
    const clientId = playerConnections.get(ws);
    if (clientId) {
        const player = players.get(clientId);
        // Free up the player's spawn point when they disconnect.
        if (player && player.spawnIndex !== -1) {
            state.occupiedSpawnIndices.delete(player.spawnIndex);
        }
        
        if (player?.morphedInto) markPropAvailable(player.morphedInto);
        if (clientId === state.seekerId) state.seekerId = null;
        if (clientId === state.lastSeekerId) state.lastSeekerId = null;
        if (player?.role === PlayerRoles.HIDER) state.hiderCount--;
        
        players.delete(clientId);
        playerConnections.delete(ws);
        return clientId;
    }
    return null;
}

export function assignRolesAndReturnSeekerId() {
    const playerIds = Array.from(players.keys());
    if (playerIds.length === 0) return null;

    const weightedList = [];
    playerIds.forEach(id => {
        if (playerIds.length > 1 && id === state.lastSeekerId) {
            weightedList.push(id);
        } else {
            weightedList.push(id, id, id, id);
        }
    });

    const seekerId = weightedList[Math.floor(Math.random() * weightedList.length)];
    
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
        timestamp: Date.now()
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
    state.lastSeekerId = state.seekerId;
    setCurrentGameState(GameStates.LOBBY);
    setSeekerId(null);
    state.hiderCount = 0;
    
    state.occupiedSpawnIndices.clear();
    players.forEach(p => {
        const { position, index } = getAvailableSpawnPoint();
        p.spawnIndex = index;
        p.position = { x: position.x, y: PLAYER_HEIGHT_OFFSET, z: position.z };
        
        p.role = null;
        p.morphedInto = null;
        p.health = 100;
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

initializeServerPropsAvailability();