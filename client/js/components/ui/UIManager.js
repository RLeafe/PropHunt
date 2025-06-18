// /client/js/components/ui/UIManager.js

export class UIManager {
    constructor() {
        this.messageBox = document.getElementById('message-box');
        this.messageText = document.getElementById('message-text');
        this.countdownTimer = document.getElementById('countdown-timer');
        this.playerHealth = document.getElementById('player-health');
        
        this.messageTimeout = null;
    }

    displayMessage(text, duration = 3000) {
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

    updateCountdown(text) {
        if (text) {
            this.countdownTimer.textContent = text;
            this.countdownTimer.classList.remove('hidden');
        } else {
            this.countdownTimer.classList.add('hidden');
        }
    }

    updateHealth(health) {
        this.playerHealth.textContent = `Health: ${health}`;
        this.playerHealth.classList.remove('hidden');
    }
}
