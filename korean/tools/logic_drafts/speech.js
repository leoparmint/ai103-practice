/* ==== PURE:speech ==== */
const SPEECH = (() => {
  // Particles a word list may write as optional, in pairs: the first follows a final consonant, the second a vowel
  const PT = '을를이가은는';
  const coda = c => (c.charCodeAt(0) - 0xAC00) % 28 > 0;
  const tidy = v => String(v == null ? '' : v).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  // 마중(을) → 마중을. A bracket this leaves in place fails the character check in clean
  const full = s => s.replace(/([가-힣]?)([가-힣])\(([가-힣])\)/g, (m, b, c, p) => {
    const i = PT.indexOf(p);
    // It must fit the syllable before it; 이(가), 를(을) are "either form" notation, unless that 이 follows a vowel and so ends a noun (나이)
    return i >= 0 && coda(c) === !(i % 2) && (c !== PT[i ^ 1] || (c === '이' && b && !coda(b))) ? b + c + p : m;
  });
  const clean = raw => {
    const s = tidy(raw), parts = s.split(/ ?↔[\uFE0E\uFE0F]? ?| · /);
    if (parts.length > 1) {
      const out = parts.map(p => clean(p));
      // No comma after a part that already ends in its own punctuation
      return out.includes(null) ? null : out.reduce((a, p) => a + (/[.,?!]$/.test(a) ? ' ' : ', ') + p);
    }
    const t = full(s);
    return /^[가-힣 0-9.,?!]+$/.test(t) && /[가-힣]/.test(t) ? t : null;
  };
  const dictable = t => typeof t === 'string' && /[가-힣]/.test(t) && !/[\p{Nd}\p{Script=Latin}]/u.test(t);
  const loosen = s => tidy(tidy(s).replace(/[.,?!…~'"‘’“”。、，．？！～]/g, ''));
  return {clean, dictable, loosen};
})();
/* ==== END:speech ==== */
