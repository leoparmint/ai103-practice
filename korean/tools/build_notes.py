#!/usr/bin/env python3
"""Write korean/notes.html: every word and grammar point on one page.

The flashcard page (index.html) draws its Notes tab with JavaScript and folds
each set and point away, which is good for browsing but not for the browser's
own Find (Ctrl+F). This page is plain, fully expanded HTML with a table of
contents, so Find reaches everything on the first try, on any device.

    python3 korean/tools/build_notes.py     # reads deck.json, writes notes.html

build.py calls write_notes() after every successful build, so the page stays in
step with deck.json. The color theme follows the one picked on the flashcard
page: the theme script is copied from index.html (same site, same saved key).
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DECK = os.path.join(ROOT, 'deck.json')
PAGE = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, 'notes.html')

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def esc(t):
    return html.escape(t or '', quote=True)


def fmt_date(iso):
    y, m, d = (int(x) for x in iso[:10].split('-'))
    return '%s %d, %d' % (MONTHS[m - 1], d, y)


def theme_script():
    """The <script> in index.html's <head> that holds THEMES and applies the saved theme."""
    with open(PAGE, encoding='utf-8') as f:
        page = f.read()
    for m in re.finditer(r'<script>(.*?)</script>', page, re.S):
        if '/* THEMES:START */' in m.group(1):
            return m.group(1).strip()
    raise SystemExit('build_notes: no THEMES script found in index.html')


class Linker:
    """Turns note IDs in a line (G51, V21, mix-up 36, mistake 45) into in-page links."""

    def __init__(self, deck):
        self.codes = {s['code'] for s in deck['vocab']}
        self.codes |= {p['code'] for u in deck['units'] for p in u['points']}
        self.mixups = {str(m['n']) for m in deck['mixups']}
        self.mistakes = {str(m['n']) for m in deck['mistakes']}
        self.rx = re.compile(r'\b([VG]\d{1,3})\b|\b(mix-ups?|mistakes?)(\s+)(\d+)', re.I)

    def _sub(self, m):
        if m.group(1):
            code = m.group(1)
            return '<a href="#%s">%s</a>' % (code, code) if code in self.codes else code
        word, space, n = m.group(2), m.group(3), m.group(4)
        if word.lower().startswith('mix') and n in self.mixups:
            return '<a href="#mixup-%s">%s%s%s</a>' % (n, word, space, n)
        if word.lower().startswith('mistake') and n in self.mistakes:
            return '<a href="#mistake-%s">%s%s%s</a>' % (n, word, space, n)
        return m.group(0)

    def html(self, s):
        """Link IDs in an already-escaped HTML string, leaving tags and existing links alone."""
        out, in_a = [], False
        for part in re.split(r'(<[^>]+>)', s):
            if part.startswith('<'):
                if re.match(r'<a[\s>]', part, re.I):
                    in_a = True
                elif re.match(r'</a\s*>', part, re.I):
                    in_a = False
                out.append(part)
            else:
                out.append(part if in_a else self.rx.sub(self._sub, part))
        return ''.join(out)

    def text(self, t):
        return self.html(esc(t))

    def see(self, codes):
        links = []
        for c in codes:
            if c in self.codes:
                links.append('<a href="#%s">%s</a>' % (c, c))
            elif c.startswith('mixup ') and c[6:] in self.mixups:
                links.append('<a href="#mixup-%s">Mix-up %s</a>' % (c[6:], c[6:]))
            elif c.startswith('mistake ') and c[8:] in self.mistakes:
                links.append('<a href="#mistake-%s">Mistake %s</a>' % (c[8:], c[8:]))
            else:
                links.append(esc(c))
        return ', '.join(links)


def code_ranges(codes):
    """['G1', 'G2', 'G3', 'G63'] -> 'G1–G3, G63'."""
    nums = sorted(int(c[1:]) for c in codes)
    out, start, prev = [], None, None
    for n in nums + [None]:
        if start is None:
            start = prev = n
        elif n is not None and n == prev + 1:
            prev = n
        else:
            out.append('G%d' % start if start == prev else 'G%d–G%d' % (start, prev))
            start = prev = n
    return ', '.join(out)


def vocab_table(s, link):
    rows = ''.join(
        '<tr><td class="ko" lang="ko" data-l="Korean">%s</td><td data-l="English">%s</td><td class="mut ko" lang="ko" data-l="Notes">%s</td></tr>'
        % (esc(it['ko']), link.text(it['en']), link.text(it['notes']))
        for it in s['items'])
    return ('<div class="tw"><table class="nt stack vt"><thead><tr><th>한국어</th><th>English</th><th>Notes</th></tr></thead>'
            '<tbody>%s</tbody></table></div>' % rows)


def point_body(p, link):
    out = []
    for b in p['blocks']:
        if b['t'] == 'ul':
            out.append('<ul class="rules">%s</ul>' % ''.join('<li>%s</li>' % link.html(x) for x in b['items']))
        elif b['t'] == 'p':
            out.append('<p>%s</p>' % link.html(b['html']))
        elif b['t'] == 'table':
            head = ''.join('<th>%s</th>' % esc(x) for x in b['head'])
            body = ''.join('<tr>%s</tr>' % ''.join(
                '<td data-l="%s">%s</td>' % (esc(b['head'][i] if i < len(b['head']) else ''), link.text(x))
                for i, x in enumerate(r)) for r in b['rows'])
            out.append('<div class="tw"><table class="nt stack"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (head, body))
    if p['examples']:
        out.append('<p class="glabel">Examples · %d</p><ul class="ex">%s</ul>' % (len(p['examples']), ''.join(
            '<li><span class="ko" lang="ko">%s</span><span class="en">%s</span></li>' % (esc(x['ko']), link.text(x['en']))
            for x in p['examples'])))
    return ''.join(out)


def build(deck):
    link = Linker(deck)
    st = deck['stats']
    latest = fmt_date(deck['latest']['date'])
    built = fmt_date(deck['built'])

    # Contents
    toc_v = ''.join(
        '<li><a href="#%s"><span class="code">%s</span><span class="tt">%s</span><span class="cnt">%d</span></a></li>'
        % (s['code'], s['code'], esc(s['title']), len(s['items'])) for s in deck['vocab'])
    toc_g = ''
    for u in deck['units']:
        pts = ''.join('<li><a href="#%s"><span class="code">%s</span><span class="tt ko" lang="ko">%s</span></a></li>'
                      % (p['code'], p['code'], esc(p['title'])) for p in u['points'])
        toc_g += ('<div class="tunit"><p class="tuh"><a href="#unit-%d">Unit %d · %s</a> <span class="cnt">%s</span></p><ul class="tlist">%s</ul></div>'
                  % (u['n'], u['n'], esc(u['title']), code_ranges([p['code'] for p in u['points']]), pts))

    # Vocabulary
    vocab = ''.join(
        '<section class="set" id="%s"><h3><a class="code" href="#%s">%s</a> %s <span class="cnt">%d words</span></h3>%s</section>'
        % (s['code'], s['code'], s['code'], esc(s['title']), len(s['items']), vocab_table(s, link))
        for s in deck['vocab'])

    # Grammar
    grammar = ''
    for u in deck['units']:
        grammar += ('<section class="unit" id="unit-%d"><h3>Unit %d · %s <span class="cnt">%s</span></h3>'
                    % (u['n'], u['n'], esc(u['title']), code_ranges([p['code'] for p in u['points']])))
        for p in u['points']:
            grammar += ('<article class="pt" id="%s"><h4><a class="code" href="#%s">%s</a> <span class="ko" lang="ko">%s</span></h4>%s</article>'
                        % (p['code'], p['code'], p['code'], esc(p['title']), point_body(p, link)))
        grammar += '</section>'

    # Mix-ups and mistakes
    mix_rows = ''.join(
        '<tr id="mixup-%s"><td class="mut" data-l="#">%s</td><td class="ko" lang="ko" data-l="Pair">%s</td><td data-l="Difference">%s</td>'
        '<td class="ko mut" lang="ko" data-l="Quick test">%s</td><td class="ko" lang="ko" data-l="Answer">%s</td><td class="mut" data-l="See">%s</td></tr>'
        % (esc(m['n']), esc(m['n']), esc(m['pair']), link.text(m['diff']), esc(m['test']), esc(m['answer']), link.see(m['see']))
        for m in deck['mixups'])
    mis_rows = ''.join(
        '<tr id="mistake-%s"><td class="mut" data-l="#">%s</td><td class="ko" lang="ko" data-l="Don\'t say"><span class="wrong">%s</span></td>'
        '<td class="ko" lang="ko" data-l="Say">%s</td><td data-l="Why">%s</td><td class="mut" data-l="See">%s</td></tr>'
        % (esc(m['n']), esc(m['n']), esc(m['wrong']), esc(m['right']), link.text(m['why']), link.see(m['see']))
        for m in deck['mistakes'])

    return TEMPLATE.format(
        theme=theme_script(),
        css=CSS,
        words=st['words'], sets=st['sets'], points=st['points'], units=st['units'],
        examples=st['examples'], nmix=st['mixups'], nmis=st['mistakes'],
        latest=latest, built=built,
        toc_v=toc_v, toc_g=toc_g, vocab=vocab, grammar=grammar,
        mix_rows=mix_rows, mis_rows=mis_rows,
    )


def write_notes(deck):
    page = build(deck)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(page)
    os.replace(tmp, OUT)
    return OUT


CSS = r"""
:root{
  --bg:#21222C; --surface:#282A36; --surface2:#2E3040; --code-bg:#191A21; --line:#44475A;
  --ink:#F8F8F2; --muted:#A9B1D6; --faint:#6272A4;
  --accent:#BD93F9; --accent-ink:#21222C; --link:#8BE9FD;
  --good:#50FA7B; --miss:#FF6E6E; --rev:#FFB86C; --new:#8BE9FD; --pink:#FF79C6; --yellow:#F1FA8C;
  --accent-soft:color-mix(in srgb, var(--accent) 22%, var(--surface));
  --row-line:color-mix(in srgb, var(--line) 55%, transparent);
  --target:color-mix(in srgb, var(--accent) 12%, var(--surface));
  --display:"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --body:"Source Sans 3", "Noto Sans KR", "Segoe UI", system-ui, sans-serif;
  --ko:"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  --mono:"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
  --barh:48px;
  color-scheme:dark;
  scrollbar-color:var(--line) var(--bg);
}
:root[data-theme="dracula"]{--accent-soft:#3A3452}
::selection{background:var(--line); color:var(--ink)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%; scroll-padding-top:calc(var(--barh) + 12px)}
/* keep-all: Korean lines break between words, not inside them */
body{margin:0; background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.5; word-break:keep-all; overflow-wrap:break-word}
a{color:var(--link)}
.ko{font-family:var(--ko)}
.code{font-family:var(--mono); font-weight:500; color:var(--accent); text-decoration:none}
.cnt{font-family:var(--mono); font-size:.72rem; font-weight:400; color:var(--muted); letter-spacing:.02em}
.mut{color:var(--muted)}

/* Section bar: English labels only, so Find never stops on it */
.bar{position:sticky; top:0; z-index:10; background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border-bottom:1px solid var(--line)}
.barin{max-width:900px; margin:0 auto; padding:0 16px; height:var(--barh); display:flex; align-items:center; gap:4px; overflow-x:auto; scrollbar-width:none}
.barin::-webkit-scrollbar{display:none}
.barin a{flex:none; font-size:.92rem; font-weight:600; color:var(--muted); text-decoration:none; padding:6px 10px; border-radius:8px; white-space:nowrap}
.barin a:hover, .barin a:focus-visible{color:var(--ink); background:var(--surface)}
.barin a.home{color:var(--accent); margin-right:6px}

.wrap{max-width:900px; margin:0 auto; padding:24px 16px 64px; display:flex; flex-direction:column; gap:28px}
header{display:flex; flex-direction:column; gap:8px}
.eyebrow{font-family:var(--mono); font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted)}
h1{font-family:var(--display); font-weight:700; font-size:1.9rem; line-height:1.15; margin:0; letter-spacing:-.01em}
h2{font-family:var(--display); font-weight:700; font-size:1.45rem; margin:0; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap}
h3{font-family:var(--display); font-weight:600; font-size:1.15rem; margin:0; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap}
h4{font-weight:600; font-size:1.05rem; margin:0; display:flex; align-items:baseline; gap:8px; flex-wrap:wrap}
.lede{margin:0; color:var(--muted); max-width:66ch}
.tip{margin:0; padding:10px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--line); border-left:4px solid var(--accent); max-width:66ch}
kbd{font-family:var(--mono); font-size:.78rem; border:1px solid var(--line); border-bottom-width:2px; border-radius:4px; padding:0 5px; background:var(--surface2); color:var(--ink)}
.big{display:flex; flex-direction:column; gap:16px}
.big > h2{padding-bottom:8px; border-bottom:1px solid var(--line)}

/* Contents */
.toc{display:flex; flex-direction:column; gap:18px}
.toc h3{font-size:1rem}
.toc h3 a{color:var(--ink); text-decoration:none}
.toc h3 a:hover{color:var(--accent)}
.tsets{list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:2px 16px}
.tsets a, .tlist a{display:flex; align-items:baseline; gap:8px; padding:4px 6px; border-radius:6px; color:var(--ink); text-decoration:none}
.tsets a:hover, .tlist a:hover{background:var(--surface)}
.tsets .code, .tlist .code{flex:none; min-width:2.6em}
.tsets .tt{flex:1}
.tunits{display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:14px 20px}
.tunit{display:flex; flex-direction:column; gap:2px}
.tuh{margin:0 0 2px; font-weight:600}
.tuh a{color:var(--ink); text-decoration:none}
.tuh a:hover{color:var(--accent)}
.tlist{list-style:none; margin:0; padding:0}
.tlist .tt{font-size:.95rem}
.tother{display:flex; flex-wrap:wrap; gap:8px 18px; margin:0}

/* Vocabulary and grammar */
.set, .unit{display:flex; flex-direction:column; gap:10px}
.unit{gap:14px}
.unit > h3{padding-top:4px}
.pt{border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:14px 16px; display:flex; flex-direction:column; gap:10px; min-width:0}
.pt p{margin:0}
.rules{margin:0; padding-left:1.2em; display:flex; flex-direction:column; gap:5px}
.glabel{font-family:var(--mono); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:2px 0 0}
.ex{list-style:none; margin:0; padding:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:6px 18px}
.ex li{display:contents}
.ex .ko{font-size:1.02rem; padding-left:10px; border-left:2px solid var(--line)}
.ex .en{color:var(--muted); font-size:.95rem}
:target{scroll-margin-top:calc(var(--barh) + 12px)}
.pt:target, .set:target > h3, tr:target{background:var(--target)}
.pt:target{border-color:var(--accent)}

.tw{overflow-x:auto; max-width:100%}
table.nt{width:100%; border-collapse:collapse; font-size:.97rem}
table.nt th{font-family:var(--mono); font-size:.66rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); text-align:left; padding:6px 10px 6px 0; border-bottom:1px solid var(--line); font-weight:500; vertical-align:bottom}
table.nt td{padding:7px 10px 7px 0; border-bottom:1px solid var(--row-line); vertical-align:top}
table.nt td.ko{font-size:1.03rem}
table.vt td:first-child{width:30%; font-weight:500}
table.vt td:nth-child(2){width:32%}
.wrong{text-decoration:line-through; text-decoration-color:var(--miss); color:var(--miss)}
footer{color:var(--muted); font-size:.9rem; border-top:1px solid var(--line); padding-top:14px}
footer p{margin:0 0 4px}

@media (max-width:640px){
  .barin{gap:0; padding:0 8px; -webkit-mask-image:linear-gradient(90deg, #000 85%, transparent); mask-image:linear-gradient(90deg, #000 85%, transparent)}
  .barin a{font-size:.88rem; padding:6px 8px}
  .barin a.home{margin-right:2px}
  .ex{grid-template-columns:minmax(0,1fr); gap:2px}
  .ex .en{padding-left:12px; margin-bottom:8px}
  table.nt.stack thead{display:none}
  table.nt.stack, table.nt.stack tbody, table.nt.stack tr, table.nt.stack td{display:block; width:auto !important}
  table.nt.stack tr{padding:8px 0; border-bottom:1px solid var(--row-line)}
  table.nt.stack td{border:0; padding:1px 0}
  table.nt.stack td[data-l]:not(:first-child)::before{content:attr(data-l) " · "; font-family:var(--mono); font-size:.62rem; letter-spacing:.06em; text-transform:uppercase; color:var(--faint)}
  table.vt.stack td[data-l]::before{content:none !important}
  table.vt td:first-child{font-size:1.08rem}
  .pt{padding:12px}
  h1{font-size:1.6rem}
}
@media print{
  :root{--bg:#fff; --surface:#fff; --surface2:#f3f3f3; --ink:#111; --muted:#444; --faint:#666; --line:#bbb; --accent:#4b2a99; --link:#1a4f8a; --miss:#b00020}
  .bar, .tip{display:none}
  .pt{break-inside:avoid}
  a{color:inherit; text-decoration:none}
}
"""

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Every word and grammar point from Darren's Korean lessons on one page, with a table of contents">
<meta name="robots" content="noindex, nofollow">
<title>Korean Notes</title>
<meta name="theme-color" content="#21222C">
<meta name="color-scheme" content="dark">
<meta name="darkreader-lock">
<script>
{theme}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&family=Source+Sans+3:wght@400;600&display=swap">
<style>{css}</style>
</head>
<body>
<nav class="bar" aria-label="Sections"><div class="barin">
  <a class="home" href="./">&larr; Flashcards</a>
  <a href="#contents">Contents</a>
  <a href="#vocabulary">Vocabulary</a>
  <a href="#grammar">Grammar</a>
  <a href="#mixups">Mix-ups</a>
  <a href="#mistakes">Mistakes</a>
</div></nav>
<main class="wrap">
  <header>
    <span class="eyebrow">Korean Review Notes &middot; one page</span>
    <h1>Korean Notes</h1>
    <p class="lede">{words} words in {sets} sets, {points} grammar points in {units} units with {examples} example sentences, {nmix} mix-ups and {nmis} recurring mistakes, through the {latest} lesson.</p>
    <p class="tip">Press <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>&#8984;</kbd>+<kbd>F</kbd> on a Mac, or <b>Find in page</b> on a phone) and type in Korean or English. Everything below is open, so Find reaches all of it. Codes like G51 or V21 are links.</p>
  </header>

  <section class="big" id="contents">
    <h2>Contents</h2>
    <div class="toc">
      <div>
        <h3><a href="#vocabulary">Vocabulary</a> <span class="cnt">{words} words &middot; {sets} sets</span></h3>
        <ul class="tsets">{toc_v}</ul>
      </div>
      <div>
        <h3><a href="#grammar">Grammar</a> <span class="cnt">{points} points &middot; {units} units</span></h3>
        <div class="tunits">{toc_g}</div>
      </div>
      <div>
        <h3>Also on this page</h3>
        <p class="tother"><a href="#mixups">Mix-ups ({nmix})</a><a href="#mistakes">Recurring mistakes ({nmis})</a></p>
      </div>
    </div>
  </section>

  <section class="big" id="vocabulary">
    <h2>Vocabulary <span class="cnt">{words} words &middot; {sets} sets</span></h2>
    {vocab}
  </section>

  <section class="big" id="grammar">
    <h2>Grammar <span class="cnt">{points} points &middot; {units} units</span></h2>
    {grammar}
  </section>

  <section class="big" id="mixups">
    <h2>Mix-ups <span class="cnt">{nmix} look-alike pairs</span></h2>
    <div class="tw"><table class="nt stack"><thead><tr><th>#</th><th>Pair</th><th>The difference</th><th>Quick test</th><th>Answer</th><th>See</th></tr></thead><tbody>{mix_rows}</tbody></table></div>
  </section>

  <section class="big" id="mistakes">
    <h2>Recurring mistakes <span class="cnt">{nmis} corrections from lessons</span></h2>
    <div class="tw"><table class="nt stack"><thead><tr><th>#</th><th>Don't say</th><th>Say</th><th>Why</th><th>See</th></tr></thead><tbody>{mis_rows}</tbody></table></div>
  </section>

  <footer>
    <p>Built from the Korean Review Notes on {built}, through the {latest} lesson. It refreshes with the flashcards after each lesson update.</p>
    <p><a href="./">Back to the flashcards</a> &middot; <a href="#contents">Back to contents</a></p>
  </footer>
</main>
</body>
</html>
"""


def main():
    with open(DECK, encoding='utf-8') as f:
        deck = json.load(f)
    path = write_notes(deck)
    print('Wrote %s (%d KB)' % (os.path.relpath(path), os.path.getsize(path) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
