/* Appearance: theme, board colours, piece set, hats and custom colours. Loaded in the <head> of every page so the saved
   look is applied before the first paint; the settings panel is built once the page has loaded. Everything is kept in
   this browser's localStorage. Piece artwork and its licences are listed in LICENSE-data.txt. */
(function () {
  var root = document.documentElement;
  var THEMES = [['dark', 'Dark'], ['midnight', 'Midnight'], ['light', 'Light']];
  var BOARDS = [['green', 'Green', '#eaebd3', '#6f9457'], ['wood', 'Wood', '#f0d9b5', '#b58863'], ['blue', 'Blue', '#e4eaf0', '#7b97b1'],
    ['slate', 'Slate', '#d8dce1', '#7c8695'], ['purple', 'Purple', '#e9e3f2', '#8b74ae'], ['rose', 'Rose', '#f6e3e0', '#c2777a']];
  var PIECES = [['cburnett', 'Classic'], ['merida', 'Merida'], ['chessnut', 'Chessnut'], ['mpchess', 'Outline'], ['rhosgfx', 'Clay'],
    ['celtic', 'Celtic'], ['fantasy', 'Fantasy'], ['spatial', 'Spatial'], ['glyph', 'Plain symbols']];
  var HATS = [['none', 'No hats', ''], ['tophat', 'Top hats', '🎩'], ['crown', 'Crowns', '👑'], ['cap', 'Caps', '🧢'], ['grad', 'Graduates', '🎓'],
    ['sun', 'Sun hats', '👒'], ['helmet', 'Helmets', '🪖'], ['mix', 'One each', '🎭']];
  var GRADES = [['brilliant', 'Brilliant'], ['great', 'Great'], ['best', 'Best'], ['excellent', 'Excellent'], ['good', 'Good'],
    ['inaccuracy', 'Inaccuracy'], ['mistake', 'Mistake'], ['miss', 'Miss'], ['blunder', 'Blunder'], ['forced', 'Forced']];
  var PAGE = [['bg', 'Background'], ['surface', 'Panels'], ['btn', 'Buttons'], ['ink', 'Text'], ['muted', 'Secondary text'], ['line', 'Borders'],
    ['accent', 'Main buttons and highlights'], ['accent-ink', 'Text on main buttons']];
  var COLOR_GROUPS = [
    ['Page', PAGE],
    ['Board', [['sq-light', 'Light squares'], ['sq-dark', 'Dark squares'], ['coord', 'Coordinates'], ['c-move', 'Last move'], ['arrow', 'Best-move arrow'], ['pick', 'Selected piece and its moves']]],
    ['Plain symbol pieces', [['piece-white', 'White pieces'], ['piece-white-edge', 'White piece outline'], ['piece-black', 'Black pieces'], ['piece-black-edge', 'Black piece glow']]],
    ['Evaluation bar and graph', [['graph-white', 'White’s share'], ['graph-black', 'Black’s share']]],
    ['Move grades', GRADES.map(function (g) { return ['c-' + g[0], g[1]]; })]
  ];
  var colorKeys = {};
  COLOR_GROUPS.forEach(function (g) { g[1].forEach(function (f) { colorKeys[f[0]] = 1; }); });

  function load(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function known(list, id, fallback) { return list.some(function (x) { return x[0] === id; }) ? id : fallback; }

  var look = load('look', {}), colors = {}, stored = load('colors', {});
  for (var ck in stored) if (colorKeys[ck] && /^#[0-9a-f]{6}$/i.test(stored[ck])) colors[ck] = stored[ck];
  look.theme = known(THEMES, look.theme, 'dark');
  look.pieces = known(PIECES, look.pieces, 'cburnett');
  look.hat = known(HATS, look.hat, 'none');

  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function applyColor(k) {
    var v = colors[k];
    if (v) root.style.setProperty('--' + k, v); else root.style.removeProperty('--' + k);
    if (k.indexOf('c-') === 0) {   /* keep the symbol on a grade badge readable on a pale custom colour */
      if (v) root.style.setProperty('--ci-' + k.slice(2), luminance(v) > 0.4 ? '#17212b' : '#ffffff'); else root.style.removeProperty('--ci-' + k.slice(2));
    }
  }
  function applyLook() {
    root.setAttribute('data-theme', look.theme);
    if (look.hat === 'none') root.removeAttribute('data-hat'); else root.setAttribute('data-hat', look.hat);
    var img = look.pieces !== 'glyph';
    root.setAttribute('data-pieces', img ? 'img' : 'glyph');
    ['w', 'b'].forEach(function (c) {
      ['k', 'q', 'r', 'b', 'n', 'p'].forEach(function (t) {
        if (img) root.style.setProperty('--p-' + c + t, 'url("pieces/' + look.pieces + '/' + c + t.toUpperCase() + '.svg")');
        else root.style.removeProperty('--p-' + c + t);
      });
    });
  }
  function themeMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#24231f';
  }
  applyLook();
  for (var k0 in colors) applyColor(k0);

  /* ---------- the settings panel ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function build() {
    var panel = document.getElementById('colors'), toggle = document.getElementById('colors-btn');
    themeMeta();
    if (!panel || !toggle) return;

    function section(title, items, current, draw, pick) {
      var group = el('div', 'cgroup'), row = el('div', 'choices');
      group.appendChild(el('h2', null, title));
      items.forEach(function (it) {
        var b = el('button', 'choice'); b.dataset.id = it[0];
        draw(b, it);
        b.appendChild(el('span', null, it[1]));
        b.addEventListener('click', function () { pick(it); sync(); });
        row.appendChild(b);
      });
      group.appendChild(row); panel.appendChild(group);
      return function () {
        var id = current(), bs = row.children;
        for (var i = 0; i < bs.length; i++) { bs[i].classList.toggle('sel', bs[i].dataset.id === id); bs[i].setAttribute('aria-pressed', String(bs[i].dataset.id === id)); }
      };
    }
    function boardNow() {
      var cs = getComputedStyle(root), a = (colors['sq-light'] || cs.getPropertyValue('--sq-light')).trim().toLowerCase(), b = (colors['sq-dark'] || cs.getPropertyValue('--sq-dark')).trim().toLowerCase();
      for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i][2] === a && BOARDS[i][3] === b) return BOARDS[i][0];
      return '';
    }
    var syncs = [
      section('Theme', THEMES, function () { return look.theme; }, function () {}, function (it) {
        /* A theme sets the page colours, so drop any custom page colours that would hide it. */
        look.theme = it[0];
        PAGE.concat([['graph-white'], ['graph-black']]).forEach(function (f) { if (colors[f[0]]) { delete colors[f[0]]; applyColor(f[0]); } });
      }),
      section('Board', BOARDS, boardNow, function (b, it) { var sw = el('span', 'sw'); sw.style.setProperty('--a', it[2]); sw.style.setProperty('--b', it[3]); b.appendChild(sw); }, function (it) {
        if (it[0] === BOARDS[0][0]) { delete colors['sq-light']; delete colors['sq-dark']; } else { colors['sq-light'] = it[2]; colors['sq-dark'] = it[3]; }
        applyColor('sq-light'); applyColor('sq-dark');
      }),
      section('Pieces', PIECES, function () { return look.pieces; }, function (b, it) {
        if (it[0] === 'glyph') { b.appendChild(el('span', 'emo', '♞')); return; }
        var img = el('img'); img.src = 'pieces/' + it[0] + '/wN.svg'; img.alt = ''; img.width = 30; img.height = 30; b.appendChild(img);
      }, function (it) { look.pieces = it[0]; }),
      section('Hats', HATS, function () { return look.hat; }, function (b, it) { if (it[2]) b.appendChild(el('span', 'emo', it[2])); }, function (it) { look.hat = it[0]; })
    ];

    var custom = el('details'), all = el('button', null, 'Reset all custom colors');
    custom.appendChild(el('summary', null, 'Custom colors'));
    COLOR_GROUPS.forEach(function (g) {
      var group = el('div', 'cgroup'), grid = el('div', 'cgrid');
      group.appendChild(el('h2', null, g[0]));
      g[1].forEach(function (f) {
        var field = el('div', 'cfield'), input = el('input'), label = el('label', null, f[1]), reset = el('button', null, 'Reset');
        input.type = 'color'; input.id = 'col-' + f[0]; input.dataset.k = f[0]; label.htmlFor = input.id;
        reset.setAttribute('aria-label', 'Reset ' + f[1]); reset.dataset.k = f[0];
        field.appendChild(input); field.appendChild(label); field.appendChild(reset); grid.appendChild(field);
      });
      group.appendChild(grid); custom.appendChild(group);
    });
    var foot = el('div', 'input-row');
    all.id = 'colors-reset';
    foot.appendChild(all); foot.appendChild(el('p', 'fine', 'Your choices are saved in this browser.'));
    custom.appendChild(foot); panel.appendChild(custom);

    function sync() {
      applyLook(); save('look', look); save('colors', colors); themeMeta();
      syncs.forEach(function (f) { f(); });
      var cs = getComputedStyle(root), inputs = custom.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        var k = inputs[i].dataset.k;
        inputs[i].value = colors[k] || cs.getPropertyValue('--' + k).trim();
        inputs[i].parentNode.querySelector('button').hidden = !colors[k];
      }
    }
    custom.addEventListener('input', function (e) {
      var k = e.target.dataset.k;
      if (!k) return;
      colors[k] = e.target.value; applyColor(k); save('colors', colors); themeMeta();
      e.target.parentNode.querySelector('button').hidden = false;
      syncs[1]();
    });
    custom.addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      if (e.target === all) { var old = colors; colors = {}; for (var k in old) applyColor(k); }
      else { delete colors[e.target.dataset.k]; applyColor(e.target.dataset.k); }
      sync();
    });
    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      sync();
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
