import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ContentError } from '../src/foundation.js';
import { generateSaga } from '../src/generator/index.js';
import { canonicalJson } from '../src/validation/format.js';
import { brief } from './fixtures.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-generator-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

// What each stage of the model answers, keyed by the stage its system prompt names.
const answers = () => ({
  composition: {
    saga: { code: 'relay-watch', name: 'Relay Watch', description: 'A relay goes quiet.' },
    references: ['character.drift-merchant', 'biome.ash-wastes'],
    definitions: [
      {
        id: 'weapon.relay-rifle',
        name: 'Relay Rifle',
        description: 'A rifle built from a relay mast.',
        role: 'The weapon of the saga.',
        artBrief: brief,
        objectLayer: { itemType: 'weapon', stats: { effect: 7 } },
      },
    ],
  },
  maps: {
    definitions: [
      {
        id: 'map.relay-camp',
        name: 'Relay Camp',
        description: 'A camp by the relay.',
        role: 'The hub of the saga.',
        biome: 'biome.ash-wastes',
        composition: [
          { entity: 'floor.ash-crust', count: 1 },
          { entity: 'character.ash-raider', count: 3 },
        ],
      },
    ],
  },
  quests: {
    definitions: [
      {
        id: 'quest.relay-first',
        name: 'Relay First',
        description: 'Talk to the merchant.',
        role: 'The first quest of the saga.',
        provider: 'character.drift-merchant',
        steps: [
          {
            id: 'ask',
            description: 'Ask the merchant.',
            objectives: [{ type: 'talk', target: 'character.drift-merchant', quantity: 1 }],
          },
        ],
        rewards: [{ item: 'weapon.relay-rifle', quantity: 1 }],
      },
    ],
  },
  dialogues: { definitions: [{ id: 'quest.relay-first', talk: [{ text: 'The relay went quiet at dusk.' }] }] },
  actions: {
    definitions: [
      {
        id: 'action.relay-stall',
        name: 'Relay Stall',
        description: 'The merchant sells relay parts.',
        role: 'Offers the relay quest.',
        provider: 'character.drift-merchant',
        shop: [{ item: 'weapon.relay-rifle', price: 'currency.coin', quantity: 30 }],
      },
    ],
  },
  abilities: { definitions: [{ id: 'weapon.relay-rifle', abilities: ['ability.pulse-shot'] }] },
});

/** A model double: no network, no engine. It records every prompt it receives. */
const stubClient = (edit = () => {}) => {
  const stages = answers();
  edit(stages);
  const prompts = [];
  return {
    prompts,
    chatJson: async ({ system, user }) => {
      prompts.push({ system, user });
      const stage = system.match(/STAGE: (\w+)/)?.[1];
      return stage ? stages[stage] : { theme: 'A relay keeper waits in the ash wastes.' };
    },
  };
};

const log = () => {};

describe('saga generation', () => {
  it('composes, normalizes, validates and writes a package without the engine', async () => {
    const out = path.join(scratch, 'relay-watch.json');
    const { pkg, file } = await generateSaga({ prompt: 'A relay keeper', out, client: stubClient(), log });
    expect(file).toBe(out);
    expect(fs.readFileSync(out, 'utf8')).toBe(canonicalJson(pkg));
    expect(pkg.saga.code).toBe('relay-watch');
    expect(pkg.definitions.map(({ id }) => id)).toEqual([
      'action.relay-stall',
      'map.relay-camp',
      'quest.relay-first',
      'weapon.relay-rifle',
    ]);
    expect(pkg.definitions.find(({ id }) => id === 'weapon.relay-rifle').abilities).toEqual(['ability.pulse-shot']);
    expect(pkg.definitions.find(({ id }) => id === 'quest.relay-first').talk).toEqual([
      { text: 'The relay went quiet at dusk.' },
    ]);
    expect(pkg.references).toEqual(expect.arrayContaining(['character.drift-merchant', 'biome.ash-wastes']));
  });

  it('reads the compact foundation index once, then the full definitions each stage works with', async () => {
    const client = stubClient();
    await generateSaga({ prompt: 'A relay keeper', dryRun: true, client, log });
    const stage = (name) => client.prompts.find(({ system }) => system.includes(`STAGE: ${name}.`)).user;
    expect(stage('composition')).toContain('CYBERIA FOUNDATION (reuse these ids):');
    expect(stage('maps')).not.toContain('CYBERIA FOUNDATION');
    expect(stage('maps')).toContain('"id":"character.drift-merchant"');
    expect(stage('maps')).toContain('"voice":');
    expect(stage('maps')).not.toContain('"artBrief"');
    expect(stage('maps')).toMatch(
      /"id":"biome\.ash-wastes","name":"Ash Wastes","entities":\[[^\]]*"character\.ash-raider"/,
    );
    expect(stage('actions')).toContain('"providers":[{"id":"character.drift-merchant"');
  });

  it('writes nothing on a dry run', async () => {
    const { pkg, file } = await generateSaga({ prompt: 'A relay keeper', dryRun: true, client: stubClient(), log });
    expect(file).toBe(null);
    expect(pkg.definitions.some(({ id }) => id === 'quest.relay-first')).toBe(true);
  });

  it('synthesizes a theme from the world foundation when no prompt or lore is given', async () => {
    const client = stubClient();
    await generateSaga({ dryRun: true, client, log });
    expect(client.prompts[0].system).toContain('BASE LORE:');
    expect(client.prompts[0].system).toMatch(/region\.\S+ — /);
    expect(client.prompts[1].user).toContain('Theme seed: A relay keeper waits in the ash wastes.');
  });

  it('takes from each stage only the kinds it creates, and fields for definitions the saga holds', async () => {
    const client = stubClient((stages) => {
      stages.maps.definitions.push({ id: 'quest.stray', name: 'Stray', steps: [] });
      stages.dialogues.definitions.push(
        { id: 'quest.relay-ghost', talk: [{ text: 'No quest asked for this.' }] },
        { id: 'character.nobody', greeting: [{ text: 'No one wrote me.' }] },
      );
    });
    const { pkg } = await generateSaga({ prompt: 'A relay keeper', dryRun: true, client, log });
    const ids = pkg.definitions.map(({ id }) => id);
    expect(ids).toContain('quest.relay-first');
    expect(ids).not.toContain('quest.stray');
    expect(ids).not.toContain('quest.relay-ghost');
    expect(ids).not.toContain('character.nobody');
    expect(pkg.definitions.find(({ id }) => id === 'quest.relay-first').talk).toEqual([
      { text: 'The relay went quiet at dusk.' },
    ]);
  });

  it('reports a quest without steps as a finding rather than failing mid-generation', async () => {
    const client = stubClient((stages) => {
      delete stages.quests.definitions[0].steps;
    });
    const error = await generateSaga({ prompt: 'A relay keeper', dryRun: true, client, log }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ContentError);
    expect(error.findings.some(({ id }) => id === 'quest.relay-first')).toBe(true);
  });

  it('writes an invalid package for a human to fix, then fails with its findings', async () => {
    const out = path.join(scratch, 'broken.json');
    const client = stubClient((stages) => {
      stages.quests.definitions[0].provider = 'character.nobody';
    });
    const error = await generateSaga({ prompt: 'A relay keeper', out, client, log }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ContentError);
    expect(error.findings).toContainEqual({
      id: 'quest.relay-first',
      message: 'provider names unknown definition character.nobody',
    });
    expect(fs.existsSync(out)).toBe(true);
  });
});
