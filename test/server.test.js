const test = require('node:test');
const assert = require('node:assert/strict');
const { server, validRanking } = require('../server');

test('valida contrato correto de ranking', () => {
  assert.equal(validRanking({ period:'Agosto/2026', regions:[{name:'Sul',salesAmount:10}], sellers:[] }), true);
});

test('rejeita contrato incompleto', () => {
  assert.equal(validRanking({ period:'x', regions:[] }), false);
});

test('endpoint de saúde responde', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  await new Promise(resolve => server.close(resolve));
});
