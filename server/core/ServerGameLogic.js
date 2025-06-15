// PropHunt/server/core/ServerGameLogic.js

import { players, playerConnections, getCurrentGameState, setCurrentGameState, getSeekerId, setSeekerId, incrementHiderCount, decrementHiderCount, resetGameState, getAllPlayersState, setLastAssignedRoleWasSeeker, lastAssignedRoleWasSeeker, getHiderCount, setHiderCount, initializeServerPropsAvailability, isPropAvailable, markPropTaken, markPropAvailable, getPlayerHealth, setPlayerHealth } from './ServerGameState.js'; 
import { MIN_PLAYERS, MAX_PLAYERS, SEEKER_PAUSE_DURATION_SECONDS, GAME_END_RESET_SECONDS, HIT_DAMAGE, FLASH_DURATION_MS, PLAYER_HEIGHT_OFFSET, MORPH_RANGE, SEEKER_SWING_HIT_RADIUS, SEEKER_SWING_DISTANCE } from '../config/ServerConfig.js'; 
import { GameStates } from '../utils/GameEnums.js'; 
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

    setCurrentGameState(GameStates.PLAYING); 
    initializeServerPropsAvailability(); 
    let currentHiderCountInLoop = 0; 

    const clientIds = Array.from(playerConnections.values());
    for (let i = clientIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clientIds[i], clientIds[j]] = [clientIds[j], clientIds[i]];
    }

    let roleForFirstInList;
    if (lastAssignedRoleWasSeeker) { 
        roleForFirstInList = 'hider';
    } else {
        roleForFirstInList = 'seeker';
    }
    setLastAssignedRoleWasSeeker(roleForFirstInList === 'seeker'); 

    clientIds.forEach((id, index) => {
        let role;
        if (index === 0) {
            role = roleForFirstInList;
        } else if (index === 1 && clientIds.length > 1) {
             role = roleForFirstInList === 'seeker' ? 'hider' : 'seeker';
        } else {
            role = 'hider';
        }

        players.get(id).role = role;
        players.get(id).morphedInto = null; 
        setPlayerHealth(id, 100); 

        if (role === 'hider') {
            currentHiderCountInLoop++;
        } else {
            setSeekerId(id); 
        }

        const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === id);
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'assignRole', playerId: id, role: role, countdown: SEEKER_PAUSE_DURATION_SECONDS })); 
        }
        console.log(`[ServerGameLogic] Assigned ${id} as ${role}`);
    });
    setHiderCount(currentHiderCountInLoop); 

    const seekerId = getSeekerId(); 

    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) { 
            const clientId = playerConnections.get(client);
            const player = players.get(clientId);

            if (clientId === seekerId) {
                client.send(JSON.stringify({ type: 'gamePauseState', paused: true, message: `You are the Seeker! The hunt begins in ${SEEKER_PAUSE_DURATION_SECONDS} seconds...` })); 
            } else {
                client.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'Game has started! Find a spot to hide!' })); 
            }
        }
    });

    startCountdownTimer(
        'seekerPauseTimer', 
        SEEKER_PAUSE_DURATION_SECONDS, 
        () => { 
            const seekerWs = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === getSeekerId());
            if (seekerWs && seekerWs.readyState === seekerWs.OPEN) {
                seekerWs.send(JSON.stringify({ type: 'gamePauseState', paused: false, message: 'GO! The hunt is ON!' })); 
            }
            console.log('[ServerGameLogic] Seeker pause ended.');
        },
        [getSeekerId()], 
        'The hunt begins in ' 
    );

    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) { 
            client.send(JSON.stringify({ type: 'gameStarted', message: 'Prepare for the hunt!' }));
        }
    });
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
            }
            client.send(JSON.stringify({ type: 'assignRole', playerId: clientId, role: null })); 
            client.send(JSON.stringify({ type: 'resetMorph', playerId: clientId })); 
        }
    });

    startCountdownTimer(
        'gameResetTimer', 
        GAME_END_RESET_SECONDS, 
        () => { 
            console.log('[ServerGameLogic] Game reset timer finished. Resetting for new game.');
            resetGameState(); 
        },
        null, 
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
    
    const hiderIds = Array.from(players.keys()).filter(id => players.get(id).role === 'hider'); 
    
    const seekerPlayer = players.get(seekerId);
    if (!seekerPlayer) {
        console.warn(`[ServerGameLogic] Seeker ${seekerId} not found for hit processing.`);
        return;
    }
    
    const HIT_RADIUS = SEEKER_SWING_HIT_RADIUS; 
    const SWING_DISTANCE = SEEKER_SWING_DISTANCE; 
    const HIT_DAMAGE = HIT_DAMAGE; 
    const FLASH_DURATION_MS = FLASH_DURATION_MS; 

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
        if (!hider || hider.role !== 'hider') continue;

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
        const newHealth = Math.max(0, currentHealth - HIT_DAMAGE);
        setPlayerHealth(caughtHiderId, newHealth); 

        if (newHealth <= 0) {
            caughtHider.role = 'seeker';
            
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
                        newRole: 'seeker',
                        caughtPropId: caughtHider.morphedInto, 
                        position: caughtHider.position, 
                        rotation: caughtHider.rotation,
                        health: newHealth 
                    }));
                }
            });
            console.log(`[ServerGameLogic] Hider ${caughtHiderId} caught by ${seekerId}!`);

            if (getHiderCount() <= 0) { 
                endGame('All hiders caught!', wssInstance); 
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
                        flashDuration: FLASH_DURATION_MS 
                    }));
                }
            });
            console.log(`[ServerGameLogic] Hider ${caughtHiderId} hit by ${seekerId}. Health: ${newHealth}`);
        }
    } else {
        console.log(`[ServerGameLogic] Seeker ${seekerId} swung, but no hiders caught.`);
    }
}

export function processHiderMorph(hiderId, targetPropId) {
    if (!wssInstance) {
        console.error('[ServerGameLogic] WSS instance not set for game logic.');
        return;
    }
    const player = players.get(hiderId);
    const propDefinition = getPropTypeDefinition(targetPropId); 

    const hiderPos = player.position;
    const targetPropPos = propDefinition.defaultOffset; 

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

    if (!player || player.role !== 'hider' || getCurrentGameState() !== GameStates.PLAYING || 
        !propDefinition || !isPropAvailable(targetPropId) || !isWithinRange) { 
        console.log(`[ServerGameLogic] Invalid morph request from ${hiderId}: Not a hider, game not PLAYING, prop '${targetPropId}' not defined or not available, OR NOT WITHIN MORPH RANGE (dist ${distance.toFixed(2)} vs range ${combinedRadius.toFixed(2)}).`); 
        const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === hiderId);
        if (ws && ws.readyState === ws.OPEN) { 
            ws.send(JSON.stringify({ type: 'resetMorph', playerId: hiderId }));
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
}
initializeServerProps();