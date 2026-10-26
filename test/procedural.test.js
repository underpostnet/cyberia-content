import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_ROOT, createRegistry } from '../src/foundation.js';
import { readProcedural } from '../src/procedural.js';
import { PALETTE_ROLES, genesisTemplateFindings, paletteFindings } from '../src/validation/procedural.js';

const registry = createRegistry();
const shipped = readProcedural(CONTENT_ROOT, registry);
const template = () => structuredClone(shipped.templates.find(({ id }) => id === 'skin.humanoid'));
const palette = () => structuredClone(shipped.palettes.find(({ id }) => id === 'natural-tan'));
const biomes = new Set(['ash-wastes']);

describe('the procedural content', () => {
  it('holds valid Genesis Templates and Palette Templates', () => {
    expect(shipped.findings).toEqual([]);
    expect(shipped.templates.map(({ id }) => id)).toEqual([
      'floor.terrain',
      'obstacle.rock-pile',
      'obstacle.rubble-pile',
      'portal.vortex',
      'skin.humanoid',
    ]);
    expect(shipped.palettes).toHaveLength(41);
  });

  it('gives each region of a template one role, and each role three tones', () => {
    const changed = template();
    changed.roles.hair.regions.push('head');
    changed.roles.skin.tones.base = 'tan';
    changed.roles.torso.palette = 'torso';
    delete changed.roles.legs;
    expect(genesisTemplateFindings(changed, { skin: 'skin.drifter' })).toEqual([
      'region head is in roles hair and skin',
      'role skin needs the tones shadow, base, highlight as #rrggbb',
      'role torso: palette must be one of primary, secondary, detail, feature',
      'region leftLeg is in no role',
      'region rightLeg is in no role',
    ]);
  });

  it('checks each frame of each region map against the canvas and the legend', () => {
    const changed = template();
    changed.directions['06'][0] = changed.directions['06'][0].slice(1);
    changed.directions['08'][0][4] = changed.directions['08'][0][4].replace('h', 'x');
    changed.directions['08'][0][5] = `${changed.directions['08'][0][5]}.`;
    changed.directions.front = changed.directions['08'];
    expect(genesisTemplateFindings(changed, { skin: 'skin.drifter' })).toEqual([
      'row 4 of frame 0 of direction 08 holds x, which is not in the legend',
      'row 5 of frame 0 of direction 08 needs 25 cells',
      'frame 0 of direction 06 needs 25 rows',
      'front is not a direction code',
      'row 4 of frame 0 of direction front holds x, which is not in the legend',
      'row 5 of frame 0 of direction front needs 25 cells',
    ]);
  });

  it('takes any frame count and direction code the author chooses', () => {
    const skin = template();
    delete skin.directions['02'];
    skin.directions['18'] = [skin.directions['18'][0]];
    skin.directions['16'] = [skin.directions['16'][0], skin.directions['16'][0]];
    expect(genesisTemplateFindings(skin, { skin: 'skin.drifter' })).toEqual([]);
    const pile = structuredClone(shipped.templates.find(({ id }) => id === 'obstacle.rock-pile'));
    const [first] = pile.directions['08'];
    pile.directions = { '08': [first, first, first, first], 18: [first, first] };
    expect(genesisTemplateFindings(pile, { obstacle: 'rock.rust-boulder' })).toEqual([]);
  });

  it('ships a portal and two obstacles that move in three idle frames', () => {
    for (const id of ['portal.vortex', 'obstacle.rock-pile', 'obstacle.rubble-pile']) {
      const { directions } = shipped.templates.find((entry) => entry.id === id);
      expect(Object.keys(directions)).toEqual(['08']);
      expect(new Set(directions['08'].map((frame) => frame.join('\n'))).size).toBe(3);
    }
  });

  it('maps each role of every template onto a palette role, so every palette colors every item type', () => {
    for (const { id, roles } of shipped.templates)
      for (const [role, { palette: taken }] of Object.entries(roles))
        expect(PALETTE_ROLES, `${id} ${role}`).toContain(taken);
    for (const palette of shipped.palettes) {
      expect(palette.roles, palette.id).toMatchObject({ primary: expect.any(String), outline: expect.any(String) });
      for (const role of Object.keys(palette.roles)) expect([...PALETTE_ROLES, 'outline', 'accent']).toContain(role);
    }
    const takes = (id) =>
      Object.fromEntries(
        Object.entries(shipped.templates.find((entry) => entry.id === id).roles).map(([role, { palette: taken }]) => [
          role,
          taken,
        ]),
      );
    expect(takes('obstacle.rock-pile')).toEqual(takes('obstacle.rubble-pile'));
    expect(takes('skin.humanoid')).toEqual({ hair: 'detail', skin: 'feature', torso: 'primary', legs: 'secondary' });
  });

  it('colors brown rocks and gray rubble by default', () => {
    const base = (id) => shipped.templates.find((entry) => entry.id === id).roles.chunk.tones.base;
    const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const [r, g, b] = rgb(base('obstacle.rock-pile'));
    expect(r > g && g > b).toBe(true);
    const gray = rgb(base('obstacle.rubble-pile'));
    expect(Math.max(...gray) - Math.min(...gray)).toBeLessThan(16);
  });

  it('draws the humanoid in every facing, with a back that shows no face', () => {
    const { directions } = template();
    expect(Object.keys(directions).sort()).toEqual(['02', '04', '06', '08', '12', '14', '16', '18']);
    expect(directions['02'][0].some((row) => /e\.+e/.test(row))).toBe(false);
    expect(directions['04'][0]).toEqual(directions['06'][0].map((row) => [...row].reverse().join('')));
    for (const code of ['18', '12', '14', '16']) {
      const [lift, step] = directions[code];
      const changed = lift.flatMap((row, y) => (row === step[y] ? [] : [y]));
      expect(changed.length).toBeGreaterThan(0);
      expect(
        changed.every((y) => !/[ht]/.test(lift[y]) || lift[y].replace(/[lr]/g, '.') === step[y].replace(/[lr]/g, '.')),
      ).toBe(true);
    }
  });

  it('needs a baseline item for the item type of a template, and defines no item', () => {
    expect(genesisTemplateFindings(template(), {})).toEqual(['foundation.json names no baseline.items.skin']);
    const named = { ...template(), id: 'armor.humanoid' };
    expect(genesisTemplateFindings(named, { skin: 'skin.drifter' })).toEqual(['id must be skin.<slug>']);
  });

  it('gives a palette primary and outline, any other palette role it has, known biomes, and no item type', () => {
    const changed = { ...palette(), biomeTags: ['moon'], family: 'pastel', itemType: 'skin', id: 'skin.tan' };
    changed.roles = { ...changed.roles, wings: '#ffffff' };
    delete changed.roles.outline;
    changed.constraints = { minContrast: 0.04, contrastRoles: ['torso'] };
    expect(paletteFindings(changed, { biomes })).toEqual([
      'id must be a slug',
      'family must be one of natural, dark, light, warm, cool, biome, exotic',
      'biomeTags must name foundation biomes by slug',
      'roles must give primary and outline, and only primary, secondary, detail, feature, outline, accent, each a color as #rrggbb',
      'constraints.contrastRoles must name palette roles the palette gives',
      'itemType is not a palette field',
    ]);
    expect(paletteFindings(palette(), { biomes })).toEqual([]);
    const fewer = Object.fromEntries(
      Object.entries(palette().roles).filter(([role]) => ['primary', 'secondary', 'outline'].includes(role)),
    );
    const two = { ...palette(), roles: fewer, constraints: { minContrast: 0.04, contrastRoles: ['primary'] } };
    expect(paletteFindings(two, { biomes })).toEqual([]);
    expect(
      paletteFindings({ ...two, constraints: { minContrast: 0.04, contrastRoles: ['detail'] } }, { biomes }),
    ).toEqual(['constraints.contrastRoles must name palette roles the palette gives']);
  });

  it('names each file after its palette, and each palette once', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-procedural-'));
    try {
      fs.mkdirSync(path.join(root, 'procedural', 'palettes'), { recursive: true });
      fs.writeFileSync(path.join(root, 'procedural', 'palettes', 'other.json'), JSON.stringify(palette()));
      fs.writeFileSync(
        path.join(root, 'procedural', 'palettes', 'tan-twin.json'),
        JSON.stringify({ ...palette(), id: 'tan-twin' }),
      );
      expect(readProcedural(root, registry).findings).toEqual([
        { id: 'procedural/palettes/other.json', message: `file must be named ${palette().id}.json` },
        { id: 'procedural/palettes/tan-twin', message: `name Tan is the name of ${palette().id}` },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
