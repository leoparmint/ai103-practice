#!/usr/bin/env python3
"""Check the FSRS scheduler in korean/index.html against py-fsrs.

Runs the page's own scheduler code in Node (fuzz off), simulates random review histories, then replays the same
grades at the same times through py-fsrs and compares state, step, stability, difficulty and interval after every
grade. Also checks the fuzz range and the SM-2 conversion.

    pip install fsrs       # py-fsrs 6.x
    python3 korean/tools/test_fsrs.py
"""
import json
import math
import os
import subprocess
import sys
import tempfile
from copy import copy
from datetime import datetime, timedelta, timezone

from fsrs import Card, Rating, Scheduler, State

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'index.html')

src = open(PAGE, encoding='utf-8').read()
start = src.index('/* ---------- Scheduler')
end = src.index('/* ---------- Deck data')
SCHED = src[start:end]

HARNESS = r'''
const MODE = process.argv[2], RET = +process.argv[3];
var S = {set: {retention: RET}, cards: {}, day: {n: -1}, bury: {n: -1, notes: {}}};
%s
const realFuzz = fuzz;
if (MODE === 'sim') {
  fuzz = ivl => ivl;
  // deterministic PRNG
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) %% 2147483648; return seed / 2147483648; };
  const pickG = () => { const x = rnd(); return x < .15 ? 1 : x < .3 ? 2 : x < .85 ? 3 : 4; };
  const DAY0 = Date.UTC(2026, 0, 5);
  const out = [];
  for (let k = 0; k < 400; k++) {
    const c = {id: 'card' + k};
    S.cards = {};
    let day = 0, session = 0, t = DAY0 + 5 * 3600e3, trace = [];
    for (let r = 0; r < 25; r++) {
      const o = S.cards[c.id];
      const g = pickG();
      const n = schedule(c, g, t);
      S.cards[c.id] = n;
      trace.push({t, g, s: n.s, step: n.step === undefined ? null : n.step, stab: n.stab, diff: n.diff, ivl: n.ivl, due: n.due});
      if (n.s === 1 || n.s === 3) {
        t = n.due;                                   // next learning step, same session
        if (t - (DAY0 + day * 864e5 + (5 + session) * 3600e3) > 55 * 60e3) break;   // keep each session inside its hour
      } else {
        session++;
        const wait = 1 + Math.floor(rnd() * (n.ivl + 3));   // early, on time or late
        day = dayNum(t) - dayNum(DAY0) + wait;
        if (session > 15) break;
        t = DAY0 + day * 864e5 + (5 + session) * 3600e3;
      }
    }
    out.push(trace);
  }
  console.log(JSON.stringify(out));
} else if (MODE === 'fuzz') {
  const res = {};
  for (const ivl of [1, 2, 3, 4, 5, 7, 10, 15, 20, 30, 60, 100, 365, 1000]) {
    const seen = new Set();
    for (let i = 0; i < 4000; i++) seen.add(realFuzz(ivl, 'c' + i, i));
    res[ivl] = [Math.min(...seen), Math.max(...seen), seen.size];
  }
  console.log(JSON.stringify(res));
} else if (MODE === 'sm2') {
  fuzz = ivl => ivl;
  const res = [];
  const DAY0 = Date.UTC(2026, 0, 5) + 5 * 3600e3;
  for (const ivl of [1, 3, 8, 21, 60, 200]) for (const ease of [1.3, 1.8, 2.5, 3.0]) {
    S.cards = {x: {s: 2, ivl, ease, due: dayNum(DAY0), last: DAY0 - ivl * 864e5, reps: 5}};
    const m = memOf(S.cards.x);
    const n = schedule({id: 'x'}, 3, DAY0);
    res.push({ivl, ease, st: m.st, d: m.d, next: n.stab});
  }
  console.log(JSON.stringify(res));
}
''' % SCHED

def node(mode, ret=0.9):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(HARNESS)
        path = f.name
    try:
        r = subprocess.run(['node', path, mode, str(ret)], capture_output=True, text=True, env={**os.environ, 'TZ': 'UTC'})
        if r.returncode:
            sys.exit(r.stderr)
        return json.loads(r.stdout)
    finally:
        os.unlink(path)

fails = 0
def check(cond, msg):
    global fails
    if not cond:
        fails += 1
        if fails <= 20:
            print('FAIL', msg)

def close(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(b))

ST = {State.Learning: 1, State.Review: 2, State.Relearning: 3}

def ordered_review_interval(sch, card, g, when):
    """py-fsrs interval for a Review-state card, with Anki's Hard < Good < Easy rule applied."""
    ivs = {}
    for gg in (2, 3, 4):
        c2, _ = sch.review_card(copy(card), Rating(gg), when)
        ivs[gg] = round((c2.due - when) / timedelta(days=1))
    hard = min(ivs[2], ivs[3]); good = max(ivs[3], hard + 1); easy = max(ivs[4], good + 1)
    return min({2: hard, 3: good, 4: easy}[g], sch.maximum_interval)

total = 0
for ret in (0.9, 0.85, 0.95):
    traces = node('sim', ret)
    sch = Scheduler(desired_retention=ret, enable_fuzzing=False)
    for k, trace in enumerate(traces):
        card = Card(card_id=k + 1)
        for i, step in enumerate(trace):
            when = datetime.fromtimestamp(step['t'] / 1000, tz=timezone.utc)
            g = step['g']
            was_review = card.state == State.Review
            expect_ivl = ordered_review_interval(sch, card, g, when) if was_review and g > 1 else None
            card, _ = sch.review_card(card, Rating(g), when)
            total += 1
            tag = f'ret {ret} card {k} review {i} g{g}'
            check(ST[card.state] == step['s'], f'{tag}: state {card.state} vs {step["s"]}')
            check((card.step if card.state != State.Review else None) == step['step'], f'{tag}: step {card.step} vs {step["step"]}')
            check(close(card.stability, step['stab']), f'{tag}: S {card.stability} vs {step["stab"]}')
            check(close(card.difficulty, step['diff']), f'{tag}: D {card.difficulty} vs {step["diff"]}')
            if card.state == State.Review:
                py_ivl = expect_ivl if expect_ivl is not None else round((card.due - when) / timedelta(days=1))
                check(py_ivl == step['ivl'], f'{tag}: interval {py_ivl} vs {step["ivl"]}')
                card.due = when + timedelta(days=step['ivl'])
            else:
                mins = (card.due - when) / timedelta(minutes=1)
                check(close(mins, (step['due'] - step['t']) / 60000), f'{tag}: step minutes {mins} vs {(step["due"] - step["t"]) / 60000}')
print(f'{total} graded reviews compared with py-fsrs')

# Fuzz: same range as py-fsrs, and every value in it reachable
sch = Scheduler()
for ivl, (lo, hi, n) in node('fuzz').items():
    ivl = int(ivl)
    if ivl < 2.5:
        check(lo == hi == ivl, f'fuzz {ivl}: should be unfuzzed, got {lo}..{hi}')
        continue
    delta = 1.0
    for a, b, f in ((2.5, 7.0, .15), (7.0, 20.0, .1), (20.0, math.inf, .05)):
        delta += f * max(min(float(ivl), b) - a, 0.0)
    plo, phi = max(2, round(ivl - delta)), min(round(ivl + delta), sch.maximum_interval)
    plo = min(plo, phi)
    check((lo, hi) == (plo, phi) and n == phi - plo + 1, f'fuzz {ivl}: {lo}..{hi} ({n} values) vs py {plo}..{phi}')
print('fuzz ranges match py-fsrs')

# SM-2 conversion: an on-time Good review grows stability by the old ease (unless difficulty hit its 1–10 clamp)
for r in node('sm2'):
    raw = 11 - (r['ease'] - 1) / (math.exp(sch.parameters[8]) * r['st'] ** -sch.parameters[9] * (math.exp(0.1 * sch.parameters[10]) - 1))
    check(close(r['st'], r['ivl']), f'sm2 {r}: stability should equal interval')
    if 1 <= raw <= 10:
        check(close(r['next'] / r['st'], r['ease'], 1e-6), f'sm2 {r}: growth {r["next"] / r["st"]} vs ease {r["ease"]}')
print('SM-2 conversion checked')

if fails:
    sys.exit(f'{fails} check(s) failed')
print('All checks passed')
