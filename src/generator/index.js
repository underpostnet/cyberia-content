/**
 * The semantic generator: dynamic semantic composition over the foundation.
 *
 * From a theme (given, or synthesized from the base lore), Google Gemini composes a saga in six
 * bounded stages: composition (which foundation definitions the saga uses, and the few new ones
 * it needs), maps, quests, dialogues, actions and abilities. Every stage returns definitions of
 * the foundation model. The result is a saga package, normalized and validated against the
 * foundation and the sagas it may reuse, and written to `src/content/sagas/`. The foundation never
 * changes; spatial and graphic authoring follow.
 *
 * A generation is a state that each step advances: the theme, each stage, then the package. The
 * state is JSON, so a caller can store it after each step and resume a generation that stopped.
 *
 * @module src/generator/index.js
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GeminiClient } from './gemini-client.js';
import {
  CONTENT_ROOT,
  ContentError,
  createRegistry,
  definitionsOfKind,
  readFoundation,
  sagaBase,
} from '../foundation.js';
import { ENTITY_KINDS, FOUNDATION_KINDS, KINDS, isLabeled, kindOf } from '../schema/definitions.js';
import { readSagas } from '../validation/content.js';
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

/** The steps of a generation, in order: the theme, the six stages, then the package. */
export const GENERATION_STEPS = Object.freeze(['theme', ...STAGES, 'package']);

/**
 * A generation that has run no step: what the moderator asks for.
 * @param {Object} request
 * @param {string} [request.prompt] - Theme seed; synthesized from the lore when omitted.
 * @param {string} [request.lore] - Lore text for theme synthesis; the world foundation when empty.
 * @param {{code?:string, name?:string, description?:string}} [request.saga] - The identity the saga keeps.
 * @param {string[]} [request.reuse] - Ids of the foundation or of `sagas` the saga must use.
 * @param {string[]} [request.sagas] - Codes of the sagas whose definitions the saga may reuse.
 * @param {string} [request.spaceContext]
 * @param {string} [request.tone]
 * @param {string} [request.factionContext] - Comma-separated foundation faction slugs that drive the saga.
 * @param {string} [request.characterContext]
 * @param {string} [request.culturalExposure]
 * @param {string} [request.thinkingLevel]
 * @param {number} [request.temperature]
 * @param {string} [request.model] - Gemini model id.
 * @param {number} [request.timeout] - Per-request timeout in ms.
 * @returns {{request:Object, steps:string[], done:string[]}} `steps` are every step in order; `done` the steps run.
 */
export const generationState = (request) => ({ request, steps: [...GENERATION_STEPS], done: [] });

/**
 * The next step of a generation, or null when every step is done.
 * @param {{done:string[]}} state
 * @returns {string|null}
 */
export const nextStep = ({ done }) => GENERATION_STEPS.find((step) => !done.includes(step)) ?? null;

/**
 * The registry a generation composes against: the foundation and the sagas it may reuse.
 * @param {string[]} [codes] - Saga codes.
 * @param {string} [root] - Content directory.
 * @returns {Object}
 * @throws {RangeError} When a code names no saga of the content.
 */
export function generationRegistry(codes = [], root = CONTENT_ROOT) {
  const registry = createRegistry(readFoundation(path.join(root, 'foundation')));
  const sagas = readSagas(root);
  const unknown = codes.filter((code) => !sagas.has(code));
  if (unknown.length > 0) throw new RangeError(`No saga ${unknown.join(', ')} in the content`);
  return sagaBase(registry, new Map(codes.map((code) => [code, sagas.get(code)])));
}

const nonEmpty = (identity = {}) =>
  Object.fromEntries(Object.entries(identity).filter(([, value]) => typeof value === 'string' && value.trim()));

/** The theme and the guidance every stage shares. */
async function themeStep(state, { registry, client, log }) {
  const { request } = state;
  const unknown = (request.reuse ?? []).filter((id) => !registry.definitions.has(id));
  if (unknown.length > 0) throw new RangeError(`Unknown definitions to reuse: ${unknown.join(', ')}`);
  let facets;
  if (!request.prompt) {
    log('No prompt provided; synthesizing a distinct lore-grounded theme...');
    facets = await synthesizeTheme(client, request.lore ?? '', { registry, ...request, log });
    log(`Synthesized theme: "${facets.theme}"`);
  } else {
    // With a prompt the prompt is the creative driver: no subject bucket applies.
    facets = {
      theme: request.prompt,
      spaceContext: resolveSpaceContext(request.spaceContext),
      tone: resolveTone(request.tone),
      factions: resolveFactionContext(request.factionContext, registry),
      subject: '',
    };
    log(`Composing semantics from theme: "${facets.theme}"`);
  }
  const { theme, factions, ...kept } = facets;
  return {
    theme,
    facets: { ...kept, factions: factions.map(({ id }) => id) },
    guidance: {
      naming: buildNamingGuidance(request),
      customization: buildCustomizationGuidance({
        spaceContextKey: facets.spaceContext,
        toneKey: facets.tone,
        factions,
        subject: facets.subject,
        registry,
      }),
      spaceContextKey: facets.spaceContext,
    },
  };
}

/** What each stage after the composition reads, from the package so far. */
const STAGE_CONTEXTS = {
  maps: ({ pkg, registry, selected }) => {
    const entities = [...registry.definitions.values(), ...pkg.definitions].filter(({ id }) =>
      ENTITY_KINDS.includes(kindOf(id)),
    );
    return {
      saga: pkg.saga,
      definitions: selected(),
      biomes: definitionsOfKind(registry, 'biome').map(({ id, name, region }) => ({
        id,
        name,
        entities: entities
          .filter(({ locations = [] }) => locations.includes(id) || locations.includes(region))
          .map((entity) => entity.id),
      })),
    };
  },
  quests: ({ selected }) => ({ definitions: selected() }),
  dialogues: ({ own, lookup }) => ({
    characters: fullDefinitions(
      lookup,
      own('character').map(({ id }) => id),
    ),
    quests: own('quest').filter((quest) => talkTargetsOf(quest).length > 0),
  }),
  actions: ({ own, lookup, registry, selected }) => {
    const economy = registry.definitions.get(registry.baseline.economy);
    return {
      providers: fullDefinitions(
        lookup,
        own('quest').flatMap((quest) => [quest.provider, ...talkTargetsOf(quest)]),
      ),
      items: selected().filter(({ id }) => isLabeled(id)),
      currencies: definitionsOfKind(registry, 'currency').map(({ id, name }) => ({ id, name })),
      markets: definitionsOfKind(registry, 'market').map(({ id, name, scope, modes }) => ({ id, name, scope, modes })),
      economy: { id: economy.id, defaults: economy.defaults, items: economy.items ?? [] },
    };
  },
  abilities: ({ pkg, lookup, registry }) => {
    const bearers = pkg.definitions.filter(({ id, abilities }) => KINDS[kindOf(id)].fields.abilities && !abilities);
    if (bearers.length === 0) return null;
    return {
      items: fullDefinitions(
        lookup,
        bearers.map(({ id }) => id),
      ),
      abilities: definitionsOfKind(registry, 'ability'),
      effects: definitionsOfKind(registry, 'effect').map(({ id, name }) => ({ id, name })),
    };
  },
};

/** One stage: the model answers it, and the package takes the definitions of the kinds it creates. */
async function stageStep(stage, state, { registry, client, log }) {
  const { request, theme, guidance } = state;
  const ask = ({ catalog = '', context } = {}) =>
    client.chatJson({
      system: buildStagePrompt(stage, guidance),
      user: buildStageUser({ theme, lore: request.lore ?? '', catalog, context }),
      thinkingLevel: request.thinkingLevel,
      temperature: request.temperature,
    });
  log(`Stage ${STAGES.indexOf(stage) + 1}/${STAGES.length}: ${stage}`);
  if (stage === 'composition') {
    const identity = nonEmpty(request.saga);
    const fixed = Object.keys(identity).length > 0 || request.reuse?.length > 0;
    const answer = await ask({
      catalog: foundationCatalog(registry),
      context: fixed ? { saga: identity, reuse: request.reuse ?? [] } : undefined,
    });
    const raw = {
      saga: answer?.saga,
      definitions: stageDefinitions(answer, { kinds: STAGE_KINDS.composition, existing: new Set() }),
    };
    const pkg = normalizePackage(raw, { registry, theme });
    raw.saga = { ...pkg.saga, ...identity };
    const references = [
      ...(Array.isArray(answer?.references) ? answer.references : []),
      ...(request.reuse ?? []),
      ...pkg.references,
    ];
    return { raw, references: [...new Set(references)] };
  }
  const pkg = normalizePackage(state.raw, { registry, theme });
  const lookup = (id) => pkg.definitions.find((definition) => definition.id === id) ?? registry.definitions.get(id);
  const own = (kind) => pkg.definitions.filter(({ id }) => kindOf(id) === kind);
  const selected = () => fullDefinitions(lookup, [...state.references, ...pkg.definitions.map(({ id }) => id)]);
  const context = STAGE_CONTEXTS[stage]({ pkg, registry, lookup, own, selected });
  if (!context) {
    log(`Stage ${STAGES.indexOf(stage) + 1}/${STAGES.length}: ${stage} — nothing needs it`);
    return {};
  }
  const existing = new Set(pkg.definitions.map(({ id }) => id));
  const added = stageDefinitions(await ask({ context }), { kinds: STAGE_KINDS[stage], existing });
  return { raw: { ...state.raw, definitions: [...state.raw.definitions, ...added] } };
}

/**
 * Runs the next step of a generation. A step reads only the state and the registry, so a step that
 * fails runs again from the same state, and the steps done before it never run again.
 * @param {Object} state - {@link generationState}, or the state a step returned.
 * @param {Object} params
 * @param {Object} params.registry - {@link generationRegistry}.
 * @param {GeminiClient} params.client
 * @param {(line:string)=>void} [params.log]
 * @returns {Promise<Object>} The next state. After the `package` step it holds `package` and `findings`.
 * @throws {RangeError} When the request cannot run; a retry meets the same refusal.
 */
export async function runStep(state, { registry, client, log = console.log }) {
  const step = nextStep(state);
  if (!step) return state;
  let result;
  if (step === 'theme') result = await themeStep(state, { registry, client, log });
  else if (step === 'package') {
    const pkg = normalizePackage(state.raw, { registry, theme: state.theme });
    log(`Normalized: saga=${pkg.saga.code} references=${pkg.references.length} definitions=${pkg.definitions.length}`);
    result = { package: pkg, findings: validatePackage(pkg, registry) };
  } else result = await stageStep(step, state, { registry, client, log });
  return { ...state, ...result, steps: [...GENERATION_STEPS], done: [...state.done, step] };
}

/**
 * Full pipeline: theme → staged Gemini composition → normalize → validate → write.
 *
 * An invalid package is written too, so a human can fix it; the call then fails with its findings.
 * @param {Object} params - The request of {@link generationState}, and:
 * @param {string} [params.lorePath] - Lore document for theme synthesis; the world foundation by default.
 * @param {string} [params.apiKey]
 * @param {string} [params.out] - Package file; `src/content/sagas/<saga-code>.json` by default.
 * @param {boolean} [params.dryRun=false] - Validate without writing.
 * @param {GeminiClient} [params.client]
 * @param {(line:string)=>void} [params.log]
 * @returns {Promise<{pkg:Object, file:string|null}>}
 * @throws {ContentError} When the package has findings.
 */
export async function generateSaga({ lorePath, apiKey, out, dryRun = false, log = console.log, client, ...request }) {
  const registry = generationRegistry(request.sagas);
  const lore = lorePath ? fs.readFileSync(path.resolve(lorePath), 'utf8') : request.lore;
  client ??= new GeminiClient({ apiKey, model: request.model, timeout: request.timeout, log });
  let state = generationState({ ...request, lore });
  while (nextStep(state)) state = await runStep(state, { registry, client, log });
  const { package: pkg, findings } = state;
  let file = null;
  if (!dryRun) {
    file = path.resolve(out || path.join(CONTENT_ROOT, 'sagas', `${pkg.saga.code}.json`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, canonicalJson(pkg));
    log(`Package written to ${file}`);
  }
  if (findings.length > 0) throw new ContentError(findings);
  return { pkg, file };
}
