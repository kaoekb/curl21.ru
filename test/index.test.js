const test = require('node:test');
const assert = require('node:assert/strict');

const { flipFrame, sortFrameFiles, validateQuery } = require('../index');

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
