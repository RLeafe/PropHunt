// /client/js/core/ClientNetworkEventHandler.js
import { GameStates, PlayerRoles } from '../../shared/utils/GameEnums.js';

export class ClientNetworkEventHandler {
    constructor(gameManager, alertMessage) {
        this.gameManager = gameManager;
        this.alertMessage = alertMessage;
    }

    handle(message) {
        switch (message.type) {
            case 'connected':
                this.gameManager.setLocalPlayerId(message.clientId);
                this.alertMessage.show(`Connected as ${message.clientId}`);
                break;

            case 'initialState':
            case 'gameStateUpdate':
                this.gameManager.setGameState(message.gameState);
                message.players.forEach(pState => this.gameManager.handlePlayerUpdate(pState));
                break;

            case 'playerUpdateBatch':
                message.players.forEach(pState => this.gameManager.handlePlayerUpdate(pState));
                break;

            case 'playerConnected':
                this.gameManager.handlePlayerUpdate(message.player);
                this.alertMessage.show(`${message.player.playerId} has joined.`);
                break;

            case 'playerDisconnected':
                this.gameManager.removePlayer(message.playerId);
                this.alertMessage.show(`${message.playerId} has left.`);
                break;
            
            case 'disconnectedFromServer':
                this.alertMessage.show('Lost connection to server.', 0);
                this.gameManager.setGameState(GameStates.ENDED);
                break;

            case 'countdownUpdate':
                this.alertMessage.updateCountdown(message.message);
                break;
                
            case 'playerFreezeStateUpdate': {
                const localPlayer = this.gameManager.getLocalPlayer();
                if(localPlayer) {
                    localPlayer.isFrozen = message.isFrozen;
                    const controls = this.gameManager.getControls();
                    if(controls) {
                        controls.setMovementFreeze(message.isFrozen);
                    }
                }
                if (message.message) {
                     this.alertMessage.show(message.message);
                }
                break;
            }

            case 'gameStarted':
                this.alertMessage.show(message.message, 3000);
                this.alertMessage.updateCountdown('');
                this.gameManager.setGameState(GameStates.PLAYING);
                break;

            case 'gameEnded':
                this.alertMessage.show(`Game Over: ${message.reason}`, 5000);
                this.gameManager.setGameState(GameStates.ENDED);
                break;

            case 'playerHit': {
                const player = this.gameManager.players.get(message.playerId);
                if (player) player.flashRed();
                break;
            }
                
            case 'playerCaught': {
                this.alertMessage.show(`${message.caughtHiderId} has been caught!`);
                const caughtPlayer = this.gameManager.players.get(message.caughtHiderId);
                if (caughtPlayer) {
                    caughtPlayer.setRole(PlayerRoles.SEEKER);
                }
                break;
            }

            case 'playerMorphed': {
                 const player = this.gameManager.players.get(message.playerId);
                 if (player) player.applyMorphVisuals(message.targetPropId);
                 break;
            }
             
            case 'rolesAssigned': {
                message.players.forEach(pState => this.gameManager.handlePlayerUpdate(pState));
                break;
            }

            case 'showPersistentMessage':
                // 0 makes the message stay until hidden.
                this.alertMessage.show(message.message, 0);
                break;
            
            case 'hidePersistentMessage':
                this.alertMessage.hide();
                break;

            default:
                break;
        }
    }
}
