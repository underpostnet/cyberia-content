import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ARTIFACT_SCHEMA_VERSION, artifactContent, artifactManifest, writeArtifact } from '../src/packaging/build.js';
import { FAMILIES } from '../src/compiler.js';
import { contentDigest } from '../src/packaging/digest.js';

const REVISION = 'a'.repeat(40);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-artifact-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

let content;
let manifest;
beforeAll(() => {
  content = artifactContent();
  manifest = artifactManifest({ ...content, sourceRevision: REVISION });
});

/** A fresh copy of the artifact under its own root. */
const artifactRoot = (name) => {
  const root = path.join(scratch, name);
  writeArtifact({ files: content.files, manifest, root });
  return root;
};

describe('artifact metadata', () => {
  it('identifies the repository, version, revision, schema, digest and build', () => {
    expect(manifest).toMatchObject({
      repository: 'underpostnet/cyberia-content',
      contentVersion: '3.0.0',
      sourceRevision: REVISION,
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      contentDigest: contentDigest(manifest.files),
      build: { definitionSchemaVersion: 3, runtimeContract: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) },
      instances: ['amethyst-strata-expansion', 'fallback', 'test'],
      sagas: ['amethyst-strata-expansion'],
    });
  });

  it('holds the context index, one file per document family of the foundation and of each saga, the procedural templates and the backups', () => {
    const files = Object.keys(manifest.files);
    const families = Object.values(FAMILIES).map((family) => `${family}.json`);
    expect(files.filter((file) => file.startsWith('foundation/')).sort()).toEqual(
      ['baseline.json', 'item-baseline.json', ...families].map((file) => `foundation/${file}`).sort(),
    );
    expect(files.filter((file) => file.startsWith('procedural/')).sort()).toEqual([
      'procedural/genesis-templates.json',
      'procedural/palettes.json',
    ]);
    expect(files.filter((file) => file.startsWith('sagas/')).sort()).toEqual(
      ['saga.json', 'instance.json', ...families].map((file) => `sagas/amethyst-strata-expansion/${file}`).sort(),
    );
    expect(files).toContain('instances/test/cyberia-instance.json');
    expect(files).toContain('context.json');
    expect(
      files.every((file) => file === 'context.json' || /^(foundation|procedural|sagas|instances)\//.test(file)),
    ).toBe(true);
  });

  it('is deterministic: the same revision builds the same manifest and bytes', () => {
    const again = artifactContent();
    expect(artifactManifest({ ...again, sourceRevision: REVISION })).toEqual(manifest);
    const [first, second] = [artifactRoot('first'), artifactRoot('second')];
    for (const file of ['manifest.json', ...Object.keys(manifest.files)])
      expect(
        fs.readFileSync(path.join(second, 'dist', file)).equals(fs.readFileSync(path.join(first, 'dist', file))),
        file,
      ).toBe(true);
  });
});
