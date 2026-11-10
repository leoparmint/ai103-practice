/* ==== PURE:stats ==== */
const STATS = (() => {
  const GRADES = ['again', 'hard', 'good', 'easy'], MATURE = 21;   // days of interval, Anki's line between young and mature
  const arr = v => Array.isArray(v) ? v : [];
  const cmp = (x, y) => x < y ? -1 : x > y ? 1 : 0;
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  // G6 sorts before G51: digits are padded so they compare as numbers
  const natural = c => String(c).replace(/\d+/g, d => d.padStart(8, '0'));
  // f(entry, cardId) for every entry at or after since (left out: all of them); ids narrows it to those cards, each read once
  const each = (log, since = -Infinity, f, ids) => {
    log = log || {};
    for (const id of ids ? new Set(ids) : Object.keys(log)) for (const e of arr(log[id])) if (Array.isArray(e) && e[0] >= since && GRADES[e[1] - 1]) f(e, id);
  };

  const daily = (log, hist, dayOf) => {
    const n = new Map();
    each(log, -Infinity, e => bump(n, dayOf(e[0] * 1000)));
    // hist and the log count the same reviews, so the larger one is the day's total, never their sum
    for (const [d, v] of Object.entries(hist || {})) if (v > (n.get(+d) || 0)) n.set(+d, v);
    return Object.fromEntries(n);
  };
  const streak = (daily, today) => {
    // A day with nothing studied yet does not end the run that reached yesterday
    let n = 0, d = daily[today] > 0 ? today : today - 1;
    while (daily[d] > 0) { n++; d--; }
    return n;
  };
  const count = (daily, today, days) => Object.entries(daily).reduce((n, [d, v]) => d <= today && d > today - days ? n + v : n, 0);

  const retention = (log, sinceSec) => {
    let n = 0, ok = 0;
    each(log, sinceSec, e => { if (e[2] === 2) { n++; if (e[1] > 1) ok++; } });
    return {n, ok, rate: n ? ok / n : null};
  };
  const gradeMix = (log, sinceSec) => {
    const mix = [0, 0, 0, 0];
    each(log, sinceSec, e => { mix[e[1] - 1]++; });
    return mix;
  };
  const session = (log, ids, sinceSec) => {
    const out = {n: 0, again: 0, hard: 0, good: 0, easy: 0, secs: 0};
    each(log, sinceSec, e => { out.n++; out[GRADES[e[1] - 1]]++; out.secs += e[3] || 0; }, arr(ids));
    return out;
  };

  const forecast = (cards, today, days, dayOf) => {
    const out = Array.from({length: days}, () => 0);
    for (const c of Object.values(cards || {})) {
      if (!c || c.susp || !c.s) continue;
      // Whatever is overdue is waiting today
      const i = Math.max(0, Math.floor((c.s === 2 ? c.due : dayOf(c.due)) - today));
      if (i < out.length) out[i]++;
    }
    return out;
  };
  const stage = c => !c ? 'new' : c.susp ? 'suspended' : !c.s ? 'new' : c.s !== 2 ? 'learning' : (c.ivl || 0) < MATURE ? 'young' : 'mature';
  const breakdown = (metas, cards) => {
    cards = cards || {};
    // A Map until the end: a category can be an imported deck's name, so any text at all
    const out = new Map();
    for (const {id, cat} of arr(metas)) {
      if (!out.has(cat)) out.set(cat, {new: 0, learning: 0, young: 0, mature: 0, suspended: 0, total: 0});
      const b = out.get(cat);
      b[stage(cards[id])]++; b.total++;
    }
    return Object.fromEntries(out);
  };

  const weak = (items, log, cards, runMisses, sinceSec) => {
    cards = cards || {};
    const again = new Map(), reviews = new Map(), misses = new Map(), byCode = new Map(), out = [];
    each(log, sinceSec, (e, id) => { bump(reviews, id); if (e[1] === 1) bump(again, id); });
    for (const id of arr(runMisses)) bump(misses, id);
    // A set of cards per code, so a card or a code listed twice still counts once
    for (const it of arr(items)) for (const code of arr(it.codes)) byCode.set(code, (byCode.get(code) || new Set()).add(it.id));
    for (const [code, ids] of byCode) {
      const w = {code, again: 0, reviews: 0, lapses: 0, misses: 0};
      for (const id of ids) { w.again += again.get(id) || 0; w.reviews += reviews.get(id) || 0; w.lapses += (cards[id] || {}).lapses || 0; w.misses += misses.get(id) || 0; }
      w.score = 2 * w.again + w.lapses + 1.5 * w.misses;
      if (w.score > 0) out.push(w);
    }
    return out.sort((a, b) => b.score - a.score || b.again - a.again || cmp(natural(a.code), natural(b.code)) || cmp(a.code, b.code));
  };

  return {daily, streak, count, retention, gradeMix, forecast, breakdown, weak, session};
})();
/* ==== END:stats ==== */
