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
        
        this.isFreeLooking = false;
        
        this.sensitivityX = Config.MOUSE_SENSITIVITY;
        this.sensitivityY = Config.MOUSE_SENSITIVITY;
        this.isMenuOpen = false;

        this.onPointerLockChange = () => { this.isPointerLocked = document.pointerLockElement === this.canvas; };
        this.onMouseMove = (e) => {
            if (this.isMovementFrozen || !this.isPointerLocked || this.isMenuOpen) return;
            this.mouseDelta.x += e.movementX;
            this.mouseDelta.y += e.movementY;
        };
        this.onKeyDown = (e) => { this.keyboard.set(e.code, true); };
        this.onKeyUp = (e) => { this.keyboard.set(e.code, false); };
        this.onClick = () => {
            if (!this.isMovementFrozen && !this.isPointerLocked && !this.isMenuOpen) {
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
            if (this.isPointerLocked) {
                document.exitPointerLock();
            }
        }
    }

    setMenuFreeze(isMenuVisible) {
        this.isMenuOpen = isMenuVisible;
        if (this.isMenuOpen && this.isPointerLocked) {
            document.exitPointerLock();
        }
    }

    setSensitivityX(newSensitivity) {
        this.sensitivityX = newSensitivity;
    }

    setSensitivityY(newSensitivity) {
        this.sensitivityY = newSensitivity;
    }
    
    startFreeLook() {
        this.isFreeLooking = true;
    }

    stopFreeLook() {
        this.isFreeLooking = false;
    }
    
    getNetworkUpdatePayload() {
        const keyboardPayload = (!this.isMovementFrozen && !this.isMenuOpen) ? Object.fromEntries(this.keyboard) : {};
        
        const scaledMouseDelta = {
            x: this.mouseDelta.x * this.sensitivityX,
            y: this.mouseDelta.y * this.sensitivityY,
        };
        
        // Reset the raw delta after it has been read.
        this.mouseDelta = { x: 0, y: 0 };

        return {
            keyboard: keyboardPayload,
            mouseDelta: scaledMouseDelta
        };
    }

    update(deltaTime) {

    }

    dispose() {
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        this.canvas.addEventListener('click', this.onClick);
    }
}