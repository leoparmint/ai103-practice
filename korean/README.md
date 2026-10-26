# Korean flashcards

Study site for Darren's Korean lessons: https://leoparmint.github.io/ai103-practice/korean/

- **Study**: Anki-style spaced repetition over 1,700 cards: every word both ways, grammar points, example sentences, unit self-tests, mix-ups, recurring mistakes and all 319 workbook items. Scheduling is FSRS-6 (the scheduler Anki recommends) with its default parameters, Anki's learning steps (1m 10m, relearning 10m) and a 90% target recall that Options can change to 85% or 95%. English → Korean vocabulary cards unlock once their Korean → English card is scheduled 3+ days out, and cards forgotten 8 times are tagged Leech
- **Practice**: run a workbook part, a unit self-test, the mix-up quiz or the mistakes straight through, with typed answers checked against the answer key
- **Notes**: every word and grammar point, searchable, plus the lesson update log
- **Keyboard**: an on-screen 두벌식 Hangul keyboard for devices without a Korean layout, and a scratchpad to copy from. On a computer, typing in an answer box follows the Korean layout (<kbd>Shift</kbd>+<kbd>Space</kbd> switches)

Progress is saved in the browser only; Options and backup moves it between devices.

## Added Anki decks

Options › Added Anki decks reads a shared deck (.apkg) in the browser and keeps it in IndexedDB on that device; nothing is uploaded or committed here, so decks whose authors don't allow re-uploading stay private. It reads all three .apkg formats (collection.anki21b with zstd and a protobuf media list, collection.anki21, collection.anki2), finds the Korean, English, Hanja, audio and number fields by name, and makes Korean → English and English → Korean cards in the deck's own order. Added decks have their own new-cards-a-day limit (10 by default), words already in the lesson vocabulary are left out unless already started, and audio plays with ▶ Listen or <kbd>R</kbd>. Card ids come from each note's guid, so removing and re-adding a deck keeps its progress.

The reader libraries in `vendor/` (sql.js, JSZip, fzstd; licenses in `vendor/LICENSES.md`) load only when a deck is added. `python3 korean/tools/make_test_apkg.py OUT_DIR` builds small made-up test decks in each format.

## Scheduler notes

The FSRS code in `index.html` was checked against py-fsrs 6.3.2 (`python3 korean/tools/test_fsrs.py`). Cards studied under the earlier SM-2 scheduler keep their due dates; at their next review they get a stability equal to their interval and a difficulty solved from their ease, the same conversion Anki makes when a deck is switched to FSRS.

Every grade is also logged per card as `[unix seconds, grade, state before]` (the `log` field in a backup). After a few thousand reviews, a backup can be run through the py-fsrs `Optimizer` to fit parameters to Darren's own memory and replace `W`. Cards whose first log entry has a state other than 0 were started before logging began and should be left out of fitting.

## Color themes

The theme menu (top right) has 13 popular dark themes: Dracula (the default, same as the AI-103 site), Catppuccin Mocha, Tokyo Night, One Dark, Nord, GitHub Dark, Gruvbox Dark, Rosé Pine, Monokai, Solarized Dark, Everforest, Night Owl and Kanagawa. Each theme sets 17 palette colors in the `THEMES` object at the top of `index.html`, taken from the theme's official palette files; borders, tinted fills and keyboard keys are mixed from those. A few colors are lightened where the official one is too dim to read on this page (Nord's red, Solarized's magenta), and the choice is remembered per browser.

`python3 korean/tools/check_themes.py` checks every theme's text contrast against WCAG minimums (add `-v` to see pairs that pass but sit below the target).

## Where the content comes from

`source/` holds Markdown exports of the two Claude Docs that the scheduled "Korean study materials update" keeps current after each lesson: Korean Review Notes (Start here, Vocabulary, Grammar, Mix-ups & mistakes) and Korean Practice Workbook (Practice, Answer key). `tools/build.py` turns them into `deck.json`, which `index.html` loads.

## Refreshing

The scheduled update does this after it adds a lesson to the docs:

1. Export the six tabs with the Claude Docs `export` tool (format: markdown)
2. `python3 korean/tools/save_exports.py` writes those exports to `source/`
3. `python3 korean/tools/build.py` rebuilds `deck.json` (it writes nothing if a table doesn't parse)
4. Commit and push to `main`; GitHub Pages serves it within a minute or two

Card ids come from the V/G/workbook codes and the Korean text, so progress carries over between builds. `deck.json` remembers the date each item first appeared, which is how the page knows what came from the latest lesson.
