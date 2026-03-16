const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFramePayload,
  flipFrame,
  listAvailableAnimations,
  resolveColorName,
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
  assert.equal(resolveFrameIntervalMs('lock'), 100);
  assert.equal(resolveFrameIntervalMs('lock-full'), 2000);
  assert.equal(resolveFrameIntervalMs('duck'), 70);
  assert.equal(resolveFrameIntervalMs('default'), 70);
});

test('resolveColorName allows calm rendering for lock while keeping defaults random', () => {
  assert.equal(resolveColorName('lock'), 'green');
  assert.equal(resolveColorName('lock-full'), 'green');
  assert.equal(resolveColorName('duck'), null);
  assert.equal(resolveColorName('default'), null);
});

test('buildFramePayload clears the screen only when requested', () => {
  const initialPayload = buildFramePayload({
    clearScreen: true,
    colorName: 'green',
    frame: 'hello\n'
  });
  const nextPayload = buildFramePayload({
    clearScreen: false,
    colorName: 'green',
    frame: 'hello\n'
  });

  assert.match(initialPayload, /\u001b\[2J\u001b\[3J\u001b\[H/);
  assert.doesNotMatch(nextPayload, /\u001b\[2J/);
  assert.match(nextPayload, /\u001b\[H/);
});
