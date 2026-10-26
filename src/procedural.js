/**
 * The procedural content: the Genesis Templates and the global palettes a procedural generation
 * starts from. One JSON file holds one of them, at `procedural/<kind>/<id>.json`. They are visual
 * starting points: region maps, role tones and palettes. They define no item.
 *
 * @module src/procedural.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { kindOf, slugOf } from './schema/definitions.js';
import { genesisTemplateFindings, paletteFindings } from './validation/procedural.js';

const readTemplates = (root, kind, findings) => {
  const directory = path.join(root, 'procedural', kind);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const template = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      if (`${template.id}.json` !== file)
        findings.push({ id: `procedural/${kind}/${file}`, message: `file must be named ${template.id}.json` });
      return template;
    });
};

/**
 * The procedural content of a content directory, and its findings against the foundation.
 * @param {string} root - Content directory.
 * @param {Object} registry - Foundation registry.
 * @returns {{templates:Object[], palettes:Object[], findings:Array<{id:string,message:string}>}}
 */
export function readProcedural(root, registry) {
  const findings = [];
  const templates = readTemplates(root, 'genesis-templates', findings);
  const palettes = readTemplates(root, 'palettes', findings);
  const biomes = new Set([...registry.definitions.keys()].filter((id) => kindOf(id) === 'biome').map(slugOf));
  const itemBaseline = registry.baseline.items ?? {};
  for (const template of templates)
    for (const message of genesisTemplateFindings(template, itemBaseline))
      findings.push({ id: `procedural/genesis-templates/${template.id}`, message });
  for (const palette of palettes)
    for (const message of paletteFindings(palette, { biomes }))
      findings.push({ id: `procedural/palettes/${palette.id}`, message });
  const names = new Map();
  for (const { id, name } of palettes) {
    if (names.has(name))
      findings.push({ id: `procedural/palettes/${id}`, message: `name ${name} is the name of ${names.get(name)}` });
    names.set(name, id);
  }
  return { templates, palettes, findings };
}
