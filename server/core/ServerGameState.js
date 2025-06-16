// PropHunt/server/core/ServerGameState.js

import { PLAYER_HEIGHT_OFFSET } from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../utils/GameEnums.js'; // Import PlayerRoles
import { PropTypes, getPropTypeDefinition } from '../config/SharedPropsConfig.js';
import { ServerPlayer } from './ServerPlayer.js'; // Import ServerPlayer class

// Authoritative source for all player data
export const players = new Map(); // Map<clientId, ServerPlayer instance>
export const playerConnections = new Map(); // Map<WebSocket, clientId> for reverse lookup

// Authoritative source for props: Map<propTypeId, boolean (available/taken)>
export const serverPropsAvailability = new Map();

// Game Rule Variables
export let currentGameState = GameStates.LOBBY;
export let seekerId = null;
export let hiderCount = 0;
export let lastAssignedRoleWasSeeker = false; // To alternate seeker role

// --- Helper functions to manage state ---
/**
 * Adds a new player to the game state, creating a ServerPlayer instance.
 * @param {string} clientId The ID of the connecting client.
 * @param {WebSocket} ws The WebSocket connection of the client.
 */
export function addPlayer(clientId, ws) {
    // Initial position for ServerPlayer should match client's spawn logic
    // When adding a player, they initially have no role and are at a default spawn.
    const newPlayer = new ServerPlayer(clientId, { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 });
    players.set(clientId, newPlayer);
    playerConnections.set(ws, clientId);
    console.log(`[ServerGameState] Player ${clientId} added.`);
}

/**
 * Removes a player from the game state.
 * @param {WebSocket} ws The WebSocket connection of the disconnecting client.
 * @returns {string | null} The ID of the removed player, or null if not found.
 */
export function removePlayer(ws) {
    const clientId = playerConnections.get(ws);
    if (clientId) {
        const player = players.get(clientId);
        if (player) {
            // If the disconnected player was a hider and morphed, make their prop available again
            if (player.role === PlayerRoles.HIDER && player.morphedInto) {
                markPropAvailable(player.morphedInto);
            }
            // If the disconnected player was the seeker, clear the seekerId
            if (clientId === seekerId) {
                seekerId = null;
            }
            // If the disconnected player was a hider, decrement hider count
            if (player.role === PlayerRoles.HIDER) {
                hiderCount--;
            }
        }
        players.delete(clientId);
        playerConnections.delete(ws);
        console.log(`[ServerGameState] Player ${clientId} removed.`);
        return clientId;
    }
    return null;
}

/**
 * Gets a player's ServerPlayer instance by their ID.
 * @param {string} clientId
 * @returns {ServerPlayer | undefined}
 */
export function getPlayer(clientId) {
    return players.get(clientId);
}

/**
 * Gets an array representing the current state of all players for broadcasting.
 * @returns {Array<Object>}
 */
export function getAllPlayersState() {
    return Array.from(players.entries()).map(([id, data]) => ({
        playerId: id,
        position: data.position,
        rotation: data.rotation,
        role: data.role,
        morphedInto: data.morphedInto,
        health: data.health
    }));
}

export function getCurrentGameState() {
    return currentGameState;
}

export function setCurrentGameState(newState) {
    currentGameState = newState;
    console.log(`[ServerGameState] Game state changed to: ${currentGameState}`);
}

export function getHiderCount() {
    return hiderCount;
}

export function setHiderCount(count) {
    hiderCount = count;
}

export function incrementHiderCount() {
    hiderCount++;
}

export function decrementHiderCount() {
    hiderCount--;
    // Ensure hiderCount doesn't go below zero
    if (hiderCount < 0) {
        hiderCount = 0;
    }
}

export function getSeekerId() {
    return seekerId;
}

export function setSeekerId(id) {
    seekerId = id;
}

export function getPlayerHealth(playerId) {
    const player = players.get(playerId);
    return player ? player.health : undefined;
}

export function setPlayerHealth(playerId, health) {
    const player = players.get(playerId);
    if (player) {
        player.health = health;
        console.log(`[ServerGameState] Player ${playerId} health set to: ${health}`);
    }
}

export function setLastAssignedRoleWasSeeker(value) {
    lastAssignedRoleWasSeeker = value;
}

export function resetGameState() {
    setCurrentGameState(GameStates.LOBBY);
    setSeekerId(null);
    setHiderCount(0);
    players.forEach(player => {
        player.role = null;
        player.morphedInto = null;
        player.health = 100;
        player.position = { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 };
        player.rotation = { x: 0, y: 0 };
        player.velocityY = 0;
        player.isOnGround = false;
        player.input = { // Ensure input is reset for new games
            keyboard: new Map(),
            mouseDelta: { x: 0, y: 0 },
        };
    });
    initializeServerPropsAvailability();
    console.log('[ServerGameState] Game state reset.');
}

export function initializeServerPropsAvailability() {
    serverPropsAvailability.clear();
    for (const key in PropTypes) {
        serverPropsAvailability.set(PropTypes[key].id, true);
    }
    console.log('[ServerGameState] Server props availability initialized/reset.');
}

export function isPropAvailable(propTypeId) {
    return serverPropsAvailability.get(propTypeId) === true;
}

export function markPropTaken(propTypeId) {
    if (serverPropsAvailability.has(propTypeId)) {
        serverPropsAvailability.set(propTypeId, false);
        console.log(`[GameState] Prop type ${propTypeId} marked as TAKEN.`);
        return true;
    }
    return false;
}

export function markPropAvailable(propTypeId) {
    if (serverPropsAvailability.has(propTypeId)) {
        serverPropsAvailability.set(propTypeId, true);
        console.log(`[GameState] Prop type ${propTypeId} marked as AVAILABLE.`);
        return true;
    }
    return false;
}