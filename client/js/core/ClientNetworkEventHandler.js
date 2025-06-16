// PropHunt/client/js/core/ClientNetworkEventHandler.js
import { PlayerRoles, GameStates } from '../utils/GameEnums.js';
import { PLAYER_HEIGHT_OFFSET } from '../utils/ClientGameConfig.js';
import { setClientGamePauseState } from '../main.js';

export class ClientNetworkEventHandler {
    constructor(clientGameManager, scene, morphableProps, uiManager) {
        this.clientGameManager = clientGameManager;
        this.scene = scene;
        this.morphableProps = morphableProps;
        this.uiManager = uiManager;
    }

    handleMessage(message) {
        const previousClientGameState = this.clientGameManager.currentClientGameState;

        if (message.currentGameState) {
            this.clientGameManager.setClientGameState(message.currentGameState);
        }

        switch (message.type) {
            case 'connected':
                console.log(`[ClientNetworkEventHandler] Connected with ID: ${message.clientId}`);
                this.clientGameManager.setLocalPlayerId(message.clientId);
                setClientGamePauseState(false, `Waiting for more player(s) to connect...`);
                // REMOVED: this.clientGameManager.despawnAllPlayers(); -- This was one of the problematic lines
                break;

            case 'initialState':
                message.players.forEach(p => {
                    this.clientGameManager.handlePlayerNetworkUpdate(p.playerId, p.position, p.rotation, p.role, p.morphedInto, p.health);
                });

                if (this.clientGameManager.currentClientGameState === GameStates.LOBBY) {
                    //setClientGamePauseState(true, message.message || `Waiting for ${message.minPlayers - message.currentPlayers} more player(s) to connect...`);
                    // REMOVED: this.clientGameManager.despawnAllPlayers(); -- This was the other problematic line
                } else if (this.clientGameManager.currentClientGameState === GameStates.STARTING || this.clientGameManager.currentClientGameState === GameStates.PLAYING) {
                    setClientGamePauseState(false, message.message || "Game in progress!");
                }
                break;

            case 'playerUpdateBatch':
                message.players.forEach(p => {
                    this.clientGameManager.handlePlayerNetworkUpdate(p.playerId, p.position, p.rotation, p.role, p.morphedInto, p.health);
                });
                break;

            case 'playerConnected':
                this.clientGameManager.handlePlayerNetworkUpdate(message.playerId, message.position, message.rotation, message.role, message.morphedInto, message.health);
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} joined.`);
                break;

            case 'playerUpdate':
                this.clientGameManager.handlePlayerNetworkUpdate(message.playerId, message.position, message.rotation, message.role, message.morphedInto, message.health);
                break;

            case 'playerDisconnected':
                this.clientGameManager.removePlayer(message.playerId);
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} disconnected.`);
                break;

            case 'assignRole':
                const assignedPlayerEntity = this.clientGameManager.players.get(message.playerId);
                if (assignedPlayerEntity) {
                    this.clientGameManager.handlePlayerNetworkUpdate(
                        message.playerId,
                        assignedPlayerEntity.position,
                        { x: assignedPlayerEntity.getCameraRotationX(), y: assignedPlayerEntity.getRotationY() },
                        message.role,
                        assignedPlayerEntity.getMorphedPropTypeId(),
                        this.clientGameManager.getPlayerHealth(message.playerId)
                    );
                } else {
                    console.warn(`[ClientNetworkEventHandler] assignRole received for uninstantiated player ${message.playerId}. Creating with defaults.`);
                    this.clientGameManager.handlePlayerNetworkUpdate(
                        message.playerId,
                        { x:0, y:PLAYER_HEIGHT_OFFSET, z:0 },
                        { x:0, y:0 },
                        message.role,
                        null,
                        100
                    );
                }
                const assignedPlayer = this.clientGameManager.getLocalPlayerEntity();
                if (assignedPlayer && assignedPlayer.id === message.playerId) {
                    this.uiManager.displayMessage(`You are a ${message.role.toUpperCase()}!`, 3000);
                }
                break;

            case 'gamePauseState':
                setClientGamePauseState(message.paused, message.message || null);
                const localPlayer = this.clientGameManager.getLocalPlayerEntity();
                if (localPlayer && this.clientGameManager.playerControls) {
                    if (this.clientGameManager.currentClientGameState === GameStates.LOBBY && previousClientGameState !== GameStates.LOBBY) {
                        this.clientGameManager.despawnAllPlayers();
                    } else if (localPlayer.role === PlayerRoles.SEEKER && message.paused && message.timerName === 'seekerPauseTimer') {
                        this.clientGameManager.playerControls.setEnabled(false);
                        console.log(`[ClientNetworkEventHandler] Seeker controls DISABLED due to pause timer.`);
                    } else if (localPlayer.role === PlayerRoles.HIDER && message.paused) {
                        this.clientGameManager.playerControls.setEnabled(true);
                        console.log(`[ClientNetworkEventHandler] Hider controls ENABLED (despite unexpected gamePauseState).`);
                    } else {
                        this.clientGameManager.playerControls.setEnabled(!message.paused && localPlayer.role !== null);
                        console.log(`[ClientNetworkEventHandler] Controls set by general setClientGamePauseState logic.`);
                    }
                }
                break;

            case 'countdownUpdate':
                console.log(`[ClientNetworkEventHandler] Received countdownUpdate: ${message.timerName}, TimeLeft: ${message.timeLeft}`); // <-- THIS IS THE CONSOLE.LOG YOU'RE LOOKING FOR
                const localPlayerForCountdown = this.clientGameManager.getLocalPlayerEntity();
                if (localPlayerForCountdown) {
                    if (message.timerName === 'seekerPauseTimer' && localPlayerForCountdown.role === PlayerRoles.SEEKER) {
                        // This updates the message displayed on the UI
                        this.uiManager.displayMessage(message.message);
                    } else if (message.timerName === 'gameResetTimer') {
                        // This updates the message displayed on the UI
                        this.uiManager.displayMessage(message.message);
                    }
                }
                break;

            case 'resetMorph':
                const resetPlayer = this.clientGameManager.players.get(message.playerId);
                if (resetPlayer) {
                    resetPlayer.resetMorphVisuals();
                }
                break;

            case 'gameStarted':
                this.uiManager.displayMessage(message.message, 3000);
                setClientGamePauseState(false, null);
                break;

            case 'gameEnded':
                this.uiManager.displayMessage(`Game Ended: ${message.reason}`, 5000);
                setClientGamePauseState(true, `Game Ended: ${message.reason}`);
                this.clientGameManager.despawnAllPlayers();
                break;

            case 'playerCaught':
                this.clientGameManager.handlePlayerNetworkUpdate(
                    message.caughtHiderId,
                    message.position || { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 },
                    message.rotation || { y: 0, x: 0 },
                    message.newRole,
                    null, // Caught players revert to human form
                    message.health
                );
                console.log(`[ClientNetworkEventHandler] Player ${message.caughtHiderId} was caught by ${message.seekerId}! New role: ${message.newRole}`);

                if (message.caughtPropId) {
                    const propToReappear = this.morphableProps.find(p => p.userData.propTypeId === message.caughtPropId);
                    if (propToReappear) {
                        this.scene.add(propToReappear);
                        console.log(`[ClientNetworkEventHandler] Prop ${message.caughtPropId} re-added to scene.`);
                    }
                }
                break;

            case 'playerHit':
                const hitPlayerEntity = this.clientGameManager.players.get(message.playerId);
                if (hitPlayerEntity) {
                    this.clientGameManager.handlePlayerNetworkUpdate(
                        message.playerId,
                        hitPlayerEntity.position,
                        { x: hitPlayerEntity.getCameraRotationX(), y: hitPlayerEntity.getRotationY() },
                        hitPlayerEntity.getRole(),
                        hitPlayerEntity.getMorphedPropTypeId(),
                        message.newHealth
                    );

                    if (hitPlayerEntity.isLocal) {
                        this.uiManager.flashHitIndicator();
                        hitPlayerEntity.flashRed(message.flashDuration);
                    } else {
                        hitPlayerEntity.flashRed(message.flashDuration);
                    }
                } else {
                    console.warn(`[ClientNetworkEventHandler] playerHit received for uninstantiated player ${message.playerId}. Only updating health.`);
                    this.clientGameManager.playerHealths.set(message.playerId, message.newHealth);
                }
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} hit. Health: ${message.newHealth}`);
                break;

            case 'playerAction':
                const actingPlayer = this.clientGameManager.players.get(message.playerId);
                if (actingPlayer && !actingPlayer.isLocal) {
                    if (message.action === 'swingBat') {
                        if (actingPlayer.seekerActions) {
                            actingPlayer.seekerActions.swingBat();
                        }
                    } else if (message.action === 'morph') {
                        actingPlayer.applyMorphVisuals(message.targetPropId);
                    }
                }
                break;

            case 'gameFull':
                this.uiManager.displayMessage(message.message, 5000);
                break;

            case 'gameMessage':
                this.uiManager.displayMessage(message.message, 3000);
                break;

            default:
                console.log(`[ClientNetworkEventHandler] Unhandled message type: ${message.type}`, message);
        }
    }
}