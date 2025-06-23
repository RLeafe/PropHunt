// /client/js/scene/MorphableProps.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { PropTypes } from '../../shared/props/SharedPropsConfig.js';
import { createPropMesh } from '../components/ClientGameProps.js';

/**
 * Creates and populates the scene with all the props that players can morph into.
 * This keeps all morphable prop logic separate from the static environment.
 * @param {THREE.Scene} scene The Three.js scene to add the props to.
 */
export function createMorphableProps(scene) {
    // Loop through the shared prop type definitions.
    Object.values(PropTypes).forEach((propDef, index) => {
        // Create a mesh for each prop
        const propMesh = createPropMesh(propDef);
        if (propMesh) {
            propMesh.position.set((index - 1) * 3, propDef.defaultOffset.y, -2);
            propMesh.castShadow = true;
            propMesh.receiveShadow = true;
            
            scene.add(propMesh);
        }
    });
}
