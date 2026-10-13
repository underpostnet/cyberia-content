/**
 * The instance backup of a saga: its runtime documents in the layout of an engine instance export,
 * so `cyberia instance <saga-code> --import` restores it. It holds no render and no placement:
 * Object Layer items carry an empty render, maps no entities, and quests and actions no source.
 * Studio authors those, and the engine export then rewrites the backup.
 *
 * @module src/saga-instance.js
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compileFoundation, compileSaga } from './compiler.js';
import { canonicalJson } from './validation/format.js';

/** A MongoDB ObjectId: the same key always gives the same id. */
const objectId = (...key) => createHash('sha256').update(key.join('\n')).digest('hex').slice(0, 24);

/** An empty id is a summon the runtime resolves and a `$` id a runtime placeholder: neither is an Object Layer item. */
const isItemId = (id) => Boolean(id) && !id.startsWith('$');

/**
 * The item ids an instance names: what its entity-type defaults wire, what its actions trade, and
 * what its quests ask for or pay out. The engine export selects by the same rule.
 */
function namedItemIds({ entityTypeDefaults, actions, quests }) {
  const ids = new Set();
  for (const row of entityTypeDefaults)
    for (const list of ['liveItemIds', 'deadItemIds', 'dropItemIds', 'inventoryItemsIds'])
      for (const id of row[list]) ids.add(id);
  for (const { shopItems, craftRecipes } of actions) {
    for (const { itemId, priceItemId } of shopItems) ids.add(itemId).add(priceItemId);
    for (const { ingredients, outputItems } of craftRecipes)
      for (const { itemId } of [...ingredients, ...outputItems]) ids.add(itemId);
  }
  for (const { steps, rewards } of quests) {
    for (const { objectives } of steps) for (const { itemId } of objectives) ids.add(itemId);
    for (const { itemId } of rewards) ids.add(itemId);
  }
  return new Set([...ids].filter(isItemId));
}

/**
 * The instance backup of a saga. The instance has the saga code. Every document except an Object
 * Layer item has an `_id` from the saga code and its natural key, so the same saga always gives
 * the same bytes. The instance runs the skills its items trigger, and holds every item it names
 * or summons, from the saga or the foundation.
 * @param {Object} pkg - A saga package the validator accepts.
 * @param {Object} registry - Foundation registry.
 * @returns {Map<string,Object>} Documents by file, relative to the instance directory.
 * @throws {Error} When the instance names an item neither the saga nor the foundation holds.
 */
export function sagaInstanceBackup(pkg, registry) {
  const { saga, instance, families } = compileSaga(pkg, registry);
  const foundation = compileFoundation(registry).families;
  const { code } = saga;
  const idOf = (...key) => objectId(code, ...key);
  const files = new Map();

  // The first row of a natural key wins, as in an engine import.
  const entityTypeDefaults = new Map();
  for (const row of families.entityTypeDefaults) {
    const _id = idOf('entity-type-default', row.entityType, row.liveItemIds.join(','));
    if (!entityTypeDefaults.has(_id)) entityTypeDefaults.set(_id, { _id, ...row });
  }
  const conf = {
    _id: idOf('cyberia-instance-conf'),
    instanceCode: code,
    entityDefaults: [...entityTypeDefaults.keys()],
  };
  files.set('cyberia-instance.json', { _id: idOf('cyberia-instance'), ...instance, conf: conf._id });
  files.set('cyberia-instance-conf.json', conf);
  files.set(`cyberia-sagas/${code}.json`, { _id: idOf('cyberia-saga'), ...saga });
  for (const row of entityTypeDefaults.values()) files.set(`cyberia-entity-type-defaults/${row._id}.json`, row);
  for (const map of families.maps)
    files.set(`maps/${map.code}.json`, { _id: idOf('map', map.code), ...map, entities: [] });
  for (const quest of families.quests)
    files.set(`cyberia-quests/${quest.code}.json`, { _id: idOf('quest', quest.code), ...quest });
  for (const action of families.actions)
    files.set(`cyberia-actions/${action.code}.json`, { _id: idOf('action', action.code), ...action });

  const itemIds = namedItemIds(families);
  const skills = [...families.skills, ...foundation.skills].filter(({ triggerItemId }) => itemIds.has(triggerItemId));
  for (const skill of skills) {
    files.set(`cyberia-skills/${skill.triggerItemId}.json`, { _id: idOf('skill', skill.triggerItemId), ...skill });
    for (const { summonedEntityItemId } of skill.skills)
      if (isItemId(summonedEntityItemId)) itemIds.add(summonedEntityItemId);
  }

  const items = new Map([...foundation.objectLayers, ...families.objectLayers].map((item) => [item.itemId, item]));
  for (const itemId of [...itemIds].sort()) {
    const item = items.get(itemId);
    if (!item) throw new Error(`Saga ${code} names item ${itemId}, which neither the saga nor the foundation holds`);
    files.set(`object-layers/${itemId}.json`, { data: { ...item.payload.data, render: {} } });
  }

  const lines = new Map([
    ...Map.groupBy(foundation.dialogues, (line) => line.code),
    ...Map.groupBy(families.dialogues, (line) => line.code),
  ]);
  const dialogueCodes = [
    ...[...itemIds].map((itemId) => `default-${itemId}`),
    ...families.actions.flatMap(({ dialogCode, questDialogueCodes }) => [
      dialogCode,
      ...questDialogueCodes.map((entry) => entry.dialogCode),
    ]),
  ];
  for (const dialogueCode of new Set(dialogueCodes))
    if (lines.has(dialogueCode))
      files.set(
        `cyberia-dialogues/${dialogueCode}.json`,
        lines.get(dialogueCode).map((line) => ({ _id: idOf('dialogue', line.code, line.order), ...line })),
      );
  return files;
}

/**
 * Writes an instance backup to its directory. A previous directory is replaced whole.
 * @param {string} directory - Instance directory.
 * @param {Map<string,Object>} files - {@link sagaInstanceBackup} output.
 */
export function writeInstanceBackup(directory, files) {
  fs.rmSync(directory, { recursive: true, force: true });
  for (const [file, value] of files) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), canonicalJson(value));
  }
}
