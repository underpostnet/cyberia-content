import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FAMILIES, compileFoundation, compileSaga } from '../src/compiler.js';
import { CONTENT_ROOT, createRegistry } from '../src/foundation.js';
import { PACKAGE_SCHEMA_VERSION, normalizePackage, slugify, validatePackage } from '../src/generator/package.js';
import { GENERATED_KINDS, foundationCatalog } from '../src/generator/prompts.js';
import { FOUNDATION_KINDS } from '../src/schema/definitions.js';
import { forbiddenKeyPaths } from '../src/validation/definitions.js';
import { canonicalJson } from '../src/validation/format.js';
import { brief } from './fixtures.js';

const registry = createRegistry();

// What a model might answer: new definitions mixed with a re-declared foundation one, a world
// definition it may not make, spatial and render fields it was told never to write, and later
// stages that add fields to an earlier definition.
const rawPackage = () => ({
  saga: { code: 'The Last Signal!', name: 'The Last Signal', description: 'A relay goes quiet.' },
  definitions: [
    {
      id: 'weapon.ash-repeater',
      name: 'Ash Repeater',
      description: 'A repeater rebuilt from salvage.',
      role: 'The weapon of the saga.',
      artBrief: { ...brief, frames: [[1]] },
      objectLayer: {
        itemId: 'repeater',
        itemType: 'weapon',
        stats: { effect: 99, agility: 'fast' },
        render: { cid: 'x' },
      },
      render: { cid: 'x' },
      initCellX: 3,
    },
    {
      id: 'Skin.Mara Vex',
      name: 'Mara Vex',
      description: 'A relay keeper in ash-grey layers.',
      role: 'The look of Mara Vex.',
      artBrief: brief,
      objectLayer: { itemType: 'skin', stats: { effect: 1, resistance: 4 } },
    },
    {
      id: 'character.mara-vex',
      name: 'Mara Vex',
      description: 'The keeper of the last relay of the Ash Wastes.',
      role: 'The quest giver of the saga.',
      locations: ['biome.ash-wastes'],
      archetype: 'recurring',
      voice: 'Dry and patient.',
      loadout: ['skin.mara-vex', 'weapon.ash-repeater'],
      entity: { type: 'bot', behavior: 'Provider', level: '3.7' },
    },
    { id: 'currency.coin', name: 'A second coin' },
    { id: 'biome.ember-flats', name: 'Ember Flats' },
    {
      id: 'map.relay-camp',
      name: 'Relay Camp',
      description: 'A camp by the relay.',
      role: 'The hub of the saga.',
      biome: 'biome.ash-wastes',
      gridX: 20,
      composition: [
        { entity: 'floor.ash-crust', count: 1 },
        { entity: 'character.mara-vex', count: 1 },
        { entity: 'character.ash-raider', count: 2 },
        { entity: 'character.ash-raider', count: 1, initCellX: 4 },
        { entity: 'portal.breach-gate', count: 2 },
      ],
    },
    {
      id: 'quest.last-signal',
      name: 'The Last Signal',
      description: 'Find out why the relay went quiet.',
      role: 'The only quest of the saga.',
      provider: 'character.mara-vex',
      steps: [
        {
          id: 'ask-around',
          description: 'Ask the drift merchant.',
          objectives: [{ type: 'talk', target: 'character.drift-merchant', quantity: 1 }],
        },
      ],
      rewards: [{ item: 'weapon.ash-repeater', quantity: 1 }],
      sourceMapCode: 'relay-camp',
    },
    { id: 'character.mara-vex', greeting: [{ text: 'The relay was never this quiet.', mood: 'sad' }], name: 'Ignored' },
    { id: 'character.drift-merchant', greeting: [{ text: 'A foundation character keeps its own words.' }] },
    { id: 'weapon.ash-repeater', abilities: ['ability.pulse-shot'] },
  ],
});

const normalized = () => normalizePackage(rawPackage(), { registry, theme: 'fallback' });

describe('saga package normalization', () => {
  const pkg = normalized();
  const byId = new Map(pkg.definitions.map((definition) => [definition.id, definition]));

  it('keeps new definitions, turns a re-declared foundation id into a reference, and drops world kinds', () => {
    expect(pkg.schemaVersion).toBe(PACKAGE_SCHEMA_VERSION);
    expect(pkg.foundationVersion).toBe(registry.contentVersion);
    expect(pkg.saga).toEqual({ code: 'the-last-signal', name: 'The Last Signal', description: 'A relay goes quiet.' });
    expect([...byId.keys()]).toEqual([
      'action.drift-merchant-the-last-signal',
      'action.mara-vex-the-last-signal',
      'character.mara-vex',
      'map.relay-camp',
      'quest.last-signal',
      'skin.mara-vex',
      'weapon.ash-repeater',
    ]);
  });

  it('derives references from what the definitions name', () => {
    expect(pkg.references).toEqual([
      'ability.pulse-shot',
      'biome.ash-wastes',
      'character.ash-raider',
      'character.drift-merchant',
      'floor.ash-crust',
      'portal.breach-gate',
    ]);
  });

  it('carries no coordinate and no render data, and repairs values to their specs', () => {
    expect(forbiddenKeyPaths(pkg)).toEqual([]);
    expect(byId.get('weapon.ash-repeater').objectLayer).toEqual({
      itemType: 'weapon',
      activable: true,
      stats: { effect: 20, resistance: 0, agility: 0, range: 0, intelligence: 0, utility: 0 },
    });
    expect(byId.get('character.mara-vex').entity).toEqual({ type: 'bot', behavior: 'provider', level: 3 });
  });

  it('merges a repeated saga id: the first definition keeps its fields, later ones add the missing', () => {
    expect(byId.get('character.mara-vex')).toMatchObject({
      name: 'Mara Vex',
      greeting: [{ text: 'The relay was never this quiet.', mood: 'sad' }],
    });
    expect(byId.get('weapon.ash-repeater').abilities).toEqual(['ability.pulse-shot']);
  });

  it('completes interactions: one composition entry per entity, a talk, and an action per provider', () => {
    expect(byId.get('map.relay-camp').composition).toEqual([
      { entity: 'floor.ash-crust', count: 1 },
      { entity: 'character.mara-vex', count: 1 },
      { entity: 'character.ash-raider', count: 3 },
      { entity: 'portal.breach-gate', count: 2 },
    ]);
    expect(byId.get('quest.last-signal').talk).toEqual([{ text: 'The Last Signal: report received.' }]);
    expect(byId.get('action.drift-merchant-the-last-signal')).toEqual({
      id: 'action.drift-merchant-the-last-signal',
      name: 'Drift Merchant of The Last Signal',
      description: 'Drift Merchant offers and completes the quests of The Last Signal.',
      role: 'The quest post of Drift Merchant.',
      provider: 'character.drift-merchant',
    });
  });

  it('is valid, deterministic and idempotent', () => {
    expect(validatePackage(pkg, registry)).toEqual([]);
    expect(canonicalJson(normalized())).toBe(canonicalJson(pkg));
    expect(canonicalJson(normalizePackage(pkg, { registry }))).toBe(canonicalJson(pkg));
  });

  it('slugifies free text into codes', () => {
    expect(slugify('  The Bloom — Apex!  ')).toBe('the-bloom-apex');
  });
});

describe('saga package validation', () => {
  const findings = (edit) => {
    const pkg = normalized();
    edit(pkg);
    return validatePackage(pkg, registry).map(({ id, message }) => `${id}: ${message}`);
  };

  it('refuses a new definition that duplicates foundation content', () => {
    const result = findings((pkg) =>
      pkg.definitions.push({ ...registry.definitions.get('weapon.hatchet'), id: 'armor.hatchet', name: 'Hatchet Two' }),
    );
    expect(result).toContain('armor.hatchet: item label is already used by weapon.hatchet');
  });

  it('refuses world kinds, unknown fields, a stale format and references that drift', () => {
    const result = findings((pkg) => {
      pkg.schemaVersion = 1;
      pkg.places = [];
      pkg.saga.mapCode = 'x';
      pkg.references = pkg.references.slice(1);
      pkg.definitions.push({ id: 'faction.new-order', name: 'New Order', description: 'x', role: 'x' });
    });
    expect(result).toContain('package: schemaVersion must be 2');
    expect(result).toContain('package: unknown field(s): places, saga.mapCode');
    expect(result).toContain('faction.new-order: a saga cannot define a faction; the foundation owns the world');
    expect(result.some((finding) => finding.startsWith('package: references must list'))).toBe(true);
  });

  it('refuses spatial and render data in a package that skipped normalization', () => {
    const result = findings((pkg) => {
      pkg.definitions.find(({ id }) => id === 'map.relay-camp').composition[0].initCellX = 2;
      pkg.definitions.find(({ id }) => id === 'skin.mara-vex').objectLayer.render = { cid: 'x' };
    });
    expect(result).toContain('map.relay-camp: composition[0].initCellX is spatial or render data');
    expect(result).toContain('skin.mara-vex: objectLayer.render is spatial or render data');
  });
});

describe('saga compilation', () => {
  const pkg = normalized();
  const { saga, instance, families } = compileSaga(pkg, registry);
  const foundation = compileFoundation(registry).families;

  it('produces the document families of the foundation, for its own definitions only', () => {
    expect(Object.keys(families)).toEqual(Object.keys(FAMILIES));
    for (const family of Object.keys(FAMILIES))
      for (const document of families[family])
        expect(Object.keys(document), family).toEqual(Object.keys(foundation[family][0]));
    expect(families.objectLayers.map(({ id }) => id)).toEqual(['skin.mara-vex', 'weapon.ash-repeater']);
    expect(families.maps.map(({ code }) => code)).toEqual(['relay-camp']);
    expect(families.quests.map(({ code }) => code)).toEqual(['last-signal']);
  });

  it('carries the entity-type defaults of every entity its maps place, as the foundation compiles them', () => {
    const keyOf = ({ entityType, liveItemIds }) => `${entityType}|${liveItemIds}`;
    expect(families.entityTypeDefaults.map(keyOf)).toEqual([
      'bot|mara-vex,ash-repeater',
      'floor|ash-crust',
      'bot|ash-raider,scrap-maul',
      'portal|breach-gate',
    ]);
    const raider = families.entityTypeDefaults.find((row) => keyOf(row) === 'bot|ash-raider,scrap-maul');
    expect(raider).toEqual(foundation.entityTypeDefaults.find((row) => keyOf(row) === keyOf(raider)));
  });

  it('reuses foundation labels where it names foundation definitions', () => {
    expect(families.quests[0].steps[0].objectives).toEqual([{ type: 'talk', itemId: 'drift-merchant', quantity: 1 }]);
    expect(families.skills).toEqual([expect.objectContaining({ triggerItemId: 'ash-repeater' })]);
    expect(families.skills[0].skills[0].summonedEntityItemId).toBe('pulse-round');
  });

  it('maps each quest talk to the action of its talker', () => {
    expect(
      families.actions.map(({ code, dialogCode, questDialogueCodes }) => [code, dialogCode, questDialogueCodes]),
    ).toEqual([
      [
        'drift-merchant-the-last-signal',
        'default-drift-merchant',
        [{ questCode: 'last-signal', dialogCode: 'quest-talk-last-signal' }],
      ],
      ['mara-vex-the-last-signal', 'default-mara-vex', []],
    ]);
    expect(families.dialogues.filter(({ code }) => code === 'quest-talk-last-signal')).toEqual([
      {
        code: 'quest-talk-last-signal',
        order: 0,
        speaker: 'Drift Merchant',
        text: 'The Last Signal: report received.',
        mood: 'neutral',
      },
    ]);
  });

  it('leaves placement to spatial authoring and render to graphic authoring', () => {
    for (const map of families.maps) expect(map).not.toHaveProperty('entities');
    for (const document of [...families.quests, ...families.actions])
      expect([document.sourceMapCode, document.sourceCellX, document.sourceCellY]).toEqual([null, null, null]);
    for (const item of families.objectLayers) expect(item.payload.data).not.toHaveProperty('render');
  });

  it('records what the saga references and adds, and the shell of its instance', () => {
    expect(saga).toMatchObject({
      code: 'the-last-signal',
      foundationVersion: registry.contentVersion,
      references: pkg.references,
      definitions: pkg.definitions,
      mapCodes: ['relay-camp'],
      questCodes: [{ providerSkinItemId: 'mara-vex', questCode: 'last-signal', mapCode: 'relay-camp' }],
    });
    expect(saga.itemIds).toEqual(expect.arrayContaining(['mara-vex', 'ash-repeater', 'drift-merchant', 'ash-crust']));
    expect(instance).toEqual({
      code: 'the-last-signal',
      name: 'The Last Signal',
      description: 'A relay goes quiet.',
      tags: ['saga', 'generated'],
      cyberiaMapCodes: ['relay-camp'],
      portals: [],
      topologyMode: 'procedural',
    });
  });
});

describe('the committed saga', () => {
  const file = `${CONTENT_ROOT}sagas/amethyst-strata-expansion.json`;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

  it('is valid, normalized and compiles into every family', () => {
    expect(validatePackage(pkg, registry)).toEqual([]);
    expect(canonicalJson(normalizePackage(pkg, { registry }))).toBe(fs.readFileSync(file, 'utf8'));
    const { families } = compileSaga(pkg, registry);
    for (const family of Object.keys(FAMILIES)) expect(families[family].length, family).toBeGreaterThan(0);
    for (const id of pkg.references) expect(registry.definitions.has(id), id).toBe(true);
  });
});

describe('semantic generator prompts', () => {
  it('lets a saga define content but never the world it is set in', () => {
    for (const kind of FOUNDATION_KINDS) expect(GENERATED_KINDS).not.toContain(kind);
    expect(GENERATED_KINDS).toEqual(expect.arrayContaining(['character', 'map', 'quest', 'action']));
  });

  it('indexes every foundation definition in one line', () => {
    const catalog = foundationCatalog(registry).split('\n');
    expect(catalog).toHaveLength(registry.definitions.size);
    expect(catalog).toContainEqual(
      expect.stringMatching(/^character\.drift-merchant — Drift Merchant: .* \[bot wearing /),
    );
  });
});
