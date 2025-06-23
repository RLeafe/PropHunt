// /client/js/components/player/ClientSeekerActions.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

export class ClientSeekerActions {
    constructor(camera, broadcaster) {
        this.camera = camera;
        this.broadcaster = broadcaster;
        this.isSwinging = false;
        this.swingCooldown = 500; // Cooldown in milliseconds

        // Create the bat model and attach it to the camera
        const batGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8);
        const batMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.batMesh = new THREE.Mesh(batGeometry, batMaterial);
        this.batMesh.position.set(0.5, -0.4, -0.7);
        this.batMesh.rotation.set(Math.PI * 0.1, -Math.PI * 0.1, Math.PI * 0.4);
        this.batMesh.visible = false; // Initially hidden
        this.camera.add(this.batMesh);
    }

    /**
     * Shows or hides the seeker's bat.
     * @param {boolean} visible - True to show, false to hide.
     */
    setVisible(visible) {
        if (this.batMesh) {
            this.batMesh.visible = visible;
        }
    }

    /**
     * Performs a client-side swing animation and sends the swing action to the server.
     */
    swingBat() {
        if (this.isSwinging) return;
        this.isSwinging = true;

        const initialRot = this.batMesh.rotation.clone();
        this.batMesh.rotation.z += Math.PI / 2;
        
        setTimeout(() => {
            this.batMesh.rotation.copy(initialRot);
        }, 200);

        setTimeout(() => {
            this.isSwinging = false;
        }, this.swingCooldown);

        this.broadcaster.sendSeekerSwing();
    }
    
    dispose() {
        if (this.batMesh) {
            this.camera.remove(this.batMesh);
            this.batMesh.geometry.dispose();
            this.batMesh.material.dispose();
        }
    }
}