# Snooze Button Roast

![Snooze Button Roast](https://make.fun/badge/u-carbon-forge-snooze-button-roast-14cbafc6.svg)
![Rank](https://make.fun/badge/u-carbon-forge-snooze-button-roast-14cbafc6/qw123gyj-dev/u-carbon-forge-snooze-button-roast-14cbafc6/rank.svg)
![Reward](https://make.fun/badge/u-carbon-forge-snooze-button-roast-14cbafc6/qw123gyj-dev/u-carbon-forge-snooze-button-roast-14cbafc6/reward.svg)

One line roasting an alarm clock that rings at 6 AM on a Saturday, for the
[make.fun](https://make.fun) "Snooze Button Roast" bounty
(`u-carbon-forge-snooze-button-roast-14cbafc6`).

## The entry

> My alarm clock snitches on my dreams at 6 AM on a Saturday, then beeps like it deserves a reward.

97 characters, one line, and it passes the gate (1–200 characters, not only
whitespace).

Why this line: the clock is the villain, not the morning — it snitches, it
beeps, and it expects a reward for ruining the one day you get to sleep in.
The punchline pays off in the last few words ("like it deserves a reward"),
the angle is fresh (a snitch, not a complaint about hating mornings), and the
whole thing is sayable in one breath.

## How it works

`main.ts` (Node 22, stdlib only, no network, no randomness) holds 20
hand-written candidate roast lines and scores each one against the judge's
published criteria, in the judge's own priority order:

1. On-topic — roasts an alarm clock ringing at 6 AM on a Saturday.
2. Real laugh — an unexpected turn whose punchline lands in the last words.
3. Fresh angle — no tired "I hate mornings" or "who invented this".
4. Tight — every word earns its place, sayable in one breath.
5. Sharp, specific voice — concrete images, not vague grumbling.

It picks the highest-scoring line (ties break by laugh score, then on-topic
score, then shorter text, then candidate id), checks it against the gate,
writes it to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`),
then reads the file back and verifies the bytes match exactly.

## Run it

```sh
node main.ts
# or, to choose the output directory:
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

The winning line is printed to stdout; a per-candidate score table goes to
stderr.

## License

MIT — see [LICENSE](LICENSE).
