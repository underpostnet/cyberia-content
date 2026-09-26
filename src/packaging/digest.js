/**
 * Digests of the content artifact: one per file, and one over the whole file map.
 *
 * @module src/packaging/digest.js
 */
import { createHash } from 'node:crypto';

export const sha256 = (data) => `sha256:${createHash('sha256').update(data).digest('hex')}`;

/**
 * The digest of a file map: one `<path> <digest>` line per file, in path order.
 * @param {Object<string,string>} files - Artifact path → file digest.
 * @returns {string}
 */
export const contentDigest = (files) =>
  sha256(
    Object.keys(files)
      .sort()
      .map((file) => `${file} ${files[file]}\n`)
      .join(''),
  );
