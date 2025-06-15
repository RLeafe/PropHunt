// PropHunt/client/js/utils/ClientGameConfig.js

// Game Window Dimensions
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;

// World Boundaries (Client-side display only, must match server's WORLD_BOUNDARY)
export const WORLD_BOUNDARY = 49; 

// Player-specific offsets (related to the game world's ground)
export const PLAYER_HEIGHT_OFFSET = 0.9; 

// --- Physics Constants (Client-side prediction, MUST match ServerConfig.js) ---
export const GRAVITY = -9.0 * 0.005; 
export const JUMP_FORCE = 0.3; 
export const PLAYER_SPEED = 0.2; 
export const MOUSE_SENSITIVITY = 0.0015; 

// --- Game Logic Constants (Client-side, matching ServerConfig.js) ---
export const MORPH_RANGE = 2.5; 
export const SEEKER_SWING_HIT_RADIUS = 1.0; 
export const SEEKER_SWING_DISTANCE = 2.0;