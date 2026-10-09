/**
 * Validation of the whole content tree: format, foundation, sagas and instances.
 *
 * @module src/validation/content.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_SAGAS } from '../config.js';
import { CONTENT_ROOT, createRegistry, foundationFindings, readFoundation } from '../foundation.js';
import { validatePackage } from '../generator/package.js';
import { readProcedural } from '../procedural.js';
import { formatFindings } from './format.js';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Names of the entries of a content directory, sorted; none when it is absent. */
export const entriesOf = (root, directory, isDirectory) => {
  const dir = path.join(root, directory);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() === isDirectory && (isDirectory || entry.name.endsWith('.json')))
    .map((entry) => (isDirectory ? entry.name : entry.name.slice(0, -'.json'.length)))
    .sort();
};

/** Every pin a document holds, as `{itemId, cid}`: an `objectLayerCid` or `<x>ObjectLayerCid` key beside its item id. */
const pinsOf = (value) => {
  if (Array.isArray(value)) return value.flatMap(pinsOf);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    /^(objectLayerCid|[a-z]+ObjectLayerCid)$/.test(key)
      ? [{ itemId: value[key.replace(/ObjectLayerCid$/, 'ItemId').replace(/^objectLayerCid$/, 'itemId')], cid: child }]
      : pinsOf(child),
  );
};

/** Findings of an instance whose quests or actions pin a definition none of its object layers holds. */
const pinFindings = (root, code) => {
  const dir = path.join(root, 'instances', code);
  const held = new Set(
    entriesOf(dir, 'object-layers', false).map((name) => readJson(path.join(dir, 'object-layers', `${name}.json`)).cid),
  );
  return ['cyberia-quests', 'cyberia-actions'].flatMap((family) =>
    entriesOf(dir, family, false).flatMap((name) =>
      pinsOf(readJson(path.join(dir, family, `${name}.json`)))
        .filter(({ cid }) => !held.has(cid))
        .map(({ itemId, cid }) => ({
          id: `instances/${code}/${family}/${name}.json`,
          message: `${itemId} pins ${cid}, which no object layer of the instance holds`,
        })),
    ),
  );
};

/**
 * The content of a content directory: its registry, saga packages, instance codes and procedural
 * templates.
 * @param {string} [root] - Content directory.
 * @returns {{findings:Array<{id:string,message:string}>, registry?:Object,
 *   sagas?:Map<string,Object>, instances?:string[], procedural?:{templates:Object[], palettes:Object[]}}}
 *   Findings, and the content when there are none.
 */
export function readContent(root = CONTENT_ROOT) {
  const findings = formatFindings(root);
  const source = readFoundation(path.join(root, 'foundation'));
  findings.push(...foundationFindings(source));
  if (findings.length > 0) return { findings };

  const registry = createRegistry(source);
  const { templates, palettes, findings: proceduralFindings } = readProcedural(root, registry);
  findings.push(...proceduralFindings);

  const sagas = new Map();
  for (const code of entriesOf(root, 'sagas', false).filter((code) => !IGNORED_SAGAS.has(code))) {
    const pkg = readJson(path.join(root, 'sagas', `${code}.json`));
    if (pkg.saga?.code !== code) findings.push({ id: `sagas/${code}.json`, message: `saga.code must be ${code}` });
    for (const { id, message } of validatePackage(pkg, registry))
      findings.push({ id: `sagas/${code}.json ${id}`, message });
    sagas.set(code, pkg);
  }

  const instances = entriesOf(root, 'instances', true);
  for (const code of instances) {
    const file = path.join(root, 'instances', code, 'cyberia-instance.json');
    if (!fs.existsSync(file) || readJson(file).code !== code)
      findings.push({ id: `instances/${code}`, message: `cyberia-instance.json must hold instance ${code}` });
    findings.push(...pinFindings(root, code));
  }
  return findings.length > 0
    ? { findings }
    : { findings, registry, sagas, instances, procedural: { templates, palettes } };
}
