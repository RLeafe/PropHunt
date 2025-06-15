// PropHunt/server/utils/GameEnums.js

/**
 * @typedef {'seeker' | 'hider'} PlayerRole
 */

/**
 * Defines the roles a player can have in the game.
 * @readonly
 * @enum {PlayerRole}
 */
export const PlayerRoles = {
    SEEKER: 'seeker',
    HIDER: 'hider'
};

/**
 * @typedef {'LOBBY' | 'STARTING' | 'PLAYING' | 'ENDED'} GameState
 */

/**
 * Defines the various states the game can be in.
 * @readonly
 * @enum {GameState}
 */
export const GameStates = {
    LOBBY: 'LOBBY',
    STARTING: 'STARTING', // Could be used for a countdown phase
    PLAYING: 'PLAYING',
    ENDED: 'ENDED'
};