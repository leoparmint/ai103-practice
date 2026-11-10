/* ==== PURE:kutil ==== */
const KUTIL = (() => {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  // Composed first: a decomposed syllable is outside 가–힣, so a hint would show the whole answer
  const nfc = v => typeof v === 'string' ? v.normalize('NFC') : '';
  const chosung = s => nfc(s).replace(/[가-힣]/g, c => CHO[Math.floor((c.charCodeAt(0) - 0xAC00) / 588)]);

  const chipsOf = ko => {
    const s = nfc(ko).trim();
    // A . ? ! with text after it starts a second sentence
    if (/[.?!](?![\s.?!…]*$)/.test(s)) return null;
    const chips = s.split(/[\s,]+/).map(w => w.replace(/[.?!…]+$/, '')).filter(Boolean);
    // Every chip must be a plain Hangul word: this is what refuses dashes, =, brackets, quotes, Latin letters and digits
    return chips.length < 3 || chips.length > 8 || chips.some(c => /[^가-힣]/.test(c)) ? null : chips;
  };
  const sameOrder = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  const shuffled = (arr, rng) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    // Never the answer itself: one rotation changes the order unless every value is the same
    if (out.length > 1 && sameOrder(out, arr)) out.push(out.shift());
    return out;
  };

  const quizPick = (cands, k, rng) => {
    const keyed = [];
    // Efraimidis–Spirakis: the k largest u ** (1 / w) win. log(u) / w sorts the same and a small w cannot underflow it into ties
    for (const c of cands || []) if (c && Number.isFinite(c.w) && c.w > 0) keyed.push([Math.log(rng()) / c.w, c.id]);
    keyed.sort((a, b) => b[0] - a[0]);
    // An id listed twice keeps its best key, which is the same as adding its weights
    return [...new Set(keyed.map(x => x[1]))].slice(0, Math.max(0, k));
  };
  return {chosung, chipsOf, shuffled, sameOrder, quizPick};
})();
/* ==== END:kutil ==== */
