// PropHunt/server/core/ServerGameLogic.js

import { players, playerConnections, getCurrentGameState, setCurrentGameState, getSeekerId, setSeekerId, incrementHiderCount, decrementHiderCount, resetGameState, getAllPlayersState, setLastAssignedRoleWasSeeker, lastAssignedRoleWasSeeker, getHiderCount, setHiderCount, initializeServerPropsAvailability, isPropAvailable, markPropTaken, markPropAvailable, getPlayerHealth, setPlayerHealth, getPlayer } from './ServerGameState.js';
import { MIN_PLAYERS, MAX_PLAYERS, SEEKER_PAUSE_DURATION_SECONDS, GAME_END_RESET_SECONDS, HIT_DAMAGE, FLASH_DURATION_MS, PLAYER_HEIGHT_OFFSET, MORPH_RANGE, SEEKER_SWING_HIT_RADIUS, SEEKER_SWING_DISTANCE } from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../utils/GameEnums.js'; // Import PlayerRoles
import { getPropTypeDefinition } from '../config/SharedPropsConfig.js';
import { startCountdownTimer, stopAllTimers } from './ServerTimer.js';

let wssInstance = null;
export function setWssInstance(wss) {
    wssInstance = wss;
}

export function startGame() {
    if (!wssInstance) {
        console.error('[ServerGameLogic] WSS instance not set for game logic.');
        return;
    }

    if (getCurrentGameState() !== GameStates.LOBBY) {
        console.log(`[ServerGameLogic] Game cannot start from state: ${getCurrentGameState()}.`);
        return;
    }
    if (players.size < MIN_PLAYERS) {
        console.log('[ServerGameLogic] Not enough players to start game.');
        return;
    }

    setCurrentGameState(GameStates.STARTING); // Transition to STARTING state for countdown
    initializeServerPropsAvailability();
    let currentHiderCountInLoop = 0;

    const clientIds = Array.from(playerConnections.values());
    // Shuffle client IDs to randomize role assignment
    for (let i = clientIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clientIds[i], clientIds[j]] = [clientIds[j], clientIds[i]];
    }

    // Determine the role for the first player in the shuffled list
    // This ensures roles alternate if possible, or is random for the first game.
    let roleForFirstInList;
    if (lastAssignedRoleWasSeeker) {
        roleForFirstInList = PlayerRoles.HIDER; // If last game had seeker as first assigned, this time make it hider
    } else {
        roleForFirstInList = PlayerRoles.SEEKER; // Otherwise, make it seeker
    }
    setLastAssignedRoleWasSeeker(roleForFirstInList === PlayerRoles.SEEKER);

    // Assign roles and initial properties
    clientIds.forEach((id, index) => {
        const player = getPlayer(id);
        if (!player) {
            console.warn(`[ServerGameLogic] Player ${id} not found during role assignment.`);
            return;
        }

        let role;
        if (index === 0) {
            role = roleForFirstInList;
        } else if (index === 1 && clientIds.length > 1) { // If there's at least a second player
            role = roleForFirstInList === PlayerRoles.SEEKER ? PlayerRoles.HIDER : PlayerRoles.SEEKER;
        } else {
            // For games with more than 2 players, the rest are hiders
            role = PlayerRoles.HIDER;
        }

        // player.role = role;
        // player.morphedInto = null;
        // setPlayerHealth(id, 100);
        // player.position = { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 }; // Reset position for new game
        // player.rotation = { x: 0, y: 0 }; // Reset rotation for new game

        if (role === PlayerRoles.HIDER) {
            currentHiderCountInLoop++;
        } else {
            setSeekerId(id);
        }

        const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === id);
        if (ws && ws.readyState === ws.OPEN) {
            // Send assignRole message to each player with their specific role
            ws.send(JSON.stringify({ type: 'assignRole', playerId: id, role: role }));
        }
        console.log(`[ServerGameLogic] Assigned ${id} as ${role}`);
    });
    setHiderCount(currentHiderCountInLoop);

    const seekerId = getSeekerId();

    // Broadcast initial game pause state to all clients
    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            const clientId = playerConnections.get(client);
            if (clientId === seekerId) {
                client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `You are the Seeker! The hunt begins in ${SEEKER_PAUSE_DURATION_SECONDS} seconds...` }));
            } else {
                client.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'Game has started! Find a spot to hide!' }));
            }
        }
    });

    // Start the seeker pause countdown timer
    startCountdownTimer(
        'seekerPauseTimer',
        SEEKER_PAUSE_DURATION_SECONDS,
        () => {
            // Callback when seeker pause ends
            setCurrentGameState(GameStates.PLAYING); // Transition to PLAYING state
            const seekerWs = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === getSeekerId());
            if (seekerWs && seekerWs.readyState === seekerWs.OPEN) {
                seekerWs.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'GO! The hunt is ON!' }));
            }
            console.log('[ServerGameLogic] Seeker pause ended. Game is now PLAYING.');

            // Also send a general gameStarted message to all clients
            wssInstance.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'gameStarted', message: 'The hunt is ON!' }));
                }
            });
        },
        [getSeekerId()], // Only show detailed countdown to seeker
        'The hunt begins in '
    );

    console.log('[ServerGameLogic] Game started and roles assigned!');
}

export function endGame(reason) {
    if (getCurrentGameState() === GameStates.ENDED) return;
    setCurrentGameState(GameStates.ENDED);
    setSeekerId(null);
    setHiderCount(0);

    stopAllTimers();

    console.log(`[ServerGameLogic] Game ended: ${reason}`);
    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'gameEnded', reason: reason }));
            const clientId = playerConnections.get(client);
            if (players.has(clientId)) {
                const player = players.get(clientId);
                if (player.morphedInto) {
                    markPropAvailable(player.morphedInto);
                }
                player.role = null;
                player.morphedInto = null;
                setPlayerHealth(clientId, 100);
                player.position = { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 }; // Reset position
                player.rotation = { x: 0, y: 0 }; // Reset rotation
            }
            client.send(JSON.stringify({ type: 'assignRole', playerId: clientId, role: null })); // Clear client role
            client.send(JSON.stringify({ type: 'resetMorph', playerId: clientId }));
        }
    });

    startCountdownTimer(
        'gameResetTimer',
        GAME_END_RESET_SECONDS,
        () => {
            console.log('[ServerGameLogic] Game reset timer finished. Resetting for new game.');
            resetGameState();
            // After reset, broadcast new lobby state
            wssInstance.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({
                        type: 'gamePauseState',
                        paused: true,
                        message: `Waiting for ${MIN_PLAYERS - players.size} more player(s) to connect...`
                    }));
                }
            });
        },
        null, // Broadcast to all
        'Game Over - Resetting in: ',
        true
    );

    console.log('[ServerGameLogic] Game state reset process initiated.');
}

export function processSeekerHit(seekerId, swingData) {
    if (!wssInstance) {
        console.error('[ServerGameLogic] WSS instance not set for game logic.');
        return;
    }
    if (getCurrentGameState() !== GameStates.PLAYING) {
        console.log(`[ServerGameLogic] Hit ignored: Game is not in PLAYING state (${getCurrentGameState()}).`);
        return;
    }
    console.log(`[ServerGameLogic] Processing hit from ${seekerId}. SwingData:`, swingData);

    const hiderIds = Array.from(players.keys()).filter(id => players.get(id).role === PlayerRoles.HIDER);

    const seekerPlayer = players.get(seekerId);
    if (!seekerPlayer || seekerPlayer.role !== PlayerRoles.SEEKER) { // Ensure only seeker can hit
        console.warn(`[ServerGameLogic] Seeker ${seekerId} not found or not a seeker for hit processing.`);
        return;
    }

    const HIT_RADIUS = SEEKER_SWING_HIT_RADIUS;
    const SWING_DISTANCE = SEEKER_SWING_DISTANCE;
    const DAMAGE = HIT_DAMAGE; // Renamed to avoid conflict with imported constant
    const FLASH_DURATION = FLASH_DURATION_MS; // Renamed to avoid conflict with imported constant

    const seekerPos = seekerPlayer.position;
    const seekerRotY = seekerPlayer.rotation.y;
    const seekerRotX = seekerPlayer.rotation.x;
    const swingHitPoint = {
        x: seekerPos.x - Math.sin(seekerRotY) * Math.cos(seekerRotX) * SWING_DISTANCE,
        y: seekerPos.y + Math.sin(seekerRotX) * SWING_DISTANCE,
        z: seekerPos.z - Math.cos(seekerRotY) * Math.cos(seekerRotX) * SWING_DISTANCE
    };

    let caughtHiderId = null;
    let caughtHider = null;

    for (const hiderId of hiderIds) {
        const hider = players.get(hiderId);
        if (!hider || hider.role !== PlayerRoles.HIDER) continue;

        let hiderColliderSize = { width: 1, height: 1.8, depth: 1 };
        let hiderCenterOffsetY = 0.9;

        if (hider.morphedInto) {
            const propDef = getPropTypeDefinition(hider.morphedInto);
            if (propDef && propDef.geometry) {
                if (propDef.geometry.type === 'BoxGeometry') {
                    hiderColliderSize = { width: propDef.geometry.width, height: propDef.geometry.height, depth: propDef.geometry.depth };
                    hiderCenterOffsetY = propDef.geometry.height / 2;
                } else if (propDef.geometry.type === 'CylinderGeometry') {
                    hiderColliderSize = { width: propDef.geometry.radiusTop * 2, height: propDef.geometry.height, depth: propDef.geometry.radiusTop * 2 };
                    hiderCenterOffsetY = propDef.geometry.height / 2;
                } else if (propDef.geometry.type === 'SphereGeometry') {
                    hiderColliderSize = { width: propDef.geometry.radius * 2, height: propDef.geometry.radius * 2, depth: propDef.geometry.radius * 2 };
                    hiderCenterOffsetY = propDef.geometry.radius;
                }
            }
        }

        const hiderEffectiveY = hider.position.y + hiderCenterOffsetY;

        const dx = swingHitPoint.x - hider.position.x;
        const dy = swingHitPoint.y - hiderEffectiveY;
        const dz = swingHitPoint.z - hider.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const hiderApproxRadius = Math.max(hiderColliderSize.width, hiderColliderSize.height, hiderColliderSize.depth) / 2;
        if (distance < (HIT_RADIUS + hiderApproxRadius)) {
            caughtHiderId = hiderId;
            caughtHider = hider;
            break;
        }
    }


    if (caughtHiderId) {
        const currentHealth = getPlayerHealth(caughtHiderId);
        const newHealth = Math.max(0, currentHealth - DAMAGE); // Use DAMAGE constant
        setPlayerHealth(caughtHiderId, newHealth);

        if (newHealth <= 0) {
            caughtHider.role = PlayerRoles.SEEKER; // Hider becomes seeker
            // Reset health to 100 for newly converted seeker
            setPlayerHealth(caughtHiderId, 100);

            if (caughtHider.morphedInto) {
                markPropAvailable(caughtHider.morphedInto);
                caughtHider.morphedInto = null;
            }
            decrementHiderCount();

            wssInstance.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    const clientWsId = playerConnections.get(client);
                    client.send(JSON.stringify({
                        type: 'playerCaught',
                        seekerId: seekerId,
                        caughtHiderId: caughtHiderId,
                        newRole: PlayerRoles.SEEKER, // Send the new role
                        caughtPropId: caughtHider.morphedInto, // This will be null after conversion
                        position: caughtHider.position,
                        rotation: caughtHider.rotation,
                        health: newHealth // Should be 0 here, or 100 if newly converted? Let's say 0 for client message for clarity
                    }));
                }
            });
            console.log(`[ServerGameLogic] Hider ${caughtHiderId} caught by ${seekerId}!`);

            if (getHiderCount() <= 0) {
                endGame('All hiders caught!'); // No need to pass wssInstance
            }
        } else {
            wssInstance.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    const clientWsId = playerConnections.get(client);
                    client.send(JSON.stringify({
                        type: 'playerHit',
                        playerId: caughtHiderId,
                        attackerId: seekerId,
                        newHealth: newHealth,
                        position: caughtHider.position,
                        flashDuration: FLASH_DURATION // Use FLASH_DURATION constant
                    }));
                }
            });
            console.log(`[ServerGameLogic] Hider ${caughtHiderId} hit by ${seekerId}. Health: ${newHealth}`);
        }
    } else {
        console.log(`[ServerGameLogic] Seeker ${seekerId} swung, but no hiders caught.`);
        // Optionally, send a message to seeker that they missed
        const seekerWs = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === seekerId);
        if (seekerWs && seekerWs.readyState === seekerWs.OPEN) {
            seekerWs.send(JSON.stringify({ type: 'gameMessage', message: 'You swung and missed!' }));
        }
    }
}

export function processHiderMorph(hiderId, targetPropId) {
    if (!wssInstance) {
        console.error('[ServerGameLogic] WSS instance not set for game logic.');
        return;
    }
    const player = getPlayer(hiderId);
    const propDefinition = getPropTypeDefinition(targetPropId);

    // Get current hider position for distance calculation, not default offset
    const hiderPos = player.position;
    // For simplicity, we'll assume the target prop's "position" for range check is its default offset (spawn point)
    // In a full game, props would have their own world positions. For now, this serves as an example.
    // If props are static, their positions should be defined and accessed.
    // However, your code implies targetPropPos is from propDefinition.defaultOffset - let's keep that assumption for now.
    // A more robust solution would involve server-side knowledge of prop *instances* and their actual world positions.
    // For now, we'll use the hider's current position to simplify the range check, assuming they are "near" a spawnable prop.
    // If you intend for players to morph INTO props that are already placed in the world, those props would need server-side positions.
    const targetPropPos = propDefinition.defaultOffset; // Assuming this is a reference point.

    const dx = hiderPos.x - targetPropPos.x;
    const dy = hiderPos.y - targetPropPos.y;
    const dz = hiderPos.z - targetPropPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let propEffectiveRadius = 0.5;
    if (propDefinition.geometry) {
        if (propDefinition.geometry.type === 'BoxGeometry') {
            propEffectiveRadius = Math.max(propDefinition.geometry.width, propDefinition.geometry.height, propDefinition.geometry.depth) / 2;
        } else if (propDefinition.geometry.type === 'CylinderGeometry') {
            propEffectiveRadius = Math.max(propDefinition.geometry.radiusTop, propDefinition.geometry.height / 2);
        } else if (propDefinition.geometry.type === 'SphereGeometry') {
            propEffectiveRadius = propDefinition.geometry.radius;
        }
    }

    const combinedRadius = MORPH_RANGE + propEffectiveRadius;

    const isWithinRange = distance < combinedRadius;

    if (!player || player.role !== PlayerRoles.HIDER || getCurrentGameState() !== GameStates.PLAYING ||
        !propDefinition || !isPropAvailable(targetPropId) || !isWithinRange) {
        console.log(`[ServerGameLogic] Invalid morph request from ${hiderId}: Not a hider, game not PLAYING, prop '${targetPropId}' not defined or not available, OR NOT WITHIN MORPH RANGE (dist ${distance.toFixed(2)} vs range ${combinedRadius.toFixed(2)}).`);
        const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === hiderId);
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'resetMorph', playerId: hiderId, message: 'Invalid morph or out of range.' })); // Tell client to reset morph state
        }
        return;
    }

    if (player.morphedInto) {
        markPropAvailable(player.morphedInto);
    }

    markPropTaken(targetPropId);
    player.morphedInto = targetPropId;

    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
                type: 'playerAction',
                playerId: hiderId,
                action: 'morph',
                targetPropId: targetPropId
            }));
        }
    });
    console.log(`[ServerGameLogic] Hider ${hiderId} morphed into ${targetPropId}.`);
}

function initializeServerProps() {
    console.log('[ServerGameLogic] Initializing server props (placeholder).');
    // This function can be called once on server startup, or whenever a full prop reset is needed.
    // The actual availability is managed by initializeServerPropsAvailability in ServerGameState.
}
initializeServerProps(); // Call this once on module load