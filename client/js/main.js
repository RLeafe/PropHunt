// /client/js/main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { ClientGameManager } from './core/ClientGameManager.js';
import { NetworkClient } from './core/NetworkClient.js';
import { ClientNetworkEventHandler } from './core/ClientNetworkEventHandler.js';
import { AlertMessage } from './components/ui/AlertMessage.js';
import { createEnvironment } from './scene/Environment.js';
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
const networkClient = new NetworkClient();
const networkHandler = new ClientNetworkEventHandler(gameManager, alertMessage);

gameManager.init(scene, renderer.domElement, networkClient);
networkClient.setOnMessageCallback(networkHandler.handle.bind(networkHandler));

createEnvironment(scene);

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
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
        const controls = gameManager.getControls();
        if (networkClient.isConnected && controls) {
            const inputPayload = controls.getNetworkUpdatePayload();
            networkClient.sendPlayerInput(inputPayload.keyboard, inputPayload.mouseDelta);
        }
    }, SERVER_TICK_RATE_MS);
}

const serverUrl = 'ws://192.168.1.109:5500';
networkClient.connect(serverUrl);
animate();
startNetworkUpdateLoop();

document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
        networkClient.sendTogglePauseRequest();
    }
});

document.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const localPlayer = gameManager.getLocalPlayer();
    if (!localPlayer || localPlayer.isFrozen) return;

    if (localPlayer.role === PlayerRoles.SEEKER) {
        localPlayer.seekerActions.swingBat();
    } else if (localPlayer.role === PlayerRoles.HIDER) {
        localPlayer.hiderActions.attemptMorph();
    }
});