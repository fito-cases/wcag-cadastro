import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);

test('projeto configurado para npm test', () => {
  const pacote = JSON.parse(readFileSync(new URL('package.json', raiz), 'utf8'));
  assert.equal(pacote.scripts?.test, 'node --test');
  assert.equal(pacote.engines?.node, '>=22');
  for (const arquivo of ['index.html', 'styles.css', 'app.js']) {
    assert.ok(existsSync(new URL(arquivo, raiz)), `o arquivo ${arquivo} não existe`);
  }
});
