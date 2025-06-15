// PropHunt/server/config/ServerConfig.js

export const PORT = process.env.PORT || 3000;
export const PLAYER_HEIGHT_OFFSET = 0.9; // Must match client's ClientGameConfig.js

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const SEEKER_PAUSE_DURATION_SECONDS = 10; // 10 seconds for seeker pause
export const GAME_END_RESET_SECONDS = 5;

export const HIT_DAMAGE = 25;
export const FLASH_DURATION_MS = 200; // For client hit feedback

export const SERVER_TICK_RATE_MS = 1000 / 60; // 60 ticks per second for physics updates

// --- Physics Constants (Server Authoritative) ---
export const WORLD_BOUNDARY = 49; // Max absolute X/Z coordinate for players/props
export const SERVER_GRAVITY = -9.0 * 0.005; // Negative for downward acceleration, tuned
export const SERVER_JUMP_FORCE = 0.3; // Initial upward velocity on jump, tuned
export const SERVER_PLAYER_SPEED = 0.2; // Base movement speed per tick factor, tuned
export const SERVER_MOUSE_SENSITIVITY = 0.0015; // How much mouse movement translates to rotation, tuned

// --- Game Logic Constants ---
export const MORPH_RANGE = 2.5; // Max distance a hider can be from a prop to morph
export const SEEKER_SWING_HIT_RADIUS = 1.0; // Radius of the bat's hit check
export const SEEKER_SWING_DISTANCE = 2.0; // How far in front of seeker the swing check extends