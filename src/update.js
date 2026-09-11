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

// Tag of the latest GitHub release the install does not contain yet (null =
// up to date, or no release at all). Releases are tags on `main`: the highest
// tag by version whose commits are not all reachable from HEAD is a newer
// release — a plain push to `main` without a release never triggers the hint.
// `runner(args)` runs `git` with `args` and resolves with its stdout — injectable
// for the tests. Any git failure (offline, no remote…) reads as null: an update
// hint must never become an error banner.
export async function newerRelease(dir, runner = defaultRunner) {
  try {
    await runner(['-C', dir, 'fetch', '-q', '--tags']);
    const tag = (await runner(['-C', dir, 'tag', '--sort=-v:refname'])).split('\n')[0].trim();
    if (!tag) return null;
    const behind = Number.parseInt(await runner(['-C', dir, 'rev-list', '--count', `HEAD..${tag}`]), 10) || 0;
    return behind > 0 ? tag : null;
  } catch {
    return null;
  }
}

// The two commands to show; the second one assumes the documented systemd unit
// (README), a manual `gh notif` is simply relaunched.
export const UPGRADE_COMMANDS = ['gh extension upgrade notif', 'systemctl --user restart gh-notif'];
