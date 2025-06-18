// /client/js/utils/ClientGameConfig.js

// This path goes up two directories from /utils to /client, then into the /shared folder.
export * from '../../shared/config/SharedConfig.js';

// --- CLIENT-ONLY VALUES ---
// These are not critical for gameplay sync but can be useful for UI layout.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;
