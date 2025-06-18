// /client/js/components/ClientGameProps.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

/**
 * Creates a Three.js mesh based on a prop definition from the shared config.
 * @param {object} propDefinition - The prop definition object from SharedPropsConfig.js.
 * @returns {THREE.Mesh|null} A new Three.js mesh or null if the geometry type is unknown.
 */
export function createPropMesh(propDefinition) {
    if (!propDefinition) return null;

    let geometry;
    const geoDef = propDefinition.geometry;

    switch (geoDef.type) {
        case 'BoxGeometry':
            geometry = new THREE.BoxGeometry(geoDef.width, geoDef.height, geoDef.depth);
            break;
        case 'CylinderGeometry':
            geometry = new THREE.CylinderGeometry(geoDef.radiusTop, geoDef.radiusBottom, geoDef.height, geoDef.radialSegments);
            break;
        case 'SphereGeometry':
            geometry = new THREE.SphereGeometry(geoDef.radius, geoDef.widthSegments, geoDef.heightSegments);
            break;
        default:
            console.error(`Unknown geometry type: ${geoDef.type}`);
            return null;
    }

    const material = new THREE.MeshLambertMaterial({ color: propDefinition.material.color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Attach the prop's unique ID to the mesh's user data for easy identification
    mesh.userData.propTypeId = propDefinition.id;

    return mesh;
}
