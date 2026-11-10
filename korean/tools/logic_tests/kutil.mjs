// Tests for PURE:kutil, the small helpers behind the practice activities.   node korean/tools/test_logic.mjs kutil
//
// chosung and chipsOf have hand-checked tables, and each a second route written another way so a slip in KUTIL's
// regexes cannot hide: Unicode decomposition for the initial consonant, a character scanner for the chips.
// shuffled and quizPick are checked over many seeds, for what must always hold and for the odds they promise;
// quizPick is also compared with the formula as the spec writes it.

// The 19 initials as compatibility jamo, by code point: a look-alike letter typed into a table cannot pass
const CHO = [0x3131, 0x3132, 0x3134, 0x3137, 0x3138, 0x3139, 0x3141, 0x3142, 0x3143, 0x3145, 0x3146, 0x3147, 0x3148, 0x3149,
  0x314A, 0x314B, 0x314C, 0x314D, 0x314E].map(c => String.fromCharCode(c));

// One word per initial consonant, in dictionary order
const WORDS = [
  ['가방', 'ㄱㅂ'], ['꽃', 'ㄲ'], ['나무', 'ㄴㅁ'], ['다리', 'ㄷㄹ'], ['딸기', 'ㄸㄱ'], ['라면', 'ㄹㅁ'], ['머리', 'ㅁㄹ'],
  ['바다', 'ㅂㄷ'], ['빵', 'ㅃ'], ['사람', 'ㅅㄹ'], ['쓰다', 'ㅆㄷ'], ['아이', 'ㅇㅇ'], ['자전거', 'ㅈㅈㄱ'], ['짜다', 'ㅉㄷ'],
  ['친구', 'ㅊㄱ'], ['커피', 'ㅋㅍ'], ['토요일', 'ㅌㅇㅇ'], ['포도', 'ㅍㄷ'], ['학교', 'ㅎㄱ'],
];
const HINTS = [
  ['스트레스를 받다', 'ㅅㅌㄹㅅㄹ ㅂㄷ'],
  ['저는 주말에 친구하고 낚시를 했어요.', 'ㅈㄴ ㅈㅁㅇ ㅊㄱㅎㄱ ㄴㅅㄹ ㅎㅇㅇ.'],
  // final consonants, double ones too, never show
  ['괜찮아요', 'ㄱㅊㅇㅇ'], ['읽었어요', 'ㅇㅇㅇㅇ'], ['없어요', 'ㅇㅇㅇ'], ['싫어해요', 'ㅅㅇㅎㅇ'], ['짧다', 'ㅉㄷ'], ['꿈', 'ㄲ'],
  // the first and last syllable of a block of 588
  ['가', 'ㄱ'], ['깋', 'ㄱ'], ['까', 'ㄲ'], ['하', 'ㅎ'], ['힣', 'ㅎ'],
  // everything that is not a syllable stays where it is
  ['뭐예요?', 'ㅁㅇㅇ?'],
  ['마중(을) 나가다', 'ㅁㅈ(ㅇ) ㄴㄱㄷ'],
  ['제 생일은 11월 14일이에요.', 'ㅈ ㅅㅇㅇ 11ㅇ 14ㅇㅇㅇㅇ.'],
  ['요즘 AI가 많이 똑똑해졌어요.', 'ㅇㅈ AIㄱ ㅁㅇ ㄸㄸㅎㅈㅇㅇ.'],
  ['지금 눌러도 돼요? — 그럼요.', 'ㅈㄱ ㄴㄹㄷ ㄷㅇ? — ㄱㄹㅇ.'],
  ['두껍다 ↔ 얇다', 'ㄷㄲㄷ ↔ ㅇㄷ'],
  ['네,\n좋아요!', 'ㄴ,\nㅈㅇㅇ!'],
];
const SAME = ['', ' ', 'abc XYZ 0123456789', '.,?!…~—=()[]{}\'"', 'ㄱㄴㄷ ㅏㅑ ㅋㅋ', '漢字 かな カナ', '😀 ↔ ＿', '\uABFF\uD7A4', '\n\t\u00A0', '\u1100'];

// sentence → chips
const CHIPS = [
  ['저는 주말에 친구하고 낚시를 했어요.', ['저는', '주말에', '친구하고', '낚시를', '했어요']],
  ['지금 눌러도 돼요?', ['지금', '눌러도', '돼요']],
  ['할머니, 제가 도와드릴게요!', ['할머니', '제가', '도와드릴게요']],
  ['아니요, 안 가 봤어요.', ['아니요', '안', '가', '봤어요']],
  // end marks of every kind, or none
  ['오늘은 날씨가 좋아요', ['오늘은', '날씨가', '좋아요']],
  ['저는 잘 모르겠어요…', ['저는', '잘', '모르겠어요']],
  ['저는 잘 모르겠어요...', ['저는', '잘', '모르겠어요']],
  ['저는 잘 모르겠어요….', ['저는', '잘', '모르겠어요']],
  ['정말 그렇게 생각해요?!', ['정말', '그렇게', '생각해요']],
  ['정말 그렇게 생각해요?…', ['정말', '그렇게', '생각해요']],
  // an ellipsis is a pause, not the end of a sentence
  ['글쎄요… 잘 모르겠어요.', ['글쎄요', '잘', '모르겠어요']],
  // loose spacing; a comma is a word break even where its space is missing
  ['  저는   학생이\t아니에요.\n', ['저는', '학생이', '아니에요']],
  ['아니요,안 가 봤어요.', ['아니요', '안', '가', '봤어요']],
  ['저는 학교에 가요 .', ['저는', '학교에', '가요']],
  // a repeated word stays, each time in its place
  ['안 가고 싶어서 안 갔어요.', ['안', '가고', '싶어서', '안', '갔어요']],
  ['그 사람은 그 영화를 좋아해요.', ['그', '사람은', '그', '영화를', '좋아해요']],
  ['자격증 시험 때문에 세 달이나 시험 준비를 했어요.', ['자격증', '시험', '때문에', '세', '달이나', '시험', '준비를', '했어요']],
  ['할 수 있으면 할 수 있다고 말하세요.', ['할', '수', '있으면', '할', '수', '있다고', '말하세요']],
  // 8 chips is the most
  ['저는 어제 친구하고 같이 시장에 가서 과일을 샀어요.', ['저는', '어제', '친구하고', '같이', '시장에', '가서', '과일을', '샀어요']],
];
// sentence, and the one thing wrong with it: each is otherwise a single sentence of 3–8 words
const NONE = [
  ['지금 눌러도 돼요? — 그럼요.', 'a dash between two turns'],
  ['어제 세 시간이나 청소했어요 — 세 시간이나요', 'a dash'],
  ['두 번 = 이 주에 한 번', '='],
  ['(반말) 응, 김치를 만들 줄 알아.', 'a label in parentheses'],
  ['마중(을) 나가서 친구를 만났어요.', 'an optional particle in parentheses'],
  ['사진을 （여기서） 찍어도 돼요?', 'full-width parentheses'],
  ['[받아요] 스트레스를 많이 받아요.', 'square brackets'],
  ['저는 {주말에} 낚시를 했어요.', 'curly brackets'],
  ['저는 <주말에> 낚시를 했어요.', 'angle brackets'],
  ['저는 「오디세이」를 주말에 봤어요.', 'corner brackets'],
  ["저는 '안녕'이라고 자주 말해요.", 'single quotes'],
  ['친구가 "같이 가요"라고 말했어요.', 'double quotes'],
  ['친구가 “같이 가요”라고 말했어요.', 'curly double quotes'],
  ['저는 ‘안녕’이라고 자주 말해요.', 'curly single quotes'],
  ['요즘 AI가 많이 똑똑해졌어요.', 'Latin letters'],
  ['저는 요즘 k팝을 자주 들어요.', 'a Latin letter'],
  ["'Developer'는 한국어로 개발자라고 해요.", 'quotes and Latin letters'],
  ['저는 어제 12시간이나 잤어요.', 'digits'],
  ['2년 만에 가족이 다 모여요.', 'a digit'],
  ['네. 저는 학생이에요.', 'two sentences'],
  ['정말요? 저도 같이 가고 싶어요.', 'a question, then a sentence'],
  ['와! 이 김치는 정말 맛있어요.', 'an exclamation, then a sentence'],
  ['제가 주말에 오디세이를 봤거든요. 근데…', 'a sentence, then a trailing word'],
  ['저는 학교에 가요.친구는 집에 가요.', 'two sentences with no space between'],
  ['저는 학교에 가요. 네', 'text after the full stop'],
  ['', 'empty'], ['   ', 'only spaces'], ['. ? !', 'only marks'], [', , ,', 'only commas'],
  ['안녕하세요.', '1 word'], ['저는 학생이에요.', '2 words'], ['네, 좋아요!', '2 words and a comma'],
  ['저는 어제 친구하고 같이 시장에 가서 과일을 많이 샀어요.', '9 words'],
  // beyond the spec's list: a chip that is not a plain Hangul word is no use either
  ['사진을 찍어도 / 찍어도 돼요?', 'a slash'],
  ['ㅋㅋ 정말 너무 웃겨요.', 'loose jamo'],
  ['글쎄…요 잘 모르겠어요.', 'an ellipsis inside a word'],
  ['…근데 저는 잘 모르겠어요.', 'an ellipsis before a word'],
  ['저는 학교에 가요。', 'a full-width full stop'],
  ['요즘 회사에 일이 많아서 스트레스를 많이 ＿＿＿＿＿.', 'a blank to fill'],
];
// Marks that spoil a chip wherever they touch a word
const SPOIL = ['—', '–', '-', '=', '(', ')', '[', ']', '{', '}', '<', '>', '〈', '〉', '「', '」', '（', '）', "'", '"', '‘', '’', '“', '”', '`',
  'a', 'Z', 'é', 'ａ', '0', '7', '９', '/', '·', '~', ':', ';', '*', '+', '&', '→', '↔', '≈', '_', '＿', 'ㅋ', 'ㅏ', '漢', 'あ', '。', '，', '？', '！', '\u200B', '😀'];

const HANGUL = c => c >= '가' && c <= '힣';
const hangul = s => [...s].filter(HANGUL).join('');
// Second route for chipsOf: one pass over the characters, no regular expression on the sentence
const model = raw => {
  if (typeof raw !== 'string') return null;
  const words = [];
  let w = '', marked = false, stopped = false;   // marked: an end mark has closed the word being read; stopped: a . ? ! has been seen
  for (const c of raw.normalize('NFC') + ' ') {
    const space = c.trim() === '', mark = '.?!…'.includes(c);
    if (stopped && !space && !mark) return null;   // a second sentence
    if (space || c === ',') { if (w) words.push(w); w = ''; marked = false; }
    else if (mark) { marked = true; stopped = stopped || c !== '…'; }
    else if (HANGUL(c) && !marked) w += c;
    else return null;
  }
  return words.length >= 3 && words.length <= 8 ? words : null;
};
// The spec's list of what makes a sentence unsuitable, read off the raw text (word counts aside)
const unfit = s => / — /.test(s) ? 'dash' : s.includes('=') ? 'equals' : /[()]/.test(s) ? 'parentheses' : /[[\]{}<>]/.test(s) ? 'brackets'
  : /['"‘’“”]/.test(s) ? 'quotes' : /[A-Za-z]/.test(s) ? 'Latin' : /[0-9]/.test(s) ? 'digits' : /[.?!]\s*[^.?!…\s]/.test(s) ? 'sentences' : null;
// The spec's chips, word for word: split on spaces, drop commas and final punctuation, drop what is left empty
const plainChips = s => s.split(' ').map(w => w.replace(/,/g, '').replace(/[.?!…]+$/, '')).filter(Boolean);
// That wording is exact for text spaced the usual way: single spaces, a comma only between a word and a space, no pause before the end
const usual = s => /^[^\s,]+(,? [^\s,]+)*$/.test(s) && !/…,? /.test(s);

const key = v => JSON.stringify(v);
const sorted = a => [...a].map(key).sort();
// A scripted rng: the values in turn, round and round
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
const fact = n => n < 2 ? 1 : n * fact(n - 1);

// Second route for quizPick: the spec's key, u ** (1 / w), on candidates merged by id first
const pickModel = (cands, k, rng) => {
  const best = new Map();
  for (const c of cands) {
    if (typeof c.w !== 'number' || !(c.w > 0) || c.w === Infinity) continue;
    const u = rng() ** (1 / c.w);
    if (!best.has(c.id) || u > best.get(c.id)) best.set(c.id, u);
  }
  return [...best].sort((a, b) => b[1] - a[1]).slice(0, k).map(x => x[0]);
};

export default async function (pure, t) {
  const { KUTIL } = pure;
  const { chosung, chipsOf, shuffled, sameOrder, quizPick } = KUTIL;
  t.eq(Object.keys(KUTIL).sort(), ['chipsOf', 'chosung', 'quizPick', 'sameOrder', 'shuffled'], 'KUTIL has the five helpers');

  // ---- chosung
  // The table above, checked against Unicode: a compatibility jamo decomposes (NFKD) to the conjoining initial of the same rank
  t.eq(CHO.map(c => c.normalize('NFKD').charCodeAt(0) - 0x1100), CHO.map((c, i) => i), 'the 19 initials are in dictionary order');
  t.eq(WORDS.map(([w, h]) => h[0]), CHO, 'the word table has every initial consonant, in order');
  for (const [w, h] of [...WORDS, ...HINTS]) {
    t.ok([...h].every(c => CHO.includes(c) || [...w].includes(c)), `the hint written for ${w} uses only compatibility jamo`, h);
    t.eq(chosung(w), h, `chosung(${key(w)})`);
    t.eq(chosung(h), h, `chosung leaves the hint for ${w} as it is`);
  }
  for (const s of SAME) t.eq(chosung(s), s, `chosung keeps ${key(s)}`);
  const off = [];
  for (let c = 0xAC00; c <= 0xD7A3; c++) {
    const s = String.fromCharCode(c), h = chosung(s);
    // 588 = 21 vowels × 28 finals under each initial; NFD reaches the same initial by Unicode's own tables
    if (h !== CHO[Math.floor((c - 0xAC00) / 588)] || h.normalize('NFKD') !== s.normalize('NFD')[0]) off.push(s);
  }
  t.eq(off, [], 'each of the 11,172 syllables gives its initial consonant');
  t.eq(chosung('한국어를 배워요'.normalize('NFD')), 'ㅎㄱㅇㄹ ㅂㅇㅇ', 'chosung: decomposed text does not come back whole');
  t.eq([null, undefined, 42, ['가방']].map(v => chosung(v)), ['', '', '', ''], 'chosung: not a string gives an empty hint');

  // ---- chipsOf
  for (const [s, want] of CHIPS) {
    t.eq(chipsOf(s), want, `chipsOf(${key(s)})`);
    t.eq(model(s), want, `second route on ${key(s)}`);
  }
  for (const [s, why] of NONE) {
    t.eq(chipsOf(s), null, `chipsOf refuses ${key(s)}: ${why}`);
    t.eq(model(s), null, `second route refuses ${key(s)}`);
  }
  t.eq([null, undefined, 42, {}, ['저는 주말에 낚시를 했어요.']].map(v => chipsOf(v)), [null, null, null, null, null], 'chipsOf: not a string gives null');
  t.eq(chipsOf('저는 주말에 낚시를 했어요.'.normalize('NFD')), ['저는', '주말에', '낚시를', '했어요'], 'chipsOf: decomposed text gives composed chips');
  t.ok(chipsOf(CHIPS[0][0]) !== chipsOf(CHIPS[0][0]), 'chipsOf: a new array each call');

  // every spoiling mark, as a word of its own, at either end of a word, inside one, first of all and last of all
  for (const m of SPOIL) {
    const at = [`저는 주말에 ${m} 친구하고 낚시를 했어요.`, `저는 ${m}주말에 친구하고 낚시를 했어요.`, `저는 주말에${m} 친구하고 낚시를 했어요.`,
      `저는 주${m}말에 친구하고 낚시를 했어요.`, `${m}저는 주말에 친구하고 낚시를 했어요.`, `저는 주말에 친구하고 낚시를 했어요${m}.`, `저는 주말에 친구하고 낚시를 했어요.${m}`];
    for (const s of at) t.eq(chipsOf(s), null, `chipsOf refuses ${key(s)}`);
  }
  // a . ? ! anywhere but the end is a second sentence
  for (const m of ['.', '?', '!', '?!', '...']) {
    for (const s of [`저는 주말에${m} 친구하고 낚시를 했어요.`, `저는 주말에 ${m} 친구하고 낚시를 했어요.`, `저는 주${m}말에 친구하고 낚시를 했어요.`, `${m} 저는 주말에 친구하고 낚시를 했어요`]) {
      t.eq(chipsOf(s), null, `chipsOf refuses ${key(s)}`);
    }
    t.eq(chipsOf(`저는 주말에 친구하고 낚시를 했어요${m}`), CHIPS[0][1], `chipsOf: ${m} at the end is dropped`);
  }
  // the limits, one word at a time
  const LONG = ['저는', '어제', '친구하고', '같이', '시장에', '가서', '과일을', '많이', '샀어요', '그리고'];
  for (let n = 0; n <= 10; n++) {
    const words = LONG.slice(0, n);
    t.eq(chipsOf(words.join(' ') + '.'), n >= 3 && n <= 8 ? words : null, `chipsOf: ${n} words`);
  }

  // what must hold for any chips that come back
  const sound = (raw, chips, label) => {
    if (chips === null) return;
    t.ok(Array.isArray(chips) && chips.length >= 3 && chips.length <= 8, `${label}: 3 to 8 chips`, chips);
    t.ok(chips.every(c => typeof c === 'string' && c.length > 0 && [...c].every(HANGUL)), `${label}: every chip is a Hangul word with no space or mark in it`, chips);
    t.eq(chips.join(''), hangul(raw.normalize('NFC')), `${label}: the chips are the sentence's syllables, all of them, in order`);
    t.eq(unfit(raw), null, `${label}: nothing the spec rules out is in a sentence that gave chips`);
  };

  // ---- random sentences: the second route agrees, and every result is sound
  const rnd = t.rng(20261110), int = n => Math.floor(rnd() * n), pick = l => l[int(l.length)];
  const WORD = ['저는', '주말에', '친구하고', '낚시를', '했어요', '안', '가', '봤어요', '네', '시험', '시험'];
  const GAP = [' ', ' ', ' ', ' ', ' ', ' ', ', ', ', ', '  ', ',', '\n', '\t', '\u00A0', ' , '];
  const END = ['.', '.', '.', '?', '!', '…', '?!', '...', ''];
  const ODD = [' — ', '=', '(', ')', '[', ']', '"', "'", '‘', '“', 'A', 'z', '3', '/', '~', 'ㅋ', '—', '-', '。', '.', '?', '!', '…', ' … ', ' . '];
  const seen = {chips: 0, none: 0, repeat: 0, pause: 0};
  for (let n = 0; n < 4000; n++) {
    let raw = '';
    for (let k = 1 + int(10); k > 0; k--) raw += pick(WORD) + (rnd() < 0.06 ? pick(ODD) : '') + (k > 1 ? pick(GAP) : pick(END));
    if (rnd() < 0.1) raw = pick([' ', '\n', '…', ',']) + raw;
    const chips = chipsOf(raw), label = `random ${key(raw)}`;
    t.eq(chips, model(raw), `${label}: second route agrees`);
    sound(raw, chips, label);
    if (chips === null) { seen.none++; continue; }
    seen.chips++;
    if (new Set(chips).size < chips.length) seen.repeat++;
    if (/…[^.?!…]/.test(raw.trim())) seen.pause++;
  }
  t.ok(seen.chips > 1500 && seen.none > 1000 && seen.repeat > 300 && seen.pause > 10, 'the random sentences exercise chips, refusals, repeated words and pauses', seen);

  // ---- the real deck
  const deck = t.deck();
  const examples = deck.units.flatMap(u => u.points.flatMap(p => p.examples.map(e => e.ko)));
  const selftest = deck.units.flatMap(u => u.selftest.map(s => s.ko));
  const vocab = deck.vocab.flatMap(g => g.items.map(i => i.ko));
  const other = [...vocab, ...deck.vocab.flatMap(g => g.items.map(i => i.notes)), ...deck.mistakes.flatMap(m => [m.right, m.wrong]),
    ...deck.workbook.flatMap(p => p.groups.flatMap(g => g.items.map(i => i.q)))].filter(s => typeof s === 'string' && s);
  t.ok(examples.length > 200 && selftest.length > 100 && vocab.length > 400 && other.length > 1000, 'the deck has the fields the sweeps read',
    {examples: examples.length, selftest: selftest.length, vocab: vocab.length, other: other.length});

  const got = {examples: 0, selftest: 0}, sizes = {};
  let plain = 0;
  for (const [kind, list] of Object.entries({examples, selftest})) {
    for (const s of list) {
      const chips = chipsOf(s), label = `deck ${kind} ${key(s)}`, n = plainChips(s).length;
      t.eq(chips, model(s), `${label}: second route agrees`);
      sound(s, chips, label);
      if (unfit(s)) t.eq(chips, null, `${label}: refused (${unfit(s)})`);
      if (usual(s)) {
        plain++;
        if (n < 3 || n > 8) t.eq(chips, null, `${label}: refused (${n} words)`);
        // nothing else may be lost: no rule may be stricter than it says
        else if (/^[가-힣 ,]+[.?!…]*$/.test(s)) t.ok(chips !== null, `${label}: a plain sentence of 3 to 8 words gives chips`);
      }
      if (chips === null) continue;
      got[kind]++;
      sizes[chips.length] = (sizes[chips.length] || 0) + 1;
      t.ok(chips.every(c => c && !/\s/.test(c) && !/[.?!…,]/.test(c)), `${label}: no chip is empty or has a space or punctuation`, chips);
      if (!usual(s)) continue;
      t.eq(chips, plainChips(s), `${label}: the chips are the words between the spaces`);
      t.eq(chips.join(' '), s.replace(/,/g, '').replace(/[.?!…]+$/, ''), `${label}: joined, the chips are the sentence without commas and final punctuation`);
    }
  }
  const total = examples.length + selftest.length, fit = got.examples + got.selftest;
  t.ok(fit >= 300 && fit > total / 2, `deck: ${fit} of ${total} example and self-test sentences make a word-order exercise`, {...got, sizes});
  t.ok(got.examples > 150 && got.selftest > 80, 'deck: examples and self-tests both give exercises', got);
  t.ok(sizes[3] > 0 && sizes[8] > 0 && Object.keys(sizes).every(n => n >= 3 && n <= 8), 'deck: chip counts run from 3 to 8', sizes);
  t.ok(plain > total * 0.9, 'deck: nearly every sentence is spaced the usual way, so the checks against the spec\'s wording ran', {plain, total});
  // vocabulary, notes, mistakes and workbook lines are not exercises, but nothing odd may come out of them either
  let chipped = 0;
  for (const s of other) {
    const chips = chipsOf(s), label = `deck text ${key(s)}`;
    t.eq(chips, model(s), `${label}: second route agrees`);
    sound(s, chips, label);
    if (unfit(s)) t.eq(chips, null, `${label}: refused (${unfit(s)})`);
    if (chips) chipped++;
  }
  t.ok(chipped > 50, 'deck: the other text has plain sentences too', {chipped, of: other.length});

  // chosung on the deck: a hint as long as the answer, with every syllable hidden and everything else in place
  for (const s of [...vocab, ...examples]) {
    const h = chosung(s);
    t.ok(h.length === s.length && [...s].every((c, i) => HANGUL(c) ? h[i].normalize('NFKD') === c.normalize('NFD')[0] : h[i] === c), `deck: chosung(${key(s)})`, h);
  }

  // ---- sameOrder
  const A = ['안', '가고', '싶어서', '안', '갔어요'];
  t.ok(sameOrder([], []), 'sameOrder: two empty arrays');
  t.ok(sameOrder(['가'], ['가']), 'sameOrder: one chip');
  t.ok(sameOrder(A, [...A]), 'sameOrder: a copy');
  t.ok(sameOrder(A, A), 'sameOrder: the array itself');
  // the learner may place the second 안 first: the words read the same
  t.ok(sameOrder([3, 1, 2, 0, 4].map(i => A[i]), A), 'sameOrder: equal words swapped is still the same order');
  t.ok(sameOrder(chipsOf('그 사람은 그 영화를 좋아해요.'), ['그', '사람은', '그', '영화를', '좋아해요']), 'sameOrder: chips against the answer');
  t.ok(!sameOrder([0, 2, 1, 3, 4].map(i => A[i]), A), 'sameOrder: two different words swapped');
  t.ok(!sameOrder([...A].reverse(), A), 'sameOrder: reversed');
  t.ok(!sameOrder(['가', '나'], ['나', '가']), 'sameOrder: two chips swapped');
  t.ok(!sameOrder(A.slice(0, 4), A) && !sameOrder(A, A.slice(0, 4)), 'sameOrder: a shorter array is not the same, either way round');
  t.ok(!sameOrder([], ['가']) && !sameOrder(['가'], []), 'sameOrder: empty against one chip');
  t.ok(!sameOrder(['가', '봤어요'], ['가 봤어요']) && !sameOrder(['가봤', '어요'], ['가', '봤어요']), 'sameOrder: chip by chip, not as joined text');
  t.ok(!sameOrder(['가', '나', '다'], ['가', '나', '라']), 'sameOrder: a different last word');
  t.ok(!sameOrder(null, []) && !sameOrder([], undefined) && !sameOrder('가나', ['가', '나']) && !sameOrder(undefined, undefined), 'sameOrder: not an array is never the same');
  t.eq(A, ['안', '가고', '싶어서', '안', '갔어요'], 'sameOrder leaves its arguments alone');

  // ---- shuffled
  const ARRS = [['a', 'b'], ['a', 'b', 'c'], CHIPS[0][1], A, ['가', '가', '나'], ['나', '가', '가'], ['가', '나', '가'], ['x', 'x', 'x', 'x', 'y'],
    [1, 2, 3, 4, 5, 6, 7, 8], ['할', '수', '있으면', '할', '수', '있다고', '말하세요'], ['자격증', '시험', '때문에', '세', '달이나', '시험', '준비를', '했어요']];
  for (const arr of ARRS) {
    const before = key(arr), orders = new Set();
    let same = 0, lost = 0, alias = 0, drift = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const out = shuffled(arr, t.rng(seed));
      if (sameOrder(out, arr) || key(out) === before) same++;
      if (key(sorted(out)) !== key(sorted(arr))) lost++;
      if (out === arr || !Array.isArray(out)) alias++;
      if (key(out) !== key(shuffled(arr, t.rng(seed)))) drift++;
      orders.add(key(out));
    }
    t.eq(same, 0, `shuffled ${before}: never the original order in 600 seeds`);
    t.eq(lost, 0, `shuffled ${before}: always the same chips`);
    t.eq(alias, 0, `shuffled ${before}: always a new array`);
    t.eq(drift, 0, `shuffled ${before}: the same seed gives the same order`);
    t.eq(key(arr), before, `shuffled ${before}: the argument is not changed`);
    // every other order of a short array, and at least 100 of a long one (the first 6 chips have enough orders to tell which)
    const distinct = new Set(perms(arr.slice(0, 6)).map(key)).size;
    t.ok(orders.size >= Math.min(distinct - 1, 100), `shuffled ${before}: many different orders come up`, orders.size);
  }
  // every path Fisher–Yates can take through a short array, by scripting the rng: the value (j + 0.5) / (i + 1) picks j at step i, from the last index down
  for (const arr of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e'], ['가', '가', '나'], ['가', '나', '가', '나'], ['x', 'x', 'x', 'y', 'x']]) {
    const n = arr.length, hits = new Map();
    let same = 0, lost = 0;
    for (let p = 0; p < fact(n); p++) {
      const draws = [];
      for (let i = n - 1, q = p; i > 0; q = Math.floor(q / (i + 1)), i--) draws.push((q % (i + 1) + 0.5) / (i + 1));
      const out = shuffled(arr, seq(...draws));
      if (sameOrder(out, arr)) same++;
      if (key(sorted(out)) !== key(sorted(arr))) lost++;
      hits.set(key(out), (hits.get(key(out)) || 0) + 1);
    }
    t.ok(same === 0 && lost === 0, `shuffled ${key(arr)}: none of the ${fact(n)} paths ends on the original order or changes the chips`, {same, lost});
    const all = new Set(perms(arr).map(key));
    all.delete(key(arr));
    t.eq([...hits.keys()].sort(), [...all].sort(), `shuffled ${key(arr)}: every other order can come up`);
    // a fair shuffle reaches each arrangement by the same number of paths; the one spare path is the original order, moved on
    if (all.size === fact(n) - 1) t.eq([...hits.values()].sort(), [...Array(fact(n) - 2).fill(1), 2], `shuffled ${key(arr)}: one path to each order, and the spare one`);
  }
  for (const stuck of [0, 0.25, 0.5, 0.75, 0.999999]) {
    for (const arr of ARRS) {
      const out = shuffled(arr, () => stuck);
      t.ok(!sameOrder(out, arr) && key(sorted(out)) === key(sorted(arr)), `shuffled ${key(arr)}: copes with an rng stuck at ${stuck}`, out);
    }
  }
  // 0.9 then 0.1 swaps the two 가 and nothing else: the words still read as the answer, so the order must move on
  t.ok(!sameOrder(shuffled(['가', '가', '나'], seq(0.9, 0.1)), ['가', '가', '나']), 'shuffled: swapping two equal words does not count as shuffling');
  t.eq(shuffled(['a', 'b'], seq(0.9)), ['b', 'a'], 'shuffled: two chips always swap');
  t.eq(shuffled(['a', 'b'], seq(0.1)), ['b', 'a'], 'shuffled: two chips always swap, whichever way the rng falls');
  // nothing to reorder
  const one = ['가'], none = [], equal = ['가', '가', '가'];
  t.eq(shuffled(none, t.rng(1)), [], 'shuffled: empty stays empty');
  t.eq(shuffled(one, t.rng(1)), ['가'], 'shuffled: one chip');
  for (let seed = 1; seed <= 50; seed++) t.eq(shuffled(equal, t.rng(seed)), ['가', '가', '가'], `shuffled: all-equal chips, seed ${seed}`);
  t.eq(shuffled(equal, () => 0.999999), ['가', '가', '가'], 'shuffled: all-equal chips with the rng stuck high');
  t.ok(shuffled(none, t.rng(1)) !== none && shuffled(one, t.rng(1)) !== one && shuffled(equal, t.rng(1)) !== equal, 'shuffled: a copy even when nothing can move');
  t.eq(shuffled(Object.freeze(['a', 'b', 'c']), t.rng(5)).length, 3, 'shuffled: a frozen array is fine');
  // fair: over 8,000 seeds each of 8 chips lands in each place about 1,000 times (σ ≈ 30)
  const place = Array.from({length: 8}, () => Array(8).fill(0));
  for (let seed = 1; seed <= 8000; seed++) shuffled([0, 1, 2, 3, 4, 5, 6, 7], t.rng(seed)).forEach((v, i) => place[v][i]++);
  t.ok(place.flat().every(n => n > 850 && n < 1150), 'shuffled: every chip is as likely to land in every place', place);
  // and over 6,000 seeds none of the 5 other orders of 3 chips is short (1,000 expected at least, σ ≈ 29)
  const three = {};
  for (let seed = 1; seed <= 6000; seed++) { const k = shuffled(['a', 'b', 'c'], t.rng(seed)).join(''); three[k] = (three[k] || 0) + 1; }
  t.ok(Object.keys(three).length === 5 && !three.abc && Object.values(three).every(n => n > 850), 'shuffled: all 5 other orders of 3 chips are common', three);

  // ---- quizPick
  const ids = l => l.map(c => c.id);
  const TEN = Array.from({length: 10}, (_, i) => ({id: 'c' + i, w: 1 + i % 4}));
  for (let seed = 1; seed <= 300; seed++) {
    for (const k of [0, 1, 3, 9, 10, 11, 50]) {
      const out = quizPick(TEN, k, t.rng(seed)), label = `quizPick 10 candidates, k ${k}, seed ${seed}`;
      t.ok(Array.isArray(out) && out.length === Math.min(k, 10) && new Set(out).size === out.length && out.every(id => ids(TEN).includes(id)), `${label}: ${Math.min(k, 10)} distinct ids of the candidates`, out);
      t.eq(out, quizPick(TEN, k, t.rng(seed)), `${label}: the same seed gives the same picks`);
      // one draw per candidate whatever k is, so a longer pick starts with the shorter one
      t.eq(out, quizPick(TEN, 50, t.rng(seed)).slice(0, k), `${label}: the first ${k} of the full order`);
    }
  }
  t.eq(sorted(quizPick(TEN, 99, t.rng(4))), sorted(ids(TEN)), 'quizPick: k above the number of candidates gives them all');
  t.ok(new Set(Array.from({length: 40}, (_, s) => key(quizPick(TEN, 3, t.rng(s + 1))))).size > 30, 'quizPick: different seeds give different picks');
  t.eq([quizPick([], 3, t.rng(1)), quizPick(TEN, 0, t.rng(1)), quizPick(TEN, -2, t.rng(1)), quizPick(null, 3, t.rng(1)), quizPick(undefined, 3, t.rng(1))], [[], [], [], [], []],
    'quizPick: no candidates, or k of 0 or less, gives nothing');
  t.eq(quizPick([{id: 'only', w: 0.5}], 1, t.rng(9)), ['only'], 'quizPick: a single candidate');
  t.eq(quizPick([{id: 7, w: 1}, {id: 8, w: 1}], 5, t.rng(9)).sort(), [7, 8], 'quizPick: ids come back as they are, numbers too');
  const frozen = Object.freeze(TEN.map(c => Object.freeze({...c}))), was = key(frozen);
  t.eq(quizPick(frozen, 4, t.rng(2)), quizPick(TEN, 4, t.rng(2)), 'quizPick: frozen candidates are fine');
  t.eq(key(frozen), was, 'quizPick: the candidates are not changed');

  // bad weights: never picked, and they use up no draw, so the rest are picked as if the bad ones were not listed
  const BADW = [0, -1, -0.001, NaN, Infinity, -Infinity, undefined, null, '3', true, [2], {}];
  const mixed = [];
  TEN.forEach((c, i) => { mixed.push({id: 'bad' + i, w: BADW[i]}, c); });
  mixed.push({id: 'bad10', w: BADW[10]}, {id: 'bad11', w: BADW[11]}, {id: 'noweight'}, null, undefined);
  for (let seed = 1; seed <= 200; seed++) {
    t.eq(quizPick(mixed, 50, t.rng(seed)), quizPick(TEN, 50, t.rng(seed)), `quizPick: bad weights are ignored, seed ${seed}`);
    t.eq(quizPick(mixed, 4, t.rng(seed)), quizPick(TEN, 4, t.rng(seed)), `quizPick: bad weights are ignored in a pick of 4, seed ${seed}`);
  }
  t.eq(quizPick(BADW.map((w, i) => ({id: 'bad' + i, w})), 5, t.rng(3)), [], 'quizPick: only bad weights gives nothing');

  // an id listed twice is picked once, with its weights added: a + a against b at 1 each is 2 to 1
  let twice = 0;
  const dup = [{id: 'a', w: 1}, {id: 'b', w: 1}, {id: 'a', w: 1}], rd = t.rng(31);
  for (let n = 0; n < 3000; n++) {
    const out = quizPick(dup, 5, rd);
    if (n < 200) t.eq(sorted(out), sorted(['a', 'b']), `quizPick: a repeated id comes back once, draw ${n}`);
    if (out[0] === 'a') twice++;
  }
  t.ok(twice > 1900 && twice < 2100, 'quizPick: a repeated id has the weight of its entries together (2,000 of 3,000 expected, σ ≈ 26)', twice);

  // the odds. 1 against 9: the heavy one first 90% of the time (1,800 of 2,000, σ ≈ 13), whichever is listed first
  const share = (cands, id, draws, rng) => { let n = 0; for (let i = 0; i < draws; i++) if (quizPick(cands, 1, rng ? rng : t.rng(i + 1))[0] === id) n++; return n; };
  const light = {id: 'light', w: 1}, heavy = {id: 'heavy', w: 9};
  for (const [cands, how] of [[[light, heavy], 'light listed first'], [[heavy, light], 'heavy listed first']]) {
    const bySeed = share(cands, 'heavy', 2000), byRun = share(cands, 'heavy', 2000, t.rng(77));
    t.ok(bySeed >= 1700 && bySeed <= 1900, `quizPick: weight 9 beats weight 1 about 90% of the time over 2,000 seeds, ${how}`, bySeed);
    t.ok(byRun >= 1700 && byRun <= 1900, `quizPick: and over 2,000 draws from one rng, ${how}`, byRun);
  }
  // only the proportions count: 0.001 against 0.009, and 1,000 against 9,000, are 90% too
  for (const f of [0.001, 1000, 1e-9, 1e9]) {
    const n = share([{id: 'light', w: f}, {id: 'heavy', w: 9 * f}], 'heavy', 2000);
    t.ok(n >= 1700 && n <= 1900, `quizPick: weights ${f} and ${9 * f} are still 1 to 9`, n);
  }
  // scaled by a power of two the keys scale exactly, so the whole order is the same; tiny weights must not collapse into a tie
  for (let seed = 1; seed <= 100; seed++) {
    const base = quizPick(TEN, 10, t.rng(seed));
    for (const f of [2 ** -40, 2 ** -12, 2 ** 12, 2 ** 40]) t.eq(quizPick(TEN.map(c => ({id: c.id, w: c.w * f})), 10, t.rng(seed)), base, `quizPick: weights × ${f} pick the same, seed ${seed}`);
  }
  // weights 1 2 3 4: first pick 10% 20% 30% 40% of 10,000 (σ under 50)
  const FOUR = [{id: 'w1', w: 1}, {id: 'w2', w: 2}, {id: 'w3', w: 3}, {id: 'w4', w: 4}], first = {w1: 0, w2: 0, w3: 0, w4: 0}, r4 = t.rng(404);
  let lastW4 = 0;
  for (let n = 0; n < 10000; n++) { const out = quizPick(FOUR, 4, r4); first[out[0]]++; if (out[3] === 'w4') lastW4++; }
  t.ok(FOUR.every(c => Math.abs(first[c.id] - 1000 * c.w) < 200), 'quizPick: the first pick follows the weights 1 : 2 : 3 : 4', first);
  // without replacement: w4 is last when the other three go first, each pick in proportion to what is left. The 6 orders add up to 7.8% (σ ≈ 27 of 10,000)
  const pLast = perms([1, 2, 3]).reduce((p, [x, y, z]) => p + x / 10 * y / (10 - x) * z / (10 - x - y), 0);
  t.ok(Math.abs(pLast - 7 / 90) < 1e-12 && Math.abs(lastW4 - 10000 * pLast) < 135, 'quizPick: the heaviest is left to last as often as picking without replacement says', {lastW4, expected: 10000 * pLast});
  // a:1 b:1 c:8, two picks: c is missing only after a,b or b,a, 2 × (1/10 × 1/9) = 2.2% (σ ≈ 10 of 5,000)
  let missed = 0;
  const r3 = t.rng(505), ABC = [{id: 'a', w: 1}, {id: 'b', w: 1}, {id: 'c', w: 8}];
  for (let n = 0; n < 5000; n++) if (!quizPick(ABC, 2, r3).includes('c')) missed++;
  t.ok(missed > 60 && missed < 165, 'quizPick: two picks from 1 : 1 : 8 miss the heavy one about 2.2% of the time', missed);
  // equal weights: 3 of 10, each id in 30% of 6,000 picks wherever it is listed (σ ≈ 35)
  const inPick = {}, r10 = t.rng(606), FLAT = TEN.map(c => ({id: c.id, w: 2.5}));
  for (let n = 0; n < 6000; n++) for (const id of quizPick(FLAT, 3, r10)) inPick[id] = (inPick[id] || 0) + 1;
  t.ok(FLAT.every(c => inPick[c.id] > 1620 && inPick[c.id] < 1980), 'quizPick: equal weights pick evenly, whatever the place in the list', inPick);

  // an rng stuck on one value ties every key; the picks must still be k distinct candidates
  for (const stuck of [0, 0.5, 0.999999]) {
    const out = quizPick(TEN, 4, () => stuck);
    t.ok(out.length === 4 && new Set(out).size === 4 && out.every(id => ids(TEN).includes(id)), `quizPick: copes with an rng stuck at ${stuck}`, out);
  }

  // second route: the spec's own key gives the same picks, on random candidate lists with repeats and bad weights among them
  const rq = t.rng(20261110), qint = n => Math.floor(rq() * n);
  let listed = 0;
  for (let n = 0; n < 400; n++) {
    const cands = Array.from({length: qint(30)}, () => ({id: 'q' + qint(40), w: rq() < 0.1 ? BADW[qint(BADW.length)] : rq() < 0.5 ? 1 + qint(20) : 0.2 + rq() * 12}));
    const k = qint(12), seed = 1 + qint(1e6);
    t.eq(quizPick(cands, k, t.rng(seed)), pickModel(cands, k, t.rng(seed)), `quizPick: second route agrees on list ${n} (${cands.length} candidates, k ${k})`);
    listed += cands.length;
  }
  t.ok(listed > 4000, 'the random lists are long enough to mean something', listed);

  // the real deck: a quiz of 10 from every vocabulary item, weighted
  const pool = deck.vocab.flatMap(g => g.items.map((it, i) => ({id: it.id, w: 1 + i % 5}))), poolIds = new Set(ids(pool));
  for (let seed = 1; seed <= 20; seed++) {
    const out = quizPick(pool, 10, t.rng(seed));
    t.ok(out.length === 10 && new Set(out).size === 10 && out.every(id => poolIds.has(id)), `quizPick: 10 distinct deck ids, seed ${seed}`, out);
  }
}
