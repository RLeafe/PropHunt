// PropHunt/client/js/core/LevelBuilder.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER_HEIGHT_OFFSET } from '../utils/ClientGameConfig.js'; // Corrected import to destructure

export class LevelBuilder {
    constructor() {
        this.scene = null;
        this.renderer = null;
        this.ground = null;
    }

    buildScene(containerElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.renderer = new THREE.WebGLRenderer({ antialias: true }); 
        this.renderer.setSize(GAME_WIDTH, GAME_HEIGHT);
        containerElement.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); 
        directionalLight.position.set(5, 10, 7.5).normalize();
        this.scene.add(directionalLight);

        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.scene.add(this.ground);

        return { scene: this.scene, renderer: this.renderer, ground: this.ground };
    }
}