// PropHunt/client/js/components/player/ClientSeekerActions.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class ClientSeekerActions {
    constructor() {
        this.batMesh = null;
        this.scene = null;
        this.playerCamera = null;
        this.playerGroup = null;
        this.playerBody = null;
        this.morphableProps = null;
        this.networkClient = null;
        this.playerEntity = null;

        this.isSwinging = false; // Prevents multiple swings too fast
        this.swingCooldown = 300; // Milliseconds between swings
        this.nextSwingTime = 0;
    }

    init(scene, playerCamera, playerGroup, playerBody, originalPlayerBodyGeometry, originalPlayerBodyMaterial, originalCameraRelativeY, morphableProps, networkClient, playerEntity) {
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.playerGroup = playerGroup;
        this.playerBody = playerBody;
        this.morphableProps = morphableProps;
        this.networkClient = networkClient;
        this.playerEntity = playerEntity;

        const batGeometry = new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8);
        const batMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.batMesh = new THREE.Mesh(batGeometry, batMaterial);
        this.batMesh.position.set(0.7, -0.5, -0.8);
        this.batMesh.rotation.x = Math.PI * 0.4;
        this.batMesh.rotation.y = -Math.PI * 0.1;
        this.batMesh.rotation.z = Math.PI * 0.1;
        this.batMesh.visible = false; // Initially hidden
        this.playerCamera.add(this.batMesh);
    }

    setVisible(visible) {
        if (this.batMesh) {
            this.batMesh.visible = visible;
        }
    }

    swingBat() {
        const currentTime = performance.now();
        if (this.isSwinging || currentTime < this.nextSwingTime) {
            // console.log("Cannot swing yet (cooldown or already swinging).");
            return; // Prevent rapid-fire swings
        }

        console.log('Seeker swings bat!');
        this.isSwinging = true;
        this.nextSwingTime = currentTime + this.swingCooldown; // Set cooldown

        const initialRotationX = this.batMesh.rotation.x;
        const initialRotationY = this.batMesh.rotation.y;
        const initialRotationZ = this.batMesh.rotation.z;

        // Simple swing animation (local prediction)
        this.batMesh.rotation.set(
            initialRotationX,
            initialRotationY + Math.PI / 4, // Swing outward
            initialRotationZ
        );

        setTimeout(() => {
            this.batMesh.rotation.set(
                initialRotationX,
                initialRotationY,
                initialRotationZ
            );
            this.isSwinging = false;
        }, 150); // Animation duration

        // Send seeker swing action to server
        this.networkClient.sendSeekerSwing({
            // The server handles the actual hit detection, so client only sends trigger
            // The position sent here is just for context/debugging if needed, server uses its own authoritative position
            position: this.playerGroup.position.clone() // This can be removed if server doesn't need client's position for this
        });
        console.log('Seeker swing action sent to server.');
    }
}