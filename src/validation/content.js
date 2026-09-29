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

/**
 * The content of a content directory: its registry, saga packages and instance codes.
 * @param {string} [root] - Content directory.
 * @returns {{findings:Array<{id:string,message:string}>, registry?:Object,
 *   sagas?:Map<string,Object>, instances?:string[]}} Findings, and the content when there are none.
 */
export function readContent(root = CONTENT_ROOT) {
  const findings = formatFindings(root);
  const source = readFoundation(path.join(root, 'foundation'));
  findings.push(...foundationFindings(source));
  if (findings.length > 0) return { findings };

  const registry = createRegistry(source);

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
  }
  return findings.length > 0 ? { findings } : { findings, registry, sagas, instances };
}
