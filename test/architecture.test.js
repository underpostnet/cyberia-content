import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesUnder } from '../src/validation/format.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const importsOf = (file) =>
  [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+'([^']+)'/gm)].map(
    ([, specifier]) => specifier,
  );
const sources = ['bin', 'src']
  .flatMap((directory) => filesUnder(path.join(root, directory)).map((file) => `${directory}/${file}`))
  .filter((file) => file.endsWith('.js'));

describe('repository boundary', () => {
  it('imports nothing outside this repository', () => {
    for (const file of sources)
      for (const specifier of importsOf(file).filter((name) => name.startsWith('.'))) {
        const target = path.resolve(root, path.dirname(file), specifier);
        expect(target.startsWith(root) && fs.existsSync(target), `${file} → ${specifier}`).toBe(true);
      }
  });

  it('uses only Node built-ins in src and declared dependencies in bin', () => {
    const declared = Object.keys(pkg.devDependencies);
    for (const file of sources)
      for (const specifier of importsOf(file).filter((name) => !name.startsWith('.'))) {
        if (specifier.startsWith('node:')) continue;
        expect(file.startsWith('bin/') && declared.includes(specifier), `${file} → ${specifier}`).toBe(true);
      }
  });

  it('publishes the artifact only: data, no code', () => {
    expect(pkg.files).toEqual(['dist/']);
    expect(pkg).not.toHaveProperty('main');
    expect(pkg).not.toHaveProperty('exports');
  });
});
