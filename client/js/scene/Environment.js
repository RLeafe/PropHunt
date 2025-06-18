// /client/js/scene/Environment.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { PropTypes } from '../../shared/props/SharedPropsConfig.js';
import { createPropMesh } from '../components/ClientGameProps.js';

/**
 * Populates the given scene with basic environment elements.
 * @param {THREE.Scene} scene The Three.js scene to populate.
 */
export function createEnvironment(scene) {
    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- Ground ---
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Static Props ---
    Object.values(PropTypes).forEach((propDef, index) => {
        const propMesh = createPropMesh(propDef);
        if (propMesh) {
            propMesh.position.set((index - 1) * 4, propDef.defaultOffset.y, -5);
            propMesh.castShadow = true;
            scene.add(propMesh);
        }
    });
}
