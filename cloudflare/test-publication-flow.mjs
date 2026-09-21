import assert from 'node:assert/strict';
import workerModule from './worker.js';

const worker = workerModule.default ?? workerModule;
const calls = [];

const env = {
  DB: {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              calls.push({ sql, args });
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            }
          };
        },
        async all() {
          return { results: [] };
        }
      };
    }
  }
};

const request = new Request('https://example.com/compositions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    heroes: ['Airi', 'Feng', 'Mina', 'Luo', 'Yin'],
    description: 'Composición equilibrada para control y empuje.',
    notes: 'Muy buena en rotaciones y acoso.'
  })
});

const response = await worker.fetch(request, env);
const payload = await response.json();

assert.equal(response.status, 201, 'La composición válida debería publicarse con 201');
assert.equal(payload.status, 'approved', 'La composición válida debe publicarse aprobada automáticamente');
assert.ok(
  calls.some((call) => call.sql.includes('INSERT INTO compositions') && call.sql.includes("'approved'")),
  'El insert debe guardar la composición con status approved'
);

console.log('PASS: publication flow auto-approves valid compositions');
