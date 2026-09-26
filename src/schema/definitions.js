/**
 * Schema of the content definitions: the kinds, their fields and the references between them.
 *
 * A definition id is `<kind>.<slug>`; its file is `<category>/<id>.json`. A labeled kind
 * materializes as one Object Layer item whose label is its slug. An entity kind is what a map
 * places, and each one has entity-type defaults. Every field is functional content or its meaning:
 * render and placement are authored in Studio, never here.
 *
 * @module src/schema/definitions.js
 */
import { CONTRACT, ENTITY_TYPES } from './contract.js';

/** Version of the definition format. A change of shape increments it. */
export const SCHEMA_VERSION = 3;

/** The layers of the Cyberia universe a region belongs to. */
export const LAYERS = Object.freeze(['physical', 'hyperspace', 'overlap']);

export const CHARACTER_ARCHETYPES = Object.freeze([
  'principal',
  'recurring',
  'representative',
  'archetype',
  'supporting',
]);

export const EFFECT_CATEGORIES = Object.freeze(['damage', 'defense', 'control', 'economy', 'summon', 'utility']);

/** Free semantic relationships. Structural links use the typed fields of each kind. */
export const RELATION_TYPES = Object.freeze([
  'allied-with',
  'rival-of',
  'depends-on',
  'trades-with',
  'descended-from',
  'found-with',
]);

export const MOODS = Object.freeze(['neutral', 'happy', 'sad', 'angry']);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A color: `#rrggbb`, lowercase. */
export const COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** The roles of a palette, in the order an artist reads them. */
export const PALETTE_ROLES = Object.freeze(['base', 'shadow', 'highlight', 'outline', 'accent', 'special']);

/** Spatial and render keys. A definition or a saga package carries none of them. */
export const FORBIDDEN_KEYS = Object.freeze([
  'initCellX',
  'initCellY',
  'sourceCellX',
  'sourceCellY',
  'targetCellX',
  'targetCellY',
  'sourceMapCode',
  'targetMapCode',
  'gridX',
  'gridY',
  'dimX',
  'dimY',
  'cellWidth',
  'cellHeight',
  'portals',
  'entities',
  'render',
  'renderFrames',
  'frames',
  'frame_duration',
  'atlas',
  'pixels',
  'cid',
  'metadataCid',
]);

/** Kinds that are carried items. */
export const ITEM_KINDS = Object.freeze([
  'weapon',
  'armor',
  'skin',
  'projectile',
  'currency',
  'resource',
  'consumable',
  'relic',
  'technology',
  'implant',
  'tool',
]);

/** Kinds that stand in the world: each one is one Object Layer item and one entity. */
export const ENVIRONMENT_KINDS = Object.freeze([
  'floor',
  'tree',
  'vegetation',
  'rock',
  'prop',
  'structure',
  'ruin',
  'portal',
]);

/** Kinds that materialize as an Object Layer item. */
export const LABELED_KINDS = Object.freeze([...ENVIRONMENT_KINDS, ...ITEM_KINDS]);

/** Kinds a map places. */
export const ENTITY_KINDS = Object.freeze(['character', ...ENVIRONMENT_KINDS]);

/** Kinds whose `harvest` names a depleted state and a yield. */
export const HARVESTABLE_KINDS = Object.freeze(['tree', 'vegetation', 'rock']);

/** Kinds only the foundation defines: the world a saga is set in. */
export const FOUNDATION_KINDS = Object.freeze(['region', 'biome', 'faction', 'origin', 'material']);

const string = (required = true) => ({ type: 'string', required });
const strings = (required = false) => ({ type: 'strings', required });
const oneOf = (values, required = true) => ({ type: 'enum', values, required });
/** A reference to a definition of the given kinds; `null` kinds accept any kind. */
const ref = (kinds, required = false) => ({ type: 'ref', kinds, required });
const refs = (kinds, required = false) => ({ type: 'refs', kinds, required });
const integer = (min, required = false) => ({ type: 'integer', min, max: Infinity, required });
const number = (min, max = Infinity) => ({ type: 'number', min, max, required: false });
const boolean = () => ({ type: 'boolean', required: true });
const color = () => ({ type: 'color', required: true });
const object = (fields, required = false) => ({ type: 'object', fields, required });
/** A list of values of one spec; a required list must not be empty. */
const list = (of, required = false) => ({ type: 'list', of, required });

const stack = (required = false) =>
  list(object({ item: ref(LABELED_KINDS, true), quantity: integer(1, true) }), required);
const lines = () => list(object({ text: string(), mood: oneOf(MOODS, false) }));
/** A palette: colors by role. The first four roles are required. */
const palette = () =>
  object(Object.fromEntries(PALETTE_ROLES.map((role, index) => [role, list(color(), index < 4)])), true);

/** Fields every definition may carry. */
export const COMMON_FIELDS = Object.freeze({
  id: string(),
  name: string(),
  description: string(),
  role: string(),
  tags: strings(),
  factions: refs(['faction']),
  origin: ref(['origin']),
  locations: refs(['region', 'biome']),
  relations: list(object({ type: oneOf(RELATION_TYPES), target: ref(null, true) })),
});

/** Fields of an art brief: what a human needs to draw the asset at 16×16 and 32×32. */
export const ART_BRIEF_FIELDS = Object.freeze({
  silhouette: string(),
  detail: string(),
  distinctiveFeatures: strings(true),
  visualMotifs: strings(),
  paletteDirection: string(),
  spriteScale: string(),
  readability: string(false),
  requiredVariants: strings(),
  matches: refs([...LABELED_KINDS, 'material']),
});

const artBrief = (required = true) => object(ART_BRIEF_FIELDS, required);

/** Fields of a labeled definition. Its item type and stats are checked against its kind. */
const OBJECT_LAYER_FIELDS = Object.freeze({
  artBrief: artBrief(),
  objectLayer: { type: 'objectLayer', required: true },
  materials: refs(['material']),
});

const environment = (itemTypes, extra = {}) => ({
  category: 'environment',
  itemTypes,
  fields: { ...OBJECT_LAYER_FIELDS, ...extra },
});

const item = (itemTypes, extra = {}) => ({
  category: 'items',
  itemTypes,
  fields: { ...OBJECT_LAYER_FIELDS, ...extra },
});

const harvest = { harvest: object({ depleted: ref(HARVESTABLE_KINDS, true), yields: ref(ITEM_KINDS, true) }) };
const abilities = { abilities: refs(['ability']) };

/**
 * Every kind: its category directory, the Object Layer item types a labeled kind may take, and
 * the fields it adds to {@link COMMON_FIELDS}.
 */
export const KINDS = Object.freeze({
  region: {
    category: 'universe',
    fields: { layer: oneOf(LAYERS), connectsTo: refs(['region']) },
  },
  biome: {
    category: 'universe',
    fields: { region: ref(['region'], true), ambience: string(), paletteDirection: string(), palette: palette() },
  },
  faction: {
    category: 'factions',
    fields: {
      color: string(false),
      parent: ref(['faction']),
      domain: oneOf(LAYERS, false),
      beliefs: string(false),
      strengths: strings(),
      weaknesses: strings(),
    },
  },
  origin: { category: 'factions', fields: {} },
  material: { category: 'environment', fields: { artBrief: artBrief() } },
  floor: environment(['floor']),
  tree: environment(['resource', 'static', 'obstacle'], harvest),
  vegetation: environment(['resource', 'static', 'obstacle', 'foreground'], harvest),
  rock: environment(['resource', 'obstacle', 'static'], harvest),
  prop: environment(['static', 'obstacle', 'foreground']),
  structure: environment(['obstacle', 'static', 'foreground']),
  ruin: environment(['obstacle', 'static', 'foreground']),
  portal: environment(['portal'], { mode: oneOf(CONTRACT.portalModes) }),
  weapon: item(['weapon'], abilities),
  armor: item(['breastplate']),
  skin: item(['skin']),
  projectile: item(['skill']),
  currency: item(['coin'], abilities),
  resource: item(['resource']),
  consumable: item(['resource']),
  relic: item(['resource'], abilities),
  technology: item(['resource'], abilities),
  implant: item(['resource'], abilities),
  tool: item(['resource'], abilities),
  character: {
    category: 'characters',
    fields: {
      archetype: oneOf(CHARACTER_ARCHETYPES),
      voice: string(),
      loadout: refs(['skin', 'weapon', 'armor'], true),
      carries: refs(ITEM_KINDS),
      entity: object(
        {
          type: oneOf(ENTITY_TYPES),
          behavior: oneOf(CONTRACT.entityBehaviors, false),
          level: integer(1),
          maxLife: number(0),
          lifeRegen: number(0),
          aggroRange: number(0),
          spawnRadius: number(0),
          drops: list(object({ item: ref(LABELED_KINDS, true), chance: number(0, 1), quantity: integer(1) })),
        },
        true,
      ),
      greeting: lines(),
    },
  },
  ability: {
    category: 'abilities',
    fields: {
      logicEventId: oneOf(
        CONTRACT.skillLogic.map(({ id }) => id),
        false,
      ),
      summons: ref(['projectile', 'currency']),
      effects: refs(['effect']),
    },
  },
  effect: { category: 'abilities', fields: { category: oneOf(EFFECT_CATEGORIES) } },
  map: {
    category: 'maps',
    fields: {
      biome: ref(['biome'], true),
      composition: list(object({ entity: ref(ENTITY_KINDS, true), count: integer(1, true) }), true),
    },
  },
  quest: {
    category: 'quests',
    fields: {
      provider: ref(['character'], true),
      prerequisites: refs(['quest']),
      unlocks: refs(['quest']),
      steps: list(
        object({
          id: string(),
          description: string(),
          objectives: list(
            object({
              type: oneOf(CONTRACT.questStepTypes),
              target: ref(['character', ...LABELED_KINDS], true),
              quantity: integer(1, true),
            }),
            true,
          ),
        }),
        true,
      ),
      rewards: stack(),
      talk: lines(),
    },
  },
  action: {
    category: 'actions',
    fields: {
      provider: ref(['character'], true),
      shop: list(
        object({ item: ref(LABELED_KINDS, true), price: ref(['currency'], true), quantity: integer(0, true) }),
      ),
      recipes: list(object({ outputs: stack(true), ingredients: stack(true), timeMs: integer(0) })),
      storageSlots: integer(0),
    },
  },
});

/** Category directories, in load order. */
export const CATEGORIES = Object.freeze([...new Set(Object.values(KINDS).map(({ category }) => category))]);

/** The kind of a definition id: the text before the first dot. */
export const kindOf = (id) => String(id ?? '').split('.')[0];

/** The slug of a definition id: the text after the first dot. */
export const slugOf = (id) => String(id ?? '').slice(kindOf(id).length + 1);

/** Whether a definition id materializes as an Object Layer item. */
export const isLabeled = (id) => LABELED_KINDS.includes(kindOf(id));

/** Every definition id a value names through its field spec, with the dotted field that names it. */
const refsIn = (spec, value, field) => {
  if (value === undefined || value === null) return [];
  if (spec.type === 'ref') return [{ field, id: value }];
  if (spec.type === 'refs') return Array.isArray(value) ? value.map((id) => ({ field, id })) : [];
  if (spec.type === 'object')
    return Object.entries(spec.fields).flatMap(([key, entry]) =>
      refsIn(entry, value[key], field ? `${field}.${key}` : key),
    );
  if (spec.type === 'list') return Array.isArray(value) ? value.flatMap((entry) => refsIn(spec.of, entry, field)) : [];
  return [];
};

/** Every reference of a definition: the definition id it names and the field that names it. */
export const referenceEntries = (definition) =>
  refsIn(object({ ...COMMON_FIELDS, ...KINDS[kindOf(definition.id)]?.fields }), definition, '');

/** Every definition id a set of definitions names, in first-seen order. */
export const referencesOf = (definitions) =>
  new Set(definitions.flatMap((definition) => referenceEntries(definition).map(({ id }) => id)));
