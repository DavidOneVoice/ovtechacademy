import assert from 'node:assert/strict';
export function memoryFirestore(initial = {}) {
  const docs = new Map(Object.entries(initial));
  let queue = Promise.resolve();
  const snapshot = (ref) => ({ id: ref.id, ref, exists: docs.has(ref.path), data: () => docs.get(ref.path) });
  const list = (path, filter) => [...docs.keys()].filter((key) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1).map((path) => snapshot(ref(path))).filter((snap) => !filter || filter(snap.data()));
  const applyValue = (previous, value) => {
    if (value?.constructor?.name === 'NumericIncrementTransform') return (previous || 0) + value.operand;
    if (value?.constructor?.name === 'ArrayUnionTransform') return [...new Set([...(previous || []), ...value.elements])];
    if (value?.constructor?.name === 'DeleteTransform') return undefined;
    return value;
  };
  function update(path, fields) {
    assert.ok(docs.has(path), 'Update must target an existing document');
    const value = structuredClone(docs.get(path));
    if (fields.length === 1) {
      for (const [key, field] of Object.entries(fields[0])) { const next = applyValue(value[key], field); if (next === undefined) delete value[key]; else value[key] = next; }
    } else for (let i = 0; i < fields.length; i += 2) {
      const key = typeof fields[i] === 'string' ? fields[i].split('.') : fields[i].segments;
      let cursor = value;
      for (const part of key.slice(0, -1)) cursor = cursor[part] ||= {};
      cursor[key.at(-1)] = applyValue(cursor[key.at(-1)], fields[i + 1]);
    }
    docs.set(path, value);
  }
  const ref = (path) => ({ path, id: path.split('/').at(-1), collection: (name) => collection(`${path}/${name}`), get: async () => snapshot(ref(path)), create: async (value) => { assert.ok(!docs.has(path)); docs.set(path, value); }, update: async (...fields) => update(path, fields), delete: async () => docs.delete(path) });
  const collection = (path) => ({ doc: (id) => ref(`${path}/${id}`), get: async () => ({ docs: list(path) }), where: (key, operator, value) => ({ get: async () => ({ docs: list(path, (data) => { assert.equal(operator, '=='); return data[key] === value; }) }) }) });
  const db = { collection, runTransaction: (fn) => {
    const run = async () => {
      const writes = [];
      const tx = { get: async (ref) => snapshot(ref), set: (ref, value) => writes.push(() => docs.set(ref.path, value)), create: (ref, value) => { assert.ok(!docs.has(ref.path)); writes.push(() => docs.set(ref.path, value)); }, update: (ref, ...fields) => writes.push(() => update(ref.path, fields)) };
      const result = await fn(tx); writes.forEach((write) => write()); return result;
    };
    const operation = queue.then(run); queue = operation.catch(() => {}); return operation;
  } };
  return { db, docs };
}
