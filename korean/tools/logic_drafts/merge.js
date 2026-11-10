/* ==== PURE:merge ==== */
const MERGE = (() => {
  const SYNCED = ['newPerDay', 'revPerDay', 'retention', 'vocabDir', 'newAdded'];
  const UNSAFE = ['__proto__', 'constructor', 'prototype'];
  const CARDNUM = ['s', 'step', 'due', 'ivl', 'reps', 'last', 'lapses', 'stab', 'diff', 'ease', 'm'];
  const fin = Number.isFinite, int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi, count = v => fin(v) && v >= 0;
  const SETOK = {newPerDay: count, revPerDay: count, newAdded: count, retention: v => [0.85, 0.9, 0.95].includes(v), vocabDir: v => ['both', 'ko-en', 'en-ko'].includes(v)};
  const isObj = v => Object.prototype.toString.call(v) === '[object Object]';
  const arr = v => Array.isArray(v) ? v : [];
  // Entries of a plain object, minus the keys that could reach a prototype; anything else reads as empty
  const ents = o => isObj(o) ? Object.entries(o).filter(([k]) => !UNSAFE.includes(k)) : [];
  const copy = v => JSON.parse(JSON.stringify(v));
  const uniq = l => [...new Set(l)].sort((x, y) => x - y);
  const max = (x, y) => Math.max(x, y), cat = (x, y) => [...arr(x), ...arr(y)];

  // Written out by hand: an object rebuilt in sorted order would still list its number-like keys first
  const canon = v => {
    if (Array.isArray(v)) return '[' + v.map(x => canon(x) || 'null').join(',') + ']';
    if (!v || typeof v !== 'object') return JSON.stringify(v);
    const out = [];
    for (const k of Object.keys(v).sort()) { const s = canon(v[k]); if (s !== undefined) out.push(JSON.stringify(k) + ':' + s); }
    return '{' + out.join(',') + '}';
  };
  const stampOf = o => (o && (o.m || o.last)) || 0;
  // Higher stamp wins; equal stamps fall back to the canonical text, so every device keeps the same one
  const newer = (x, sx, y, sy) => sx !== sy ? (sx > sy ? x : y) : (canon(x) || '') < (canon(y) || '') ? y : x;
  // Keys of both sides; pick settles the ones they share
  const union = (x, y, pick) => {
    const m = new Map(ents(x));
    for (const [k, v] of ents(y)) m.set(k, m.has(k) ? pick(m.get(k), v) : v);
    return m;
  };
  // One entry per key, oldest first
  const byKey = (l, key) => {
    const m = new Map();
    for (const e of l) { const k = key(e); m.set(k, m.has(k) ? newer(m.get(k), 0, e, 0) : e); }
    return [...m.values()].sort((x, y) => key(x) - key(y));
  };

  // Every rule takes a maximum or a union, so the order and the number of merges cannot change the result
  const mergeFields = (a, b) => {
    a = a || {}; b = b || {};
    const out = {v: 2, epoch: max(a.epoch || 0, b.epoch || 0), cards: Object.fromEntries(union(a.cards, b.cards, (x, y) => newer(x, stampOf(x), y, stampOf(y)))),
      log: {}, undone: {}, missed: {}, unmiss: {}, hist: Object.fromEntries(union(a.hist, b.hist, max)),
      runs: byKey(cat(a.runs, b.runs).filter(isObj), r => r.t).slice(-200), set: {}, setAt: {}};
    const undone = union(a.undone, b.undone, cat), unmiss = union(a.unmiss, b.unmiss, max);
    for (const [id, l] of undone) if (arr(l).length) out.undone[id] = uniq(arr(l));
    for (const [id, l] of union(a.log, b.log, cat)) {
      const gone = new Set(arr(undone.get(id))), keep = byKey(arr(l).filter(Array.isArray), e => e[0]).filter(e => !gone.has(e[0]));
      if (keep.length) out.log[id] = keep;
    }
    out.unmiss = Object.fromEntries(unmiss);
    // A miss stays only while it is newer than the last time it was cleared
    for (const [id, t] of union(a.missed, b.missed, max)) if (!(unmiss.get(id) >= t)) out.missed[id] = t;
    for (const k of SYNCED) {
      const sa = (a.setAt || {})[k] || 0, sb = (b.setAt || {})[k] || 0, v = newer((a.set || {})[k], sa, (b.set || {})[k], sb);
      if (v !== undefined) out.set[k] = v;
      // No stamp and a stamp of 0 mean the same, so only a real one is written
      if (max(sa, sb)) out.setAt[k] = max(sa, sb);
    }
    const xa = a.xnew || {}, xb = b.xnew || {}, na = xa.n || 0, nb = xb.n || 0;
    out.xnew = na !== nb ? {n: max(na, nb), extraNew: (na > nb ? xa : xb).extraNew || 0} : {n: na, extraNew: max(xa.extraNew || 0, xb.extraNew || 0)};
    return copy(out);
  };
  // A reset raises the epoch: the higher epoch replaces the other side instead of merging with it
  const mergeState = (a, b, {force} = {}) => {
    a = a || {}; b = b || {};
    const ea = a.epoch || 0, eb = b.epoch || 0;
    return ea === eb || force === true ? {data: mergeFields(a, b), took: 'merge'} : ea > eb ? {data: copy(a), took: 'a'} : {data: copy(b), took: 'b'};
  };
  const syncData = S => {
    const synced = o => Object.fromEntries(SYNCED.filter(k => o && o[k] !== undefined).map(k => [k, o[k]]));
    const day = S.day || {};
    return copy({v: 2, epoch: S.epoch || 0, cards: S.cards || {}, log: S.log || {}, undone: S.undone || {}, missed: S.missed || {}, unmiss: S.unmiss || {},
      hist: S.hist || {}, runs: S.runs || [], set: synced(S.set), setAt: synced(S.setAt), xnew: {n: day.n || 0, extraNew: day.extraNew || 0}});
  };

  // A run's own fields are open-ended, so they are copied as they come, without the unsafe keys
  const safe = v => Array.isArray(v) ? v.map(safe) : isObj(v) ? Object.fromEntries(ents(v).map(([k, x]) => [k, safe(x)])) : v;
  const sanitize = d => {
    if (!isObj(d)) return null;
    const nums = o => Object.fromEntries(ents(o).filter(([, v]) => fin(v)));
    const x = isObj(d.xnew) ? d.xnew : {};
    const out = {v: 2, epoch: int(d.epoch, 0, Infinity) ? d.epoch : 0, cards: {}, log: {}, undone: {}, missed: nums(d.missed), unmiss: nums(d.unmiss),
      hist: Object.fromEntries(ents(d.hist).filter(([k, v]) => /^\d+$/.test(k) && count(v))),
      runs: arr(d.runs).filter(r => isObj(r) && fin(r.t)).map(safe).sort((p, q) => p.t - q.t).slice(-200),
      set: {}, setAt: {}, xnew: {n: fin(x.n) ? x.n : 0, extraNew: fin(x.extraNew) ? x.extraNew : 0}};
    for (const [id, c] of ents(d.cards)) {
      if (!isObj(c) || !int(c.s, 0, 3)) continue;
      const rec = out.cards[id] = {};
      for (const k of CARDNUM) if (fin(c[k])) rec[k] = c[k];
      if (c.susp === true) rec.susp = true;
    }
    for (const [id, l] of ents(d.log)) {
      // A bad time-spent goes on its own: the review it belongs to is still good
      const keep = arr(l).filter(e => Array.isArray(e) && (e.length === 3 || e.length === 4) && fin(e[0]) && int(e[1], 1, 4) && int(e[2], 0, 3))
        .map(e => e.slice(0, count(e[3]) ? 4 : 3)).sort((p, q) => p[0] - q[0]);
      if (keep.length) out.log[id] = keep;
    }
    for (const [id, l] of ents(d.undone)) { const keep = uniq(arr(l).filter(fin)); if (keep.length) out.undone[id] = keep; }
    for (const k of SYNCED) {
      if (isObj(d.set) && SETOK[k](d.set[k])) out.set[k] = d.set[k];
      if (isObj(d.setAt) && fin(d.setAt[k])) out.setAt[k] = d.setAt[k];
    }
    return out;
  };

  // Today's counters rebuilt from the log, which is the part of the day that merges
  const dayFromLog = (log, today, dayOf) => {
    const d = {newDone: 0, addedDone: 0, revDone: 0, studied: 0, ms: 0, notes: {}};
    for (const [id, list] of ents(log)) {
      const l = arr(list), added = id.startsWith('a:'), note = /^(v|a):.*:[rp]$/.test(id);
      for (let i = l.length - 1; i >= 0 && dayOf(l[i][0] * 1000) === today; i--) {
        const e = l[i];
        if (e[2] === 0) d[added ? 'addedDone' : 'newDone']++;
        else if (e[2] === 2) d.revDone++;
        d.studied++; d.ms += (e[3] || 0) * 1000;
        if (note) d.notes[id.slice(0, -2)] = 1;
      }
    }
    return d;
  };

  return {SYNCED, canon, stampOf, mergeFields, mergeState, syncData, sanitize, dayFromLog};
})();
/* ==== END:merge ==== */
