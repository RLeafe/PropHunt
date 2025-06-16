// PropHunt/client/js/components/player/ClientPlayerEntity.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { PLAYER_HEIGHT_OFFSET } from '../../utils/ClientGameConfig.js';
import { PlayerRoles } from '../../utils/GameEnums.js';
import { ClientSeekerActions } from './ClientSeekerActions.js';
import { ClientHiderActions } from './ClientHiderActions.js';
import { getPropTypeDefinition, createPropMesh } from '../ClientGameProps.js';

export class ClientPlayerEntity {
    constructor(id, isLocal, scene, originalPlayerBodyGeometry, originalPlayerBodyMaterial, originalCameraRelativeY, morphableProps, networkClient) {
        this.id = id;
        this.isLocal = isLocal;
        this.scene = scene;
        this.networkClient = networkClient;
        this.morphableProps = morphableProps;

        this.playerGroup = new THREE.Group();
        this.playerBody = null;

        this.originalPlayerBodyGeometry = originalPlayerBodyGeometry;
        this.originalPlayerBodyMaterial = originalPlayerBodyMaterial;

        this.originalCameraRelativeY = originalCameraRelativeY;
        this.originalCameraRelativeZ = -0.1;

        this.camera = null;

        this.role = null;
        this.morphedIntoPropTypeId = null;

        this.seekerActions = null;
        this.hiderActions = null;

        this._createVisuals();
        console.log(`[ClientPlayerEntity] Player entity ${this.id} instantiated. Is Local: ${this.isLocal}`);
    }

    _createVisuals() {
        this.playerBody = new THREE.Mesh(this.originalPlayerBodyGeometry, this.originalPlayerBodyMaterial.clone());
        this.playerBody.position.set(0, 0, 0);
        this.playerBody.name = `player_body_${this.id}`;
        this.playerGroup.add(this.playerBody);

        this.playerBody.visible = !this.isLocal;

        if (this.isLocal) {
            console.log(`[ClientPlayerEntity] Attempting to create camera for local player ${this.id}.`);
            const gameAspect = window.innerWidth / window.innerHeight;
            this.camera = new THREE.PerspectiveCamera(75, gameAspect, 0.1, 1000);
            this.camera.position.set(0, this.originalCameraRelativeY, this.originalCameraRelativeZ);
            this.playerGroup.add(this.camera);
            console.log(`[ClientPlayerEntity] Camera for ${this.id} created:`, this.camera);
            console.log(`[ClientPlayerEntity] Camera parent for ${this.id}:`, this.camera.parent);
        }

        this._applyVisualsForRole();
    }

    setRole(newRole) {
        if (this.role === newRole) return;
        this.role = newRole;
        this._applyVisualsForRole();
    }

    _applyVisualsForRole() {
        this.resetMorphVisuals();

        if (this.seekerActions) {
            this.seekerActions.setVisible(false);
        }

        if (this.playerBody.geometry !== this.originalPlayerBodyGeometry) {
            this.playerBody.geometry.dispose();
            this.playerBody.geometry = this.originalPlayerBodyGeometry;
        }
        if (this.playerBody.material && this.playerBody.material !== this.originalPlayerBodyMaterial) {
            if (this.playerBody.material) this.playerBody.material.dispose();
            this.playerBody.material = this.originalPlayerBodyMaterial.clone();
        }

        this.playerBody.material.side = THREE.DoubleSide;
        this.playerBody.visible = !this.isLocal;
        this.playerBody.material.opacity = 1;
        this.playerBody.material.transparent = false;
        this.playerBody.material.alphaTest = 0;
        this.playerBody.material.needsUpdate = true;

        if (this.role === PlayerRoles.SEEKER) {
            this.playerBody.material.color.set(0x0000FF);
            if (this.seekerActions && this.isLocal) {
                this.seekerActions.setVisible(true);
            }
        } else if (this.role === PlayerRoles.HIDER) {
            this.playerBody.material.color.set(0x00FF00);
        } else {
            this.playerBody.material.color.set(0x888888);
        }
        this.playerGroup.scale.set(1, 1, 1);
        this.playerBody.position.set(0,0,0);
    }

    applyMorphVisuals(propTypeId) {
        if (!propTypeId) {
            this.resetMorphVisuals();
            return;
        }

        const propDefinition = getPropTypeDefinition(propTypeId);
        if (!propDefinition) {
            console.warn(`[ClientPlayerEntity] Morph propType ${propTypeId} not found in definitions.`);
            this.resetMorphVisuals();
            return;
        }

        const tempMeshForGeometry = createPropMesh(propDefinition);
        if (!tempMeshForGeometry) {
            this.resetMorphVisuals();
            return;
        }

        if (this.playerBody.geometry && this.playerBody.geometry !== this.originalPlayerBodyGeometry) {
            this.playerBody.geometry.dispose();
        }
        if (this.playerBody.material && this.playerBody.material !== this.originalPlayerBodyMaterial) {
            this.playerBody.material.dispose();
        }

        this.playerBody.geometry = tempMeshForGeometry.geometry;
        this.playerBody.material = tempMeshForGeometry.material;
        this.playerBody.material.side = THREE.DoubleSide;

        this.playerGroup.scale.copy(tempMeshForGeometry.scale);

        const boundingBox = new THREE.Box3().setFromObject(this.playerBody);
        const morphedObjectMinY = boundingBox.min.y;
        this.playerBody.position.y = -morphedObjectMinY;

        tempMeshForGeometry.geometry.dispose();
        tempMeshForGeometry.material.dispose();

        if (this.isLocal) {
            const morphedObjectHeight = boundingBox.max.y - boundingBox.min.y;
            const desiredCameraHeightFromMorphedBase = (morphedObjectHeight * this.playerGroup.scale.y) * 0.8;
            this.camera.position.set(0, desiredCameraHeightFromMorphedBase, 0);
        }
        this.morphedIntoPropTypeId = propTypeId;
        this.playerBody.visible = !this.isLocal;
        this.playerBody.material.opacity = 1;
        this.playerBody.material.transparent = false;
        this.playerBody.material.alphaTest = 0;
        this.playerBody.material.needsUpdate = true;
    }

    resetMorphVisuals() {
        if (this.morphedIntoPropTypeId === null && this.playerBody.geometry === this.originalPlayerBodyGeometry) {
            return;
        }

        if (this.playerBody.geometry && this.playerBody.geometry !== this.originalPlayerBodyGeometry) {
            this.playerBody.geometry.dispose();
        }
        if (this.playerBody.material && this.playerBody.material !== this.originalPlayerBodyMaterial) {
            if (this.playerBody.material) this.playerBody.material.dispose();
        }

        this.playerBody.geometry = this.originalPlayerBodyGeometry;
        this.playerBody.material = this.originalPlayerBodyMaterial.clone();
        this.playerBody.material.side = THREE.DoubleSide;
        this.playerBody.material.needsUpdate = true;

        this.playerBody.position.set(0, 0, 0);
        this.playerBody.rotation.set(0, 0, 0);

        this.playerGroup.scale.set(1, 1, 1);

        if (this.isLocal) {
            this.camera.position.set(0, this.originalCameraRelativeY, this.originalCameraRelativeZ);
        }
        this.morphedIntoPropTypeId = null;
        this.playerBody.visible = !this.isLocal;
        this.playerBody.material.opacity = 1;
        this.playerBody.material.transparent = false;
        this.playerBody.material.alphaTest = 0;
    }

    flashRed(durationMs = 200) {
        const originalMaterial = this.playerBody.material;
        const originalColor = originalMaterial.color.getHex();
        const originalOpacity = originalMaterial.opacity;
        const originalTransparent = originalMaterial.transparent;

        const flashMaterial = new THREE.MeshLambertMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        this.playerBody.material = flashMaterial;
        this.playerBody.material.needsUpdate = true;

        setTimeout(() => {
            if (this.playerBody && this.playerBody.material === flashMaterial) {
                flashMaterial.dispose();
                this.playerBody.material = originalMaterial;
                originalMaterial.color.setHex(originalColor);
                originalMaterial.opacity = originalOpacity;
                originalMaterial.transparent = originalTransparent;
                this.playerBody.material.needsUpdate = true;
            }
        }, durationMs);
    }

    /**
     * Disposes of Three.js geometries, materials, and other resources to prevent memory leaks.
     */
    dispose() {
        console.log(`[ClientPlayerEntity] Disposing resources for player ${this.id}`);
        // Dispose player body geometry and material if they are not the shared originals
        if (this.playerBody && this.playerBody.geometry && this.playerBody.geometry !== this.originalPlayerBodyGeometry) {
            this.playerBody.geometry.dispose();
        }
        if (this.playerBody && this.playerBody.material && this.playerBody.material !== this.originalPlayerBodyMaterial) {
            this.playerBody.material.dispose();
        }
        // Dispose seeker bat resources if applicable
        if (this.seekerActions && this.seekerActions.batMesh) {
            this.seekerActions.batMesh.geometry.dispose();
            this.seekerActions.batMesh.material.dispose();
        }
        // Remove from scene graph explicitly, though ClientGameManager also does this.
        if (this.playerGroup.parent) {
            this.playerGroup.parent.remove(this.playerGroup);
        }
        // Dispose camera related event listeners if ClientPlayerControls is disposed separately
        // (Three.js cameras themselves don't have a .dispose() method for their core object,
        // but their hierarchy removal is important).
        if (this.camera && this.camera.parent) {
            this.camera.parent.remove(this.camera);
        }
    }

    getPosition() { return this.playerGroup.position; }
    getRotationY() { return this.playerGroup.rotation.y; }
    getCameraRotationX() { return this.camera ? this.camera.rotation.x : 0; }
    getRole() { return this.role; }
    isMorphed() { return this.morphedIntoPropTypeId !== null; }
    getMorphedPropTypeId() { return this.morphedIntoPropTypeId; }
    getMesh() { return this.playerGroup; }
    getCamera() { return this.camera; }
}