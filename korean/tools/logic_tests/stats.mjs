// Tests for PURE:stats, the numbers behind the Progress screen.   node korean/tools/test_logic.mjs stats
//
// Every function has hand-worked cases, with the sums in the comments. model() further down is a second route
// to the same answers: it flattens the log into one list of reviews and answers each question by filtering that
// list. It is compared with STATS over seeded random histories laid on the real deck's card ids and note codes.

const DAY = 864e5;
const dayOf = ms => Math.floor(ms / DAY);
// The page's day rolls over at 4am
const dayOf4 = ms => Math.floor((ms - 4 * 36e5) / DAY);
// Unix seconds, s seconds into a day
const at = (day, s = 0) => day * 86400 + s;
const sum = l => l.reduce((a, b) => a + b, 0);
const ZERO = {n: 0, again: 0, hard: 0, good: 0, easy: 0, secs: 0};

// Three cards over days 100–104. Reviews per day: 100 → 5, 101 → 1, 102 → none, 103 → 2, 104 → 3
const LOG = {
  a: [[at(100, 10), 3, 0, 5], [at(100, 700), 3, 1, 4], [at(101, 50), 3, 2, 6], [at(104, 9), 1, 2, 12], [at(104, 700), 3, 3, 3]],
  b: [[at(100, 20), 1, 0, 8], [at(100, 90), 3, 1], [at(100, 800), 4, 1, 2], [at(103, 5), 2, 2, 7]],
  c: [[at(103, 60), 4, 0, 1], [at(104, 30), 3, 2, 2.5]],
};
// 90 is a day with a zero, 99 predates the log, 100 is smaller than the log, 101 larger, 104 equal
const HIST = {90: 0, 99: 4, 100: 3, 101: 6, 104: 3};
const DAILY = {99: 4, 100: 5, 101: 6, 103: 2, 104: 3};

// Seen from day 200
const CARDS = {
  n0: {s: 0},
  r0: {s: 2, due: 200, ivl: 3},
  rOver: {s: 2, due: 190, ivl: 30, lapses: 2},
  r1: {s: 2, due: 201, ivl: 1},
  r3: {s: 2, due: 203, ivl: 21},
  r3b: {s: 2, due: 203, ivl: 20},
  r6: {s: 2, due: 206, ivl: 40},
  r7: {s: 2, due: 207, ivl: 60},
  l0: {s: 1, due: 200 * DAY + 5000},
  lPast: {s: 3, due: 198 * DAY, lapses: 1},
  l1: {s: 3, due: 201 * DAY + 1, lapses: 3},
  sus: {s: 2, due: 201, ivl: 5, susp: true},
  susNew: {s: 0, susp: true},
  susL: {s: 3, due: 200 * DAY + 9, lapses: 5, susp: true},
};
const METAS = [
  {id: 'n0', cat: 'Vocabulary'}, {id: 'none', cat: 'Vocabulary'}, {id: 'r0', cat: 'Vocabulary'}, {id: 'rOver', cat: 'Vocabulary'}, {id: 'l0', cat: 'Vocabulary'}, {id: 'sus', cat: 'Vocabulary'},
  {id: 'r3', cat: 'Grammar'}, {id: 'r3b', cat: 'Grammar'}, {id: 'lPast', cat: 'Grammar'}, {id: 'l1', cat: 'Grammar'}, {id: 'susNew', cat: 'Grammar'}, {id: 'r6', cat: 'Grammar'},
  {id: 'r1', cat: 'Workbook'}, {id: 'susL', cat: 'Workbook'}, {id: 'r7', cat: 'Workbook'},
];

// Weak spots. Per card since 0: p again 2 of 4 reviews, q 1 of 2, r 1 of 3, s 0 of 1, u 0 of 1
const WLOG = {
  p: [[1000, 1, 2], [1100, 3, 3], [2000, 1, 2], [2100, 3, 3]],
  q: [[1500, 3, 2], [2500, 1, 2]],
  r: [[900, 1, 0], [950, 3, 1], [3000, 4, 2]],
  s: [[1200, 3, 0]],
  u: [[1300, 2, 2]],
  stray: [[1400, 1, 2]],   // no item lists this card, so it counts nowhere
};
const WCARDS = {p: {s: 2, lapses: 2}, q: {s: 3, lapses: 1}, r: {s: 2}, s: {s: 1, lapses: 0}, t: {s: 2, lapses: 4, susp: true}, stray: {s: 3, lapses: 9}};
const WITEMS = [
  {id: 'p', codes: ['G51']}, {id: 'q', codes: ['G51', 'G6']}, {id: 'r', codes: ['G6']}, {id: 's', codes: ['V3']},
  {id: 't', codes: ['V10']}, {id: 'u', codes: ['V2', 'V2']}, {id: 'nolog', codes: ['G7']}, {id: 'bare', codes: []},
];
const WMISS = ['r', 's', 'r', 'zz', 's'];
const row = (code, again, reviews, lapses, misses, score) => ({code, again, reviews, lapses, misses, score});

// Ties: V9 scores 5, the other five all score 4
const TLOG = {x1: [[10, 1, 2], [20, 1, 3]], x2: [[11, 1, 0], [21, 1, 1], [31, 3, 1]], x4: [[12, 1, 2]]};
const TCARDS = {x3: {s: 2, lapses: 4}, x4: {s: 3, lapses: 2}, x5: {s: 2, lapses: 1}, x6: {s: 2, lapses: 5}};
const TITEMS = [{id: 'x1', codes: ['G51']}, {id: 'x2', codes: ['G6']}, {id: 'x3', codes: ['V1']}, {id: 'x4', codes: ['G10']}, {id: 'x5', codes: ['mixup 2']}, {id: 'x6', codes: ['V9']}];
const TMISS = ['x5', 'x5'];

// Every card of the lesson decks as the page builds them: id, top-level deck, the note codes it belongs to
function deckCards(deck) {
  const out = [];
  for (const set of deck.vocab) for (const it of set.items) for (const d of ['r', 'p']) out.push({id: it.id + ':' + d, cat: 'Vocabulary', codes: [set.code]});
  for (const u of deck.units) {
    for (const p of u.points) {
      out.push({id: 'g:' + p.code, cat: 'Grammar', codes: [p.code]});
      for (const x of p.examples) out.push({id: x.id, cat: 'Grammar', codes: [p.code]});
    }
    for (const s of u.selftest) out.push({id: s.id, cat: 'Grammar', codes: s.see || []});
  }
  for (const m of deck.mixups) out.push({id: m.id, cat: 'Mix-ups & mistakes', codes: ['mixup ' + m.n, ...(m.see || [])]});
  for (const m of deck.mistakes) out.push({id: m.id, cat: 'Mix-ups & mistakes', codes: ['mistake ' + m.n, ...(m.see || [])]});
  for (const part of deck.workbook) for (const g of part.groups) for (const it of g.items) out.push({id: it.id, cat: 'Workbook', codes: it.see || []});
  return out;
}

const int = (r, n) => Math.floor(r() * n);
const pick = (r, l) => l[int(r, l.length)];
const shuffle = (r, l) => l.map(x => [r(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

// A random learner: a shuffled sample of the deck, about 45 days of reviews with days off, older days only in hist
function world(r, all, dOf) {
  const today = 20000 + int(r, 900), now = today * 86400 + 5 * 3600 + int(r, 18 * 3600);
  const mine = shuffle(r, all.filter(() => r() < 0.4));
  const on = [];
  for (let d = today - 45; d <= today; d++) if (r() < (d === today ? 0.5 : 0.7)) on.push(d);
  const cards = {}, log = {}, hist = {};
  for (const c of mine) {
    const u = r();
    if (u < 0.3) continue;
    const rec = u < 0.36 ? {s: 0} : u < 0.5 ? {s: pick(r, [1, 3]), due: Math.round((today + r() * 4 - 2) * DAY)}
      : {s: 2, due: today - 30 + int(r, 90), ivl: pick(r, [1, 3, 20, 21, 22, 60, 1 + int(r, 200)])};
    if (r() < 0.3) rec.lapses = int(r, 5);
    if (r() < 0.1) rec.susp = true;
    cards[c.id] = rec;
    // 05:00 to 23:00 UTC, so an entry stays on its day under either dayOf and never lies in the future
    const list = on.length ? Array.from({length: int(r, 7)}, () => Math.min(now, pick(r, on) * 86400 + 5 * 3600 + int(r, 18 * 3600))).sort((x, y) => x - y)
      .map(tm => r() < 0.6 ? [tm, 1 + int(r, 4), int(r, 4), int(r, 120) / 2] : [tm, 1 + int(r, 4), int(r, 4)]) : [];
    if (list.length) log[c.id] = list;
  }
  for (let d = today - 70; d <= today; d++) if (r() < (d < today - 45 ? 0.6 : 0.3)) hist[d] = int(r, 25);
  const misses = Array.from({length: 60}, () => r() < 0.1 ? 'gone:' + int(r, 5) : pick(r, mine).id);
  const flat = Object.values(log).flat();
  const sinces = [0, now - 7 * 86400, now - 86400, flat.length ? pick(r, flat)[0] : 1, now + 1];
  return {log, hist, cards, misses, today, now, sinces, dayOf: dOf, metas: mine.map(c => ({id: c.id, cat: c.cat})), items: mine.map(c => ({id: c.id, codes: c.codes}))};
}

function model({log, hist, cards, metas, items, misses, dayOf}) {
  const flat = [];
  for (const id of Object.keys(log)) for (const [tm, g, st, secs] of log[id]) flat.push({id, tm, g, st, secs: secs || 0, day: dayOf(tm * 1000)});
  const num = (l, f) => l.filter(f).length;
  const dueDay = c => c.s === 2 ? c.due : dayOf(c.due);
  const stage = id => {
    const c = cards[id];
    if (c && c.susp) return 'suspended';
    if (!c || c.s === 0) return 'new';
    if (c.s === 1 || c.s === 3) return 'learning';
    return c.ivl < 21 ? 'young' : 'mature';
  };
  // Letters, then the number as a number: G6 < G51, V2 < V10, mistake 3 < mixup 1
  const parts = code => { const m = /^(\D*)(\d*)/.exec(code); return [m[1], Number(m[2])]; };
  const byCode = (a, b) => { const [pa, na] = parts(a), [pb, nb] = parts(b); return pa !== pb ? (pa < pb ? -1 : 1) : na - nb; };
  return {
    daily() {
      const out = {};
      for (const d of new Set([...Object.keys(hist).map(Number), ...flat.map(e => e.day)])) {
        const n = Math.max(hist[d] || 0, num(flat, e => e.day === d));
        if (n > 0) out[d] = n;
      }
      return out;
    },
    streak(daily, today) {
      let n = 0;
      for (let d = today; ; d--) { if (daily[d] > 0) n++; else if (d < today) break; }
      return n;
    },
    count(daily, today, days) { let n = 0; for (let d = today - days + 1; d <= today; d++) n += daily[d] || 0; return n; },
    retention(since) {
      const l = flat.filter(e => e.tm >= since && e.st === 2), ok = num(l, e => e.g !== 1);
      return {n: l.length, ok, rate: l.length ? ok / l.length : null};
    },
    gradeMix(since) { return [1, 2, 3, 4].map(g => num(flat, e => e.tm >= since && e.g === g)); },
    forecast(today, days) {
      const live = Object.values(cards).filter(c => c.s > 0 && !c.susp);
      return Array.from({length: days}, (_, i) => num(live, c => dueDay(c) === today + i || (i === 0 && dueDay(c) < today)));
    },
    breakdown() {
      const out = {};
      for (const cat of new Set(metas.map(m => m.cat))) {
        const mine = metas.filter(m => m.cat === cat), b = out[cat] = {};
        for (const k of ['new', 'learning', 'young', 'mature', 'suspended']) b[k] = num(mine, m => stage(m.id) === k);
        b.total = mine.length;
      }
      return out;
    },
    weak(since) {
      const recent = flat.filter(e => e.tm >= since);
      return [...new Set(items.flatMap(it => it.codes))].map(code => {
        const ids = new Set(items.filter(it => it.codes.includes(code)).map(it => it.id));
        const mine = recent.filter(e => ids.has(e.id)), again = num(mine, e => e.g === 1), miss = num(misses, id => ids.has(id));
        const lapses = sum([...ids].map(id => (cards[id] || {}).lapses || 0));
        return {code, again, reviews: mine.length, lapses, misses: miss, score: 2 * again + lapses + 1.5 * miss};
      }).filter(w => w.score > 0).sort((a, b) => b.score - a.score || b.again - a.again || byCode(a.code, b.code));
    },
    session(ids, since) {
      const l = flat.filter(e => e.tm >= since && ids.includes(e.id)), g = k => num(l, e => e.g === k);
      return {n: l.length, again: g(1), hard: g(2), good: g(3), easy: g(4), secs: sum(l.map(e => e.secs))};
    },
  };
}

export default async function (pure, t) {
  const { STATS } = pure;
  const {daily, streak, count, retention, gradeMix, forecast, breakdown, weak, session} = STATS;
  t.eq(Object.keys(STATS), ['daily', 'streak', 'count', 'retention', 'gradeMix', 'forecast', 'breakdown', 'weak', 'session'], 'STATS: the nine functions and nothing else');
  const hand = JSON.stringify([LOG, HIST, CARDS, METAS, WLOG, WCARDS, WITEMS, WMISS, TLOG, TCARDS, TITEMS, TMISS]);

  /* ---------- daily ---------- */
  t.eq(daily(LOG, HIST, dayOf), DAILY, 'daily: the larger of hist and the log for each day; a zero day is left out');
  t.eq(daily(LOG, {}, dayOf), {100: 5, 101: 1, 103: 2, 104: 3}, 'daily: the log alone');
  t.eq(daily({}, HIST, dayOf), {99: 4, 100: 3, 101: 6, 104: 3}, 'daily: an empty log leaves hist, minus its zero day');
  t.eq(daily({}, {}, dayOf), {}, 'daily: nothing studied');
  t.eq(daily({a: []}, {7: 0}, dayOf), {}, 'daily: a card with an empty list and a day with a zero give nothing');
  {
    // 03:00 belongs to the day before when the day turns at 4am; 04:00 is the new day
    const night = {x: [[at(101, 3 * 3600), 3, 0], [at(101, 4 * 3600), 3, 1]]};
    t.eq(daily(night, {}, dayOf4), {100: 1, 101: 1}, 'daily: days are whatever dayOf says, here with the 4am rollover');
    t.eq(daily(night, {}, dayOf), {101: 2}, 'daily: the same log with midnight days');
    const seen = [];
    daily({x: [[at(101, 7), 3, 0]]}, {}, ms => { seen.push(ms); return 1; });
    t.eq(seen, [(101 * 86400 + 7) * 1000], 'daily: dayOf gets milliseconds, the log holds seconds');
  }

  /* ---------- streak ---------- */
  t.eq([104, 103, 101, 99].map(d => streak(DAILY, d)), [2, 1, 3, 1], 'streak: runs that end today (102 is the gap)');
  t.eq(streak(DAILY, 105), 2, 'streak: nothing yet today, so the run that ended yesterday still stands');
  t.eq(streak(DAILY, 102), 3, 'streak: the same on the gap day: 99, 100, 101');
  t.eq([106, 98, 50].map(d => streak(DAILY, d)), [0, 0, 0], 'streak: neither today nor yesterday');
  t.eq(streak({}, 104), 0, 'streak: nothing ever studied');
  t.eq(streak({103: 2, 104: 0}, 104), 1, 'streak: a zero today is the same as no entry');
  t.eq(streak({102: 1, 103: 0, 104: 1}, 104), 1, 'streak: a zero in between ends the run');

  /* ---------- count ---------- */
  // back from 104: 3, 2, 0, 6, 5, 4
  t.eq([0, 1, 2, 3, 4, 5, 6, 7, 30].map(n => count(DAILY, 104, n)), [0, 3, 5, 5, 11, 16, 20, 20, 20], 'count: the last n days, today included');
  t.eq(count(DAILY, 102, 3), 11, 'count: days after today are not counted');
  t.eq(count(DAILY, 105, 1), 0, 'count: nothing today');
  t.eq([count(DAILY, 98, 7), count({}, 104, 7)], [0, 0], 'count: before the first day, and nothing ever studied');

  /* ---------- retention ---------- */
  // Reviews of learned cards (state 2): a Good on 101 and Again on 104, b Hard on 103, c Good on 104
  t.eq(retention(LOG, 0), {n: 4, ok: 3, rate: 0.75}, 'retention: only reviews of learned cards; Hard counts as remembered');
  t.eq(retention(LOG, at(104)), {n: 2, ok: 1, rate: 0.5}, 'retention: since the start of day 104');
  t.eq(retention(LOG, at(104, 9)), {n: 2, ok: 1, rate: 0.5}, 'retention: an entry exactly at since is in');
  t.eq(retention(LOG, at(104, 10)), {n: 1, ok: 1, rate: 1}, 'retention: one second later it is out');
  t.eq(retention(LOG, at(105)), {n: 0, ok: 0, rate: null}, 'retention: nothing since then, so no rate');
  t.eq(retention({}, 0), {n: 0, ok: 0, rate: null}, 'retention: empty log');
  t.eq(retention({x: [[5, 3, 0], [9, 1, 1], [12, 3, 3], [15, 4, 1]]}, 0), {n: 0, ok: 0, rate: null}, 'retention: new, learning and relearning answers are not reviews');
  t.eq(retention({x: [[5, 1, 2], [6, 1, 2]]}, 0), {n: 2, ok: 0, rate: 0}, 'retention: all forgotten is a rate of 0, not null');
  t.eq(retention({x: [[5, 2, 2]], y: [[6, 4, 2]]}, 0), {n: 2, ok: 2, rate: 1}, 'retention: Hard and Easy both pass');

  /* ---------- gradeMix ---------- */
  // a: 3 3 3 1 3, b: 1 3 4 2, c: 4 3
  t.eq(gradeMix(LOG, 0), [2, 1, 6, 2], 'gradeMix: again, hard, good, easy over every state');
  t.eq(gradeMix(LOG, at(103)), [1, 1, 2, 1], 'gradeMix: since day 103');
  t.eq([gradeMix(LOG, at(103, 5)), gradeMix(LOG, at(103, 6))], [[1, 1, 2, 1], [1, 0, 2, 1]], 'gradeMix: an entry exactly at since is in, one second later out');
  t.eq([gradeMix(LOG, at(200)), gradeMix({}, 0)], [[0, 0, 0, 0], [0, 0, 0, 0]], 'gradeMix: nothing since then, and an empty log');
  t.eq(gradeMix(LOG), [2, 1, 6, 2], 'gradeMix: a since left out means the whole log');

  /* ---------- session ---------- */
  // a from day 101: Good 6s, Again 12s, Good 3s; c: Easy 1s, Good 2.5s
  t.eq(session(LOG, ['a', 'c'], at(101)), {n: 5, again: 1, hard: 0, good: 3, easy: 1, secs: 24.5}, 'session: two cards since day 101');
  t.eq(session(LOG, ['b'], 0), {n: 4, again: 1, hard: 1, good: 1, easy: 1, secs: 17}, 'session: an entry with no time spent adds 0 seconds');
  t.eq(session(LOG, ['a', 'a', 'zz'], 0), {n: 5, again: 1, hard: 0, good: 4, easy: 0, secs: 30}, 'session: an id given twice counts once, an unknown id not at all');
  t.eq(session(LOG, ['c', 'b', 'a'], 0), {n: 11, again: 2, hard: 1, good: 6, easy: 2, secs: 50.5}, 'session: every card');
  t.eq([session(LOG, ['c'], at(104, 30)), session(LOG, ['c'], at(104, 31))], [{n: 1, again: 0, hard: 0, good: 1, easy: 0, secs: 2.5}, ZERO], 'session: an entry exactly at since is in, one second later out');
  t.eq([session(LOG, [], 0), session({}, ['a'], 0), session(LOG, ['a'], at(105))], [ZERO, ZERO, ZERO], 'session: no ids, empty log, nothing since');

  /* ---------- forecast ---------- */
  // today: r0, rOver (overdue), l0, lPast (overdue); +1: r1, l1; +3: r3, r3b; +6: r6; +7: r7
  t.eq(forecast(CARDS, 200, 7, dayOf), [4, 2, 0, 2, 0, 0, 1], 'forecast: a week; overdue cards wait in today, new and suspended cards nowhere');
  t.eq(forecast(CARDS, 200, 9, dayOf), [4, 2, 0, 2, 0, 0, 1, 1, 0], 'forecast: nine days reach r7');
  t.eq([forecast(CARDS, 200, 1, dayOf), forecast(CARDS, 200, 0, dayOf)], [[4], []], 'forecast: one day, and no days');
  t.eq(forecast(CARDS, 203, 5, dayOf), [8, 0, 0, 1, 1], 'forecast: three days on, everything unanswered has piled up in today');
  t.eq(forecast(CARDS, 150, 3, dayOf), [0, 0, 0], 'forecast: every card lies beyond the window');
  t.eq([forecast({}, 200, 3, dayOf), forecast({a: {s: 0}, b: {s: 2, due: 200, ivl: 9, susp: true}}, 200, 2, dayOf)], [[0, 0, 0], [0, 0]], 'forecast: no cards, and only new or suspended ones');
  t.eq(forecast({a: {s: 0, due: 200 * DAY}, b: {s: 0, due: 201}}, 200, 2, dayOf), [0, 0], 'forecast: a new card is not counted even if a due date was left on it');
  {
    // A relearning step due at 03:00 tomorrow is still today when the day turns at 4am
    const late = {x: {s: 3, due: 201 * DAY + 3 * 36e5}, y: {s: 1, due: 201 * DAY + 4 * 36e5}};
    t.eq([forecast(late, 200, 2, dayOf4), forecast(late, 200, 2, dayOf)], [[1, 1], [0, 2]], 'forecast: learning cards fall on dayOf(due)');
    const seen = [];
    forecast({x: {s: 2, due: 201, ivl: 1}, y: {s: 1, due: 12345}, z: {s: 3, due: 67890}}, 0, 2, ms => { seen.push(ms); return 0; });
    t.eq(seen, [12345, 67890], 'forecast: a review card\'s due is a day number already, so dayOf is not asked');
  }

  /* ---------- breakdown ---------- */
  t.eq(breakdown(METAS, CARDS), {
    Vocabulary: {new: 2, learning: 1, young: 1, mature: 1, suspended: 1, total: 6},
    Grammar: {new: 0, learning: 2, young: 1, mature: 2, suspended: 1, total: 6},
    Workbook: {new: 0, learning: 0, young: 1, mature: 1, suspended: 1, total: 3},
  }, 'breakdown: by category in the order met; an interval of 21 is mature, 20 young; suspended counts only as suspended');
  t.eq(breakdown(METAS, {}), {
    Vocabulary: {new: 6, learning: 0, young: 0, mature: 0, suspended: 0, total: 6},
    Grammar: {new: 6, learning: 0, young: 0, mature: 0, suspended: 0, total: 6},
    Workbook: {new: 3, learning: 0, young: 0, mature: 0, suspended: 0, total: 3},
  }, 'breakdown: nothing started, so every card is new');
  t.eq(breakdown([], CARDS), {}, 'breakdown: no cards listed');
  t.eq(breakdown([{id: 'r0', cat: 'A'}, {id: 'r0', cat: 'B'}, {id: 'r6', cat: 'A'}, {id: 'r0', cat: 'A'}], CARDS),
    {A: {new: 0, learning: 0, young: 2, mature: 1, suspended: 0, total: 3}, B: {new: 0, learning: 0, young: 1, mature: 0, suspended: 0, total: 1}}, 'breakdown: one row per meta, whatever it repeats');
  t.eq(breakdown([{id: 'x', cat: 'A'}], {x: {s: 2, due: 5}}).A, {new: 0, learning: 0, young: 1, mature: 0, suspended: 0, total: 1}, 'breakdown: a review card with no interval on record is young');
  {
    // An imported deck can be called anything, and so can its cards
    const odd = breakdown([{id: 'r0', cat: '__proto__'}, {id: 'l0', cat: 'constructor'}, {id: 'constructor', cat: 'toString'}, {id: '__proto__', cat: 'toString'}], CARDS);
    t.eq(Object.keys(odd), ['__proto__', 'constructor', 'toString'], 'breakdown: a category named like a built-in is an ordinary key');
    t.eq(Object.values(odd), [{new: 0, learning: 0, young: 1, mature: 0, suspended: 0, total: 1}, {new: 0, learning: 1, young: 0, mature: 0, suspended: 0, total: 1},
      {new: 2, learning: 0, young: 0, mature: 0, suspended: 0, total: 2}], 'breakdown: and counts as usual; a card id named like a built-in is a card with no record');
    const clean = breakdown([], {});
    t.ok(!['new', 'learning', 'young', 'mature', 'suspended', 'total'].some(k => k in clean), 'breakdown: nothing leaked onto the shared prototype');
  }

  /* ---------- weak ---------- */
  // G51 = p + q: again 2+1, reviews 4+2, lapses 2+1 → 6 + 3 = 9.   G6 = q + r: again 1+1, reviews 2+3, lapses 1, misses 2 → 4 + 1 + 3 = 8
  // V10 = t: lapses 4 → 4.   V3 = s: misses 2 → 3.   V2 (one clean review) and G7 (nothing) score 0
  t.eq(weak(WITEMS, WLOG, WCARDS, WMISS, 0), [row('G51', 3, 6, 3, 0, 9), row('G6', 2, 5, 1, 2, 8), row('V10', 0, 0, 4, 0, 4), row('V3', 0, 1, 0, 2, 3)],
    'weak: a card under two codes counts for both; a score of 0 is left out');
  t.eq(weak(WITEMS, WLOG, WCARDS, WMISS, 2000), [row('G51', 2, 3, 3, 0, 7), row('G6', 1, 2, 1, 2, 6), row('V10', 0, 0, 4, 0, 4), row('V3', 0, 0, 0, 2, 3)],
    'weak: since 2000 the log counts are smaller; lapses and misses stay');
  t.eq(weak(WITEMS, WLOG, WCARDS, WMISS, 2001), [row('G6', 1, 2, 1, 2, 6), row('G51', 1, 2, 3, 0, 5), row('V10', 0, 0, 4, 0, 4), row('V3', 0, 0, 0, 2, 3)],
    'weak: one second later p\'s Again is out and G6 leads');
  t.eq(weak(WITEMS, {}, {}, [], 0), [], 'weak: no reviews, no lapses, no misses');
  t.eq(weak(WITEMS, {}, WCARDS, [], 0), [row('V10', 0, 0, 4, 0, 4), row('G51', 0, 0, 3, 0, 3), row('G6', 0, 0, 1, 0, 1)], 'weak: lapses alone');
  t.eq(weak(WITEMS, {}, {}, WMISS, 0), [row('G6', 0, 0, 0, 2, 3), row('V3', 0, 0, 0, 2, 3)], 'weak: practice misses alone, 1.5 each');
  t.eq(weak([], WLOG, WCARDS, WMISS, 0), [], 'weak: no items');
  t.eq(weak([{id: 'p', codes: ['G51', 'G51']}, {id: 'p', codes: ['G51']}], WLOG, WCARDS, ['p'], 0), [row('G51', 2, 4, 2, 1, 7.5)], 'weak: a card listed twice under a code still counts once');
  t.eq(weak([{id: 'p', codes: ['__proto__']}, {id: 'constructor', codes: ['G1']}], WLOG, WCARDS, [], 0), [row('__proto__', 2, 4, 2, 0, 6)], 'weak: a code or card id named like a built-in is ordinary text');
  {
    // Score first (V9: 5). At 4 each: again 2 (G6, G51), again 1 (G10), again 0 (V1, mixup 2)
    const want = ['V9', 'G6', 'G51', 'G10', 'V1', 'mixup 2'];
    t.eq(weak(TITEMS, TLOG, TCARDS, TMISS, 0), [row('V9', 0, 0, 5, 0, 5), row('G6', 2, 3, 0, 0, 4), row('G51', 2, 2, 0, 0, 4), row('G10', 1, 1, 2, 0, 4), row('V1', 0, 0, 4, 0, 4), row('mixup 2', 0, 0, 1, 2, 4)],
      'weak: equal scores go by more Again, then by code with its number read as a number (G6 before G51)');
    const r = t.rng(3), orders = Array.from({length: 30}, () => weak(shuffle(r, TITEMS), TLOG, TCARDS, shuffle(r, TMISS), 0).map(w => w.code));
    t.ok(orders.every(o => String(o) === String(want)), 'weak: the order does not depend on the order of the items', orders.find(o => String(o) !== String(want)));
    const codes = ['V10', 'G100', 'G2', 'V9', 'mistake 12', 'V2', 'G99', 'mistake 3'], lap = Object.fromEntries(codes.map((c, i) => ['k' + i, {s: 2, lapses: 1}]));
    const order = l => weak(l.map((c, i) => ({id: 'k' + i, codes: [c]})), {}, lap, [], 0).map(w => w.code);
    t.eq(order(codes), ['G2', 'G99', 'G100', 'V2', 'V9', 'V10', 'mistake 3', 'mistake 12'], 'weak: a full tie is in code order');
    t.eq([order(['G06', 'G6']), order(['G6', 'G06'])], [['G06', 'G6'], ['G06', 'G6']], 'weak: two codes that read as the same number still have one fixed order');
  }

  /* ---------- odd input ---------- */
  t.eq([daily(undefined, undefined, dayOf), retention(null, 0), gradeMix(null, 0), session(null, null, 0), forecast(null, 5, 2, dayOf), breakdown(null, null), weak(null, null, null, null, 0)],
    [{}, {n: 0, ok: 0, rate: null}, [0, 0, 0, 0], ZERO, [0, 0], {}, []], 'a missing log, hist, card table or list reads as empty');
  t.eq(breakdown([{id: 'a', cat: 'X'}], null), {X: {new: 1, learning: 0, young: 0, mature: 0, suspended: 0, total: 1}}, 'breakdown: no card table at all means all new');
  {
    const junk = {a: [null, 'x', [at(100), 3, 2, 4], [at(100, 1), 9, 2], [at(100, 2)]], b: 'nope'};
    t.eq([gradeMix(junk, 0), daily(junk, {}, dayOf), retention(junk, 0), session(junk, ['a', 'b'], 0)], [[0, 0, 1, 0], {100: 1}, {n: 1, ok: 1, rate: 1}, {n: 1, again: 0, hard: 0, good: 1, easy: 0, secs: 4}],
      'a stray non-entry or a grade outside 1–4 is skipped by every function alike');
  }
  t.ok(JSON.stringify([LOG, HIST, CARDS, METAS, WLOG, WCARDS, WITEMS, WMISS, TLOG, TCARDS, TITEMS, TMISS]) === hand, 'no argument was changed by any call above');

  /* ---------- the real deck, hand-checkable ---------- */
  const all = deckCards(t.deck());
  t.ok(all.length > 1500 && new Set(all.map(c => c.id)).size === all.length, 'deck: card ids are unique', all.length);
  t.ok(all.filter(c => c.codes.length > 1).length > 50, 'deck: plenty of cards belong to two notes');
  t.eq(all.flatMap(c => c.codes).filter(c => !/^\D+\d+$/.test(c)), [], 'deck: every note code is a name and one number, which is all the model below can sort');
  {
    const cats = {};
    for (const c of all) cats[c.cat] = (cats[c.cat] || 0) + 1;
    const fresh = breakdown(all, {});
    t.eq(Object.keys(fresh), ['Vocabulary', 'Grammar', 'Mix-ups & mistakes', 'Workbook'], 'deck: the four lesson decks, in page order');
    t.eq(Object.values(fresh).map(b => [b.new, b.total, b.learning + b.young + b.mature + b.suspended]), Object.values(cats).map(n => [n, n, 0]), 'deck: before any study every card is new');
    // One lapse on every card: a code's score is then the number of cards under it
    const lapsed = Object.fromEntries(all.map(c => [c.id, {s: 2, due: 1, ivl: 1, lapses: 1}]));
    const w = weak(all, {}, lapsed, [], 0), size = code => all.filter(c => c.codes.includes(code)).length;
    t.eq(w.length, new Set(all.flatMap(c => c.codes)).size, 'deck: one row per note code');
    t.ok(w.every(x => x.score === size(x.code) && x.lapses === x.score && !x.again && !x.reviews && !x.misses), 'deck: with one lapse per card, a code scores its number of cards');
    t.eq(sum(w.map(x => x.score)), sum(all.map(c => c.codes.length)), 'deck: and a card under two codes is counted under each');
    t.eq(forecast(lapsed, 5, 3, dayOf), [all.length, 0, 0], 'deck: all of them overdue lands in today');
  }

  /* ---------- seeded random histories against the model ---------- */
  for (let seed = 1; seed <= 10; seed++) {
    const r = t.rng(seed), w = world(r, all, seed % 2 ? dayOf4 : dayOf), m = model(w), tag = `seed ${seed}: `;
    const {log, hist, cards, metas, items, misses, today, sinces} = w;
    const before = JSON.stringify([log, hist, cards, metas, items, misses]);
    const entries = Object.values(log).flat(), started = Object.values(cards).filter(c => c.s && !c.susp).length;

    const d = daily(log, hist, w.dayOf);
    t.eq(d, m.daily(), tag + 'daily');
    t.ok(Object.keys(hist).every(k => !hist[k] || d[k] >= hist[k]) && sum(Object.values(d)) >= entries.length, tag + 'daily never falls below hist or the log');
    t.eq(sum(Object.values(daily(log, {}, w.dayOf))), entries.length, tag + 'daily without hist adds up to the number of entries');
    const days = Array.from({length: 60}, (_, i) => today + 2 - i);
    t.eq(days.map(x => streak(d, x)), days.map(x => m.streak(d, x)), tag + 'streak, seen from each of 60 days');
    t.ok(days.some(x => streak(d, x) > 1) && days.some(x => x < today && x > today - 45 && !d[x]), tag + 'streak: the history has runs and gaps');
    for (const n of [0, 1, 7, 30, 365]) t.eq(days.map(x => count(d, x, n)), days.map(x => m.count(d, x, n)), tag + `count over ${n} days`);
    t.eq(count(d, today, 1e6), sum(Object.values(d)), tag + 'count over everything is the whole total');

    for (const since of sinces) {
      const mix = gradeMix(log, since), ret = retention(log, since), when = ` since ${since}`;
      t.eq(mix, m.gradeMix(since), tag + 'gradeMix' + when);
      t.eq(sum(mix), entries.filter(e => e[0] >= since).length, tag + 'gradeMix adds up to the number of entries' + when);
      t.eq(ret, m.retention(since), tag + 'retention' + when);
      t.ok(ret.ok <= ret.n && ret.n <= sum(mix) && (ret.n ? ret.rate >= 0 && ret.rate <= 1 : ret.rate === null), tag + 'retention stays within bounds' + when, ret);
      const wk = weak(items, log, cards, misses, since);
      t.eq(wk, m.weak(since), tag + 'weak' + when);
      t.ok(wk.every((x, i) => x.score > 0 && x.score === 2 * x.again + x.lapses + 1.5 * x.misses && x.again <= x.reviews && (!i || wk[i - 1].score >= x.score)), tag + 'weak: scores add up, are positive and never rise' + when);
      t.eq(new Set(wk.map(x => x.code)).size, wk.length, tag + 'weak: one row per code' + when);
      const ids = Object.keys(log), some = [...ids.filter(() => r() < 0.3), 'gone:1'], rest = ids.filter(id => !some.includes(id));
      const sa = session(log, some.concat(some.slice(0, 5)), since), sb = session(log, rest, since), sAll = session(log, shuffle(r, ids), since);
      t.eq(sa, m.session(some, since), tag + 'session over some cards' + when);
      t.eq([sAll.again, sAll.hard, sAll.good, sAll.easy, sAll.n], [...mix, sum(mix)], tag + 'session over every card is the grade mix' + when);
      t.eq(Object.keys(ZERO).map(k => sa[k] + sb[k]), Object.values(sAll), tag + 'session: two halves add up to the whole' + when);
    }
    t.ok(sum(gradeMix(log, sinces[1])) > 0 && sum(gradeMix(log, sinces[1])) < entries.length && retention(log, 0).n > 20, tag + 'the windows cut through the log');

    for (const n of [0, 1, 7, 30, 200]) {
      const f = forecast(cards, today, n, w.dayOf);
      t.eq(f, m.forecast(today, n), tag + `forecast over ${n} days`);
      t.ok(f.length === n && sum(f) <= started, tag + `forecast over ${n} days never counts more than the started, unsuspended cards`, [sum(f), started]);
    }
    t.eq(sum(forecast(cards, today, 200, w.dayOf)), started, tag + 'forecast far enough ahead holds each of them exactly once');
    t.eq(forecast(cards, today - 40, 200, w.dayOf)[0], 0, tag + 'forecast from before any due date has an empty today');

    const b = breakdown(metas, cards);
    t.eq(b, m.breakdown(), tag + 'breakdown');
    t.eq(sum(Object.values(b).map(x => x.total)), metas.length, tag + 'breakdown totals add up to the number of cards');
    t.ok(Object.values(b).every(x => x.new + x.learning + x.young + x.mature + x.suspended === x.total), tag + 'breakdown: each total is the sum of its five parts');
    t.eq(sum(Object.values(b).map(x => x.learning + x.young + x.mature)), metas.filter(c => cards[c.id] && cards[c.id].s && !cards[c.id].susp).length, tag + 'breakdown: started cards are the ones the forecast can hold');

    t.ok(JSON.stringify([log, hist, cards, metas, items, misses]) === before, tag + 'no argument was changed');
  }
}
