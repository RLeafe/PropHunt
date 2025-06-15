// PropHunt/client/js/components/ui/UIManager.js

// No Three.js imports needed here anymore for message box
// import { CSS3DRenderer, CSS3DObject } from 'https://unpkg.com/three@0.165.0/examples/jsm/renderers/CSS3DRenderer.js';
// import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class UIManager {
    constructor() { // No gameContainerElement needed
        this.messageBox = document.getElementById('message-box');
        this.messageText = document.getElementById('message-text');
        
        this.currentTimeout = null;

        this.hitFlash = document.createElement('div'); 
        this.hitFlash.id = 'hit-flash';
        document.body.appendChild(this.hitFlash);
    }

    /**
     * Displays a message in the message box.
     * @param {string} message The text to display.
     * @param {number} [duration=0] How long to display the message in milliseconds. 0 for indefinite.
     */
    displayMessage(message, duration = 0) {
        if (!this.messageBox || !this.messageText) return;

        this.messageText.textContent = message;
        this.messageBox.classList.remove('hidden');
        this.messageBox.classList.add('visible'); 

        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }

        if (duration > 0) {
            this.currentTimeout = setTimeout(() => {
                this.hideMessage();
            }, duration);
        }
    }

    /**
     * Hides the message box.
     */
    hideMessage() {
        if (!this.messageBox) return;
        this.messageBox.classList.remove('visible');
        this.messageBox.classList.add('hidden');
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }

    /**
     * Flashes the screen red for a hit indication.
     */
    flashHitIndicator() {
        if (!this.hitFlash) return;
        
        this.hitFlash.classList.add('flash'); 
        setTimeout(() => {
            this.hitFlash.classList.remove('flash');
        }, 100); 
    }
}