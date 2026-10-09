/**
 * Rules of the procedural content: the Genesis Templates and the Palette Templates. They check the
 * authored form. The engine verifies the artifact again when it reads it.
 *
 * @module src/validation/procedural.js
 */
import { CONTRACT } from '../schema/contract.js';
import { COLOR_PATTERN, SLUG_PATTERN, kindOf, slugOf } from '../schema/definitions.js';

/** The palette families, in the order a client lists them. */
export const PALETTE_FAMILIES = Object.freeze(['natural', 'dark', 'light', 'warm', 'cool', 'biome', 'exotic']);

/** The roles every generator colors besides the roles of a template. */
export const GENERATOR_ROLES = Object.freeze(['outline', 'accent']);

const TONES = Object.freeze(['shadow', 'base', 'highlight']);
const REGION_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const DIRECTION_PATTERN = /^\d{2}$/;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isCount = (value) => Number.isSafeInteger(value) && value > 0;

/** Checks the id of a template: `<itemType>.<slug>` of a runtime item type. */
function checkIdentity(template, report) {
  if (!CONTRACT.itemTypes.includes(template.itemType)) report(`itemType ${template.itemType} is not an item type`);
  if (kindOf(template.id) !== template.itemType || !SLUG_PATTERN.test(slugOf(template.id)))
    report(`id must be ${template.itemType}.<slug>`);
  if (!isText(template.name)) report('name is required');
}

/** Checks the roles of a Genesis Template: each region of the legend in one role, three tones each. */
function checkRoles({ roles, legend }, report) {
  if (!isPlainObject(roles) || Object.keys(roles).length === 0) return report('roles must name at least one role');
  const owners = new Map();
  for (const [role, { regions, tones, artDirection = false } = {}] of Object.entries(roles)) {
    if (!SLUG_PATTERN.test(role) || GENERATOR_ROLES.includes(role)) report(`role ${role} is not a template role`);
    if (!Array.isArray(regions) || regions.length === 0) report(`role ${role} needs regions`);
    for (const region of regions ?? []) {
      if (owners.has(region)) report(`region ${region} is in roles ${owners.get(region)} and ${role}`);
      owners.set(region, role);
    }
    if (!isPlainObject(tones) || !TONES.every((tone) => COLOR_PATTERN.test(tones[tone] ?? '')))
      report(`role ${role} needs the tones ${TONES.join(', ')} as #rrggbb`);
    if (typeof artDirection !== 'boolean') report(`role ${role}: artDirection must be a boolean`);
  }
  for (const region of Object.values(legend ?? {}))
    if (!owners.has(region)) report(`region ${region} is in no role`);
  for (const region of owners.keys())
    if (!Object.values(legend ?? {}).includes(region)) report(`region ${region} is not in the legend`);
}

/** Checks the region maps: one row per canvas row, one legend letter or `.` per cell. */
function checkDirections({ directions, legend, canvas }, report) {
  if (!isPlainObject(directions) || Object.keys(directions).length === 0)
    return report('directions must map at least one direction code');
  const used = new Set();
  for (const [code, rows] of Object.entries(directions)) {
    if (!DIRECTION_PATTERN.test(code)) report(`${code} is not a direction code`);
    if (!Array.isArray(rows) || rows.length !== canvas?.height) {
      report(`direction ${code} needs ${canvas?.height} rows`);
      continue;
    }
    rows.forEach((row, y) => {
      if (typeof row !== 'string' || row.length !== canvas.width)
        return report(`row ${y} of direction ${code} needs ${canvas.width} cells`);
      for (const letter of row) {
        if (letter === '.') continue;
        if (!legend?.[letter]) report(`row ${y} of direction ${code} holds ${letter}, which is not in the legend`);
        used.add(letter);
      }
    });
  }
  for (const letter of Object.keys(legend ?? {}))
    if (!used.has(letter)) report(`legend letter ${letter} marks no cell`);
}

/**
 * Findings of a Genesis Template: a reusable visual start of a generation. It holds a canvas, the
 * region map of each direction, the role of each region and the tones of each role. It defines no
 * item: a new item of its type takes its function from `baseline.items` of the foundation.
 * @param {Object} template
 * @param {Object<string,string>} itemBaseline - `baseline.items` of the foundation manifest.
 * @returns {string[]}
 */
export function genesisTemplateFindings(template, itemBaseline) {
  const findings = [];
  const report = (message) => findings.push(message);
  checkIdentity(template, report);
  if (!isText(template.description)) report('description is required');
  if (!itemBaseline[template.itemType]) report(`foundation.json names no baseline.items.${template.itemType}`);
  if (!isCount(template.canvas?.width) || !isCount(template.canvas?.height))
    report('canvas needs a positive integer width and height');
  if (!isCount(template.frameDurationMs)) report('frameDurationMs must be a positive integer');
  if (!COLOR_PATTERN.test(template.outline ?? '')) report('outline must be #rrggbb');
  const legend = template.legend;
  if (
    !isPlainObject(legend) ||
    Object.keys(legend).length === 0 ||
    Object.entries(legend).some(([letter, region]) => letter.length !== 1 || letter === '.' || !REGION_PATTERN.test(region)) ||
    new Set(Object.values(legend)).size !== Object.keys(legend).length
  )
    report('legend maps one letter to each region id, once each');
  checkRoles(template, report);
  checkDirections(template, report);
  return findings;
}

/**
 * Findings of a Palette Template: a base color for roles of its item type. A role is a role of a
 * Genesis Template of that type, or a generator role. The engine derives the shadow and highlight.
 * @param {Object} palette
 * @param {Object} context
 * @param {Object[]} context.templates - Every Genesis Template.
 * @param {Set<string>} context.biomes - The slugs of the foundation biomes.
 * @returns {string[]}
 */
export function paletteFindings(palette, { templates, biomes }) {
  const findings = [];
  const report = (message) => findings.push(message);
  checkIdentity(palette, report);
  if (!PALETTE_FAMILIES.includes(palette.family)) report(`family must be one of ${PALETTE_FAMILIES.join(', ')}`);
  if (!Array.isArray(palette.biomeTags) || palette.biomeTags.some((tag) => !biomes.has(tag)))
    report('biomeTags must name foundation biomes by slug');
  const roles = palette.roles;
  if (!isPlainObject(roles) || !Object.values(roles).every((color) => COLOR_PATTERN.test(color)))
    report('roles must give each role a color as #rrggbb');
  else if (!roles.outline) report('roles needs an outline');
  const fits = templates
    .filter(({ itemType }) => itemType === palette.itemType)
    .some((template) => Object.keys(roles ?? {}).every((role) => GENERATOR_ROLES.includes(role) || template.roles?.[role]));
  if (!fits) report(`its roles fit no ${palette.itemType} Genesis Template`);
  const { minContrast, contrastRoles } = palette.constraints ?? {};
  if (!(Number.isFinite(minContrast) && minContrast >= 0)) report('constraints.minContrast must be a number from 0');
  if (!Array.isArray(contrastRoles) || contrastRoles.some((role) => !roles?.[role]))
    report('constraints.contrastRoles must name roles of the palette');
  return findings;
}
