/**
 * Validation of the whole content tree: format, foundation, sagas, instances and global content.
 *
 * @module src/validation/content.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_SAGAS } from '../config.js';
import { CONTENT_ROOT, createRegistry, foundationFindings, readFoundation } from '../foundation.js';
import { validatePackage } from '../generator/package.js';
import { readProcedural } from '../procedural.js';
import { CONTRACT } from '../schema/contract.js';
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

/**
 * Findings of the pins of an instance. A complete snapshot (an instance with `object-layers/`) binds
 * each item id to `object-layers/<itemId>.json`; a quest or an action of it may pin only that
 * binding. An instance without object layers names items by item id only.
 */
const pinFindings = (root, code) => {
  const dir = path.join(root, 'instances', code);
  const snapshot = fs.existsSync(path.join(dir, 'object-layers'));
  const bindings = new Map(
    entriesOf(dir, 'object-layers', false).map((name) => [
      name,
      readJson(path.join(dir, 'object-layers', `${name}.json`)).cid,
    ]),
  );
  const problemOf = ({ itemId, cid }) => {
    if (!snapshot) return `${itemId} pins ${cid}; an instance without object layers names items by item id only`;
    if (!bindings.has(itemId)) return `${itemId} pins ${cid}, but the snapshot holds no object layer ${itemId}`;
    if (bindings.get(itemId) !== cid)
      return `${itemId} pins ${cid}, but the snapshot binds it to ${bindings.get(itemId)}`;
    return '';
  };
  return ['cyberia-quests', 'cyberia-actions'].flatMap((family) =>
    entriesOf(dir, family, false).flatMap((name) =>
      pinsOf(readJson(path.join(dir, family, `${name}.json`)))
        .map(problemOf)
        .filter(Boolean)
        .map((message) => ({ id: `instances/${code}/${family}/${name}.json`, message })),
    ),
  );
};

/**
 * Findings of the economy of an instance: its conf names an economy, and the economy is the one
 * its backup carries or one the foundation defines.
 */
const economyFindings = (root, code, registry) => {
  const dir = path.join(root, 'instances', code);
  const confFile = path.join(dir, 'cyberia-instance-conf.json');
  if (!fs.existsSync(confFile)) return [];
  const conf = readJson(confFile);
  const id = `instances/${code}/cyberia-instance-conf.json`;
  if (conf.economyRules) return [{ id, message: 'economyRules is retired: name the economy with economyCode' }];
  const economyCode = conf.economyCode ?? CONTRACT.economy.defaultCode;
  const backupFile = path.join(dir, 'cyberia-economy.json');
  if (fs.existsSync(backupFile))
    return readJson(backupFile).code === economyCode
      ? []
      : [{ id: `instances/${code}/cyberia-economy.json`, message: `the backup economy must be ${economyCode}` }];
  return registry.definitions.has(`economy.${economyCode}`)
    ? []
    : [{ id, message: `economy ${economyCode} is neither in the backup nor in the foundation` }];
};

/** The CID form of an Object Layer definition: CIDv1, raw, sha2-256, base32. */
const OBJECT_LAYER_CID = /^bafkrei[a-z2-7]{52}$/;

/** Why global content stays, as the engine records it. */
const GLOBAL_REASONS = new Set(['import', 'catalog', 'owned']);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasFields = (value, fields) =>
  isRecord(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

/**
 * The problem of one global content file, or ''. The file is the engine export of one Object Layer
 * definition with no world: its canonical payload, the render it names, the item ids bound to it and
 * why it stays. The engine checks its identity and its render when it imports it.
 */
const globalFileProblem = (file) => {
  if (!hasFields(file, ['definition', 'render', 'itemIds', 'registration']))
    return 'must hold exactly definition, render, itemIds and registration';
  if (!hasFields(file.definition, ['schemaVersion', 'profile', 'data']))
    return 'definition must hold exactly schemaVersion, profile and data';
  if (file.render !== null && !(hasFields(file.render, ['layout', 'primary']) && typeof file.render.primary === 'string'))
    return 'render must be null, or hold exactly layout and the primary render as base64';
  const { itemIds } = file;
  if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === 'string' && id))
    return 'itemIds must list item ids';
  if (itemIds.some((id, index) => index > 0 && itemIds[index - 1] >= id)) return 'itemIds must be sorted, each once';
  const { reason, registeredAt } = file.registration ?? {};
  if (!GLOBAL_REASONS.has(reason)) return `registration.reason must be one of ${[...GLOBAL_REASONS].join(', ')}`;
  if (typeof registeredAt !== 'string' || Number.isNaN(Date.parse(registeredAt)))
    return 'registration.registeredAt must be a date';
  return '';
};

/** Findings of the global content: one file per definition, named by its CID. */
const globalFindings = (root, cids) =>
  cids.flatMap((cid) => {
    const id = `global/${cid}.json`;
    if (!OBJECT_LAYER_CID.test(cid)) return [{ id, message: 'must be named by the CID of its definition' }];
    const message = globalFileProblem(readJson(path.join(root, 'global', `${cid}.json`)));
    return message ? [{ id, message }] : [];
  });

/**
 * The content of a content directory: its registry, saga packages, instance codes, global content
 * CIDs and procedural templates.
 * @param {string} [root] - Content directory.
 * @returns {{findings:Array<{id:string,message:string}>, registry?:Object,
 *   sagas?:Map<string,Object>, instances?:string[], global?:string[],
 *   procedural?:{templates:Object[], palettes:Object[]}}}
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
    findings.push(...pinFindings(root, code), ...economyFindings(root, code, registry));
  }

  const global = entriesOf(root, 'global', false);
  findings.push(...globalFindings(root, global));
  return findings.length > 0
    ? { findings }
    : { findings, registry, sagas, instances, global, procedural: { templates, palettes } };
}
