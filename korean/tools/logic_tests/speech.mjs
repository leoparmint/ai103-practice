// Tests for PURE:speech, which lesson strings a text-to-speech voice may read.   node korean/tools/test_logic.mjs speech
//
// The tables are hand-checked. model() further down is a second route to the same answers, written as a
// character scanner with its own particle table so a slip in SPEECH's regexes cannot hide.

// raw → what clean returns (null = no speaker button)
const CLEAN = [
  // plain text passes through
  ['스트레스를 받다', '스트레스를 받다'],
  ['안녕하세요.', '안녕하세요.'],
  ['저는 차가 있어요. 근데 그 차는 비싸요.', '저는 차가 있어요. 근데 그 차는 비싸요.'],
  ['지금 눌러도 돼요?', '지금 눌러도 돼요?'],
  ['할머니, 제가 도와드릴게요!', '할머니, 제가 도와드릴게요!'],
  // digits stay (the voice reads them); dictable is what keeps them out of dictation
  ['11월 14일이에요.', '11월 14일이에요.'],
  ['제 생일은 11월 14일이에요.', '제 생일은 11월 14일이에요.'],
  ['2년 만에 가족이 다 모여요.', '2년 만에 가족이 다 모여요.'],
  ['1인 식당', '1인 식당'],
  ['5,000원이에요.', '5,000원이에요.'],
  // trimming and spacing
  ['', null], ['   ', null], ['\t\n', null],
  ['  안녕하세요.  ', '안녕하세요.'],
  ['저는   학생이에요.', '저는 학생이에요.'],
  ['네.\n좋아요.', '네. 좋아요.'],
  ['한\u00A0명', '한 명'],
  ['안녕\u200B하세요', '안녕하세요'],
  // nothing to read
  ['.', null], ['?!', null], ['123', null], ['3, 4', null],

  // an optional particle in brackets is read in full
  ['마중(을) 나가다', '마중을 나가다'],
  ['실수(를) 하다', '실수를 하다'],
  ['말실수(를) 하다', '말실수를 하다'],
  ['드라이브(를) 가다', '드라이브를 가다'],
  ['회식(을) 하다', '회식을 하다'],
  ['관리(를) 하다', '관리를 하다'],
  ['야단(을) 맞다', '야단을 맞다'],
  ['신경(을) 쓰다', '신경을 쓰다'],
  ['이(를) 닦다', '이를 닦다'],
  ['시간(이) 있다', '시간이 있다'],
  ['배(가) 고프다', '배가 고프다'],
  ['저(는) 학생이에요.', '저는 학생이에요.'],
  ['오늘(은) 바빠요.', '오늘은 바빠요.'],
  ['숙제(를) 하고 청소(를) 해요.', '숙제를 하고 청소를 해요.'],
  ['나이(가) 들다', '나이가 들다'],
  ['사이(가) 좋다', '사이가 좋다'],
  // any other bracket: no button
  ['(teacher) 제 남편은 사람이 많은 곳에 가면 피곤해해요.', null],
  ['(반말) 응, 김치를 만들 줄 알아.', null],
  ['사진을 (찍어도 / 찍어도 돼요)?', null],
  ['공원(에 / 에서) 피클볼을 쳤어요.', null],
  ['마중 (을) 나가다', null],
  ['(을) 나가다', null],
  ['마중( 을) 나가다', null],
  ['마중(을 나가다', null],
  ['마중을) 나가다', null],
  ['마중() 나가다', null],
  ['마중((을)) 나가다', null],
  ['3(을) 주세요', null],
  ['먹어(반말)', null],
  ['아버지(아빠)', null],
  ['친구(friend)', null],
  ['(으)로', null],
  ['(이)라서', null],
  // the particle has to fit the word: 을/이/은 after a final consonant, 를/가/는 after a vowel
  ['마중(를) 나가다', null],
  ['실수(을) 하다', null],
  ['시간(가) 있다', null],
  ['배(이) 고프다', null],
  ['저(은) 학생이에요.', null],
  ['오늘(는) 바빠요.', null],
  // "either form" notation is not a word with a particle
  ['이(가)', null], ['을(를)', null], ['를(을)', null], ['은(는)', null], ['는(은)', null], ['가(이)', null],
  ['이(가) 되다', null],
  ['사과를(을) 먹다', null],
  ['저는(은) 학생이에요.', null],
  // 이 after a final consonant may be the particle itself (책이) or part of a noun (고양이): not read, to be safe
  ['책이(가) 있다', null],
  ['고양이(가) 울다', null],
  // only 을/를, 이/가, 은/는 are expanded; other optional syllables get no button
  ['집(에) 가다', null],
  ['에 대해(서)', null],
  ['느라(고)', null],
  ['집(으)로', null],
  ['친구(도) 와요', null],

  // pairs are read as a list
  ['두껍다 ↔ 얇다', '두껍다, 얇다'],
  ['등 운동 · 다리 운동', '등 운동, 다리 운동'],
  ['시끄럽다 ↔ 조용하다', '시끄럽다, 조용하다'],
  ['한 명 · 다른 한 명', '한 명, 다른 한 명'],
  ['건강이 좋아지다 ↔ 나빠지다', '건강이 좋아지다, 나빠지다'],
  ['잠이 오다 ↔ 잠이 안 오다', '잠이 오다, 잠이 안 오다'],
  ['조금밖에 · 갈지 모르겠어요', '조금밖에, 갈지 모르겠어요'],
  ['두껍다↔얇다', '두껍다, 얇다'],
  ['두껍다 ↔\uFE0E 얇다', '두껍다, 얇다'],
  ['두껍다  ↔  얇다', '두껍다, 얇다'],
  ['가다 ↔ 오다 ↔ 서다', '가다, 오다, 서다'],
  ['봄 · 여름 · 가을 · 겨울', '봄, 여름, 가을, 겨울'],
  ['마중(을) 나가다 ↔ 배웅(을) 하다', '마중을 나가다, 배웅을 하다'],
  ['1층 ↔ 2층', '1층, 2층'],
  ['가요. · 와요.', '가요. 와요.'],
  ['가요? ↔ 와요!', '가요? 와요!'],
  // every part has to be speakable
  ['두껍다 ↔ thin', null],
  ['두껍다 ↔ (얇다)', null],
  ['↔ 조용하다', null],
  ['두껍다 ↔', null],
  ['↔', null],
  ['두껍다 ↔ ↔ 얇다', null],
  ['등 운동 · · 다리 운동', null],
  ['A · B', null],
  // a dot without spaces around it is not the list mark
  ['등·다리', null],
  ['등· 다리', null],

  // grammar patterns: jamo, hyphens, slashes
  ['-(으)ㄹ까 봐', null],
  ['-아/어서', null],
  ['-고 있다', null],
  ['은/는', null],
  ['V-느라(고)', null],
  ['ㄹ', null], ['ㅂ 불규칙', null], ['ㅋㅋ', null], ['갈ㄹ', null],
  // placeholders and Latin letters
  ['N년에 한 번', null],
  ['N에 따라 달라요', null],
  ['A/S 센터', null],
  ['N 덕분에', null],
  ['에 vs 에서', null],
  ["'Developer'는 한국어로 개발자라고 해요.", null],
  ['아마 3D 프린터를 살 것 같아요.', null],
  ['요즘 AI가 많이 똑똑해졌어요.', null],
  ['hello', null],
  // dialogue and gloss marks
  ['어제 3시간이나 청소했어요. — 3시간이나요?', null],
  ['지금 눌러도 돼요? — 그럼요.', null],
  ['애틀랜타에 한 달에 두 번 가요. = 2주에 한 번 가요.', null],
  ['만들다 → 만드느라', null],
  ['가: 안녕하세요.', null],
  ['"네"라고 했어요.', null],
  ['“네”라고 했어요.', null],
  ["'네'라고 했어요.", null],
  ['[받아요]', null],
  ['스트레스를 많이 ＿＿＿＿＿.', null],
  ['스트레스를 많이 ___.', null],
  ['드세요. / 일찍 주무세요.', null],
  // anything else outside the allowed set
  ['제가 주말에 오디세이를 봤거든요. 근데…', null],
  ['저는 재택근무하는데 …', null],
  ['좋아요~', null],
  ['열두 시 + 두 시', null],
  ['정말요？', null],
  ['10:30에 만나요.', null],
  ['50%예요.', null],
  ['좋아요 😀', null],
  ['韓國', null],
];

// cleaned text → may it be used for dictation
const DICTABLE = [
  ['안녕하세요.', true], ['스트레스를 받다', true], ['두껍다, 얇다', true], ['할머니, 제가 도와드릴게요!', true], ['네', true],
  ['11월 14일이에요.', false], ['1인 식당', false], ['2년 만에 가족이 다 모여요.', false], ['5,000원이에요.', false],
  ['요즘 AI가 많이 똑똑해졌어요.', false], ['3D 프린터', false], ['N에 따라 달라요', false], ['hello', false],
  ['１１월', false], ['ＡＩ가 똑똑해요', false],
  ['', false], [' ', false], ['.', false], ['?!', false], [null, false], [undefined, false], [5, false],
];

const LOOSEN = [
  ['안녕하세요.', '안녕하세요'],
  ['서울에 가 봤어요?', '서울에 가 봤어요'],
  ['할머니, 제가 도와드릴게요!', '할머니 제가 도와드릴게요'],
  ['두껍다, 얇다', '두껍다 얇다'],
  ['근데…', '근데'], ['근데...', '근데'], ['저는 재택근무하는데 …', '저는 재택근무하는데'],
  ['좋아요~', '좋아요'], ['좋아요~~!!', '좋아요'],
  ['"네," 하고 웃었어요.', '네 하고 웃었어요'],
  ['‘네’ “좋아요”', '네 좋아요'],
  ["'네'", '네'],
  ['  네 ,  좋아요 . ', '네 좋아요'],
  ['네.\n좋아요.', '네 좋아요'],
  ['정말요？', '정말요'], ['네。', '네'],
  ['안녕\u200B하세요', '안녕하세요'],
  ['', ''], ['   ', ''], ['?!', ''], [null, ''], [undefined, ''],
  // only punctuation goes: spacing and everything else is the learner's answer
  ['안녕 하세요', '안녕 하세요'],
  ['3-4시', '3-4시'],
  ['은/는', '은/는'],
  ['마중(을) 나가다', '마중(을) 나가다'],
];

// ---- Second route
const isH = c => c >= '가' && c <= '힣';
const hangul = s => [...s].filter(isH).join('');
// A syllable with a final consonant decomposes into three jamo, one without into two
const closed = c => c.normalize('NFD').length === 3;
const NEEDS = {을: true, 이: true, 은: true, 를: false, 가: false, 는: false};   // does it follow a final consonant?
const OTHER = {을: '를', 를: '을', 이: '가', 가: '이', 은: '는', 는: '은'};
// One part with no list mark in it, already trimmed and single-spaced
const scan = s => {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') {
      const p = s[i + 1], prev = s[i - 1] || '', prev2 = s[i - 2] || '';
      if (s[i + 2] !== ')' || !Object.hasOwn(NEEDS, p || '') || !isH(prev) || closed(prev) !== NEEDS[p]) return null;
      if (prev === OTHER[p] && !(prev === '이' && isH(prev2) && !closed(prev2))) return null;
      out += p; i += 2;
    } else if (isH(c) || ' 0123456789.,?!'.includes(c)) out += c;
    else return null;
  }
  return hangul(out) ? out : null;
};
const model = raw => {
  const parts = raw.replace(/\s+/g, ' ').trim().split('↔').flatMap(x => x.split(' · ')).map(x => scan(x.trim()));
  if (parts.includes(null)) return null;
  let out = parts[0];
  for (const p of parts.slice(1)) out += ('.,?!'.includes(out.slice(-1)) ? ' ' : ', ') + p;
  return out;
};

const ALLOWED = /^[가-힣 0-9.,?!]+$/;
const JAMO = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/;
const HYPHEN = /[-\u2010-\u2015\u2212]/;

export default async function (pure, t) {
  const { SPEECH } = pure;
  const { clean, dictable, loosen } = SPEECH;
  t.eq(Object.keys(SPEECH).sort(), ['clean', 'dictable', 'loosen'], 'SPEECH exposes clean, dictable, loosen');

  // What every non-null result must look like, whatever went in
  const sound = (raw, r, label) => {
    t.ok(r === null || typeof r === 'string', `${label}: a string or null`, r);
    if (typeof r !== 'string') return;
    t.ok(ALLOWED.test(r), `${label}: only Hangul, spaces, digits and . , ? !`, r);
    t.ok(/[가-힣]/.test(r), `${label}: has a Hangul syllable`, r);
    t.ok(!/[A-Za-z]/.test(r) && !JAMO.test(r) && !/[()]/.test(r), `${label}: no Latin letters, jamo or brackets`, r);
    t.ok(r === r.trim() && !/ {2}/.test(r), `${label}: trimmed, single spaces`, r);
    t.eq(clean(r), r, `${label}: cleaning twice changes nothing`);
    t.eq(hangul(r), hangul(String(raw).normalize('NFC')), `${label}: every syllable of the source, in order, and no others`);
    t.eq(dictable(r), !/[0-9]/.test(r), `${label}: dictable exactly when it has no digit`);
  };

  // ---- clean: the tables
  for (const [raw, want] of CLEAN) {
    const r = clean(raw);
    t.eq(r, want, `clean(${JSON.stringify(raw)})`);
    t.eq(model(raw.replace(/[\u200B\uFE0E]/g, '')), want, `second route agrees on ${JSON.stringify(raw)}`);
    sound(raw, r, `clean(${JSON.stringify(raw)})`);
  }
  t.eq(clean(null), null, 'clean(null)');
  t.eq(clean(undefined), null, 'clean(undefined)');
  t.eq(clean(42), null, 'clean(42): nothing Korean in it');
  t.eq(clean('한국어를 배워요.'.normalize('NFD')), '한국어를 배워요.', 'decomposed Hangul is composed first');
  t.eq(clean('마중(을) 나가다'.normalize('NFD')), '마중을 나가다', 'decomposed Hangul with an optional particle');
  // the spec's own pair: kept by clean, refused for dictation
  t.eq(clean('11월 14일이에요.'), '11월 14일이에요.', '11월 14일이에요. is speakable');
  t.eq(dictable(clean('11월 14일이에요.')), false, '11월 14일이에요. is not dictable');
  t.eq(dictable(clean('안녕하세요.')), true, '안녕하세요. is dictable');
  t.eq(dictable(clean('N에 따라 달라요')), false, 'dictable(null) is false');

  // every syllable a particle can follow: the bracket is filled exactly when the particle fits
  for (const c of ['중', '수', '물', '차', '밥', '나', '꽃', '개', '삶', '회', '값', '귀']) {
    for (const p of ['을', '를', '이', '가', '은', '는']) {
      const fits = closed(c) === NEEDS[p];
      t.eq(clean(`그 ${c}${c}(${p}) 봐요`), fits ? `그 ${c}${c}${p} 봐요` : null, `${c}${c}(${p}): ${fits ? 'read in full' : 'the particle does not fit'}`);
    }
  }
  // any other single syllable in brackets is not a particle this module vouches for
  for (const p of ['에', '의', '도', '만', '로', '와', '과', '서', '고', '요', '들', '님']) t.eq(clean(`친구(${p}) 가요`), null, `(${p}) is not expanded`);

  // ---- dictable and loosen: the tables
  for (const [text, want] of DICTABLE) t.eq(dictable(text), want, `dictable(${JSON.stringify(text)})`);
  for (const [s, want] of LOOSEN) {
    t.eq(loosen(s), want, `loosen(${JSON.stringify(s)})`);
    t.eq(loosen(loosen(s)), want, `loosen twice: ${JSON.stringify(s)}`);
  }
  t.eq(loosen('한국어를 배워요.'.normalize('NFD')), '한국어를 배워요', 'loosen composes decomposed Hangul');
  t.eq(loosen('할머니 드세요'), loosen('할머니, 드세요.'), 'an answer typed without punctuation matches the model');
  t.eq(loosen('서울에 가 봤어요'), loosen('서울에 가 봤어요?'), 'a missing question mark does not count');
  t.ok(loosen('안녕 하세요') !== loosen('안녕하세요'), 'spacing is still part of the answer');
  t.ok(loosen('안녕하세요') !== loosen('안녕하새요'), 'spelling is still part of the answer');

  // ---- inputs are not changed, results do not depend on call order
  const frozen = Object.freeze(['마중(을) 나가다', '두껍다 ↔ 얇다']);
  t.eq(frozen.map(x => clean(x)), ['마중을 나가다', '두껍다, 얇다'], 'clean on frozen input');
  t.eq([clean('두껍다 ↔ 얇다'), clean('마중(을) 나가다'), clean('두껍다 ↔ 얇다')], ['두껍다, 얇다', '마중을 나가다', '두껍다, 얇다'], 'no state between calls');

  // ---- random strings: the second route agrees, and every result is sound
  // mostly speakable pieces, with a stray mark now and then
  const GOOD = ['가', '나', '이', '를', '을', '는', '은', '중', '수', '책', '양', '해요', ' ', ' ', ' ', '.', ',', '?', '!', '1', '9',
    ' ↔ ', ' · ', '(을)', '(를)', '(가)', '(이)', '(는)', '(은)', '마중(을)', '실수(를)', '나이(가)', '이(가)', '를(을)'];
  const BAD = ['N', 'a', '-', '/', '(', ')', 'ㄹ', '—', '…', '↔', '·', '(에)', '(반말)', '~', '"'];
  const rnd = t.rng(20261110), pick = l => l[Math.floor(rnd() * l.length)];
  let kept = 0, lists = 0, filled = 0;
  for (let n = 0; n < 4000; n++) {
    let raw = '';
    for (let k = 1 + Math.floor(rnd() * 7); k > 0; k--) raw += pick(rnd() < 0.12 ? BAD : GOOD);
    const r = clean(raw);
    t.eq(r, model(raw), `random: second route agrees on ${JSON.stringify(raw)}`);
    sound(raw, r, `random ${JSON.stringify(raw)}`);
    if (r !== null) { kept++; if (/[↔·]/.test(raw)) lists++; if (raw.includes('(')) filled++; }
    const l = loosen(raw);
    t.ok(!/[.,?!…]/.test(l) && l === l.trim() && !/\s{2}/.test(l), `random: loosen leaves no punctuation or loose spaces in ${JSON.stringify(raw)}`, l);
    t.eq(hangul(l), hangul(raw), `random: loosen keeps every syllable of ${JSON.stringify(raw)}`);
  }
  t.ok(kept > 400 && lists > 40 && filled > 40, 'the random strings exercise speakable text, lists and filled brackets', {kept, lists, filled});

  // ---- the real deck
  const deck = t.deck();
  const vocab = deck.vocab.flatMap(g => g.items.map(i => i.ko));
  const points = deck.units.flatMap(u => u.points);
  const examples = points.flatMap(p => p.examples.map(e => e.ko));
  const selftest = deck.units.flatMap(u => u.selftest.map(s => s.ko));
  const right = deck.mistakes.map(m => m.right);
  const patterns = points.map(p => p.pattern);
  t.ok(vocab.length > 400 && examples.length > 200 && selftest.length > 100 && right.length > 40 && patterns.length > 50, 'the deck has the fields the sweep reads',
    {vocab: vocab.length, examples: examples.length, selftest: selftest.length, right: right.length, patterns: patterns.length});

  const share = {};
  for (const [kind, list] of Object.entries({vocab, examples, selftest, right, patterns})) {
    let ok = 0;
    for (const raw of list) {
      const r = clean(raw), label = `deck ${kind} ${JSON.stringify(raw)}`;
      sound(raw, r, label);
      t.eq(r, model(raw), `${label}: second route agrees`);
      // text that is already plain must come back as it is: a rule may not be stricter than the allowed set
      if (ALLOWED.test(raw) && /[가-힣]/.test(raw)) t.eq(r, raw.replace(/\s+/g, ' ').trim(), `${label}: plain text is kept as written`);
      if (/[A-Za-z]/.test(raw) || JAMO.test(raw) || /[—=→:/…'"\[\]＿]/.test(raw)) t.eq(r, null, `${label}: Latin letters, jamo and gloss marks are refused`);
      if (r !== null) ok++;
    }
    share[kind] = {ok, of: list.length, pct: Math.round(1000 * ok / list.length) / 10};
  }
  t.ok(share.vocab.ok >= 0.9 * share.vocab.of, `at least 90% of vocabulary is speakable: ${share.vocab.ok}/${share.vocab.of}`, share.vocab);
  t.ok(share.examples.ok >= 0.9 * share.examples.of, `at least 90% of example sentences are speakable: ${share.examples.ok}/${share.examples.of}`, share.examples);
  t.ok(share.selftest.ok >= 0.9 * share.selftest.of, `at least 90% of self-test sentences are speakable: ${share.selftest.ok}/${share.selftest.of}`, share.selftest);
  t.ok(share.right.ok >= 0.85 * share.right.of, `at least 85% of corrected sentences are speakable: ${share.right.ok}/${share.right.of}`, share.right);

  // grammar patterns are notation, not speech
  const notation = patterns.filter(p => HYPHEN.test(p) || JAMO.test(p));
  t.ok(notation.length > 30, 'the deck has grammar patterns written with hyphens or jamo', notation.length);
  for (const p of notation) t.eq(clean(p), null, `pattern ${JSON.stringify(p)} is not speakable`);

  // the optional particles and pairs the deck really has come out in full
  const brackets = vocab.filter(v => /\(/.test(v)), pairs = vocab.filter(v => /↔| · /.test(v));
  t.ok(brackets.length >= 5 && pairs.length >= 6, 'the deck has optional particles and pairs to check', {brackets: brackets.length, pairs: pairs.length});
  for (const v of brackets) t.eq(clean(v), v.replace(/[()]/g, ''), `deck ${JSON.stringify(v)}: the particle is read`);
  for (const v of pairs) t.eq(clean(v), v.replace(/ (↔|·) /g, ', '), `deck ${JSON.stringify(v)}: read as a list`);

  // choices in brackets and blanks never get a voice
  for (const m of deck.mixups) t.eq(clean(m.test), null, `mixup ${JSON.stringify(m.test)}: a choice in brackets is not speakable`);
  const blanks = deck.workbook.flatMap(p => p.groups.flatMap(g => g.items.map(i => i.q))).filter(q => typeof q === 'string' && q.includes('＿'));
  t.ok(blanks.length > 50, 'the workbook has questions with blanks', blanks.length);
  for (const q of blanks) t.eq(clean(q), null, `workbook ${JSON.stringify(q)}: a blank is not speakable`);

  // dictation: no digits, and what is left to compare is plain Hangul
  const spoken = [...vocab, ...examples, ...selftest, ...right].map(x => clean(x)).filter(x => x !== null);
  const digits = spoken.filter(x => /[0-9]/.test(x));
  t.ok(digits.length >= 5, 'the deck has speakable text with digits', digits.length);
  for (const x of digits) t.eq(dictable(x), false, `dictable(${JSON.stringify(x)}) is false: it has a digit`);
  const dict = spoken.filter(x => dictable(x));
  t.ok(dict.length >= 0.9 * spoken.length, `most speakable text can be dictated: ${dict.length}/${spoken.length}`);
  for (const x of dict) t.ok(/^[가-힣]+( [가-힣]+)*$/.test(loosen(x)), `loosen(${JSON.stringify(x)}) is Hangul words with single spaces`, loosen(x));
}
