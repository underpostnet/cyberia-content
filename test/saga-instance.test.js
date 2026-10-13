import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSaga } from '../src/compiler.js';
import { sagaInstanceBackup, writeInstanceBackup } from '../src/saga-instance.js';
import { readContent } from '../src/validation/content.js';
import { canonicalJson, filesUnder, formatFindings } from '../src/validation/format.js';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberia-saga-instance-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

const { registry, sagas } = readContent();
const [pkg] = sagas.values();
const { families } = compileSaga(pkg, registry);
const files = sagaInstanceBackup(pkg, registry);
const documentsIn = (directory) =>
  [...files].filter(([file]) => file.startsWith(`${directory}/`)).map(([, document]) => document);

describe('the instance backup of a saga', () => {
  it('is the same bytes for the same saga', () => {
    expect(canonicalJson([...sagaInstanceBackup(pkg, registry)])).toBe(canonicalJson([...files]));
  });

  it('holds the instance of the saga code, its conf and every entity-type default the conf names', () => {
    const conf = files.get('cyberia-instance-conf.json');
    expect(files.get('cyberia-instance.json')).toMatchObject({ code: pkg.saga.code, conf: conf._id, portals: [] });
    expect(conf.instanceCode).toBe(pkg.saga.code);
    expect(documentsIn('cyberia-entity-type-defaults').map(({ _id }) => _id)).toEqual(conf.entityDefaults);
    expect(files.get(`cyberia-sagas/${pkg.saga.code}.json`).code).toBe(pkg.saga.code);
  });

  it('holds every map of the saga, and no render and no placement', () => {
    expect(documentsIn('maps').map(({ code }) => code)).toEqual(families.maps.map(({ code }) => code));
    for (const map of documentsIn('maps')) expect(map.entities).toEqual([]);
    for (const document of [...documentsIn('cyberia-quests'), ...documentsIn('cyberia-actions')])
      expect(document).toMatchObject({ sourceMapCode: null, sourceCellX: null, sourceCellY: null });
    for (const { data } of documentsIn('object-layers')) expect(data.render).toEqual({});
    expect([...files.keys()].filter((file) => /^(render-frames|atlas-sprite-sheets|files)\//.test(file))).toEqual([]);
  });

  it('holds every item it names, triggers or summons, and the lines of each item', () => {
    const itemIds = new Set(documentsIn('object-layers').map(({ data }) => data.item.id));
    const named = [
      ...documentsIn('cyberia-entity-type-defaults').flatMap((row) => [
        ...row.liveItemIds,
        ...row.deadItemIds,
        ...row.dropItemIds,
        ...row.inventoryItemsIds,
      ]),
      ...documentsIn('cyberia-actions').flatMap(({ shopItems, craftRecipes }) => [
        ...shopItems.flatMap(({ itemId, priceItemId }) => [itemId, priceItemId]),
        ...craftRecipes.flatMap(({ ingredients, outputItems }) =>
          [...ingredients, ...outputItems].map(({ itemId }) => itemId),
        ),
      ]),
      ...documentsIn('cyberia-quests').flatMap(({ steps, rewards }) => [
        ...steps.flatMap(({ objectives }) => objectives.map(({ itemId }) => itemId)),
        ...rewards.map(({ itemId }) => itemId),
      ]),
      ...documentsIn('cyberia-skills').flatMap(({ triggerItemId, skills }) => [
        triggerItemId,
        ...skills.map(({ summonedEntityItemId }) => summonedEntityItemId).filter((id) => id && !id.startsWith('$')),
      ]),
    ];
    for (const itemId of named) expect(itemIds.has(itemId), itemId).toBe(true);
    for (const itemId of itemIds) expect(files.has(`cyberia-dialogues/default-${itemId}.json`), itemId).toBe(true);
  });

  it('gives every document except an Object Layer item its own ObjectId', () => {
    const ids = [...files]
      .filter(([file]) => !file.startsWith('object-layers/'))
      .flatMap(([, document]) => [document].flat())
      .map(({ _id }) => _id);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes a canonical directory that replaces the previous one', () => {
    const directory = path.join(scratch, pkg.saga.code);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'stale.json'), '{}\n');
    writeInstanceBackup(directory, files);
    expect(filesUnder(directory)).toEqual([...files.keys()].sort());
    expect(formatFindings(directory)).toEqual([]);
  });
});
