/**
 * The semantic generator: dynamic semantic composition over the foundation.
 *
 * From a theme (given, or synthesized from the base lore), Google Gemini composes a saga in six
 * bounded stages: composition (which foundation definitions the saga uses, and the few new ones
 * it needs), maps, quests, dialogues, actions and abilities. Every stage returns definitions of
 * the foundation model. The result is a saga package, normalized and validated against the
 * foundation, and written to `src/content/sagas/`. The foundation never changes; spatial and
 * graphic authoring follow.
 *
 * @module src/generator/index.js
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GeminiClient } from './gemini-client.js';
import { CONTENT_ROOT, ContentError, createRegistry, definitionsOfKind } from '../foundation.js';
import { ENTITY_KINDS, FOUNDATION_KINDS, KINDS, isLabeled, kindOf } from '../schema/definitions.js';
import {
  SPACE_CONTEXTS,
  STAGES,
  STAGE_KINDS,
  SUBJECTS,
  TONES,
  buildCustomizationGuidance,
  buildNamingGuidance,
  buildOriginalityGuidance,
  buildStagePrompt,
  buildStageUser,
  buildTemporalDistortionGuidance,
  factionGuidance,
  foundationCatalog,
  pickRandom,
  resolveFactionContext,
  resolveSpaceContext,
  resolveTone,
} from './prompts.js';
import { normalizePackage, stageDefinitions, talkTargetsOf, validatePackage } from './package.js';
import { canonicalJson } from '../validation/format.js';

/** Default sampling temperature for theme synthesis (creativity / divergence). */
const DEFAULT_THEME_TEMPERATURE = 1.3;

/**
 * Invent a distinct, lore-grounded saga theme. Variety is driven by a random world-first subject,
 * an explicit narrative tone, an entropy token and a high sampling temperature. Confederations
 * stay in the background unless named, in which case they drive the saga.
 * @param {GeminiClient} client
 * @param {string} lore - Base lore document text; the world foundation when empty.
 * @param {Object} params
 * @param {Object} params.registry - Foundation registry.
 * @param {string} [params.thinkingLevel]
 * @param {string} [params.spaceContext]
 * @param {string} [params.tone]
 * @param {string} [params.factionContext]
 * @param {number} [params.temperature]
 * @param {(line:string)=>void} params.log
 * @returns {Promise<{theme:string, spaceContext:string, tone:string, subject:string, factions:Object[]}>}
 */
async function synthesizeTheme(
  client,
  lore,
  { registry, thinkingLevel, spaceContext, tone, factionContext, temperature, log },
) {
  const contextKey = resolveSpaceContext(spaceContext);
  const toneKey = resolveTone(tone);
  const subject = pickRandom(SUBJECTS);
  const factions = resolveFactionContext(factionContext, registry);

  const system = [
    'You are the lore-master of Cyberia. Using the BASE LORE below, invent ONE distinct, specific saga',
    'premise that lives inside this world. Make it novel and grounded — never a generic or repeated setup,',
    'and do NOT default to a "spaceship mission" or a war between confederations.',
    buildOriginalityGuidance(),
    buildTemporalDistortionGuidance(contextKey),
    'Return ONLY JSON: { "theme": string } where theme is 1-2 concrete, evocative sentences.',
    '',
    "CRITICAL — the saga's MAIN SUBJECT (what it is really about) is:",
    `${subject}.`,
    '',
    'CRITICAL — the premise MUST be set in this spatial context:',
    SPACE_CONTEXTS[contextKey],
    '',
    'CRITICAL — the premise MUST commit fully to this narrative type / tone:',
    TONES[toneKey],
    '',
    ...factionGuidance(factions, registry),
    '',
    'BASE LORE:',
    lore || foundationCatalog(registry, FOUNDATION_KINDS),
  ].join('\n');
  const user = [
    'Invent a fresh saga premise now, built around the MAIN SUBJECT above.',
    `Creative entropy token: ${crypto.randomBytes(4).toString('hex')}.`,
    'Honor the spatial context, narrative tone, subject and faction emphasis exactly, and choose an',
    'unexpected, lived-in corner of the lore.',
  ].join('\n');

  log(
    `Theme: subject="${subject}" | context=${contextKey} | tone=${toneKey} | ` +
      `factions=${factions.length ? factions.map(({ id }) => id).join(', ') : 'background'}`,
  );
  const res = await client.chatJson({
    system,
    user,
    thinkingLevel,
    temperature: typeof temperature === 'number' ? temperature : DEFAULT_THEME_TEMPERATURE,
  });
  const theme = String(res.theme || '').trim();
  if (!theme) throw new Error('Theme synthesis returned an empty theme.');
  return { theme, spaceContext: contextKey, tone: toneKey, subject, factions };
}

/** The full definitions of the given ids a stage works with, without their art briefs. */
const fullDefinitions = (lookup, ids) =>
  [...new Set(ids)]
    .map(lookup)
    .filter(Boolean)
    .map((definition) => Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'artBrief')));

/**
 * Run the six stages and return their output as one unnormalized package. The composition stage
 * reads the compact foundation index; each later stage reads the full definitions it works with.
 * @param {GeminiClient} client
 * @param {Object} params
 * @param {string} params.theme
 * @param {string} params.lore
 * @param {Object} params.registry
 * @param {Object} params.guidance - `{ naming, customization, spaceContextKey }`.
 * @param {string} [params.thinkingLevel]
 * @param {number} [params.temperature]
 * @param {(line:string)=>void} params.log
 * @returns {Promise<{saga:Object, definitions:Object[]}>}
 */
async function composeSemantics(client, { theme, lore, registry, guidance, thinkingLevel, temperature, log }) {
  const ask = (stage, { catalog = '', context } = {}) =>
    client.chatJson({
      system: buildStagePrompt(stage, guidance),
      user: buildStageUser({ theme, lore, catalog, context }),
      thinkingLevel,
      temperature,
    });
  const step = (stage) => log(`Stage ${STAGES.indexOf(stage) + 1}/${STAGES.length}: ${stage}`);

  step('composition');
  const composition = await ask('composition', { catalog: foundationCatalog(registry) });
  const raw = {
    saga: composition?.saga,
    definitions: stageDefinitions(composition, { kinds: STAGE_KINDS.composition, existing: new Set() }),
  };
  let pkg = normalizePackage(raw, { registry, theme });
  raw.saga = pkg.saga;
  const references = [...(Array.isArray(composition?.references) ? composition.references : []), ...pkg.references];
  const lookup = (id) => pkg.definitions.find((definition) => definition.id === id) ?? registry.definitions.get(id);
  const own = (kind) => pkg.definitions.filter(({ id }) => kindOf(id) === kind);
  const selected = () => fullDefinitions(lookup, [...references, ...pkg.definitions.map(({ id }) => id)]);
  const run = async (stage, context) => {
    step(stage);
    const existing = new Set(pkg.definitions.map(({ id }) => id));
    raw.definitions.push(...stageDefinitions(await ask(stage, { context }), { kinds: STAGE_KINDS[stage], existing }));
    pkg = normalizePackage(raw, { registry, theme });
  };

  const entities = [...registry.definitions.values(), ...pkg.definitions].filter(({ id }) =>
    ENTITY_KINDS.includes(kindOf(id)),
  );
  await run('maps', {
    saga: pkg.saga,
    definitions: selected(),
    biomes: definitionsOfKind(registry, 'biome').map(({ id, name, region }) => ({
      id,
      name,
      entities: entities
        .filter(({ locations = [] }) => locations.includes(id) || locations.includes(region))
        .map((entity) => entity.id),
    })),
  });

  await run('quests', { definitions: selected() });

  const talking = own('quest').filter((quest) => talkTargetsOf(quest).length > 0);
  await run('dialogues', {
    characters: fullDefinitions(
      lookup,
      own('character').map(({ id }) => id),
    ),
    quests: talking,
  });

  const providers = own('quest').flatMap((quest) => [quest.provider, ...talkTargetsOf(quest)]);
  await run('actions', {
    providers: fullDefinitions(lookup, providers),
    items: selected().filter(({ id }) => isLabeled(id)),
    currencies: definitionsOfKind(registry, 'currency').map(({ id, name }) => ({ id, name })),
  });

  const bearers = pkg.definitions.filter(({ id, abilities }) => KINDS[kindOf(id)].fields.abilities && !abilities);
  if (bearers.length > 0)
    await run('abilities', {
      items: fullDefinitions(
        lookup,
        bearers.map(({ id }) => id),
      ),
      abilities: definitionsOfKind(registry, 'ability'),
      effects: definitionsOfKind(registry, 'effect').map(({ id, name }) => ({ id, name })),
    });
  else log('Stage 6/6: abilities — no new item needs one');

  return raw;
}

/**
 * Full pipeline: theme → staged Gemini composition → normalize → validate → write.
 *
 * An invalid package is written too, so a human can fix it; the call then fails with its findings.
 * @param {Object} params
 * @param {string} [params.prompt] - Theme seed; synthesized from the lore when omitted.
 * @param {string} [params.model] - Gemini model id.
 * @param {string} [params.apiKey]
 * @param {number} [params.timeout]
 * @param {string} [params.thinkingLevel]
 * @param {string} [params.lorePath] - Lore document for theme synthesis; the world foundation by default.
 * @param {string} [params.spaceContext]
 * @param {string} [params.tone]
 * @param {string} [params.factionContext] - Comma-separated foundation faction slugs that drive the saga.
 * @param {string} [params.characterContext]
 * @param {string} [params.culturalExposure]
 * @param {number} [params.temperature]
 * @param {string} [params.out] - Package file; `src/content/sagas/<saga-code>.json` by default.
 * @param {boolean} [params.dryRun=false] - Validate without writing.
 * @param {GeminiClient} [params.client]
 * @param {(line:string)=>void} [params.log]
 * @returns {Promise<{pkg:Object, file:string|null}>}
 * @throws {ContentError} When the package has findings.
 */
export async function generateSaga({
  prompt,
  model,
  apiKey,
  timeout,
  thinkingLevel,
  lorePath,
  spaceContext,
  tone,
  factionContext,
  characterContext,
  culturalExposure,
  temperature,
  out,
  dryRun = false,
  log = console.log,
  client = new GeminiClient({ apiKey, model, timeout, log }),
}) {
  const registry = createRegistry();

  let theme = prompt;
  let lore = '';
  let facets;
  if (!theme) {
    if (lorePath) lore = fs.readFileSync(path.resolve(lorePath), 'utf8');
    log('No --prompt provided; synthesizing a distinct lore-grounded theme...');
    facets = await synthesizeTheme(client, lore, {
      registry,
      thinkingLevel,
      spaceContext,
      tone,
      factionContext,
      temperature,
      log,
    });
    theme = facets.theme;
    log(`Synthesized theme: "${theme}"`);
  } else {
    // With --prompt the prompt is the creative driver: no subject bucket applies.
    facets = {
      spaceContext: resolveSpaceContext(spaceContext),
      tone: resolveTone(tone),
      factions: resolveFactionContext(factionContext, registry),
      subject: '',
    };
    log(`Composing semantics from theme: "${theme}"`);
  }

  const guidance = {
    naming: buildNamingGuidance({ characterContext, culturalExposure }),
    customization: buildCustomizationGuidance({
      spaceContextKey: facets.spaceContext,
      toneKey: facets.tone,
      factions: facets.factions,
      subject: facets.subject,
      registry,
    }),
    spaceContextKey: facets.spaceContext,
  };
  const raw = await composeSemantics(client, { theme, lore, registry, guidance, thinkingLevel, temperature, log });
  const pkg = normalizePackage(raw, { registry, theme });
  log(`Normalized: saga=${pkg.saga.code} references=${pkg.references.length} definitions=${pkg.definitions.length}`);
  let file = null;
  if (!dryRun) {
    file = path.resolve(out || path.join(CONTENT_ROOT, 'sagas', `${pkg.saga.code}.json`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, canonicalJson(pkg));
    log(`Package written to ${file}`);
  }
  const findings = validatePackage(pkg, registry);
  if (findings.length > 0) throw new ContentError(findings);
  return { pkg, file };
}
