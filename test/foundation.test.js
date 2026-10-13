import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CONTENT_VERSION,
  ContentError,
  createRegistry,
  definitionsOfKind,
  extendRegistry,
  foundationFindings,
  readFoundation,
} from '../src/foundation.js';
import { CONTRACT } from '../src/schema/contract.js';
import { CATEGORIES, ENTITY_KINDS, KINDS, isLabeled, kindOf, slugOf } from '../src/schema/definitions.js';
import { forbiddenKeyPaths, validateDefinitions } from '../src/validation/definitions.js';
import { brief, common, layer, minimalDefinitions, minimalManifest } from './fixtures.js';

const findingsOf = (definitions) => validateDefinitions(definitions).map(({ id, message }) => `${id}: ${message}`);

describe('the foundation', () => {
  const registry = createRegistry();
  const all = [...registry.definitions.values()];
  const composed = new Set(
    definitionsOfKind(registry, 'map').flatMap(({ composition }) => composition.map(({ entity }) => entity)),
  );

  it('validates with no finding, at the package version', () => {
    expect(foundationFindings(readFoundation())).toEqual([]);
    expect(registry.contentVersion).toBe(CONTENT_VERSION);
  });

  it('names only item types of the runtime contract', () => {
    for (const [kind, { itemTypes = [] }] of Object.entries(KINDS))
      for (const itemType of itemTypes) expect(CONTRACT.itemTypes, kind).toContain(itemType);
  });

  it('defines every kind, with exactly one quest and one action', () => {
    for (const kind of Object.keys(KINDS)) expect(definitionsOfKind(registry, kind).length, kind).toBeGreaterThan(0);
    expect(definitionsOfKind(registry, 'quest')).toHaveLength(1);
    expect(definitionsOfKind(registry, 'action')).toHaveLength(1);
    expect(CATEGORIES).toEqual([
      'universe',
      'factions',
      'environment',
      'items',
      'characters',
      'abilities',
      'maps',
      'quests',
      'actions',
    ]);
  });

  it('is functionally complete: every character spawns, every NPC stands on a map, every map is playable', () => {
    for (const character of definitionsOfKind(registry, 'character')) {
      expect(character.entity, character.id).toBeTruthy();
      if (character.entity.type === 'bot') {
        expect(character.entity.behavior, character.id).toBeTruthy();
        expect(composed.has(character.id), `${character.id} stands on no map`).toBe(true);
      }
    }
    for (const map of definitionsOfKind(registry, 'map')) {
      const kinds = map.composition.map(({ entity }) => kindOf(entity));
      expect(kinds, map.id).toContain('floor');
      expect(kinds, map.id).toContain('portal');
      expect(kinds, map.id).toContain('character');
    }
    for (const quest of definitionsOfKind(registry, 'quest')) {
      const talkers = quest.steps.flatMap(({ objectives }) =>
        objectives.filter(({ type }) => type === 'talk').map(({ target }) => target),
      );
      for (const character of [quest.provider, ...talkers]) {
        expect(composed.has(character), character).toBe(true);
        expect(definitionsOfKind(registry, 'action').some(({ provider }) => provider === character)).toBe(true);
      }
    }
  });

  it('composes more than one entity of a definition where the world holds many, and not every definition', () => {
    const counts = definitionsOfKind(registry, 'map').flatMap(({ composition }) =>
      composition.map(({ count }) => count),
    );
    expect(Math.max(...counts)).toBeGreaterThan(1);
    const depleted = all.filter(({ harvest }) => harvest).map(({ harvest }) => harvest.depleted);
    for (const id of depleted) expect(composed.has(id), id).toBe(false);
    for (const id of composed) expect(ENTITY_KINDS, id).toContain(kindOf(id));
  });

  it('holds no faction the lore does not name', () => {
    expect(
      definitionsOfKind(registry, 'faction')
        .map(({ id }) => slugOf(id))
        .sort(),
    ).toEqual([
      'aether-council',
      'atlas-confederation',
      'harmony-enclaves',
      'iron-legion',
      'nova-republic',
      'singularity-directive',
      'transcendent-conclave',
      'void-nomads',
      'zenith-empire',
    ]);
  });

  it('places every biome in a region and connects every region into one topology', () => {
    const regions = definitionsOfKind(registry, 'region');
    const edges = regions.flatMap(({ id, connectsTo = [] }) => connectsTo.map((target) => [id, target]));
    const reached = new Set([regions[0].id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const [a, b] of edges)
        if (reached.has(a) !== reached.has(b)) {
          reached.add(a).add(b);
          grew = true;
        }
    }
    expect(reached.size).toBe(regions.length);
    for (const biome of definitionsOfKind(registry, 'biome')) expect(registry.definitions.has(biome.region)).toBe(true);
  });

  it('gives every drawable definition an art brief and carries no render or spatial data', () => {
    for (const definition of all) {
      expect(forbiddenKeyPaths(definition), definition.id).toEqual([]);
      if (KINDS[kindOf(definition.id)].fields.artBrief) expect(definition.artBrief, definition.id).toBeTruthy();
    }
  });

  it('labels every Object Layer item by the slug of its definition, once', () => {
    const labeled = all.filter(({ id }) => isLabeled(id));
    expect(registry.byItemId.size).toBe(labeled.length);
    for (const definition of labeled) {
      expect(registry.byItemId.get(slugOf(definition.id))).toBe(definition);
      expect(definition.objectLayer).not.toHaveProperty('itemId');
    }
  });
});

describe('definition validation', () => {
  it('accepts the minimal foundation', () => {
    expect(findingsOf(minimalDefinitions())).toEqual([]);
    expect(createRegistry({ manifest: minimalManifest(), definitions: minimalDefinitions() }).byItemId.size).toBe(10);
  });

  it('detects duplicate ids, item labels and names', () => {
    const definitions = minimalDefinitions();
    const findings = findingsOf([
      ...definitions,
      { ...definitions[2] },
      common('skin.runner', { name: 'walker', artBrief: brief, objectLayer: layer('skin', { effect: 1 }, true) }),
      common('resource.chit', { artBrief: brief, objectLayer: layer('resource') }),
    ]);
    expect(findings).toContain('skin.walker: id is already used by skin.walker');
    expect(findings).toContain('skin.runner: name is already used by skin.walker');
    expect(findings).toContain('resource.chit: item label is already used by currency.chit');
  });

  it('checks references resolve to a definition of an allowed kind', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('floor.sand', { locations: ['region.home'], artBrief: brief, objectLayer: layer('floor') }),
      common('character.ghost', {
        archetype: 'archetype',
        voice: 'None.',
        loadout: ['skin.missing'],
        entity: { type: 'bot', behavior: 'passive' },
      }),
      common('map.nowhere', { biome: 'region.home', composition: [{ entity: 'resource.log', count: 1 }] }),
    ]);
    expect(findings).toContain('floor.sand: locations must name at least one biome');
    expect(findings).toContain('character.ghost: loadout names unknown definition skin.missing');
    expect(findings).toContain('map.nowhere: biome must name a biome, not region.home');
    expect(findings).toContain(
      'map.nowhere: composition[0].entity must name a character | floor | tree | vegetation | rock | prop | structure | ruin | portal, not resource.log',
    );
  });

  it('keeps a character to one skin, one item per type, and what its entity type holds', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('armor.vest', { artBrief: brief, objectLayer: layer('breastplate', { resistance: 5 }, true) }),
      common('character.twin', {
        archetype: 'archetype',
        voice: 'Two.',
        loadout: ['skin.walker', 'skin.shards'],
        entity: { type: 'player' },
      }),
      common('character.guard', {
        archetype: 'archetype',
        voice: 'Stern.',
        loadout: ['skin.shards', 'armor.vest'],
        entity: { type: 'bot' },
      }),
      common('character.clerk', {
        archetype: 'archetype',
        voice: 'Dry.',
        loadout: ['skin.shards'],
        entity: { type: 'player', behavior: 'passive' },
      }),
      common('character.idle', { archetype: 'archetype', voice: 'Quiet.', loadout: ['skin.shards'] }),
    ]);
    expect(findings).toContain('character.twin: loadout must name exactly one skin');
    expect(findings).toContain('character.twin: loadout names two items of one type');
    expect(findings).toContain('character.guard: entity.type bot cannot hold every item of the loadout');
    expect(findings).toContain('character.guard: entity.behavior is required for a bot');
    expect(findings).toContain('character.clerk: entity.behavior applies to a bot only');
    expect(findings).toContain('character.idle: entity is required');
  });

  it('allows only executable handlers and the summon each one spawns', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('ability.coin-shot', { logicEventId: 'coin_drop_or_transaction', summons: 'projectile.bolt' }),
      common('ability.echo', { logicEventId: 'doppelganger', summons: 'projectile.bolt' }),
      common('ability.hack', { logicEventId: 'rewrite_reality' }),
      common('ability.bolt-dose', { logicEventId: 'zero-waste-auto-consume-heal', summons: 'projectile.bolt' }),
      common('ability.weapon-dose', { logicEventId: 'zero-waste-auto-consume-heal' }),
      common('weapon.dosed', {
        artBrief: brief,
        abilities: ['ability.weapon-dose'],
        objectLayer: layer('weapon', { effect: 5 }, true),
      }),
    ]);
    expect(findings).toContain(
      'ability.coin-shot: coin_drop_or_transaction summons a coin; projectile.bolt is a skill',
    );
    expect(findings).toContain(
      'ability.bolt-dose: zero-waste-auto-consume-heal summons the item that carries it; remove summons',
    );
    expect(findings).toContain(
      'weapon.dosed: ability.weapon-dose summons the item that carries it, which must be a consumable',
    );
    expect(findings.some((finding) => finding.startsWith('ability.weapon-dose:'))).toBe(false);
    expect(findings).toContain("ability.echo: doppelganger summons the caster's skin; remove summons");
    expect(findings.some((finding) => finding.startsWith('ability.hack: logicEventId must be one of'))).toBe(true);
  });

  it('refuses render data, spatial data, unknown fields and stats outside their type bounds', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('prop.lamp', {
        locations: ['biome.meadow'],
        initCellX: 4,
        glow: true,
        artBrief: { ...brief, frames: [] },
        objectLayer: { ...layer('static', { effect: 3 }), render: { cid: 'x' } },
      }),
    ]);
    expect(findings).toContain('prop.lamp: unknown field(s): initCellX, glow');
    expect(findings).toContain('prop.lamp: initCellX is spatial or render data');
    expect(findings).toContain('prop.lamp: artBrief.frames is spatial or render data');
    expect(findings).toContain('prop.lamp: objectLayer.render is spatial or render data');
    expect(findings).toContain('prop.lamp: objectLayer.stats.effect 3 is outside static bounds [0, 0]');
  });

  it('reads a biome palette as #rrggbb colors by role', () => {
    const definitions = minimalDefinitions();
    definitions.find(({ id }) => id === 'biome.meadow').palette = { base: ['#44AA44', 'green'], shadow: [] };
    const findings = findingsOf(definitions);
    expect(findings).toContain('biome.meadow: palette.base[0] must be a #rrggbb color');
    expect(findings).toContain('biome.meadow: palette.base[1] must be a #rrggbb color');
    expect(findings).toContain('biome.meadow: palette.shadow must not be empty');
    expect(findings).toContain('biome.meadow: palette.highlight is required');
  });

  it('keeps a harvest cycle between resource states', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('rock.boulder', {
        locations: ['biome.meadow'],
        artBrief: brief,
        harvest: { depleted: 'tree.oak', yields: 'resource.log' },
        objectLayer: layer('obstacle'),
      }),
    ]);
    expect(findings).toContain('rock.boulder: a harvestable definition materializes as a resource');
    expect(findings).toContain('rock.boulder: harvest.depleted must not be harvestable itself');
  });

  it('composes a map of entities its biome holds, each once', () => {
    const findings = findingsOf([
      ...minimalDefinitions(),
      common('biome.dunes', {
        region: 'region.home',
        ambience: 'Dry.',
        paletteDirection: 'Sand.',
        palette: { base: ['#ddcc88'], shadow: ['#998844'], highlight: ['#ffeebb'], outline: ['#332211'] },
      }),
      common('map.dunes', {
        biome: 'biome.dunes',
        composition: [
          { entity: 'tree.oak', count: 2 },
          { entity: 'tree.oak', count: 1 },
        ],
      }),
    ]);
    expect(findings).toContain('map.dunes: composition repeats an entity');
    expect(findings).toContain('map.dunes: tree.oak is not located in biome.dunes or region.home');
  });

  it('targets quest objectives by type and has a talk objective answered', () => {
    const definitions = minimalDefinitions();
    const quest = definitions.find(({ id }) => id === 'quest.logs');
    quest.steps[0].objectives.push({ type: 'kill', target: 'resource.log', quantity: 1 });
    quest.steps[1].objectives.push({ type: 'collect', target: 'character.walker', quantity: 1 });
    quest.prerequisites = ['quest.logs'];
    delete quest.talk;
    const findings = findingsOf(definitions);
    expect(findings).toContain('quest.logs: kill targets a character, not resource.log');
    expect(findings).toContain('quest.logs: collect targets an item, not character.walker');
    expect(findings).toContain('quest.logs: talk is required when an objective is to talk');
    expect(findings).toContain('quest.logs: a quest cannot require or unlock itself');
  });

  it('stands every quest provider and talk target behind an action of the same set', () => {
    const findings = findingsOf(minimalDefinitions().filter(({ id }) => id !== 'action.walker-post'));
    expect(findings).toEqual(['quest.logs: character.walker needs an action to offer or complete this quest']);
  });

  it('refuses a baseline entity a runtime entity type cannot hold', () => {
    const manifest = minimalManifest();
    manifest.baseline.entities.bot = 'character.guard';
    manifest.baseline.entities.coin = 'floor.grass';
    const definitions = [
      ...minimalDefinitions(),
      common('armor.vest', { artBrief: brief, objectLayer: layer('breastplate', { resistance: 5 }, true) }),
      common('character.guard', {
        archetype: 'archetype',
        voice: 'Stern.',
        loadout: ['skin.walker', 'armor.vest'],
        entity: { type: 'player' },
      }),
    ];
    const findings = foundationFindings({ manifest, definitions }).map(({ message }) => message);
    expect(findings).toEqual([
      'baseline.entities.bot: character.guard carries an item type a bot cannot hold',
      'baseline.entities.coin: floor.grass carries an item type a coin cannot hold',
    ]);
  });

  it('keeps a consumable to a heal of its resistance, of its own type, with one known pickup behavior', () => {
    const consumable = (id, objectLayer, extra = {}) => common(id, { artBrief: brief, objectLayer, ...extra });
    const findings = findingsOf([
      ...minimalDefinitions(),
      consumable('consumable.gel', layer('consumable', { resistance: 20 })),
      consumable('consumable.armed', layer('consumable', { effect: 2 })),
      consumable('consumable.crate', layer('resource')),
      consumable('consumable.trap', layer('consumable'), { loot: 'explode-on-pickup' }),
    ]);
    expect(findings.some((finding) => finding.startsWith('consumable.gel'))).toBe(false);
    expect(findings).toContain('consumable.armed: objectLayer.stats.effect 2 is outside consumable bounds [0, 0]');
    expect(findings).toContain('consumable.crate: objectLayer.itemType must be one of: consumable');
    expect(findings).toContain('consumable.trap: loot must be one of: consume-on-pickup-heal');
  });

  it('refuses a baseline item that is not of its item type', () => {
    const manifest = minimalManifest();
    manifest.baseline.items = { skin: 'floor.grass', relic: 'skin.walker' };
    const findings = foundationFindings({ manifest, definitions: minimalDefinitions() }).map(({ message }) => message);
    expect(findings).toEqual(['baseline.items.skin must name a skin', 'baseline.items.relic is not an item type']);
  });

  it('reports file names and directories that do not match the definition', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-foundation-'));
    fs.writeFileSync(path.join(root, 'foundation.json'), JSON.stringify(minimalManifest()));
    fs.mkdirSync(path.join(root, 'items'));
    fs.mkdirSync(path.join(root, 'universe'));
    fs.writeFileSync(path.join(root, 'items', 'wrong-name.json'), JSON.stringify(minimalDefinitions()[4]));
    fs.writeFileSync(path.join(root, 'universe', 'skin.walker.json'), JSON.stringify(minimalDefinitions()[2]));
    fs.writeFileSync(path.join(root, 'items', 'broken.json'), '{ "id": ');
    const { findings } = readFoundation(root);
    fs.rmSync(root, { recursive: true, force: true });
    expect(findings.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        'file must be named projectile.bolt.json',
        'a skin belongs in items/',
        expect.stringContaining('JSON'),
      ]),
    );
  });
});

describe('extending the foundation', () => {
  const base = createRegistry({ manifest: minimalManifest(), definitions: minimalDefinitions() });

  it('adds new definitions and leaves the base unchanged', () => {
    const extended = extendRegistry(base, [
      common('weapon.axe', { artBrief: brief, objectLayer: layer('weapon', { effect: 6 }, true) }),
    ]);
    expect(extended.byItemId.get('axe').id).toBe('weapon.axe');
    expect(base.byItemId.has('axe')).toBe(false);
  });

  it('refuses a definition that duplicates a foundation label', () => {
    expect(() =>
      extendRegistry(base, [common('armor.gun', { artBrief: brief, objectLayer: layer('breastplate', {}, true) })]),
    ).toThrow(ContentError);
  });
});
