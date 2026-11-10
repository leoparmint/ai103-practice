#!/usr/bin/env python3
"""Check the dates build.py gives new items.

    python3 korean/tools/test_build_dates.py

Builds made-up source files in a temp folder, one "lesson" at a time or several
at once, and checks that every item ends up dated with the lesson that added it.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, 'build.py')

# What each lesson adds. Lesson 0 is the first build (the baseline).
LESSONS = [
    {'date': None, 'entry': 'First build (Oct 8, 2026): everything so far.',
     'sets': {'V1': ['가다', '오다']}, 'points': {'G1': ['저는 가요.']}, 'selftest': [('1', 'G1')],
     'mixups': 1, 'mistakes': 1, 'wbA': {'V1': 1}, 'wbB': [], 'wbC': [], 'wbD': []},
    {'date': 'Oct 12, 2026', 'entry': 'Lesson 2 (Oct 12, 2026), first: Added V2, G2 (-고), examples in G1, '
                                      'Unit 1 self-test row 2, mix-up 2 and mistake 2.',
     'sets': {'V2': ['먹다', '마시다']}, 'points': {'G2': ['먹고 가요.'], 'G1': ['저는 와요.']},
     'selftest': [('2', 'G2')], 'mixups': 1, 'mistakes': 1, 'wbA': {'V2': 1},
     'wbB': [('Lesson 2 · And (G2)', 'G2')], 'wbC': ['G2'], 'wbD': ['G2']},
    {'date': 'Oct 15, 2026', 'entry': 'Oct 15, 2026 lesson, second: Added V3, new rules and examples in G2, '
                                      'Unit 1 self-test rows 3–4, mix-ups 3–4.',
     'sets': {'V3': ['자다']}, 'points': {'G2': ['자고 와요.']}, 'selftest': [('3', 'G2'), ('4', 'G2')],
     'mixups': 2, 'mistakes': 0, 'wbA': {'V3': 1}, 'wbB': [('Oct 15 lesson · More and (G2)', 'G2')],
     'wbC': [], 'wbD': []},
    {'date': 'Oct 19, 2026', 'entry': 'Lesson 4 (Oct 19, 2026), third: Added V4, G3 (-지만), examples in G1, '
                                      'and mistakes 3–4.',
     'sets': {'V4': ['보다']}, 'points': {'G3': ['가지만 와요.'], 'G1': ['저는 봐요.']}, 'selftest': [],
     'mixups': 0, 'mistakes': 2, 'wbA': {'V4': 1}, 'wbB': [('Lesson 4 · But (G3)', 'G3')],
     'wbC': ['G3'], 'wbD': ['G3']},
]
ISO = {1: '2026-10-12', 2: '2026-10-15', 3: '2026-10-19'}
BASE = '2026-10-08'


def sources(upto, extra_example=None):
    """The six files as they stand after lessons 0..upto."""
    ls = LESSONS[:upto + 1]
    start = ['# Notes', '', '## Lesson sources', ''] + ['- ' + l['entry'] for l in ls] + ['', '## Sources', '']
    sets, points, selftest = {}, {}, []
    for l in ls:
        for code, words in l['sets'].items():
            sets.setdefault(code, []).extend(words)
        for code, exs in l['points'].items():
            points.setdefault(code, []).extend(exs)
        selftest += l['selftest']
    if extra_example:
        points[extra_example[0]].append(extra_example[1])
    vocab = ['# Vocabulary', '']
    for code, words in sets.items():
        vocab += ['### %s Set %s' % (code, code), '', '| 한국어 | English | Notes |', '| --- | --- | --- |']
        vocab += ['| %s | word %s |  |' % (w, w) for w in words] + ['']
    grammar = ['# Grammar', '', '## Unit 1 · Basics', '']
    for code, exs in points.items():
        grammar += ['### %s Point: -%s' % (code, code), '', '- Form: rule.', '', 'Examples:', '']
        grammar += ['- %s — sentence' % e for e in exs] + ['']
    grammar += ['### Unit 1 self-test', '', '| # | Say it in Korean | Answer | See |', '| --- | --- | --- | --- |']
    grammar += ['| %s | English %s | 문장 %s. | %s |' % (n, n, n, see) for n, see in selftest] + ['']
    mix = ['# Mix-ups and mistakes', '', '## Mix-ups', '',
           '| # | Pair | The difference | Quick test | Answer | See |', '| --- | --- | --- | --- | --- | --- |']
    n = 0
    for l in ls:
        for _ in range(l['mixups']):
            n += 1
            mix.append('| %d | 에 / 에서 | diff | 공원(에 / 에서) 가요. | 에 | G1 |' % n)
    mix += ['', '## Your recurring mistakes', '', "| # | Don't say | Say | Why | See |", '| --- | --- | --- | --- | --- |']
    n = 0
    for l in ls:
        for _ in range(l['mistakes']):
            n += 1
            mix.append('| %d | 틀려요 %d. | 맞아요 %d. | why | G1 |' % (n, n, n))
    prac = ['# Workbook', '', '## Part A · Vocabulary in context (V1–V9)', '']
    ans = ['# Answer key', '', '| # | Answer | Note |', '| --- | --- | --- |']
    a = 0
    for code in sets:
        prac += ['### %s Set %s' % (code, code), '', '| # | Fill in the blank |', '| --- | --- |']
        for l in ls:
            for _ in range(l['wbA'].get(code, 0)):
                a += 1
                prac.append('| A%d | 저는 ＿＿＿＿＿. (cue) |' % a)
                ans.append('| A%d | \\[가요\\] | %s |' % (a, code))
        prac.append('')
    prac += ['## Part B · Grammar forms (Units 1–3)', '']
    b = 0
    for l in ls:
        for title, see in l['wbB']:
            b += 1
            prac += ['### ' + title, '', '| # | Fill in the blank |', '| --- | --- |',
                     '| B%d | 저는 ＿＿＿＿＿. (cue) |' % b, '']
            ans.append('| B%d | \\[가요\\] | rule · %s |' % (b, see))
    prac += ['## Part C · Mixed review', '', '| # | Fill in the blank |', '| --- | --- |']
    c = 0
    for l in ls:
        for see in l['wbC']:
            c += 1
            prac.append('| C%d | 저는 ＿＿＿＿＿. (cue) |' % c)
            ans.append('| C%d | \\[가요\\] | why · %s |' % (c, see))
    prac += ['', '## Part D · Fix the mistake', '', '| # | Sentence | Correct form |', '| --- | --- | --- |']
    d = 0
    for l in ls:
        for see in l['wbD']:
            d += 1
            prac.append('| D%d | 공원\\[에\\] 놀아요. | ＿＿＿＿＿ |' % d)
            ans.append('| D%d | \\[에서\\] | rule · %s |' % (d, see))
    return {'start-here.md': start, 'vocabulary.md': vocab, 'grammar.md': grammar,
            'mixups-and-mistakes.md': mix, 'workbook-practice.md': prac + [''], 'workbook-answers.md': ans + ['']}


def build(tmp, upto, *flags, **kw):
    src = os.path.join(tmp, 'source')
    os.makedirs(src, exist_ok=True)
    for name, lines in sources(upto, kw.get('extra')).items():
        with open(os.path.join(src, name), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    out = os.path.join(tmp, 'deck.json')
    r = subprocess.run([sys.executable, BUILD, '--src', src, '--out', out] + list(flags),
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit('build failed:\n' + r.stdout + r.stderr)
    with open(out, encoding='utf-8') as f:
        return json.load(f), r.stdout


def kinds(deck):
    """item id → a short label of what it is, for the expectations below."""
    out = {}
    for s in deck['vocab']:
        for it in s['items']:
            out[it['id']] = s['code']
    for u in deck['units']:
        for p in u['points']:
            out['g:' + p['code']] = 'point ' + p['code']
            for x in p['examples']:
                out[x['id']] = 'ex ' + x['ko']
        for st in u['selftest']:
            out[st['id']] = 'st ' + st['n']
    for m in deck['mixups']:
        out[m['id']] = 'mixup ' + m['n']
    for m in deck['mistakes']:
        out[m['id']] = 'mistake ' + m['n']
    for p in deck['workbook']:
        for g in p['groups']:
            for it in g['items']:
                out[it['id']] = it['n']
    return out


# Every item and the lesson it belongs to
EXPECT = {
    'V1': BASE, 'point G1': BASE, 'ex 저는 가요.': BASE, 'st 1': BASE, 'mixup 1': BASE, 'mistake 1': BASE, 'A1': BASE,
    'V2': ISO[1], 'point G2': ISO[1], 'ex 먹고 가요.': ISO[1], 'ex 저는 와요.': ISO[1], 'st 2': ISO[1],
    'mixup 2': ISO[1], 'mistake 2': ISO[1], 'A2': ISO[1], 'B1': ISO[1], 'C1': ISO[1], 'D1': ISO[1],
    'V3': ISO[2], 'ex 자고 와요.': ISO[2], 'st 3': ISO[2], 'st 4': ISO[2], 'mixup 3': ISO[2], 'mixup 4': ISO[2],
    'A3': ISO[2], 'B2': ISO[2],
    'V4': ISO[3], 'point G3': ISO[3], 'ex 가지만 와요.': ISO[3], 'ex 저는 봐요.': ISO[3], 'mistake 3': ISO[3],
    'mistake 4': ISO[3], 'A4': ISO[3], 'B3': ISO[3], 'C2': ISO[3], 'D2': ISO[3],
}
failures = []


def check(name, deck, expect=None, only=None):
    label = kinds(deck)
    for item_id, date in sorted(deck['added'].items()):
        what = label[item_id]
        want = (expect or EXPECT)[what]
        if only and what not in only:
            continue
        if date != want:
            failures.append('%s: %s (%s) dated %s, expected %s' % (name, what, item_id, date, want))


with tempfile.TemporaryDirectory() as tmp:
    # One lesson per build, the normal case
    for upto in range(4):
        deck, _ = build(tmp, upto)
        check('one at a time, through lesson %d' % upto, deck)
    step_by_step = deck['added']

with tempfile.TemporaryDirectory() as tmp:
    # First build, then three lessons published together
    build(tmp, 0)
    deck, out = build(tmp, 3)
    check('three at once', deck)
    if deck['added'] != step_by_step:
        failures.append('three at once: dates differ from publishing one lesson at a time')
    if 'not named' in out:
        failures.append('three at once: unexpected warning: ' + out)

    # A new example with no new lesson entry keeps the latest lesson's date
    deck, _ = build(tmp, 3, extra=('G2', '보고 가요.'))
    check('extra example', deck, dict(EXPECT, **{'ex 보고 가요.': ISO[3]}))

with tempfile.TemporaryDirectory() as tmp:
    # --repair-dates: undo an earlier build that stamped three lessons with the newest date
    build(tmp, 0)
    deck, _ = build(tmp, 3)
    path = os.path.join(tmp, 'deck.json')
    for k, v in deck['added'].items():
        if v != BASE:
            deck['added'][k] = ISO[3]
    deck['updates'] = deck['updates']  # the lessons are already listed, as in the real case
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False)
    stale, _ = build(tmp, 3)
    if any(v == ISO[1] for v in stale['added'].values()):
        failures.append('repair: a plain rebuild should leave stamped dates alone')
    fixed, out = build(tmp, 3, '--repair-dates')
    check('repair', fixed)
    if 'Repaired dates' not in out:
        failures.append('repair: no summary line printed')
    again, _ = build(tmp, 3, '--repair-dates')
    if again['added'] != fixed['added']:
        failures.append('repair: running it twice changed the dates')

with tempfile.TemporaryDirectory() as tmp:
    # Two lessons at once, and an item neither "Added …" sentence names: newest date plus a warning
    build(tmp, 1)
    LESSONS[2]['sets']['V9'] = ['숨다']
    deck, out = build(tmp, 3)
    del LESSONS[2]['sets']['V9']
    if deck['added'][[k for k, v in kinds(deck).items() if v == 'V9'][0]] != ISO[3]:
        failures.append('unplaced: expected the newest lesson date')
    if 'not named' not in out:
        failures.append('unplaced: expected a warning')

if failures:
    print('\n'.join(failures))
    print('FAILED: %d problems' % len(failures))
    sys.exit(1)
print('Build dates: all checks pass.')
