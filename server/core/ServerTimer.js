// PropHunt/server/core/ServerTimer.js

import { playerConnections } from './ServerGameState.js'; // Still need this to access the map

let wssInstance = null;
const activeTimers = new Map();

export function initTimers(wss) { // Removed playerConnections parameter as it's imported
    wssInstance = wss;
}

export function startCountdownTimer(timerName, durationSeconds, onCompleteCallback, targetClientIds = null, messagePrefix = 'Time remaining: ', sendZeroMessage = true) {
    if (!wssInstance) {
        console.error('[ServerTimer] WSS instance not set for timers.');
        return;
    }

    stopTimer(timerName);

    let timeLeft = durationSeconds;
    const startTime = Date.now();

    const intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        timeLeft = durationSeconds - elapsed;

        if (timeLeft >= 0) {
            const message = `${messagePrefix}${timeLeft}s`;
            const messageType = 'countdownUpdate';

            if (targetClientIds && targetClientIds.length > 0) {
                targetClientIds.forEach(clientId => {
                    // Use the imported playerConnections map
                    const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === clientId);
                    if (ws && ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: messageType, message: message, timeLeft: timeLeft, timerName: timerName }));
                    }
                });
            } else { // Broadcast to all
                wssInstance.clients.forEach(client => {
                    if (client.readyState === client.OPEN) {
                        client.send(JSON.stringify({ type: messageType, message: message, timeLeft: timeLeft, timerName: timerName }));
                    }
                });
            }
        }

        if (timeLeft <= 0) {
            if (sendZeroMessage && timeLeft === 0) {
                const message = `${messagePrefix}0s`;
                const messageType = 'countdownUpdate';
                 if (targetClientIds && targetClientIds.length > 0) {
                    targetClientIds.forEach(clientId => {
                        const ws = Array.from(playerConnections.keys()).find(conn => playerConnections.get(conn) === clientId);
                        if (ws && ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({ type: messageType, message: message, timeLeft: 0, timerName: timerName }));
                        }
                    });
                } else {
                    wssInstance.clients.forEach(client => {
                        if (client.readyState === client.OPEN) {
                            client.send(JSON.stringify({ type: messageType, message: message, timeLeft: 0, timerName: timerName }));
                        }
                    });
                }
            }

            clearInterval(intervalId);
            activeTimers.delete(timerName);
            onCompleteCallback();
        }
    }, 1000);

    activeTimers.set(timerName, { intervalId, durationSeconds, startTime, callback: onCompleteCallback, targetClientIds, messagePrefix });
    console.log(`[ServerTimer] Started timer "${timerName}" for ${durationSeconds}s.`);
}

export function stopTimer(timerName) {
    if (activeTimers.has(timerName)) {
        clearInterval(activeTimers.get(timerName).intervalId);
        activeTimers.delete(timerName);
        console.log(`[ServerTimer] Stopped timer "${timerName}".`);
    }
}

export function stopAllTimers() {
    for (const timerName of activeTimers.keys()) {
        stopTimer(timerName);
    }
    console.log('[ServerTimer] All timers stopped.');
}

export function getTimeLeft(timerName) {
    const timer = activeTimers.get(timerName);
    if (timer) {
        const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
        return Math.max(0, timer.durationSeconds - elapsed);
    }
    return null;
}