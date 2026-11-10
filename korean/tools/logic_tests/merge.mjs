// PURE:merge: merging two copies of the saved progress (sync between devices, backup restore).
// Results are compared through MERGE.canon, so key order never matters; canon itself is checked first.
export default async function (pure, t) {
  const { MERGE } = pure;
  const {SYNCED, canon, stampOf, mergeFields: mf, mergeState, syncData, sanitize, dayFromLog} = MERGE;
  const clone = v => JSON.parse(JSON.stringify(v));
  const same = (got, want, label) => t.ok(canon(got) === canon(want), label, {got, want});
  const EMPTY = {v: 2, epoch: 0, cards: {}, log: {}, undone: {}, missed: {}, unmiss: {}, hist: {}, runs: [], set: {}, setAt: {}, xnew: {n: 0, extraNew: 0}};
  const FIELDS = Object.keys(EMPTY).sort();
  const P = o => Object.assign(clone(EMPTY), o);
  const DAY = 864e5, dayOf = ms => Math.floor(ms / DAY);
  const deck = t.deck();

  /* ---------- canon, stampOf ---------- */
  t.eq(SYNCED, ['newPerDay', 'revPerDay', 'retention', 'vocabDir', 'newAdded'], 'SYNCED');
  t.eq(canon({b: 1, a: [{d: 1, c: 2}, 'x', null], 10: 1, 9: 2}), '{"10":1,"9":2,"a":[{"c":2,"d":1},"x",null],"b":1}', 'canon: keys sorted as text at every depth, arrays keep their order');
  t.eq(canon({a: undefined, b: [undefined], c: NaN, 'q"k': '가'}), '{"b":[null],"c":null,"q\\"k":"가"}', 'canon: same text JSON would give for undefined, NaN and quotes');
  t.eq([canon(null), canon(3), canon('x'), canon([]), canon({}), canon(true)], ['null', '3', '"x"', '[]', '{}', 'true'], 'canon: plain values');
  t.ok(canon(JSON.parse(canon(deck))) === canon(deck) && canon(deck).length === JSON.stringify(deck).length, 'canon: the real deck round-trips with nothing lost');
  {
    const r = t.rng(7), keys = Array.from({length: 40}, (_, i) => (i % 3 ? 'k' : '') + i), build = order => Object.fromEntries(order.map(k => [k, {v: k, w: [k]}]));
    const shuffled = keys.map(k => [r(), k]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    t.ok(canon(build(keys)) === canon(build(shuffled)), 'canon: insertion order does not matter');
    t.eq(JSON.parse('[' + canon(build(shuffled)).replace(/:\{[^}]*\}/g, '').slice(1, -1) + ']'), keys.slice().sort(), 'canon: number-like keys are sorted with the rest');
  }
  t.eq([stampOf({m: 5, last: 9}), stampOf({last: 9}), stampOf({m: 0, last: 9}), stampOf({s: 0}), stampOf(null), stampOf(undefined)], [5, 9, 9, 0, 0, 0], 'stampOf: m, else last, else 0');

  /* ---------- mergeFields, rule by rule ---------- */
  same(mf({}, {}), EMPTY, 'mergeFields: two empty payloads give the full empty shape');
  same(mf(undefined, null), EMPTY, 'mergeFields: a missing side counts as empty');
  same(mf({log: {x: [null, [5, 3, 0], 'junk', 7]}, runs: [null, {t: 3}, 'x', 5]}, {}), P({log: {x: [[5, 3, 0]]}, runs: [{t: 3}]}), 'mergeFields: a stray non-entry in a log or in the runs is dropped, not fatal');
  {
    const a = P({cards: {x: {s: 2, last: 100, ivl: 5, susp: true}, y: {s: 1, last: 50}, onlyA: {s: 0, m: 1}}});
    const b = P({cards: {x: {s: 3, last: 200, lapses: 1}, y: {s: 2, last: 10, m: 60, ivl: 3}, onlyB: {s: 1, last: 2}}});
    const want = {x: {s: 3, last: 200, lapses: 1}, y: {s: 2, last: 10, m: 60, ivl: 3}, onlyA: {s: 0, m: 1}, onlyB: {s: 1, last: 2}};
    same(mf(a, b).cards, want, 'cards: union of ids, the higher stamp wins whole (no field leaks from the loser), m outranks last');
    same(mf(b, a).cards, want, 'cards: same result the other way round');
    const c = P({cards: {z: {s: 1, last: 7}, n: {s: 0, reps: 1}}}), d = P({cards: {z: {s: 2, last: 7}, n: {s: 0, reps: 2}}});
    same(mf(c, d).cards, {z: {s: 2, last: 7}, n: {s: 0, reps: 2}}, 'cards: equal stamps (also 0 = no stamp) → larger canon text');
    same(mf(d, c).cards, mf(c, d).cards, 'cards: the tie-break does not depend on the side');
    const odd = P({cards: {toString: {s: 1, last: 1}, valueOf: {s: 2, last: 9}, hasOwnProperty: {s: 1, last: 3}}, log: {toString: [[5, 3, 0]]}, missed: {toString: 4}, undone: {valueOf: [2]}});
    same(mf(odd, P({cards: {toString: {s: 2, last: 2}}, log: {toString: [[6, 3, 1]], valueOf: [[2, 3, 0]]}, missed: {valueOf: 1}})),
      P({cards: {toString: {s: 2, last: 2}, valueOf: {s: 2, last: 9}, hasOwnProperty: {s: 1, last: 3}}, log: {toString: [[5, 3, 0], [6, 3, 1]]}, missed: {toString: 4, valueOf: 1}, undone: {valueOf: [2]}}),
      'ids that are also Object.prototype names merge like any other');
  }
  {
    const a = P({log: {x: [[10, 3, 0], [20, 3, 1, 4]], y: [[5, 1, 2]], z: [[7, 3, 0]], e: []}, undone: {y: [5], e: []}});
    const b = P({log: {x: [[15, 2, 1], [20, 4, 1, 9]], z: [[7, 3, 0]], w: [[1, 3, 0]]}, undone: {x: [10], q: [3, 1, 3]}});
    const m = mf(a, b);
    same(m.undone, {y: [5], x: [10], q: [1, 3]}, 'undone: per card, sorted union without repeats; empty lists dropped');
    same(m.log, {x: [[15, 2, 1], [20, 4, 1, 9]], z: [[7, 3, 0]], w: [[1, 3, 0]]}, 'log: union by timestamp, larger canon on a shared timestamp, undone ones removed, emptied cards dropped');
    same(mf(b, a), m, 'log/undone: same result the other way round');
    const stale = P({log: {x: [[10, 3, 0]], y: [[5, 1, 2], [6, 3, 3]]}});
    same(mf(m, stale).log, {x: [[15, 2, 1], [20, 4, 1, 9]], y: [[6, 3, 3]], z: [[7, 3, 0]], w: [[1, 3, 0]]}, 'log: an undone entry does not come back from a device that still has it');
    same(mf(stale, m), mf(m, stale), 'log: … whichever side it arrives on');
    same(mf(P({log: {x: [[30, 3, 2], [10, 3, 0], [20, 3, 1]]}}), EMPTY).log.x.map(e => e[0]), [10, 20, 30], 'log: sorted ascending by timestamp');
    same(mf(P({log: {x: [[9, 3, 0]]}, undone: {x: [9]}}), EMPTY), P({undone: {x: [9]}}), 'log: an entry undone on the same side goes too');
  }
  {
    const a = P({missed: {p: 100, q: 50, r: 70, s: 10}, unmiss: {q: 40, t: 5}});
    const b = P({missed: {p: 90, q: 20, u: 30}, unmiss: {p: 100, q: 45, r: 60, u: 31}});
    const want = P({missed: {q: 50, r: 70, s: 10}, unmiss: {p: 100, q: 45, r: 60, t: 5, u: 31}});
    same(mf(a, b), want, 'missed/unmiss: per-key maximum, then a miss cleared at or after its time is deleted');
    same(mf(b, a), want, 'missed/unmiss: same result the other way round');
    same(mf(want, P({missed: {p: 101}})).missed, {p: 101, q: 50, r: 70, s: 10}, 'missed: missing it again after the clear brings it back');
  }
  same(mf(P({hist: {100: 5, 101: 2}}), P({hist: {101: 7, 102: 1}})).hist, {100: 5, 101: 7, 102: 1}, 'hist: per-day maximum');
  {
    const a = P({runs: [{t: 10, right: 3}, {t: 30, right: 1}]}), b = P({runs: [{t: 5, wrong: 1}, {t: 20, right: 2}, {t: 30, right: 5}]});
    same(mf(a, b).runs, [{t: 5, wrong: 1}, {t: 10, right: 3}, {t: 20, right: 2}, {t: 30, right: 5}], 'runs: union by t, larger canon on a shared t, ascending');
    same(mf(b, a).runs, mf(a, b).runs, 'runs: same result the other way round');
    const seq = (from, to) => Array.from({length: to - from + 1}, (_, i) => ({t: from + i, right: i % 7}));
    const big = mf(P({runs: seq(1, 150)}), P({runs: seq(101, 300)})).runs;
    t.eq([big.length, big[0].t, big[199].t], [200, 101, 300], 'runs: only the newest 200 are kept');
    t.eq(mf(P({runs: seq(1, 250)}), EMPTY).runs.map(x => x.t), seq(51, 250).map(x => x.t), 'runs: one over-long side is trimmed as well');
  }
  {
    const a = P({set: {newPerDay: 20, revPerDay: 100, retention: 0.9, vocabDir: 'both', kb: 'on', typeEnKo: false}, setAt: {newPerDay: 500, revPerDay: 300, kb: 900}});
    const b = P({set: {newPerDay: 10, revPerDay: 150, retention: 0.85, vocabDir: 'ko-en', newAdded: 5, koType: true}, setAt: {newPerDay: 400, revPerDay: 300, retention: 1}});
    const want = P({set: {newPerDay: 20, revPerDay: 150, retention: 0.85, vocabDir: 'ko-en', newAdded: 5}, setAt: {newPerDay: 500, revPerDay: 300, retention: 1}});
    same(mf(a, b), want, 'set: later setAt wins (missing = 0), tie → larger canon, setAt = max, keys outside SYNCED dropped');
    same(mf(b, a), want, 'set: same result the other way round');
    same(mf(P({set: {newPerDay: 9}}), P({set: {newPerDay: 10}})).set, {newPerDay: 9}, 'set: the tie-break compares text, so 9 beats 10 (arbitrary, but the same on every device)');
    same(mf(P({set: {newPerDay: 9}, setAt: {newPerDay: 0}}), EMPTY), P({set: {newPerDay: 9}}), 'setAt: a stamp of 0 is the same as none');
  }
  same(mf(P({xnew: {n: 105, extraNew: 0}}), P({xnew: {n: 104, extraNew: 30}})).xnew, {n: 105, extraNew: 0}, 'xnew: the higher day wins with its own extraNew');
  same(mf(P({xnew: {n: 105, extraNew: 10}}), P({xnew: {n: 105, extraNew: 20}})).xnew, {n: 105, extraNew: 20}, 'xnew: same day → larger extraNew');
  same(mf({xnew: {n: 3, extraNew: 10}}, {}).xnew, {n: 3, extraNew: 10}, 'xnew: missing on one side');
  t.eq([mf({epoch: 2}, {epoch: 5}).epoch, mf({epoch: 3}, {}).epoch, mf({v: 1}, {v: 1}).v], [5, 3, 2], 'epoch: maximum; v: always 2');
  {
    const v1 = {kind: 'korean-flashcards', v: 1, at: '2026-11-01T10:00:00.000Z', cards: {'g:G1': {s: 2, reps: 3, last: 900, ivl: 4, due: 20400}}, missed: {'mx:1': 800}, hist: {20395: 14}, log: {'g:G1': [[1, 3, 0], [2, 3, 1]]}};
    const mine = P({cards: {'g:G1': {s: 3, reps: 4, last: 950, m: 950}}, log: {'g:G1': [[2, 3, 1], [3, 1, 2, 6]]}, unmiss: {'mx:1': 850}, hist: {20395: 9, 20396: 2}});
    const m = mf(v1, mine);
    same(m, P({cards: mine.cards, log: {'g:G1': [[1, 3, 0], [2, 3, 1], [3, 1, 2, 6]]}, unmiss: mine.unmiss, hist: {20395: 14, 20396: 2}}), 'a version-1 backup (cards, missed, hist, log only) merges into current data');
    t.eq(Object.keys(m).sort(), FIELDS, 'mergeFields: the result has the payload fields and nothing else');
    const before = JSON.stringify([v1, mine]);
    m.cards['g:G1'].s = 0; m.log['g:G1'][0][1] = 4; m.hist[20395] = 0;
    t.ok(JSON.stringify([v1, mine]) === before, 'mergeFields: the result shares nothing with its inputs');
  }

  /* ---------- mergeFields against an independent n-way reference, on random payloads ---------- */
  // ref(list) applies the rules to any number of payloads at once; with one payload it is the normalised copy.
  const ref = ps => {
    const col = f => ps.map(p => p[f]).filter(Boolean), keys = f => [...new Set(col(f).flatMap(o => Object.keys(o)))];
    const top = l => l.reduce((w, c) => c[0] > w[0] || (c[0] === w[0] && c[1] > w[1]) ? c : w);   // [stamp, tie-break, value]
    const asc = (x, y) => x - y;
    const out = {v: 2, epoch: Math.max(0, ...ps.map(p => p.epoch || 0)), cards: {}, log: {}, undone: {}, missed: {}, unmiss: {}, hist: {}, set: {}, setAt: {}};
    for (const id of keys('cards')) out.cards[id] = top(col('cards').filter(o => id in o).map(o => [stampOf(o[id]), canon(o[id]), o[id]]))[2];
    for (const id of keys('undone')) { const u = [...new Set(col('undone').flatMap(o => o[id] || []))].sort(asc); if (u.length) out.undone[id] = u; }
    for (const id of keys('log')) {
      const all = col('log').flatMap(o => o[id] || []), ts = [...new Set(all.map(e => e[0]))].filter(x => !(out.undone[id] || []).includes(x)).sort(asc);
      if (ts.length) out.log[id] = ts.map(x => top(all.filter(e => e[0] === x).map(e => [0, canon(e), e]))[2]);
    }
    for (const f of ['missed', 'unmiss', 'hist']) for (const id of keys(f)) out[f][id] = Math.max(...col(f).filter(o => id in o).map(o => o[id]));
    for (const id of Object.keys(out.missed)) if (out.unmiss[id] >= out.missed[id]) delete out.missed[id];
    const runs = col('runs').flat();
    out.runs = [...new Set(runs.map(x => x.t))].sort(asc).slice(-200).map(x => top(runs.filter(q => q.t === x).map(q => [0, canon(q), q]))[2]);
    for (const k of SYNCED) {
      const w = top(ps.map(p => [(p.setAt || {})[k] || 0, canon((p.set || {})[k]) || '', (p.set || {})[k]]));
      if (w[2] !== undefined) out.set[k] = w[2];
      if (w[0]) out.setAt[k] = w[0];
    }
    const x = top([[0, 0], ...ps.map(p => p.xnew || {}).map(q => [q.n || 0, q.extraNew || 0])]);
    out.xnew = {n: x[0], extraNew: x[1]};
    return out;
  };
  // Small id pools and tiny number ranges, so shared keys, equal stamps and shared timestamps happen all the time
  const IDS = ['v:V1:가다:r', 'v:V1:가다:p', 'g:G1', 'a:k3:r', 'st:1:1'];
  const gen = (r, runSpan = 6, runMax = 4) => {
    const n = k => Math.floor(r() * k), some = () => IDS.filter(() => r() < 0.5), p = {};
    const put = (f, make) => { if (r() < 0.85) p[f] = make(); };
    const map = make => () => Object.fromEntries(some().map(id => [id, make()]));
    if (r() < 0.8) p.v = 1 + n(2);
    put('epoch', () => n(3));
    put('cards', map(() => { const c = {s: n(4)}; if (r() < 0.6) c.last = 1000 * n(4); if (r() < 0.4) c.m = 1000 * n(4); if (r() < 0.2) c.susp = true; if (r() < 0.5) c.reps = n(3); return c; }));
    put('log', map(() => Array.from({length: n(5)}, () => { const e = [1 + n(8), 1 + n(4), n(4)]; if (r() < 0.5) e.push(n(3)); return e; }).sort((x, y) => x[0] - y[0])));
    put('undone', map(() => Array.from({length: n(3)}, () => 1 + n(8))));
    put('missed', map(() => 1 + n(5)));
    put('unmiss', map(() => 1 + n(5)));
    put('hist', () => Object.fromEntries([100, 101, 102].filter(() => r() < 0.5).map(d => [d, n(30)])));
    put('runs', () => Array.from({length: n(runMax)}, () => ({t: 1 + n(runSpan), right: n(2)})).sort((x, y) => x.t - y.t));
    const vals = {newPerDay: () => n(12), revPerDay: () => 50 * n(4), newAdded: () => n(12), retention: () => [0.85, 0.9, 0.95][n(3)], vocabDir: () => ['both', 'ko-en', 'en-ko'][n(3)], kb: () => 'auto'};
    put('set', () => Object.fromEntries(Object.keys(vals).filter(() => r() < 0.6).map(k => [k, vals[k]()])));
    put('setAt', () => Object.fromEntries(Object.keys(vals).filter(() => r() < 0.5).map(k => [k, n(3)])));
    put('xnew', () => ({n: 100 + n(3), extraNew: 10 * n(3)}));
    return p;
  };
  const laws = (a, b, c, tag) => {
    const before = JSON.stringify([a, b, c]);
    const ab = mf(a, b), abc = mf(ab, c);
    same(ab, mf(b, a), tag + ': commutative');
    same(abc, mf(a, mf(b, c)), tag + ': associative');
    same(ab, ref([a, b]), tag + ': two payloads match the reference');
    same(abc, ref([c, a, b]), tag + ': three payloads match the reference');
    const aa = mf(a, a);
    same(aa, ref([a]), tag + ': merging a payload with itself gives its normalised copy');
    same(mf(a, {}), aa, tag + ': merging with nothing normalises too');
    same(mf(aa, aa), aa, tag + ': the normalised copy is a fixed point');
    same(mf(ab, a), ab, tag + ': merging in something already merged changes nothing');
    t.ok(JSON.stringify([a, b, c]) === before, tag + ': inputs are not mutated');
    return [ab, abc, aa];
  };
  {
    const r = t.rng(20261110);
    let undoneLeak = 0, shape = 0;
    for (let i = 0; i < 600; i++) {
      for (const m of laws(gen(r), gen(r), gen(r), 'random payloads')) {
        if (canon(Object.keys(m).sort()) !== canon(FIELDS)) shape++;
        for (const id of Object.keys(m.log)) if (!m.log[id].length || m.log[id].some(e => (m.undone[id] || []).includes(e[0]))) undoneLeak++;
      }
    }
    t.eq(shape, 0, 'random payloads: every result has exactly the payload fields');
    t.eq(undoneLeak, 0, 'random payloads: no undone timestamp and no empty list in any merged log');
    // Enough runs to hit the 200 limit from either side
    for (let i = 0; i < 40; i++) laws(gen(r, 450, 170), gen(r, 450, 170), gen(r, 450, 170), 'random payloads with long run histories');
  }

  /* ---------- three devices ---------- */
  // One clock shared by the devices and moving forward on every action: stamps are unique, so "the latest
  // action wins" has one right answer to compare against. Each device works on its own copy between merges.
  const POOL = [...deck.vocab[0].items.slice(0, 3).flatMap(i => [i.id + ':r', i.id + ':p']), 'g:' + deck.units[0].points[0].code, deck.units[0].selftest[0].id, deck.mixups[0].id, 'a:k3:r', 'a:k3:p'];
  const simulate = seed => {
    const r = t.rng(seed), n = k => Math.floor(r() * k), pick = l => l[n(l.length)], tag = 'three devices, seed ' + seed;
    const devs = [0, 1, 2].map(() => ({p: clone(EMPTY), last: null}));
    let now = 20000 * 86400 + n(86400);   // seconds
    const led = [], exp = {cards: {}, undone: {}, set: {}, setAt: {}, add: {}, clear: {}, runs: [], xday: 0};
    const put = (d, id, rec) => { d.p.cards[id] = rec; exp.cards[id] = clone(rec); };
    const ops = {
      grade(d) {
        const id = pick(POOL), o = d.p.cards[id], sb = (o && o.s) || 0, g = 1 + n(4), e = [now, g, sb];
        if (r() < 0.7) e.push(n(40));
        (d.p.log[id] = d.p.log[id] || []).push(e);
        d.last = {id, prev: o ? clone(o) : null, ts: now};
        put(d, id, Object.assign({}, o, {s: g === 1 ? (sb === 2 ? 3 : sb || 1) : g === 2 ? sb || 1 : 2, reps: ((o && o.reps) || 0) + 1, last: now * 1000, m: now * 1000}));
        const day = dayOf(now * 1000); d.p.hist[day] = (d.p.hist[day] || 0) + 1;
        led.push({id, e: e.slice(), live: true});
      },
      undo(d) {
        const u = d.last; if (!u) return; d.last = null;
        put(d, u.id, Object.assign(u.prev || {s: 0}, {m: now * 1000}));
        (d.p.undone[u.id] = d.p.undone[u.id] || []).push(u.ts);
        (exp.undone[u.id] = exp.undone[u.id] || []).push(u.ts);
        d.p.log[u.id] = (d.p.log[u.id] || []).filter(e => e[0] !== u.ts);
        if (!d.p.log[u.id].length) delete d.p.log[u.id];
        led.find(x => x.id === u.id && x.e[0] === u.ts).live = false;
      },
      suspend(d) { const id = pick(POOL), o = Object.assign({s: 0}, d.p.cards[id], {m: now * 1000}); if (o.susp) delete o.susp; else o.susp = true; put(d, id, o); },
      reset(d) { put(d, pick(POOL), {s: 0, m: now * 1000}); },
      setting(d) {
        const k = pick(SYNCED), v = k === 'retention' ? pick([0.85, 0.9, 0.95]) : k === 'vocabDir' ? pick(['both', 'ko-en', 'en-ko']) : n(50);
        d.p.set[k] = exp.set[k] = v; d.p.setAt[k] = exp.setAt[k] = now * 1000;
      },
      miss(d) { const id = pick(POOL); d.p.missed[id] = exp.add[id] = now * 1000; },
      clear(d) { const id = pick(POOL); delete d.p.missed[id]; d.p.unmiss[id] = exp.clear[id] = now * 1000; },
      run(d) { const x = {t: now * 1000, kind: pick(['cloze', 'type', 'listen']), right: n(20), wrong: n(5)}; d.p.runs.push(x); exp.runs.push(clone(x)); },
      more(d) { const day = dayOf(now * 1000); d.p.xnew = {n: day, extraNew: (d.p.xnew.n === day ? d.p.xnew.extraNew : 0) + 10}; exp.xday = day; },
    };
    const menu = [['grade', 45], ['undo', 8], ['suspend', 6], ['reset', 3], ['setting', 6], ['miss', 8], ['clear', 6], ['run', 5], ['more', 3], ['sync', 10]].flatMap(([k, w]) => Array(w).fill(k));
    let tookOther = 0;
    for (let i = 0; i < 400; i++) {
      now += 1 + n(900);
      const op = pick(menu), d = pick(devs);
      if (op !== 'sync') { ops[op](d); continue; }
      const other = pick(devs.filter(x => x !== d)), res = mergeState(d.p, other.p);
      if (res.took !== 'merge') tookOther++;
      d.p = res.data;
      if (r() < 0.5) other.p = clone(res.data);   // half the time the other side takes the result as well
    }
    for (const d of devs) for (const o of devs) if (o !== d) d.p = mf(d.p, o.p);
    const [A, B, C] = devs.map(d => d.p), today = dayOf(now * 1000);
    t.eq(tookOther, 0, tag + ': equal epochs always merge');
    t.ok(canon(A) === canon(B) && canon(B) === canon(C), tag + ': all three devices end canon-equal');
    same(mf(A, mf(B, C)), A, tag + ': merging again changes nothing');
    t.ok(devs.every(d => Object.keys(d.p.undone).every(id => !(d.p.log[id] || []).some(e => d.p.undone[id].includes(e[0])))), tag + ': no undone timestamp in any log');
    const live = led.filter(x => x.live), wantLog = {};
    for (const x of live) (wantLog[x.id] = wantLog[x.id] || []).push(x.e);
    same(A.log, wantLog, tag + ': the log is every review that was not undone, in time order');
    same(A.undone, Object.fromEntries(Object.entries(exp.undone).map(([id, l]) => [id, l.slice().sort((x, y) => x - y)])), tag + ': every undo is remembered');
    same(A.cards, exp.cards, tag + ': each card is as its latest action left it');
    same([A.set, A.setAt], [exp.set, exp.setAt], tag + ': each setting has its latest value');
    same(A.unmiss, exp.clear, tag + ': latest clear time per miss');
    same(A.missed, Object.fromEntries(Object.entries(exp.add).filter(([id, at]) => !(exp.clear[id] >= at))), tag + ': a miss is listed only if it came after its last clear');
    same(A.runs, exp.runs.slice(-200), tag + ': every practice run, in time order');
    t.eq([A.xnew.n, A.xnew.extraNew > 0], exp.xday ? [exp.xday, true] : [0, false], tag + ': extra new cards belong to the latest day they were asked for');
    // What the devices did today, counted the way the page counts while studying
    const did = {newDone: 0, addedDone: 0, revDone: 0, studied: 0, ms: 0, notes: {}};
    for (const {id, e} of live.filter(x => dayOf(x.e[0] * 1000) === today)) {
      if (e[2] === 0) did[id.startsWith('a:') ? 'addedDone' : 'newDone']++;
      if (e[2] === 2) did.revDone++;
      did.studied++; did.ms += (e[3] || 0) * 1000;
      if (/^[va]:/.test(id) && /:[rp]$/.test(id)) did.notes[id.replace(/:[rp]$/, '')] = 1;
    }
    same(dayFromLog(A.log, today, dayOf), did, tag + ': dayFromLog equals the sum of what the devices did today');
    return did.studied;
  };
  {
    let studied = 0;
    for (let seed = 1; seed <= 30; seed++) studied += simulate(seed);
    t.ok(studied > 300, 'three devices: the runs did review cards on their last day', studied);
  }

  /* ---------- mergeState ---------- */
  {
    const old = P({cards: {x: {s: 2, last: 100}}, log: {x: [[1, 3, 0]]}, set: {newPerDay: 5}, setAt: {newPerDay: 50}});
    // The reset device, left un-normalised on purpose (an undone entry still in its log) to show it is copied, not merged
    const fresh = {v: 2, epoch: 1, cards: {y: {s: 1, last: 300}}, log: {y: [[2, 3, 0], [3, 3, 1]]}, undone: {y: [2]}, missed: {}, hist: {}};
    const before = JSON.stringify([old, fresh]);
    const ra = mergeState(fresh, old), rb = mergeState(old, fresh);
    t.eq([ra.took, rb.took], ['a', 'b'], 'mergeState: different epochs → the higher epoch is taken, whichever side it is on');
    t.ok(JSON.stringify(ra.data) === JSON.stringify(fresh) && JSON.stringify(rb.data) === JSON.stringify(fresh), 'mergeState: … untouched, with nothing from the other side');
    for (const x of [ra, rb]) { x.data.cards.y.s = 0; x.data.log.y.push([9, 3, 1]); x.data.undone.y.push(3); }
    t.ok(JSON.stringify([old, fresh]) === before, 'mergeState: … as a deep copy');
    const rf = mergeState(old, fresh, {force: true});
    t.eq(rf.took, 'merge', 'mergeState: force merges across epochs');
    same(rf.data, mf(old, fresh), 'mergeState: forced data is mergeFields');
    same(rf.data, P({epoch: 1, cards: {x: {s: 2, last: 100}, y: {s: 1, last: 300}}, log: {x: [[1, 3, 0]], y: [[3, 3, 1]]}, undone: {y: [2]}, set: {newPerDay: 5}, setAt: {newPerDay: 50}}), 'mergeState: forced merge keeps both sides and the higher epoch');
    t.eq([mergeState(old, fresh, {force: false}).took, mergeState(old, fresh, {}).took], ['b', 'b'], 'mergeState: no force → no merge');
    const peer = P({cards: {z: {s: 1, last: 5}}});
    const eq = mergeState(old, peer);
    t.eq(eq.took, 'merge', 'mergeState: equal epochs merge');
    same(eq.data, mf(old, peer), 'mergeState: equal-epoch data is mergeFields');
    t.eq([mergeState({cards: {}}, {epoch: 0}).took, mergeState({}, {epoch: 2}).took, mergeState({epoch: 3}, {epoch: 2}).took], ['merge', 'b', 'a'], 'mergeState: a missing epoch counts as 0');
    t.eq([mergeState(undefined, old).took, mergeState(fresh, null).took, mergeState(undefined, fresh).took], ['merge', 'a', 'b'], 'mergeState: a missing side counts as empty');
    same(mergeState(undefined, old).data, old, 'mergeState: … and merging with it keeps the other side');
    // A reset spreads: the devices that have not reset adopt it, then all carry on merging at the new epoch
    const devs = [fresh, clone(old), clone(old)].map(p => mf(p, {}));
    devs[1].cards.w = {s: 1, last: 400};   // studied on device 1 before it heard of the reset: gone with the old epoch
    devs[1] = mergeState(devs[1], devs[0]).data; devs[2] = mergeState(devs[0], devs[2]).data;
    t.ok(canon(devs[1]) === canon(devs[0]) && canon(devs[2]) === canon(devs[0]), 'mergeState: after a reset every device ends on the reset copy');
    devs[2].cards.q = {s: 1, last: 500};
    t.eq(mergeState(devs[1], devs[2]).took, 'merge', 'mergeState: … and merges normally from there');
  }

  /* ---------- syncData ---------- */
  {
    const S = {cards: {x: {s: 2, last: 5, ivl: 3}}, set: {newPerDay: 15, revPerDay: 200, vocabDir: 'both', typeEnKo: true, kb: 'auto', koType: true, retention: 0.9, newAdded: 10},
      day: {n: 20400, newDone: 3, addedDone: 0, revDone: 7, extraNew: 10, studied: 12, ms: 9000}, missed: {m1: 5}, open: {'': true}, hist: {20400: 12}, bury: {n: 20400, notes: {a: 1}},
      log: {x: [[5, 3, 0]]}, undone: {x: [4]}, unmiss: {m2: 3}, runs: [{t: 9, right: 1, ids: ['x']}], setAt: {newPerDay: 77, kb: 5}, epoch: 3};
    const before = JSON.stringify(S), p = syncData(S);
    same(p, {v: 2, epoch: 3, cards: S.cards, log: S.log, undone: S.undone, missed: S.missed, unmiss: S.unmiss, hist: S.hist, runs: S.runs,
      set: {newPerDay: 15, revPerDay: 200, retention: 0.9, vocabDir: 'both', newAdded: 10}, setAt: {newPerDay: 77}, xnew: {n: 20400, extraNew: 10}}, 'syncData: the synced part of the state, set limited to SYNCED, xnew from day');
    t.eq(Object.keys(p).sort(), FIELDS, 'syncData: no device-only fields (day, bury, open)');
    t.ok(p.cards !== S.cards && p.cards.x !== S.cards.x && p.log.x[0] !== S.log.x[0] && p.runs[0] !== S.runs[0] && p.runs[0].ids !== S.runs[0].ids && p.hist !== S.hist, 'syncData: nothing is shared with S');
    p.cards.x.s = 0; p.log.x[0][1] = 1; p.runs[0].ids.push('y'); p.set.newPerDay = 1; p.xnew.extraNew = 0;
    t.ok(JSON.stringify(S) === before, 'syncData: changing the payload leaves S alone');
    same(sanitize(syncData(S)), syncData(S), 'syncData: its output passes sanitize unchanged');
    // The state as today's page keeps it: no epoch, undone, unmiss, runs or setAt yet, and day.n = -1 before the first study day
    const old = {cards: {}, set: {newPerDay: 20, revPerDay: 200, vocabDir: 'both', typeEnKo: true, kb: 'auto', koType: true, retention: 0.9, newAdded: 10}, day: {n: -1}, missed: {}, open: {'': true}, hist: {}, bury: {n: -1, notes: {}}, log: {}};
    same(syncData(old), P({set: {newPerDay: 20, revPerDay: 200, retention: 0.9, vocabDir: 'both', newAdded: 10}, xnew: {n: -1, extraNew: 0}}), 'syncData: state saved before syncing existed');
    same(syncData({}), EMPTY, 'syncData: an empty state gives the empty payload');
  }

  /* ---------- sanitize ---------- */
  const NUMS = ['s', 'step', 'due', 'ivl', 'reps', 'last', 'lapses', 'stab', 'diff', 'ease', 'm'], fin = Number.isFinite, within = (v, l) => l.includes(v);
  // An independent statement of what a clean payload is
  const valid = p => canon(Object.keys(p).sort()) === canon(FIELDS) && p.v === 2 && Number.isInteger(p.epoch) && p.epoch >= 0
    && Object.values(p.cards).every(c => within(c.s, [0, 1, 2, 3]) && Object.entries(c).every(([k, v]) => k === 'susp' ? v === true : NUMS.includes(k) && fin(v)))
    && Object.values(p.log).every(l => l.length && l.every((e, i) => (e.length === 3 || e.length === 4) && e.every(fin) && within(e[1], [1, 2, 3, 4]) && within(e[2], [0, 1, 2, 3]) && (e.length < 4 || e[3] >= 0) && (!i || l[i - 1][0] <= e[0])))
    && Object.values(p.undone).every(l => l.length && l.every((x, i) => fin(x) && (!i || l[i - 1] < x)))
    && [p.missed, p.unmiss].every(o => Object.values(o).every(fin))
    && Object.entries(p.hist).every(([k, v]) => /^\d+$/.test(k) && fin(v) && v >= 0)
    && Array.isArray(p.runs) && p.runs.length <= 200 && p.runs.every((x, i) => fin(x.t) && (!i || p.runs[i - 1].t <= x.t))
    && Object.entries(p.set).every(([k, v]) => k === 'retention' ? within(v, [0.85, 0.9, 0.95]) : k === 'vocabDir' ? within(v, ['both', 'ko-en', 'en-ko']) : SYNCED.includes(k) && fin(v) && v >= 0)
    && Object.entries(p.setAt).every(([k, v]) => SYNCED.includes(k) && fin(v)) && fin(p.xnew.n) && fin(p.xnew.extraNew) && Object.keys(p.xnew).length === 2;
  const unsafeKeys = v => !v || typeof v !== 'object' ? 0 : Object.keys(v).reduce((s, k) => s + (['__proto__', 'constructor', 'prototype'].includes(k) ? 1 : 0) + unsafeKeys(v[k]), 0);
  {
    t.eq([null, undefined, 5, 'x', true, [], [{cards: {}}]].map(sanitize), [null, null, null, null, null, null, null], 'sanitize: null for anything that is not a plain object');
    same(sanitize({}), EMPTY, 'sanitize: an empty object gives the full empty payload');
    same(sanitize({cards: [{s: 1}], log: [[[1, 3, 0]]], undone: [[1]], missed: [5], unmiss: [5], hist: [3], runs: {0: {t: 1}}, set: [20], setAt: [20], xnew: [1, 2]}), EMPTY, 'sanitize: a list where a map belongs (or the reverse) is dropped');
    same(sanitize({cards: 'x', log: 5, undone: null, missed: true, unmiss: 'y', hist: 0, runs: 'z', set: 1, setAt: 2, xnew: 3}), EMPTY, 'sanitize: so is anything else of the wrong kind');

    // JSON.parse makes __proto__ an ordinary own key, which is how it would arrive from a file or the network
    const evil = JSON.parse(`{"__proto__": {"polluted": 1}, "constructor": {"prototype": {"polluted": 1}},
      "cards": {"__proto__": {"s": 1, "polluted": 1}, "constructor": {"s": 1}, "prototype": {"s": 1}, "ok": {"s": 1, "__proto__": {"m": 5}}},
      "log": {"__proto__": [[1, 3, 0]], "ok": [[1, 3, 0]]}, "undone": {"constructor": [1], "ok": [2]}, "missed": {"__proto__": 5, "constructor": 6, "fine": 7}, "unmiss": {"prototype": 5},
      "hist": {"__proto__": 3, "20000": 4}, "set": {"__proto__": {"newPerDay": 5}}, "setAt": {"__proto__": {"newPerDay": 5}}, "xnew": {"__proto__": {"n": 9}},
      "runs": [{"t": 1, "__proto__": {"polluted": 1}, "deep": {"constructor": {"x": 1}, "prototype": 2, "keep": [{"__proto__": 3, "z": 1}]}}]}`);
    const s = sanitize(evil);
    same(s, P({cards: {ok: {s: 1}}, log: {ok: [[1, 3, 0]]}, undone: {ok: [2]}, missed: {fine: 7}, hist: {20000: 4}, runs: [{t: 1, deep: {keep: [{z: 1}]}}]}), 'sanitize: __proto__, constructor and prototype keys are skipped at every level');
    t.eq(unsafeKeys(s), 0, 'sanitize: none of those keys is left anywhere');
    t.ok(({}).polluted === undefined && s.polluted === undefined && s.cards.polluted === undefined && s.cards.s === undefined && s.cards.ok.m === undefined && s.runs[0].polluted === undefined && s.xnew.n === 0 && s.set.newPerDay === undefined,
      'sanitize: no prototype was replaced on the way');
    const m = mf(evil, evil);
    t.eq([m.cards, m.log, m.undone, m.missed, m.unmiss, m.hist].map(o => Object.keys(o)), [['ok'], ['ok'], ['ok'], ['fine'], [], ['20000']], 'mergeFields: skips those ids too, even on data that was never sanitized');
    t.ok(m.cards.polluted === undefined && m.cards.s === undefined && ({}).polluted === undefined, 'mergeFields: … and replaces no prototype either');

    const bad = {v: 7, epoch: 2.5, junk: 1, kind: 'x', day: {n: 5}, bury: {}, open: {},
      cards: {good: {s: 2, step: 1, due: 20400, ivl: 3, reps: 4, last: 1e12, lapses: 1, stab: 3.2, diff: 5.5, ease: 2.5, m: 1e12 + 5, susp: true},
        extra: {s: 1, last: 5, junk: 'x', note: {a: 1}, susp: 'yes', due: '5', ivl: null, stab: Infinity, diff: NaN, reps: [3]},
        zero: {s: 0, susp: false}, badS: {s: 4, last: 1}, negS: {s: -1}, fracS: {s: 1.5}, strS: {s: '2'}, noS: {last: 5}, list: [1], nul: null, num: 7, str: 'card'},
      log: {a: [[30, 3, 2, 12], [10, 1, 0], [20, 5, 0], [21, 0, 1], [22, 3, 4], [23, 3], [24, 3, 1, 2, 9], ['25', 3, 1], [26, 3, 1, 'x'], [27, 2.5, 1], [28, 3, 1, -4], [NaN, 3, 1], null, 'x', {0: 1, 1: 3, 2: 1}],
        b: 'nope', c: [[1, 9, 9]], d: [], e: {0: [1, 3, 0]}, f: [[40, 4, 3, 0], [35, 2, 2, 1.5]]},
      undone: {a: [5, 'x', 3, 5, null, NaN, Infinity], b: [], c: 'x', d: {0: 1}},
      missed: {ok: 5, bad: 'x', nul: null, inf: Infinity, obj: {}}, unmiss: {ok: 1, list: [2]},
      hist: {20400: 5, 20401: -1, 20402: 'x', abc: 3, '-5': 2, '1.5': 2},
      runs: [{t: 30, right: 1}, {t: 'x'}, null, 5, [1], {right: 3}, {t: 10, list: [1, {a: 2}]}],
      set: {newPerDay: -1, revPerDay: '200', retention: 0.8, vocabDir: 'sideways', newAdded: 12, kb: 'on', typeEnKo: true},
      setAt: {newPerDay: 5, newAdded: 'x', kb: 9, retention: 3},
      xnew: {n: 'x', extraNew: 10, other: 1}};
    const before = JSON.stringify(bad), got = sanitize(bad);
    same(got, {v: 2, epoch: 0,
      cards: {good: bad.cards.good, extra: {s: 1, last: 5}, zero: {s: 0}},
      log: {a: [[10, 1, 0], [26, 3, 1], [28, 3, 1], [30, 3, 2, 12]], f: [[35, 2, 2, 1.5], [40, 4, 3, 0]]},
      undone: {a: [3, 5]}, missed: {ok: 5}, unmiss: {ok: 1}, hist: {20400: 5},
      runs: [{t: 10, list: [1, {a: 2}]}, {t: 30, right: 1}],
      set: {newAdded: 12}, setAt: {newPerDay: 5, retention: 3}, xnew: {n: 0, extraNew: 10}}, 'sanitize: wrong types, out-of-range values and unknown fields are dropped, the rest kept and put in order');
    t.ok(valid(got), 'sanitize: the cleaned payload is valid');
    t.ok(JSON.stringify(bad) === before, 'sanitize: its input is not mutated');
    got.cards.good.s = 0; got.runs[0].list[1].a = 9; got.log.a[0][1] = 4;
    t.ok(JSON.stringify(bad) === before, 'sanitize: the result is a deep copy');
    for (const epoch of [0, 1, 7]) t.eq(sanitize({epoch}).epoch, epoch, 'sanitize: epoch ' + epoch + ' kept');
    for (const epoch of [-1, 1.5, '3', null, Infinity]) t.eq(sanitize({epoch}).epoch, 0, 'sanitize: epoch ' + String(epoch) + ' → 0');
    for (const s of [0, 1, 2, 3]) same(sanitize({cards: {x: {s}}}).cards, {x: {s}}, 'sanitize: card state ' + s + ' kept');
    for (const g of [1, 2, 3, 4]) same(sanitize({log: {x: [[1, g, 0]]}}).log, {x: [[1, g, 0]]}, 'sanitize: grade ' + g + ' kept');
    for (const v of [0.85, 0.9, 0.95]) same(sanitize({set: {retention: v}}).set, {retention: v}, 'sanitize: retention ' + v + ' kept');
    for (const v of ['both', 'ko-en', 'en-ko']) same(sanitize({set: {vocabDir: v}}).set, {vocabDir: v}, 'sanitize: vocabDir ' + v + ' kept');
    for (const v of [0.8, 0.90001, 1, '0.9', null]) same(sanitize({set: {retention: v}}).set, {}, 'sanitize: retention ' + String(v) + ' dropped');
    for (const v of ['en', 'BOTH', '', 1, null]) same(sanitize({set: {vocabDir: v}}).set, {}, 'sanitize: vocabDir ' + String(v) + ' dropped');
    for (const k of ['newPerDay', 'revPerDay', 'newAdded']) {
      same([0, 20, 9999].map(v => sanitize({set: {[k]: v}}).set[k]), [0, 20, 9999], 'sanitize: ' + k + ' ≥ 0 kept');
      same([-1, '20', null, NaN, Infinity, [20]].map(v => k in sanitize({set: {[k]: v}}).set), [false, false, false, false, false, false], 'sanitize: bad ' + k + ' dropped');
    }
    t.eq(sanitize({runs: Array.from({length: 260}, (_, i) => ({t: 260 - i}))}).runs.map(x => x.t), Array.from({length: 200}, (_, i) => 61 + i), 'sanitize: runs sorted and cut to the newest 200');

    // A version-1 backup, as the page's Backup button writes it today, on real card ids
    const [w1, w2] = deck.vocab[0].items, gp = 'g:' + deck.units[0].points[0].code;
    const v1 = {kind: 'korean-flashcards', v: 1, at: '2026-11-01T10:00:00.000Z',
      cards: {[w1.id + ':r']: {s: 2, reps: 3, last: 1762000000000, stab: 4.13, diff: 5.28, ivl: 4, due: 20397}, [w1.id + ':p']: {s: 1, step: 1, reps: 2, last: 1762000300000, due: 1762000900000, stab: 2.3, diff: 6.4},
        [w2.id + ':r']: {s: 0, susp: true}, [gp]: {s: 3, step: 0, reps: 9, lapses: 2, last: 1762000400000, due: 1762001000000, ivl: 12, ease: 2.3}},
      missed: {[deck.mixups[0].id]: 1761990000000}, hist: {20393: 14, 20394: 31},
      log: {[w1.id + ':r']: [[1761900000, 3, 0], [1761900600, 3, 1], [1762000000, 3, 2]], [gp]: [[1762000400, 1, 2]]}};
    const clean = sanitize(v1);
    same(clean, P({cards: v1.cards, missed: v1.missed, hist: v1.hist, log: v1.log}), 'sanitize: a version-1 backup is accepted whole and becomes a version-2 payload');
    t.ok(valid(clean), 'sanitize: … which is valid');
    same(mergeState(clean, EMPTY, {force: true}).data, clean, 'sanitize: … and restores into an empty device unchanged');
  }
  {
    // Damage random payloads at random places: sanitize must never throw, must always return a valid payload,
    // and whatever it returns must merge
    const r = t.rng(99), n = k => Math.floor(r() * k);
    const JUNK = [null, 'x', -1, 1.5, 5, true, NaN, Infinity, [], {}, [[]], [null], {a: 1}, [1, 2, 3], '__proto__', [[1, 3, 0]], {t: 3}, 1e15, {s: 1}];
    const wreck = v => r() < 0.12 ? JUNK[n(JUNK.length)]
      : Array.isArray(v) ? v.map(wreck) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [r() < 0.03 ? 'constructor' : k, wreck(x)])) : v;
    let threw = 0, invalid = 0, unstable = 0, lost = 0, leaks = 0, prev = EMPTY;
    for (let i = 0; i < 500; i++) {
      const p = gen(r), w = wreck(p);
      try {
        const s = sanitize(w), ok = sanitize(mf(p, p));
        if (s === null) { if (w !== null && typeof w === 'object' && !Array.isArray(w)) invalid++; continue; }
        if (!valid(s)) invalid++;
        if (canon(sanitize(s)) !== canon(s)) unstable++;
        if (canon(ok) !== canon(mf(p, p)) || !valid(ok)) lost++;     // clean data goes through untouched
        leaks += unsafeKeys(s);
        const m = mf(s, prev);
        if (!valid(m) || canon(sanitize(m)) !== canon(m) || canon(m) !== canon(mf(prev, s))) invalid++;
        prev = s;
      } catch (e) { threw++; }
    }
    t.eq([threw, invalid, unstable, lost, leaks], [0, 0, 0, 0, 0], 'sanitize on 500 damaged payloads: never throws, always valid, stable, keeps clean data, merges cleanly');
  }

  /* ---------- dayFromLog ---------- */
  {
    const D0 = 20400, at = (day, sec) => day * 86400 + sec;
    const log = {
      'v:V1:가다:r': [[at(D0 - 1, 100), 3, 0, 5], [at(D0, 10), 3, 1, 7], [at(D0, 700), 3, 1]],
      'v:V1:가다:p': [[at(D0, 50), 1, 0, 12]],
      'v:V2:오다:r': [[at(D0 - 2, 5), 3, 2, 9]],
      'a:k3:p': [[at(D0, 60), 3, 0, 3], [at(D0, 90), 4, 2, 2]],
      'g:G1': [[at(D0 - 3, 1), 3, 0], [at(D0, 300), 2, 2, 20], [at(D0, 400), 1, 3, 1]],
      'st:1:1': [[at(D0, 20), 3, 0, 1.5]],
      'ab:1': [[at(D0, 30), 3, 0]],        // not an added-deck id: those start with a:
      'x:G1:r': [[at(D0, 31), 3, 2]],      // ends like a word card but is not one: no note
      'v:V9:q': [[at(D0, 32), 3, 1]],      // a word id without a direction: no note
    };
    const before = JSON.stringify(log), zero = {newDone: 0, addedDone: 0, revDone: 0, studied: 0, ms: 0, notes: {}};
    same(dayFromLog(log, D0, dayOf), {newDone: 3, addedDone: 1, revDone: 3, studied: 11, ms: 46500, notes: {'v:V1:가다': 1, 'a:k3': 1}}, 'dayFromLog: new (lesson vs added deck), reviews, studied, time and notes seen today');
    same(dayFromLog(log, D0 - 2, dayOf), {newDone: 0, addedDone: 0, revDone: 1, studied: 1, ms: 9000, notes: {'v:V2:오다': 1}}, 'dayFromLog: a card whose latest entry is on the asked day');
    same(dayFromLog(log, D0 - 1, dayOf), zero, 'dayFromLog: it walks back from the end, so it only sees a day that is each card\'s latest');
    same(dayFromLog(log, D0 + 1, dayOf), zero, 'dayFromLog: nothing studied yet');
    same([dayFromLog({}, D0, dayOf), dayFromLog(undefined, D0, dayOf), dayFromLog({x: []}, D0, dayOf)], [zero, zero, zero], 'dayFromLog: empty or missing log');
    t.ok(JSON.stringify(log) === before, 'dayFromLog: the log is not mutated');
    // The page's day starts at 4am: dayOf decides, not the function
    const at4 = ms => Math.floor((ms - 4 * 36e5) / DAY), night = {'g:G1': [[at(D0, 3 * 3600), 3, 0, 4]], 'g:G2': [[at(D0, 5 * 3600), 3, 2, 6]]};
    t.eq([dayFromLog(night, D0 - 1, at4).newDone, dayFromLog(night, D0, at4).newDone, dayFromLog(night, D0, at4).revDone, dayFromLog(night, D0, dayOf).studied], [1, 0, 1, 2], 'dayFromLog: the day boundary comes from dayOf');
    // Every real word: studying either direction marks its note, and only word cards have notes
    const words = deck.vocab.flatMap(set => set.items), real = {};
    words.forEach((w, i) => { real[w.id + (i % 2 ? ':r' : ':p')] = [[at(D0, i), 3, 0, 2]]; });
    const rest = [...deck.units.flatMap(u => [...u.points.map(p => 'g:' + p.code), ...u.points.flatMap(p => p.examples.map(x => x.id)), ...u.selftest.map(x => x.id)]),
      ...deck.workbook.flatMap(part => part.groups.flatMap(g => g.items.map(x => x.id))), ...deck.mixups.map(x => x.id), ...deck.mistakes.map(x => x.id)];
    for (const id of rest) real[id] = [[at(D0, 1), 3, 2]];
    const d = dayFromLog(real, D0, dayOf);
    t.ok(words.length > 100 && rest.length > 100 && Object.keys(real).length === words.length + rest.length, 'dayFromLog: the real deck has words and other cards, all with different ids');
    t.eq(Object.keys(d.notes).sort(), words.map(w => w.id).sort(), 'dayFromLog: notes are exactly the real deck\'s word ids');
    t.eq([d.newDone, d.addedDone, d.revDone, d.studied, d.ms], [words.length, 0, rest.length, words.length + rest.length, words.length * 2000], 'dayFromLog: counts over the real deck');
  }
}
