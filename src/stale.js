// Stale stacks (ARCHITECTURE §31): a conflicting PR that drags another PR's
// commits — its parent was force-pushed under it, or squash-merged and the PR
// retargeted on main. The conflict and the huge diff are noise: nothing to
// review until the author rebases.
//
// `signal` (github.js#getStaleSignals): { commits: [{ oid, prs: [{ number,
// state }] }], parentForcePushed: [oid] } — `commits` = the PR's own commit
// list (base..head), `prs` = the PRs associated with each commit,
// `parentForcePushed` = the old heads of the open PR whose head is this PR's
// base branch. No signal (fetch failed) → never stale: on doubt, show the row.
export function isStaleStack(number, signal) {
  if (!signal) return false;
  const oldHeads = new Set(signal.parentForcePushed ?? []);
  return (signal.commits ?? []).some((c) =>
    oldHeads.has(c.oid) // an old head of the force-pushed parent is still in the PR
    // a commit of a merged PR that is NOT in the base: the parent was squashed
    || (c.prs ?? []).some((p) => p.number !== number && p.state === 'MERGED'));
}
