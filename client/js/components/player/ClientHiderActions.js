// /client/js/components/player/ClientHiderActions.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { MORPH_RANGE } from '../../utils/ClientGameConfig.js';

export class ClientHiderActions {
    constructor(camera, playerEntity, broadcaster) {
        this.camera = camera;
        this.playerEntity = playerEntity;
        this.broadcaster = broadcaster;
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);
    }

    /**
     * Attempts to morph into a targeted prop.
     */
    attemptMorph() {
        const target = this._findMorphTarget();

        if (target) {
            this.broadcaster.sendHiderMorph(target.propTypeId);
        }
    }

    /**
     * Uses a raycaster from the center of the camera to find a morphable prop.
     * @returns {object|null} The found prop's data or null if no valid target is found.
     * @private
     */
    _findMorphTarget() {
        this.raycaster.setFromCamera(this.screenCenter, this.camera);
        
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

            if (distance <= MORPH_RANGE) {
                return { propTypeId, distance };
            }
        }
        
        return null;
    }
}
