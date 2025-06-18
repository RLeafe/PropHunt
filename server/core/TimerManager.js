// /server/core/TimerManager.js

export class TimerManager {
    constructor() {
        this.activeTimers = new Map();
        console.log('[TimerManager] Initialized.');
    }

    start(config) {
        const { name, durationSeconds, onComplete, onTick, messagePrefix = '' } = config;
        this.stop(name);

        let timeLeft = durationSeconds;
        const intervalId = setInterval(() => {
            if (onTick) {
                onTick({
                    type: 'countdownUpdate',
                    timerName: name,
                    timeLeft: timeLeft,
                    message: `${messagePrefix}${timeLeft}s`
                });
            }

            if (timeLeft <= 0) {
                this.stop(name);
                onComplete();
            }
            timeLeft--;
        }, 1000);

        this.activeTimers.set(name, intervalId);
        console.log(`[TimerManager] Started timer "${name}" for ${durationSeconds}s.`);
    }

    stop(timerName) {
        if (this.activeTimers.has(timerName)) {
            clearInterval(this.activeTimers.get(timerName));
            this.activeTimers.delete(timerName);
            console.log(`[TimerManager] Stopped timer "${timerName}".`);
        }
    }

    stopAll() {
        for (const intervalId of this.activeTimers.values()) {
            clearInterval(intervalId);
        }
        this.activeTimers.clear();
        console.log('[TimerManager] All timers stopped.');
    }
}
