// PropHunt/client/js/components/player/ClientHiderActions.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { MORPH_RANGE } from '../../utils/ClientGameConfig.js'; // Import MORPH_RANGE

export class ClientHiderActions {
    constructor() {
        this.scene = null;
        this.playerCamera = null;
        this.playerGroup = null;
        this.playerBody = null;
        this.originalPlayerBodyGeometry = null;
        this.originalPlayerBodyMaterial = null;
        this.originalCameraRelativeY = 0;

        this.morphableProps = null;
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0); // Center of the screen for raycasting
        this.networkClient = null;
        this.playerEntity = null;
    }

    init(scene, playerCamera, playerGroup, playerBody, originalPlayerBodyGeometry, originalPlayerBodyMaterial, originalCameraRelativeY, morphableProps, networkClient, playerEntity) {
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.playerGroup = playerGroup;
        this.playerBody = playerBody;
        this.originalPlayerBodyGeometry = originalPlayerBodyGeometry;
        this.originalPlayerBodyMaterial = originalPlayerBodyMaterial;
        this.originalCameraRelativeY = originalCameraRelativeY;
        this.morphableProps = morphableProps;
        this.networkClient = networkClient;
        this.playerEntity = playerEntity;
    }

    attemptMorph() {
        const targetObject = this._getObjectPlayerIsLookingAt();

        if (targetObject && targetObject.userData && targetObject.userData.propTypeId) {
            const propTypeId = targetObject.userData.propTypeId;

            // Optional client-side range check for immediate feedback (prediction)
            // The server will perform the definitive check.
            const playerPos = this.playerGroup.position; // Get current player position
            const propPos = targetObject.position; // Get target prop's position
            const distance = playerPos.distanceTo(propPos);

            if (distance <= MORPH_RANGE) { // Use MORPH_RANGE from config
                // Send hider morph action to server
                this.networkClient.sendHiderMorph(propTypeId);
                console.log(`Hider morph request sent to server for propType: ${propTypeId}.`);

                // Client-side visual prediction: apply morph visuals immediately
                // The server's playerUpdateBatch will correct/confirm this.
                this.playerEntity.applyMorphVisuals(propTypeId);
                return propTypeId;
            } else {
                console.log(`[ClientHiderActions] Prop too far to morph. Distance: ${distance.toFixed(2)}m (Max: ${MORPH_RANGE}m)`);
                // If out of range, do not send to server, and reset client morph state
                this.playerEntity.resetMorphVisuals();
                return null;
            }
        } else {
            console.log('No valid morph target found, resetting morph.');
            // If no valid target, reset morph visuals
            this.playerEntity.resetMorphVisuals();
            return null;
        }
    }

    resetMorph() {
        this.playerEntity.resetMorphVisuals();
    }

    _getObjectPlayerIsLookingAt() {
        this.raycaster.setFromCamera(this.screenCenter, this.playerCamera);
        const intersects = this.raycaster.intersectObjects(this.morphableProps, false);

        if (intersects.length > 0) {
            return intersects[0].object;
        }
        return null;
    }
}