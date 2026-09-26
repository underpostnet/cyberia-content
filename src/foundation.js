/**
 * The foundation: the functional blueprint of the Cyberia universe — its world, environment,
 * items, characters, abilities, maps and interactions. It holds `foundation.json` and one JSON file
 * per definition under its category directory. Sagas extend it and never change it.
 *
 * @module src/foundation.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, KINDS, isLabeled, kindOf, slugOf } from './schema/definitions.js';
import { validateDefinitions, validateManifest } from './validation/definitions.js';

/** Directory of the authored content: foundation, instances and sagas. */
export const CONTENT_ROOT = fileURLToPath(new URL('./content/', import.meta.url));

/** The package version is the content version. */
export const CONTENT_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const MANIFEST_FILE = 'foundation.json';

export class ContentError extends Error {
  /** @param {Array<{id:string,message:string}>} findings */
  constructor(findings) {
    super(
      `${findings.length} content finding(s):\n${findings
        .slice(0, 20)
        .map(({ id, message }) => `  ${id}: ${message}`)
        .join('\n')}`,
    );
    this.name = 'ContentError';
    this.findings = findings;
  }
}

const readJson = (file, name, findings) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    findings.push({ id: name, message: error.message });
    return null;
  }
};

/**
 * The foundation as stored: its manifest, its definitions in category and file order, and the
 * findings of reading them.
 * @param {string} [root] - Foundation directory.
 * @returns {{manifest:Object|null, definitions:Object[], findings:Array<{id:string,message:string}>}}
 */
export function readFoundation(root = path.join(CONTENT_ROOT, 'foundation')) {
  const findings = [];
  const manifest = readJson(path.join(root, MANIFEST_FILE), MANIFEST_FILE, findings);
  const definitions = [];
  for (const category of CATEGORIES) {
    const directory = path.join(root, category);
    if (!fs.existsSync(directory)) continue;
    for (const file of fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()) {
      const name = `${category}/${file}`;
      const definition = readJson(path.join(directory, file), name, findings);
      if (!definition) continue;
      if (`${definition.id}.json` !== file)
        findings.push({ id: name, message: `file must be named ${definition.id}.json` });
      const kind = KINDS[kindOf(definition.id)];
      if (kind && kind.category !== category)
        findings.push({ id: name, message: `a ${kindOf(definition.id)} belongs in ${kind.category}/` });
      definitions.push(definition);
    }
  }
  return { manifest, definitions, findings };
}

/**
 * Every finding of a foundation as read: file layout, definitions and manifest.
 * @param {{manifest:Object, definitions:Object[], findings?:Array}} source - {@link readFoundation} output.
 * @returns {Array<{id:string,message:string}>}
 */
export function foundationFindings({ manifest, definitions, findings = [] }) {
  const byId = new Map(definitions.map((definition) => [definition?.id, definition]));
  return [...findings, ...validateDefinitions(definitions), ...validateManifest(manifest, (id) => byId.get(id))];
}

const indexRegistry = ({ baseline }, definitions) =>
  Object.freeze({
    contentVersion: CONTENT_VERSION,
    baseline,
    definitions: new Map(definitions.map((definition) => [definition.id, definition])),
    byItemId: new Map(
      definitions.filter(({ id }) => isLabeled(id)).map((definition) => [slugOf(definition.id), definition]),
    ),
  });

/**
 * A validated, indexed foundation.
 * @param {{manifest:Object, definitions:Object[], findings?:Array}} [source] - The stored foundation by default.
 * @returns {{contentVersion:string, baseline:Object, definitions:Map<string,Object>, byItemId:Map<string,Object>}}
 * @throws {ContentError} When the foundation has findings.
 */
export function createRegistry(source = readFoundation()) {
  const findings = foundationFindings(source);
  if (findings.length > 0) throw new ContentError(findings);
  return indexRegistry(source.manifest, source.definitions);
}

/**
 * A registry that adds saga definitions to a foundation, which stays unchanged.
 * @param {Object} base - Foundation registry.
 * @param {Object[]} definitions - Definitions the base does not hold.
 * @returns {Object} The extended registry.
 * @throws {ContentError} When a definition is invalid or duplicates the base.
 */
export function extendRegistry(base, definitions) {
  const findings = validateDefinitions(definitions, { base });
  if (findings.length > 0) throw new ContentError(findings);
  return indexRegistry(base, [...base.definitions.values(), ...definitions]);
}

/** Definitions of one kind, in id order. */
export const definitionsOfKind = (registry, kind) =>
  [...registry.definitions.values()].filter((definition) => kindOf(definition.id) === kind);
