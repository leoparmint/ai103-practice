# Korean flashcards

Study site for Darren's Korean lessons: https://leoparmint.github.io/ai103-practice/korean/

- **Study**: Anki-style spaced repetition (Again / Hard / Good / Easy, Anki's default steps and intervals) over 1,700 cards: every word both ways, grammar points, example sentences, unit self-tests, mix-ups, recurring mistakes and all 319 workbook items
- **Practice**: run a workbook part, a unit self-test, the mix-up quiz or the mistakes straight through, with typed answers checked against the answer key
- **Notes**: every word and grammar point, searchable, plus the lesson update log
- **Keyboard**: an on-screen 두벌식 Hangul keyboard for devices without a Korean layout, and a scratchpad to copy from. On a computer, typing in an answer box follows the Korean layout (<kbd>Shift</kbd>+<kbd>Space</kbd> switches)

Progress is saved in the browser only; Options and backup moves it between devices.

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
