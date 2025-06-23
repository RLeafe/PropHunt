// /server/core/ServerPlayer.js
import * as Config from '../config/ServerConfig.js';

export class ServerPlayer {
    constructor(playerId, initialPosition = { x: 0, y: Config.PLAYER_HEIGHT_OFFSET, z: 0 }) {
        this.playerId = playerId;
        this.position = { ...initialPosition };
        this.rotation = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isOnGround = true;
        this.health = 100;
        this.role = null;
        this.morphedInto = null;
        this.isFrozen = false;
        
        this.spawnIndex = -1;

        this.input = {
            keyboard: new Map(),
            mouseDelta: { x: 0, y: 0 },
        };
    }

    updatePhysics(deltaTime) {
        if (!this.isFrozen) {
            this.rotation.y -= this.input.mouseDelta.x;
            this.rotation.x -= this.input.mouseDelta.y;

            // Clamp the vertical rotation (pitch) to prevent flipping upside down.
            this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));

            const forward = { x: Math.sin(this.rotation.y), z: Math.cos(this.rotation.y) };
            const right = { x: forward.z, z: -forward.x };

            let moveX = 0;
            let moveZ = 0;
            
            if (this.input.keyboard.get('KeyW')) { moveX -= forward.x; moveZ -= forward.z; }
            if (this.input.keyboard.get('KeyS')) { moveX += forward.x; moveZ += forward.z; }
            if (this.input.keyboard.get('KeyA')) { moveX -= right.x; moveZ -= right.z; }
            if (this.input.keyboard.get('KeyD')) { moveX += right.x; moveZ += right.z; }

            const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (moveMagnitude > 0) {
                this.velocity.x = (moveX / moveMagnitude) * Config.PLAYER_SPEED;
                this.velocity.z = (moveZ / moveMagnitude) * Config.PLAYER_SPEED;
            } else {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        if (this.isOnGround) {
            this.velocity.y = 0;
            if (!this.isFrozen && this.input.keyboard.get('Space')) {
                this.velocity.y = Config.JUMP_FORCE;
                this.isOnGround = false;
            }
        } else {
            this.velocity.y += Config.GRAVITY * deltaTime;
        }

        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;

        if (this.position.y <= Config.PLAYER_HEIGHT_OFFSET) {
            this.position.y = Config.PLAYER_HEIGHT_OFFSET;
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }

        this.position.x = Math.max(-Config.WORLD_BOUNDARY, Math.min(Config.WORLD_BOUNDARY, this.position.x));
        this.position.z = Math.max(-Config.WORLD_BOUNDARY, Math.min(Config.WORLD_BOUNDARY, this.position.z));
    }

    getState() {
        return {
            id: this.playerId,
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            rotation: { x: this.rotation.x, y: this.rotation.y },
            isFrozen: this.isFrozen,
            role: this.role,
            morphedInto: this.morphedInto,
            timestamp: Date.now()
        };
    }
}