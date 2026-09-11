import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extensionDir, isLocalInstall, newerRelease, UPGRADE_COMMANDS } from '../src/update.js';

test('extensionDir: directory of the entrypoint as invoked by gh (unresolved)', () => {
  assert.equal(extensionDir('/home/u/.local/share/gh/extensions/gh-notif/gh-notif'), '/home/u/.local/share/gh/extensions/gh-notif');
});

test('isLocalInstall: symlinked dir (gh extension install .) → local; real clone → not', () => {
  const root = mkdtempSync(join(tmpdir(), 'ghn-upd-'));
  try {
    mkdirSync(join(root, 'clone'));
    symlinkSync(join(root, 'clone'), join(root, 'link'));
    assert.equal(isLocalInstall(join(root, 'link')), true);
    assert.equal(isLocalInstall(join(root, 'clone')), false);
    assert.equal(isLocalInstall(join(root, 'missing')), true, 'unknown layout → treated as local (never nag)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Runner stub: `fetch` → '', `tag` → the tag list, `rev-list` → the count.
const gitStub = (tags, count, calls = []) => async (args) => {
  calls.push(args);
  return args[2] === 'fetch' ? '' : args[2] === 'tag' ? tags : count;
};

test('newerRelease: fetch tags, take the highest by version, count HEAD..tag → the tag when > 0', async () => {
  const calls = [];
  assert.equal(await newerRelease('/ext', gitStub('v1.2.0\nv1.1.0\n', '3\n', calls)), 'v1.2.0');
  assert.deepEqual(calls, [
    ['-C', '/ext', 'fetch', '-q', '--tags'],
    ['-C', '/ext', 'tag', '--sort=-v:refname'],
    ['-C', '/ext', 'rev-list', '--count', 'HEAD..v1.2.0'],
  ]);
});

test('newerRelease: latest tag already in HEAD → null (a push to main without a release never nags)', async () => {
  assert.equal(await newerRelease('/ext', gitStub('v1.2.0\n', '0\n')), null);
});

test('newerRelease: no tag at all → null, no rev-list call', async () => {
  const calls = [];
  assert.equal(await newerRelease('/ext', gitStub('', '5\n', calls)), null);
  assert.equal(calls.length, 2);
});

test('newerRelease: git failure (offline, no remote) → null, never throws', async () => {
  assert.equal(await newerRelease('/ext', async () => { throw new Error('fatal: no remote'); }), null);
  assert.equal(await newerRelease('/ext', gitStub('v1.0.0\n', 'garbage')), null);
});

test('UPGRADE_COMMANDS: the gh upgrade first, then the documented service restart', () => {
  assert.deepEqual(UPGRADE_COMMANDS, ['gh extension upgrade notif', 'systemctl --user restart gh-notif']);
});
