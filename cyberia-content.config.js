/** Configuration of this checkout. Every command and test reads it through `src/config.js`. */
export default {
  /** Saga codes every process skips, as if their package does not exist. */
  ignoreSagas: ['sagapatchwork-clinic'],
};
