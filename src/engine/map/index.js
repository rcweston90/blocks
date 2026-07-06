// Map generation public API — re-exports + preset registration
export { MAP_LAYOUTS, generateMap } from './registry.js';

// Import all presets so they self-register
import './presets/raceTrack.js';
import './presets/cityBlocks.js';
import './presets/obstacleCourse.js';
import './presets/skylineParkour.js';
import './presets/hazardGauntlet.js';
import './presets/openExplorer.js';
import './presets/boostHighway.js';
import './presets/tutorialRide.js';
import './presets/spiral.js';
import './presets/figure8.js';
import './presets/arena.js';
