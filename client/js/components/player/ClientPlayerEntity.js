// PropHunt/client/js/components/player/ClientPlayerEntity.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY } from '../../utils/ClientGameConfig.js'; 
import { PlayerRoles } from '../../utils/GameEnums.js'; 
import { ClientSeekerActions } from './ClientSeekerActions.js'; 
import { ClientHiderActions } from './ClientHiderActions.js'; 
import { getPropTypeDefinition, createPropMesh, PropTypes } from '../ClientGameProps.js'; 

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

        // Client-side prediction physics properties
        this.keyboard = new Map(); // Local input state for client-side prediction
        this.playerVelocity = new THREE.Vector3(); // Client-side velocity for prediction
        this.jumpCooldown = 200; 
        this.nextJumpTime = 0; 
        this.isLocked = false; // Pointer lock state

        this.seekerActions = null;
        this.hiderActions = null;

        this._createVisuals(); 
    }

    _createVisuals() {
        this.playerBody = new THREE.Mesh(this.originalPlayerBodyGeometry, this.originalPlayerBodyMaterial.clone());
        this.playerBody.position.set(0, 0, 0); 
        this.playerBody.name = `player_body_${this.id}`; 
        this.playerGroup.add(this.playerBody);
        
        this.playerBody.visible = !this.isLocal; // Local player is invisible to self

        this.scene.add(this.playerGroup);
        
        if (this.isLocal) {
            const gameAspect = window.innerWidth / window.innerHeight;
            this.camera = new THREE.PerspectiveCamera(75, gameAspect, 0.1, 1000);
            this.camera.position.set(0, this.originalCameraRelativeY, this.originalCameraRelativeZ); 
            this.playerGroup.add(this.camera);

            this.seekerActions = new ClientSeekerActions(); 
            this.hiderActions = new ClientHiderActions(); 
            this.seekerActions.init(this.scene, this.camera, this.playerGroup, this.playerBody, this.originalPlayerBodyGeometry, this.originalPlayerBodyMaterial, this.originalCameraRelativeY, this.morphableProps, this.networkClient, this); 
            this.hiderActions.init(this.scene, this.camera, this.playerGroup, this.playerBody, this.originalPlayerBodyGeometry, this.originalPlayerBodyMaterial, this.originalCameraRelativeY, this.morphableProps, this.networkClient, this); 
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

        this.playerBody.material = this.originalPlayerBodyMaterial.clone(); 
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
    }

    applyMorphVisuals(propTypeId) { 
        if (!propTypeId) { 
            this.resetMorphVisuals();
            this.morphedIntoPropTypeId = null; 
            return;
        }

        const propDefinition = getPropTypeDefinition(propTypeId); 
        if (!propDefinition) {
            console.warn(`[ClientPlayerEntity] Morph propType ${propTypeId} not found in definitions.`);
            this.resetMorphVisuals();
            this.morphedIntoPropTypeId = null;
            return;
        }

        const tempMeshForGeometry = createPropMesh(propDefinition); 
        if (!tempMeshForGeometry) {
            this.resetMorphVisuals();
            this.morphedIntoPropTypeId = null;
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
        this.playerGroup.scale.copy(tempMeshForGeometry.scale); 

        const boundingBox = new THREE.Box3().setFromObject(this.playerBody);
        const morphedObjectMinY = boundingBox.min.y;
        
        this.playerBody.position.y = -(morphedObjectMinY); 

        tempMeshForGeometry.geometry.dispose(); 
        tempMeshForGeometry.material.dispose(); 

        if (this.isLocal) {
            const morphedObjectHeight = boundingBox.max.y - boundingBox.min.y;
            const desiredCameraHeightFromMorphedBase = (morphedObjectHeight * this.playerGroup.scale.y) * 0.8;
            this.camera.position.set(0, desiredCameraHeightFromMorphedBase + (morphedObjectMinY * this.playerGroup.scale.y), 0);
        }
        this.morphedIntoPropTypeId = propTypeId; 
        this.playerBody.visible = !this.isLocal; 
        this.playerBody.material.opacity = 1;
        this.playerBody.material.transparent = false;
        this.playerBody.material.alphaTest = 0;
        this.playerBody.material.side = THREE.DoubleSide; 
        this.playerBody.material.needsUpdate = true; 
    }

    resetMorphVisuals() {
        if (this.playerBody.geometry && this.playerBody.geometry !== this.originalPlayerBodyGeometry) {
            this.playerBody.geometry.dispose();
        }
        if (this.playerBody.material && this.playerBody.material !== this.originalPlayerBodyMaterial) {
            this.playerBody.material.dispose();
        }
        
        this.playerBody.geometry = this.originalPlayerBodyGeometry;
        this.playerBody.material = this.originalPlayerBodyMaterial.clone(); 
        this.playerBody.material.side = THREE.DoubleSide; 
        this.playerBody.material.needsUpdate = true; 

        this.playerBody.position.set(0, 0, 0); 
        this.playerBody.rotation.set(0,0,0); 

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
                this.playerBody.material.dispose(); 
                this.playerBody.material = originalMaterial; 
                this.playerBody.material.opacity = originalOpacity;
                this.playerBody.material.transparent = originalTransparent;
                this.playerBody.material.needsUpdate = true;
            }
        }, durationMs);
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