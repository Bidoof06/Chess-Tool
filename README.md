# Chess Game Review

Paste a chess.com PGN or look up your recent games by username, and get an engine review:
accuracy, a rough rating estimate, a grade for every move and a better move for every slip.
Everything runs in the browser; there is no server.

- **Explore side lines:** click or drag a piece on the board (or press Explore) to try your own moves from any
  point in the game. The engine shows the best move and the next best one for every position you reach.
- **Appearance:** the Appearance button on either page sets the theme (Dark, Midnight, Light), board colors,
  piece set (eight image sets or plain symbols), hats for the pieces, and custom colors for everything.
  Your choices are saved in the browser.

## Training

`training.html` has two parts. Progress is saved in the browser; there are no accounts.

- **Openings:** pick any of 149 openings (3,865 named lines). Walk through a line move by move with a note on what
  each move does and the replies the book knows, or practise a line: the app plays the other side, tells you when you
  leave the line and shows the right move. A line counts as known after two clean runs in a row.
- **Tactics:** find the best move. Puzzles come from a bundled set of 1,600 (rated 600 to 2200) and from your own
  games: after each review, your mistakes, misses and blunders are saved as puzzles.

Data sources and licences are in `LICENSE-data.txt`: openings from lichess-org/chess-openings and puzzles from the
Lichess puzzle database, both CC0 (public domain).

## Files

- `index.html` - the app (markup, styles and logic)
- `training.html`, `training.js` - the training page
- `style.css` - styles shared by both pages
- `appearance.js` - themes, piece sets, hats and custom colors, shared by both pages
- `pieces/` - piece artwork (see `LICENSE-data.txt`)
- `board.js` - the movable board used by the training page
- `openings.json`, `puzzles.json` - training data (see `LICENSE-data.txt`)
- `chess.js` - chess rules and PGN parsing (chess.js 0.10.3, BSD licence)
- `stockfish-19-lite-single.js` / `.wasm` - Stockfish 19 Lite engine (stockfish.js 19.0.1)
- `stockfish.js` - Stockfish 10 fallback for browsers that cannot run the newer engine
- `manifest.webmanifest`, `sw.js`, `icon-*.png` - install and offline support

## Licence

Stockfish is licensed under GPLv3 (see `LICENSE-stockfish.txt`). Because this app ships Stockfish,
the app as a whole is distributed under GPLv3 and its source is this repository.
Engine source: https://github.com/nmrugg/stockfish.js
