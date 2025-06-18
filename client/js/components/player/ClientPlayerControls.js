// /client/js/components/player/ClientPlayerControls.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import * as Config from '../../utils/ClientGameConfig.js';

const PI_2 = Math.PI / 2;

export class ClientPlayerControls {
    constructor(playerEntity, canvasElement) {
        this.player = playerEntity;
        this.canvas = canvasElement;
        this.keyboard = new Map();
        this.mouseDelta = { x: 0, y: 0 };
        this.isMovementFrozen = true; 
        this.isPointerLocked = false;
        
        this.velocity = new THREE.Vector3();
        this.isOnGround = true;

        this.onPointerLockChange = () => { this.isPointerLocked = document.pointerLockElement === this.canvas; };
        this.onMouseMove = (e) => {
            if (this.isMovementFrozen || !this.isPointerLocked) return;
            this.mouseDelta.x += e.movementX;
            this.mouseDelta.y += e.movementY;
        };
        this.onKeyDown = (e) => { this.keyboard.set(e.code, true); };
        this.onKeyUp = (e) => { this.keyboard.set(e.code, false); };
        this.onClick = () => { 
            if (!this.isMovementFrozen && !this.isPointerLocked) {
                this.canvas.requestPointerLock();
            }
        };
    }

    init() {
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        this.canvas.addEventListener('click', this.onClick);
    }

    setMovementFreeze(frozen) { 
        this.isMovementFrozen = frozen; 
        
        if (this.isMovementFrozen) {
            this.keyboard.clear();
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.mouseDelta = { x: 0, y: 0 };
            
            if (this.isPointerLocked) {
                document.exitPointerLock();
            }
        }
    }
    
    getNetworkUpdatePayload() {
        const keyboardPayload = !this.isMovementFrozen ? Object.fromEntries(this.keyboard) : {};
        const mousePayload = (!this.isMovementFrozen && this.isPointerLocked) ? { ...this.mouseDelta } : { x: 0, y: 0 };
        
        const payload = { keyboard: keyboardPayload, mouseDelta: mousePayload };
        this.mouseDelta = { x: 0, y: 0 };
        return payload;
    }

    update(deltaTime) {
        if (!this.isMovementFrozen) {
            this.player.playerGroup.rotation.y -= this.mouseDelta.x * Config.MOUSE_SENSITIVITY;
            this.player.camera.rotation.x -= this.mouseDelta.y * Config.MOUSE_SENSITIVITY;
            this.player.camera.rotation.x = Math.max(-PI_2, Math.min(PI_2, this.player.camera.rotation.x));
        
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.playerGroup.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.player.playerGroup.quaternion);
            
            let moveX = 0;
            let moveZ = 0;
            if (this.keyboard.get('KeyW')) { moveZ = 1; }
            if (this.keyboard.get('KeyS')) { moveZ = -1; }
            if (this.keyboard.get('KeyA')) { moveX = -1; }
            if (this.keyboard.get('KeyD')) { moveX = 1; }

            const moveDirection = new THREE.Vector3(moveX, 0, moveZ).normalize();
            const finalMove = new THREE.Vector3()
                .addScaledVector(right, moveDirection.x)
                .addScaledVector(forward, moveDirection.z)
                .normalize()
                .multiplyScalar(Config.PLAYER_SPEED);
                
            this.velocity.x = finalMove.x;
            this.velocity.z = finalMove.z;

            if (this.keyboard.get('Space') && this.isOnGround) {
                this.velocity.y = Config.JUMP_FORCE;
            }
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        this.velocity.y += Config.GRAVITY * deltaTime;
        
        this.player.playerGroup.position.x += this.velocity.x * deltaTime;
        this.player.playerGroup.position.y += this.velocity.y * deltaTime;
        this.player.playerGroup.position.z += this.velocity.z * deltaTime;

        if (this.player.playerGroup.position.y <= Config.PLAYER_HEIGHT_OFFSET) {
            this.player.playerGroup.position.y = Config.PLAYER_HEIGHT_OFFSET;
            this.velocity.y = 0;
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }
    }

    dispose() {
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.canvas.removeEventListener('click', this.onClick);
    }
}