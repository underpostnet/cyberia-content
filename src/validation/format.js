/**
 * The canonical form of content JSON: two-space indentation and one final newline, the form the
 * generator and the engine export write. One form keeps the artifact digest stable.
 *
 * @module src/validation/format.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_SAGAS } from '../config.js';

export const canonicalJson = (value) => JSON.stringify(value, null, 2) + '\n';

/**
 * Every file under a directory, as sorted paths relative to it.
 * @param {string} root
 * @returns {string[]}
 */
export const filesUnder = (root) =>
  fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();

/** The content JSON files under a content directory, without the package of an ignored saga. */
const contentFiles = (root) =>
  filesUnder(root).filter(
    (file) => file.endsWith('.json') && !IGNORED_SAGAS.has(/^sagas\/([^/]+)\.json$/.exec(file)?.[1]),
  );

/**
 * One finding per content JSON file that does not parse or is not in canonical form.
 * @param {string} root - Content directory.
 * @returns {Array<{id:string,message:string}>}
 */
export function formatFindings(root) {
  const findings = [];
  for (const file of contentFiles(root)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    try {
      if (canonicalJson(JSON.parse(text)) !== text)
        findings.push({ id: file, message: 'is not in canonical form; run `cyberia-content validate --fix`' });
    } catch (error) {
      findings.push({ id: file, message: error.message });
    }
  }
  return findings;
}

/**
 * Rewrites every content JSON file that is not in canonical form.
 * @param {string} root - Content directory.
 * @returns {string[]} The rewritten files.
 * @throws {SyntaxError} When a file does not parse.
 */
export function formatContent(root) {
  const rewritten = [];
  for (const file of contentFiles(root)) {
    const target = path.join(root, file);
    const text = fs.readFileSync(target, 'utf8');
    const canonical = canonicalJson(JSON.parse(text));
    if (canonical === text) continue;
    fs.writeFileSync(target, canonical);
    rewritten.push(file);
  }
  return rewritten;
}
