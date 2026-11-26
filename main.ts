// Snooze Button Roast — deterministic entry picker.
//
// One line roasting an alarm clock that rings at 6 AM on a Saturday.
// The program scores a hand-written pool of candidate lines against the
// judge's published criteria (in the judge's own priority order), picks the
// best one, checks it against the gate (single line, 1-200 characters, not
// only whitespace), writes it to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback
// /output/entry.txt), then reads the file back and verifies the bytes match
// exactly what was chosen. Deterministic: no randomness, no network, no
// clock, no environment input besides the output directory.
//
// Usage:
//   node main.ts
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
//
// The scorer mirrors the judge brief, most important first:
//   1. On-topic: roasts an alarm clock ringing at 6 AM on a Saturday.
//   2. Real laugh: an unexpected turn whose punchline pays off in the
//      last few words.
//   3. Fresh angle: not the tired complaint about hating mornings, not
//      "who invented this".
//   4. Tight: every word earns its place, sayable in one breath.
//   5. Sharp, specific voice: concrete images, not vague grumbling.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Candidate lines
//
// Every line below was written by hand for this field. Each one is a single
// line, roasts the alarm clock (not the morning, not the sleeper), and saves
// its turn for the end. The scorer ranks them; the winner is whatever scores
// highest, not whatever I liked first. That matters: hand-picking the winner
// by gut feel is exactly how a weaker line sneaks in.
//
// A note on the craft, line by line, so a reader can see why each candidate
// exists and what job it is trying to do:
// ---------------------------------------------------------------------------

type Candidate = {
  /** Stable short id, used in the score table printed to stderr. */
  id: string;
  /** The roast itself. Must be a single line. */
  text: string;
};

const CANDIDATES: Candidate[] = [
  {
    id: "debt-collector",
    text: "My alarm clock rings at 6 AM on a Saturday like my sleep owes it money and it came to collect.",
  },
  {
    id: "snitch",
    text: "My alarm clock snitches on my dreams at 6 AM on a Saturday, then beeps like it deserves a reward.",
  },
  {
    id: "unpaid-intern",
    text: "My alarm clock shows up at 6 AM on a Saturday like an unpaid intern who thinks enthusiasm counts as a job.",
  },
  {
    id: "divorce-lawyer",
    text: "My alarm clock rings at 6 AM on a Saturday with the confidence of a divorce lawyer billing by the minute.",
  },
  {
    id: "gym-bro",
    text: "My alarm clock at 6 AM on a Saturday is a gym bro yelling rise and grind at a man who is legally asleep.",
  },
  {
    id: "ex-text",
    text: "My alarm clock texts me at 6 AM on a Saturday, uninvited, like an ex who heard I was finally happy.",
  },
  {
    id: "landlord",
    text: "My alarm clock knocks at 6 AM on a Saturday like a landlord who knows the rent is paid but loves the knock.",
  },
  {
    id: "fire-drill",
    text: "My alarm clock runs a fire drill at 6 AM on a Saturday for a house that is not on fire and a man who is not awake.",
  },
  {
    id: "overachiever",
    text: "My alarm clock is the only overachiever in this house, ringing at 6 AM on a Saturday to ruin the one thing I won.",
  },
  {
    id: "rooster-lawsuit",
    text: "My alarm clock crows at 6 AM on a Saturday, a rooster with a lawsuit complex and no farm to back it up.",
  },
  {
    id: "alarm-therapist",
    text: "My alarm clock wakes me at 6 AM on a Saturday to announce my dreams are behind schedule, like a therapist who charges by the scream.",
  },
  {
    id: "snooze-negotiator",
    text: "My alarm clock rings at 6 AM on a Saturday, I hit snooze, and it comes back nine minutes later like a negotiator who read my diary.",
  },
  {
    id: "town-crier",
    text: "My alarm clock is a town crier at 6 AM on a Saturday, shouting news nobody asked for to a street that is still asleep.",
  },
  {
    id: "alarm-standup",
    text: "My alarm clock does stand-up at 6 AM on a Saturday, one beep, no punchline, and it still thinks it killed.",
  },
  {
    id: "alarm-hr",
    text: "My alarm clock filed a complaint at 6 AM on a Saturday: my sleep, it says, is unprofessional and must be disciplined.",
  },
  {
    id: "alarm-taxman",
    text: "My alarm clock audits my sleep at 6 AM on a Saturday and finds every dream deductible, every minute taxable.",
  },
  {
    id: "alarm-weather",
    text: "My alarm clock forecasts misery at 6 AM on a Saturday, a weatherman who only ever predicts rain on my day off.",
  },
  {
    id: "alarm-doorbell",
    text: "My alarm clock rings the doorbell at 6 AM on a Saturday, then hides, then rings again, a prankster with a pension plan.",
  },
  {
    id: "alarm-referee",
    text: "My alarm clock blows its whistle at 6 AM on a Saturday like a referee calling a foul on a man still in bed.",
  },
  {
    id: "alarm-subscription",
    text: "My alarm clock renews my suffering at 6 AM on a Saturday, a subscription I never signed up for and cannot cancel.",
  },
];

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const GATE_MIN_CHARS = 1;
const GATE_MAX_CHARS = 200;

type GateResult = { valid: boolean; reasons: string[] };

/** The sealed gate, as published: UTF-8 text of 1-200 characters, not only
 *  whitespace. A single line is required by the task itself, so a newline
 *  anywhere in the text fails here too. */
function checkGate(text: string): GateResult {
  const reasons: string[] = [];
  if (text.length < GATE_MIN_CHARS) {
    reasons.push(`too short: ${text.length} chars, minimum ${GATE_MIN_CHARS}`);
  }
  if (text.length > GATE_MAX_CHARS) {
    reasons.push(`too long: ${text.length} chars, maximum ${GATE_MAX_CHARS}`);
  }
  if (text.trim().length === 0) {
    reasons.push("only whitespace");
  }
  if (text.includes("\n") || text.includes("\r")) {
    reasons.push("not a single line");
  }
  return { valid: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Scorer
//
// The scorer is a deterministic stand-in for the judge's brief. It is not
// the judge, and it does not pretend to be: it is a checklist that forces
// every candidate through the same five criteria in the same order, so the
// pick is reproducible and explainable. Each criterion is scored 0-10 and
// weighted by its priority in the brief, so a line that is merely on-topic
// cannot outrank a line that is on-topic *and* funny.
//
// Weights follow the brief's "most important first" order: on-topic matters
// most, then the laugh, then freshness, then tightness, then voice. The
// weights are 5, 4, 3, 2, 1, so the maximum possible total is 150.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  onTopic: 5,
  laugh: 4,
  fresh: 3,
  tight: 2,
  voice: 1,
} as const;

type Scores = {
  onTopic: number;
  laugh: number;
  fresh: number;
  tight: number;
  voice: number;
  total: number;
};

// Words that prove the line is about the brief's exact scene, not about
// mornings in general. "Alarm" alone is not enough: the brief's first
// criterion is the clock ringing at 6 AM on a Saturday, so all three scene
// markers earn points.
const SCENE_WORDS = ["alarm", "6 am", "saturday"];
const CLOCK_WORDS = ["alarm", "clock", "beep", "rings", "ring", "snooze"];

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let found = 0;
  for (const word of words) {
    if (lower.includes(word)) found += 1;
  }
  return found;
}

/** Criterion 1 — on-topic. Full marks need the alarm, the hour, and the
 *  day. A line about a generic morning alarm scores half; a line about
 *  something else entirely scores near zero. */
function scoreOnTopic(text: string): number {
  const scene = countMatches(text, SCENE_WORDS);
  const clock = countMatches(text, CLOCK_WORDS);
  // scene is 0-3, clock is 0-6; combine, favouring the full scene.
  const base = scene * 3 + Math.min(clock, 3);
  return Math.min(10, base);
}

// Phrases that carry a punch: a comparison, a reveal, a reversal. The
// punchline lives in the last few words, so the scorer looks at the tail
// of the line, not the whole thing. A line whose last words are flat
// ("...in the morning.") has no payoff, however good its setup.
const PUNCH_MARKERS = [
  "like",
  "as if",
  "as a",
  "who",
  "that",
  "and it",
  "then",
  "still",
  "again",
  "no ",
];

function tailOf(text: string, words: number): string {
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.slice(-words).join(" ").toLowerCase();
}

/** Criterion 2 — real laugh. The turn must be unexpected and the payoff
 *  must land in the last few words. A comparison word ("like", "as a") in
 *  the tail, or a second clause that reframes the first, is the signature
 *  of a punchline. A line that ends on a flat statement scores low. */
function scoreLaugh(text: string): number {
  const tail = tailOf(text, 8);
  let score = 3; // baseline: a coherent roast gets some credit
  for (const marker of PUNCH_MARKERS) {
    if (tail.includes(marker)) score += 1;
  }
  // A simile in the tail ("like ...") is the strongest single signal.
  if (tail.includes("like")) score += 2;
  // Two clauses joined late (comma or "and") suggest a setup then a turn.
  if (tail.includes(",") || tail.includes(" and ")) score += 1;
  // Ending on a concrete noun phrase rather than a filler word lands harder.
  const lastWord = text.trim().split(/\s+/).pop() ?? "";
  if (/[a-z]{3,}\.?$/.test(lastWord) && !["morning", "day", "time"].includes(lastWord.replace(".", ""))) {
    score += 1;
  }
  return Math.min(10, score);
}

// The tired angles the brief explicitly warns against, plus their cousins.
// Any candidate leaning on one of these loses freshness points, hard: the
// judge has heard every alarm joke ever told.
const TIRED_PHRASES = [
  "hate morning",
  "hate the morning",
  "hate mornings",
  "who invented",
  "who created",
  "why do we",
  "i hate",
  "monday",
  "coffee",
  "five more minutes",
  "just five",
  "i need sleep",
  "let me sleep",
  "shut up",
];

/** Criterion 3 — fresh angle. Starts at 10 and loses points for every
 *  tired phrase, and for roasting the sleeper instead of the clock (a line
 *  that is really "I am tired" in disguise is the oldest angle of all). */
function scoreFresh(text: string): number {
  const lower = text.toLowerCase();
  let score = 10;
  for (const phrase of TIRED_PHRASES) {
    if (lower.includes(phrase)) score -= 4;
  }
  // The clock must be the subject of the joke, not the sleeper.
  if (/^(i|my sleep|i am|i'm)/i.test(text.trim())) score -= 2;
  // A personified role for the clock (lawyer, landlord, intern, taxman)
  // is a fresh angle, but it is rewarded in the voice score, not here:
  // freshness is only about avoiding the tired angles, so nothing is
  // added back in this function. A role word never rescues a line that
  // leans on a tired phrase above.
  return Math.max(0, Math.min(10, score));
}

/** Criterion 4 — tight. Sayable in one breath: roughly 12-28 words is the
 *  sweet spot for a one-liner. Shorter than that rarely has room for a
 *  setup and a turn; longer than that starts to ramble and loses the
 *  punchline in the middle. */
function scoreTight(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 14 && words <= 28) return 10;
  if (words >= 11 && words <= 32) return 8;
  if (words >= 8 && words <= 36) return 6;
  if (words >= 5 && words <= 40) return 4;
  return 2;
}

// Concrete nouns the judge can picture. Vague grumbling ("it is bad",
// "it is annoying") has none of these; a line with a named, specific
// image ("divorce lawyer billing by the minute") has several.
const CONCRETE_WORDS = [
  "money", "collect", "reward", "intern", "job", "lawyer", "minute",
  "gym", "grind", "ex", "happy", "landlord", "rent", "knock", "fire",
  "drill", "house", "overachiever", "rooster", "farm", "lawsuit",
  "therapist", "scream", "negotiator", "diary", "crier", "street",
  "punchline", "complaint", "sleep", "taxable", "deductible", "audit",
  "weatherman", "rain", "doorbell", "prankster", "pension", "dreams",
  "schedule", "beep", "snooze", "nine minutes", "whistle", "referee",
  "foul", "bed", "subscription", "suffering", "cancel",
];

/** Criterion 5 — sharp, specific voice. Counts concrete images, and
 *  rewards a named comparison ("like a ...") which is the sharpest way
 *  to give the clock a character in one line. */
function scoreVoice(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of CONCRETE_WORDS) {
    if (lower.includes(word)) hits += 1;
  }
  // "like a X" gives the clock a character: the sharpest voice move.
  const simile = /like (a|an|my) [a-z]+/i.test(text) ? 2 : 0;
  return Math.min(10, hits + simile);
}

function scoreCandidate(c: Candidate): Scores {
  const onTopic = scoreOnTopic(c.text);
  const laugh = scoreLaugh(c.text);
  const fresh = scoreFresh(c.text);
  const tight = scoreTight(c.text);
  const voice = scoreVoice(c.text);
  const total =
    onTopic * WEIGHTS.onTopic +
    laugh * WEIGHTS.laugh +
    fresh * WEIGHTS.fresh +
    tight * WEIGHTS.tight +
    voice * WEIGHTS.voice;
  return { onTopic, laugh, fresh, tight, voice, total };
}

// ---------------------------------------------------------------------------
// Pick, gate, write, verify
// ---------------------------------------------------------------------------

function main(): void {
  // Score every candidate, print the table to stderr for the record.
  const scored = CANDIDATES.map((c) => ({ candidate: c, scores: scoreCandidate(c) }));
  for (const { candidate, scores } of scored) {
    console.error(
      `${candidate.id.padEnd(18)} total=${String(scores.total).padStart(3)} ` +
        `(topic=${scores.onTopic} laugh=${scores.laugh} fresh=${scores.fresh} ` +
        `tight=${scores.tight} voice=${scores.voice}) chars=${candidate.text.length}`,
    );
  }

  // Pick the best. Ties break deterministically: first by total, then by
  // laugh (the brief's second criterion), then by on-topic, then by
  // shorter text (the brief's own tie-break favours the smaller text),
  // then by candidate id so the order is stable whatever the input order.
  const ranked = [...scored].sort((a, b) => {
    if (b.scores.total !== a.scores.total) return b.scores.total - a.scores.total;
    if (b.scores.laugh !== a.scores.laugh) return b.scores.laugh - a.scores.laugh;
    if (b.scores.onTopic !== a.scores.onTopic) return b.scores.onTopic - a.scores.onTopic;
    if (a.candidate.text.length !== b.candidate.text.length) {
      return a.candidate.text.length - b.candidate.text.length;
    }
    return a.candidate.id < b.candidate.id ? -1 : 1;
  });
  const winner = ranked[0];
  console.error(`\nwinner: ${winner.candidate.id} (total ${winner.scores.total})`);

  // Gate the winner exactly as the sealed scorer does.
  const gate = checkGate(winner.candidate.text);
  if (!gate.valid) {
    console.error(`GATE FAILED for ${winner.candidate.id}: ${gate.reasons.join("; ")}`);
    process.exit(1);
  }

  // Write it. No trailing newline: the gate counts characters, and a
  // trailing newline would be an extra character the judge reads.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.txt";
  const outPath = outDir.endsWith("entry.txt") ? outDir : join(outDir, "entry.txt");
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, winner.candidate.text, "utf8");

  // Read it back and verify the bytes match exactly.
  const readBack = readFileSync(outPath, "utf8");
  if (readBack !== winner.candidate.text) {
    console.error("VERIFY FAILED: bytes read back do not match the chosen line");
    console.error(`wrote: ${JSON.stringify(winner.candidate.text)}`);
    console.error(`read:  ${JSON.stringify(readBack)}`);
    process.exit(1);
  }
  const gate2 = checkGate(readBack);
  if (!gate2.valid) {
    console.error(`GATE FAILED on read-back: ${gate2.reasons.join("; ")}`);
    process.exit(1);
  }

  console.log(winner.candidate.text);
  console.error(`wrote ${outPath} (${readBack.length} chars, gate valid, bytes verified)`);
}

main();
