import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureChanceTone } from '../../frontend/src/lib/capture-chance.js';

test('cores da chance de captura respeitam as cinco faixas exibidas', () => {
  assert.equal(captureChanceTone(0), 'low');
  assert.equal(captureChanceTone(24.99), 'low');
  assert.equal(captureChanceTone(25), 'medium');
  assert.equal(captureChanceTone(49.99), 'medium');
  assert.equal(captureChanceTone(50), 'high');
  assert.equal(captureChanceTone(98.99), 'high');
  assert.equal(captureChanceTone(99), 'near');
  assert.equal(captureChanceTone(99.99), 'near');
  assert.equal(captureChanceTone(100), 'guaranteed');
});
