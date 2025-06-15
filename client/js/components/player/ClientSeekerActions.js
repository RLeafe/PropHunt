// PropHunt/client/js/components/player/ClientSeekerActions.js
import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class ClientSeekerActions { // Renamed class
    constructor() {
        this.batMesh = null;
        this.scene = null;
        this.playerCamera = null;
        this.playerGroup = null; 
        this.playerBody = null; 
        this.morphableProps = null;
        this.networkClient = null; // Renamed networking to networkClient
        this.playerEntity = null; 
    }

    init(scene, playerCamera, playerGroup, playerBody, originalPlayerBodyGeometry, originalPlayerBodyMaterial, originalCameraRelativeY, morphableProps, networkClient, playerEntity) { // Renamed networking to networkClient
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.playerGroup = playerGroup; 
        this.playerBody = playerBody;
        this.morphableProps = morphableProps;
        this.networkClient = networkClient; // Store networkClient
        this.playerEntity = playerEntity; 

        const batGeometry = new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8);
        const batMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.batMesh = new THREE.Mesh(batGeometry, batMaterial);
        this.batMesh.position.set(0.7, -0.5, -0.8);
        this.batMesh.rotation.x = Math.PI * 0.4;
        this.batMesh.rotation.y = -Math.PI * 0.1;
        this.batMesh.rotation.z = Math.PI * 0.1;
        this.batMesh.visible = false;
        this.playerCamera.add(this.batMesh);
    }

    setVisible(visible) {
        if (this.batMesh) {
            this.batMesh.visible = visible;
        }
    }

    swingBat() {
        console.log('Seeker swings bat!');
        const initialRotationX = this.batMesh.rotation.x;
        const initialRotationY = this.batMesh.rotation.y;
        const initialRotationZ = this.batMesh.rotation.z;

        this.batMesh.rotation.set(
            initialRotationX,
            initialRotationY + Math.PI / 4,
            initialRotationZ
        );

        setTimeout(() => {
            this.batMesh.rotation.set(
                initialRotationX,
                initialRotationY,
                initialRotationZ
            );
        }, 150);

        // Send seeker swing action to server
        this.networkClient.sendSeekerSwing({ // Use networkClient
            position: this.playerGroup.position.clone() 
        });
        console.log('Seeker swing action sent to server.');
    }

    _checkSeekerHit() { /* ... */ }
}