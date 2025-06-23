// /client/js/core/ClientGameManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { ClientPlayerEntity } from '../components/player/ClientPlayerEntity.js';
import { ClientPlayerControls } from '../components/player/ClientPlayerControls.js';
import { GameStates } from '../../shared/utils/GameEnums.js';
import { SettingsMenu } from '../components/ui/SettingsMenu.js';
import { MOUSE_SENSITIVITY } from '../utils/ClientGameConfig.js';

export class ClientGameManager {
    constructor() {
        this.players = new Map();
        this.localPlayerId = null;
        this.scene = null;
        this.broadcaster = null;
        this.playerControls = null;
        this.currentGameState = GameStates.LOBBY;
        
        this.settingsMenu = null;
        this.gameContainer = null;
    }

    init(scene, canvasElement, broadcaster, gameContainer) {
        this.scene = scene;
        this.broadcaster = broadcaster;
        this.canvasElement = canvasElement;
        this.gameContainer = gameContainer;
    }

    update(deltaTime) {
        if (this.playerControls) {
            this.playerControls.update(deltaTime);
        }
        
        this.players.forEach(player => {
            player.update(deltaTime);
        });
    }

    setLocalPlayerId(id) {
        this.localPlayerId = id;
        if (this.players.has(id)) {
            this.setupLocalPlayer(this.players.get(id));
        }
    }

    setupLocalPlayer(playerEntity) {
        this.playerControls = new ClientPlayerControls(playerEntity, this.canvasElement);
        this.playerControls.init();
        this.playerControls.setMovementFreeze(true); 

        if (!this.settingsMenu && this.gameContainer) {
            this.settingsMenu = new SettingsMenu(
                this.gameContainer,
                MOUSE_SENSITIVITY, // initial X
                MOUSE_SENSITIVITY, // initial Y
                this.playerControls.setSensitivityX.bind(this.playerControls),
                this.playerControls.setSensitivityY.bind(this.playerControls)
            );
        }
    }

    handlePlayerUpdate(playerState) {
        let player = this.players.get(playerState.playerId);

        if (!player) {
            const isLocal = playerState.playerId === this.localPlayerId;
            player = new ClientPlayerEntity(playerState.playerId, isLocal, this.scene, this.broadcaster);
            this.players.set(playerState.playerId, player);
            this.scene.add(player.playerGroup);

            if (isLocal && !this.playerControls) {
                this.setupLocalPlayer(player);
            }
        }
        
        player.applyState(playerState);

        if (player.isLocal && this.playerControls) {
            this.playerControls.setMovementFreeze(playerState.isFrozen);
        }
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.dispose();
            this.players.delete(playerId);
        }
    }

    getLocalPlayer() {
        return this.players.get(this.localPlayerId);
    }

    getControls() {
        return this.playerControls;
    }
    
    getSettingsMenu() {
        return this.settingsMenu;
    }

    setGameState(newState) {
        this.currentGameState = newState;
    }
}