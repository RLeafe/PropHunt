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

    const { broadcaster, timerManager } = gameLogicContext;

    broadcaster.toAll({ type: 'hidePersistentMessage' });
    
    State.setCurrentGameState(GameStates.STARTING);
    const seekerId = State.assignRolesAndReturnSeekerId();
    
    broadcaster.toAll({ type: 'rolesAssigned', players: State.getAllPlayersState() });
    
    const seeker = State.getPlayer(seekerId);
    if(seeker) {
        seeker.isFrozen = true;
        broadcaster.toClient(seekerId, { type: 'playerFreezeStateUpdate', isFrozen: true, message: 'You are the Seeker!' });
    }
    
    broadcaster.toHiders(State.players, { type: 'gamePauseState', paused: false, message: 'A seeker has been chosen! Hide!' });

    timerManager.start({
        name: 'seekerPause',
        durationSeconds: Config.SEEKER_PAUSE_DURATION_SECONDS,
        onTick: (payload) => broadcaster.toSeekers(State.players, payload),
        onComplete: () => {
            State.setCurrentGameState(GameStates.PLAYING);
            if(seeker) {
                seeker.isFrozen = false;
                broadcaster.toClient(seekerId, { type: 'playerFreezeStateUpdate', isFrozen: false, message: 'Go! The hunt is on!' });
            }
            broadcaster.toHiders(State.players, { type: 'gameStarted', message: 'The seeker has been released!' });
            broadcaster.toSeekers(State.players, { type: 'gameStarted', message: '' });
        },
        messagePrefix: 'Hunt in: '
    });
}

export function endGame(reason) {
    if (State.getCurrentGameState() === GameStates.ENDED) return;
    const { broadcaster, timerManager } = gameLogicContext;
    
    State.setCurrentGameState(GameStates.ENDED);
    timerManager.stopAll();
    
    broadcaster.toAll({ type: 'gameEnded', reason });

    timerManager.start({
        name: 'gameReset',
        durationSeconds: Config.GAME_END_RESET_SECONDS,
        onTick: (payload) => broadcaster.toAll(payload),
        onComplete: () => {
            State.resetGameState();
            broadcaster.toAll({ type: 'gameStarted', message: '' });
            broadcaster.toAll({
                type: 'gameStateUpdate',
                gameState: GameStates.LOBBY,
                players: State.getAllPlayersState()
            });
             if (State.players.size >= Config.MIN_PLAYERS) {
                startGame();
            } else {
                 const waitingMessage = `Waiting for more players... (${State.players.size}/${Config.MIN_PLAYERS})`;
                 broadcaster.toAll({ type: 'showPersistentMessage', message: waitingMessage });
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
            gameLogicContext.broadcaster.toAll({ type: 'playerHit', playerId: hider.playerId, newHealth: hider.health, attackerId: seekerId });
            if (hider.health <= 0) {
                if(hider.morphedInto) State.markPropAvailable(hider.morphedInto);
                hider.morphedInto = null;
                hider.role = PlayerRoles.SEEKER;
                hider.health = 100;
                State.decrementHiderCount();
                gameLogicContext.broadcaster.toAll({ type: 'playerCaught', caughtHiderId: hider.playerId });
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

            // Make the old prop available again.
            State.markPropAvailable(player.morphedInto);
            player.morphedInto = null;
            
            // Notify all clients that the player has un-morphed.
            broadcast('all', { type: 'playerMorphed', playerId: hiderId, targetPropId: null });
        }
        return;
    }
    
    // Logic for morphing INTO a new prop.
    const propDef = getPropTypeDefinition(targetPropId);
    if (!propDef || player.role !== PlayerRoles.HIDER || !State.isPropAvailable(targetPropId)) return;

    // If currently morphed into something else, free up the old prop first.
    if (player.morphedInto) State.markPropAvailable(player.morphedInto);
    
    State.markPropTaken(targetPropId);
    player.morphedInto = targetPropId;
    gameLogicContext.broadcaster.toAll({ type: 'playerMorphed', playerId: hiderId, targetPropId: targetPropId });
}

function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}