export const BLOCK_TYPES = {
  normal: {
    id: 'normal',
    label: 'Wall',
    defaultColor: '#98a8b8',
    isTerrain: true,
    isCollectible: false,
    isFloor: false,
  },
  boost: {
    id: 'boost',
    label: 'Boost',
    defaultColor: '#00ff88',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  ice: {
    id: 'ice',
    label: 'Ice',
    defaultColor: '#88ddff',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  lava: {
    id: 'lava',
    label: 'Lava',
    defaultColor: '#ff3322',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  ramp: {
    id: 'ramp',
    label: 'Ramp',
    defaultColor: '#ff8800',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  coin: {
    id: 'coin',
    label: 'Coin',
    defaultColor: '#ffdd00',
    isTerrain: false,
    isCollectible: true,
    isFloor: false,
  },
  water: {
    id: 'water',
    label: 'Water',
    defaultColor: '#2288dd',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  goal: {
    id: 'goal',
    label: 'Goal',
    defaultColor: '#ffffff',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
  start: {
    id: 'start',
    label: 'Start',
    defaultColor: '#44ff44',
    isTerrain: true,
    isCollectible: false,
    isFloor: true,
  },
};

export const BLOCK_TYPE_LIST = Object.values(BLOCK_TYPES);

export const FLOOR_TYPES = BLOCK_TYPE_LIST.filter(bt => bt.isFloor);

export function getBlockType(typeId) {
  return BLOCK_TYPES[typeId] || BLOCK_TYPES.normal;
}
