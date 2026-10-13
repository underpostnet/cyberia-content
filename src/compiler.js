/**
 * The content compiler: definitions to the runtime documents the engine imports.
 *
 * Every functional field of a definition reaches a document. Render and placement stay unresolved:
 * Object Layer items carry no render, map entities no cell, and quests and actions no source map
 * or cell. Studio authors those.
 *
 * @module src/compiler.js
 */
import { CONTRACT, ENTITY_TYPES, itemDialogueCode, validateStats } from './schema/contract.js';
import { ENTITY_KINDS, isLabeled, kindOf, referenceEntries, slugOf } from './schema/definitions.js';
import { ContentError, extendRegistry } from './foundation.js';

/** Document families by artifact file name, in import order: a family names only what comes before it. */
export const FAMILIES = Object.freeze({
  objectLayers: 'object-layers',
  entityTypeDefaults: 'entity-type-defaults',
  skills: 'skills',
  maps: 'maps',
  quests: 'quests',
  dialogues: 'dialogues',
  actions: 'actions',
});

const UNPLACED_SOURCE = Object.freeze({ sourceMapCode: null, sourceCellX: null, sourceCellY: null });

/** Dialogue code of the talk of a quest. */
const questTalkCode = (questId) => `quest-talk-${slugOf(questId)}`;

/** Item label of the skin a character wears. */
const skinOf = (registry, characterId) =>
  slugOf(registry.definitions.get(characterId).loadout.find((id) => kindOf(id) === 'skin'));

/** Item label a definition answers to: a character by its skin, anything labeled by its slug. */
const labelOf = (registry, id) => (kindOf(id) === 'character' ? skinOf(registry, id) : slugOf(id));

const talkTargetsOf = (quest) =>
  quest.steps.flatMap(({ objectives }) => objectives.filter(({ type }) => type === 'talk').map(({ target }) => target));

/** Who speaks the talk of a quest: its talk targets, or its provider when it has none. */
const talkersOf = (quest) => {
  const targets = talkTargetsOf(quest);
  return targets.length > 0 ? targets : [quest.provider];
};

const entityRow = (entityType, lists = {}) => ({
  entityType,
  liveItemIds: [],
  deadItemIds: [],
  dropItemIds: [],
  inventoryItemsIds: [],
  overrideItemsIdsState: [],
  behavior: '',
  ...lists,
});

/**
 * The entity-type default of an entity definition. A character wears its loadout, carries its
 * items, drops what its entity block names and falls into the baseline Fragmentation; a
 * harvestable rotates to its depleted state and drops its yield; loot binds its pickup behavior.
 */
function entityTypeDefault(registry, definition, entityType) {
  if (kindOf(definition.id) === 'character') {
    const { type, behavior = '', drops = [] } = definition.entity;
    const rowType = entityType ?? type;
    return entityRow(rowType, {
      liveItemIds: definition.loadout.map(slugOf),
      deadItemIds: [slugOf(registry.baseline.fragmentation)],
      dropItemIds: drops.map(({ item }) => slugOf(item)),
      inventoryItemsIds: (definition.carries ?? []).map(slugOf),
      overrideItemsIdsState: drops
        .filter(({ chance, quantity }) => chance !== undefined || quantity !== undefined)
        .map(({ item, chance, quantity }) => ({
          itemId: slugOf(item),
          ...(quantity !== undefined ? { quantity } : {}),
          ...(chance !== undefined ? { dropChance: chance } : {}),
        })),
      behavior: rowType === 'bot' ? behavior : '',
    });
  }
  const { harvest } = definition;
  const rowType = entityType ?? definition.objectLayer.itemType;
  return entityRow(rowType, {
    liveItemIds: [slugOf(definition.id)],
    deadItemIds: harvest ? [slugOf(harvest.depleted)] : [],
    dropItemIds: harvest ? [slugOf(harvest.yields)] : [],
    behavior: rowType === 'loot' ? (definition.loot ?? '') : '',
  });
}

/** What a map places for an entity definition: its entity type and the items it holds. */
const entitySignature = (definition) =>
  kindOf(definition.id) === 'character'
    ? { entityType: definition.entity.type, objectLayerItemIds: definition.loadout.map(slugOf) }
    : { entityType: definition.objectLayer.itemType, objectLayerItemIds: [slugOf(definition.id)] };

/** The entity a skill of `ability` stores: none when its logic summons the trigger item, which the runtime resolves. */
function summonedEntityOf(ability) {
  if (CONTRACT.skillLogic.find(({ id }) => id === ability.logicEventId).summonsTrigger) return '';
  return ability.summons ? slugOf(ability.summons) : CONTRACT.casterSkinPlaceholder;
}

/**
 * The CyberiaSkill documents of definitions: one per item whose abilities name an executable
 * logic event.
 */
function skills(registry, definitions) {
  const documents = [];
  for (const definition of definitions) {
    if (!isLabeled(definition.id) || !definition.abilities?.length) continue;
    const entries = definition.abilities
      .map((id) => registry.definitions.get(id))
      .filter((ability) => ability.logicEventId)
      .map((ability) => ({
        logicEventId: ability.logicEventId,
        name: ability.name,
        description: ability.description,
        summonedEntityItemId: summonedEntityOf(ability),
      }));
    if (entries.length === 0) continue;
    documents.push({
      triggerItemId: slugOf(definition.id),
      logicEventIds: [...new Set(entries.map((entry) => entry.logicEventId))],
      skills: entries,
    });
  }
  return documents;
}

const lineDocuments = (code, speaker, lines) =>
  lines.map(({ text, mood = 'neutral' }, order) => ({ code, order, speaker, text, mood }));

/**
 * The dialogues of definitions: every item's flavor text, a character's greeting on the skin it
 * wears, and the talk of every quest.
 */
function dialogues(registry, definitions) {
  const greeters = new Map(
    definitions
      .filter((definition) => kindOf(definition.id) === 'character' && definition.greeting)
      .map((character) => [skinOf(registry, character.id), character]),
  );
  return [
    ...definitions
      .filter(({ id }) => isLabeled(id))
      .flatMap((definition) => {
        const label = slugOf(definition.id);
        const greeter = greeters.get(label);
        return greeter
          ? lineDocuments(itemDialogueCode(label), greeter.name, greeter.greeting)
          : lineDocuments(itemDialogueCode(label), definition.name, [{ text: definition.description }]);
      }),
    ...definitions
      .filter((definition) => kindOf(definition.id) === 'quest' && definition.talk)
      .flatMap((quest) =>
        lineDocuments(questTalkCode(quest.id), registry.definitions.get(talkersOf(quest)[0]).name, quest.talk),
      ),
  ];
}

const itemStack = ({ item, quantity }) => ({ itemId: slugOf(item), qty: quantity });

/** Documents of one definition kind. */
const ofKind = (definitions, kind) => definitions.filter((definition) => kindOf(definition.id) === kind);

/**
 * The document families of definitions, against the registry that resolves them.
 * @param {Object} registry - Registry that holds the definitions and everything they name.
 * @param {Object[]} definitions - The definitions to compile.
 * @returns {Object<string,Object[]>} One document list per {@link FAMILIES} key.
 */
function compileDefinitions(registry, definitions) {
  const quests = ofKind(definitions, 'quest');
  return {
    objectLayers: definitions
      .filter(({ id }) => isLabeled(id))
      .map(({ id, description, objectLayer: { itemType, activable, stats } }) => ({
        id,
        itemId: slugOf(id),
        payload: {
          data: { item: { id: slugOf(id), type: itemType, description, activable }, stats: validateStats(stats) },
        },
      })),
    entityTypeDefaults: [
      ...definitions
        .filter(({ id }) => ENTITY_KINDS.includes(kindOf(id)))
        .map((definition) => entityTypeDefault(registry, definition)),
      ...definitions.filter(({ loot }) => loot).map((definition) => entityTypeDefault(registry, definition, 'loot')),
    ],
    skills: skills(registry, definitions),
    maps: ofKind(definitions, 'map').map((map) => {
      const biome = registry.definitions.get(map.biome);
      return {
        code: slugOf(map.id),
        name: map.name,
        description: map.description,
        tags: [slugOf(biome.id), slugOf(biome.region)],
      };
    }),
    quests: quests.map((quest) => ({
      code: slugOf(quest.id),
      title: quest.name,
      description: quest.description,
      prerequisiteCodes: (quest.prerequisites ?? []).map(slugOf),
      unlocksQuestCodes: (quest.unlocks ?? []).map(slugOf),
      ...UNPLACED_SOURCE,
      steps: quest.steps.map(({ id, description, objectives }) => ({
        id,
        description,
        objectives: objectives.map(({ type, target, quantity }) => ({
          type,
          itemId: labelOf(registry, target),
          quantity,
        })),
      })),
      rewards: (quest.rewards ?? []).map(({ item, quantity }) => ({ itemId: slugOf(item), quantity })),
    })),
    dialogues: dialogues(registry, definitions),
    actions: ofKind(definitions, 'action').map((action) => ({
      code: slugOf(action.id),
      label: action.name,
      dialogCode: itemDialogueCode(skinOf(registry, action.provider)),
      ...UNPLACED_SOURCE,
      questDialogueCodes: quests
        .filter((quest) => quest.talk && talkersOf(quest).includes(action.provider))
        .map((quest) => ({ questCode: slugOf(quest.id), dialogCode: questTalkCode(quest.id) })),
      shopItems: (action.shop ?? []).map(({ item, price, quantity }) => ({
        itemId: slugOf(item),
        priceItemId: slugOf(price),
        priceQty: quantity,
      })),
      craftRecipes: (action.recipes ?? []).map(({ outputs, ingredients, timeMs = 0 }) => ({
        outputItems: outputs.map(itemStack),
        ingredients: ingredients.map(itemStack),
        craftTimeMs: timeMs,
      })),
      storageSlots: action.storageSlots ?? 0,
    })),
  };
}

/**
 * The entity-type defaults every world resolves against for an entity type it does not author:
 * one row per baseline definition, and an empty row for a type the baseline leaves open.
 * @param {Object} registry - Foundation registry.
 * @returns {Object[]} Rows in entity-type order.
 */
function compileBaseline(registry) {
  const { entities = {} } = registry.baseline;
  return ENTITY_TYPES.flatMap((entityType) => {
    const ids = [entities[entityType] ?? []].flat();
    if (ids.length === 0) return [entityRow(entityType)];
    return ids.map((id) => entityTypeDefault(registry, registry.definitions.get(id), entityType));
  });
}

const defaultKey = ({ entityType, liveItemIds }) => `${entityType}|${liveItemIds.join(',')}`;

/**
 * The foundation as runtime documents, its baseline, and the item label each item type gives a new
 * item its function from. Its entity-type defaults hold every entity definition and every baseline
 * row that carries an item, once each.
 * @param {Object} registry - Foundation registry.
 * @returns {{families:Object<string,Object[]>, baseline:Object[], itemBaseline:Object<string,string>}}
 */
export function compileFoundation(registry) {
  const families = compileDefinitions(registry, [...registry.definitions.values()]);
  const baseline = compileBaseline(registry);
  const keys = new Set(families.entityTypeDefaults.map(defaultKey));
  for (const row of baseline.filter(({ liveItemIds }) => liveItemIds.length > 0))
    if (!keys.has(defaultKey(row))) {
      keys.add(defaultKey(row));
      families.entityTypeDefaults.push(row);
    }
  const itemBaseline = Object.fromEntries(
    Object.entries(registry.baseline.items ?? {}).map(([itemType, id]) => [itemType, slugOf(id)]),
  );
  return { families, baseline, itemBaseline };
}

/**
 * A saga as runtime documents: the families of its own definitions, its CyberiaSaga record and
 * the shell of its instance. Its entity-type defaults also cover each foundation entity its maps
 * place, so its instance runs every entity it holds.
 * @param {Object} pkg - A saga package the validator accepts.
 * @param {Object} registry - Foundation registry.
 * @returns {{saga:Object, instance:Object, families:Object<string,Object[]>}}
 */
export function compileSaga(pkg, registry) {
  const extended = extendRegistry(registry, pkg.definitions);
  const maps = ofKind(pkg.definitions, 'map');
  const mapOf = (characterId) =>
    slugOf(maps.find((map) => map.composition.some(({ entity }) => entity === characterId))?.id ?? '');
  const labeled = [...pkg.references, ...pkg.definitions.map(({ id }) => id)].filter(
    (id) => isLabeled(id) || kindOf(id) === 'character',
  );
  const families = compileDefinitions(extended, pkg.definitions);
  const own = new Set(pkg.definitions.map(({ id }) => id));
  for (const id of new Set(maps.flatMap(({ composition }) => composition.map(({ entity }) => entity))))
    if (!own.has(id)) families.entityTypeDefaults.push(entityTypeDefault(extended, extended.definitions.get(id)));
  const saga = {
    ...pkg.saga,
    foundationVersion: pkg.foundationVersion,
    references: pkg.references,
    definitions: pkg.definitions,
    mapCodes: maps.map(({ id }) => slugOf(id)),
    itemIds: [...new Set(labeled.map((id) => labelOf(extended, id)))].sort(),
    questCodes: ofKind(pkg.definitions, 'quest').map((quest) => ({
      providerSkinItemId: skinOf(extended, quest.provider),
      questCode: slugOf(quest.id),
      mapCode: mapOf(quest.provider),
    })),
    actionCodes: ofKind(pkg.definitions, 'action').map((action) => ({
      providerSkinItemId: skinOf(extended, action.provider),
      actionCode: slugOf(action.id),
      mapCode: mapOf(action.provider),
    })),
  };
  return {
    saga,
    instance: {
      code: saga.code,
      name: saga.name,
      description: saga.description,
      tags: ['saga', 'generated'],
      cyberiaMapCodes: saga.mapCodes,
      portals: [],
      topologyMode: 'procedural',
    },
    families,
  };
}

/**
 * The context index of the authoring tools: every definition of the foundation and of each saga,
 * where it comes from, the item label and the map entity it answers to, and every reference in
 * both directions with the field that makes it.
 * @param {Object} registry - Foundation registry.
 * @param {Map<string,Object>} sagas - Saga packages by code.
 * @returns {{definitions:Object<string,Object>, sources:Object<string,string>, labels:Object<string,string>,
 *   entities:Object<string,Object>, references:Object<string,Object[]>, referencedBy:Object<string,Object[]>}}
 * @throws {ContentError} When two sagas define one id or one item label.
 */
export function compileContext(registry, sagas) {
  const index = { definitions: {}, sources: {}, labels: {}, entities: {}, references: {}, referencedBy: {} };
  const findings = [];
  const add = (definition, source) => {
    const { id } = definition;
    const label = isLabeled(id) ? slugOf(id) : '';
    if (index.definitions[id] || (label && index.labels[label])) {
      findings.push({
        id,
        message: `saga ${source} repeats ${label ? 'an item label' : 'an id'} of ${index.sources[id] ?? index.sources[index.labels[label]]}`,
      });
      return;
    }
    index.definitions[id] = definition;
    index.sources[id] = source;
    if (label) index.labels[label] = id;
    if (ENTITY_KINDS.includes(kindOf(id))) index.entities[id] = entitySignature(definition);
  };
  for (const definition of registry.definitions.values()) add(definition, 'foundation');
  for (const [code, pkg] of sagas) for (const definition of pkg.definitions) add(definition, code);
  if (findings.length > 0) throw new ContentError(findings);

  for (const id of Object.keys(index.definitions)) {
    const seen = new Set();
    index.references[id] = referenceEntries(index.definitions[id]).filter(({ field, id: target }) => {
      const key = `${field}|${target}`;
      return !seen.has(key) && seen.add(key);
    });
    for (const { field, id: target } of index.references[id]) (index.referencedBy[target] ??= []).push({ field, id });
  }
  return index;
}
