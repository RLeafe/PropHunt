// PropHunt/client/js/main.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

import { ClientGameManager } from './core/ClientGameManager.js';
import { NetworkClient } from './core/NetworkClient.js';
import { GAME_ASPECT } from './utils/ClientGameConfig.js';
import { PlayerRoles, GameStates } from './utils/GameEnums.js';
import { LevelBuilder } from './core/LevelBuilder.js';
import { ClientNetworkEventHandler } from './core/ClientNetworkEventHandler.js';
import { PropTypes, createPropMesh, getPropTypeDefinition } from './components/ClientGameProps.js';
import { UIManager } from './components/ui/UIManager.js';

// --- Scene and Renderer Setup ---
const levelBuilder = new LevelBuilder();
const { scene, renderer, ground } = levelBuilder.buildScene(document.body);

// --- Game Assets (Placeholder Morphable Props) ---
const morphableProps = [];
for (const key in PropTypes) {
    const propDefinition = PropTypes[key];
    const mesh = createPropMesh(propDefinition);
    if (mesh) {
        // Place props at predefined locations
        if (propDefinition.id === PropTypes.YELLOW_BOX.id) {
            mesh.position.set(2, propDefinition.defaultOffset.y, -2);
        } else if (propDefinition.id === PropTypes.MAGENTA_CYLINDER.id) {
            mesh.position.set(-3, propDefinition.defaultOffset.y, 3);
        } else if (propDefinition.id === PropTypes.CYAN_SPHERE.id) {
            mesh.position.set(0, propDefinition.defaultOffset.y, -5);
        }
        mesh.userData.propTypeId = propDefinition.id;
        scene.add(mesh);
        morphableProps.push(mesh);
    }
}

// --- Instantiate Managers ---
const clientGameManager = new ClientGameManager();
const networkClient = new NetworkClient();
const uiManager = new UIManager();

// Initialize ClientGameManager with necessary Three.js components and other managers
clientGameManager.init(scene, renderer.domElement, GAME_ASPECT, morphableProps, networkClient);
const clientNetworkEventHandler = new ClientNetworkEventHandler(clientGameManager, scene, morphableProps, uiManager);

// Connect to your Node.js server
networkClient.connect('ws://localhost:3000');

// --- Networking Message Handling ---
networkClient.setOnMessageCallback((message) => {
    clientNetworkEventHandler.handleMessage(message);
});

// --- Game Loop using THREE.Clock ---
const clock = new THREE.Clock();
const SEND_INPUT_INTERVAL_MS = 50;
let lastSendInputTime = 0;

let isClientGamePaused = true; // Overall game logic pause state

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    const localPlayerEntity = clientGameManager.getLocalPlayerEntity();

    // Update client-side predicted movement for the local player only if controls are enabled
    if (localPlayerEntity && clientGameManager.playerControls) {
        clientGameManager.playerControls.update(deltaTime); // Controls' own isEnabled check will gate input processing
    }

    // Render the scene using the local player's camera
    if (localPlayerEntity && localPlayerEntity.getCamera()) {
        renderer.render(scene, localPlayerEntity.getCamera());
    } else {
        // Fallback for error state if local player camera isn't ready
        //console.warn('[main.js] Local player entity or camera is NULL after connection. Rendering with default camera.');
        const defaultCamera = new THREE.Camera();
        defaultCamera.position.set(0, 10, 10);
        defaultCamera.lookAt(0,0,0);
        renderer.render(scene, defaultCamera);
    }

    // Send player input to the server at a fixed interval
    const currentTime = clock.getElapsedTime() * 1000;
    if (networkClient.isConnected && localPlayerEntity && (currentTime - lastSendInputTime > SEND_INPUT_INTERVAL_MS)) {
        const playerControls = clientGameManager.playerControls;
        if (playerControls && playerControls.isEnabled) { // Ensure controls are enabled before sending input
            networkClient.sendPlayerInput(
                playerControls.getKeyboardState(),
                playerControls.mouseDelta
            );
            playerControls.clearMouseDelta();
        }
        lastSendInputTime = currentTime;
    }
}

/**
 * Public function to control the client's game pause state, called by ClientNetworkEventHandler.
 * This sets the overall 'isClientGamePaused' and controls player input.
 * @param {boolean} paused True to pause the client game, false to unpause.
 * @param {string} [message=null] Optional message to display when paused.
 */
export function setClientGamePauseState(paused, message = null) {
    isClientGamePaused = paused; // This controls game logic processing, not directly player movement anymore
    console.log(`[main.js] setClientGamePauseState called: paused=${paused}, message="${message}"`);

    if (paused) {
        uiManager.displayMessage(message);
        if (clientGameManager.playerControls) {
            // If the game state is LOBBY, controls should always be ENABLED for roaming.
            // Otherwise, disable for actual pauses (seeker, game end).
            if (clientGameManager.currentClientGameState === GameStates.LOBBY) {
                clientGameManager.playerControls.setEnabled(true); // Allow movement in lobby
                console.log(`[main.js] Controls set to ENABLED (Lobby state).`);
            } else {
                clientGameManager.playerControls.setEnabled(false); // Disable for seeker pause, game over, etc.
                console.log(`[main.js] Controls set to DISABLED (Non-lobby paused state).`);
            }
        } else {
            console.warn(`[main.js] playerControls is NULL when setClientGamePauseState(paused=${paused}) was called.`);
        }
    } else { // Game is unpaused
        uiManager.hideMessage();
        if (clientGameManager.playerControls && clientGameManager.getLocalPlayerEntity()) { // Check if local player entity exists
             clientGameManager.playerControls.setEnabled(true); // Enable controls when game unpauses
             console.log(`[main.js] Controls set to ENABLED (Game unpaused).`);
        } else {
            console.warn(`[main.js] playerControls or localPlayerEntity is NULL when setClientGamePauseState(paused=${paused}) was called.`);
        }
    }
}

// Start the game loop
animate();