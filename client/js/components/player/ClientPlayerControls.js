// PropHunt/client/js/components/player/ClientPlayerControls.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY, PLAYER_SPEED, MOUSE_SENSITIVITY, GRAVITY, JUMP_FORCE } from '../../utils/ClientGameConfig.js'; 
import { PlayerRoles } from '../../utils/GameEnums.js'; 

const PI_2 = Math.PI / 2;

export class ClientPlayerControls { 
    constructor(playerEntity, networkClient) { 
        this._playerEntity = playerEntity;
        this._networkClient = networkClient; // Store NetworkClient to send input

        this.keyboard = new Map(); // Stores current state of relevant keys (true/false)
        this.mouseDelta = { x: 0, y: 0 }; // Accumulates mouse movement since last send
        this.isLocked = false; // Pointer lock status
        this.isEnabled = true; // Overall controls enabled/disabled state

        this._direction = new THREE.Vector3(); 
        
        this._boundHandlePointerLockChange = this._handlePointerLockChange.bind(this);
        this._boundHandleMouseMove = this._handleMouseMove.bind(this);
        this._boundHandleMouseDown = this._handleMouseDown.bind(this);
        this._boundHandleKeydown = this._handleKeydown.bind(this);
        this._boundHandleKeyup = this._handleKeyup.bind(this);

        this.playerVelocity = new THREE.Vector3(); // For client-side prediction visual feedback
        this.jumpCooldown = 200; 
        this.nextJumpTime = 0; 

        this.canvasElement = null; 
    }

    init(canvasElement) {
        this.canvasElement = canvasElement; 
        canvasElement.tabIndex = 0; 
        canvasElement.focus();     

        canvasElement.addEventListener('click', () => {
            if (this.isEnabled) { 
                canvasElement.requestPointerLock();
                canvasElement.focus(); 
            }
        });

        document.addEventListener('pointerlockchange', this._boundHandlePointerLockChange);
        document.addEventListener('mousemove', this._boundHandleMouseMove);
        document.addEventListener('mousedown', this._boundHandleMouseDown);
        document.addEventListener('keydown', this._boundHandleKeydown);
        document.addEventListener('keyup', this._handleKeyup);
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) { 
            if (this.isLocked) { 
                document.exitPointerLock();
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
        if (!this.isEnabled && this.isLocked) { 
             document.exitPointerLock();
        }
    }

    _handleMouseMove(event) {
        if (!this.isEnabled || !this.isLocked) return; 

        this.mouseDelta.x += event.movementX;
        this.mouseDelta.y += event.movementY;

        // Apply rotation locally for immediate visual feedback (client-side prediction)
        this._playerEntity.playerGroup.rotation.y -= event.movementX * MOUSE_SENSITIVITY; 
        this._playerEntity.camera.rotation.x -= event.movementY * MOUSE_SENSITIVITY;      
        this._playerEntity.camera.rotation.x = Math.max(-PI_2, Math.min(PI_2, this._playerEntity.camera.rotation.x));
    }

    _handleMouseDown(event) {
        if (!this.isEnabled || (event.button === 0 && !this.isLocked)) return; 

        if (this._playerEntity.role === PlayerRoles.SEEKER && this._playerEntity.seekerActions) { 
            this._playerEntity.seekerActions.swingBat();
        } else if (this._playerEntity.role === PlayerRoles.HIDER && this._playerEntity.hiderActions) { 
            const morphedTypeId = this._playerEntity.hiderActions.attemptMorph();
            if (morphedTypeId) {
                this._playerEntity.morphedIntoPropTypeId = morphedTypeId; 
            } else {
                this._playerEntity.morphedIntoPropTypeId = null; 
            }
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

    /**
     * Client-side prediction update. This moves the local player visually immediately.
     * @param {number} deltaTime Time since last frame.
     */
    update(deltaTime) {
        if (!this.isEnabled || !this.isLocked) return; 

        this.updateMovement(deltaTime);
        this.updatePhysics(deltaTime);
    }

    updateMovement(deltaTime) {
        this.playerVelocity.x = 0; 
        this.playerVelocity.z = 0; 

        this._playerEntity.playerGroup.getWorldDirection(this._direction); 
        const forward = this._direction.clone();
        const right = new THREE.Vector3().crossVectors(this._playerEntity.playerGroup.up, forward);

        let currentSpeed = PLAYER_SPEED * deltaTime * 50; // Apply client-side speed

        if (this.keyboard.get('KeyW')) { this.playerVelocity.x -= forward.x * currentSpeed; this.playerVelocity.z -= forward.z * currentSpeed; }
        if (this.keyboard.get('KeyS')) { this.playerVelocity.x += forward.x * currentSpeed; this.playerVelocity.z += forward.z * currentSpeed; }
        if (this.keyboard.get('KeyA')) { this.playerVelocity.x -= right.x * currentSpeed; this.playerVelocity.z -= right.z * currentSpeed; }
        if (this.keyboard.get('KeyD')) { this.playerVelocity.x += right.x * currentSpeed; this.playerVelocity.z += right.z * currentSpeed; }

        this._playerEntity.playerGroup.position.x += this.playerVelocity.x; 
        this._playerEntity.playerGroup.position.z += this.playerVelocity.z; 

        // Boundary checks (client-side)
        this._playerEntity.playerGroup.position.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this._playerEntity.playerGroup.position.x));
        this._playerEntity.playerGroup.position.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this._playerEntity.playerGroup.position.z));
    }

    updatePhysics(deltaTime) {
        this.playerVelocity.y += GRAVITY * deltaTime; // Apply client-side gravity
        this._playerEntity.playerGroup.position.y += this.playerVelocity.y; 

        const currentGroundLevel = PLAYER_HEIGHT_OFFSET * this._playerEntity.playerGroup.scale.y; 

        if (this._playerEntity.playerGroup.position.y < currentGroundLevel) { 
            this._playerEntity.playerGroup.position.y = currentGroundLevel; 
            this.playerVelocity.y = 0; // Stop vertical movement on ground

            const currentTime = performance.now();
            if (this.keyboard.get('Space') && currentTime >= this.nextJumpTime) { 
                this.playerVelocity.y = JUMP_FORCE; // Apply client-side jump force
                this.nextJumpTime = currentTime + this.jumpCooldown; 
            }
        }
    }
}