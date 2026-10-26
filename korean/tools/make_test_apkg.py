#!/usr/bin/env python3
"""Build small synthetic .apkg files for testing the study page's Anki deck import.

Writes, into the folder given (default: current folder):
  test-new.apkg     Anki's current format (collection.anki21b, zstd, protobuf media list), via the `anki` package
  test-legacy.apkg  the older format (collection.anki21, JSON media list), via the `anki` package
  test-genanki.apkg the oldest format (collection.anki2), via genanki

The words are made up for testing and include: HTML in fields, Hanja, audio on some notes, a homonym, a word that is
already in the lesson deck (스트레스를 받다) so it should be left out, and a Number field out of order.

    pip install anki genanki
    python3 korean/tools/make_test_apkg.py OUT_DIR   (needs ffmpeg for the two audio clips)
"""
import os
import subprocess
import sys
import tempfile

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
os.makedirs(OUT, exist_ok=True)
FIELDS = ['Korean', 'English', 'Hanja', 'Audio', 'Number']
NOTES = [
    # Korean, English, Hanja, Audio, Number
    ('사과', 'apple', '沙果', '[sound:test_apple.mp3]', '3'),
    ('<b>파랑</b>', 'blue', '', '', '1'),
    ('배', 'pear', '', '[sound:test_pear.mp3]', '2'),
    ('배', 'boat, ship', '', '', '4'),
    ('스트레스를 받다', 'to get stressed', '', '', '5'),
    ('비법', 'secret&nbsp;method', '秘法', '', '7'),
    ('바치다', 'to dedicate, offer', '', '', '6'),
]

def tones(d):
    paths = {}
    for name, hz in (('test_apple.mp3', 440), ('test_pear.mp3', 660)):
        p = os.path.join(d, name)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'sine=frequency={hz}:duration=0.4', '-ac', '1', '-b:a', '32k', p], check=True)
        paths[name] = p
    return paths

def with_anki(path, legacy, media):
    from anki.collection import Collection, ExportAnkiPackageOptions
    from anki.decks import DeckId
    from anki.collection import DeckIdLimit
    with tempfile.TemporaryDirectory() as d:
        col = Collection(os.path.join(d, 'c.anki2'))
        mm = col.models
        m = mm.new('Korean Vocab (test)')
        for f in FIELDS:
            mm.add_field(m, mm.new_field(f))
        t = mm.new_template('Recognition')
        t['qfmt'] = '{{Korean}}'
        t['afmt'] = '{{FrontSide}}<hr id=answer>{{English}}<br>{{Hanja}}{{Audio}}'
        mm.add_template(m, t)
        mm.add(m)
        did = col.decks.id('Test Korean Vocabulary')
        for name, p in media.items():
            col.media.add_file(p)
        for row in NOTES:
            n = col.new_note(m)
            for f, v in zip(FIELDS, row):
                n[f] = v
            col.add_note(n, DeckId(did))
        col.export_anki_package(out_path=path, options=ExportAnkiPackageOptions(with_scheduling=False, with_deck_configs=False, with_media=True, legacy=legacy), limit=DeckIdLimit(DeckId(did)))
        col.close()

def with_genanki(path, media):
    import genanki
    m = genanki.Model(1607392319, 'Korean Vocab (genanki test)', fields=[{'name': f} for f in FIELDS],
                      templates=[{'name': 'Card 1', 'qfmt': '{{Korean}}', 'afmt': '{{FrontSide}}<hr id=answer>{{English}}'}])
    deck = genanki.Deck(2059400110, 'Test Korean Vocabulary (genanki)')
    for row in NOTES:
        deck.add_note(genanki.Note(model=m, fields=list(row)))
    pkg = genanki.Package(deck)
    pkg.media_files = list(media.values())
    pkg.write_to_file(path)

with tempfile.TemporaryDirectory() as d:
    media = tones(d)
    with_anki(os.path.join(OUT, 'test-new.apkg'), legacy=False, media=media)
    with_anki(os.path.join(OUT, 'test-legacy.apkg'), legacy=True, media=media)
    with_genanki(os.path.join(OUT, 'test-genanki.apkg'), media)
print('wrote test-new.apkg, test-legacy.apkg, test-genanki.apkg to', OUT)
