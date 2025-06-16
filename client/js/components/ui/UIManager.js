// PropHunt/client/js/components/ui/UIManager.js

export class UIManager {
    constructor() {
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

        // Always clear any existing timeout when a new message is displayed
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null; // Reset to null after clearing
        }

        this.messageText.textContent = message;
        this.messageBox.classList.remove('hidden');
        this.messageBox.classList.add('visible');

        if (duration > 0) {
            this.currentTimeout = setTimeout(() => {
                this.hideMessage();
            }, duration);
        }
        // If duration is 0, the message will remain indefinitely until hideMessage() is explicitly called.
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