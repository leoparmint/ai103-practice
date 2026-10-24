#!/usr/bin/env python3
"""Build korean/deck.json from the Markdown exports in korean/source/.

The six source files are the tabs of the two Claude Docs that the scheduled
"Korean study materials update" keeps current:

  Korean Review Notes   start-here.md, vocabulary.md, grammar.md, mixups-and-mistakes.md
  Practice Workbook     workbook-practice.md, workbook-answers.md

Run it after the sources change:  python3 korean/tools/build.py
It exits non-zero, without writing, when something doesn't parse.

Item ids are stable across builds (V/G/workbook codes never get renumbered), so
progress saved in the browser carries over. Each item keeps the date it first
appeared, which is how the page knows what came from the latest lesson.
"""
import datetime
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'source')
OUT = os.path.join(ROOT, 'deck.json')

FILES = {
    'start': 'start-here.md',
    'vocab': 'vocabulary.md',
    'grammar': 'grammar.md',
    'mix': 'mixups-and-mistakes.md',
    'practice': 'workbook-practice.md',
    'answers': 'workbook-answers.md',
}

BASELINE = '2026-10-08'  # first build of the notes; covers every lesson through Oct 6
MONTHS = {m: i for i, m in enumerate(
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}
HANGUL = re.compile(r'[가-힣ㄱ-ㆎ]')
BLANK = re.compile(r'＿+')

problems = []
warnings = []


def fail(msg):
    problems.append(msg)


def warn(msg):
    warnings.append(msg)


# ---------- Markdown helpers ----------

def unescape(s):
    return re.sub(r'\\([\\`*_{}\[\]()#+\-.!|~<>"])', r'\1', s)


def cells(line):
    """Split a pipe-table row into unescaped cells (escaped pipes stay inside a cell)."""
    parts = re.split(r'(?<!\\)\|', line.strip())
    if parts and parts[0].strip() == '':
        parts = parts[1:]
    if parts and parts[-1].strip() == '':
        parts = parts[:-1]
    return [unescape(p.strip()) for p in parts]


def is_rule(line):
    return bool(re.match(r'^\|\s*:?-{3,}', line.strip()))


def inline_html(raw):
    """Escaped HTML for one line of Markdown: links, bold and italics only."""
    keep = []

    def stash(html):
        keep.append(html)
        return '\x00%d\x00' % (len(keep) - 1)

    def esc(t):
        return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

    s = re.sub(r'(?<!\\)\[([^\]]+?)(?<!\\)\]\((https?://[^)\s]+)\)',
               lambda m: stash('<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(m.group(2)), esc(unescape(m.group(1))))),
               raw)
    s = s.replace('\\*', '\x01')
    s = esc(unescape(s))
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<i>\1</i>', s)
    s = s.replace('\x01', '*')
    return re.sub(r'\x00(\d+)\x00', lambda m: keep[int(m.group(1))], s)


def read(key):
    path = os.path.join(SRC, FILES[key])
    if not os.path.exists(path):
        fail('missing source file %s' % path)
        return []
    with open(path, encoding='utf-8') as f:
        return f.read().replace('\r\n', '\n').split('\n')


def short_hash(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]


def see_codes(text):
    """Note IDs a line points to: V3, G26, mix-up 27, mistake 44."""
    out = []
    for m in re.finditer(r'\b([VG]\d+)\b|\b(mix-ups?|mistakes?)\s+(\d+)(?:\s*[–-]\s*(\d+))?', text):
        if m.group(1):
            code = m.group(1)
            if code not in out:
                out.append(code)
        else:
            kind = 'mixup' if m.group(2).startswith('mix') else 'mistake'
            a = int(m.group(3))
            b = int(m.group(4) or a)
            for n in range(a, b + 1):
                code = '%s %d' % (kind, n)
                if code not in out:
                    out.append(code)
    return out


def parse_date(text):
    """First 'Oct 12, 2026' style date in the text, as YYYY-MM-DD."""
    m = re.search(r'\b(%s)[a-z]*\.? (\d{1,2}), (\d{4})' % '|'.join(MONTHS), text)
    if not m:
        return None
    return '%04d-%02d-%02d' % (int(m.group(3)), MONTHS[m.group(1)], int(m.group(2)))


def split_example(line):
    """'- 한국어 — English' → (ko, en). Middle segments go to whichever side they read as."""
    segs = [s.strip() for s in line.split(' — ')]
    if len(segs) < 2:
        return None
    ko, en = [segs[0]], []
    for seg in segs[1:-1]:
        hangul = len(HANGUL.findall(seg))
        latin = len(re.findall(r'[A-Za-z]', seg))
        (ko if hangul >= latin else en).append(seg)
    en.append(segs[-1])
    return ' — '.join(ko), ' — '.join(en)


# ---------- Start here: lesson sources ----------

def parse_start():
    lines = read('start')
    updates = []
    title = ''
    section = None
    for line in lines:
        if line.startswith('# ') and not title:
            title = unescape(line[2:].strip())
        if line.startswith('## '):
            section = line[3:].strip()
            continue
        if section == 'Lesson sources' and line.startswith('- '):
            raw = line[2:].strip()
            text = unescape(raw)
            updates.append({'date': parse_date(text) or BASELINE, 'text': text, 'html': inline_html(raw)})
    if not updates:
        fail('start-here.md: no "Lesson sources" list found')
    return updates


def new_codes_by_date(updates):
    """Which codes each lesson added, from the 'Added …' sentences in Lesson sources."""
    first = {}

    def mark(code, date):
        if code not in first or date < first[code]:
            first[code] = date

    for u in updates:
        date = u['date']
        text = u['text']
        m = re.search(r'\bAdded\b(.*)$', text)
        if not m:
            continue
        added = m.group(1)
        # Updates to existing points ("examples in G7, G35 …") are not new codes.
        mode_new = True
        for chunk in re.split(r',\s*|\s+and\s+', added):
            c = re.sub(r'^and\s+', '', chunk.strip())
            if re.match(r'(new rules and )?examples in\b|new rules\b', c):
                mode_new = False
            if re.match(r'(mix-ups?|mistakes?)\b', c):
                mode_new = True
            for code in see_codes(c):
                if code.startswith('V'):
                    mark(code, date)
                elif code.startswith('G'):
                    if mode_new:
                        mark(code, date)
                elif mode_new:
                    mark(code, date)
            for m2 in re.finditer(r'Unit (\d+) self-test row (\d+)', c):
                mark('st %s %s' % (m2.group(1), m2.group(2)), date)
    return first


# ---------- Vocabulary ----------

def parse_vocab():
    sets = []
    cur = None
    for line in read('vocab'):
        m = re.match(r'^### (V\d+)\s+(.+)$', line)
        if m:
            cur = {'code': m.group(1), 'title': unescape(m.group(2).strip()), 'items': []}
            sets.append(cur)
            continue
        if cur and line.startswith('|') and not is_rule(line):
            c = cells(line)
            if c and c[0] in ('한국어', '#'):
                continue
            if len(c) < 2:
                fail('vocabulary.md %s: bad row %r' % (cur['code'], line))
                continue
            cur['items'].append({'ko': c[0], 'en': c[1], 'notes': c[2] if len(c) > 2 else ''})
    seen = set()
    for s in sets:
        if not s['items']:
            fail('vocabulary.md: %s has no rows' % s['code'])
        for it in s['items']:
            base = 'v:%s:%s' % (s['code'], it['ko'])
            vid, n = base, 2
            while vid in seen:
                vid = '%s#%d' % (base, n)
                n += 1
            seen.add(vid)
            it['id'] = vid
    if not sets:
        fail('vocabulary.md: no V sets found')
    return sets


# ---------- Grammar ----------

def split_title(title):
    """'Worried it might: -(으)ㄹ까 봐' → pattern '-(으)ㄹ까 봐', meaning 'Worried it might'."""
    if ': ' in title:
        a, b = title.split(': ', 1)
        ha, hb = bool(HANGUL.search(a)), bool(HANGUL.search(b))
        if hb and not ha:
            return b, a
        if ha and not hb:
            return a, b
    return (title if HANGUL.search(title) else ''), ''


def parse_grammar():
    units = []
    unit = point = None
    mode = None          # 'notes' | 'examples' | 'selftest'
    table = None
    for line in read('grammar') + ['']:
        if line.startswith('## '):
            m = re.match(r'^## Unit (\d+)\s*·\s*(.+)$', line)
            if m:
                unit = {'n': int(m.group(1)), 'title': unescape(m.group(2).strip()), 'points': [], 'selftest': []}
                units.append(unit)
            point, mode, table = None, None, None
            continue
        if line.startswith('### '):
            table = None
            m = re.match(r'^### (G\d+)\s+(.+)$', line)
            if m and unit:
                title = unescape(m.group(2).strip())
                pattern, meaning = split_title(title)
                point = {'code': m.group(1), 'title': title, 'pattern': pattern, 'meaning': meaning,
                         'blocks': [], 'examples': []}
                unit['points'].append(point)
                mode = 'notes'
            elif re.match(r'^### Unit \d+ self-test', line) and unit:
                point, mode = None, 'selftest'
            else:
                point, mode = None, None
            continue
        if mode == 'selftest':
            if line.startswith('|') and not is_rule(line):
                c = cells(line)
                if c[0] == '#':
                    continue
                if len(c) < 3:
                    fail('grammar.md unit %d self-test: bad row %r' % (unit['n'], line))
                    continue
                unit['selftest'].append({'id': 'st:%d:%s' % (unit['n'], c[0]), 'n': c[0], 'en': c[1], 'ko': c[2],
                                         'see': see_codes(c[3]) if len(c) > 3 else []})
            continue
        if not point:
            continue
        stripped = line.strip()
        if stripped == 'Examples:':
            mode, table = 'examples', None
            continue
        if mode == 'examples':
            if stripped.startswith('- '):
                pair = split_example(stripped[2:])
                if not pair:
                    warn('%s: example without " — " translation: %r' % (point['code'], stripped))
                    point['blocks'].append({'t': 'p', 'html': inline_html(stripped[2:])})
                    continue
                ko, en = pair
                point['examples'].append({'id': 'x:%s:%s' % (point['code'], short_hash(unescape(ko))),
                                          'ko': unescape(ko), 'en': unescape(en)})
            elif stripped:
                point['blocks'].append({'t': 'p', 'html': inline_html(stripped)})
            continue
        # notes: bullets, tables, paragraphs
        if stripped.startswith('|'):
            if is_rule(stripped):
                continue
            c = cells(stripped)
            if table is None:
                table = {'t': 'table', 'head': c, 'rows': []}
                point['blocks'].append(table)
            else:
                table['rows'].append(c)
            continue
        table = None
        if not stripped:
            continue
        m = re.match(r'^(\s*)[-*] (.*)$', line)
        if m:
            text = m.group(2)
            if m.group(1) and point['blocks'] and point['blocks'][-1]['t'] == 'ul':
                point['blocks'][-1]['items'][-1] += '<br>· ' + inline_html(text)
                continue
            if not point['blocks'] or point['blocks'][-1]['t'] != 'ul':
                point['blocks'].append({'t': 'ul', 'items': []})
            point['blocks'][-1]['items'].append(inline_html(text))
        else:
            point['blocks'].append({'t': 'p', 'html': inline_html(stripped)})
    codes = [p['code'] for u in units for p in u['points']]
    if len(codes) != len(set(codes)):
        fail('grammar.md: duplicate G codes')
    for u in units:
        if not u['points']:
            fail('grammar.md: Unit %d has no grammar points' % u['n'])
        for p in u['points']:
            if not p['blocks'] and not p['examples']:
                fail('grammar.md: %s is empty' % p['code'])
            ids = [x['id'] for x in p['examples']]
            if len(ids) != len(set(ids)):
                seen = set()
                for x in p['examples']:
                    while x['id'] in seen:
                        x['id'] += '+'
                    seen.add(x['id'])
    if not units:
        fail('grammar.md: no units found')
    return units


# ---------- Mix-ups and mistakes ----------

def mixup_options(test):
    for m in re.finditer(r'\(([^()]*\s/\s[^()]*)\)', test):
        opts = [o.strip() for o in m.group(1).split(' / ')]
        if len(opts) >= 2 and all(opts):
            return opts, m.start(), m.end()
    return None, -1, -1


def parse_mix():
    mixups, mistakes = [], []
    section = None
    for line in read('mix'):
        if line.startswith('## '):
            h = line[3:].strip().lower()
            section = 'mixups' if h.startswith('mix-ups') else 'mistakes' if 'mistake' in h else None
            continue
        if not line.startswith('|') or is_rule(line) or not section:
            continue
        c = cells(line)
        if c[0] == '#':
            continue
        if section == 'mixups':
            if len(c) < 5:
                fail('mixups: bad row %r' % line)
                continue
            opts, a, b = mixup_options(c[3])
            if not opts:
                fail('mix-up %s: no "(A / B)" choice in the quick test' % c[0])
            elif c[4] not in opts:
                warn('mix-up %s: answer %r is not one of %r' % (c[0], c[4], opts))
            mixups.append({'id': 'mx:%s' % c[0], 'n': c[0], 'pair': c[1], 'diff': c[2], 'test': c[3],
                           'before': c[3][:a] if opts else c[3], 'after': c[3][b:] if opts else '',
                           'options': opts or [], 'answer': c[4], 'see': see_codes(c[5]) if len(c) > 5 else []})
        else:
            if len(c) < 4:
                fail('mistakes: bad row %r' % line)
                continue
            mistakes.append({'id': 'ms:%s' % c[0], 'n': c[0], 'wrong': c[1], 'right': c[2], 'why': c[3],
                             'see': see_codes(c[4]) if len(c) > 4 else []})
    if not mixups:
        fail('mixups-and-mistakes.md: no mix-ups table')
    if not mistakes:
        fail('mixups-and-mistakes.md: no mistakes table')
    return mixups, mistakes


# ---------- Workbook ----------

PART_TITLES = {}


def parse_practice():
    parts = []
    part = group = None
    for line in read('practice'):
        m = re.match(r'^## Part ([A-Z]) · (.+?)(?:\s*\(([^)]*)\))?\s*$', line)
        if m:
            letter = m.group(1)
            if not part or part['part'] != letter:
                part = {'part': letter, 'title': unescape(m.group(2).strip()), 'intro': '', 'groups': []}
                parts.append(part)
            group = None
            continue
        if line.startswith('## '):
            part = group = None
            continue
        if not part:
            continue
        m = re.match(r'^### (.+)$', line)
        if m:
            group = {'title': unescape(m.group(1).strip()), 'items': []}
            part['groups'].append(group)
            continue
        if line.startswith('|'):
            if is_rule(line):
                continue
            c = cells(line)
            if c[0] == '#':
                continue
            if group is None:
                group = {'title': '', 'items': []}
                part['groups'].append(group)
            q = c[1] if len(c) > 1 else ''
            item = {'id': 'wb:%s' % c[0], 'n': c[0], 'part': part['part']}
            cue = ''
            m2 = re.search(r'\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', q)
            if m2:
                cue = m2.group(1).strip()
                q = q[:m2.start()].rstrip()
            item['q'] = q
            item['cue'] = cue
            if part['part'] == 'D':
                item['blanks'] = 1
            else:
                item['blanks'] = len(BLANK.findall(q))
                if item['blanks'] == 0:
                    fail('workbook %s: no blank in %r' % (c[0], q))
            group['items'].append(item)
        elif line.strip() and not line.startswith('#') and not group:
            part['intro'] = (part['intro'] + ' ' + line.strip()).strip()
    for p in parts:
        p['intro_html'] = inline_html(p['intro']) if p['intro'] else ''
        del p['intro']
    if not parts:
        fail('workbook-practice.md: no parts found')
    return parts


def parse_answers():
    out = {}
    for line in read('answers'):
        if not line.startswith('|') or is_rule(line):
            continue
        c = cells(line)
        if c[0] == '#' or len(c) < 2:
            continue
        out[c[0]] = {'key': c[1], 'note': c[2] if len(c) > 2 else ''}
    if not out:
        fail('workbook-answers.md: no answers found')
    return out


def answer_alternatives(key, note, blanks):
    alts = []
    for alt in re.split(r'(?<=\])\s+or\s+(?=\[)', key):
        parts = re.findall(r'\[([^\]]*)\]', alt)
        if not parts:
            continue
        if blanks == 1 and len(parts) > 1:
            alts.extend([p] for p in parts)
        else:
            alts.append(parts)
    if blanks == 1:
        for m in re.finditer(r'\[([^\]]*)\]', note):
            before = note[max(0, m.start() - 7):m.start()].lower()
            if re.search(r'\b(not|never)\s*$', before):
                continue
            if [m.group(1)] not in alts:
                alts.append([m.group(1)])
    return alts


def attach_answers(parts, answers):
    seen = set()
    for p in parts:
        for g in p['groups']:
            for it in g['items']:
                a = answers.get(it['n'])
                if not a:
                    fail('workbook %s: no answer in the answer key' % it['n'])
                    continue
                seen.add(it['n'])
                it['key'] = a['key']
                it['note'] = a['note']
                it['see'] = see_codes(a['note'])
                if p['part'] == 'E':
                    it['open'] = True
                    it['model'] = a['key']
                    it['answers'] = []
                    continue
                it['answers'] = answer_alternatives(a['key'], a['note'], it['blanks'])
                if not it['answers']:
                    fail('workbook %s: no [bracketed] answer in %r' % (it['n'], a['key']))
                elif all(len(x) != it['blanks'] for x in it['answers']):
                    warn('workbook %s: %d blanks but answers have %s parts' % (
                        it['n'], it['blanks'], sorted({len(x) for x in it['answers']})))
    for n in answers:
        if n not in seen:
            warn('answer key has %s but the workbook does not' % n)


# ---------- Dates ----------

def previous_added():
    try:
        with open(OUT, encoding='utf-8') as f:
            old = json.load(f)
        return old.get('added', {})
    except (OSError, ValueError):
        return {}


def lesson_date_for_group(title, updates):
    m = re.match(r'Lesson (\d+)\b', title)
    if m:
        for u in updates:
            if re.match(r'Lesson %s\b' % m.group(1), u['text']):
                return u['date']
    m = re.match(r'(%s) (\d{1,2}) lesson' % '|'.join(MONTHS), title)
    if m:
        for u in updates:
            d = u['date']
            if d and int(d[5:7]) == MONTHS[m.group(1)] and int(d[8:10]) == int(m.group(2)):
                return d
    return None


def main():
    updates = parse_start()
    vocab = parse_vocab()
    units = parse_grammar()
    mixups, mistakes = parse_mix()
    parts = parse_practice()
    attach_answers(parts, parse_answers())

    if problems:
        for p in problems:
            print('ERROR', p)
        for w in warnings:
            print('warning', w)
        print('Nothing written: fix the errors above.')
        return 1

    latest = max(u['date'] for u in updates)
    prev = previous_added()
    first_build = not prev
    seed = new_codes_by_date(updates) if first_build else {}
    added = {}

    def date_for(item_id, codes=()):
        if item_id in prev:
            return prev[item_id]
        if not first_build:
            return latest
        dates = [seed[c] for c in codes if c in seed]
        return max(dates) if dates else BASELINE

    for s in vocab:
        for it in s['items']:
            added[it['id']] = date_for(it['id'], [s['code']])
    for u in units:
        for p in u['points']:
            added['g:' + p['code']] = date_for('g:' + p['code'], [p['code']])
            for x in p['examples']:
                added[x['id']] = date_for(x['id'], [p['code']])
        for st in u['selftest']:
            added[st['id']] = date_for(st['id'], ['st %d %s' % (u['n'], st['n'])] + st['see'])
    for mx in mixups:
        added[mx['id']] = date_for(mx['id'], ['mixup %s' % mx['n']])
    for ms in mistakes:
        added[ms['id']] = date_for(ms['id'], ['mistake %s' % ms['n']])
    for p in parts:
        for g in p['groups']:
            gdate = lesson_date_for_group(g['title'], updates)
            vset = re.match(r'(V\d+)\b', g['title'])
            for it in g['items']:
                if it['id'] in prev or not first_build:
                    added[it['id']] = date_for(it['id'])
                elif gdate:
                    added[it['id']] = gdate
                else:
                    added[it['id']] = date_for(it['id'], ([vset.group(1)] if vset else []) + it.get('see', []))

    latest_update = [u for u in updates if u['date'] == latest][-1]
    n_vocab = sum(len(s['items']) for s in vocab)
    n_points = sum(len(u['points']) for u in units)
    n_examples = sum(len(p['examples']) for u in units for p in u['points'])
    n_selftest = sum(len(u['selftest']) for u in units)
    n_workbook = sum(len(g['items']) for p in parts for g in p['groups'])
    deck = {
        'schema': 1,
        'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'latest': {'date': latest, 'text': latest_update['text'], 'html': latest_update['html'],
                   'count': sum(1 for d in added.values() if d == latest)},
        'stats': {'words': n_vocab, 'sets': len(vocab), 'points': n_points, 'units': len(units),
                  'examples': n_examples, 'selftest': n_selftest, 'mixups': len(mixups),
                  'mistakes': len(mistakes), 'workbook': n_workbook},
        'updates': updates,
        'vocab': vocab,
        'units': units,
        'mixups': mixups,
        'mistakes': mistakes,
        'workbook': parts,
        'added': added,
    }
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(deck, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, OUT)

    for w in warnings:
        print('warning', w)
    print('Wrote %s (%d KB)' % (os.path.relpath(OUT), os.path.getsize(OUT) // 1024))
    print('%d words in %d sets · %d grammar points in %d units · %d examples · %d self-test rows' % (
        n_vocab, len(vocab), n_points, len(units), n_examples, n_selftest))
    print('%d mix-ups · %d mistakes · %d workbook items' % (len(mixups), len(mistakes), n_workbook))
    print('Latest lesson %s: %d new items' % (latest, deck['latest']['count']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
