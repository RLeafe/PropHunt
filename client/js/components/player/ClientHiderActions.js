// /client/js/components/player/ClientHiderActions.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { MORPH_RANGE } from '../../utils/ClientGameConfig.js';

export class ClientHiderActions {
    constructor(camera, playerEntity, networkClient) {
        this.camera = camera;
        this.playerEntity = playerEntity;
        this.networkClient = networkClient;
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);
    }

    /**
     * Attempts to either morph into a prop or revert to human form.
     */
    attemptMorph() {
        // If the player is already morphed, the action is to unmorph.
        if (this.playerEntity.morphedIntoPropTypeId) {
            // Send a null target to the server to signal an unmorph request.
            this.networkClient.sendHiderMorph(null);
        } else {
            // If not morphed, find a valid prop to morph into.
            const target = this._findMorphTarget();
            if (target) {
                // Send the ID of the found prop to the server.
                this.networkClient.sendHiderMorph(target.propTypeId);
            }
        }
    }

    /**
     * Uses a raycaster from the center of the camera to find a morphable prop.
     * @returns {object|null} The found prop's data or null if no valid target is found.
     * @private
     */
    _findMorphTarget() {
        this.raycaster.setFromCamera(this.screenCenter, this.camera);
        
        // Find all potential morph targets currently in the scene.
        const morphableMeshes = [];
        this.playerEntity.scene.traverse((object) => {
            if (object.isMesh && object.userData.propTypeId) {
                morphableMeshes.push(object);
            }
        });

        const intersects = this.raycaster.intersectObjects(morphableMeshes);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const distance = intersection.distance;
            const propTypeId = intersection.object.userData.propTypeId;

            // Check if the found prop is within the allowed morph range.
            if (distance <= MORPH_RANGE) {
                return { propTypeId, distance };
            }
        }
        
        // No valid target was found in range.
        return null;
    }
}