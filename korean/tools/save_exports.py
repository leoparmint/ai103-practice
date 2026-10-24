#!/usr/bin/env python3
"""Save this session's Claude Docs exports into korean/source/.

The scheduled update exports each tab of the two Korean docs with the Claude
Docs `export` tool (format: markdown). The tool hands the file back as base64
inside the tool result, which Claude Code keeps in the session transcript (and,
for large results, in a tool-results file). This script finds the newest export
of each tab there, decodes it, and writes it under the name build.py expects.

    python3 korean/tools/save_exports.py            # writes korean/source/*.md
    python3 korean/tools/save_exports.py --check    # only lists what it found

It exits 1 when a tab is missing, listing which ones to export again.
"""
import base64
import glob
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'source')

NOTES = '9945946e-4859-4d07-8ebb-27f3d6f546cd'      # Korean Review Notes
WORKBOOK = '258d54e8-e09b-4437-8c0e-70851f8278f0'   # Korean Practice Workbook
TABS = {
    (NOTES, 'Start here.md'): 'start-here.md',
    (NOTES, 'Vocabulary.md'): 'vocabulary.md',
    (NOTES, 'Grammar.md'): 'grammar.md',
    (NOTES, 'Mix-ups & mistakes.md'): 'mixups-and-mistakes.md',
    (WORKBOOK, 'Practice.md'): 'workbook-practice.md',
    (WORKBOOK, 'Answer key.md'): 'workbook-answers.md',
}
MAX_AGE_HOURS = 12


def candidate_files():
    roots = [os.environ.get('CLAUDE_CONFIG_DIR'), os.path.expanduser('~/.claude'), '/root/.claude']
    roots += glob.glob('/home/*/.claude')
    seen, out = set(), []
    cutoff = time.time() - MAX_AGE_HOURS * 3600
    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(os.path.join(root, 'projects')):
            for name in filenames:
                if not (name.endswith('.jsonl') or name.endswith('.txt') or name.endswith('.json')):
                    continue
                path = os.path.realpath(os.path.join(dirpath, name))
                if path in seen:
                    continue
                seen.add(path)
                try:
                    if os.path.getmtime(path) >= cutoff:
                        out.append(path)
                except OSError:
                    pass
    return out


def exports_in_text(text):
    """Yield every export result object embedded in a string."""
    if 'bytes_b64' not in text and '"format":"markdown"' not in text:
        return
    decoder = json.JSONDecoder()
    for m in re.finditer(r'\{"verdict":', text):
        try:
            obj, _ = decoder.raw_decode(text, m.start())
        except ValueError:
            continue
        data = obj.get('data') if isinstance(obj, dict) else None
        if isinstance(data, dict) and data.get('format') == 'markdown':
            yield obj


def walk_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)


def find_exports():
    best = {}
    for path in candidate_files():
        try:
            with open(path, encoding='utf-8', errors='replace') as f:
                raw = f.read()
        except OSError:
            continue
        if 'bytes_b64' not in raw:
            continue
        texts = []
        if path.endswith('.jsonl'):
            for line in raw.splitlines():
                if 'bytes_b64' not in line:
                    continue
                try:
                    texts.extend(walk_strings(json.loads(line)))
                except ValueError:
                    texts.append(line)
        else:
            try:
                texts.extend(walk_strings(json.loads(raw)))
            except ValueError:
                texts.append(raw)
        mtime = os.path.getmtime(path)
        for text in texts:
            for obj in exports_in_text(text):
                data = obj['data']
                slug = (obj.get('frame') or {}).get('slug', '')
                key = (slug, data.get('name', ''))
                if key not in TABS:
                    continue
                if 'bytes_b64' in data:
                    body = base64.b64decode(data['bytes_b64']).decode('utf-8')
                elif isinstance(data.get('text'), str):
                    body = data['text']
                else:
                    continue
                rank = (obj.get('rev', 0), mtime)
                if key not in best or rank >= best[key][0]:
                    best[key] = (rank, body)
    return best


def main():
    check = '--check' in sys.argv
    best = find_exports()
    missing = [name for key, name in TABS.items() if key not in best]
    for key, name in TABS.items():
        if key in best:
            (rev, _), body = best[key]
            print('found %-28s rev %-4s %6d chars  → %s' % (key[1], rev, len(body), name))
    if missing:
        print('MISSING: %s. Export those tabs (Claude Docs export, format markdown) and run this again.'
              % ', '.join(missing))
        return 1
    if not check:
        os.makedirs(SRC, exist_ok=True)
        for key, name in TABS.items():
            with open(os.path.join(SRC, name), 'w', encoding='utf-8') as f:
                f.write(best[key][1])
        print('Wrote %d files to %s' % (len(TABS), os.path.relpath(SRC)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
