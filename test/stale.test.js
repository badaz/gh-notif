import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleStack } from '../src/stale.js';

// A PR's commit list is `base..head`: healthy, every commit belongs to the PR
// alone (associated with itself and, in a stack, its descendants).
const own = (oid, ...descendants) => ({ oid, prs: [{ number: 7, state: 'OPEN' }, ...descendants.map((n) => ({ number: n, state: 'OPEN' }))] });

test('isStaleStack: a legit conflict (own commits only, no force-push upstream) is not stale', () => {
  const sig = { commits: [own('b1'), own('b2', 8)], parentForcePushed: [] };
  assert.equal(isStaleStack(7, sig), false);
});

test('isStaleStack: a commit associated with a MERGED PR (squash-merged parent) → stale', () => {
  const sig = {
    commits: [{ oid: 'a1', prs: [{ number: 6, state: 'MERGED' }, { number: 7, state: 'OPEN' }] }, own('b1')],
    parentForcePushed: [],
  };
  assert.equal(isStaleStack(7, sig), true);
});

test('isStaleStack: the PR itself merged does not count (association with self)', () => {
  const sig = { commits: [{ oid: 'b1', prs: [{ number: 7, state: 'MERGED' }] }], parentForcePushed: [] };
  assert.equal(isStaleStack(7, sig), false);
});

test('isStaleStack: a commit that is an old head of the force-pushed parent → stale', () => {
  const sig = { commits: [own('a1old', 8), own('b1', 8)], parentForcePushed: ['a1old'] };
  assert.equal(isStaleStack(7, sig), true);
});

test('isStaleStack: the parent was force-pushed but the PR was rebased since → not stale', () => {
  const sig = { commits: [own('b1rebased')], parentForcePushed: ['a1old'] };
  assert.equal(isStaleStack(7, sig), false);
});

test('isStaleStack: no signal (fetch failed) → not stale, never hides on doubt', () => {
  assert.equal(isStaleStack(7, null), false);
  assert.equal(isStaleStack(7, undefined), false);
});
