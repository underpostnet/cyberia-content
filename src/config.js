/**
 * The configuration of this checkout: `cyberia-content.config.js` at the package root.
 *
 * @module src/config.js
 */
import config from '../cyberia-content.config.js';

const { ignoreSagas = [] } = config;
if (!Array.isArray(ignoreSagas) || !ignoreSagas.every((code) => typeof code === 'string'))
  throw new Error('cyberia-content.config.js: ignoreSagas must be a list of saga codes');

/** Saga codes every process skips, as if their package does not exist. */
export const IGNORED_SAGAS = new Set(ignoreSagas);
