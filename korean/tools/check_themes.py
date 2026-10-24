#!/usr/bin/env python3
"""Contrast check for the color themes in korean/index.html.

    python3 korean/tools/check_themes.py [-v] [theme ...]

Reads the THEMES object from the page, rebuilds the colors the CSS mixes from each
palette (color-mix in sRGB, plus the per-theme overrides in the stylesheet), and
checks WCAG contrast for every pairing the page uses. Exits 1 if any pair is below
its minimum; "low" lines are below the target but still pass.
"""
import os
import re
import sys

PAGE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'index.html')


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mix(a, b, pa):
    """color-mix(in srgb, a pa, b); a transparent b means 'over the panel behind it'."""
    return tuple(x * pa + y * (1 - pa) for x, y in zip(a, b))


def lum(c):
    def ch(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def load_themes():
    src = open(PAGE, encoding='utf-8').read()
    body = re.search(r'/\* THEMES:START \*/(.*?)/\* THEMES:END \*/', src, re.S).group(1)
    themes = {}
    for key, inner in re.findall(r'^\s*(\w+): \{(.*)\}', body, re.M):
        themes[key] = dict(re.findall(r'(\w+): "([^"]*)"', inner))
    return themes


def colors(key, t):
    C = {k: rgb(v) for k, v in t.items() if v.startswith('#')}
    s = C['surface']
    C['accentSoft'] = mix(C['accent'], s, .22)
    C['goodSoft'] = mix(C['good'], s, .18)
    C['missSoft'] = mix(C['miss'], s, .18)
    C['warnSoft'] = mix(C['warn'], s, .14)
    C['markBg'] = mix(C['yellow'], s, .18)
    C['key'] = mix(C['line'], s, .55)
    C['keyVowel'] = mix(C['accent'], C['ink'], .55)
    C['markText'] = C['yellow']
    C['keyShift'] = C['yellow']
    C['tabBadge'] = mix(C['accentInk'], C['accent'], .22)
    if key == 'dracula':  # fixed fills, same as the original page
        C.update(accentSoft=rgb('#3A3452'), goodSoft=rgb('#1E3A2B'), missSoft=rgb('#45252C'),
                 warnSoft=mix(C['warn'], s, .14), markBg=mix(C['yellow'], s, .18),
                 key=rgb('#343746'), keyVowel=rgb('#D6BCFA'))
    if key == 'solarized':
        C['keyShift'] = mix(C['yellow'], C['ink'], .8)
        C['markText'] = mix(C['yellow'], C['ink'], .7)
    if key in ('solarized', 'monokai', 'nord'):
        C['tabBadge'] = mix(C['ink'], C['accent'], .25)
    C['keyShiftBg'] = C['key']  # shifted keys are marked by a yellow bottom bar, not a fill
    C['zero'] = mix(C['faint'], C['line'], .5)
    return C


CHECKS = [
    # foreground, background, minimum, target, where it appears
    ('ink', 'bg', 4.5, 7, 'body text on the page'),
    ('ink', 'surface', 4.5, 7, 'card text'),
    ('ink', 'surface2', 4.5, 7, 'raised buttons'),
    ('ink', 'code', 4.5, 7, 'keyboard tray'),
    ('muted', 'bg', 4.5, 4.5, 'secondary text on the page'),
    ('muted', 'surface', 4.5, 4.5, 'secondary text on cards'),
    ('faint', 'surface', 3.0, 3.0, 'small hints'),
    ('faint', 'bg', 3.0, 3.0, 'answer-box placeholder'),
    ('accentInk', 'accent', 4.5, 7, 'selected tab, primary buttons, pressed 한'),
    ('accentInk', 'tabBadge', 4.5, 4.5, 'due count on the selected tab'),
    ('accent', 'surface', 3.0, 4.5, 'accent text, focus rings, checked swatch ring'),
    ('accent', 'bg', 3.0, 4.5, 'accent text on the page'),
    ('accent', 'accentSoft', 3.0, 4.5, 'pressed toggle chip'),
    ('link', 'surface', 4.5, 4.5, 'links'),
    ('link', 'bg', 4.5, 4.5, 'See chips'),
    ('good', 'surface', 3.0, 4.5, 'right answers, due count, Good'),
    ('miss', 'surface', 3.0, 4.5, 'wrong answers, Again'),
    ('warn', 'surface', 3.0, 4.5, 'Hard, learning count'),
    ('info', 'surface', 3.0, 4.5, 'Easy, new count'),
    ('good', 'goodSoft', 3.0, 4.5, 'right choice (bold)'),
    ('miss', 'missSoft', 3.0, 4.5, 'wrong pick, struck letters (bold)'),
    ('warn', 'warnSoft', 3.0, 4.5, 'new-lesson banner heading'),
    ('ink', 'warnSoft', 4.5, 7, 'new-lesson banner text'),
    ('markText', 'markBg', 3.0, 4.5, 'search highlights'),
    ('pink', 'code', 4.5, 4.5, 'inline code'),
    ('ink', 'key', 4.5, 7, 'keyboard consonants'),
    ('keyVowel', 'key', 4.5, 7, 'keyboard vowels'),
    ('keyShift', 'keyShiftBg', 4.5, 4.5, 'shifted keys while Shift is on'),
    ('zero', 'surface', 1.8, 2.0, 'zero counts (meant to be dim)'),
    ('line', 'surface', 1.25, 1.4, 'borders'),
    ('surface', 'bg', 1.04, 1.08, 'cards against the page'),
]


def main(argv):
    verbose = '-v' in argv
    argv = [a for a in argv if a != '-v']
    themes = load_themes()
    keys = argv or list(themes)
    failed = 0
    for key in keys:
        C = colors(key, themes[key])
        notes = []
        for fg, bg, hard, target, where in CHECKS:
            r = ratio(C[fg], C[bg])
            if r < target:
                notes.append('  %s %-9s on %-10s %5.2f (min %.2f, target %.2f) %s' % (
                    'FAIL' if r < hard else 'low ', fg, bg, r, hard, target, where))
                failed += r < hard
        print('%-17s %s' % (themes[key]['name'], 'all pairs at target' if not notes else '%d below target' % len(notes)))
        for n in notes:
            if n.startswith('  FAIL') or verbose:
                print(n)
    print('FAILED: %d pairs below minimum' % failed if failed else 'All themes pass every minimum.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
