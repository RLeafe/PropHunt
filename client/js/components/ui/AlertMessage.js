// /client/js/components/ui/AlertMessage.js

/**
 * A self-contained, reusable component for displaying game alerts and messages.
 * It creates and manages its own HTML elements.
 */
export class AlertMessage {
    constructor(container) {
        if (!container) {
            throw new Error('A container element must be provided for AlertMessage.');
        }

        // Create the main message box element
        this.messageBox = document.createElement('div');
        this.messageBox.id = 'alert-message-box';
        this.messageBox.className = 'hidden';
        
        this.messageText = document.createElement('p');
        this.messageText.id = 'alert-message-text';
        this.messageBox.appendChild(this.messageText);

        // Create the countdown timer element
        this.countdownTimer = document.createElement('div');
        this.countdownTimer.id = 'alert-countdown-timer';
        this.countdownTimer.className = 'hidden';

        // Append the new elements to the provided game container
        container.appendChild(this.messageBox);
        container.appendChild(this.countdownTimer);

        this.messageTimeout = null;
    }

    /**
     * Shows a message in the main alert box.
     * @param {string} text The message to display.
     * @param {number} [duration=3000] How long to show the message in ms. 0 for permanent.
     */
    show(text, duration = 3000) {
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }

        this.messageText.textContent = text;
        this.messageBox.classList.remove('hidden');
        this.messageBox.classList.add('visible');

        if (duration > 0) {
            this.messageTimeout = setTimeout(() => {
                this.messageBox.classList.remove('visible');
                this.messageBox.classList.add('hidden');
            }, duration);
        }
    }

    /**
     * Updates the dedicated countdown timer text.
     * @param {string} text The text to display (e.g., "Hunt in: 10s").
     */
    updateCountdown(text) {
        if (text) {
            this.countdownTimer.textContent = text;
            this.countdownTimer.classList.remove('hidden');
        } else {
            // Hide the countdown timer if the text is empty
            this.countdownTimer.classList.add('hidden');
        }
    }

    /**
     * Hides the main message box immediately.
     */
    hide() {
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageBox.classList.remove('visible');
        this.messageBox.classList.add('hidden');
    }
}