// /server/core/ServerGameLogic.js
import * as State from './ServerGameState.js';
import * as Config from '../config/ServerConfig.js';
import { GameStates, PlayerRoles } from '../../client/shared/utils/GameEnums.js';
import { getPropTypeDefinition } from '../../client/shared/props/SharedPropsConfig.js';

let gameLogicContext = {};

export function initializeGameLogic(context) {
    gameLogicContext = context;
}

export function startGame() {
    if (State.players.size < Config.MIN_PLAYERS) return;

    State.setCurrentGameState(GameStates.STARTING);
    const seekerId = State.assignRolesAndReturnSeekerId();
    
    broadcast('all', { type: 'rolesAssigned', players: State.getAllPlayersState() });
    
    const seeker = State.getPlayer(seekerId);
    if(seeker) {
        seeker.isFrozen = true;
        const seekerWs = findSocketById(seekerId);
        if (seekerWs) {
            seekerWs.send(JSON.stringify({ type: 'playerFreezeStateUpdate', isFrozen: true, message: 'You are the Seeker!' }));
        }
    }
    
    broadcast('hiders', { type: 'gamePauseState', paused: false, message: 'A seeker has been chosen! Hide!' });

    gameLogicContext.timerManager.start({
        name: 'seekerPause',
        durationSeconds: Config.SEEKER_PAUSE_DURATION_SECONDS,
        onTick: (payload) => broadcast('seeker', payload),
        onComplete: () => {
            State.setCurrentGameState(GameStates.PLAYING);
            if(seeker) {
                seeker.isFrozen = false;
                const seekerWs = findSocketById(seekerId);
                if (seekerWs) {
                    seekerWs.send(JSON.stringify({ type: 'playerFreezeStateUpdate', isFrozen: false, message: 'Go! The hunt is on!' }));
                }
            }
            broadcast('hiders', { type: 'gameStarted', message: 'The seeker has been released!' });
        },
        messagePrefix: 'Hunt in: '
    });
}

export function endGame(reason) {
    if (State.getCurrentGameState() === GameStates.ENDED) return;
    State.setCurrentGameState(GameStates.ENDED);
    gameLogicContext.timerManager.stopAll();
    
    broadcast('all', { type: 'gameEnded', reason });

    gameLogicContext.timerManager.start({
        name: 'gameReset',
        durationSeconds: Config.GAME_END_RESET_SECONDS,
        onTick: (payload) => broadcast('all', payload),
        onComplete: () => {
            State.resetGameState();
            broadcast('all', {
                type: 'gameStateUpdate',
                gameState: GameStates.LOBBY,
                players: State.getAllPlayersState()
            });
             if (State.players.size >= Config.MIN_PLAYERS) {
                startGame();
            }
        },
        messagePrefix: 'New game in: '
    });
}

export function processSeekerHit(seekerId) {
    const seeker = State.getPlayer(seekerId);
    if (!seeker || seeker.isFrozen) return;
    
    for (const hider of State.players.values()) {
        if (hider.role !== PlayerRoles.HIDER) continue;
        const distance = getDistance(seeker.position, hider.position);
        if (distance < Config.SEEKER_SWING_DISTANCE) {
            hider.health -= Config.HIT_DAMAGE;
            broadcast('all', { type: 'playerHit', playerId: hider.playerId, newHealth: hider.health, attackerId: seekerId });
            if (hider.health <= 0) {
                if(hider.morphedInto) State.markPropAvailable(hider.morphedInto);
                hider.morphedInto = null;
                hider.role = PlayerRoles.SEEKER;
                hider.health = 100;
                State.decrementHiderCount();
                broadcast('all', { type: 'playerCaught', caughtHiderId: hider.playerId });
                if (State.getHiderCount() <= 0) {
                    endGame('All hiders have been caught!');
                }
            }
            return;
        }
    }
}

export function processHiderMorph(hiderId, targetPropId) {
    const player = State.getPlayer(hiderId);
    if (!player || player.isFrozen) return;

    if (!targetPropId) {
        if (player.morphedInto) {
            State.markPropAvailable(player.morphedInto);
            player.morphedInto = null;
            broadcast('all', { type: 'playerMorphed', playerId: hiderId, targetPropId: null });
        }
        return;
    }
    
    const propDef = getPropTypeDefinition(targetPropId);
    if (!propDef || player.role !== PlayerRoles.HIDER || !State.isPropAvailable(targetPropId)) return;
    if (player.morphedInto) State.markPropAvailable(player.morphedInto);
    
    State.markPropTaken(targetPropId);
    player.morphedInto = targetPropId;
    broadcast('all', { type: 'playerMorphed', playerId: hiderId, targetPropId: targetPropId });
}

function broadcast(target, payload) {
    const { wss } = gameLogicContext;
    const message = JSON.stringify(payload);

    if (target === 'all') {
        wss.clients.forEach(client => { if (client.readyState === 1) client.send(message); });
    } else if (target === 'seeker') {
        const seekerWs = findSocketById(State.getSeekerId());
        if (seekerWs?.readyState === 1) seekerWs.send(message);
    } else if (target === 'hiders') {
         State.players.forEach(player => {
            if(player.role === PlayerRoles.HIDER) {
                const ws = findSocketById(player.playerId);
                if (ws?.readyState === 1) ws.send(message);
            }
        });
    }
}

export function findSocketById(id) {
    const { playerConnections } = gameLogicContext;
    if (!playerConnections) return null;
    return Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === id);
}

function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}