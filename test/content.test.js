import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_ROOT, CONTENT_VERSION } from '../src/foundation.js';
import { PACKAGE_SCHEMA_VERSION } from '../src/generator/package.js';
import { checkPackage, readContent } from '../src/validation/content.js';
import { canonicalJson, formatContent, formatFindings } from '../src/validation/format.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-content-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('the content tree', () => {
  it('validates with no finding', () => {
    const { findings, sagas, instances } = readContent();
    expect(findings).toEqual([]);
    expect([...sagas.keys()]).toEqual(['amethyst-strata-expansion']);
    expect(instances).toEqual(['amethyst-strata-expansion', 'fallback', 'test']);
  });
});

describe('an instance backup', () => {
  const write = (root, file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), canonicalJson(value));
  };
  const instanceRoot = (name) => {
    const root = path.join(scratch, name);
    fs.cpSync(path.join(CONTENT_ROOT, 'foundation'), path.join(root, 'foundation'), { recursive: true });
    write(root, 'instances/pins/cyberia-instance.json', { code: 'pins' });
    return root;
  };

  it('as a complete snapshot pins an item only to the definition the snapshot binds it to', () => {
    const root = instanceRoot('snapshot');
    write(root, 'instances/pins/object-layers/gate.json', { cid: 'bafk-gate' });
    write(root, 'instances/pins/object-layers/blade.json', { cid: 'bafk-blade' });
    write(root, 'instances/pins/cyberia-quests/q.json', {
      rewards: [
        { itemId: 'gate', objectLayerCid: 'bafk-gate' },
        { itemId: 'blade', objectLayerCid: 'bafk-old-blade' },
      ],
    });
    write(root, 'instances/pins/cyberia-actions/shop.json', {
      shopItems: [
        { itemId: 'gate', objectLayerCid: 'bafk-gate', priceItemId: 'coin', priceObjectLayerCid: 'bafk-coin' },
        { itemId: 'blade' },
      ],
    });
    expect(readContent(root).findings).toEqual([
      {
        id: 'instances/pins/cyberia-quests/q.json',
        message: 'blade pins bafk-old-blade, but the snapshot binds it to bafk-blade',
      },
      {
        id: 'instances/pins/cyberia-actions/shop.json',
        message: 'coin pins bafk-coin, but the snapshot holds no object layer coin',
      },
    ]);
  });

  it('without object layers names items by item id only', () => {
    const root = instanceRoot('ordinary');
    write(root, 'instances/pins/cyberia-quests/q.json', {
      rewards: [{ itemId: 'gate', objectLayerCid: 'bafk-gate' }, { itemId: 'blade' }],
    });
    expect(readContent(root).findings).toEqual([
      {
        id: 'instances/pins/cyberia-quests/q.json',
        message: 'gate pins bafk-gate; an instance without object layers names items by item id only',
      },
    ]);
  });
});

describe('global content', () => {
  const CID = `bafkrei${'a'.repeat(52)}`;
  const file = {
    definition: { schemaVersion: 1, profile: { id: 'cyberia', version: 2 }, data: {} },
    render: { layout: { atlasWidth: 1 }, primary: 'iVBORw0KGgo=' },
    itemIds: ['lantern', 'torch'],
    registration: { reason: 'import', by: 'a moderator', registeredAt: '2026-10-27T00:00:00.000Z', provenance: {} },
  };
  const globalRoot = (name, files) => {
    const root = path.join(scratch, name);
    fs.cpSync(path.join(CONTENT_ROOT, 'foundation'), path.join(root, 'foundation'), { recursive: true });
    for (const [cid, value] of Object.entries(files)) {
      fs.mkdirSync(path.join(root, 'global'), { recursive: true });
      fs.writeFileSync(path.join(root, 'global', `${cid}.json`), canonicalJson(value));
    }
    return root;
  };

  it('lists one definition per file, named by its CID, with no world', () => {
    const { findings, global, instances } = readContent(globalRoot('global-valid', { [CID]: file }));
    expect(findings).toEqual([]);
    expect(global).toEqual([CID]);
    expect(instances).toEqual([]);
    expect(readContent(globalRoot('global-unrendered', { [CID]: { ...file, render: null, itemIds: [] } })).findings).toEqual(
      [],
    );
  });

  it('names the file of each defect', () => {
    const { findings } = readContent(
      globalRoot('global-defects', {
        'lantern-skin': file,
        [`bafkrei${'b'.repeat(52)}`]: { ...file, ledger: {} },
        [`bafkrei${'c'.repeat(52)}`]: { ...file, itemIds: ['torch', 'lantern'] },
        [`bafkrei${'d'.repeat(52)}`]: { ...file, registration: { ...file.registration, reason: 'entity' } },
        [`bafkrei${'e'.repeat(52)}`]: { ...file, render: { layout: {} } },
      }),
    );
    expect(findings.map(({ id, message }) => `${id}: ${message}`)).toEqual([
      `global/bafkrei${'b'.repeat(52)}.json: must hold exactly definition, render, itemIds and registration`,
      `global/bafkrei${'c'.repeat(52)}.json: itemIds must be sorted, each once`,
      `global/bafkrei${'d'.repeat(52)}.json: registration.reason must be one of import, catalog, owned`,
      `global/bafkrei${'e'.repeat(52)}.json: render must be null, or hold exactly layout and the primary render as base64`,
      'global/lantern-skin.json: must be named by the CID of its definition',
    ]);
  });
});

describe('sagas that share content', () => {
  const ACTIVE = 'amethyst-strata-expansion';
  const errand = (extra = []) => ({
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    foundationVersion: CONTENT_VERSION,
    saga: { code: 'sap-errand', name: 'Sap Errand', description: 'A merchant asks for sap.' },
    references: ['character.drift-merchant', 'currency.coin', 'resource.purplish-sap-vial'],
    definitions: [
      {
        id: 'action.sap-errand-post',
        name: 'Sap Errand Post',
        description: 'Where the merchant takes the sap.',
        role: 'Offers the errand.',
        provider: 'character.drift-merchant',
      },
      {
        id: 'quest.sap-errand',
        name: 'The Sap Errand',
        description: 'Bring one vial of violet sap.',
        role: 'The errand of the saga.',
        provider: 'character.drift-merchant',
        steps: [
          {
            id: 'bring',
            description: 'Bring a vial.',
            objectives: [{ type: 'collect', target: 'resource.purplish-sap-vial', quantity: 1 }],
          },
        ],
        rewards: [{ item: 'currency.coin', quantity: 2 }],
      },
      ...extra,
    ],
  });
  const sagaRoot = (name, packages) => {
    const root = path.join(scratch, name);
    fs.cpSync(path.join(CONTENT_ROOT, 'foundation'), path.join(root, 'foundation'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sagas'), { recursive: true });
    fs.copyFileSync(path.join(CONTENT_ROOT, 'sagas', `${ACTIVE}.json`), path.join(root, 'sagas', `${ACTIVE}.json`));
    for (const pkg of packages)
      fs.writeFileSync(path.join(root, 'sagas', `${pkg.saga.code}.json`), canonicalJson(pkg));
    return root;
  };

  it('resolves a reference to a definition of another saga', () => {
    const root = sagaRoot('shared', [errand()]);
    expect(readContent(root).findings).toEqual([]);
    const { findings, compiled, context } = checkPackage(errand(), root);
    expect(findings).toEqual([]);
    expect(compiled.saga.itemIds).toContain('purplish-sap-vial');
    expect(compiled.families.quests[0].steps[0].objectives[0].itemId).toBe('purplish-sap-vial');
    expect(compiled.families.objectLayers).toEqual([]);
    expect(context.sources).toMatchObject({
      'quest.sap-errand': 'sap-errand',
      'resource.purplish-sap-vial': ACTIVE,
      'character.drift-merchant': 'foundation',
    });
    expect(context.referencedBy['resource.purplish-sap-vial']).toContainEqual({
      field: 'steps.objectives.target',
      id: 'quest.sap-errand',
    });
  });

  it('uses maps of other sources as places, and leaves their owner and the instance shell alone', () => {
    const pkg = { ...errand(), places: ['map.athel-ferrum-outpost', 'map.frontier-outpost'] };
    const root = sagaRoot('places', [pkg]);
    expect(readContent(root).findings).toEqual([]);
    const { findings, compiled, context } = checkPackage(pkg, root);
    expect(findings).toEqual([]);
    expect(compiled.saga).toMatchObject({ mapCodes: [], placeCodes: ['athel-ferrum-outpost', 'frontier-outpost'] });
    expect(compiled.instance.cyberiaMapCodes).toEqual([]);
    expect(compiled.families.maps).toEqual([]);
    expect(compiled.saga.questCodes).toEqual([
      { providerSkinItemId: expect.any(String), questCode: 'sap-errand', mapCode: 'frontier-outpost' },
    ]);
    expect(context.sources).toMatchObject({
      'map.athel-ferrum-outpost': ACTIVE,
      'map.frontier-outpost': 'foundation',
    });
  });

  it('refuses an id another saga defines and a package of an ignored saga', () => {
    const root = sagaRoot('duplicate', []);
    const { findings } = checkPackage(
      errand([{ ...errand().definitions[0], id: 'action.interact-thon-zheng', name: 'Another Post' }]),
      root,
    );
    expect(findings).toContainEqual({
      id: 'action.interact-thon-zheng',
      message: 'id is already used by action.interact-thon-zheng',
    });
    expect(checkPackage({ ...errand(), saga: { code: 'sagapatchwork-clinic', name: 'x' } }, root).findings).toEqual([
      { id: 'package', message: 'saga sagapatchwork-clinic is ignored by the configuration' },
    ]);
  });
});

describe('canonical form', () => {
  it('reports and rewrites a file that is not in canonical form, and reports one that does not parse', () => {
    const root = path.join(scratch, 'format');
    fs.mkdirSync(path.join(root, 'foundation'), { recursive: true });
    fs.writeFileSync(path.join(root, 'foundation', 'loose.json'), '{"a":[1,2]}');
    fs.writeFileSync(path.join(root, 'foundation', 'good.json'), canonicalJson({ a: 1 }));
    fs.writeFileSync(path.join(root, 'broken.json'), '{');
    expect(formatFindings(root).map(({ id }) => id)).toEqual(['broken.json', 'foundation/loose.json']);
    fs.rmSync(path.join(root, 'broken.json'));
    expect(formatContent(root)).toEqual(['foundation/loose.json']);
    expect(formatFindings(root)).toEqual([]);
  });
});
