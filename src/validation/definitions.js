/**
 * Validation of definitions: fields, references, duplicates, the functional rules of each kind and
 * the baseline.
 *
 * Every check returns findings instead of throwing, so one run reports the whole defect list.
 * The same rules validate the foundation and the definitions a saga package adds on top of it.
 *
 * @module src/validation/definitions.js
 */
import { CONTRACT, ENTITY_TYPES, validateStats } from '../schema/contract.js';
import {
  COLOR_PATTERN,
  COMMON_FIELDS,
  ENVIRONMENT_KINDS,
  FORBIDDEN_KEYS,
  KINDS,
  SCHEMA_VERSION,
  SLUG_PATTERN,
  isLabeled,
  kindOf,
  slugOf,
} from '../schema/definitions.js';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

/** Every forbidden spatial or render key inside a value, as dotted paths. */
export function forbiddenKeyPaths(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((entry, index) => forbiddenKeyPaths(entry, `${path}[${index}]`));
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(FORBIDDEN_KEYS.includes(key) ? [`${path}${path ? '.' : ''}${key}`] : []),
    ...forbiddenKeyPaths(entry, `${path}${path ? '.' : ''}${key}`),
  ]);
}

/** The Object Layer item type of a definition, or '' when it materializes as none. */
const itemTypeOf = (definition) => definition?.objectLayer?.itemType ?? '';

/** Checks a value against its field spec. */
function checkValue(spec, value, field, context) {
  const { report, resolve } = context;
  if (value === undefined || value === null) {
    if (spec.required) report(`${field} is required`);
    return;
  }
  switch (spec.type) {
    case 'string':
      if (!isText(value)) report(`${field} must be non-empty text`);
      return;
    case 'strings':
      if (!Array.isArray(value) || !value.every(isText)) report(`${field} must be a list of non-empty texts`);
      else if (spec.required && value.length === 0) report(`${field} must not be empty`);
      return;
    case 'enum':
      if (!spec.values.includes(value)) report(`${field} must be one of: ${spec.values.join(', ')}`);
      return;
    case 'boolean':
      if (typeof value !== 'boolean') report(`${field} must be true or false`);
      return;
    case 'color':
      if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) report(`${field} must be a #rrggbb color`);
      return;
    case 'integer':
      if (!Number.isInteger(value) || value < spec.min) report(`${field} must be an integer of at least ${spec.min}`);
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max)
        report(`${field} must be a number from ${spec.min}${spec.max === Infinity ? '' : ` to ${spec.max}`}`);
      return;
    case 'ref':
      resolve(value, spec.kinds, field);
      return;
    case 'refs':
      if (!Array.isArray(value)) return report(`${field} must be a list of definition ids`);
      if (spec.required && value.length === 0) report(`${field} must not be empty`);
      if (new Set(value).size !== value.length) report(`${field} repeats an id`);
      value.forEach((id) => resolve(id, spec.kinds, field));
      return;
    case 'object':
      checkFields(spec.fields, value, `${field}.`, context);
      return;
    case 'list':
      if (!Array.isArray(value)) return report(`${field} must be a list`);
      if (spec.required && value.length === 0) report(`${field} must not be empty`);
      value.forEach((entry, index) => checkValue({ ...spec.of, required: true }, entry, `${field}[${index}]`, context));
      return;
    default:
      return;
  }
}

/** Checks the fields of an object: no unknown key, and each declared field against its spec. */
function checkFields(fields, value, prefix, context) {
  if (!isPlainObject(value)) return context.report(`${prefix.slice(0, -1)} must be an object`);
  const unknown = Object.keys(value).filter((key) => !fields[key]);
  if (unknown.length > 0)
    context.report(`${prefix ? `${prefix.slice(0, -1)} has ` : ''}unknown field(s): ${unknown.join(', ')}`);
  for (const [key, spec] of Object.entries(fields)) checkValue(spec, value[key], `${prefix}${key}`, context);
}

function checkObjectLayer(definition, kind, report) {
  const layer = definition.objectLayer;
  if (!isPlainObject(layer)) return report('objectLayer must be an object');
  const unknown = Object.keys(layer).filter((key) => !['itemType', 'activable', 'stats'].includes(key));
  if (unknown.length > 0) report(`objectLayer has unknown field(s): ${unknown.join(', ')}`);
  if (!KINDS[kind].itemTypes.includes(layer.itemType))
    report(`objectLayer.itemType must be one of: ${KINDS[kind].itemTypes.join(', ')}`);
  if (typeof layer.activable !== 'boolean') report('objectLayer.activable must be true or false');
  let stats;
  try {
    stats = validateStats(layer.stats ?? {});
  } catch (error) {
    return report(`objectLayer.stats: ${error.message}`);
  }
  const bounds = CONTRACT.stats.bounds[layer.itemType];
  if (!bounds) return;
  for (const [key, value] of Object.entries(stats)) {
    const [min, max] = bounds[key];
    if (value < min || value > max)
      report(`objectLayer.stats.${key} ${value} is outside ${layer.itemType} bounds [${min}, ${max}]`);
  }
}

function checkHarvest(definition, context) {
  const { harvest } = definition;
  if (itemTypeOf(definition) !== 'resource') context.report('a harvestable definition materializes as a resource');
  const depleted = context.lookup(harvest.depleted);
  if (depleted && itemTypeOf(depleted) !== 'resource')
    context.report('harvest.depleted must materialize as a resource');
  if (depleted?.harvest) context.report('harvest.depleted must not be harvestable itself');
}

function checkCharacter(definition, context) {
  const worn = (definition.loadout ?? []).map((id) => context.lookup(id)).filter(Boolean);
  const types = worn.map(itemTypeOf);
  if (types.filter((type) => type === 'skin').length !== 1) context.report('loadout must name exactly one skin');
  if (new Set(types).size !== types.length) context.report('loadout names two items of one type');
  const { entity } = definition;
  if (!isPlainObject(entity) || !ENTITY_TYPES.includes(entity.type)) return;
  const allowed = CONTRACT.entityItemTypes[entity.type];
  if (!types.every((type) => allowed.includes(type)))
    context.report(`entity.type ${entity.type} cannot hold every item of the loadout`);
  if (entity.type === 'bot' && !entity.behavior) context.report('entity.behavior is required for a bot');
  if (entity.type !== 'bot' && entity.behavior) context.report('entity.behavior applies to a bot only');
}

function checkAbility(definition, context) {
  const logic = CONTRACT.skillLogic.find(({ id }) => id === definition.logicEventId);
  if (!logic || logic.summons === null) {
    if (definition.summons !== undefined)
      context.report(logic ? `${logic.id} summons the caster's skin; remove summons` : 'summons needs a logicEventId');
    return;
  }
  const summoned = context.resolve(definition.summons, ['projectile', 'currency'], 'summons', true);
  if (summoned && itemTypeOf(summoned) !== logic.summons)
    context.report(`${logic.id} summons a ${logic.summons}; ${definition.summons} is a ${itemTypeOf(summoned)}`);
}

/** A map places what belongs to its biome: each entity is located in the biome or its region. */
function checkComposition(definition, context) {
  const biome = context.lookup(definition.biome);
  const ids = (definition.composition ?? []).map((entry) => entry?.entity);
  if (new Set(ids).size !== ids.length) context.report('composition repeats an entity');
  if (!biome) return;
  for (const id of ids) {
    const entity = context.lookup(id);
    if (entity && !(entity.locations ?? []).some((location) => location === biome.id || location === biome.region))
      context.report(`${id} is not located in ${biome.id} or ${biome.region}`);
  }
}

/** Objective targets by type: an item to collect, a character to kill or to talk to. */
function checkQuest(definition, context) {
  const objectives = (definition.steps ?? []).flatMap((step) => step?.objectives ?? []);
  for (const { type, target } of objectives) {
    if (type === 'collect' && target && !isLabeled(target)) context.report(`collect targets an item, not ${target}`);
    if ((type === 'kill' || type === 'talk') && target && kindOf(target) !== 'character')
      context.report(`${type} targets a character, not ${target}`);
  }
  if (objectives.some(({ type }) => type === 'talk') && !definition.talk?.length)
    context.report('talk is required when an objective is to talk');
  const stepIds = (definition.steps ?? []).map((step) => step?.id);
  if (new Set(stepIds).size !== stepIds.length) context.report('steps repeat an id');
  if ([...(definition.prerequisites ?? []), ...(definition.unlocks ?? [])].includes(definition.id))
    context.report('a quest cannot require or unlock itself');
}

function checkDefinition(definition, context) {
  const { report } = context;
  if (!isPlainObject(definition)) return report('a definition must be an object');
  const kind = kindOf(definition.id);
  const schema = KINDS[kind];
  if (!schema) return report(`unknown kind "${kind}"`);
  if (!SLUG_PATTERN.test(slugOf(definition.id))) report('id must be <kind>.<lowercase-kebab-slug>');
  for (const path of forbiddenKeyPaths(definition)) report(`${path} is spatial or render data`);

  checkFields({ ...COMMON_FIELDS, ...schema.fields }, definition, '', context);
  if (schema.itemTypes && definition.objectLayer !== undefined) checkObjectLayer(definition, kind, report);
  if (ENVIRONMENT_KINDS.includes(kind) && !(definition.locations ?? []).some((id) => kindOf(id) === 'biome'))
    report('locations must name at least one biome');
  if (definition.harvest) checkHarvest(definition, context);
  if (kind === 'character') checkCharacter(definition, context);
  if (kind === 'ability') checkAbility(definition, context);
  if (kind === 'map') checkComposition(definition, context);
  if (kind === 'quest') checkQuest(definition, context);
  if (kind === 'faction' && definition.parent === definition.id) report('a faction cannot be its own parent');
  if (kind === 'region' && (definition.connectsTo ?? []).includes(definition.id))
    report('a region cannot connect to itself');
}

/**
 * One finding per definition that repeats an id, an item label or a (kind, name). The label of a
 * labeled definition is its slug, so two labeled kinds never share a slug.
 */
function duplicateFindings(definitions, base) {
  const findings = [];
  const claims = (keyOf, label) => {
    const seen = new Map(
      base ? [...base.definitions.values()].map((definition) => [keyOf(definition), definition.id]) : [],
    );
    for (const definition of definitions) {
      const key = keyOf(definition);
      if (!key) continue;
      if (seen.has(key)) findings.push({ id: definition.id, message: `${label} is already used by ${seen.get(key)}` });
      else seen.set(key, definition.id);
    }
  };
  claims((definition) => definition?.id, 'id');
  claims((definition) => (isLabeled(definition?.id) ? slugOf(definition.id) : ''), 'item label');
  claims((definition) => (definition?.name ? `${kindOf(definition.id)}:${definition.name.toLowerCase()}` : ''), 'name');
  return findings;
}

/** A region graph edge declared from both ends is one edge written twice. */
function topologyFindings(definitions) {
  const edges = new Set();
  const findings = [];
  for (const region of definitions.filter((definition) => kindOf(definition?.id) === 'region')) {
    for (const target of region.connectsTo ?? []) {
      if (edges.has(`${target}|${region.id}`))
        findings.push({ id: region.id, message: `the connection to ${target} is already declared by ${target}` });
      edges.add(`${region.id}|${target}`);
    }
  }
  return findings;
}

/** A faction whose parent chain loops never reaches a confederation. */
function factionCycleFindings(definitions, lookup) {
  const findings = [];
  for (const faction of definitions.filter((definition) => kindOf(definition?.id) === 'faction')) {
    const seen = new Set([faction.id]);
    for (let parent = lookup(faction.parent); parent; parent = lookup(parent.parent)) {
      if (seen.has(parent.id)) {
        findings.push({ id: faction.id, message: 'the parent chain loops' });
        break;
      }
      seen.add(parent.id);
    }
  }
  return findings;
}

/**
 * The interactions a set of definitions owns. A quest provider and every character a quest has you
 * talk to stand behind an action of the same set, so each quest can be offered and completed. A
 * greeting is the dialogue of the greeter's skin, so the greeter wears a skin of the same set.
 */
function interactionFindings(definitions) {
  const own = new Map(definitions.map((definition) => [definition?.id, definition]));
  const providers = new Set(
    definitions.filter((definition) => kindOf(definition?.id) === 'action').map(({ provider }) => provider),
  );
  const findings = [];
  for (const quest of definitions.filter((definition) => kindOf(definition?.id) === 'quest')) {
    const talkTargets = (quest.steps ?? [])
      .flatMap((step) => step?.objectives ?? [])
      .filter(({ type }) => type === 'talk')
      .map(({ target }) => target);
    for (const character of new Set([quest.provider, ...talkTargets]))
      if (character && !providers.has(character))
        findings.push({ id: quest.id, message: `${character} needs an action to offer or complete this quest` });
  }
  for (const character of definitions.filter(
    (definition) => kindOf(definition?.id) === 'character' && definition.greeting,
  )) {
    const skin = (character.loadout ?? []).find((id) => kindOf(id) === 'skin');
    if (skin && !own.has(skin))
      findings.push({ id: character.id, message: `a greeting needs a skin of its own: ${skin}` });
  }
  return findings;
}

/**
 * Validates a set of definitions.
 *
 * With a `base` registry the set extends it: references resolve against both, and an id, item
 * label or name the base already holds is a duplicate.
 *
 * @param {Object[]} definitions
 * @param {Object} [params]
 * @param {Object} [params.base] - A registry the definitions extend.
 * @returns {Array<{id:string,message:string}>} Findings, empty when valid.
 */
export function validateDefinitions(definitions, { base = null } = {}) {
  const own = new Map(
    definitions.filter((definition) => definition?.id).map((definition) => [definition.id, definition]),
  );
  const lookup = (id) => own.get(id) ?? base?.definitions.get(id);
  const findings = [];
  for (const definition of definitions) {
    const report = (message) => findings.push({ id: definition?.id ?? '(no id)', message });
    const resolve = (id, kinds, field, required = false) => {
      if (id === undefined || id === null) {
        if (required) report(`${field} is required`);
        return null;
      }
      const target = lookup(id);
      if (!target) report(`${field} names unknown definition ${id}`);
      else if (kinds && !kinds.includes(kindOf(id))) report(`${field} must name a ${kinds.join(' | ')}, not ${id}`);
      return target ?? null;
    };
    checkDefinition(definition, { report, resolve, lookup });
  }
  return [
    ...findings,
    ...duplicateFindings(definitions, base),
    ...topologyFindings(definitions),
    ...factionCycleFindings(definitions, lookup),
    ...interactionFindings(definitions),
  ];
}

/**
 * Validates the foundation manifest: its schema version, and the baseline each runtime entity
 * type resolves against when a world authors none of its own.
 *
 * @param {Object} manifest - `foundation.json`.
 * @param {(id:string)=>Object|undefined} lookup - Definition by id.
 * @returns {Array<{id:string,message:string}>}
 */
export function validateManifest(manifest, lookup) {
  const findings = [];
  const report = (message) => findings.push({ id: 'foundation.json', message });
  if (manifest?.schemaVersion !== SCHEMA_VERSION) report(`schemaVersion must be ${SCHEMA_VERSION}`);

  const baseline = manifest?.baseline ?? {};
  const fragmentation = lookup(baseline.fragmentation);
  if (!fragmentation || itemTypeOf(fragmentation) !== 'skin') report('baseline.fragmentation must name a skin');

  for (const [entityType, value] of Object.entries(baseline.entities ?? {})) {
    if (!ENTITY_TYPES.includes(entityType)) {
      report(`baseline.entities.${entityType} is not an entity type`);
      continue;
    }
    const allowed = CONTRACT.entityItemTypes[entityType];
    for (const id of [value].flat()) {
      const definition = lookup(id);
      if (!definition) {
        report(`baseline.entities.${entityType} names unknown definition ${id}`);
        continue;
      }
      const types =
        kindOf(id) === 'character'
          ? (definition.loadout ?? []).map((itemId) => itemTypeOf(lookup(itemId)))
          : [itemTypeOf(definition)];
      if (!types.every((type) => allowed.includes(type)))
        report(`baseline.entities.${entityType}: ${id} carries an item type a ${entityType} cannot hold`);
    }
  }
  return findings;
}
