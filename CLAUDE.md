# Working rules for this repository

This plugin is small and its behavior is hard to observe: most of what it does happens inside a
running Paseo daemon, not inside a test process. That gap is what these rules protect against.

## The contract that every change must keep

**The parent is woken on every question and every finished turn of its children.** Not only the
first one — that is the whole reason this plugin exists, and Paseo's built-in `notifyOnFinish`
already covers the first one. A change that trades this away is not an optimization, it is a
different plugin.

A change may alter how a wake looks, where it lands, or whether it leaves a trace. It may not
alter whether it arrives.

## Three rules, because a version number is a claim

**1. Bump the version only when a fix has been shown to change a number.**
Not when the mechanism looks right, not when the reasoning is sound, not when the diff is
obviously correct. Intent is not evidence. If you cannot state the measurement — what you counted,
before and after — the version does not move.

**2. The README holds measured facts only.**
Anything not yet measured is either left out or carries a word that marks it as unverified
("expected", "hypothesis", "not yet measured"). A reader cannot tell the difference between a
fact and a confident guess unless you tell them, and the next person to trust a wrong sentence
here will be debugging the daemon, not the README.

**3. A change that does not move the symptom is not a release.**
It is a branch to abandon. Shipping it renames the problem instead of fixing it, and burns the
version number that the real fix will need.

## How to measure this plugin

A unit test in `server/lib.test.ts` can reach the pure helpers and the shape of the call this
plugin makes. It cannot reach the daemon. Anything about what the daemon *does* with the call —
timeline rows, the jump list, steering — has to be measured against a running daemon.

The procedure that produces the numbers is in `README.md` under "Measuring a change". Use it, and
paste real output. Two details that have already cost time:

- **`paseo plugin ls` shows the commit from `sources.json`, not the code the daemon loaded.** It
  will happily print a stale commit while a different version is running. To know what is
  actually loaded, read the plugin reload event in `~/.paseo/daemon.log` and the file on disk.
- **The checkout directory is reused across versions.** Its mtime tells you nothing about which
  version is installed; the contents are swapped in place.
