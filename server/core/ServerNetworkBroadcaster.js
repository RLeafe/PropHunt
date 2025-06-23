// /server/core/ServerNetworkBroadcaster.js
import { PlayerRoles } from '../../client/shared/utils/GameEnums.js';

/**
 * A centralised utility for sending WebSocket messages from the server to clients.
 */
export class ServerNetworkBroadcaster {
    constructor(wss, playerConnections) {
        if (!wss || !playerConnections) {
            throw new Error('ServerNetworkBroadcaster requires wss and playerConnections.');
        }
        this.wss = wss;
        this.playerConnections = playerConnections;
    }

    /**
     * Finds the WebSocket connection for a given client ID.
     * @param {string} clientId - The ID of the player.
     * @returns {WebSocket|null} The WebSocket connection or null if not found.
     */
    findSocketById(clientId) {
        for (const [ws, id] of this.playerConnections.entries()) {
            if (id === clientId) {
                return ws;
            }
        }
        return null;
    }

    /**
     * Sends a message to a single, specific client.
     * @param {string} clientId - The ID of the target player.
     * @param {object} payload - The JSON data to send.
     */
    toClient(clientId, payload) {
        const ws = this.findSocketById(clientId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(payload));
        }
    }

    /**
     * Sends a message to all connected clients.
     * @param {object} payload - The JSON data to send.
     */
    toAll(payload) {
        const message = JSON.stringify(payload);
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Sends a message to all connected clients except for one.
     * @param {WebSocket} exceptWs - The WebSocket connection to exclude.
     * @param {object} payload - The JSON data to send.
     */
    toAllButOne(exceptWs, payload) {
        const message = JSON.stringify(payload);
        this.wss.clients.forEach(client => {
            if (client !== exceptWs && client.readyState === 1) {
                client.send(message);
            }
        });
    }

    /**
     * Sends a message to all players currently assigned the HIDER role.
     * @param {Map<string, ServerPlayer>} playersMap - The map of all current players.
     * @param {object} payload - The JSON data to send.
     */
    toHiders(playersMap, payload) {
        const message = JSON.stringify(payload);
        playersMap.forEach(player => {
            if (player.role === PlayerRoles.HIDER) {
                const ws = this.findSocketById(player.playerId);
                if (ws && ws.readyState === 1) {
                    ws.send(message);
                }
            }
        });
    }

    /**
     * Sends a message to all players currently assigned the SEEKER role.
     * @param {Map<string, ServerPlayer>} playersMap - The map of all current players.
     * @param {object} payload - The JSON data to send.
     */
    toSeekers(playersMap, payload) {
        const message = JSON.stringify(payload);
        playersMap.forEach(player => {
            if (player.role === PlayerRoles.SEEKER) {
                const ws = this.findSocketById(player.playerId);
                if (ws && ws.readyState === 1) {
                    ws.send(message);
                }
            }
        });
    }
}