import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_ROOT } from '../src/foundation.js';
import { readContent } from '../src/validation/content.js';
import { formatContent, formatFindings } from '../src/validation/format.js';

vi.mock('../cyberia-content.config.js', () => ({ default: { ignoreSagas: ['ignored'] } }));

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-content-config-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('an ignored saga', () => {
  it('does not exist for validation, the canonical form or the content', () => {
    fs.cpSync(path.join(CONTENT_ROOT, 'foundation'), path.join(scratch, 'foundation'), { recursive: true });
    fs.mkdirSync(path.join(scratch, 'sagas'));
    fs.writeFileSync(path.join(scratch, 'sagas', 'ignored.json'), '{');
    fs.writeFileSync(path.join(scratch, 'sagas', 'kept.json'), '{');
    expect(formatFindings(scratch).map(({ id }) => id)).toEqual(['sagas/kept.json']);

    fs.rmSync(path.join(scratch, 'sagas', 'kept.json'));
    expect(formatContent(scratch)).toEqual([]);
    const { findings, sagas } = readContent(scratch);
    expect(findings).toEqual([]);
    expect([...sagas.keys()]).toEqual([]);
  });
});
