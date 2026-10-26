/**
 * Rules of the procedural content: the Genesis Templates and the global palettes. They check the
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

/**
 * The semantic roles of a palette, by weight in an item: its main mass, its second mass, its small
 * dark parts and lines, and its distinct part. Each role of a Genesis Template takes one of them.
 */
export const PALETTE_ROLES = Object.freeze(['primary', 'secondary', 'detail', 'feature']);

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

/**
 * Checks the roles of a Genesis Template: each region of the legend in one role, each role with the
 * palette role it takes and three tones.
 */
function checkRoles({ roles, legend }, report) {
  if (!isPlainObject(roles) || Object.keys(roles).length === 0) return report('roles must name at least one role');
  const owners = new Map();
  for (const [role, { regions, palette, tones, artDirection = false } = {}] of Object.entries(roles)) {
    if (!SLUG_PATTERN.test(role) || GENERATOR_ROLES.includes(role)) report(`role ${role} is not a template role`);
    if (!PALETTE_ROLES.includes(palette)) report(`role ${role}: palette must be one of ${PALETTE_ROLES.join(', ')}`);
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

/** Checks one frame of a region map: one row per canvas row, one legend letter or `.` per cell. */
function checkFrame(rows, { legend, canvas }, where, used, report) {
  if (!Array.isArray(rows) || rows.length !== canvas?.height) return report(`${where} needs ${canvas?.height} rows`);
  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== canvas.width)
      return report(`row ${y} of ${where} needs ${canvas.width} cells`);
    for (const letter of row) {
      if (letter === '.') continue;
      if (!legend?.[letter]) report(`row ${y} of ${where} holds ${letter}, which is not in the legend`);
      used.add(letter);
    }
  });
}

/**
 * Checks the region maps: each direction code holds its frames in play order. How many frames and
 * which codes a template draws is the choice of its author.
 */
function checkDirections(template, report) {
  const { directions, legend } = template;
  if (!isPlainObject(directions) || Object.keys(directions).length === 0)
    return report('directions must map at least one direction code');
  const used = new Set();
  for (const [code, frames] of Object.entries(directions)) {
    if (!DIRECTION_PATTERN.test(code)) report(`${code} is not a direction code`);
    if (!Array.isArray(frames) || frames.length === 0) {
      report(`direction ${code} needs a list of frames`);
      continue;
    }
    frames.forEach((rows, index) => checkFrame(rows, template, `frame ${index} of direction ${code}`, used, report));
  }
  for (const letter of Object.keys(legend ?? {}))
    if (!used.has(letter)) report(`legend letter ${letter} marks no cell`);
}

/**
 * Findings of a Genesis Template: a reusable visual start of a generation. It holds a canvas, the
 * region map of each frame of each direction, the role of each region and the tones of each role.
 * It defines no item: a new item of its type takes its function from `baseline.items` of the
 * foundation.
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
 * Findings of a global palette: a color for `primary` and `outline`, and for any other palette role
 * and `accent` it gives. Every Genesis Template maps its roles onto the palette roles, so a palette
 * fits every item type; a role whose palette role the palette does not give keeps its default. The
 * engine derives the shadow and highlight and checks the contrast.
 * @param {Object} palette
 * @param {Object} context
 * @param {Set<string>} context.biomes - The slugs of the foundation biomes.
 * @returns {string[]}
 */
export function paletteFindings(palette, { biomes }) {
  const findings = [];
  const report = (message) => findings.push(message);
  const roles = [...PALETTE_ROLES, ...GENERATOR_ROLES];
  if (!SLUG_PATTERN.test(palette.id ?? '')) report('id must be a slug');
  if (!isText(palette.name)) report('name is required');
  if (!PALETTE_FAMILIES.includes(palette.family)) report(`family must be one of ${PALETTE_FAMILIES.join(', ')}`);
  if (!Array.isArray(palette.biomeTags) || palette.biomeTags.some((tag) => !biomes.has(tag)))
    report('biomeTags must name foundation biomes by slug');
  const given = Object.entries(isPlainObject(palette.roles) ? palette.roles : {});
  if (
    !palette.roles?.primary ||
    !palette.roles?.outline ||
    given.some(([role, color]) => !roles.includes(role) || !COLOR_PATTERN.test(color))
  )
    report(`roles must give primary and outline, and only ${roles.join(', ')}, each a color as #rrggbb`);
  const { minContrast, contrastRoles } = palette.constraints ?? {};
  if (!(Number.isFinite(minContrast) && minContrast >= 0)) report('constraints.minContrast must be a number from 0');
  if (
    !Array.isArray(contrastRoles) ||
    contrastRoles.length === 0 ||
    contrastRoles.some((role) => !PALETTE_ROLES.includes(role) || !palette.roles?.[role])
  )
    report('constraints.contrastRoles must name palette roles the palette gives');
  for (const key of Object.keys(palette))
    if (!['id', 'name', 'family', 'biomeTags', 'roles', 'constraints'].includes(key))
      report(`${key} is not a palette field`);
  return findings;
}
