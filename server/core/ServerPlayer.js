// PropHunt/server/core/ServerPlayer.js

import { PLAYER_HEIGHT_OFFSET, WORLD_BOUNDARY, SERVER_GRAVITY, SERVER_JUMP_FORCE, SERVER_PLAYER_SPEED, SERVER_MOUSE_SENSITIVITY, SERVER_TICK_RATE_MS } from '../config/ServerConfig.js';

export class ServerPlayer {
    constructor(playerId, initialPosition = { x: 0, y: PLAYER_HEIGHT_OFFSET, z: 0 }, initialRotation = { x: 0, y: 0 }) {
        this.playerId = playerId;
        this.position = { x: initialPosition.x, y: initialPosition.y, z: initialPosition.z };
        this.rotation = { x: initialRotation.x, y: initialRotation.y }; // pitch and yaw
        this.velocityY = 0; // Vertical velocity
        this.isOnGround = false; // Physics state: is player on ground
        this.health = 100;
        this.role = null;
        this.morphedInto = null;

        this.input = {
            keyboard: new Map(), // Holds current pressed state of keys (e.g., 'KeyW': true)
            mouseDelta: { x: 0, y: 0 }, // Accumulated mouse delta for *this player* for *this server tick*
        };
    }

    /**
     * Applies physics and movement to the player based on their *internal* input state.
     * This method is called repeatedly by ServerGameManager's physics loop.
     * @param {number} deltaTimeMs Delta time in milliseconds (since last server tick).
     */
    updatePhysics(deltaTimeMs) {
        // Normalize deltaTime to a per-second factor for consistent physics calculations
        const deltaFactor = deltaTimeMs / SERVER_TICK_RATE_MS; // How many ticks this deltaTime represents relative to base tick rate

        // --- Vertical Physics (Gravity & Jump) ---
        // Apply gravity continuously
        this.velocityY += SERVER_GRAVITY * deltaFactor; // Scale gravity by delta factor
        this.position.y += this.velocityY;

        // Ground collision: stop falling if below ground or slightly below
        if (this.position.y <= PLAYER_HEIGHT_OFFSET) { // Use <= for robustness
            this.position.y = PLAYER_HEIGHT_OFFSET;
            this.velocityY = 0; // Crucial: Reset vertical velocity to stop falling/ascending
            this.isOnGround = true;
        } else {
            this.isOnGround = false; // Only airborne if strictly above ground
        }

        // Handle Jump Input
        // Consume the jump input immediately after applying the jump force
        // Check this.input.keyboard.get('Space') instead of this.input.jumpRequested
        if (this.input.keyboard.get('Space') && this.isOnGround) {
            this.velocityY = SERVER_JUMP_FORCE; // Apply upward force
            this.isOnGround = false; // Player is now airborne
            this.input.keyboard.set('Space', false); // Consume the jump input so it doesn't re-trigger
        }

        // --- Horizontal Movement ---
        const moveDistance = SERVER_PLAYER_SPEED * deltaFactor; // Consistent distance per tick, scaled by deltaFactor

        const forwardX = -Math.sin(this.rotation.y);
        const forwardZ = -Math.cos(this.rotation.y);
        const rightX = Math.cos(this.rotation.y);
        const rightZ = -Math.sin(this.rotation.y);

        // Check if movement key is actively pressed (value is true)
        if (this.input.keyboard.get('KeyW')) {
            this.position.x += forwardX * moveDistance;
            this.position.z += forwardZ * moveDistance;
        }
        if (this.input.keyboard.get('KeyS')) {
            this.position.x -= forwardX * moveDistance;
            this.position.z -= forwardZ * moveDistance;
        }
        if (this.input.keyboard.get('KeyA')) {
            this.position.x += rightX * moveDistance;
            this.position.z += rightZ * moveDistance;
        }
        if (this.input.keyboard.get('KeyD')) {
            this.position.x -= rightX * moveDistance;
            this.position.z -= rightZ * moveDistance;
        }

        // --- Rotation (Mouse Look) ---
        // Apply accumulated mouse deltas then clear
        this.rotation.y += this.input.mouseDelta.x * SERVER_MOUSE_SENSITIVITY; // Yaw (left/right)
        this.rotation.x += this.input.mouseDelta.y * SERVER_MOUSE_SENSITIVITY; // Pitch (up/down)
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x)); // Clamp pitch

        // --- Clamp to World Boundaries ---
        this.position.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.position.x));
        this.position.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.position.z));

        // --- Input Consumption for this Tick ---
        // Reset mouseDelta after it has been used for rotation in this tick
        this.input.mouseDelta = {x:0, y:0};
        // Keyboard state (Map) is overwritten by ServerGameManager based on client input,
        // so individual key 'false' states are propagated there.
        // Only 'Space' is explicitly consumed here to prevent rapid re-jumps.
    }
}