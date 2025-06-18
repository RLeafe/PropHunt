// /client/shared/props/SharedPropsConfig.js

export const PropTypes = {
    YELLOW_BOX: {
        id: 'yellowBox',
        name: 'Yellow Box',
        geometry: { type: 'BoxGeometry', width: 0.8, height: 0.8, depth: 0.8 },
        material: { color: 0xFFFF00 },
        defaultOffset: { x: 0, y: 0.4, z: 0 }
    },
    MAGENTA_CYLINDER: {
        id: 'magentaCylinder',
        name: 'Magenta Cylinder',
        geometry: { type: 'CylinderGeometry', radiusTop: 0.5, radiusBottom: 0.5, height: 1.5, radialSegments: 16 },
        material: { color: 0xFF00FF },
        defaultOffset: { x: 0, y: 0.75, z: 0 }
    },
    CYAN_SPHERE: {
        id: 'cyanSphere',
        name: 'Cyan Sphere',
        geometry: { type: 'SphereGeometry', radius: 0.6, widthSegments: 32, heightSegments: 16 },
        material: { color: 0x00FFFF },
        defaultOffset: { x: 0, y: 0.6, z: 0 }
    }
};

export function getPropTypeDefinition(propTypeId) {
    for (const key in PropTypes) {
        if (PropTypes[key].id === propTypeId) {
            return PropTypes[key];
        }
    }
    return null;
}
