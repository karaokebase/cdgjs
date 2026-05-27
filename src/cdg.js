import { CDGPlayer } from "./CDGPlayer.js";

/**
 * @typedef {Object} InitOptions
 * @property {boolean} [autoplay=true] - Start playing automatically when a track is loaded
 * @property {boolean} [showControls=true] - Show native audio controls
 * @property {boolean} [allowFullscreen=true] - Allow player to be toggled into fullscreen on double-click
 * @property {boolean} [allowClickToPlay=true] - Allow play/pause toggle on click
 */

/**
 * Creates and initialises a new CDG karaoke player.
 * @param {string} containerId - ID of the DOM element that will contain the player
 * @param {InitOptions} [initOptions] - Player initialisation options
 * @returns {CDGPlayer}
 */
export function init(containerId, initOptions) {
  return new CDGPlayer(containerId, initOptions);
}
export { CDGDecoder } from "./CDGDecoder.js";
