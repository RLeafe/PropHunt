// PropHunt/client/js/core/ClientGameManager.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { ClientPlayerEntity } from '../components/player/ClientPlayerEntity.js';
import { ClientPlayerControls } from '../components/player/ClientPlayerControls.js';
import { PlayerRoles, GameStates } from '../utils/GameEnums.js';
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

        this.currentClientGameState = GameStates.LOBBY;
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
            this.playerControls.update(deltaTime);
        }
    }

    setClientGameState(newState) {
        if (this.currentClientGameState === newState) return;
        this.currentClientGameState = newState;
        console.log(`[ClientGameManager] Client game state updated to: ${newState}`);
    }

    /**
     * Handles network updates for a specific player, spawning them if new or updating their state.
     * This now immediately creates/updates ClientPlayerEntity and adds it to the scene.
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
            console.log(`[ClientGameManager] Creating new player entity for ${playerId}. Is Local: ${isLocalPlayer}`);

            playerEntity = new ClientPlayerEntity( // <-- INSTANTIATION HAPPENS HERE IMMEDIATELY
                playerId, isLocalPlayer, this.scene,
                this.sharedOriginalPlayerBodyGeometry, this.sharedOriginalPlayerBodyMaterial,
                this.defaultCameraRelativeY, this.morphableProps, this.networkClient
            );
            this.players.set(playerId, playerEntity); // Add to active players map
            this.scene.add(playerEntity.playerGroup); // Add to scene immediately upon creation
            console.log(`[ClientGameManager] Player ${playerId}'s playerGroup added to scene:`, playerEntity.playerGroup);


            if (isLocalPlayer) {
                console.log(`[ClientGameManager] Initializing ClientPlayerControls for local player ${playerId}.`);
                this.playerControls = new ClientPlayerControls(playerEntity, this.canvasElement);
                this.playerControls.init();
                this.playerControls.setEnabled(true); // Explicitly enable controls on creation for lobby roaming
                console.log(`[ClientGameManager] Controls ENABLED for local player on creation.`);
            }
        }

        // Always apply authoritative position and rotation from the server
        playerEntity.playerGroup.position.set(position.x, position.y, position.z);
        playerEntity.playerGroup.rotation.y = rotation.y;

        // Only apply camera pitch for remote players' models
        if (!playerEntity.isLocal) {
            if (playerEntity.playerBody) {
                playerEntity.playerBody.rotation.x = rotation.x;
            }
        }

        this.playerHealths.set(playerId, health);

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

        // Set visibility for remote players or hide local body
        playerEntity.playerBody.visible = !playerEntity.isLocal;
        playerEntity.playerBody.material.needsUpdate = true; // Ensure material updates are reflected

    }

    removePlayer(playerId) {
        const playerEntity = this.players.get(playerId);
        if (playerEntity) {
            if (playerEntity.playerGroup.parent === this.scene) {
                this.scene.remove(playerEntity.playerGroup);
            }
            playerEntity.dispose();
            this.players.delete(playerId);
            this.playerHealths.delete(playerId);
            console.log(`[ClientGameManager] Removed and disposed player entity: ${playerId}`);
        } else {
            console.log(`[ClientGameManager] Player ${playerId} was not found, nothing to remove.`);
        }
        // If the local player disconnected, reset controls and ID
        if (this.localPlayerId === playerId) {
            this.localPlayerId = null;
            if (this.playerControls) {
                this.playerControls.setEnabled(false);
                this.playerControls.dispose();
                this.playerControls = null;
            }
        }
    }

    setLocalPlayerId(newId) {
        if (this.localPlayerId === newId) {
            return;
        }
        console.log(`[ClientGameManager] Setting localPlayerId from ${this.localPlayerId} to ${newId}.`);
        this.localPlayerId = newId;
    }

    getLocalPlayerEntity() {
        return this.players.get(this.localPlayerId);
    }

    getPlayerHealth(playerId) {
        return this.playerHealths.get(playerId);
    }

    getOriginalPlayerBodyGeometry() {
        return this.sharedOriginalPlayerBodyGeometry;
    }

    /**
     * Removes all player entities from the Three.js scene, disposes their resources,
     * and clears active player data. This is primarily for a full game end/reset.
     */
    despawnAllPlayers() {
        console.log('[ClientGameManager] Despawning all active players. This is primarily for game end/reset.');
        this.players.forEach(playerEntity => {
            if (playerEntity.playerGroup.parent === this.scene) {
                this.scene.remove(playerEntity.playerGroup);
            }
            playerEntity.dispose();
        });
        this.players.clear();

        // Safely dispose playerControls if it exists and is an instance of ClientPlayerControls
        if (this.playerControls instanceof ClientPlayerControls) {
            this.playerControls.setEnabled(false);
            this.playerControls.dispose();
            this.playerControls = null;
        } else if (this.playerControls) {
            console.warn('[ClientGameManager] playerControls exists but is not a ClientPlayerControls instance, skipping dispose.');
            this.playerControls = null;
        }
        this.localPlayerId = null;
    }
}