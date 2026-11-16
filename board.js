/* Movable chess board for the training pages: tap a piece then a square, or drag. Needs the global Chess (chess.js)
   and the board styles in style.css. The board only reports the move the user made; the page decides what happens next.

   var b = new ChessBoard(element, { onMove: function (m) { ... m.from, m.to, m.promotion ... } });
   b.set({ fen: '...', flip: false, movable: true | false | 'w' | 'b', last: ['e2', 'e4'], tone: 'best',
           arrow: 'g1f3', badge: { sq: 'e4', tone: 'best', sym: '✓' } });                                              */
var ChessBoard = (function () {
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function glyph(type) { return GLYPH[type] + '︎'; }
  function paint(e, tone) { e.style.setProperty('--hl', 'var(--c-' + tone + ')'); e.style.setProperty('--hl-ink', 'var(--ci-' + tone + ', #fff)'); }

  function Board(root, opts) {
    var self = this;
    this.root = root; this.opts = opts || {}; this.pick = null;
    this.s = { fen: START, flip: false, movable: true, last: null, tone: 'move', arrow: null, badge: null };
    root.classList.add('board');
    root.addEventListener('pointerdown', function (e) { self.down(e); });
    root.addEventListener('pointermove', function (e) { self.move(e); });
    root.addEventListener('pointerup', function (e) { self.up(e); });
    root.addEventListener('pointercancel', function () { if (self.pick) { self.dropGhost(); self.pick.down = null; self.mark(); } });
    this.render();
  }

  Board.prototype.set = function (o) {
    for (var k in o) this.s[k] = o[k];
    this.dropGhost(); this.pick = null;
    this.render();
  };

  Board.prototype.canMove = function (color) {
    var m = this.s.movable;
    return m === true || m === color;
  };

  Board.prototype.render = function () {
    var s = this.s, root = this.root; root.textContent = '';
    var g = new Chess(s.fen), turn = g.turn(), mine = this.canMove(turn);
    for (var y = 0; y < 8; y++) for (var c = 0; c < 8; c++) {
      var f = s.flip ? 7 - c : c, r = s.flip ? y : 7 - y;
      var name = String.fromCharCode(97 + f) + (r + 1);
      var sq = el('div', 'sq ' + ((f + r) % 2 ? 'l' : 'd')); sq.dataset.sq = name;
      if (c === 0) sq.appendChild(el('span', 'co r', String(r + 1)));
      if (y === 7) sq.appendChild(el('span', 'co f', String.fromCharCode(97 + f)));
      if (s.last && (name === s.last[0] || name === s.last[1])) { sq.classList.add('hl'); paint(sq, s.tone || 'move'); }
      var p = g.get(name);
      if (p) { sq.appendChild(el('span', 'pc ' + p.color + ' t-' + p.type, glyph(p.type))); if (mine && p.color === turn) sq.classList.add('mine'); }
      if (s.badge && s.badge.sq === name) { var bd = el('span', 'badge', s.badge.sym); paint(bd, s.badge.tone); sq.appendChild(bd); }
      root.appendChild(sq);
    }
    this.mark(); this.drawArrow();
  };

  /* Show the picked-up piece and where it can go without rebuilding the board, since a drag may be in progress. */
  Board.prototype.mark = function () {
    var sqs = this.root.querySelectorAll('.sq'), pick = this.pick;
    for (var i = 0; i < sqs.length; i++) {
      var q = sqs[i], name = q.dataset.sq, pc = q.querySelector('.pc');
      var target = !!(pick && pick.targets[name]);
      q.classList.toggle('pk', !!pick && pick.from === name);
      q.classList.toggle('tg', target);
      q.classList.toggle('cap', target && !!pc);
      if (pc) pc.classList.toggle('lift', !!pick && !!pick.ghost && pick.from === name);
    }
  };

  Board.prototype.xy = function (sq) {
    var f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
    return this.s.flip ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
  };

  Board.prototype.drawArrow = function () {
    var old = this.root.querySelector('svg');
    if (old) this.root.removeChild(old);
    var uci = this.s.arrow;
    if (!uci) return;
    var a = this.xy(uci.slice(0, 2)), b = this.xy(uci.slice(2, 4)), svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 8 8');
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    var x1 = a.x + 0.5 + ux * 0.2, y1 = a.y + 0.5 + uy * 0.2, x2 = b.x + 0.5 - ux * 0.38, y2 = b.y + 0.5 - uy * 0.38;
    var ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.style.stroke = 'var(--arrow)'; ln.setAttribute('stroke-width', '0.17'); ln.setAttribute('stroke-linecap', 'round'); ln.setAttribute('opacity', '0.85');
    var tip = document.createElementNS(NS, 'polygon');
    var tx = b.x + 0.5 - ux * 0.1, ty = b.y + 0.5 - uy * 0.1, px = -uy * 0.2, py = ux * 0.2;
    tip.setAttribute('points', tx + ',' + ty + ' ' + (x2 + px) + ',' + (y2 + py) + ' ' + (x2 - px) + ',' + (y2 - py));
    tip.style.fill = 'var(--arrow)'; tip.setAttribute('opacity', '0.85');
    svg.appendChild(ln); svg.appendChild(tip); this.root.appendChild(svg);
  };

  Board.prototype.squareAt = function (cx, cy) {
    var r = this.root.getBoundingClientRect();
    var x = Math.floor((cx - r.left) / r.width * 8), y = Math.floor((cy - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return String.fromCharCode(97 + (this.s.flip ? 7 - x : x)) + ((this.s.flip ? y : 7 - y) + 1);
  };

  Board.prototype.legalFrom = function (sq) {
    var g = new Chess(this.s.fen), t = {}, n = 0;
    if (!this.canMove(g.turn())) return null;
    g.moves({ square: sq, verbose: true }).forEach(function (m) { (t[m.to] = t[m.to] || []).push(m); n++; });
    return n ? t : null;
  };

  Board.prototype.dropGhost = function () { if (this.pick && this.pick.ghost) { this.pick.ghost.remove(); this.pick.ghost = null; } };

  Board.prototype.send = function (from, to, promotion) {
    if (this.opts.onMove) this.opts.onMove({ from: from, to: to, promotion: promotion });
  };

  Board.prototype.tryMove = function (to) {
    var self = this, m = this.pick.targets[to][0], from = this.pick.from;
    this.dropGhost(); this.pick = null; this.mark();
    if (!m.promotion) { this.send(from, to); return; }
    var box = el('div', 'promo');
    ['q', 'r', 'b', 'n'].forEach(function (t) {
      var b = el('button'); b.setAttribute('aria-label', 'Promote to ' + { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[t]);
      b.appendChild(el('span', 'pc ' + m.color + ' t-' + t, glyph(t)));
      b.addEventListener('click', function () { box.remove(); self.send(from, to, t); });
      box.appendChild(b);
    });
    box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });
    this.root.appendChild(box);
  };

  Board.prototype.down = function (e) {
    if (e.button > 0 || (e.target.closest && e.target.closest('.promo'))) return;
    var sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (this.pick && this.pick.targets[sq]) { e.preventDefault(); this.tryMove(sq); return; }
    var t = this.legalFrom(sq);
    this.dropGhost(); this.pick = null;
    if (t) {
      e.preventDefault();
      this.pick = { from: sq, targets: t, ghost: null, down: { id: e.pointerId, x: e.clientX, y: e.clientY } };
      try { this.root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    this.mark();
  };

  Board.prototype.move = function (e) {
    var pick = this.pick;
    if (!pick || !pick.down || pick.down.id !== e.pointerId) return;
    if (!pick.ghost) {
      if (Math.abs(e.clientX - pick.down.x) + Math.abs(e.clientY - pick.down.y) < 6) return;
      var p = new Chess(this.s.fen).get(pick.from);
      pick.ghost = el('span', 'pc ' + p.color + ' t-' + p.type + ' ghost', glyph(p.type));
      pick.ghost.style.fontSize = (this.root.getBoundingClientRect().width * 0.096) + 'px';
      document.body.appendChild(pick.ghost);
      this.mark();
    }
    pick.ghost.style.left = e.clientX + 'px'; pick.ghost.style.top = e.clientY + 'px';
  };

  Board.prototype.up = function (e) {
    var pick = this.pick;
    if (!pick || !pick.down || pick.down.id !== e.pointerId) return;
    var dragged = !!pick.ghost; pick.down = null;
    if (!dragged) return;   /* a plain tap leaves the piece selected, ready for a second tap */
    var sq = this.squareAt(e.clientX, e.clientY);
    if (sq && pick.targets[sq]) { this.tryMove(sq); return; }
    this.dropGhost();
    if (sq !== pick.from) this.pick = null;
    this.mark();
  };

  Board.START = START;
  return Board;
})();
