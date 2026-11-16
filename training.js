/* Training page: openings (walk through and practise lines) and tactics (bundled puzzles and the user's own mistakes).
   Needs chess.js and board.js. Data: openings.json and puzzles.json (see LICENSE-data.txt). Progress lives in localStorage. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls, fn) { var b = el('button', cls, text); b.addEventListener('click', fn); return b; }
  function load(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function joinAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function sideName(c) { return c === 'w' ? 'White' : 'Black'; }
  function getJson(file) { return fetch(file).then(function (r) { if (!r.ok) throw new Error('Could not load ' + file + '.'); return r.json(); }); }

  var ui = load('train-ui', {});
  if (location.hash === '#mistakes') { ui.tab = 'tac'; ui.src = 'mine'; }   /* the link shown after a review */
  var tab = ui.tab === 'tac' ? 'tac' : 'op';
  var flip = false;
  var current = null;   /* the screen that owns the board right now: it has onMove(m) */
  var timer = null;     /* pending automatic move */
  var board = new ChessBoard($('board'), { onMove: function (m) { if (current && current.onMove) current.onMove(m); } });
  function later(fn, ms) { clearTimeout(timer); timer = setTimeout(fn, ms); }
  function saveUi() { save('train-ui', ui); }
  function setNav(buttons) {
    var nav = $('t-nav'); nav.textContent = '';
    buttons.forEach(function (b) { if (b) nav.appendChild(b); });
  }
  function navBtn(text, label, fn, wide, disabled) {
    var b = btn(text, wide ? 'wide' : null, fn);
    if (label) b.setAttribute('aria-label', label);
    b.disabled = !!disabled;
    return b;
  }
  function flipBtn(redraw) { return navBtn('Flip board', null, function () { flip = !flip; redraw(); }, true); }
  /* On a phone the lists sit below the board, so bring the board back into view after a choice is made there. */
  function toBoard() { if (window.matchMedia && window.matchMedia('(max-width: 860px)').matches) $('t-title').scrollIntoView({ block: 'start' }); }
  function moveNo(ply, color) { return Math.floor(ply / 2 + 1) + (color === 'w' ? '. ' : '… '); }

  /* ====================================================================================================
     Explaining a move in words. Built from the position itself: what the move develops, attacks, defends or opens.
     ==================================================================================================== */
  var FILES = 'abcdefgh';
  var PN = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var PV = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
  var DIRS = {
    n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
    k: [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]],
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]]
  };
  DIRS.q = DIRS.b.concat(DIRS.r);
  var HOME = { w: { n: ['b1', 'g1'], b: ['c1', 'f1'], r: ['a1', 'h1'], q: ['d1'] }, b: { n: ['b8', 'g8'], b: ['c8', 'f8'], r: ['a8', 'h8'], q: ['d8'] } };
  var CENTRE = ['d4', 'e4', 'd5', 'e5'];

  function sqOf(f, r) { return f < 0 || f > 7 || r < 1 || r > 8 ? null : FILES[f] + r; }
  function posOf(g) {
    var o = {};
    for (var f = 0; f < 8; f++) for (var r = 1; r <= 8; r++) { var s = FILES[f] + r, p = g.get(s); if (p) o[s] = p; }
    return o;
  }
  /* Squares the piece on `from` attacks. Sliding pieces stop at the first piece they meet (and attack it). */
  function attacks(pos, from) {
    var p = pos[from], f = from.charCodeAt(0) - 97, r = +from[1], out = [];
    if (p.type === 'p') {
      var d = p.color === 'w' ? 1 : -1;
      [-1, 1].forEach(function (df) { var s = sqOf(f + df, r + d); if (s) out.push(s); });
      return out;
    }
    var slide = p.type === 'b' || p.type === 'r' || p.type === 'q';
    DIRS[p.type].forEach(function (d) {
      var x = f + d[0], y = r + d[1], s;
      while ((s = sqOf(x, y))) { out.push(s); if (!slide || pos[s]) break; x += d[0]; y += d[1]; }
    });
    return out;
  }
  function attackers(pos, sq, color) {
    var out = [];
    for (var s in pos) if (pos[s].color === color && attacks(pos, s).indexOf(sq) >= 0) out.push(s);
    return out;
  }
  /* If the slider on `from` attacks `target` and the next piece behind it is the enemy king or queen, return that piece. */
  function pinnedTo(pos, from, target) {
    var p = pos[from];
    if (p.type !== 'b' && p.type !== 'r' && p.type !== 'q') return null;
    var dx = Math.sign(target.charCodeAt(0) - from.charCodeAt(0)), dy = Math.sign(+target[1] - +from[1]);
    var x = target.charCodeAt(0) - 97 + dx, y = +target[1] + dy, s;
    while ((s = sqOf(x, y))) {
      if (pos[s]) {
        var q = pos[s];
        if (q.color !== p.color && (q.type === 'k' || q.type === 'q') && PV[q.type] > PV[pos[target].type]) return q.type;
        return null;
      }
      x += dx; y += dy;
    }
    return null;
  }
  function thing(pos, sq) { return 'the ' + PN[pos[sq].type] + ' on ' + sq; }

  /* mv is a chess.js verbose move made from the position `fen`; prev is the move before it, if any. */
  function explain(fen, mv, prev) {
    var g = new Chess(fen), before = posOf(g);
    g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    var after = posOf(g);
    var me = mv.color, them = me === 'w' ? 'b' : 'w', Me = sideName(me), Them = sideName(them);
    var to = mv.to, out = [], isPawn = mv.piece === 'p';
    var castle = mv.flags.indexOf('k') >= 0 || mv.flags.indexOf('q') >= 0;
    var capture = !!mv.captured;

    if (castle) {
      out.push('Castles ' + (mv.flags.indexOf('k') >= 0 ? 'kingside' : 'queenside') + '. The king is safer behind its pawns and the rook comes toward the centre.');
    } else if (capture) {
      if (mv.flags.indexOf('e') >= 0) out.push('Captures the pawn en passant.');
      else if (prev && prev.captured && prev.to === to) out.push('Recaptures on ' + to + ' with the ' + PN[mv.piece] + ', winning back the ' + PN[prev.captured] + '.');
      else out.push('Captures the ' + PN[mv.captured] + ' on ' + to + ' with the ' + PN[mv.piece] + '.');
      if (attackers(after, to, them).length) out.push(Them + ' can take back on ' + to + '.');
    } else if (isPawn) {
      var file = to[0], rank = +to[1], rel = me === 'w' ? rank : 9 - rank, twoStep = Math.abs(+mv.from[1] - rank) === 2;
      var bishopHome = (file === 'g' ? 'f' : 'c') + (me === 'w' ? 1 : 8), fian = (file === 'g' ? 'g' : 'b') + (me === 'w' ? 2 : 7);
      if (CENTRE.indexOf(to) >= 0) out.push('Puts a pawn on ' + to + ', taking space in the centre.');
      else if ((file === 'c' || file === 'f') && twoStep) out.push('Pushes the ' + file + '-pawn to ' + to + ' to pressure the centre from the side.');
      else if ((file === 'g' || file === 'b') && rel === 3 && after[bishopHome] && after[bishopHome].type === 'b' && after[bishopHome].color === me) out.push('Makes room to fianchetto the bishop on ' + fian + '.');
      else if ((file === 'a' || file === 'h') && rel === 3) out.push('A small pawn move that keeps enemy pieces out of ' + (file === 'a' ? 'b' : 'g') + (me === 'w' ? 4 : 5) + '.');
      else if ((file === 'c' || file === 'd' || file === 'e') && rel === 3) out.push('A solid pawn move that supports the centre.');
      else out.push('Advances the ' + file + '-pawn to ' + to + '.');
      var opened = [];
      for (var s in after) {
        var q = after[s];
        if (q.color !== me || s === to || (q.type !== 'b' && q.type !== 'q') || !before[s]) continue;
        if (attacks(after, s).length > attacks(before, s).length) opened.push(q.type === 'q' ? 'the queen' : 'the bishop on ' + s);
      }
      if (opened.length) out.push('It opens a line for ' + joinAnd(opened) + '.');
      if (attackers(after, to, them).length && !attackers(after, to, me).length) out.push('The pawn can be taken for free, so this is a gambit: ' + Me + ' offers it in return for fast development or open lines.');
    } else {
      var developed = HOME[me][mv.piece] && HOME[me][mv.piece].indexOf(mv.from) >= 0;
      if (mv.piece === 'b' && developed && /^[bg][27]$/.test(to)) out.push('Fianchettoes the bishop on ' + to + ', where it aims down the long diagonal.');
      else if (mv.piece === 'q') out.push((developed ? 'Brings the queen out to ' : 'Moves the queen to ') + to + '.');
      else if (developed && mv.piece !== 'r') out.push('Develops the ' + PN[mv.piece] + ' to ' + to + '.');
      else out.push('Moves the ' + PN[mv.piece] + ' to ' + to + '.');
    }

    if (/#$/.test(mv.san)) { out.push('It is checkmate.'); return out.join(' '); }
    if (/\+$/.test(mv.san)) out.push('It gives check.');
    if (castle) return out.join(' ');

    var reach = attacks(after, to), was = before[mv.from] ? attacks(before, mv.from) : [];
    var targets = reach.filter(function (s) { return after[s] && after[s].color === them && after[s].type !== 'k' && was.indexOf(s) < 0; });
    targets.sort(function (a, b) { return PV[after[b].type] - PV[after[a].type]; });
    var pins = [], hits = [];
    targets.slice(0, 3).forEach(function (s) {
      var behind = after[s].type === 'p' ? null : pinnedTo(after, to, s);
      if (behind) pins.push('pins ' + thing(after, s) + ' to the ' + PN[behind]);
      else hits.push((!attackers(after, s, them).length ? 'the undefended ' + PN[after[s].type] + ' on ' + s : thing(after, s)));
    });
    var acts = pins.slice();
    if (hits.length) acts.push('attacks ' + joinAnd(hits));
    if (acts.length) {
      var tail = '';
      if (hits.length === 1 && !pins.length && PV[after[targets[0]].type] > PV[mv.piece]) tail = ', which has to move or be traded';
      out.push('It ' + joinAnd(acts) + tail + '.');
    }
    var guards = reach.filter(function (s) {
      return after[s] && after[s].color === me && after[s].type !== 'k' && was.indexOf(s) < 0 && attackers(after, s, them).length;
    }).slice(0, 2);
    if (guards.length) out.push('It defends ' + joinAnd(guards.map(function (s) { return thing(after, s); })) + '.');
    if (!acts.length && !guards.length && (mv.piece === 'n' || mv.piece === 'b') && !capture) {
      var cs = CENTRE.filter(function (s) { return reach.indexOf(s) >= 0; });
      if (cs.length) out.push('It watches the central square' + (cs.length > 1 ? 's ' : ' ') + joinAnd(cs) + '.');
    }
    return out.join(' ');
  }

  /* ====================================================================================================
     Openings
     ==================================================================================================== */
  /* Short overviews written for this app. Openings without one still get the move-by-move notes. */
  var ABOUT = {
    'Sicilian Defense': 'Black answers 1.e4 with 1…c5, fighting for d4 from the side instead of copying White. The positions are unbalanced: White usually attacks on the kingside, Black counterattacks on the queenside and down the c-file.',
    'Ruy Lopez': 'White develops quickly and puts the bishop on b5 to pressure the knight that defends e5. It leads to long, strategic games where White keeps a small, lasting pull and Black aims for solid equality or a timely …d5 break.',
    'French Defense': 'Black meets 1.e4 with 1…e6 and then …d5, building a solid pawn chain. Black accepts a cramped light-squared bishop in return for a firm centre and counterplay with …c5 against d4.',
    "Queen's Gambit Declined": 'Black declines the c4 pawn and holds the centre with …e6. It is one of the most solid replies to 1.d4: Black gets a sound position and later frees the game with …c5 or …e5.',
    'Italian Game': 'White points the bishop at f7 and develops naturally. Play can be quiet and manoeuvring (with d3) or sharp (with c3 and d4, or the Evans Gambit).',
    'English Opening': 'White starts with 1.c4, controlling d5 from the side and keeping the central pawns flexible. It often transposes to other openings or becomes a reversed Sicilian.',
    "King's Gambit Accepted": 'White gives up the f-pawn to pull Black’s e-pawn away, open the f-file and build a big centre. Black has an extra pawn but must handle White’s quick attack.',
    "King's Gambit Declined": 'Black refuses the f-pawn and keeps the centre closed or strikes back with …d5, avoiding the wild positions of the accepted gambit.',
    "King's Indian Defense": 'Black lets White build a big pawn centre, fianchettoes the bishop on g7 and then attacks that centre with …e5 or …c5. Games often become a race: White on the queenside, Black against the king.',
    'Caro-Kann Defense': 'Black prepares …d5 with 1…c6. Compared with the French, the light-squared bishop gets out before …e6, giving a very solid position with few weaknesses.',
    'Nimzo-Indian Defense': 'Black pins the knight on c3 with …Bb4 to control e4, and is ready to give up the bishop pair to damage White’s pawns. A flexible, respected defence to 1.d4.',
    "Queen's Pawn Game": 'A family of 1.d4 openings where White delays or skips c4. They are usually quieter systems built on solid development.',
    'Semi-Slav Defense': 'Black supports d5 with both …c6 and …e6. It is solid but can turn very sharp when Black takes on c4 and holds the pawn with …b5.',
    'Dutch Defense': 'Black answers 1.d4 with 1…f5 to control e4 and aim at the kingside. It is ambitious and unbalancing, at the cost of a slightly loosened king.',
    'Benoni Defense': 'Black challenges d4 with …c5 and usually accepts a space disadvantage in the centre in return for active piece play and a queenside pawn majority.',
    "Queen's Gambit Accepted": 'Black takes the c4 pawn. White gets a free hand in the centre for a moment; Black uses the time to develop and hit back with …c5.',
    'Grünfeld Defense': 'Black invites White to build a large pawn centre and then attacks it with pieces and …c5, helped by the bishop on g7.',
    "Queen's Indian Defense": 'Black fianchettoes the queen’s bishop to control e4 and the long diagonal. A calm, solid defence where both sides manoeuvre for small advantages.',
    'Alekhine Defense': 'Black attacks the e4 pawn at once with …Nf6 and tempts White’s pawns forward, planning to attack the over-extended centre later.',
    'Indian Defense': 'Black answers 1.d4 with 1…Nf6, stopping e4 for now and keeping the choice of pawn structure open. Many major defences start this way.',
    'Scotch Game': 'White opens the centre at once with d4. Pieces come out quickly and the position is more open than in the Ruy Lopez or Italian.',
    'Slav Defense': 'Black supports d5 with …c6 and keeps the diagonal open for the light-squared bishop. Solid and reliable.',
    "Petrov's Defense": 'Black counterattacks e4 instead of defending e5. The positions are symmetrical and solid, and it is hard for White to get much.',
    'Four Knights Game': 'Both sides develop both knights first. Sound and classical, it can stay quiet or sharpen quickly depending on White’s fourth move.',
    'Zukertort Opening': 'White starts with 1.Nf3, controlling e5 and d4 and keeping every pawn structure available. It often transposes into other openings.',
    'Scandinavian Defense': 'Black challenges e4 immediately with 1…d5. After the exchange Black recaptures with the queen or knight and gets easy development at the cost of some time.',
    'Philidor Defense': 'Black defends e5 with the pawn on d6. It is solid but passive: Black’s dark-squared bishop is shut in, so White gets more space.',
    'Nimzowitsch Defense': 'Black answers 1.e4 with 1…Nc6, an offbeat way to fight for the centre with pieces first.',
    'Réti Opening': 'White develops the knight and attacks the centre from the wings with c4 and fianchettoed bishops rather than occupying it with pawns.',
    "Bishop's Opening": 'White develops the bishop to c4 before the knight, keeping the f-pawn free to advance. It often transposes to the Italian or Vienna.',
    'Vienna Game': 'White develops the queen’s knight first so the f-pawn can still advance. It can be played quietly or as a delayed King’s Gambit.',
    'Modern Defense': 'Black fianchettoes the king’s bishop at once and lets White take the centre, planning to undermine it later with …d6, …c5 or …e5.',
    "King's Pawn Game": 'Openings that begin 1.e4, opening lines for the queen and bishop and claiming the centre.',
    'Catalan Opening': 'White combines the Queen’s Gambit with a fianchettoed bishop on g2 that presses on Black’s queenside along the long diagonal.',
    'Bird Opening': 'White starts with 1.f4 to control e5, a mirror image of the Dutch Defense with an extra move.',
    'Pirc Defense': 'Black lets White build a centre with pawns on e4 and d4, develops with …d6, …Nf6 and …g6, and counterattacks later.',
    'Tarrasch Defense': 'Black plays an early …c5 in the Queen’s Gambit and accepts an isolated d-pawn in return for free, active pieces.',
    'Bogo-Indian Defense': 'Black checks on b4 instead of fianchettoing. A solid, simple way to finish development against 1.d4 and Nf3.',
    "King's Indian Attack": 'White uses the King’s Indian setup with an extra move: Nf3, g3, Bg2, castling and d3, then an attack with e4 and e5.',
    'Center Game': 'White opens the centre at once with d4 and recaptures with the queen, which then loses time when Black attacks it.',
    'Nimzo-Larsen Attack': 'White starts with 1.b3 and fianchettoes the queen’s bishop to pressure e5 and the long diagonal.',
    'Latvian Gambit': 'Black answers 2.Nf3 with the risky 2…f5, a reversed King’s Gambit. It is objectively dubious but sets practical problems.',
    'Ponziani Opening': 'White prepares d4 with c3. It is old and sound, but the pawn on c3 takes the knight’s best square, so Black equalises with active play.',
    'Old Indian Defense': 'Black sets up with …d6 and …e5 and develops the bishop to e7 instead of g7. Solid, slightly passive.',
    'Trompowsky Attack': 'White attacks the f6 knight with the bishop on move two, sidestepping the main Indian defences and often doubling Black’s pawns.',
    'Englund Gambit': 'Black gives a pawn with 1…e5 against 1.d4 hoping for traps. It is unsound against careful play.',
    'Benko Gambit': 'Black gives up a queenside pawn with …b5 for long-term pressure down the open a- and b-files.',
    'London System': 'White develops the bishop to f4 and builds a solid pyramid with e3 and c3. The same setup works against almost anything.',
    'Danish Gambit': 'White gives up one or two pawns to open lines for both bishops and get a big lead in development.',
    'Owen Defense': 'Black fianchettoes the queen’s bishop against 1.e4, pressing on e4 from a distance.',
    'Polish Opening': 'White starts with 1.b4, gaining queenside space and preparing Bb2. Unusual but playable.',
    'Grob Opening': 'White starts with 1.g4, an eccentric move that weakens the kingside and relies on surprise.',
    'Hungarian Opening': 'White starts with 1.g3 and fianchettoes the king’s bishop, keeping the centre flexible.',
    'Van Geet Opening': 'White starts with 1.Nc3, a flexible developing move that can transpose to many openings.',
    'Blackmar-Diemer Gambit': 'White gives up a pawn with e4 and f3 against 1…d5 to open lines and develop fast.',
    'Neo-Grünfeld Defense': 'A Grünfeld setup played when White has fianchettoed or has not yet put the knight on c3.',
    'Pterodactyl Defense': 'Black combines a fianchettoed bishop with …c5 and an early …Qa5, pressing on the dark squares.',
    'Rat Defense': 'Black starts with 1…d6, keeping options open for a Pirc, Modern or Philidor setup.',
    'Richter-Veresov Attack': 'White develops Nc3 and Bg5 against 1…d5 and 1…Nf6, aiming for quick piece play and e4.'
  };

  var op = {
    ready: false, lines: [], fams: [], famBy: {}, root: null,
    fam: null, line: null, path: [], msg: null,        /* walk-through state */
    pr: null                                            /* practice run, when one is on */
  };
  var opProg = load('train-op', {});      /* side + line key -> [clean streak, runs] */
  var opSide = load('train-side', {});    /* family name -> side the user chose */

  function buildOpenings(rows) {
    var root = { m: null, k: {}, kids: [], n: 0, p: null, name: null, eco: null };
    rows.forEach(function (r) {
      var sans = r[2].split(' '), node = root;
      root.n++;
      sans.forEach(function (s) {
        var c = node.k[s];
        if (!c) { c = { m: s, k: {}, kids: [], n: 0, p: node, name: null, eco: null }; node.k[s] = c; node.kids.push(c); }
        c.n++; node = c;
      });
      if (node.name) return;   /* the same moves listed twice: keep the first name */
      node.name = r[1]; node.eco = r[0];
      var fname = r[1].split(':')[0], fam = op.famBy[fname];
      if (!fam) { fam = op.famBy[fname] = { name: fname, lines: [], owner: null }; op.fams.push(fam); }
      var line = { eco: r[0], name: r[1], sub: r[1].indexOf(':') >= 0 ? r[1].slice(r[1].indexOf(':') + 1).trim() : 'Main line', sans: sans, key: hash(r[2]), fam: fam };
      fam.lines.push(line); op.lines.push(line);
    });
    op.fams.forEach(function (f) {
      f.lines.sort(function (a, b) { return a.sans.length - b.sans.length || (a.name < b.name ? -1 : 1); });
      /* Whose opening is it? The side that made the move that defines it, or the side that offered the gambit. */
      var last = f.lines[0].sans.length % 2 ? 'w' : 'b';
      f.owner = /Gambit (Accepted|Declined)/.test(f.name) && !/^Queen's/.test(f.name) ? (last === 'w' ? 'b' : 'w') : last;
    });
    op.fams.sort(function (a, b) { return b.lines.length - a.lines.length || (a.name < b.name ? -1 : 1); });
    op.root = root; op.ready = true;
  }
  function nodeAt(path) { var n = op.root; for (var i = 0; i < path.length && n; i++) n = n.k[path[i]]; return n; }
  function nameOf(node) { while (node && !node.name) node = node.p; return node && node.name ? node : null; }
  function leadsTo(node) { while (!node.name) node = node.kids.reduce(function (a, b) { return b.n > a.n ? b : a; }); return node; }
  function inFamily(node, fam) {
    if (!node.f) node.f = {};
    if (node.f[fam.name] == null) node.f[fam.name] = (node.name && node.name.split(':')[0] === fam.name) || node.kids.some(function (k) { return inFamily(k, fam); });
    return node.f[fam.name];
  }
  /* Replay SAN moves from the start: the verbose moves and the position before each one. */
  function replay(sans) {
    var g = new Chess(), hist = [], fens = [g.fen()];
    for (var i = 0; i < sans.length; i++) { var m = g.move(sans[i]); if (!m) break; hist.push(m); fens.push(g.fen()); }
    return { hist: hist, fens: fens };
  }
  function famSide(fam) { return opSide[fam.name] || fam.owner; }
  function progOf(line, side) { return opProg[side + line.key] || [0, 0]; }
  function isKnown(line, side) { return progOf(line, side)[0] >= 2; }
  function userMoves(line, side) { var n = 0; for (var i = side === 'w' ? 0 : 1; i < line.sans.length; i += 2) n++; return n; }
  function knownCount(fam, side) { return fam.lines.filter(function (l) { return isKnown(l, side); }).length; }
  function sanText(sans) {
    return sans.map(function (s, i) { return (i % 2 ? '' : (i / 2 + 1) + '.') + s; }).join(' ');
  }

  /* ---------- lists on the right ---------- */
  function renderFamilies() {
    var box = $('op-fams'); box.textContent = '';
    if (!op.ready) { $('op-count').textContent = 'Loading the opening book…'; return; }
    var q = $('op-search').value.trim().toLowerCase(), shown = 0;
    /* Openings whose own name matches come first, then ones that only have a matching line or ECO code. */
    var byName = [], byLine = [];
    op.fams.forEach(function (f) {
      if (!q || f.name.toLowerCase().indexOf(q) >= 0) byName.push(f);
      else if (f.lines.some(function (l) { return l.name.toLowerCase().indexOf(q) >= 0 || l.eco.toLowerCase() === q; })) byLine.push(f);
    });
    byName.concat(byLine).forEach(function (f) {
      var b = el('button', 'item' + (op.fam === f ? ' sel' : ''));
      var known = knownCount(f, famSide(f));
      b.appendChild(el('span', null, f.name));
      b.appendChild(el('span', 'meta', f.lines.length + (f.lines.length === 1 ? ' line' : ' lines') + (known ? ' · ' + known + ' known' : '')));
      b.addEventListener('click', function () { pickFamily(f); });
      box.appendChild(b); shown++;
    });
    $('op-count').textContent = shown ? shown + ' of ' + op.fams.length + ' openings, ' + op.lines.length + ' named lines in the book.' : 'No opening matches that search.';
  }
  function renderFamily() {
    var box = $('op-fam'), f = op.fam;
    box.hidden = !f; box.textContent = '';
    if (!f) return;
    var side = famSide(f);
    box.appendChild(el('h2', null, f.name));
    var about = ABOUT[f.name] || ABOUT[f.name.replace(/ (Accepted|Declined)$/, '')] || ABOUT[f.name.split(',')[0]];
    if (about) box.appendChild(el('p', null, about)).style.margin = '0';
    var row = el('div', 'row');
    row.appendChild(el('span', null, 'I play'));
    ['w', 'b'].forEach(function (c) {
      row.appendChild(btn(sideName(c), 'tab' + (side === c ? ' sel' : ''), function () { opSide[f.name] = c; save('train-side', opSide); stopPractice(); renderOpenings(); }));
    });
    row.appendChild(btn('Practise lines', 'primary', function () { practiseNext(null); toBoard(); }));
    box.appendChild(row);
    var known = knownCount(f, side);
    box.appendChild(el('p', 'fine', known + ' of ' + f.lines.length + ' lines known as ' + sideName(side) + '. A line counts as known after two clean practice runs in a row. Tap a line to walk through it.')).style.margin = '0';
    var q = '';
    if (f.lines.length > 12) {
      var filter = el('input', 'field'); filter.type = 'search'; filter.placeholder = 'Filter these lines'; filter.value = op.lineFilter || '';
      filter.addEventListener('input', function () { op.lineFilter = filter.value; fill(); });
      box.appendChild(filter);
    } else op.lineFilter = '';
    var list = el('div', 'list'); box.appendChild(list);
    function fill() {
      list.textContent = ''; q = (op.lineFilter || '').trim().toLowerCase();
      f.lines.forEach(function (l) {
        if (q && l.name.toLowerCase().indexOf(q) < 0 && l.eco.toLowerCase() !== q) return;
        var p = progOf(l, side), b = el('button', 'item' + (op.line === l ? ' sel' : ''));
        b.appendChild(el('span', 'st' + (p[0] >= 2 ? ' known' : (p[1] ? ' part' : ''))));
        b.appendChild(el('span', null, l.sub));
        b.appendChild(el('span', 'meta', l.eco));
        b.appendChild(el('span', 'san', sanText(l.sans)));
        b.addEventListener('click', function () { stopPractice(); op.line = l; op.path = []; op.msg = null; renderOpenings(); toBoard(); });
        list.appendChild(b);
      });
    }
    fill();
  }
  function pickFamily(f) {
    stopPractice();
    op.fam = f; op.line = null; op.msg = null; op.lineFilter = '';
    op.path = f.lines[0].sans.slice();    /* start on the position that defines the opening */
    flip = famSide(f) === 'b';
    ui.fam = f.name; saveUi();
    renderOpenings();
    toBoard();
  }

  /* ---------- walk-through ---------- */
  var walk = {
    onMove: function (m) {
      var r = replay(op.path), g = new Chess(r.fens[r.fens.length - 1]), mv = g.move(m);
      if (!mv) return;
      var node = nodeAt(op.path);
      if (node.k[mv.san]) { op.path.push(mv.san); op.msg = null; }
      else op.msg = mv.san + ' is not in the opening book from this position. The book moves are listed below.';
      renderOpenings();
    }
  };
  function onLine() { return op.line && op.path.every(function (s, i) { return op.line.sans[i] === s; }); }
  function nextSan() {
    var node = nodeAt(op.path);
    if (onLine() && op.path.length < op.line.sans.length) return op.line.sans[op.path.length];
    if (!node || !node.kids.length) return null;
    return node.kids.reduce(function (a, b) { return b.n > a.n ? b : a; }).m;
  }
  function goTo(n) { op.path.length = Math.max(0, Math.min(op.path.length, n)); op.msg = null; renderOpenings(); }
  function renderWalk() {
    current = walk;
    var r = replay(op.path), n = op.path.length, fen = r.fens[n], last = r.hist[n - 1] || null;
    var node = nodeAt(op.path), named = nameOf(node), next = nextSan();
    board.set({ fen: fen, flip: flip, movable: true, last: last ? [last.from, last.to] : null, tone: 'move', arrow: null, badge: null });
    $('t-title').textContent = op.line ? 'Walking through: ' + op.line.name : (op.fam ? 'Exploring: ' + op.fam.name : 'Pick an opening on the right, or just start moving the pieces.');
    setNav([
      navBtn('|<', 'Back to the start', function () { goTo(0); }, false, !n),
      navBtn('<', 'Back one move', function () { goTo(n - 1); }, false, !n),
      navBtn('>', 'Forward one move', function () { if (next) { op.path.push(next); op.msg = null; renderOpenings(); } }, false, !next),
      flipBtn(renderOpenings),
      op.line ? navBtn('Practise this', null, function () { startPractice(op.line); }, true, !userMoves(op.line, famSide(op.line.fam))) : null
    ]);

    var v = $('t-info'); v.textContent = '';
    var head = el('div', 'head');
    head.appendChild(el('span', 'pill ex', 'Walk-through'));
    head.appendChild(el('span', 'name', named ? named.name : 'Starting position'));
    if (named) head.appendChild(el('span', 'ev', named.eco));
    v.appendChild(head);
    if (op.msg) v.appendChild(el('p', 'msg-bad', op.msg));
    if (last) {
      var p = el('p');
      p.appendChild(el('b', null, moveNo(n - 1, last.color) + last.san)).style.fontFamily = 'var(--font-mono)';
      p.appendChild(document.createTextNode('  ' + explain(r.fens[n - 1], last, r.hist[n - 2])));
      v.appendChild(p);
    } else {
      v.appendChild(el('p', null, 'Play a move on the board or tap one below. Each move comes with a note on what it does and the replies the book knows.'));
    }
    if (!node.kids.length) {
      v.appendChild(el('p', 'fine', 'This is the end of the line in the book.')).style.margin = '0';
      return;
    }
    var turn = fen.split(' ')[1];
    v.appendChild(el('h3', null, 'How ' + sideName(turn) + ' can reply'));
    var kids = node.kids.slice().sort(function (a, b) {
      var fa = op.fam && inFamily(a, op.fam) ? 1 : 0, fb = op.fam && inFamily(b, op.fam) ? 1 : 0;
      return (b.m === next) - (a.m === next) || fb - fa || b.n - a.n;
    });
    var box = el('div', 'replies'), g = new Chess(fen);
    kids.forEach(function (k) {
      var mv = g.move(k.m); g.undo();
      var b = el('button', 'reply' + (k.m === next && onLine() ? ' next' : ''));
      b.appendChild(el('b', null, moveNo(n, turn) + k.m));
      b.appendChild(el('span', 'rn', leadsTo(k).name + (k.n > 1 ? ' · ' + k.n + ' lines' : '')));
      if (mv) b.appendChild(el('small', null, explain(fen, mv, last)));
      b.addEventListener('click', function () { op.path.push(k.m); op.msg = null; renderOpenings(); });
      box.appendChild(b);
    });
    v.appendChild(box);
  }

  /* ---------- practice ---------- */
  function stopPractice() { clearTimeout(timer); op.pr = null; }
  function candidates(fam, side) { return fam.lines.filter(function (l) { return userMoves(l, side) > 0; }); }
  /* Next line to practise: unknown ones first, the least practised and shortest of those first. */
  function practiseNext(skip) {
    var f = op.fam; if (!f) return;
    var side = famSide(f), list = candidates(f, side).filter(function (l) { return l !== skip; });
    if (!list.length) { if (skip) startPractice(skip); return; }
    list.sort(function (a, b) {
      var pa = progOf(a, side), pb = progOf(b, side);
      return (pa[0] >= 2) - (pb[0] >= 2) || pa[1] - pb[1] || a.sans.length - b.sans.length;
    });
    startPractice(list[0]);
  }
  function startPractice(line) {
    var side = famSide(line.fam);
    op.fam = line.fam; op.line = line;
    op.pr = { line: line, side: side, i: 0, clean: true, done: false, note: null, bad: null, arrow: null, r: replay(line.sans) };
    flip = side === 'b';
    renderOpenings();
    autoReply();
  }
  function autoReply() {
    var pr = op.pr;
    if (!pr || pr.done) return;
    if (pr.i >= pr.line.sans.length) { finishPractice(); return; }
    if (pr.r.hist[pr.i].color === pr.side) return;
    later(function () {
      if (op.pr !== pr) return;
      pr.i++; renderOpenings(); autoReply();
    }, 550);
  }
  function finishPractice() {
    var pr = op.pr, p = progOf(pr.line, pr.side);
    pr.done = true;
    opProg[pr.side + pr.line.key] = [pr.clean ? p[0] + 1 : 0, p[1] + 1];
    save('train-op', opProg);
    renderOpenings();
  }
  var practice = {
    onMove: function (m) {
      var pr = op.pr;
      if (!pr || pr.done) return;
      var g = new Chess(pr.r.fens[pr.i]), mv = g.move(m), want = pr.r.hist[pr.i];
      if (!mv) return;
      if (mv.san === want.san) {
        pr.i++; pr.bad = null; pr.arrow = null;
        renderOpenings(); autoReply();
        return;
      }
      var other = nodeAt(pr.line.sans.slice(0, pr.i)).k[mv.san];
      pr.clean = false; pr.arrow = want.from + want.to;
      pr.bad = other
        ? mv.san + ' is a book move too (it leads to ' + leadsTo(other).name + '), but it leaves this line. Here the move is ' + want.san + '.'
        : mv.san + ' leaves the line. The move here is ' + want.san + '.';
      renderOpenings();
    }
  };
  function renderPractice() {
    current = practice;
    var pr = op.pr, r = pr.r, n = pr.i, last = r.hist[n - 1] || null, total = pr.line.sans.length;
    var mine = !pr.done && n < total && r.hist[n].color === pr.side;
    board.set({ fen: r.fens[n], flip: flip, movable: mine ? pr.side : false, last: last ? [last.from, last.to] : null, tone: 'move', arrow: pr.arrow, badge: null });
    $('t-title').textContent = 'Practising: ' + pr.line.name + ' · you play ' + sideName(pr.side);
    setNav([
      navBtn('Show the move', null, function () { var w = r.hist[pr.i]; pr.clean = false; pr.arrow = w.from + w.to; pr.bad = 'The move is ' + w.san + '.'; renderOpenings(); }, true, !mine),
      navBtn('Restart', null, function () { startPractice(pr.line); }, true),
      navBtn('Next line', null, function () { practiseNext(pr.line); }, true),
      navBtn('Stop', null, function () { var l = pr.line; stopPractice(); op.line = l; op.path = l.sans.slice(0, n); renderOpenings(); }, true)
    ]);

    var v = $('t-info'); v.textContent = '';
    var head = el('div', 'head');
    head.appendChild(el('span', 'pill ex', 'Practice'));
    head.appendChild(el('span', 'name', pr.line.name));
    head.appendChild(el('span', 'ev', 'move ' + Math.min(n + 1, total) + ' of ' + total));
    v.appendChild(head);
    if (pr.bad) v.appendChild(el('p', 'msg-bad', pr.bad));
    if (pr.done) {
      var p = progOf(pr.line, pr.side);
      v.appendChild(el('p', pr.clean ? 'msg-good' : null, pr.clean
        ? (p[0] >= 2 ? 'Line complete with no mistakes. You know this line.' : 'Line complete with no mistakes. One more clean run and it counts as known.')
        : 'Line complete. You needed help this time, so run it again to make it stick.'));
      var row = el('div', 'exbtns');
      row.appendChild(btn('Next line', 'primary', function () { practiseNext(pr.line); }));
      row.appendChild(btn('Repeat this line', null, function () { startPractice(pr.line); }));
      row.appendChild(btn('Walk through it', null, function () { var l = pr.line; stopPractice(); op.line = l; op.path = []; renderOpenings(); }));
      v.appendChild(row);
    } else if (!n && mine) {
      v.appendChild(el('p', null, 'Play ' + sideName(pr.side) + '’s moves for this line. The other side’s moves are played for you.'));
    } else if (!pr.bad && mine) {
      v.appendChild(el('p', null, 'Your move.'));
    }
    /* Notes on the last two moves, newest first, so each correct move is reinforced with what it does. */
    for (var i = n - 1; i >= Math.max(0, n - 2); i--) {
      var mv = r.hist[i], note = el('p');
      note.appendChild(el('b', null, moveNo(i, mv.color) + mv.san)).style.fontFamily = 'var(--font-mono)';
      note.appendChild(document.createTextNode('  ' + explain(r.fens[i], mv, r.hist[i - 1])));
      v.appendChild(note);
    }
  }

  function renderOpenings() {
    if (tab !== 'op') return;
    renderFamilies(); renderFamily();
    if (!op.ready) {
      current = null;
      board.set({ fen: ChessBoard.START, flip: flip, movable: false, last: null, arrow: null, badge: null });
      $('t-title').textContent = ''; setNav([]); $('t-info').textContent = op.error || 'Loading the opening book…';
      return;
    }
    if (op.pr) renderPractice(); else renderWalk();
  }
  $('op-search').addEventListener('input', renderFamilies);

  /* ====================================================================================================
     Tactics
     ==================================================================================================== */
  var THEME = { fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discovered attack', doubleCheck: 'double check', sacrifice: 'sacrifice',
    hangingPiece: 'hanging piece', trappedPiece: 'trapped piece', deflection: 'deflection', attraction: 'attraction', clearance: 'clearance',
    interference: 'interference', intermezzo: 'in-between move', quietMove: 'quiet move', xRayAttack: 'x-ray', zugzwang: 'zugzwang',
    backRankMate: 'back-rank mate', smotheredMate: 'smothered mate', mateIn1: 'mate in 1', mateIn2: 'mate in 2', mateIn3: 'mate in 3', mateIn4: 'mate in 4',
    promotion: 'promotion', advancedPawn: 'advanced pawn', exposedKing: 'exposed king', kingsideAttack: 'kingside attack', queensideAttack: 'queenside attack',
    capturingDefender: 'removing the defender', defensiveMove: 'defensive move', endgame: 'endgame', middlegame: 'middlegame', opening: 'opening',
    rookEndgame: 'rook endgame', pawnEndgame: 'pawn endgame', queenEndgame: 'queen endgame', bishopEndgame: 'bishop endgame', knightEndgame: 'knight endgame' };
  var tac = { set: null, error: null, src: ui.src === 'mine' ? 'mine' : 'set', p: null };
  var tacProg = load('train-tac', {});    /* puzzle id -> [times solved cleanly, times failed, when last tried, last result] */
  if ($('tac-level').querySelector('option[value="' + ui.level + '"]')) $('tac-level').value = ui.level;
  function myPuzzles() { var a = load('my-puzzles', []); return Array.isArray(a) ? a : []; }
  function tried(id) { return tacProg[id]; }
  function record(id, ok) {
    var p = tacProg[id] || [0, 0, 0, 0];
    tacProg._n = (tacProg._n || 0) + 1;
    tacProg[id] = [p[0] + (ok ? 1 : 0), p[1] + (ok ? 0 : 1), tacProg._n, ok ? 1 : 0];
    save('train-tac', tacProg);
  }
  function pool() {
    if (tac.src === 'mine') return myPuzzles().map(function (m) { return { id: 'm:' + m.id, mine: m }; });
    if (!tac.set) return [];
    var lv = $('tac-level').value.split('-'), lo = +lv[0], hi = +lv[1];
    return tac.set.filter(function (p) { return p[3] >= lo && p[3] < hi; }).map(function (p) { return { id: p[0], set: p }; });
  }
  /* Next puzzle: mostly ones never tried; every so often one that was failed a while ago; then the oldest. */
  function choose(skipId) {
    var list = pool().filter(function (p) { return p.id !== skipId; });
    if (!list.length) return null;
    var now = tacProg._n || 0;
    var fresh = list.filter(function (p) { return !tried(p.id); });
    var retry = list.filter(function (p) { var t = tried(p.id); return t && !t[3] && now - t[2] >= 4; });
    var pickFrom = retry.length && (!fresh.length || Math.random() < 0.3) ? retry : fresh;
    if (pickFrom.length) return pickFrom[Math.floor(Math.random() * pickFrom.length)];
    return list.reduce(function (a, b) { return tried(b.id)[2] < tried(a.id)[2] ? b : a; });
  }
  function nextPuzzle() {
    clearTimeout(timer);
    var c = choose(tac.p ? tac.p.id : null);
    if (!c) { tac.p = null; renderTactics(); return; }
    var p = { id: c.id, mine: c.mine || null, set: c.set || null, i: 0, failed: false, solved: false, shown: false, msg: null, arrow: null, last: null, tone: 'move' };
    if (c.set) {
      p.moves = c.set[2].split(' ');
      var g = new Chess(c.set[1]);
      p.fen = c.set[1]; p.side = g.turn() === 'w' ? 'b' : 'w';     /* the first move is the opponent's; the solver answers it */
      p.lead = true;
    } else {
      p.fen = c.mine.fen; p.side = c.mine.fen.split(' ')[1];
      p.moves = [c.mine.best]; p.lead = false;
    }
    tac.p = p; flip = p.side === 'b';
    renderTactics();
    if (p.lead) later(function () { if (tac.p === p) { applyUci(p, p.moves[0]); p.i = 1; p.lead = false; renderTactics(); } }, 650);
  }
  function applyUci(p, uci) {
    var g = new Chess(p.fen), mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (mv) { p.fen = g.fen(); p.last = [mv.from, mv.to]; }
    return mv;
  }
  function sanOf(fen, uci) {
    var mv = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return mv ? mv.san : uci;
  }
  function puzzleSolved(p) {
    p.solved = true; p.arrow = null;
    if (!p.failed) record(p.id, true);
    renderTactics();
  }
  function puzzleFail(p) { if (!p.failed) { p.failed = true; record(p.id, false); } }
  var tactics = {
    onMove: function (m) {
      var p = tac.p;
      if (!p || p.solved || p.lead) return;
      var g = new Chess(p.fen), mv = g.move(m);
      if (!mv) return;
      var uci = mv.from + mv.to + (mv.promotion || ''), want = p.moves[p.i];
      var ok = uci === want || g.in_checkmate() || (p.mine && p.mine.alt === uci);
      if (!ok) {
        puzzleFail(p);
        p.msg = mv.san + ' is not the move. Try again.'; p.tone = 'move';
        renderTactics();
        return;
      }
      p.fen = g.fen(); p.last = [mv.from, mv.to]; p.tone = 'best'; p.msg = null; p.arrow = null; p.i++;
      p.alsoGood = p.mine && uci !== want && !g.in_checkmate();
      if (p.i >= p.moves.length || g.in_checkmate()) { puzzleSolved(p); return; }
      renderTactics();
      later(function () {
        if (tac.p !== p) return;
        applyUci(p, p.moves[p.i]); p.i++; p.tone = 'move';
        if (p.i >= p.moves.length) puzzleSolved(p); else renderTactics();
      }, 550);
    }
  };
  function showMove() {
    var p = tac.p; if (!p || p.solved || p.lead) return;
    puzzleFail(p); p.shown = true;
    p.arrow = p.moves[p.i]; p.msg = 'The move is ' + sanOf(p.fen, p.moves[p.i]) + '. Play it on the board to continue.';
    renderTactics();
  }
  function tacStats() {
    var ids = pool().map(function (p) { return p.id; }), triedN = 0, ok = 0;
    ids.forEach(function (id) { var t = tried(id); if (t) { triedN++; if (t[0]) ok++; } });
    return { total: ids.length, tried: triedN, ok: ok };
  }
  function renderTacSide() {
    var mine = tac.src === 'mine', n = myPuzzles().length, s = tacStats();
    $('src-set').classList.toggle('sel', !mine); $('src-mine').classList.toggle('sel', mine);
    $('src-mine').textContent = 'My mistakes (' + n + ')';
    $('tac-level-row').hidden = mine; $('tac-mine-row').hidden = !mine || !n;
    $('tac-stats').textContent = s.total ? 'Solved ' + s.ok + ' of ' + s.tried + ' tried · ' + s.total + ' puzzles here.' : '';
    $('tac-about').textContent = mine
      ? 'These come from your own reviewed games: every mistake, miss and blunder you made is saved here after a review, and you have to find the move the engine preferred.'
      : 'Puzzles from the Lichess puzzle database (public domain, CC0). The opponent moves first, then you find the best reply. Missed puzzles come back later.';
  }
  function renderTactics() {
    if (tab !== 'tac') return;
    current = tactics; renderTacSide();
    var v = $('t-info'), p = tac.p; v.textContent = '';
    if (!p) {
      board.set({ fen: ChessBoard.START, flip: false, movable: false, last: null, arrow: null, badge: null });
      $('t-title').textContent = ''; setNav([]);
      if (tac.src === 'mine') v.appendChild(el('p', null, 'No saved mistakes yet. Review one of your games on the Game review page, and your mistakes from it will appear here as puzzles.'));
      else v.appendChild(el('p', null, tac.error || (tac.set ? 'No puzzles at this level.' : 'Loading puzzles…')));
      return;
    }
    var live = !p.solved && !p.lead;
    board.set({ fen: p.fen, flip: flip, movable: live ? p.side : false, last: p.last, tone: p.tone, arrow: p.arrow, badge: null });
    $('t-title').textContent = p.mine ? 'From your game: ' + p.mine.vs + (p.mine.date ? ' · ' + p.mine.date : '') : 'Puzzle from the Lichess set';
    setNav([
      navBtn('Show the move', null, showMove, true, !live),
      navBtn(p.solved ? 'Next puzzle' : 'Skip', null, function () { if (!p.solved) puzzleFail(p); nextPuzzle(); }, true),
      flipBtn(renderTactics)
    ]);
    var head = el('div', 'head');
    head.appendChild(el('span', 'pill ex', p.solved ? 'Solved' : 'Puzzle'));
    head.appendChild(el('span', 'name', p.solved ? (p.failed ? 'Solved with help' : 'Solved first try') : 'Find the best move for ' + sideName(p.side)));
    if (p.set) head.appendChild(el('span', 'ev', p.solved ? 'rated ' + p.set[3] : ''));
    v.appendChild(head);
    if (p.msg && !p.solved) v.appendChild(el('p', p.shown ? null : 'msg-bad', p.msg));
    if (p.lead) v.appendChild(el('p', null, 'Watch the opponent’s move…'));
    else if (live && !p.msg) v.appendChild(el('p', null, p.i > 1 ? 'Good. Keep going.' : (p.mine ? 'You went wrong here in the game. What should you have played?' : 'Your opponent has just moved. Find the strongest reply.')));
    if (p.solved) {
      if (p.mine) {
        var m = p.mine;
        v.appendChild(el('p', null, (p.alsoGood ? 'That works as well. The engine’s first choice was ' + m.line[0] + '. ' : '') +
          'In the game you played ' + m.no + m.played + ' (' + m.cls + '), and the evaluation went from ' + m.ev + '.'));
        if (m.line && m.line.length) {
          var b = el('div', 'better');
          b.appendChild(document.createTextNode('Engine line: '));
          b.appendChild(el('b', null, m.line[0]));
          if (m.line.length > 1) b.appendChild(el('span', 'linepv', ' ' + m.line.slice(1).join(' ')));
          v.appendChild(b);
        }
      } else {
        var themes = p.set[4].split(' ').map(function (t) { return THEME[t]; }).filter(Boolean);
        var info = el('p', null, themes.length ? 'Themes: ' + themes.join(', ') + '. ' : '');
        var a = el('a', null, 'Puzzle ' + p.set[0] + ' on Lichess'); a.href = 'https://lichess.org/training/' + p.set[0]; a.target = '_blank'; a.rel = 'noopener';
        info.appendChild(a); v.appendChild(info);
      }
      var row = el('div', 'exbtns');
      row.appendChild(btn('Next puzzle', 'primary', nextPuzzle));
      v.appendChild(row);
    }
  }
  function openTactics() {
    if (tac.src === 'set' && !tac.set && !tac.loading) {
      tac.loading = true;
      getJson('puzzles.json').then(function (d) { tac.set = d; }, function (e) { tac.error = e.message; })
        .then(function () { tac.loading = false; if (tab === 'tac' && tac.src === 'set' && !tac.p) nextPuzzle(); });
    }
    if (!tac.p && (tac.src === 'mine' || tac.set)) nextPuzzle(); else renderTactics();
  }
  function setSource(src) { tac.src = src; tac.p = null; ui.src = src; saveUi(); clearTimeout(timer); openTactics(); }
  $('src-set').addEventListener('click', function () { setSource('set'); });
  $('src-mine').addEventListener('click', function () { setSource('mine'); });
  $('tac-level').addEventListener('change', function () { ui.level = this.value; saveUi(); tac.p = null; openTactics(); });
  $('tac-clear').addEventListener('click', function () {
    if (!window.confirm('Delete all the mistakes saved from your games? This cannot be undone.')) return;
    save('my-puzzles', []); tac.p = null; openTactics();
  });

  /* ====================================================================================================
     Tabs and start-up
     ==================================================================================================== */
  function showTab(t) {
    tab = t; ui.tab = t; saveUi(); clearTimeout(timer);
    $('tab-op').classList.toggle('sel', t === 'op'); $('tab-tac').classList.toggle('sel', t === 'tac');
    $('tab-op').setAttribute('aria-selected', String(t === 'op')); $('tab-tac').setAttribute('aria-selected', String(t === 'tac'));
    $('op-side').hidden = t !== 'op'; $('tac-side').hidden = t !== 'tac';
    if (t === 'op') { if (op.pr && !op.pr.done) { flip = op.pr.side === 'b'; } renderOpenings(); autoReply(); }
    else openTactics();
  }
  $('tab-op').addEventListener('click', function () { showTab('op'); });
  $('tab-tac').addEventListener('click', function () { showTab('tac'); });
  document.addEventListener('keydown', function (e) {
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || tab !== 'op' || op.pr || !op.ready) return;
    if (e.key === 'ArrowLeft') { goTo(op.path.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { var s = nextSan(); if (s) { op.path.push(s); op.msg = null; renderOpenings(); } e.preventDefault(); }
  });

  getJson('openings.json').then(buildOpenings, function (e) { op.error = e.message; }).then(function () {
    if (op.ready && ui.fam && op.famBy[ui.fam]) {
      op.fam = op.famBy[ui.fam]; op.path = op.fam.lines[0].sans.slice(); flip = famSide(op.fam) === 'b';
    }
    renderOpenings();
  });
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
  showTab(tab);
})();
