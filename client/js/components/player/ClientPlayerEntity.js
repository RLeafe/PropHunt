// /client/js/components/player/ClientPlayerEntity.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
// PATHS FIXED: Corrected the relative paths to point to the correct locations.
import { PlayerRoles } from '../../../shared/utils/GameEnums.js';
import { getPropTypeDefinition } from '../../../shared/props/SharedPropsConfig.js';
import { createPropMesh } from '../ClientGameProps.js';
import { ClientSeekerActions } from './ClientSeekerActions.js';
import { ClientHiderActions } from './ClientHiderActions.js';
import { FLASH_DURATION_MS } from '../../utils/ClientGameConfig.js';

export class ClientPlayerEntity {
  constructor(id, isLocal, scene, broadcaster) {
    this.id = id;
    this.isLocal = isLocal;
    this.scene = scene;
    this.broadcaster = broadcaster;
    this.isFrozen = false;

    this.playerGroup = new THREE.Group();
    this.playerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.8, 1),
      new THREE.MeshLambertMaterial({ color: 0x888888 })
    );
    this.playerBody.name = `player_body_${this.id}`;
    this.playerBody.position.y = 0; 
    this.playerGroup.add(this.playerBody);

    this.camera = null;
    this.role = null;
    this.morphedIntoPropTypeId = null;
    this.seekerActions = null;
    this.hiderActions = null;

    this.positionHistory = [];

    this._createVisuals();
  }

  _createVisuals() {
    this.playerBody.visible = !this.isLocal;

    if (this.isLocal) {
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.y = 0.7; 
      this.playerGroup.add(this.camera);

      this.seekerActions = new ClientSeekerActions(this.camera, this.broadcaster);
      this.hiderActions = new ClientHiderActions(this.camera, this, this.broadcaster);
    }
  }

  applyState(state) {
    this.isFrozen = state.isFrozen;
    if (this.role !== state.role) this.setRole(state.role);
    if (this.morphedIntoPropTypeId !== state.morphedInto) {
      this.applyMorphVisuals(state.morphedInto);
    }

    const pos = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
    const bodyRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, state.rotation.y, 0, 'YXZ'));
    const cameraPitch = state.rotation.x;

    this.positionHistory.push({
      timestamp: Date.now(),
      position: pos,
      rotation: bodyRotation,
      pitch: cameraPitch
    });

    if (this.positionHistory.length > 20) {
      this.positionHistory.shift();
    }
  }

  update(deltaTime) {
    const interpDelay = 50;
    const renderTime = Date.now() - interpDelay;

    let previous, next;
    for (let i = this.positionHistory.length - 2; i >= 0; i--) {
      const a = this.positionHistory[i];
      const b = this.positionHistory[i + 1];
      if (a.timestamp <= renderTime && b.timestamp >= renderTime) {
        previous = a;
        next = b;
        break;
      }
    }
    
    if (previous && next) {
      const total = next.timestamp - previous.timestamp;
      const part = renderTime - previous.timestamp;
      const t = Math.max(0, Math.min(1, total > 0 ? part / total : 1));

      this.playerGroup.position.lerpVectors(previous.position, next.position, t);
      this.playerGroup.quaternion.copy(previous.rotation).slerp(next.rotation, t);
      
      if (this.isLocal && this.camera) {
        const interpolatedPitch = previous.pitch + (next.pitch - previous.pitch) * t;
        this.camera.rotation.x = interpolatedPitch;
      }
    } else if (this.positionHistory.length > 0) {
        const lastState = this.positionHistory[this.positionHistory.length - 1];
        this.playerGroup.position.copy(lastState.position);
        this.playerGroup.quaternion.copy(lastState.rotation);
        if (this.isLocal && this.camera) {
            this.camera.rotation.x = lastState.pitch;
        }
    }
  }

  setRole(newRole) {
    if (this.role === newRole) return;
    this.role = newRole;
    this.resetVisuals();
    if (this.isLocal) {
      this.seekerActions.setVisible(this.role === PlayerRoles.SEEKER);
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
    if (this.playerBody.geometry) this.playerBody.geometry.dispose();
    if (this.playerBody.material) this.playerBody.material.dispose();
    this.playerBody.geometry = propMesh.geometry;
    this.playerBody.material = propMesh.material;

    const bbox = new THREE.Box3().setFromObject(this.playerBody);
    this.playerBody.position.y = -bbox.min.y;
    this.playerBody.visible = true;

    if (this.isLocal && this.camera) {
        const propHeight = bbox.max.y - bbox.min.y;
        this.camera.position.y = propHeight * 0.9;
    }
  }

  resetVisuals() {
    this.morphedIntoPropTypeId = null;
    if (this.playerBody.geometry) this.playerBody.geometry.dispose();
    if (this.playerBody.material) this.playerBody.material.dispose();
    this.playerBody.geometry = new THREE.BoxGeometry(1, 1.8, 1);
    this.playerBody.material = new THREE.MeshLambertMaterial({ color: this.role === PlayerRoles.SEEKER ? 0xFF3333 : 0x33FF33 });
    this.playerBody.position.y = 0;

    // Return to the standard FPS view (invisible body for local player) when not morphed.
    this.playerBody.visible = !this.isLocal;

    if (this.isLocal && this.camera) {
        this.camera.position.y = 0.7;
    }
  }

  flashRed() {
    const originalColor = this.playerBody.material.color.clone();
    this.playerBody.material.color.set(0xFF0000);
    setTimeout(() => {
      if (this.playerBody?.material) {
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