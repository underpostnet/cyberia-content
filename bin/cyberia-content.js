#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Command, InvalidArgumentError } from 'commander';
import dotenv from 'dotenv';
import { CONTENT_ROOT } from '../src/foundation.js';
import { generateSaga } from '../src/generator/index.js';
import { PACKAGE_ROOT, artifactContent, artifactManifest, sourceRevision, writeArtifact } from '../src/packaging/build.js';
import { sagaInstanceBackup, writeInstanceBackup } from '../src/saga-instance.js';
import { readContent } from '../src/validation/content.js';
import { formatContent } from '../src/validation/format.js';

const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const program = new Command();
program
  .name('cyberia-content')
  .description('Cyberia content: validate, generate and build the versioned content artifact.')
  .version(version)
  .option('--env-file <path>', 'read environment variables from this file instead of ./.env');
program.addHelpCommand(false);

// ./.env is where GEMINI_API_KEY lives. A variable already in the environment wins.
program.hook('preAction', () => {
  const { envFile } = program.opts();
  const file = path.resolve(envFile ?? '.env');
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false, quiet: true });
  else if (envFile) throw new Error(`Environment file not found: ${file}`);
});

const number = (value) => {
  if (value.trim() === '' || !Number.isFinite(Number(value)))
    throw new InvalidArgumentError('Expected a finite number.');
  return Number(value);
};

const fail = (findings) => {
  for (const { id, message } of findings) console.error(`${id}: ${message}`);
  process.exit(1);
};

program
  .command('validate')
  .option('--fix', 'rewrite each content JSON file in canonical form first')
  .description('Validate the content: canonical form, foundation, procedural templates, sagas and instances')
  .action((options) => {
    if (options.fix) for (const file of formatContent(CONTENT_ROOT)) console.log(`Rewrote ${file}`);
    const { findings, registry, sagas, instances, procedural } = readContent();
    if (findings.length > 0) fail(findings);
    console.log(
      `Content ${version} is valid: ${registry.definitions.size} definitions, ${sagas.size} saga(s), ` +
        `${instances.length} instance(s), ${procedural.templates.length} genesis template(s), ` +
        `${procedural.palettes.length} palette(s)`,
    );
  });

const saga = program.command('saga').description('Saga generation over the foundation');
saga.addHelpCommand(false);

saga
  .command('generate')
  .option('--prompt <theme>', 'theme seed; a distinct theme is synthesized from the lore when omitted')
  .option('--model <model>', 'Gemini model id (default: gemma-4-26b-a4b-it)')
  .option('--timeout <ms>', 'per-request timeout in ms', number)
  .option('--thinking-level <level>', 'Gemini thinking level: low | medium | high (default: high)')
  .option('--lore-path <path>', 'lore document for theme synthesis (default: the world foundation)')
  .option('--space-context <context>', 'spatial layer: physical | mixed | hyperspace (default: random)')
  .option('--tone <tone>', 'narrative type: adventure | politics | tragic | comedy (default: random)')
  .option('--faction-context <keys>', "comma-separated confederations that drive the saga, e.g. 'nova,zenith'")
  .option(
    '--character-context <keys>',
    'comma-separated name pools: low_level_synthetics | high_fidelity_synthetics | global_latin_diaspora | ' +
      'east_asian_pacific_diaspora | middle_eastern_turkish_diaspora | sub_saharan_african_diaspora | ' +
      'classic_western_scifi | mutagen_clans (default: a random subset)',
  )
  .option('--cultural-exposure <mode>', 'naming diversity: cosmopolitan | local (default: random)')
  .option('--temperature <value>', 'sampling temperature, 0.0 to 2.0 (default: 1.3 for theme synthesis)', number)
  .option('--out <file>', 'package file (default: src/content/sagas/<saga-code>.json)')
  .option('--dry-run', 'generate, normalize and validate without writing')
  .description('Compose a saga over the foundation with Google Gemini and write its package')
  .action(async (options) => {
    try {
      await generateSaga({ ...options, dryRun: !!options.dryRun });
    } catch (error) {
      if (!error.findings) throw error;
      fail(error.findings);
    }
  });

saga
  .command('instance <saga-code>')
  .option('--force', 'replace the instance directory when it exists')
  .option('--dry-run', 'list the files without writing')
  .description(
    'Write the instance backup of a saga to src/content/instances/<saga-code>/: its runtime documents, ' +
      'with no render and no placement',
  )
  .action((code, options) => {
    const { findings, registry, sagas } = readContent();
    if (findings.length > 0) fail(findings);
    if (!sagas.has(code)) fail([{ id: `sagas/${code}.json`, message: 'is not a saga of the content' }]);
    const files = sagaInstanceBackup(sagas.get(code), registry);
    const directory = path.join(CONTENT_ROOT, 'instances', code);
    if (options.dryRun) {
      for (const file of [...files.keys()].sort()) console.log(file);
      return;
    }
    if (fs.existsSync(directory) && !options.force)
      fail([{ id: `instances/${code}`, message: 'exists; --force replaces it, with its render and placement' }]);
    writeInstanceBackup(directory, files);
    console.log(`Wrote ${directory}: ${files.size} file(s)`);
  });

program
  .command('build')
  .description('Build dist/: the artifact of the committed content')
  .action(() => {
    const content = artifactContent();
    const manifest = artifactManifest({ ...content, sourceRevision: sourceRevision() });
    const dist = writeArtifact({ files: content.files, manifest });
    console.log(`Built ${dist}: content ${manifest.contentVersion}, ${manifest.contentDigest}`);
  });

program
  .command('pack')
  .description('Build the artifact and pack it as artifacts/cyberia-content-<version>.tgz')
  .action(() => {
    fs.mkdirSync(path.join(PACKAGE_ROOT, 'artifacts'), { recursive: true });
    execFileSync('npm', ['pack', '--pack-destination', 'artifacts'], { cwd: PACKAGE_ROOT, stdio: 'inherit' });
  });

await program.parseAsync();
