/* ==== PURE:num ==== */
const NUM = (() => {
  const DIG = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], UNIT = ['', '십', '백', '천'];
  const ONE = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'], SHORT = ['', '한', '두', '세', '네'];
  const TEN = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
  const DAY = ['하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레', '열흘'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // counter, English noun, its plural when irregular, a second word that is just as right
  const CTR = [['개', 'thing'], ['명', 'person', 'people', '사람'], ['마리', 'animal'], ['잔', 'cup'], ['병', 'bottle'], ['권', 'book'], ['장', 'sheet'], ['대', 'car'], ['번', 'time']];
  const SPAN = {minute: 59, hour: 12, day: 10, week: 4, month: 6};
  const DROP = [10, 100, 1000, 10000, 11000, 110000];
  const KINDS = [{key: 'sino', label: 'Sino-Korean numbers'}, {key: 'count', label: 'Counting things'}, {key: 'time', label: 'Clock times'},
    {key: 'date', label: 'Dates'}, {key: 'price', label: 'Prices'}, {key: 'age', label: 'Age'}, {key: 'duration', label: 'Durations'}];

  const need = (n, lo, hi) => { if (!Number.isInteger(n) || n < lo || n > hi) throw new RangeError(`NUM: ${n} is outside ${lo}–${hi}`); return n; };
  // One 4-digit group. keep bit i-1 writes the 일 that is normally dropped before 십 (i = 1), 백 (2), 천 (3)
  const group = (n, keep) => [3, 2, 1, 0].map(i => { const d = Math.floor(n / 10 ** i) % 10; return d ? (d === 1 && i && !((keep >> (i - 1)) & 1) ? '' : DIG[d]) + UNIT[i] : ''; }).join('');
  // keep = 0 is the standard reading. Other values put dropped 일s back (bits 0–2 low group, 3 만, 4–6 만 group): the 일만/일천 traps
  const say = (n, keep = 0) => {
    const hi = Math.floor(n / 1e4), lo = n % 1e4;
    return [hi ? (hi === 1 && !(keep & 8) ? '' : group(hi, keep >> 4)) + '만' : '', group(lo, keep)].filter(Boolean).join(' ') || '영';
  };
  const sino = n => say(need(n, 0, 99999999));
  const native = n => TEN[Math.floor(need(n, 1, 99) / 10)] + ONE[n % 10];
  const nativeMod = n => need(n, 1, 99) === 20 ? '스무' : TEN[Math.floor(n / 10)] + (SHORT[n % 10] || ONE[n % 10]);
  // The word that shortens before a counter, as [full, short]; falsy when nothing changes
  const change = n => n === 20 ? ['스물', '스무'] : SHORT[n % 10] && [ONE[n % 10], SHORT[n % 10]];
  const month = m => (m === 6 ? '유' : m === 10 ? '시' : sino(m)) + '월';

  const strip = s => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, '').replace(/[\p{P}\p{S}]+$/u, '');
  const fmt = n => String(n).replace(/\B(?=(\d{3})+$)/g, ','), pl = n => n === 1 ? '' : 's';
  // parts: lists of [text, why]; no why = correct. Taking one entry from each part gives an answer
  // (the first entries make the canonical one) or, if any entry has a why, a trap explained by the first why.
  const mk = (kind, q, rule, ...parts) => {
    let all = [['', '']];
    for (const p of parts) all = all.flatMap(([a, w]) => p.filter(Boolean).map(([b, v]) => [a && b ? a + ' ' + b : a + b, w || v]));
    const answers = [], traps = {}, seen = new Set();
    for (const [s, w] of all) if (!w && !seen.has(strip(s))) { seen.add(strip(s)); answers.push(s); }
    for (const [s, w] of all) if (w && !seen.has(strip(s))) { seen.add(strip(s)); traps[strip(s)] = w; }
    return {kind, q, ko: answers[0], answers, traps, rule};
  };
  const noIl = ko => `10, 100, 1,000 and 10,000 are 십, 백, 천, 만 with no 일 in front: ${ko}.`;
  // Every way of writing back an 일 that the standard reading drops: 일만, 일천, 만 일천 …
  const ilTraps = (n, tail) => Array.from({length: 127}, (_, k) => [say(n, k + 1) + tail, noIl(say(n) + tail)]);
  // Trap entry for the full native word where the short one is needed: 셋 잔, 스물 살
  const full = (n, ko, tail = '') => { const c = change(n); return c && [native(n) + tail, `Before a counter, ${c[0]} becomes ${c[1]}: ${ko}.`]; };

  const BUILD = {
    sino(n) {
      const ko = sino(n), hi = Math.floor(n / 1e4), lo = n % 1e4;
      return mk('sino', fmt(n), ko !== say(n, 127) ? noIl(ko)
        : hi ? `Big numbers are grouped by 만 (10,000): ${hi}만${lo ? ' ' + fmt(lo) : ''} is ${ko}.`
        : n > 9 ? `Say each digit with its unit (천, 백, 십) and skip zeros: ${ko}.` : 'Sino-Korean 0 to 9: 영 일 이 삼 사 오 육 칠 팔 구.',
        [[ko], ...ilTraps(n, ''), n > 0 && n < 100 && [native(n), `That is the native number; the Sino-Korean one is ${ko}.`]]);
    },
    count(n, c) {
      const [, one, many = one + 's', alt] = CTR[need(CTR.findIndex(x => x[0] === c), 0, CTR.length - 1)], ko = `${nativeMod(n)} ${c}`;
      // From about 20 up Koreans also say the Sino number with a counter, so that reason is worded more softly
      const why = c === '번' ? `${sino(n)} 번 means "number ${n}"; ${n} time${pl(n)} is ${ko}.`
        : n < 20 ? `Counters like ${c} take native numbers: ${ko}.`
        : `Counters are taught with native numbers: ${ko} (${sino(n)} ${c} is also heard for larger numbers).`;
      return mk('count', `${n} ${n === 1 ? one : many} (${c})`, `Counters take native numbers; 하나, 둘, 셋, 넷 shorten to 한, 두, 세, 네, and 20 is 스무: ${ko}.`,
        [[nativeMod(n)], [sino(n), why], full(n, ko)], [[c], alt && [alt]]);
    },
    time(h, m) {
      const H = nativeMod(need(h, 1, 12)) + ' 시', M = sino(need(m, 0, 59)) + ' 분', ko = m ? `${H} ${M}` : H, mw = `Minutes use Sino-Korean numbers: ${M}.`;
      return mk('time', `${h}:${String(m).padStart(2, '0')}`,
        (m ? `Hours use native numbers, minutes use Sino-Korean: ${ko}.` : `Hours use native numbers: ${ko}.`) + (m === 30 ? ` Half past is also ${H} 반.` : ''),
        [[H], [sino(h) + ' 시', `Hours use native numbers: ${H}, not ${sino(h)} 시.`], full(h, H, ' 시'), [nativeMod(h) + ' 시간', `시간 is a length of time; o'clock is 시: ${H}.`]],
        m ? [[M], m === 30 && ['반'], [nativeMod(m) + ' 분', mw], [native(m) + ' 분', mw]] : [['']]);
    },
    date(m, d) {
      const mo = month(need(m, 1, 12)), bad = sino(m) + '월', day = sino(need(d, 1, DIM[m - 1])) + ' 일', dw = `Days of the month use Sino-Korean numbers: ${day}.`;
      return mk('date', `${MONTH[m - 1]} ${d}`, `Dates use Sino-Korean numbers; only 6월 (유월) and 10월 (시월) are irregular: ${mo} ${day}.`,
        [[mo], mo !== bad && [bad, `${m}월 is ${mo}, not ${bad}.`]], [[day], [nativeMod(d) + ' 일', dw], [native(d) + ' 일', dw]]);
    },
    price: n => mk('price', fmt(n) + ' won', `Prices use Sino-Korean numbers${n < 1e4 ? '' : ', counted in 만 (10,000s)'}: ${sino(n)} 원.`, [[sino(n) + ' 원'], ...ilTraps(n, ' 원')]),
    age(n) {
      const a = nativeMod(n) + ' 살', b = sino(n) + ' 세', bw = `세 goes with Sino-Korean numbers: ${b} (or ${a}).`;
      return mk('age', `${n} year${pl(n)} old`, `Age is native number + 살 (${a}); the formal form is Sino-Korean + 세 (${b}).`,
        [[a], [b], full(n, a, ' 살'), [sino(n) + ' 살', `살 goes with native numbers: ${a} (or ${b}).`], [nativeMod(n) + ' 세', bw], [native(n) + ' 세', bw]]);
    },
    duration(n, u) {
      const S = sino(need(n, 1, +SPAN[u] || 0)), N = nativeMod(n), q = `${n} ${u}${pl(n)}`, d = (...p) => mk('duration', q, ...p);
      if (u === 'minute') { const w = `Minutes take Sino-Korean numbers: ${S} 분.`; return d(w, [[S + ' 분'], [N + ' 분', w], [native(n) + ' 분', w]]); }
      if (u === 'hour') return d(`A number of hours is native number + 시간: ${N} 시간.`,
        [[N + ' 시간'], [S + ' 시간', `시간 takes native numbers: ${N} 시간.`], full(n, N + ' 시간', ' 시간'), [N + ' 시', `${N} 시 is ${n} o'clock; a length of ${q} is ${N} 시간.`]]);
      if (u === 'day') {
        // 사흘 … 열흘 are accepted too: less common than 삼 일 … 십 일, but correct
        const ko = n > 2 ? S + ' 일' : DAY[n - 1], rule = n > 2 ? `From 3 days up, the usual way is Sino-Korean number + 일: ${ko}.` : n > 1 ? 'Two days is 이틀 (이 일 is also fine).' : 'One day is 하루.';
        return d(rule, [[ko], n > 1 && [S + ' 일'], [DAY[n - 1]], n === 1 && ['일 일', 'One day is normally 하루, not 일 일.'], [N + ' 일', rule], [native(n) + ' 일', rule]]);
      }
      // 주 goes with either number set (이 주, 두 주), so the native form is accepted, not a trap
      if (u === 'week') return d(n === 1 ? 'One week is 일주일.' : `Weeks are Sino-Korean number + 주 (or 주일): ${S} 주.`, [[n === 1 ? '일주일' : S + ' 주'], [S + ' 주'], [S + ' 주일'], [N + ' 주']]);
      const a = N + ' 달', b = S + ' 개월', bw = `개월 goes with Sino-Korean numbers: ${b} (or ${a}).`;
      return d(`A number of months is native number + 달 (${a}) or Sino-Korean + 개월 (${b}).`,
        [[a], [b], n === 3 && ['석 달'], n === 4 && ['넉 달'], [S + ' 달', `달 goes with native numbers: ${a} (or ${b}).`], full(n, a, ' 달'), [N + ' 개월', bw], [native(n) + ' 개월', bw],
          [month(n), `${month(n)} is the month ${MONTH[n - 1]}; a length of ${q} is ${a} or ${b}.`]]);
    },
  };

  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  // A len-digit number with extra 0s and 1s, the digits the reading rules are about
  const digits = (r, len) => { let n = 0; for (let i = 0; i < len; i++) { const x = r(); n = n * 10 + (x < (i ? .3 : 0) ? 0 : x < (i ? .5 : .2) ? 1 : int(r, 2, 9)); } return n; };
  const PICK = {
    sino: r => { const x = r(); return [x < .2 ? pick(r, DROP) : digits(r, x < .4 ? int(r, 1, 2) : x < .6 ? 3 : x < .8 ? 4 : int(r, 5, 6))]; },
    count: r => { const x = r(); return [x < .1 ? 20 : x < .55 ? int(r, 1, 10) : int(r, 11, 30), pick(r, CTR)[0]]; },
    time: r => { const x = r(); return [int(r, 1, 12), x < .15 ? 0 : x < .3 ? 30 : x < .85 ? 5 * int(r, 1, 11) : int(r, 1, 59)]; },
    date: r => { const m = r() < .25 ? pick(r, [6, 10]) : int(r, 1, 12); return [m, int(r, 1, DIM[m - 1])]; },
    price: r => { const x = r(); return [x < .1 ? 100 * int(r, 5, 9) : digits(r, 2) * (x < .45 ? 100 : x < .85 ? 1e3 : 1e4)]; },
    age: r => [r() < .08 ? 20 : int(r, 1, 99)],
    duration: r => { const u = pick(r, Object.keys(SPAN)); return [u === 'minute' ? (r() < .3 ? int(r, 1, 9) : 5 * int(r, 2, 11)) : int(r, 1, SPAN[u]), u]; },
  };

  // item('time', 3, 45), item('count', 3, '잔'), item('duration', 2, 'hour') …: the item for exact values; make() draws the values
  const item = (kind, ...a) => BUILD[kind](...a);
  const make = (kind, rng) => item(kind, ...PICK[kind](rng));
  const check = (it, typed) => {
    const t = strip(typed), ok = it.answers.some(a => strip(a) === t);
    return {ok, trap: !ok && Object.prototype.hasOwnProperty.call(it.traps, t) ? it.traps[t] : undefined};
  };
  return {sino, native, nativeMod, KINDS, make, check, item};
})();
/* ==== END:num ==== */
