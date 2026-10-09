/**
 * The builder of the content artifact. It validates the content, compiles the runtime documents,
 * adds the instance backups and writes `dist/` with a deterministic manifest: the same source
 * revision always builds the same bytes. The artifact is data; its consumer verifies it.
 *
 * @module src/packaging/build.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONTENT_ROOT, ContentError } from '../foundation.js';
import { FAMILIES, compileContext, compileFoundation, compileSaga } from '../compiler.js';
import { CONTRACT_FILE } from '../schema/contract.js';
import { SCHEMA_VERSION } from '../schema/definitions.js';
import { readContent } from '../validation/content.js';
import { canonicalJson, filesUnder } from '../validation/format.js';
import { PALETTE_FAMILIES } from '../validation/procedural.js';
import { contentDigest, sha256 } from './digest.js';

/** Version of the artifact layout and its document shapes: manifest, context, foundation, procedural, sagas, instances. */
export const ARTIFACT_SCHEMA_VERSION = 5;

export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The files of the artifact by artifact path: one file per document family of the foundation and
 * of each saga, the foundation baselines, the procedural templates, the context index, and the
 * instance backups.
 * @param {string} [root] - Content directory.
 * @returns {{files:Map<string,Buffer>, instances:string[], sagas:string[]}}
 * @throws {ContentError} When the content has findings.
 */
export function artifactContent(root = CONTENT_ROOT) {
  const { findings, registry, sagas, instances, procedural } = readContent(root);
  if (findings.length > 0) throw new ContentError(findings);
  const files = new Map();
  const json = (file, value) => files.set(file, Buffer.from(canonicalJson(value)));
  const families = (directory, documents) => {
    for (const [family, file] of Object.entries(FAMILIES)) json(`${directory}/${file}.json`, documents[family]);
  };
  const foundation = compileFoundation(registry);
  families('foundation', foundation.families);
  json('foundation/baseline.json', foundation.baseline);
  json('foundation/item-baseline.json', foundation.itemBaseline);
  json('procedural/genesis-templates.json', procedural.templates);
  json('procedural/palettes.json', { families: PALETTE_FAMILIES, palettes: procedural.palettes });
  for (const [code, pkg] of sagas) {
    const { saga, instance, families: documents } = compileSaga(pkg, registry);
    json(`sagas/${code}/saga.json`, saga);
    json(`sagas/${code}/instance.json`, instance);
    families(`sagas/${code}`, documents);
  }
  json('context.json', compileContext(registry, sagas));
  for (const code of instances) {
    const directory = path.join(root, 'instances', code);
    for (const file of filesUnder(directory))
      files.set(`instances/${code}/${file}`, fs.readFileSync(path.join(directory, file)));
  }
  return { files, instances, sagas: [...sagas.keys()] };
}

/**
 * The manifest of an artifact: its identity, the digest of every file and of the whole.
 * @param {Object} params
 * @param {Map<string,Buffer>} params.files - {@link artifactContent} files.
 * @param {string[]} params.instances
 * @param {string[]} params.sagas
 * @param {string} params.sourceRevision - Commit the content was built from.
 * @param {string} [params.root] - Package root.
 * @returns {Object}
 */
export function artifactManifest({ files, instances, sagas, sourceRevision, root = PACKAGE_ROOT }) {
  const { repository, version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const digests = Object.fromEntries([...files.keys()].sort().map((file) => [file, sha256(files.get(file))]));
  return {
    repository,
    contentVersion: version,
    sourceRevision,
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    contentDigest: contentDigest(digests),
    build: { definitionSchemaVersion: SCHEMA_VERSION, runtimeContract: sha256(fs.readFileSync(CONTRACT_FILE)) },
    instances,
    sagas,
    files: digests,
  };
}

/**
 * Writes `dist/`: every file, then the manifest. A previous `dist/` is replaced whole.
 * @param {Object} params
 * @param {Map<string,Buffer>} params.files
 * @param {Object} params.manifest - {@link artifactManifest} output.
 * @param {string} [params.root] - Package root.
 * @returns {string} The `dist/` directory.
 */
export function writeArtifact({ files, manifest, root = PACKAGE_ROOT }) {
  const dist = path.join(root, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  for (const [file, data] of files) {
    fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
    fs.writeFileSync(path.join(dist, file), data);
  }
  fs.writeFileSync(path.join(dist, 'manifest.json'), canonicalJson(manifest));
  return dist;
}

/**
 * The commit a build comes from. A build of uncommitted content has no source revision.
 * @param {string} [root] - Repository root.
 * @returns {string}
 * @throws {Error} When the repository has no commit or its working tree has changes.
 */
export function sourceRevision(root = PACKAGE_ROOT) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain')) throw new Error('The working tree has changes: commit them before a build');
  return git('rev-parse', 'HEAD');
}
