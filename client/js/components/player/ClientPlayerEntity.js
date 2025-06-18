// /client/js/components/player/ClientPlayerEntity.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { PlayerRoles } from '../../../shared/utils/GameEnums.js';
import { getPropTypeDefinition } from '../../../shared/props/SharedPropsConfig.js';
import { createPropMesh } from '../ClientGameProps.js';
import { ClientSeekerActions } from './ClientSeekerActions.js';
import { ClientHiderActions } from './ClientHiderActions.js';
import { FLASH_DURATION_MS } from '../../utils/ClientGameConfig.js';

export class ClientPlayerEntity {
    constructor(id, isLocal, scene, networkClient) {
        this.id = id;
        this.isLocal = isLocal;
        this.scene = scene;
        this.networkClient = networkClient;
        this.isFrozen = false;

        this.playerGroup = new THREE.Group();
        this.playerBody = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1.8, 1),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        this.playerBody.name = `player_body_${this.id}`;
        this.playerGroup.add(this.playerBody);
        
        this.camera = null;
        this.role = null;
        this.morphedIntoPropTypeId = null;

        this.seekerActions = null;
        this.hiderActions = null;

        this.targetPosition = new THREE.Vector3();
        this.targetRotation = new THREE.Quaternion();

        this._createVisuals();
    }

    _createVisuals() {
        this.playerBody.visible = !this.isLocal;

        if (this.isLocal) {
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 1.6, 0.1);
            this.playerGroup.add(this.camera);
            
            this.seekerActions = new ClientSeekerActions(this.camera, this.networkClient);
            this.hiderActions = new ClientHiderActions(this.camera, this, this.networkClient);
        }
    }

    update(deltaTime) {
        if (!this.isLocal) {
            this.playerGroup.position.lerp(this.targetPosition, 15 * deltaTime);
            this.playerGroup.quaternion.slerp(this.targetRotation, 15 * deltaTime);
        }
    }

    setRole(newRole) {
        if (this.role === newRole) return;
        this.role = newRole;
        this.resetVisuals();

        if(this.isLocal) {
            this.seekerActions.setVisible(this.role === PlayerRoles.SEEKER);
        }
    }

    applyState(state) {
        this.isFrozen = state.isFrozen;
        
        if (this.isLocal) return;
        
        this.targetPosition.set(state.position.x, state.position.y, state.position.z);
        
        const euler = new THREE.Euler(state.rotation.x, state.rotation.y, 0, 'YXZ');
        this.targetRotation.setFromEuler(euler);
        
        if (this.role !== state.role) this.setRole(state.role);
        if (this.morphedIntoPropTypeId !== state.morphedInto) {
            this.applyMorphVisuals(state.morphedInto);
        }
    }

    applyMorphVisuals(propTypeId) {
        this.morphedIntoPropTypeId = propTypeId;
        if (!propTypeId) {
            this.resetVisuals();
            return;
        }

        const propDef = getPropTypeDefinition(propTypeId);
        if (!propDef) {
            this.resetVisuals();
            return;
        }

        const propMesh = createPropMesh(propDef);
        if(this.playerBody.geometry) this.playerBody.geometry.dispose();
        if(this.playerBody.material) this.playerBody.material.dispose();
        this.playerBody.geometry = propMesh.geometry;
        this.playerBody.material = propMesh.material;
        
        const bbox = new THREE.Box3().setFromObject(this.playerBody);
        this.playerBody.position.y = -(bbox.min.y);

        this.playerBody.visible = true;
    }

    resetVisuals() {
        this.morphedIntoPropTypeId = null;
        if (this.playerBody.geometry) this.playerBody.geometry.dispose();
        if (this.playerBody.material) this.playerBody.material.dispose();
        this.playerBody.geometry = new THREE.BoxGeometry(1, 1.8, 1);
        this.playerBody.material = new THREE.MeshLambertMaterial({ color: this.role === PlayerRoles.SEEKER ? 0xFF3333 : 0x33FF33 });
        this.playerBody.position.y = 0;
        this.playerBody.visible = !this.isLocal;
    }
    
    flashRed() {
        const originalColor = this.playerBody.material.color.clone();
        this.playerBody.material.color.set(0xFF0000);
        setTimeout(() => {
            if(this.playerBody?.material) {
                 this.playerBody.material.color.copy(originalColor);
            }
        }, FLASH_DURATION_MS);
    }
    
    dispose() {
        if (this.seekerActions) this.seekerActions.dispose();
        if (this.playerGroup.parent) this.playerGroup.parent.remove(this.playerGroup);
        this.playerBody.geometry.dispose();
        this.playerBody.material.dispose();
    }
}