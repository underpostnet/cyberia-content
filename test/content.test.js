import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_ROOT } from '../src/foundation.js';
import { readContent } from '../src/validation/content.js';
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
  it('pins only definitions its own object layers hold', () => {
    const root = path.join(scratch, 'pins');
    const write = (file, value) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), canonicalJson(value));
    };
    fs.cpSync(path.join(CONTENT_ROOT, 'foundation'), path.join(root, 'foundation'), { recursive: true });
    write('instances/pins/cyberia-instance.json', { code: 'pins' });
    write('instances/pins/object-layers/gate.json', { cid: 'bafk-gate' });
    write('instances/pins/cyberia-quests/q.json', {
      rewards: [
        { itemId: 'gate', objectLayerCid: 'bafk-gate' },
        { itemId: 'blade', objectLayerCid: 'bafk-old-blade' },
      ],
    });
    write('instances/pins/cyberia-actions/shop.json', {
      shopItems: [
        { itemId: 'gate', objectLayerCid: 'bafk-gate', priceItemId: 'coin', priceObjectLayerCid: 'bafk-coin' },
      ],
    });
    expect(readContent(root).findings).toEqual([
      {
        id: 'instances/pins/cyberia-quests/q.json',
        message: 'blade pins bafk-old-blade, which no object layer of the instance holds',
      },
      {
        id: 'instances/pins/cyberia-actions/shop.json',
        message: 'coin pins bafk-coin, which no object layer of the instance holds',
      },
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
