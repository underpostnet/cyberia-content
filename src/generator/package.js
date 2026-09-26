/**
 * The package of a saga: the definitions it adds to the foundation and the foundation ids they
 * name. A package uses the definition model of the foundation, so the compiler turns both into
 * the same runtime documents. It carries no spatial and no render data.
 *
 * @module src/generator/package.js
 */
import { clampStats } from '../schema/contract.js';
import {
  COLOR_PATTERN,
  COMMON_FIELDS,
  FOUNDATION_KINDS,
  KINDS,
  SLUG_PATTERN,
  isLabeled,
  kindOf,
  referencesOf,
  slugOf,
} from '../schema/definitions.js';
import { validateDefinitions } from '../validation/definitions.js';

/** Version of the package format. */
export const PACKAGE_SCHEMA_VERSION = 2;

/** A content version: `major.minor.patch`. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const PACKAGE_KEYS = Object.freeze(['schemaVersion', 'foundationVersion', 'saga', 'references', 'definitions']);
const SAGA_KEYS = Object.freeze(['code', 'name', 'description']);

/** Item types a runtime entity activates when it holds them. */
const ACTIVABLE_TYPES = Object.freeze(['skin', 'breastplate', 'weapon', 'skill']);

/**
 * Slugify a free-text string into a stable kebab-case code.
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (list) => (list.length > 0 ? list : undefined);

/** A definition id as `<kind>.<slug>`, whatever case or spacing the model used. */
const normalizeRef = (value) => {
  const raw = text(value).toLowerCase();
  const kind = kindOf(raw);
  return KINDS[kind] ? `${kind}.${slugify(slugOf(raw))}` : raw || undefined;
};

const normalizeObjectLayer = (layer, kind) => {
  const { itemTypes } = KINDS[kind];
  const itemType = itemTypes.includes(layer?.itemType) ? layer.itemType : itemTypes[0];
  return {
    itemType,
    activable: typeof layer?.activable === 'boolean' ? layer.activable : ACTIVABLE_TYPES.includes(itemType),
    stats: clampStats(layer?.stats, itemType),
  };
};

/** A value repaired to its field spec, or undefined when nothing of it survives. */
function normalizeValue(spec, value, kind) {
  if (value === undefined || value === null) return undefined;
  switch (spec.type) {
    case 'string':
      return text(value) || undefined;
    case 'strings':
      return nonEmpty(asArray(value).map(text).filter(Boolean));
    case 'enum':
      return spec.values.find((entry) => entry === text(value).toLowerCase());
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'color':
      return COLOR_PATTERN.test(text(value).toLowerCase()) ? text(value).toLowerCase() : undefined;
    case 'integer': {
      const number = Math.floor(Number(value));
      return Number.isFinite(number) ? Math.max(spec.min, number) : undefined;
    }
    case 'number': {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(spec.max, Math.max(spec.min, number)) : undefined;
    }
    case 'ref':
      return normalizeRef(value);
    case 'refs':
      return nonEmpty([...new Set(asArray(value).map(normalizeRef).filter(Boolean))]);
    case 'object':
      return normalizeFields(spec.fields, value, kind);
    case 'list':
      return nonEmpty(
        asArray(value)
          .map((entry) => normalizeValue(spec.of, entry, kind))
          .filter((entry) => entry !== undefined),
      );
    case 'objectLayer':
      return normalizeObjectLayer(value, kind);
    default:
      return undefined;
  }
}

/** The declared fields of an object, each one repaired; undefined when none survives. */
function normalizeFields(fields, value, kind) {
  if (!isPlainObject(value)) return undefined;
  const entries = Object.entries(fields)
    .map(([key, spec]) => [key, normalizeValue(spec, value[key], kind)])
    .filter(([, entry]) => entry !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * One generated definition with only the fields its kind declares, each one repaired to its spec.
 * @param {Object} raw
 * @returns {Object|null} Null for an unknown kind, or a kind only the foundation defines.
 */
function normalizeDefinition(raw) {
  const id = normalizeRef(raw?.id);
  const kind = kindOf(id);
  if (!KINDS[kind] || FOUNDATION_KINDS.includes(kind)) return null;
  const definition = { ...normalizeFields({ ...COMMON_FIELDS, ...KINDS[kind].fields }, raw, kind), id };
  if (isLabeled(id)) definition.objectLayer ??= normalizeObjectLayer({}, kind);
  return definition;
}

/** The characters a quest sends the player to talk to. */
export const talkTargetsOf = (quest) =>
  (quest.steps ?? []).flatMap(({ objectives = [] }) =>
    objectives.filter(({ type }) => type === 'talk').map(({ target }) => target),
  );

/**
 * The entries of a stage answer the package takes: a new definition of a kind the stage creates,
 * or fields for a definition the saga holds. Any other id would become a definition without the
 * fields its kind needs.
 * @param {Object} answer - A stage answer: `{ definitions }`.
 * @param {Object} scope
 * @param {string[]} scope.kinds - The kinds the stage creates.
 * @param {Set<string>} scope.existing - The ids the saga holds.
 * @returns {Object[]}
 */
export const stageDefinitions = (answer, { kinds, existing }) =>
  asArray(answer?.definitions).filter((entry) => {
    const id = normalizeRef(entry?.id);
    return existing.has(id) || kinds.includes(kindOf(id));
  });

/**
 * Makes each interaction of a saga complete: a map places an entity once, a greeting speaks for a
 * skin of the saga, a quest with a talk objective has talk, and each quest provider and talk target
 * stands behind an action of the saga.
 */
function completeInteractions(definitions, { registry, saga }) {
  const lookup = (id) => definitions.get(id) ?? registry.definitions.get(id);
  for (const definition of definitions.values()) {
    const kind = kindOf(definition.id);
    if (kind === 'map' && definition.composition) {
      const counts = new Map();
      for (const { entity, count = 1 } of definition.composition.filter((entry) => entry.entity))
        counts.set(entity, (counts.get(entity) ?? 0) + count);
      definition.composition = [...counts].map(([entity, count]) => ({ entity, count }));
    }
    if (kind === 'character' && definition.greeting) {
      const skin = (definition.loadout ?? []).find((id) => kindOf(id) === 'skin');
      if (!definitions.has(skin)) delete definition.greeting;
    }
    if (kind === 'quest' && talkTargetsOf(definition).length > 0)
      definition.talk ??= [{ text: `${definition.name}: report received.` }];
  }
  const providers = new Set(
    [...definitions.values()].filter(({ id }) => kindOf(id) === 'action').map(({ provider }) => provider),
  );
  const quests = [...definitions.values()].filter(({ id }) => kindOf(id) === 'quest');
  for (const character of new Set(quests.flatMap((quest) => [quest.provider, ...talkTargetsOf(quest)]))) {
    const definition = lookup(character);
    if (!definition || providers.has(character)) continue;
    const id = `action.${slugOf(character)}-${saga.code}`;
    definitions.set(id, {
      id,
      name: `${definition.name} of ${saga.name}`,
      description: `${definition.name} offers and completes the quests of ${saga.name}.`,
      role: `The quest post of ${definition.name}.`,
      provider: character,
    });
    providers.add(character);
  }
}

/**
 * Normalize raw stage output, or a package file, into a package.
 *
 * Deterministic and idempotent. Only declared fields survive, so no spatial or render key can. A
 * definition that repeats a foundation id is a reference, not a new definition. A repeated saga id
 * adds only the fields the earlier definition lacks. `references` is the set of foundation ids the
 * definitions name. A package keeps the foundation version it was composed against.
 *
 * @param {Object} raw - `{ saga, definitions }`.
 * @param {Object} params
 * @param {Object} params.registry - Foundation registry.
 * @param {string} [params.theme] - Theme seed, the fallback for the saga name and code.
 * @returns {Object} The package.
 */
export function normalizePackage(raw, { registry, theme = '' }) {
  const saga = {
    code: slugify(raw?.saga?.code) || slugify(raw?.saga?.name) || slugify(theme),
    name: text(raw?.saga?.name) || text(theme),
    description: text(raw?.saga?.description),
  };
  saga.name ||= saga.code;

  const definitions = new Map();
  for (const entry of asArray(raw?.definitions)) {
    const definition = normalizeDefinition(entry);
    if (!definition || registry.definitions.has(definition.id)) continue;
    const earlier = definitions.get(definition.id);
    definitions.set(definition.id, earlier ? normalizeDefinition({ ...definition, ...earlier }) : definition);
  }
  completeInteractions(definitions, { registry, saga });

  const sorted = [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    foundationVersion: VERSION_PATTERN.test(raw?.foundationVersion ?? '')
      ? raw.foundationVersion
      : registry.contentVersion,
    saga,
    references: [...referencesOf(sorted)].filter((id) => registry.definitions.has(id)).sort(),
    definitions: sorted,
  };
}

/**
 * Every finding of a package against the foundation.
 * @param {Object} pkg - A package.
 * @param {Object} registry - Foundation registry.
 * @returns {Array<{id:string,message:string}>} Findings, empty when the package compiles.
 */
export function validatePackage(pkg, registry) {
  const findings = [];
  const report = (message) => findings.push({ id: 'package', message });
  if (!isPlainObject(pkg)) return [{ id: 'package', message: 'a package must be an object' }];
  const unknown = [
    ...Object.keys(pkg).filter((key) => !PACKAGE_KEYS.includes(key)),
    ...Object.keys(pkg.saga ?? {})
      .filter((key) => !SAGA_KEYS.includes(key))
      .map((key) => `saga.${key}`),
  ];
  if (unknown.length > 0) report(`unknown field(s): ${unknown.join(', ')}`);
  if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION) report(`schemaVersion must be ${PACKAGE_SCHEMA_VERSION}`);
  if (!VERSION_PATTERN.test(pkg.foundationVersion ?? '')) report('foundationVersion must be a content version');
  if (!SLUG_PATTERN.test(pkg.saga?.code ?? '')) report('saga.code must be a lowercase kebab-case slug');
  if (!text(pkg.saga?.name)) report('saga.name is required');
  if (!Array.isArray(pkg.definitions) || !Array.isArray(pkg.references)) {
    report('definitions and references must be lists');
    return findings;
  }

  for (const { id } of pkg.definitions)
    if (FOUNDATION_KINDS.includes(kindOf(id)))
      findings.push({ id, message: `a saga cannot define a ${kindOf(id)}; the foundation owns the world` });
  findings.push(...validateDefinitions(pkg.definitions, { base: registry }));

  const expected = [...referencesOf(pkg.definitions)].filter((id) => registry.definitions.has(id)).sort();
  if (JSON.stringify(pkg.references) !== JSON.stringify(expected))
    report(`references must list the foundation ids the definitions name: ${expected.join(', ')}`);
  return findings;
}
