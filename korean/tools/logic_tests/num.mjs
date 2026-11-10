// Tests for PURE:num, the numbers / time / dates drill.   node korean/tools/test_logic.mjs num
//
// The tables are hand-checked standard readings. The parsers further down are a second route from
// Hangul back to the number, written separately from NUM's own tables so a slip there cannot hide.

const SINO = [
  [0, '영'], [1, '일'], [10, '십'], [11, '십일'], [15, '십오'], [20, '이십'], [99, '구십구'],
  [100, '백'], [101, '백일'], [105, '백오'], [110, '백십'], [111, '백십일'],
  [1000, '천'], [1001, '천일'], [1010, '천십'], [1100, '천백'], [1111, '천백십일'], [2030, '이천삼십'], [9999, '구천구백구십구'],
  [10000, '만'], [10001, '만 일'], [11000, '만 천'], [15000, '만 오천'], [20000, '이만'], [25000, '이만 오천'],
  [100000, '십만'], [110000, '십일만'], [123456, '십이만 삼천사백오십육'], [210000, '이십일만'],
  [1000000, '백만'], [99999999, '구천구백구십구만 구천구백구십구'],
  // beyond the required list: 일 is kept inside a 만-group, dropped before 천 even at ten million
  [16, '십육'], [10010, '만 십'], [10100, '만 백'], [11111, '만 천백십일'], [100001, '십만 일'], [111111, '십일만 천백십일'],
  [310000, '삼십일만'], [1010000, '백일만'], [10000000, '천만'], [11110000, '천백십일만'], [50000000, '오천만'],
];
// n, standalone word, form before a counter
const NATIVE = [
  [1, '하나', '한'], [2, '둘', '두'], [3, '셋', '세'], [4, '넷', '네'], [5, '다섯', '다섯'], [6, '여섯', '여섯'], [7, '일곱', '일곱'],
  [8, '여덟', '여덟'], [9, '아홉', '아홉'], [10, '열', '열'], [11, '열하나', '열한'], [12, '열둘', '열두'], [13, '열셋', '열세'], [14, '열넷', '열네'],
  [20, '스물', '스무'], [21, '스물하나', '스물한'], [22, '스물둘', '스물두'], [23, '스물셋', '스물세'], [24, '스물넷', '스물네'],
  [30, '서른', '서른'], [31, '서른하나', '서른한'], [40, '마흔', '마흔'], [50, '쉰', '쉰'], [60, '예순', '예순'], [70, '일흔', '일흔'],
  [80, '여든', '여든'], [90, '아흔', '아흔'], [99, '아흔아홉', '아흔아홉'],
  [15, '열다섯', '열다섯'], [19, '열아홉', '열아홉'], [25, '스물다섯', '스물다섯'], [44, '마흔넷', '마흔네'], [62, '예순둘', '예순두'],
];

// ---- Parsers: Hangul → number, NaN for anything that is not a well-formed numeral
const DIG = {일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9}, UNIT = {십: 10, 백: 100, 천: 1000};
function parseGroup(s) {
  let n = 0, d = 0, last = 1e4;
  for (const ch of s) {
    if (DIG[ch]) { if (d) return NaN; d = DIG[ch]; }
    else if (UNIT[ch]) { if (UNIT[ch] >= last) return NaN; last = UNIT[ch]; n += (d || 1) * UNIT[ch]; d = 0; }
    else return NaN;
  }
  return n + d;
}
function parseSino(s) {
  if (typeof s !== 'string' || !s) return NaN;
  if (s === '영') return 0;
  const parts = s.split('만');
  if (parts.length === 1) return parseGroup(s);
  if (parts.length > 2) return NaN;
  return (parts[0] ? parseGroup(parts[0]) : 1) * 1e4 + parseGroup(parts[1].replace(/^ /, ''));
}
const N1 = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'], M1 = ['한', '두', '세', '네', ...N1.slice(4)];
const N10 = ['열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
function parseNative(s, ones = N1) {
  if (typeof s !== 'string') return NaN;
  const ti = N10.findIndex(w => s.startsWith(w)), rest = ti < 0 ? s : s.slice(N10[ti].length), oi = ones.indexOf(rest);
  return rest && oi < 0 ? NaN : (ti + 1) * 10 + oi + 1 || NaN;
}
const parseMod = s => s === '스무' ? 20 : s === '스물' ? NaN : parseNative(s, M1);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_KO = ['일월', '이월', '삼월', '사월', '오월', '유월', '칠월', '팔월', '구월', '시월', '십일월', '십이월'];
const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const NOUN = {개: ['thing', 'things'], 명: ['person', 'people'], 마리: ['animal', 'animals'], 잔: ['cup', 'cups'], 병: ['bottle', 'bottles'],
  권: ['book', 'books'], 장: ['sheet', 'sheets'], 대: ['car', 'cars'], 번: ['time', 'times']};
const DAY_KO = ['하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레', '열흘'];
const SPAN = {minute: 59, hour: 12, day: 10, week: 4, month: 6};
const KEYS = ['sino', 'count', 'time', 'date', 'price', 'age', 'duration'];

export default async function (pure, t) {
  const { NUM } = pure;
  const strip = s => s.replace(/\s+/g, '');
  const str = v => typeof v === 'string' && v.length > 0;
  const num = q => +String(q).replace(/,/g, '');
  const throws = f => { try { f(); return false; } catch (e) { return true; } };
  const tally = (list, key) => { const m = {}; for (const x of list) m[key(x)] = (m[key(x)] || 0) + 1; return m; };
  // First few n in lo..hi for which bad(n) holds; [] means the property holds everywhere
  const firstBad = (lo, hi, bad) => { const out = []; for (let n = lo; n <= hi && out.length < 5; n++) if (bad(n)) out.push(n); return out; };

  /* ---------- sino, native, nativeMod: fixed tables ---------- */
  for (const [n, ko] of SINO) t.eq(NUM.sino(n), ko, `sino(${n})`);
  for (const [n, word, mod] of NATIVE) { t.eq(NUM.native(n), word, `native(${n})`); t.eq(NUM.nativeMod(n), mod, `nativeMod(${n})`); }

  /* ---------- sino, native, nativeMod: properties over ranges ---------- */
  const spaces = n => n >= 1e4 && n % 1e4 ? 1 : 0;
  const sinoBad = n => {
    const s = NUM.sino(n);
    return /일십|일백|일천|^일만/.test(s) || s.split(' ').length - 1 !== spaces(n) || !/^[가-힣]+( [가-힣]+)?$/.test(s) || parseSino(s) !== n;
  };
  t.eq(firstBad(0, 99999, n => /일십|일백|일천|^일만/.test(NUM.sino(n))), [], 'sino 0–99,999: no 일십, 일백, 일천, no leading 일만');
  t.eq(firstBad(0, 99999, n => NUM.sino(n).split(' ').length - 1 !== spaces(n)), [], 'sino 0–99,999: one space at the 만 boundary, none elsewhere');
  t.eq(firstBad(0, 99999, n => !/^[가-힣]+( [가-힣]+)?$/.test(NUM.sino(n))), [], 'sino 0–99,999: Hangul only, no stray spaces');
  t.eq(firstBad(0, 99999, n => parseSino(NUM.sino(n)) !== n), [], 'sino 0–99,999: parses back to the same number');
  const rnd = t.rng(20261110), big = [1e5, 999999, 1e6, 1e7 - 1, 1e7, 10010001, 11111111, 99999999];
  for (let i = 0; i < 20000; i++) big.push(Math.floor(rnd() * 1e8));
  t.eq(big.filter(sinoBad).slice(0, 5), [], 'sino up to 99,999,999: same four properties on 20,000 seeded numbers and the edges');
  t.eq(firstBad(1, 9999, n => NUM.sino(n * 1e4 + 1) !== (n === 1 ? '' : NUM.sino(n)) + '만 일'), [], 'sino: the 만-group reads like the number itself, bare 만 only when it is 1');

  t.eq(firstBad(1, 99, n => parseNative(NUM.native(n)) !== n), [], 'native 1–99: parses back to the same number');
  t.eq(firstBad(1, 99, n => parseMod(NUM.nativeMod(n)) !== n), [], 'nativeMod 1–99: parses back to the same number');
  t.eq(firstBad(1, 99, n => (NUM.native(n) !== NUM.nativeMod(n)) !== (n === 20 || (n % 10 >= 1 && n % 10 <= 4))), [], 'nativeMod differs from native exactly for 20 and numbers ending in 1–4');
  t.eq(firstBad(1, 99, n => /(하나|둘|셋|넷|스물)$|[석넉]/.test(NUM.nativeMod(n))), [], 'nativeMod never ends in 하나/둘/셋/넷/스물 and never uses 석/넉');
  t.eq(firstBad(1, 99, n => !/^[가-힣]+$/.test(NUM.native(n) + NUM.nativeMod(n))), [], 'native words have no spaces');

  for (const bad of [-1, 1e8, 1.5, NaN, Infinity, '5', null, undefined]) t.ok(throws(() => NUM.sino(bad)), `sino(${bad}) is out of range and throws`);
  for (const bad of [0, 100, -3, 2.5, '3', undefined]) {
    t.ok(throws(() => NUM.native(bad)), `native(${bad}) is out of range and throws`);
    t.ok(throws(() => NUM.nativeMod(bad)), `nativeMod(${bad}) is out of range and throws`);
  }

  /* ---------- KINDS ---------- */
  t.eq(NUM.KINDS.map(k => k.key), KEYS, 'KINDS: keys in the agreed order');
  t.ok(NUM.KINDS.every(k => str(k.label) && Object.keys(k).length === 2), 'KINDS: each entry is {key, label}');

  /* ---------- make(): 300 seeded items per kind ---------- */
  const gen = {};
  KEYS.forEach((kind, i) => {
    const rng = t.rng(1000 + i), items = gen[kind] = [];
    for (let j = 0; j < 300; j++) {
      const it = NUM.make(kind, rng), at = `${kind} #${j} "${it.q}"`;
      items.push(it);
      t.eq(Object.keys(it).sort(), ['answers', 'kind', 'ko', 'q', 'rule', 'traps'], `${at}: item shape`);
      t.ok(it.kind === kind, `${at}: kind`);
      t.ok(str(it.q) && /^[\x20-\x7e]+$/.test(kind === 'count' ? it.q.replace(/\([가-힣]+\)$/, '()') : it.q), `${at}: prompt is digits and English`);
      t.ok(it.answers.includes(it.ko) && it.answers[0] === it.ko, `${at}: ko is among the answers, and first`, it.answers);
      t.ok(NUM.check(it, it.ko).ok === true, `${at}: ko is accepted`);
      t.ok(NUM.check(it, strip(it.ko)).ok === true, `${at}: ko without spaces is accepted`);
      t.eq(it.answers.filter(a => /[0-9A-Za-z]/.test(a) || !/^[가-힣]+( [가-힣]+)*$/.test(a)), [], `${at}: answers are Hangul words with single spaces, no digits or Latin`);
      t.eq(it.answers.filter(a => !NUM.check(it, a).ok || !NUM.check(it, strip(a)).ok || !NUM.check(it, `  ${a}. `).ok), [], `${at}: every answer is accepted, spaced or not`);
      const good = new Set(it.answers.map(strip));
      t.ok(good.size === it.answers.length, `${at}: no answer listed twice`, it.answers);
      const keys = Object.keys(it.traps);
      t.eq(keys.filter(k => good.has(k)), [], `${at}: no trap is an accepted answer`);
      t.eq(keys.filter(k => !/^[가-힣]+$/.test(k)), [], `${at}: trap keys are Hangul with the spaces removed`);
      t.eq(keys.filter(k => { const r = NUM.check(it, k); return r.ok !== false || !str(r.trap) || r.trap !== it.traps[k]; }), [], `${at}: every trap is rejected with its reason`);
      t.eq(keys.filter(k => !/^[\x20-\x7e가-힣–]+[.]$/.test(it.traps[k]) || !/[가-힣]/.test(it.traps[k])), [], `${at}: trap reasons are one English sentence naming the Korean`);
      t.ok(str(it.rule) && it.rule.includes(it.ko) && /\.$/.test(it.rule) && !/\n/.test(it.rule), `${at}: rule is one line that shows the answer`, it.rule);
      const miss = NUM.check(it, it.ko + ' 아니에요');
      t.ok(miss.ok === false && miss.trap === undefined && Object.keys(miss).length === 2, `${at}: other wrong text is rejected without a reason`, miss);
    }
    t.eq(items, Array.from({length: 300}, (r => () => NUM.make(kind, r))(t.rng(1000 + i))), `${kind}: the same seed gives the same items`);
    for (const edge of [() => 0, () => 1 - 2 ** -53, () => 0.5]) {
      const it = NUM.make(kind, edge);
      t.ok(it.kind === kind && NUM.check(it, it.ko).ok, `${kind}: make() copes with an rng stuck at ${edge()}`, it);
    }
  });

  /* ---------- Each kind: the prompt read back independently must agree with the answer ---------- */
  for (const it of gen.sino) {
    const n = num(it.q);
    t.ok(it.q === n.toLocaleString('en-US') && Number.isInteger(n) && n >= 1 && n <= 999999, `sino "${it.q}": a number 1–999,999 with thousands commas`);
    t.ok(parseSino(it.ko) === n && it.ko === NUM.sino(n), `sino "${it.q}": ${it.ko} reads back as the number`);
    t.eq(it.answers, [it.ko], `sino "${it.q}": one accepted reading`);
  }
  const sinoNs = gen.sino.map(it => num(it.q));
  for (const [lo, hi] of [[1, 99], [100, 999], [1000, 9999], [10000, 999999]])
    t.ok(sinoNs.filter(n => n >= lo && n <= hi).length >= 40, `sino: ${lo}–${hi} is well represented`, sinoNs.filter(n => n >= lo && n <= hi).length);
  for (const n of [10, 100, 1000, 10000, 11000, 110000])
    t.ok(sinoNs.filter(x => x === n).length >= 4, `sino: ${n} comes up regularly`, sinoNs.filter(x => x === n).length);
  t.ok(gen.sino.filter(it => Object.keys(it.traps).some(k => /일[십백천만]/.test(k))).length >= 120, 'sino: 일-dropping is exercised in a large share of items');
  t.ok(sinoNs.filter(n => n > 100 && /0\d/.test(String(n))).length >= 40, 'sino: skipped zero places are exercised too');

  for (const it of gen.count) {
    const m = /^(\d+) ([a-z]+) \(([가-힣]+)\)$/.exec(it.q) || [], n = +m[1], c = m[3], [word, ctr, more] = it.ko.split(' ');
    t.ok(n >= 1 && n <= 30 && NOUN[c] && m[2] === NOUN[c][n === 1 ? 0 : 1], `count "${it.q}": n 1–30, a known counter, noun agrees in number`);
    t.ok(ctr === c && more === undefined && parseMod(word) === n && word === NUM.nativeMod(n), `count "${it.q}": ${it.ko} is the short native form + counter`);
    t.eq(it.answers, c === '명' ? [it.ko, word + ' 사람'] : [it.ko], `count "${it.q}": accepted answers`);
    t.ok(str(it.traps[strip(NUM.sino(n)) + c]), `count "${it.q}": the Sino form is a trap`);
    t.ok(NUM.native(n) === word ? true : str(it.traps[NUM.native(n) + c]), `count "${it.q}": the unshortened native form is a trap`);
  }
  const ctrs = tally(gen.count, it => it.ko.split(' ')[1]), countNs = gen.count.map(it => parseInt(it.q, 10));
  t.ok(Object.keys(NOUN).every(c => ctrs[c] >= 15), 'count: all nine counters come up', ctrs);
  t.ok(countNs.filter(n => n === 20).length >= 15 && countNs.filter(n => n <= 4).length >= 30 && countNs.filter(n => n > 20).length >= 30 && countNs.includes(1) && countNs.includes(30),
    'count: 한/두/세/네, 스무 and the twenties all come up');

  for (const it of gen.time) {
    const m = /^(\d{1,2}):(\d\d)$/.exec(it.q) || [], h = +m[1], min = +m[2], k = /^([가-힣]+) 시(?: ([가-힣]+) 분)?$/.exec(it.ko) || [];
    t.ok(h >= 1 && h <= 12 && min >= 0 && min <= 59 && m[1] === String(h), `time "${it.q}": a 12-hour clock time`);
    t.ok(parseMod(k[1]) === h && (min ? parseSino(k[2]) === min : k[2] === undefined), `time "${it.q}": ${it.ko} is native hour + Sino minutes, no minutes on the hour`);
    t.eq(it.answers, min === 30 ? [it.ko, k[1] + ' 시 반'] : [it.ko], `time "${it.q}": accepted answers (반 only at :30)`);
    t.ok(!/오전|오후|전$|정각/.test(it.answers.join(' ')), `time "${it.q}": no 오전/오후/전`);
    t.ok(str(it.traps[NUM.sino(h) + '시' + (min ? NUM.sino(min) + '분' : '')]), `time "${it.q}": Sino hours are a trap`);
    t.ok(!min || str(it.traps[k[1] + '시' + NUM.nativeMod(min) + '분']), `time "${it.q}": native minutes are a trap`);
  }
  const mins = tally(gen.time, it => +it.q.split(':')[1]), hours = tally(gen.time, it => +it.q.split(':')[0]);
  t.ok(Array.from({length: 12}, (_, i) => i * 5).every(m => mins[m] >= 1), 'time: :00, :05 … :55 all come up', mins);
  t.ok(mins[0] >= 25 && mins[30] >= 25, 'time: on the hour and half past come up often', {0: mins[0], 30: mins[30]});
  const odd = Object.keys(mins).filter(m => m % 5).reduce((a, m) => a + mins[m], 0);
  t.ok(odd >= 15 && odd <= 90, 'time: a few odd minutes, not most', odd);
  t.ok(Array.from({length: 12}, (_, i) => i + 1).every(h => hours[h] >= 5), 'time: every hour 1–12 comes up', hours);

  for (const it of gen.date) {
    const m = /^([A-Z][a-z]+) (\d+)$/.exec(it.q) || [], mo = MONTHS.indexOf(m[1]) + 1, d = +m[2], k = /^([가-힣]+) ([가-힣]+) 일$/.exec(it.ko) || [];
    t.ok(mo >= 1 && d >= 1 && d <= DIM[mo - 1], `date "${it.q}": a real month and a day that month has`);
    t.ok(k[1] === MONTH_KO[mo - 1] && parseSino(k[2]) === d, `date "${it.q}": ${it.ko} is the month name + Sino day + 일`);
    t.eq(it.answers, [it.ko], `date "${it.q}": one accepted answer`);
    const wrong = {6: '육월', 10: '십월'}[mo], hit = Object.keys(it.traps).filter(key => /^(육월|십월)/.test(key));
    t.ok(wrong ? str(it.traps[wrong + k[2] + '일']) : hit.length === 0, `date "${it.q}": 육월/십월 trap exactly for June and October`, hit);
  }
  const months = tally(gen.date, it => it.q.split(' ')[0]);
  t.ok(MONTHS.every(m => months[m] >= 8), 'date: every month comes up', months);
  t.ok(months.June >= 30 && months.October >= 30, 'date: 유월 and 시월 come up often', months);
  t.ok(gen.date.some(it => +it.q.split(' ')[1] === 31) && gen.date.some(it => +it.q.split(' ')[1] === 1), 'date: days run from 1 to 31');

  for (const it of gen.price) {
    const m = /^([\d,]+) won$/.exec(it.q) || [], n = num(m[1]);
    t.ok(m[1] === n.toLocaleString('en-US') && n >= 500 && n <= 990000 && n % 100 === 0 && (n < 1e4 || n % 1000 === 0), `price "${it.q}": 500–990,000 won, round`);
    t.ok(it.ko === NUM.sino(n) + ' 원' && parseSino(it.ko.slice(0, -2)) === n, `price "${it.q}": ${it.ko} is the Sino number + 원`);
    t.eq(it.answers, [it.ko], `price "${it.q}": one accepted answer`);
    t.ok(!/^[만천백]/.test(it.ko) || str(it.traps['일' + strip(it.ko)]), `price "${it.q}": 일만/일천/일백 is a trap`);
  }
  const prices = gen.price.map(it => num(it.q.split(' ')[0]));
  for (const [lo, hi] of [[500, 900], [1000, 9900], [10000, 99000], [100000, 990000]])
    t.ok(prices.filter(n => n >= lo && n <= hi).length >= 15, `price: ${lo}–${hi} won comes up`, prices.filter(n => n >= lo && n <= hi).length);
  t.ok(gen.price.filter(it => Object.keys(it.traps).length).length >= 60, 'price: amounts with a dropped 일 (만, 천, 만 오천 …) come up often');

  for (const it of gen.age) {
    const m = /^(\d+) years? old$/.exec(it.q) || [], n = +m[1], word = it.ko.replace(/ 살$/, '');
    t.ok(n >= 1 && n <= 99 && it.q === `${n} year${n === 1 ? '' : 's'} old`, `age "${it.q}": 1–99`);
    t.ok(it.ko === word + ' 살' && parseMod(word) === n, `age "${it.q}": ${it.ko} is the short native form + 살`);
    t.eq(it.answers, [it.ko, NUM.sino(n) + ' 세'], `age "${it.q}": Sino + 세 is accepted too`);
    t.ok(str(it.traps[NUM.sino(n) + '살']) && str(it.traps[word + '세']), `age "${it.q}": 살 with Sino and 세 with native are traps`);
    t.ok(NUM.native(n) === word ? true : str(it.traps[NUM.native(n) + '살']), `age "${it.q}": the unshortened native form is a trap`);
  }
  t.ok(gen.age.filter(it => it.q === '20 years old').length >= 10, 'age: 스무 살 comes up regularly');

  for (const it of gen.duration) {
    const m = /^(\d+) (minute|hour|day|week|month)(s?)$/.exec(it.q) || [], n = +m[1], u = m[2], S = n >= 1 && n <= 59 ? NUM.sino(n) : '?', N = n >= 1 && n <= 59 ? NUM.nativeMod(n) : '?';
    t.ok(n >= 1 && n <= SPAN[u] && (m[3] === '') === (n === 1), `duration "${it.q}": unit, range and plural`);
    const want = u === 'minute' ? [S + ' 분'] : u === 'hour' ? [N + ' 시간']
      : u === 'day' ? (n === 1 ? ['하루'] : n === 2 ? ['이틀', '이 일'] : [S + ' 일', DAY_KO[n - 1]])
      : u === 'week' ? (n === 1 ? ['일주일', '일 주', '한 주'] : [S + ' 주', S + ' 주일', N + ' 주'])
      : [N + ' 달', S + ' 개월', ...(n === 3 ? ['석 달'] : n === 4 ? ['넉 달'] : [])];
    t.eq(it.answers, want, `duration "${it.q}": accepted answers`);
  }
  const units = tally(gen.duration, it => it.q.replace(/^\d+ |s$/g, ''));
  t.ok(Object.keys(SPAN).every(u => units[u] >= 30), 'duration: minutes, hours, days, weeks and months all come up', units);
  for (const q of ['1 day', '2 days', '1 week', '2 weeks', '1 month', '1 hour']) t.ok(gen.duration.some(it => it.q === q), `duration: "${q}" comes up`);

  /* ---------- Fixed examples ---------- */
  // args for NUM.item, prompt, canonical answer, other accepted answers, wrong answers that must come back with a reason
  const ex = (args, q, ko, also = [], traps = []) => {
    const it = NUM.item(...args), at = `item(${args.join(', ')})`;
    t.eq(it.q, q, `${at}: prompt`);
    t.eq(it.ko, ko, `${at}: answer`);
    t.eq(it.answers, [ko, ...also], `${at}: accepted answers`);
    for (const a of [ko, ...also]) t.ok(NUM.check(it, a).ok && NUM.check(it, strip(a)).ok, `${at}: accepts ${a}`);
    for (const x of traps) { const r = NUM.check(it, x); t.ok(r.ok === false && str(r.trap), `${at}: ${x} is a trap with a reason`, r); }
    return it;
  };
  ex(['sino', 1250], '1,250', '천이백오십', [], ['일천이백오십']);
  ex(['sino', 25], '25', '이십오', [], ['스물다섯']);
  ex(['sino', 10], '10', '십', [], ['일십', '열']);
  ex(['sino', 100], '100', '백', [], ['일백']);
  ex(['sino', 1000], '1,000', '천', [], ['일천']);
  ex(['sino', 10000], '10,000', '만', [], ['일만']);
  ex(['sino', 11000], '11,000', '만 천', [], ['일만 천', '만 일천', '일만 일천']);
  ex(['sino', 110000], '110,000', '십일만', [], ['일십일만']);
  ex(['sino', 2030], '2,030', '이천삼십');
  ex(['sino', 210000], '210,000', '이십일만');
  t.eq(NUM.item('sino', 210000).traps, {}, 'sino 210,000: 이십일만 keeps its 일, so there is nothing to trap');

  const cups = ex(['count', 3, '잔'], '3 cups (잔)', '세 잔', [], ['삼 잔', '셋 잔']);
  t.eq(cups.traps['삼잔'], 'Counters like 잔 take native numbers: 세 잔.', 'count 3 cups: reason for 삼 잔');
  ex(['count', 2, '명'], '2 people (명)', '두 명', ['두 사람'], ['이 명', '둘 명', '이 사람', '둘 사람']);
  ex(['count', 1, '명'], '1 person (명)', '한 명', ['한 사람'], ['일 명', '하나 명']);
  ex(['count', 1, '개'], '1 thing (개)', '한 개', [], ['하나 개', '일 개']);
  ex(['count', 4, '마리'], '4 animals (마리)', '네 마리', [], ['넷 마리', '사 마리']);
  ex(['count', 5, '권'], '5 books (권)', '다섯 권', [], ['오 권']);
  ex(['count', 10, '장'], '10 sheets (장)', '열 장', [], ['십 장']);
  ex(['count', 12, '병'], '12 bottles (병)', '열두 병', [], ['열둘 병', '십이 병']);
  ex(['count', 20, '개'], '20 things (개)', '스무 개', [], ['스물 개', '이십 개']);
  ex(['count', 21, '대'], '21 cars (대)', '스물한 대', [], ['스물하나 대']);
  ex(['count', 30, '번'], '30 times (번)', '서른 번', [], ['삼십 번']);
  t.ok(!NUM.check(cups, '석 잔').ok, 'count: 석/넉 forms are not generated or accepted for counters');

  const t345 = ex(['time', 3, 45], '3:45', '세 시 사십오 분', [], ['삼 시 사십오 분', '세 시 마흔다섯 분', '삼 시 마흔다섯 분', '셋 시 사십오 분', '세 시간 사십오 분']);
  t.eq(t345.rule, 'Hours use native numbers, minutes use Sino-Korean: 세 시 사십오 분.', 'time 3:45: rule line');
  t.eq(ex(['time', 3, 0], '3:00', '세 시', [], ['삼 시', '셋 시', '세 시간']).rule, 'Hours use native numbers: 세 시.', 'time 3:00: rule line has no minutes');
  t.eq(ex(['time', 3, 30], '3:30', '세 시 삼십 분', ['세 시 반'], ['삼 시 반', '세 시 서른 분']).rule,
    'Hours use native numbers, minutes use Sino-Korean: 세 시 삼십 분. Half past is also 세 시 반.', 'time 3:30: rule line mentions 반');
  ex(['time', 1, 0], '1:00', '한 시', [], ['일 시', '하나 시']);
  ex(['time', 12, 5], '12:05', '열두 시 오 분', [], ['십이 시 오 분', '열둘 시 오 분', '열두 시 다섯 분']);
  ex(['time', 11, 11], '11:11', '열한 시 십일 분', [], ['십일 시 십일 분', '열한 시 열한 분']);
  ex(['time', 9, 10], '9:10', '아홉 시 십 분', [], ['구 시 십 분', '아홉 시 열 분']);
  ex(['time', 4, 20], '4:20', '네 시 이십 분', [], ['네 시 스무 분', '네 시 스물 분', '사 시 이십 분']);
  t.ok(!NUM.check(NUM.item('time', 3, 45), '세 시 반').ok && !NUM.check(NUM.item('time', 3, 0), '세 시 반').ok, 'time: 반 is right only at :30');

  const jun = ex(['date', 6, 10], 'June 10', '유월 십 일', [], ['육월 십 일', '육월십일']);
  t.ok(/^6월 is 유월, not 육월/.test(jun.traps['육월십일']), 'date June 10: reason for 육월', jun.traps);
  const oct = ex(['date', 10, 3], 'October 3', '시월 삼 일', [], ['십월 삼 일']);
  t.ok(/^10월 is 시월, not 십월/.test(oct.traps['십월삼일']), 'date October 3: reason for 십월', oct.traps);
  ex(['date', 11, 11], 'November 11', '십일월 십일 일');
  ex(['date', 12, 25], 'December 25', '십이월 이십오 일');
  ex(['date', 1, 1], 'January 1', '일월 일 일');
  ex(['date', 6, 6], 'June 6', '유월 육 일', [], ['육월 육 일']);
  ex(['date', 6, 16], 'June 16', '유월 십육 일');
  ex(['date', 10, 10], 'October 10', '시월 십 일', [], ['십월 십 일']);
  ex(['date', 10, 31], 'October 31', '시월 삼십일 일');
  ex(['date', 2, 29], 'February 29', '이월 이십구 일');
  ex(['date', 3, 20], 'March 20', '삼월 이십 일', [], ['삼월 스무 일']);
  t.ok(!NUM.check(jun, '유월 시 일').ok && !NUM.check(NUM.item('date', 6, 6), '유월 유 일').ok, 'date: 유/시 belong to the month names only');
  t.ok(throws(() => NUM.item('date', 2, 30)) && throws(() => NUM.item('date', 4, 31)) && throws(() => NUM.item('date', 13, 1)), 'date: impossible dates are refused');

  ex(['price', 15000], '15,000 won', '만 오천 원', [], ['일만 오천 원', '일만오천원']);
  ex(['price', 500], '500 won', '오백 원');
  ex(['price', 100], '100 won', '백 원', [], ['일백 원']);
  ex(['price', 1000], '1,000 won', '천 원', [], ['일천 원']);
  ex(['price', 1500], '1,500 won', '천오백 원', [], ['일천오백 원']);
  ex(['price', 10000], '10,000 won', '만 원', [], ['일만 원']);
  ex(['price', 11000], '11,000 won', '만 천 원', [], ['일만 천 원', '만 일천 원', '일만 일천 원']);
  ex(['price', 25000], '25,000 won', '이만 오천 원');
  ex(['price', 110000], '110,000 won', '십일만 원', [], ['일십일만 원']);
  ex(['price', 990000], '990,000 won', '구십구만 원');

  ex(['age', 20], '20 years old', '스무 살', ['이십 세'], ['스물 살', '이십 살', '스무 세']);
  ex(['age', 21], '21 years old', '스물한 살', ['이십일 세'], ['스물하나 살', '이십일 살']);
  ex(['age', 25], '25 years old', '스물다섯 살', ['이십오 세'], ['이십오 살', '스물다섯 세']);
  ex(['age', 1], '1 year old', '한 살', ['일 세'], ['하나 살', '일 살']);
  ex(['age', 30], '30 years old', '서른 살', ['삼십 세'], ['삼십 살']);
  ex(['age', 99], '99 years old', '아흔아홉 살', ['구십구 세']);

  ex(['duration', 20, 'minute'], '20 minutes', '이십 분', [], ['스무 분', '스물 분']);
  ex(['duration', 1, 'minute'], '1 minute', '일 분', [], ['한 분']);
  ex(['duration', 2, 'hour'], '2 hours', '두 시간', [], ['이 시간', '둘 시간', '두 시']);
  ex(['duration', 1, 'hour'], '1 hour', '한 시간', [], ['일 시간', '하나 시간']);
  ex(['duration', 12, 'hour'], '12 hours', '열두 시간', [], ['십이 시간']);
  ex(['duration', 1, 'day'], '1 day', '하루', [], ['일 일', '한 일']);
  ex(['duration', 2, 'day'], '2 days', '이틀', ['이 일'], ['두 일']);
  ex(['duration', 3, 'day'], '3 days', '삼 일', ['사흘'], ['세 일', '셋 일']);
  ex(['duration', 10, 'day'], '10 days', '십 일', ['열흘'], ['열 일']);
  ex(['duration', 1, 'week'], '1 week', '일주일', ['일 주', '한 주']);
  ex(['duration', 2, 'week'], '2 weeks', '이 주', ['이 주일', '두 주']);
  ex(['duration', 4, 'week'], '4 weeks', '사 주', ['사 주일', '네 주']);
  ex(['duration', 1, 'month'], '1 month', '한 달', ['일 개월'], ['일 달', '한 개월', '일월']);
  ex(['duration', 3, 'month'], '3 months', '세 달', ['삼 개월', '석 달'], ['삼 달', '세 개월', '셋 달', '삼월']);
  ex(['duration', 6, 'month'], '6 months', '여섯 달', ['육 개월'], ['육 달', '여섯 개월', '유월']);
  t.ok(throws(() => NUM.item('duration', 5, 'week')) && throws(() => NUM.item('duration', 2, 'year')) && throws(() => NUM.item('time', 13, 0)) && throws(() => NUM.item('time', 3, 60)),
    'item(): values outside what the drill covers are refused');

  /* ---------- check() ---------- */
  const it = NUM.item('time', 3, 45), before = JSON.stringify(it);
  for (const typed of ['세 시 사십오 분', '세시사십오분', '  세   시\t사십오\n분 ', '세 시 사십오 분.', '세시 사십오분!?', '세 시 사십오 분。', '세\u00a0시\u3000사십오 분', '세 시 사십오 분'.normalize('NFD')])
    t.eq(NUM.check(it, typed), {ok: true}, `check: ${JSON.stringify(typed)} is right (spacing and trailing punctuation ignored)`);
  // trap must be undefined itself, not just missing from the JSON: 'constructor' would otherwise find Object's
  for (const typed of ['', ' ', '.', '세 시', '세 시 사십오', '시 사십오 분', '3시 45분', '세 시 사십오 분이에요', 'constructor', 'toString', '__proto__', 'hasOwnProperty', null, undefined, 345]) {
    const r = NUM.check(it, typed);
    t.ok(r.ok === false && r.trap === undefined, `check: ${JSON.stringify(typed)} is wrong, with no reason`, String(r.trap));
  }
  t.eq(NUM.check(it, ' 삼 시  사십오 분. '), {ok: false, trap: it.traps['삼시사십오분']}, 'check: a trap is found through spaces and punctuation too');
  t.ok(JSON.stringify(it) === before, 'check: leaves the item untouched');
  const copy = JSON.parse(before);
  t.ok(NUM.check(copy, '세시 사십오분').ok && str(NUM.check(copy, '삼시 사십오분').trap), 'check: works on an item that went through JSON');
  const frozen = Object.freeze({...copy, answers: Object.freeze(copy.answers), traps: Object.freeze(copy.traps)});
  t.ok(NUM.check(frozen, '세 시 사십오 분').ok && !NUM.check(frozen, '세 시').ok, 'check: works on a frozen item');
  t.ok(throws(() => NUM.make('nope', t.rng(1))), 'make: an unknown kind throws');

  /* ---------- The lesson deck never contradicts the drill ---------- */
  // Every "native number + counter" and "… 시 … 분" phrase in the real sentences must be an accepted answer here
  const deck = t.deck(), texts = [];
  for (const set of deck.vocab) for (const item of set.items) texts.push(item.ko);
  for (const u of deck.units) { for (const p of u.points) for (const x of p.examples) texts.push(x.ko); for (const s of u.selftest) texts.push(s.ko); }
  const forUnit = (n, unit) => unit === '살' ? ['age', n] : unit === '시간' ? n <= 12 && ['duration', n, 'hour'] : unit === '달' ? n <= 6 && ['duration', n, 'month'] : ['count', n, unit];
  let found = 0;
  for (const text of texts) {
    for (const m of text.matchAll(/([가-힣]+) (시간|달|살|마리|개|명|잔|병|권|장|대|번)/g)) {
      const n = Number.isNaN(parseMod(m[1])) ? parseNative(m[1]) : parseMod(m[1]), args = !Number.isNaN(n) && forUnit(n, m[2]);
      if (!args) continue;
      found++;
      t.ok(NUM.check(NUM.item(...args), m[0]).ok, `deck: "${m[0]}" (in ${text}) is what the drill accepts for ${args.join(' ')}`);
    }
    for (const m of text.matchAll(/([가-힣]+) 시 ([가-힣]+) 분/g)) {
      const h = parseMod(m[1]), min = parseSino(m[2]);
      if (!(h >= 1 && h <= 12 && min >= 1 && min <= 59)) continue;
      found++;
      t.ok(NUM.check(NUM.item('time', h, min), m[0]).ok, `deck: "${m[0]}" (in ${text}) is what the drill accepts for ${h}:${min}`);
    }
  }
  t.ok(found >= 5, 'deck: number phrases were found to compare against', found);
}
