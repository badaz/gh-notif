// Update check (§32): tells the user a newer version of the extension is
// published, WITHOUT installing anything — upgrading (and restarting) stays
// their call. Zero GitHub API call: a plain `git fetch` on the clone that
// `gh extension install nikophil/gh-notif` made, then a commit count.
import { lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

// Directory of the installed extension = the directory of the entrypoint as
// invoked by `gh` (NOT resolved: for a `gh extension install .` dev install the
// path is the symlink under ~/.local/share/gh/extensions, cf. isLocalInstall).
export function extensionDir(argv1 = process.argv[1]) {
  return dirname(argv1);
}

// `gh extension install .` = symlink to the working copy: there is nothing to
// upgrade (and `gh` itself refuses: « local extensions can not be upgraded »).
export function isLocalInstall(dir) {
  try {
    return lstatSync(dir).isSymbolicLink();
  } catch {
    return true; // unknown layout → behave as local (never nag)
  }
}

const defaultRunner = async (args) => (await pexec('git', args)).stdout;

// Number of commits the install is behind its upstream (0 = up to date).
// `runner(args)` runs `git` with `args` and resolves with its stdout — injectable
// for the tests. Any git failure (offline, no upstream…) reads as 0: an update
// hint must never become an error banner.
export async function commitsBehind(dir, runner = defaultRunner) {
  try {
    await runner(['-C', dir, 'fetch', '-q']);
    return Number.parseInt(await runner(['-C', dir, 'rev-list', '--count', 'HEAD..@{u}']), 10) || 0;
  } catch {
    return 0;
  }
}

// The two commands to show; the second one assumes the documented systemd unit
// (README), a manual `gh notif` is simply relaunched.
export const UPGRADE_COMMANDS = ['gh extension upgrade notif', 'systemctl --user restart gh-notif'];
