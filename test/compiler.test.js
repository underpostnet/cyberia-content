import { describe, it, expect } from 'vitest';
import { FAMILIES, compileContext, compileFoundation, compileSaga } from '../src/compiler.js';
import { createRegistry, definitionsOfKind } from '../src/foundation.js';
import { CONTRACT, ENTITY_TYPES } from '../src/schema/contract.js';
import { ENTITY_KINDS, isLabeled, kindOf, slugOf } from '../src/schema/definitions.js';
import { readContent } from '../src/validation/content.js';
import { minimalDefinitions, minimalManifest, zero } from './fixtures.js';

const PLACEMENT_KEYS = ['initCellX', 'initCellY', 'sourceMapCode', 'sourceCellX', 'sourceCellY'];
const RENDER_KEYS = ['render', 'renderFrames', 'frames', 'atlas', 'pixels', 'cid', 'metadataCid', 'dimX', 'dimY'];

/** Every key path of a value, with the value it holds. */
const entries = (value, path = '') => {
  if (Array.isArray(value)) return value.flatMap((entry, index) => entries(entry, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [[path, value]];
  return Object.entries(value).flatMap(([key, entry]) => entries(entry, path ? `${path}.${key}` : key));
};
const keyOf = (path) =>
  path
    .split('.')
    .pop()
    .replace(/\[\d+\]$/, '');

describe('the compiled minimal foundation', () => {
  const registry = createRegistry({ manifest: minimalManifest(), definitions: minimalDefinitions() });
  const { families, baseline } = compileFoundation(registry);

  it('produces every document family', () => {
    expect(Object.keys(families)).toEqual(Object.keys(FAMILIES));
    for (const [family, documents] of Object.entries(families)) expect(documents.length, family).toBeGreaterThan(0);
  });

  it('materializes a labeled definition as an Object Layer item without render', () => {
    expect(families.objectLayers.find(({ itemId }) => itemId === 'chit')).toEqual({
      id: 'currency.chit',
      itemId: 'chit',
      payload: {
        data: {
          item: { id: 'chit', type: 'coin', description: 'The currency.chit.', activable: false },
          stats: zero,
        },
      },
    });
  });

  it('compiles a map without entities: Studio places them', () => {
    expect(families.maps).toEqual([
      { code: 'glade', name: 'glade', description: 'The map.glade.', tags: ['meadow', 'home'] },
    ]);
  });

  it('derives one entity-type default per entity definition, and the baseline', () => {
    const row = (entityType, live) =>
      families.entityTypeDefaults.find((entry) => entry.entityType === entityType && entry.liveItemIds.join() === live);
    expect(row('bot', 'walker,gun')).toEqual({
      entityType: 'bot',
      liveItemIds: ['walker', 'gun'],
      deadItemIds: ['shards'],
      dropItemIds: ['chit'],
      inventoryItemsIds: ['chit'],
      overrideItemsIdsState: [{ itemId: 'chit', quantity: 2, dropChance: 0.5 }],
      behavior: 'provider',
    });
    expect(row('resource', 'oak')).toMatchObject({ deadItemIds: ['oak-stump'], dropItemIds: ['log'] });
    expect(row('player', 'walker,gun')).toMatchObject({ deadItemIds: ['shards'], behavior: '' });
    expect(new Set(baseline.map(({ entityType }) => entityType))).toEqual(new Set(ENTITY_TYPES));
  });

  it('projects skills, quests, actions and dialogues with item labels and dialogue codes', () => {
    expect(families.skills).toEqual([
      {
        triggerItemId: 'gun',
        logicEventIds: ['projectile'],
        skills: [
          { logicEventId: 'projectile', name: 'shot', description: 'The ability.shot.', summonedEntityItemId: 'bolt' },
        ],
      },
    ]);
    expect(families.quests).toEqual([
      {
        code: 'logs',
        title: 'logs',
        description: 'The quest.logs.',
        prerequisiteCodes: [],
        unlocksQuestCodes: [],
        sourceMapCode: null,
        sourceCellX: null,
        sourceCellY: null,
        steps: [
          { id: 'cut', description: 'Cut logs.', objectives: [{ type: 'collect', itemId: 'log', quantity: 2 }] },
          { id: 'report', description: 'Report back.', objectives: [{ type: 'talk', itemId: 'walker', quantity: 1 }] },
        ],
        rewards: [{ itemId: 'chit', quantity: 3 }],
      },
    ]);
    expect(families.actions).toEqual([
      {
        code: 'walker-post',
        label: 'walker-post',
        dialogCode: 'default-walker',
        sourceMapCode: null,
        sourceCellX: null,
        sourceCellY: null,
        questDialogueCodes: [{ questCode: 'logs', dialogCode: 'quest-talk-logs' }],
        shopItems: [{ itemId: 'gun', priceItemId: 'chit', priceQty: 4 }],
        craftRecipes: [
          { outputItems: [{ itemId: 'gun', qty: 1 }], ingredients: [{ itemId: 'log', qty: 2 }], craftTimeMs: 1000 },
        ],
        storageSlots: 0,
      },
    ]);
    const lines = (code) => families.dialogues.filter((dialogue) => dialogue.code === code);
    expect(lines('default-walker')).toEqual([
      { code: 'default-walker', order: 0, speaker: 'walker', text: 'Hello.', mood: 'happy' },
    ]);
    expect(lines('quest-talk-logs')).toEqual([
      { code: 'quest-talk-logs', order: 0, speaker: 'walker', text: 'Thanks.', mood: 'neutral' },
    ]);
    expect(lines('default-chit')).toEqual([
      { code: 'default-chit', order: 0, speaker: 'chit', text: 'The currency.chit.', mood: 'neutral' },
    ]);
  });
});

describe('the compiled foundation', () => {
  const registry = createRegistry();
  const { families, baseline, itemBaseline } = compileFoundation(registry);
  const labels = new Set(families.objectLayers.map(({ itemId }) => itemId));
  const dialogueCodes = new Set(families.dialogues.map(({ code }) => code));

  it('names, for each baseline item type, the Object Layer item a new item takes its function from', () => {
    expect(itemBaseline).toEqual({ skin: 'drifter' });
    for (const [itemType, itemId] of Object.entries(itemBaseline))
      expect(families.objectLayers.find((item) => item.itemId === itemId).payload.data.item.type).toBe(itemType);
  });

  it('produces every document family, beyond Object Layer items', () => {
    for (const family of Object.keys(FAMILIES)) expect(families[family].length, family).toBeGreaterThan(0);
    expect(families.maps).toHaveLength(definitionsOfKind(registry, 'map').length);
    expect(families.quests).toHaveLength(1);
    expect(families.actions).toHaveLength(1);
  });

  it('holds an entity-type default for every entity definition and every baseline row', () => {
    const keys = new Set(
      families.entityTypeDefaults.map(({ entityType, liveItemIds }) => `${entityType}|${liveItemIds}`),
    );
    const entityDefinitions = [...registry.definitions.values()].filter(({ id }) => ENTITY_KINDS.includes(kindOf(id)));
    expect(families.entityTypeDefaults.length).toBeGreaterThanOrEqual(entityDefinitions.length);
    for (const row of baseline.filter(({ liveItemIds }) => liveItemIds.length > 0))
      expect(keys.has(`${row.entityType}|${row.liveItemIds}`), row.entityType).toBe(true);
    for (const row of families.entityTypeDefaults) {
      expect(ENTITY_TYPES).toContain(row.entityType);
      if (row.entityType === 'bot') expect(CONTRACT.entityBehaviors, row.liveItemIds.join()).toContain(row.behavior);
    }
  });

  it('keeps every relationship resolvable: items, dialogues and quest mappings', () => {
    const named = [
      ...families.entityTypeDefaults.flatMap((row) => [
        ...row.liveItemIds,
        ...row.deadItemIds,
        ...row.dropItemIds,
        ...row.inventoryItemsIds,
      ]),
      ...families.skills.flatMap(({ triggerItemId, skills }) => [
        triggerItemId,
        ...skills.map(({ summonedEntityItemId }) => summonedEntityItemId),
      ]),
      ...families.quests.flatMap(({ steps, rewards }) => [
        ...steps.flatMap(({ objectives }) => objectives.map(({ itemId }) => itemId)),
        ...rewards.map(({ itemId }) => itemId),
      ]),
      ...families.actions.flatMap(({ shopItems, craftRecipes }) => [
        ...shopItems.flatMap(({ itemId, priceItemId }) => [itemId, priceItemId]),
        ...craftRecipes.flatMap(({ outputItems, ingredients }) =>
          [...outputItems, ...ingredients].map(({ itemId }) => itemId),
        ),
      ]),
    ].filter((itemId) => itemId !== CONTRACT.casterSkinPlaceholder);
    for (const itemId of named) expect(labels.has(itemId), itemId).toBe(true);

    const quests = new Set(families.quests.map(({ code }) => code));
    for (const action of families.actions) {
      expect(dialogueCodes.has(action.dialogCode), action.dialogCode).toBe(true);
      for (const { questCode, dialogCode } of action.questDialogueCodes) {
        expect(quests.has(questCode)).toBe(true);
        expect(dialogueCodes.has(dialogCode), dialogCode).toBe(true);
      }
    }
    for (const quest of families.quests)
      for (const { type } of quest.steps.flatMap(({ objectives }) => objectives))
        if (type === 'talk')
          expect(
            families.actions.some(({ questDialogueCodes }) =>
              questDialogueCodes.some((m) => m.questCode === quest.code),
            ),
          ).toBe(true);
  });

  it('leaves placement unresolved and holds no render, CID or coordinate', () => {
    for (const [family, documents] of Object.entries(families))
      for (const [path, value] of entries(documents)) {
        const key = keyOf(path);
        expect(RENDER_KEYS, `${family} ${path}`).not.toContain(key);
        if (PLACEMENT_KEYS.includes(key)) expect(value, `${family} ${path}`).toBe(null);
        if (typeof value === 'string')
          expect(value, `${family} ${path}`).not.toMatch(/^(Qm[1-9A-Za-z]{44}|bafy[a-z2-7]+)$/);
      }
    for (const map of families.maps) expect(map).not.toHaveProperty('gridX');
  });

  it('labels an entity by its definition slug, and a character by the skin it wears', () => {
    for (const { liveItemIds } of families.entityTypeDefaults.filter(({ liveItemIds }) => liveItemIds.length > 0))
      expect(registry.byItemId.has(liveItemIds[0])).toBe(true);
    const quest = families.quests[0];
    const talk = quest.steps.flatMap(({ objectives }) => objectives).find(({ type }) => type === 'talk');
    expect(talk.itemId).toBe(slugOf(registry.definitions.get('character.drift-merchant').loadout[0]));
  });
});

describe('the context index', () => {
  const { registry, sagas } = readContent();
  const index = compileContext(registry, sagas);
  const maps = Object.values(index.definitions).filter(({ id }) => kindOf(id) === 'map');

  it('holds every definition of the foundation and the sagas, with its source', () => {
    expect(Object.keys(index.definitions)).toHaveLength(
      registry.definitions.size + [...sagas.values()].reduce((total, pkg) => total + pkg.definitions.length, 0),
    );
    for (const [code, pkg] of sagas) for (const { id } of pkg.definitions) expect(index.sources[id]).toBe(code);
    for (const id of registry.definitions.keys()) expect(index.sources[id]).toBe('foundation');
  });

  it('resolves each item label to its definition, and each composed entity to its signature', () => {
    for (const [label, id] of Object.entries(index.labels)) {
      expect(isLabeled(id)).toBe(true);
      expect(slugOf(id)).toBe(label);
    }
    for (const map of maps)
      for (const { entity } of map.composition)
        expect(index.entities[entity], `${map.id} ${entity}`).toMatchObject({
          entityType: expect.any(String),
          objectLayerItemIds: expect.any(Array),
        });
  });

  it('answers who names a composed floor: its maps by composition, and its biome by location', () => {
    const floors = Object.keys(index.definitions).filter((id) =>
      maps.some(({ composition }) => composition.some(({ entity }) => entity === id && kindOf(id) === 'floor')),
    );
    expect(floors.length).toBeGreaterThan(0);
    for (const floor of floors) {
      const users = maps.filter(({ composition }) => composition.some(({ entity }) => entity === floor));
      expect(
        index.referencedBy[floor].filter(({ field }) => field === 'composition.entity').map(({ id }) => id),
      ).toEqual(users.map(({ id }) => id));
      for (const biome of index.definitions[floor].locations.filter((id) => kindOf(id) === 'biome')) {
        expect(index.references[floor]).toContainEqual({ field: 'locations', id: biome });
        expect(index.referencedBy[biome]).toContainEqual({ field: 'locations', id: floor });
      }
    }
  });

  it('keeps every reference in both directions', () => {
    for (const [id, references] of Object.entries(index.references))
      for (const { field, id: target } of references) expect(index.referencedBy[target]).toContainEqual({ field, id });
  });

  it('refuses two sagas that define one id', () => {
    const [pkg] = sagas.values();
    const twice = new Map([...sagas, ['copy', { ...pkg, saga: { ...pkg.saga, code: 'copy' } }]]);
    expect(() => compileContext(registry, twice)).toThrow(/saga copy repeats/);
    expect(compileSaga(pkg, registry).saga.code).toBe(pkg.saga.code);
  });
});
