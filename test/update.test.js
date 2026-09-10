import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extensionDir, isLocalInstall, commitsBehind, UPGRADE_COMMANDS } from '../src/update.js';

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

test('commitsBehind: fetch then count HEAD..@{u}, stdout parsed as an integer', async () => {
  const calls = [];
  const runner = async (args) => { calls.push(args); return args[1] === 'fetch' ? '' : '3\n'; };
  assert.equal(await commitsBehind('/ext', runner), 3);
  assert.deepEqual(calls, [['-C', '/ext', 'fetch', '-q'], ['-C', '/ext', 'rev-list', '--count', 'HEAD..@{u}']]);
});

test('commitsBehind: up to date → 0; git failure (offline, no upstream) → 0, never throws', async () => {
  assert.equal(await commitsBehind('/ext', async () => '0\n'), 0);
  assert.equal(await commitsBehind('/ext', async () => { throw new Error('fatal: no upstream'); }), 0);
  assert.equal(await commitsBehind('/ext', async () => 'garbage'), 0);
});

test('UPGRADE_COMMANDS: the gh upgrade first, then the documented service restart', () => {
  assert.deepEqual(UPGRADE_COMMANDS, ['gh extension upgrade notif', 'systemctl --user restart gh-notif']);
});
