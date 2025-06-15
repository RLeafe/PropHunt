// PropHunt/client/js/main.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

import { ClientGameManager } from './core/ClientGameManager.js';
import { NetworkClient } from './core/NetworkClient.js';
import { GAME_ASPECT } from './utils/ClientGameConfig.js';
import { PlayerRoles, GameStates } from './utils/GameEnums.js'; 
import { LevelBuilder } from './core/LevelBuilder.js';
import { ClientNetworkEventHandler } from './core/ClientNetworkEventHandler.js';
// CORRECTED IMPORT: Destructure individual exports (PropTypes, createPropMesh, getPropTypeDefinition)
import { PropTypes, createPropMesh, getPropTypeDefinition } from './components/ClientGameProps.js'; // <-- THIS IS THE CORRECT LINE
import { UIManager } from './components/ui/UIManager.js';


// --- Scene and Renderer Setup (Delegated to LevelBuilder) ---
const levelBuilder = new LevelBuilder();
const { scene, renderer, ground } = levelBuilder.buildScene(document.body);


// --- Game Assets (Placeholder Morphable Props) ---
const morphableProps = []; 

for (const key in PropTypes) { // Use PropTypes directly, not ClientGameProps.PropTypes
    const propDefinition = PropTypes[key];
    const mesh = createPropMesh(propDefinition); // Use createPropMesh directly
    if (mesh) {
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


clientGameManager.init(scene, renderer.domElement, GAME_ASPECT, morphableProps, networkClient); 
const clientNetworkEventHandler = new ClientNetworkEventHandler(clientGameManager, scene, morphableProps, uiManager); 


// Connect to your Node.js server
networkClient.connect('ws://localhost:3000');


// --- Networking Message Handling (Delegated to ClientNetworkEventHandler) ---
networkClient.setOnMessageCallback((message) => { 
    clientNetworkEventHandler.handleMessage(message); 
    if (message.type === 'connected') {
        clientGameManager.setLocalPlayerId(message.clientId);
    }
});


// --- Game Loop ---
let lastFrameTime = 0;
const SEND_INPUT_INTERVAL = 50; 
let lastSendInputTime = 0;
let isGamePaused = true; 


function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    if (!isGamePaused) { 
        clientGameManager.update(deltaTime); 
    }

    scene.updateMatrixWorld(true); 

    const localPlayerEntity = clientGameManager.getLocalPlayerEntity(); 
    if (localPlayerEntity && localPlayerEntity.getCamera()) {
        renderer.render(scene, localPlayerEntity.getCamera()); 
    } else {
        renderer.render(scene, new THREE.Camera()); 
    }

    if (!isGamePaused && networkClient.isConnected && localPlayerEntity && (currentTime - lastSendInputTime > SEND_INPUT_INTERVAL)) { 
        const playerControls = clientGameManager.playerControls; 

        if (playerControls && playerControls.isEnabled) { 
            networkClient.sendPlayerInput(
                playerControls.getKeyboardState(), 
                playerControls.mouseDelta 
            );
            playerControls.clearMouseDelta(); 
        }
        lastSendInputTime = currentTime; 
    }
}

export function setGamePauseState(paused, message = null) { 
    isGamePaused = paused;
    if (paused) {
        uiManager.displayMessage(message);
        if (clientGameManager.playerControls) { 
            clientGameManager.playerControls.setEnabled(false); 
        }
    } else {
        uiManager.hideMessage();
        if (clientGameManager.playerControls) { 
            clientGameManager.playerControls.setEnabled(true); 
        }
    }
}

// Start the game loop
animate(0);