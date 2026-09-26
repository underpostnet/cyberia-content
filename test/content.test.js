import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readContent } from '../src/validation/content.js';
import { canonicalJson, formatContent, formatFindings } from '../src/validation/format.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-content-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('the content tree', () => {
  it('validates with no finding', () => {
    const { findings, sagas, instances } = readContent();
    expect(findings).toEqual([]);
    expect([...sagas.keys()]).toEqual(['amethyst-strata-expansion']);
    expect(instances).toEqual(['FOREST', 'TEST', 'amethyst-strata-expansion']);
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
