// PropHunt/client/js/components/ClientGameProps.js
// This file defines the types of props that can be morphed into.
// It is used by the CLIENT.

import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
// Corrected path to SharedPropsConfig.js assuming it's located at client/js/utils/
import { PropTypes, getPropTypeDefinition } from '../utils/SharedPropsConfig.js'; // <-- CORRECTED PATH

// Re-export shared definitions for convenience
export { PropTypes, getPropTypeDefinition };

// Function to create a Three.js Mesh from a prop definition
export function createPropMesh(propDefinition) { 
    let geometry;
    switch (propDefinition.geometry.type) {
        case 'BoxGeometry':
            geometry = new THREE.BoxGeometry(propDefinition.geometry.width, propDefinition.geometry.height, propDefinition.geometry.depth);
            break;
        case 'CylinderGeometry':
            geometry = new THREE.CylinderGeometry(propDefinition.geometry.radiusTop, propDefinition.geometry.radiusBottom, propDefinition.geometry.height, propDefinition.geometry.radialSegments);
            break;
        case 'SphereGeometry':
            geometry = new THREE.SphereGeometry(propDefinition.geometry.radius, propDefinition.geometry.widthSegments, propDefinition.geometry.heightSegments);
            break;
        default:
            console.error(`Unknown geometry type: ${propDefinition.geometry.type}`);
            return null;
    }
    const material = new THREE.MeshLambertMaterial({ color: propDefinition.material.color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(propDefinition.defaultOffset.x, propDefinition.defaultOffset.y, propDefinition.defaultOffset.z);
    return mesh;
}