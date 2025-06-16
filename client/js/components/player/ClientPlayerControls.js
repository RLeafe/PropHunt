// PropHunt/client/js/components/player/ClientPlayerControls.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY, PLAYER_SPEED, MOUSE_SENSITIVITY, GRAVITY, JUMP_FORCE } from '../../utils/ClientGameConfig.js';
import { PlayerRoles } from '../../utils/GameEnums.js';

const PI_2 = Math.PI / 2;

export class ClientPlayerControls {
    constructor(playerEntity, canvasElement) {
        this._playerEntity = playerEntity;
        this.canvasElement = canvasElement;

        this.keyboard = new Map();
        this.mouseDelta = { x: 0, y: 0 };
        this.isLocked = false;
        this.isEnabled = true; // Initial state set to true

        this._direction = new THREE.Vector3();

        this._boundHandlePointerLockChange = this._handlePointerLockChange.bind(this);
        this._boundHandleMouseMove = this._handleMouseMove.bind(this);
        this._boundHandleMouseDown = this._handleMouseDown.bind(this);
        this._boundHandleKeydown = this._handleKeydown.bind(this);
        this._boundHandleKeyup = this._handleKeyup.bind(this);

        this.playerVelocity = new THREE.Vector3();
        this.jumpCooldown = 200;
        this.nextJumpTime = 0;
    }

    init() {
        this.canvasElement.tabIndex = 0;
        this.canvasElement.focus();

        this.canvasElement.addEventListener('click', () => {
            if (this.isEnabled) { // Only request pointer lock if controls are enabled
                this.canvasElement.requestPointerLock();
                this.canvasElement.focus();
            }
        });

        document.addEventListener('pointerlockchange', this._boundHandlePointerLockChange);
        document.addEventListener('mousemove', this._boundHandleMouseMove);
        document.addEventListener('mousedown', this._boundHandleMouseDown);
        document.addEventListener('keydown', this._boundHandleKeydown);
        document.addEventListener('keyup', this._boundHandleKeyup);
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[ClientPlayerControls] Controls ENABLED status set to: ${enabled}`); // Added log
        if (!enabled) {
            if (this.isLocked) {
                document.exitPointerLock(); // Exit pointer lock if controls are disabled
            }
            this.keyboard.clear();
            this.playerVelocity.set(0, 0, 0);
            this.mouseDelta = { x: 0, y: 0 };
        }
    }

    clearMouseDelta() {
        this.mouseDelta = { x: 0, y: 0 };
    }

    getKeyboardState() {
        const state = {};
        this.keyboard.forEach((value, key) => {
            state[key] = value;
        });
        return state;
    }

    _handlePointerLockChange() {
        this.isLocked = document.pointerLockElement === this.canvasElement;
        console.log(`[ClientPlayerControls] Pointer Lock status changed to: ${this.isLocked}`); // Added log
        if (!this.isEnabled && this.isLocked) {
             document.exitPointerLock();
        }
    }

    _handleMouseMove(event) {
        if (!this.isEnabled || !this.isLocked) return;

        this.mouseDelta.x += event.movementX;
        this.mouseDelta.y += event.movementY;

        this._playerEntity.playerGroup.rotation.y -= event.movementX * MOUSE_SENSITIVITY;
        this._playerEntity.camera.rotation.x -= event.movementY * MOUSE_SENSITIVITY;
        this._playerEntity.camera.rotation.x = Math.max(-PI_2, Math.min(Math.PI / 2, this._playerEntity.camera.rotation.x));
    }

    _handleMouseDown(event) {
        if (!this.isEnabled || (event.button === 0 && !this.isLocked)) return;

        if (this._playerEntity.role === PlayerRoles.SEEKER && this._playerEntity.seekerActions) {
            this._playerEntity.seekerActions.swingBat();
        } else if (this._playerEntity.role === PlayerRoles.HIDER && this._playerEntity.hiderActions) {
            this._playerEntity.hiderActions.attemptMorph();
        }
    }

    _handleKeydown(event) {
        if (!this.isEnabled) return;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
            this.keyboard.set(event.code, true);
        }
    }

    _handleKeyup(event) {
        if (!this.isEnabled) return;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
            this.keyboard.set(event.code, false);
        }
    }

    update(deltaTime) {
        if (!this.isEnabled) return; // Only process movement if controls are enabled

        this.updateMovement(deltaTime);
        this.updatePhysics(deltaTime);
    }

    updateMovement(deltaTime) {
        this.playerVelocity.x = 0;
        this.playerVelocity.z = 0;

        this._playerEntity.playerGroup.getWorldDirection(this._direction);
        this._direction.y = 0;
        this._direction.normalize();

        const forward = this._direction.clone();
        const right = new THREE.Vector3().crossVectors(this._playerEntity.playerGroup.up, forward);

        let currentSpeed = PLAYER_SPEED * deltaTime * 60;

        if (this.keyboard.get('KeyW')) { this.playerVelocity.x -= forward.x * currentSpeed; this.playerVelocity.z -= forward.z * currentSpeed; }
        if (this.keyboard.get('KeyS')) { this.playerVelocity.x += forward.x * currentSpeed; this.playerVelocity.z += forward.z * currentSpeed; }
        if (this.keyboard.get('KeyA')) { this.playerVelocity.x -= right.x * currentSpeed; this.playerVelocity.z -= right.z * currentSpeed; }
        if (this.keyboard.get('KeyD')) { this.playerVelocity.x += right.x * currentSpeed; this.playerVelocity.z += right.z * currentSpeed; }

        this._playerEntity.playerGroup.position.x += this.playerVelocity.x;
        this._playerEntity.playerGroup.position.z += this.playerVelocity.z;

        this._playerEntity.playerGroup.position.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this._playerEntity.playerGroup.position.x));
        this._playerEntity.playerGroup.position.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this._playerEntity.playerGroup.position.z));
    }

    updatePhysics(deltaTime) {
        this.playerVelocity.y += GRAVITY * deltaTime;
        this._playerEntity.playerGroup.position.y += this.playerVelocity.y;

        const currentGroundLevel = PLAYER_HEIGHT_OFFSET;

        if (this._playerEntity.playerGroup.position.y <= currentGroundLevel) {
            this._playerEntity.playerGroup.position.y = currentGroundLevel;
            this.playerVelocity.y = 0;

            const currentTime = performance.now();
            if (this.keyboard.get('Space') && currentTime >= this.nextJumpTime) {
                this.playerVelocity.y = JUMP_FORCE;
                this.nextJumpTime = currentTime + this.jumpCooldown;
            }
        }
    }

    dispose() {
        console.log(`[ClientPlayerControls] Disposing controls for player ${this._playerEntity.id}`);
        document.removeEventListener('pointerlockchange', this._boundHandlePointerLockChange);
        document.removeEventListener('mousemove', this._boundHandleMouseMove);
        document.removeEventListener('mousedown', this._boundHandleMouseDown);
        document.removeEventListener('keydown', this._boundHandleKeydown);
        document.removeEventListener('keyup', this._boundHandleKeyup);
    }
}