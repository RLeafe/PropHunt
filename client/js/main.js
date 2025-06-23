// /client/js/main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { ClientGameManager } from './core/ClientGameManager.js';
import { ClientNetworkBroadcaster } from './core/ClientNetworkBroadcaster.js';
import { ClientNetworkEventHandler } from './core/ClientNetworkEventHandler.js';
import { AlertMessage } from './components/ui/AlertMessage.js';
import { createEnvironment } from './scene/Environment.js';
import { createMorphableProps } from './scene/MorphableProps.js';
import { SERVER_TICK_RATE_MS } from './utils/ClientGameConfig.js';
import { PlayerRoles } from '../shared/utils/GameEnums.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const gameContainer = document.getElementById('game-container');
gameContainer.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const mainCamera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.1, 1000);

const alertMessage = new AlertMessage(gameContainer);
const gameManager = new ClientGameManager();
const broadcaster = new ClientNetworkBroadcaster();
const networkHandler = new ClientNetworkEventHandler(gameManager, alertMessage);

gameManager.init(scene, renderer.domElement, broadcaster, gameContainer);
broadcaster.setOnMessageCallback(networkHandler.handle.bind(networkHandler));

createEnvironment(scene);
createMorphableProps(scene);

const lastSentInput = {
    keyboard: {},
    mouseDelta: { x: 0, y: 0 }
};

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    const controls = gameManager.getControls();
    if (broadcaster.isConnected && controls) {
        const inputPayload = controls.getNetworkUpdatePayload();
        lastSentInput.keyboard = inputPayload.keyboard;
        lastSentInput.mouseDelta.x += inputPayload.mouseDelta.x;
        lastSentInput.mouseDelta.y += inputPayload.mouseDelta.y;
    }

    gameManager.update(deltaTime);

    const localPlayer = gameManager.getLocalPlayer();
    const cameraToRender = localPlayer?.camera || mainCamera;

    const canvas = renderer.domElement;
    const needResize = canvas.width !== gameContainer.clientWidth || canvas.height !== gameContainer.clientHeight;
    if (needResize) {
        renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight, false);
        cameraToRender.aspect = gameContainer.clientWidth / gameContainer.clientHeight;
        cameraToRender.updateProjectionMatrix();
    }

    renderer.render(scene, cameraToRender);
}

function startNetworkUpdateLoop() {
    setInterval(() => {
        if (broadcaster.isConnected) {
            broadcaster.sendPlayerInput(lastSentInput.keyboard, lastSentInput.mouseDelta);
            lastSentInput.mouseDelta = { x: 0, y: 0 };
        }
    }, SERVER_TICK_RATE_MS);
}

const serverUrl = 'ws://localhost:5500';
broadcaster.connect(serverUrl);
animate();
startNetworkUpdateLoop();

document.addEventListener('keydown', (event) => {
    if (event.code === 'F1') {
        event.preventDefault(); 
        const settingsMenu = gameManager.getSettingsMenu();
        if (settingsMenu) {
            const isMenuNowVisible = settingsMenu.toggle();
            const controls = gameManager.getControls();
            if (controls) {
                controls.setMenuFreeze(isMenuNowVisible);
            }
        }
    }
});

document.addEventListener('mousedown', (event) => {
    const localPlayer = gameManager.getLocalPlayer();
    if (!localPlayer || localPlayer.isFrozen) return;
    const controls = gameManager.getControls();

    if (event.button === 0) {
        if (localPlayer.role === PlayerRoles.SEEKER) {
            localPlayer.seekerActions.swingBat();
        } else if (localPlayer.role === PlayerRoles.HIDER) {
            localPlayer.hiderActions.attemptMorph();
        }
    } else if (event.button === 2) {
        if (localPlayer.role === PlayerRoles.HIDER && controls) {
            event.preventDefault();
            controls.startFreeLook();
        }
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
        const localPlayer = gameManager.getLocalPlayer();
        const controls = gameManager.getControls();
        if (localPlayer?.role === PlayerRoles.HIDER && controls) {
            controls.stopFreeLook();
        }
    }
});