// /client/js/core/ClientGameManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { ClientPlayerEntity } from '../components/player/ClientPlayerEntity.js';
import { ClientPlayerControls } from '../components/player/ClientPlayerControls.js';
import { GameStates } from '../../shared/utils/GameEnums.js';

export class ClientGameManager {
    constructor() {
        this.players = new Map();
        this.localPlayerId = null;
        this.scene = null;
        this.networkClient = null;
        this.playerControls = null;
        this.currentGameState = GameStates.LOBBY;
    }

    init(scene, canvasElement, networkClient) {
        this.scene = scene;
        this.networkClient = networkClient;
        this.canvasElement = canvasElement;
    }

    update(deltaTime) {
        // This loop continues to run even when paused.

        // The local player's controls script will handle ignoring input when frozen.
        if (this.playerControls) {
            this.playerControls.update(deltaTime);
        }
        
        // This ensures remote players continue to be updated and smoothed.
        this.players.forEach(player => {
            if (!player.isLocal) {
                player.update(deltaTime);
            }
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
        // The player starts frozen by default and is unfrozen by the server.
        this.playerControls.setMovementFreeze(true); 
    }

    handlePlayerUpdate(playerState) {
        let player = this.players.get(playerState.playerId);

        if (!player) {
            const isLocal = playerState.playerId === this.localPlayerId;
            player = new ClientPlayerEntity(playerState.playerId, isLocal, this.scene, this.networkClient);
            this.players.set(playerState.playerId, player);
            this.scene.add(player.playerGroup);

            if (isLocal && !this.playerControls) {
                this.setupLocalPlayer(player);
            }
        }
        
        player.applyState(playerState);

        // Crucially, update the freeze state on the local player's controls
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

    setGameState(newState) {
        this.currentGameState = newState;
    }
}