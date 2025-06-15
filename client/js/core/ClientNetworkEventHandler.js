import { PlayerRoles } from '../utils/GameEnums.js'; 
import { PLAYER_HEIGHT_OFFSET } from '../utils/ClientGameConfig.js'; 
import { setGamePauseState } from '../main.js'; 

export class ClientNetworkEventHandler { 
    constructor(clientGameManager, scene, morphableProps, uiManager) { 
        this.clientGameManager = clientGameManager; 
        this.scene = scene;
        this.morphableProps = morphableProps; 
        this.uiManager = uiManager; 
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                console.log(`[ClientNetworkEventHandler] Connected with ID: ${message.clientId}`);
                break;

            case 'initialState':
                message.players.forEach(p => {
                    this.clientGameManager.handlePlayerNetworkUpdate(p.playerId, p.position, p.rotation, p.role, p.morphedInto, p.health); 
                });
                break;
            
            case 'playerUpdateBatch': 
                // This type is no longer primarily used for movement in client-authoritative model
                // However, the server might still send it for initial state.
                message.players.forEach(p => {
                    this.clientGameManager.handlePlayerNetworkUpdate(p.playerId, p.position, p.rotation, p.role, p.morphedInto, p.health); 
                });
                break;

            case 'playerConnected':
                this.clientGameManager.handlePlayerNetworkUpdate(message.playerId, message.position, message.rotation, message.role, message.morphedInto, message.health); 
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} joined.`);
                break;

            case 'playerUpdate': // Reverted to handling individual player updates for client-authoritative
                this.clientGameManager.handlePlayerNetworkUpdate(message.playerId, message.position, message.rotation, message.role, message.morphedInto, message.health); 
                break;

            case 'playerDisconnected':
                this.clientGameManager.removePlayer(message.playerId);
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} disconnected.`);
                break;

            case 'assignRole':
                const targetPlayer = this.clientGameManager.players.get(message.playerId);
                if (targetPlayer && targetPlayer.isLocal) { 
                    if (message.role) {
                        this.uiManager.displayMessage(`You are a ${message.role.toUpperCase()}!`);
                    } else { 
                        this.uiManager.displayMessage(`Your role is currently unassigned.`);
                    }
                }
                if (targetPlayer) {
                    targetPlayer.setRole(message.role);
                }
                break;
            
            case 'gamePauseState': 
                setGamePauseState(message.paused, message.message || null); 
                break;

            case 'countdownUpdate': 
                const localPlayer = this.clientGameManager.getLocalPlayerEntity();
                if (localPlayer && localPlayer.id) { 
                    if (message.timerName === 'seekerPauseTimer' && localPlayer.id === message.playerId) {
                         this.uiManager.displayMessage(message.message);
                    } else if (message.timerName === 'gameResetTimer') { 
                        this.uiManager.displayMessage(message.message);
                    }
                    if (message.timeLeft <= 0 && message.timerName === 'seekerPauseTimer') {
                        this.uiManager.hideMessage();
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
                break;

            case 'gameEnded':
                this.uiManager.displayMessage(`Game Ended: ${message.reason}`, 1000); 
                break;
            
            case 'playerCaught':
                console.log(`[ClientNetworkEventHandler] Player ${message.caughtHiderId} was caught by ${message.seekerId}! New role: ${message.newRole}`);
                
                this.clientGameManager.handlePlayerNetworkUpdate( 
                    message.caughtHiderId,
                    message.position || {x:0, y:PLAYER_HEIGHT_OFFSET, z:0},
                    message.rotation || {y:0, x:0},
                    message.newRole,
                    null, 
                    message.health 
                );

                if (message.caughtPropId) { 
                    const propToReappear = this.morphableProps.find(p => p.userData.propTypeId === message.caughtPropId);
                    if (propToReappear && !propToReappear.parent) { 
                        this.scene.add(propToReappear);
                        console.log(`[ClientNetworkEventHandler] Prop ${message.caughtPropId} re-added to scene.`);
                    }
                }
                break;

            case 'playerHit': 
                const hitPlayer = this.clientGameManager.players.get(message.playerId);
                if (hitPlayer) {
                    this.clientGameManager.playerHealths.set(message.playerId, message.newHealth); 
                    if (hitPlayer.isLocal) { 
                        this.uiManager.flashHitIndicator(); 
                        hitPlayer.flashRed(message.flashDuration); 
                    } else { 
                        hitPlayer.flashRed(message.flashDuration); 
                    }
                }
                console.log(`[ClientNetworkEventHandler] Player ${message.playerId} hit. Health: ${message.newHealth}`);
                break;


            case 'playerAction':
                const actingPlayer = this.clientGameManager.players.get(message.playerId);
                if (!actingPlayer) {
                    return;
                }

                if (message.action === 'swingBat') {
                } else if (message.action === 'morph') { 
                    actingPlayer.applyMorphVisuals(message.targetPropId); 
                }
                break;

            case 'gameFull':
                this.uiManager.displayMessage(message.message); 
                break;

            default:
        }
    }
}