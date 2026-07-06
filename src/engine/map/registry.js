// Map preset registry — maps are lazy-imported from presets/
import { BlockBuffer } from './primitives.js';

export const MAP_LAYOUTS = [
  { id: 'tutorialRide',    label: 'Tutorial Ride' },
  { id: 'raceTrack',       label: 'Race Track' },
  { id: 'boostHighway',    label: 'Boost Highway' },
  { id: 'openExplorer',    label: 'Open Explorer' },
  { id: 'cityBlocks',      label: 'City Blocks' },
  { id: 'obstacleCourse',  label: 'Obstacle Course' },
  { id: 'skylineParkour',  label: 'Skyline Parkour' },
  { id: 'hazardGauntlet',  label: 'Hazard Gauntlet' },
  { id: 'spiral',          label: 'Spiral' },
  { id: 'figure8',         label: 'Figure-8' },
  { id: 'arena',           label: 'Arena' },
];

// Builder functions registered by preset modules
const BUILDERS = {};

export function registerBuilder(id, fn) {
  BUILDERS[id] = fn;
}

export function generateMap(state, layoutId) {
  state.pushUndo();
  state.blocks = [];
  state.rectangles = [];
  state.selection = null;
  state._rebuildBlockMap();

  const builder = BUILDERS[layoutId];
  if (builder) {
    const buf = new BlockBuffer();
    builder(buf, state);
    buf.flush(state);
  }
  state._rebuildBlockMap();
  state.statusText = `Generated: ${MAP_LAYOUTS.find(l => l.id === layoutId)?.label || layoutId}`;
}
