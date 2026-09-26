import { SCHEMA_VERSION } from '../src/schema/definitions.js';

export const zero = { effect: 0, resistance: 0, agility: 0, range: 0, intelligence: 0, utility: 0 };

export const brief = {
  silhouette: 'A shape.',
  detail: 'Its detail.',
  distinctiveFeatures: ['one feature'],
  paletteDirection: 'Greens.',
  spriteScale: 'One cell.',
  requiredVariants: [],
};

export const layer = (itemType, stats = {}, activable = false) => ({
  itemType,
  activable,
  stats: { ...zero, ...stats },
});

export const common = (id, extra = {}) => ({
  id,
  name: id.split('.')[1],
  description: `The ${id}.`,
  role: 'A role.',
  ...extra,
});

/** The smallest functional foundation: a world, its items, one character, one map, one quest and one action. */
export const minimalDefinitions = () => [
  common('region.home', { layer: 'physical' }),
  common('biome.meadow', {
    region: 'region.home',
    ambience: 'Calm.',
    paletteDirection: 'Greens.',
    palette: { base: ['#44aa44'], shadow: ['#226622'], highlight: ['#88dd88'], outline: ['#112211'] },
  }),
  common('skin.walker', { artBrief: brief, objectLayer: layer('skin', { effect: 1 }, true) }),
  common('skin.shards', { artBrief: brief, objectLayer: layer('skin', { effect: 1 }, true) }),
  common('projectile.bolt', { artBrief: brief, objectLayer: layer('skill', { range: 5 }, true) }),
  common('ability.shot', { logicEventId: 'projectile', summons: 'projectile.bolt' }),
  common('weapon.gun', {
    artBrief: brief,
    abilities: ['ability.shot'],
    objectLayer: layer('weapon', { effect: 5 }, true),
  }),
  common('currency.chit', { artBrief: brief, objectLayer: layer('coin') }),
  common('character.walker', {
    locations: ['biome.meadow'],
    archetype: 'archetype',
    voice: 'Plain.',
    loadout: ['skin.walker', 'weapon.gun'],
    carries: ['currency.chit'],
    entity: {
      type: 'bot',
      behavior: 'provider',
      level: 2,
      drops: [{ item: 'currency.chit', chance: 0.5, quantity: 2 }],
    },
    greeting: [{ text: 'Hello.', mood: 'happy' }],
  }),
  common('floor.grass', { locations: ['biome.meadow'], artBrief: brief, objectLayer: layer('floor') }),
  common('tree.oak', {
    locations: ['biome.meadow'],
    artBrief: brief,
    harvest: { depleted: 'tree.oak-stump', yields: 'resource.log' },
    objectLayer: layer('resource'),
  }),
  common('tree.oak-stump', { locations: ['biome.meadow'], artBrief: brief, objectLayer: layer('resource') }),
  common('resource.log', { artBrief: brief, objectLayer: layer('resource') }),
  common('map.glade', {
    biome: 'biome.meadow',
    composition: [
      { entity: 'floor.grass', count: 1 },
      { entity: 'tree.oak', count: 3 },
      { entity: 'character.walker', count: 1 },
    ],
  }),
  common('quest.logs', {
    provider: 'character.walker',
    steps: [
      {
        id: 'cut',
        description: 'Cut logs.',
        objectives: [{ type: 'collect', target: 'resource.log', quantity: 2 }],
      },
      {
        id: 'report',
        description: 'Report back.',
        objectives: [{ type: 'talk', target: 'character.walker', quantity: 1 }],
      },
    ],
    rewards: [{ item: 'currency.chit', quantity: 3 }],
    talk: [{ text: 'Thanks.' }],
  }),
  common('action.walker-post', {
    provider: 'character.walker',
    shop: [{ item: 'weapon.gun', price: 'currency.chit', quantity: 4 }],
    recipes: [
      {
        outputs: [{ item: 'weapon.gun', quantity: 1 }],
        ingredients: [{ item: 'resource.log', quantity: 2 }],
        timeMs: 1000,
      },
    ],
  }),
];

export const minimalManifest = () => ({
  schemaVersion: SCHEMA_VERSION,
  baseline: {
    fragmentation: 'skin.shards',
    entities: { player: 'character.walker', floor: 'floor.grass', resource: 'tree.oak', skill: 'projectile.bolt' },
  },
});
