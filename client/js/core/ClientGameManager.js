// PropHunt/client/js/core/ClientGameManager.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { ClientPlayerEntity } from '../components/player/ClientPlayerEntity.js'; 
import { ClientPlayerControls } from '../components/player/ClientPlayerControls.js'; 
import { PlayerRoles } from '../utils/GameEnums.js'; 
import { PLAYER_HEIGHT_OFFSET } from '../utils/ClientGameConfig.js'; 

export class ClientGameManager { 
    constructor() {
        this.players = new Map();
        this.localPlayerId = null; 

        this.playerHealths = new Map(); 

        this.scene = null;
        this.canvasElement = null;
        this.gameAspect = null;
        this.morphableProps = null;
        this.networkClient = null; 
        
        this.sharedOriginalPlayerBodyGeometry = new THREE.BoxGeometry(1, 1.8, 1);
        this.sharedOriginalPlayerBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        this.defaultCameraRelativeY = 1.0; 
        
        /** @type {ClientPlayerControls | null} */
        this.playerControls = null; 
    }

    init(scene, canvasElement, gameAspect, morphableProps, networkClient) { 
        this.scene = scene;
        this.canvasElement = canvasElement;
        this.gameAspect = gameAspect;
        this.morphableProps = morphableProps;
        this.networkClient = networkClient; 
    }

    update(deltaTime) { 
        if (this.playerControls) { 
            this.playerControls.update(deltaTime); // ClientPlayerControls handles local physics now
        }
    }

    /**
     * Handles network updates for a specific player, spawning them if new or updating their state.
     * This is called by ClientNetworkEventHandler when a player state message is received from the server.
     * @param {string} playerId Unique ID of the player.
     * @param {Object} position Player's world position (x, y, z).
     * @param {Object} rotation Player's rotation (y for yaw, x for pitch).
     * @param {PlayerRole | null} role Player's assigned role.
     * @param {string | null} morphedIntoTypeId Type ID of the prop the player is morphed into.
     * @param {number} [health=100] Player's current health.
     */
    handlePlayerNetworkUpdate(playerId, position, rotation, role, morphedIntoTypeId, health = 100) { 
        let playerEntity = this.players.get(playerId);
        let isNewlyCreated = false;

        if (!playerEntity) {
            isNewlyCreated = true;
            const isLocalPlayer = (playerId === this.localPlayerId); 

            playerEntity = new ClientPlayerEntity(
                playerId, isLocalPlayer, this.scene, 
                this.sharedOriginalPlayerBodyGeometry, this.sharedOriginalPlayerBodyMaterial,
                this.defaultCameraRelativeY, this.morphableProps, this.networkClient 
            );
            this.players.set(playerId, playerEntity);

            if (isLocalPlayer) {
                this.playerControls = new ClientPlayerControls(playerEntity, this.canvasElement, this.networkClient); // Pass canvasElement and networkClient
                this.playerControls.init(this.canvasElement);
            }
            playerEntity.playerGroup.position.y = PLAYER_HEIGHT_OFFSET; // Initial Y height
        }

        if (!playerEntity.playerGroup.parent) {
            console.error(`[ClientGameManager ERROR] Player ${playerId}'s playerGroup has no parent after update! Re-adding to scene.`);
            this.scene.add(playerEntity.playerGroup);
        }
        
        if (this.playerHealths instanceof Map) { 
            this.playerHealths.set(playerId, health); 
        } else {
            console.error(`[ClientGameManager ERROR] this.playerHealths is not a Map! Initializing.`);
            this.playerHealths = new Map(); 
            this.playerHealths.set(playerId, health);
        }

        // --- Core authoritative position/rotation application ---
        // This is always applied for all players (local and remote)
        playerEntity.playerGroup.position.set(position.x, position.y, position.z); 
        playerEntity.playerGroup.rotation.y = rotation.y;
        
        // Only apply camera pitch for remote players' models
        if (!playerEntity.isLocal) {
            if (playerEntity.playerBody) {
                playerEntity.playerBody.rotation.x = rotation.x;
            }
        } 
        // For local player, ClientPlayerControls handles camera pitch directly via mouse.

        // Update role and apply visuals if changed or newly created
        if (playerEntity.role !== role || isNewlyCreated) { 
            playerEntity.setRole(role); 
        } 

        // Update morph state and apply visuals if changed or newly created
        if (role === PlayerRoles.HIDER && morphedIntoTypeId) { 
            if (playerEntity.morphedIntoPropTypeId !== morphedIntoTypeId || isNewlyCreated) { 
                playerEntity.applyMorphVisuals(morphedIntoTypeId); 
            }
        } else if (playerEntity.morphedIntoPropTypeId !== null) {
            playerEntity.resetMorphVisuals();
        }

        // --- Ensure visibility for remote players after update ---
        if (!playerEntity.isLocal) {
            playerEntity.playerBody.visible = true; 
            playerEntity.playerBody.material.needsUpdate = true; 
        }
    }

    removePlayer(playerId) {
        const playerEntity = this.players.get(playerId);
        if (playerEntity) {
            this.scene.remove(playerEntity.playerGroup);
            if (playerEntity.playerBody) {
                playerEntity.playerBody.geometry.dispose();
                if (playerEntity.playerBody.material) playerEntity.playerBody.material.dispose();
            }
            if (playerEntity.seekerActions && playerEntity.seekerActions.batMesh) {
                playerEntity.seekerActions.batMesh.geometry.dispose();
                if (playerEntity.seekerActions.batMesh.material) playerEntity.seekerActions.batMesh.material.dispose();
            }
            this.players.delete(playerId);
            if (this.playerHealths instanceof Map) { 
                this.playerHealths.delete(playerId); 
            }
            console.log(`[ClientGameManager] Removed player entity: ${playerId}`);
        }
    }

    setLocalPlayerId(newId) {
        if (this.localPlayerId === newId) { 
            return;
        }
        this.localPlayerId = newId;
        this.handlePlayerNetworkUpdate(newId, { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 }, { y: 0, x: 0 }, null, null);
    }

    getLocalPlayerEntity() {
        return this.players.get(this.localPlayerId);
    }

    getPlayerHealth(playerId) {
        if (this.playerHealths instanceof Map) { 
            return this.playerHealths.get(playerId);
        } else {
            console.error(`[ClientGameManager ERROR] Attempted to get health but this.playerHealths is not a Map!`);
            this.playerHealths = new Map(); 
            return undefined;
        }
    }

    getOriginalPlayerBodyGeometry() {
        return this.sharedOriginalPlayerBodyGeometry;
    }
}