// /client/shared/config/SharedConfig.js

// --- Core Game Mechanics ---
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const SERVER_TICK_RATE_MS = 1000 / 60; // 60 ticks per second

// --- World & Physics (MUST BE IDENTICAL ON CLIENT AND SERVER) ---
export const WORLD_BOUNDARY = 49;
export const PLAYER_HEIGHT_OFFSET = 0.9;
export const GRAVITY = -25;
export const JUMP_FORCE = 8;
export const PLAYER_SPEED = 5.0;
export const MOUSE_SENSITIVITY = 0.0008;


// --- Gameplay Constants ---
export const HIT_DAMAGE = 25;
export const FLASH_DURATION_MS = 200;
export const MORPH_RANGE = 0.9;
export const SEEKER_SWING_DISTANCE = 2.0;
export const CAMERA_EYE_HEIGHT = 1.6;

// --- Game State Timers ---
export const SEEKER_PAUSE_DURATION_SECONDS = 10;
export const GAME_END_RESET_SECONDS = 5;
