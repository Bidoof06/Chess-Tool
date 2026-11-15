# Chess Game Review

Paste a chess.com PGN or look up your recent games by username, and get an engine review:
accuracy, a rough rating estimate, a grade for every move and a better move for every slip.
Everything runs in the browser; there is no server.

## Files

- `index.html` - the app (markup, styles and logic)
- `chess.js` - chess rules and PGN parsing (chess.js 0.10.3, BSD licence)
- `stockfish-19-lite-single.js` / `.wasm` - Stockfish 19 Lite engine (stockfish.js 19.0.1)
- `stockfish.js` - Stockfish 10 fallback for browsers that cannot run the newer engine
- `manifest.webmanifest`, `sw.js`, `icon-*.png` - install and offline support

## Licence

Stockfish is licensed under GPLv3 (see `LICENSE-stockfish.txt`). Because this app ships Stockfish,
the app as a whole is distributed under GPLv3 and its source is this repository.
Engine source: https://github.com/nmrugg/stockfish.js
