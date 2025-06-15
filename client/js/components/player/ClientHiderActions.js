// PropHunt/client/js/components/player/ClientHiderActions.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class ClientHiderActions { // Renamed class
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
        this.screenCenter = new THREE.Vector2(0, 0);
        this.networkClient = null; // Renamed networking to networkClient
        this.playerEntity = null;
    }

    init(scene, playerCamera, playerGroup, playerBody, originalPlayerBodyGeometry, originalPlayerBodyMaterial, originalCameraRelativeY, morphableProps, networkClient, playerEntity) { // Renamed networking to networkClient
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.playerGroup = playerGroup;
        this.playerBody = playerBody;
        this.originalPlayerBodyGeometry = originalPlayerBodyGeometry;
        this.originalPlayerBodyMaterial = originalPlayerBodyMaterial;
        this.originalCameraRelativeY = originalCameraRelativeY;
        this.morphableProps = morphableProps;
        this.networkClient = networkClient; // Store networkClient
        this.playerEntity = playerEntity;
    }

    attemptMorph() {
        const targetObject = this._getObjectPlayerIsLookingAt();

        if (targetObject && targetObject.userData && targetObject.userData.propTypeId) {
            const propTypeId = targetObject.userData.propTypeId;
            // Send hider morph action to server
            this.networkClient.sendHiderMorph(propTypeId); // Use networkClient
            console.log(`Hider morph request sent to server for propType: ${propTypeId}.`);

            // Client-side visual application of morph (prediction)
            this.playerEntity.applyMorphVisuals(propTypeId);
            return propTypeId;
        } else {
            console.log('No valid morph target found or clicked, resetting morph.');
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