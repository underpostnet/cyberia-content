import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_ROOT, createRegistry } from '../src/foundation.js';
import { readProcedural } from '../src/procedural.js';
import { genesisTemplateFindings, paletteFindings } from '../src/validation/procedural.js';

const registry = createRegistry();
const shipped = readProcedural(CONTENT_ROOT, registry);
const template = () => structuredClone(shipped.templates.find(({ id }) => id === 'skin.humanoid'));
const palette = () => structuredClone(shipped.palettes[0]);
const biomes = new Set(['ash-wastes']);

describe('the procedural content', () => {
  it('holds valid Genesis Templates and Palette Templates', () => {
    expect(shipped.findings).toEqual([]);
    expect(shipped.templates.map(({ id }) => id)).toEqual(['skin.humanoid']);
    expect(shipped.palettes).toHaveLength(29);
  });

  it('gives each region of a template one role, and each role three tones', () => {
    const changed = template();
    changed.roles.hair.regions.push('head');
    changed.roles.skin.tones.base = 'tan';
    delete changed.roles.legs;
    expect(genesisTemplateFindings(changed, { skin: 'skin.drifter' })).toEqual([
      'region head is in roles hair and skin',
      'role skin needs the tones shadow, base, highlight as #rrggbb',
      'region leftLeg is in no role',
      'region rightLeg is in no role',
    ]);
  });

  it('checks each region map against the canvas and the legend', () => {
    const changed = template();
    changed.directions['06'] = changed.directions['06'].slice(1);
    changed.directions['08'][4] = changed.directions['08'][4].replace('h', 'x');
    changed.directions['08'][5] = `${changed.directions['08'][5]}.`;
    changed.directions.front = changed.directions['08'];
    expect(genesisTemplateFindings(changed, { skin: 'skin.drifter' })).toEqual([
      'direction 06 needs 25 rows',
      'row 4 of direction 08 holds x, which is not in the legend',
      'row 5 of direction 08 needs 25 cells',
      'front is not a direction code',
      'row 4 of direction front holds x, which is not in the legend',
      'row 5 of direction front needs 25 cells',
    ]);
  });

  it('needs a baseline item for the item type of a template, and defines no item', () => {
    expect(genesisTemplateFindings(template(), {})).toEqual(['foundation.json names no baseline.items.skin']);
    const named = { ...template(), id: 'armor.humanoid' };
    expect(genesisTemplateFindings(named, { skin: 'skin.drifter' })).toEqual(['id must be skin.<slug>']);
  });

  it('fits each palette to a template of its item type, with an outline and known biomes', () => {
    const changed = { ...palette(), biomeTags: ['moon'], family: 'pastel' };
    changed.roles = { ...changed.roles, wings: '#ffffff' };
    delete changed.roles.outline;
    expect(paletteFindings(changed, { templates: shipped.templates, biomes })).toEqual([
      'family must be one of natural, dark, light, warm, cool, biome, exotic',
      'biomeTags must name foundation biomes by slug',
      'roles needs an outline',
      'its roles fit no skin Genesis Template',
    ]);
  });

  it('names each file after its template', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-procedural-'));
    try {
      fs.mkdirSync(path.join(root, 'procedural', 'palettes'), { recursive: true });
      fs.writeFileSync(path.join(root, 'procedural', 'palettes', 'skin.other.json'), JSON.stringify(palette()));
      expect(readProcedural(root, registry).findings).toEqual([
        { id: 'procedural/palettes/skin.other.json', message: `file must be named ${palette().id}.json` },
        { id: `procedural/palettes/${palette().id}`, message: 'its roles fit no skin Genesis Template' },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
