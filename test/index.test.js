const test = require('node:test');
const assert = require('node:assert/strict');

const {
  flipFrame,
  listAvailableAnimations,
  resolveFrameIntervalMs,
  resolveAnimationName,
  sortFrameFiles,
  validateQuery
} = require('../index');

test('sortFrameFiles sorts filenames numerically', () => {
  assert.deepEqual(sortFrameFiles(['10.txt', '2.txt', '1.txt']), [
    '1.txt',
    '2.txt',
    '10.txt'
  ]);
});

test('flipFrame mirrors each line without changing row order', () => {
  assert.equal(flipFrame('ab\ncd\n'), 'ba\ndc\n');
});

test('validateQuery parses flip flag case-insensitively', () => {
  assert.deepEqual(validateQuery(new URLSearchParams('flip=True')), { flip: true });
  assert.deepEqual(validateQuery(new URLSearchParams()), { flip: false });
});

test('resolveAnimationName keeps root on the default animation', () => {
  assert.equal(resolveAnimationName('/'), 'default');
  assert.equal(resolveAnimationName('/duck'), 'duck');
  assert.equal(resolveAnimationName('/duck/'), 'duck');
});

test('resolveAnimationName rejects nested and invalid animation paths', () => {
  assert.equal(resolveAnimationName('/duck/run'), null);
  assert.equal(resolveAnimationName('/../duck'), null);
  assert.equal(resolveAnimationName('/duck wings'), null);
});

test('listAvailableAnimations hides the default animation key', () => {
  const animations = new Map([
    ['default', {}],
    ['duck', {}],
    ['cat', {}]
  ]);

  assert.deepEqual(listAvailableAnimations(animations), ['cat', 'duck']);
});

test('resolveFrameIntervalMs keeps lock slower than the default animations', () => {
  assert.equal(resolveFrameIntervalMs('lock'), 140);
  assert.equal(resolveFrameIntervalMs('duck'), 70);
  assert.equal(resolveFrameIntervalMs('default'), 70);
});
