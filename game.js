'use strict';
(function () {
  var ROWS = 20;
  var COLS = 10;
  var LOCK_MS = 420;

  var PALETTE = {
    I: { fill: '#79c8f2' },
    J: { fill: '#5f8dff' },
    L: { fill: '#ffa94d' },
    O: { fill: '#ffd43b' },
    S: { fill: '#6fe3a0' },
    T: { fill: '#c58ae8' },
    Z: { fill: '#ff7b6b' }
  };

  var SHAPES = {
    I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { m: [[1, 1], [1, 1]] },
    T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] }
  };
  var KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
  var LINE_SCORES = [0, 100, 300, 500, 800];
  var KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  var S = {
    running: false,
    paused: false,
    over: false,
    grid: null,
    bag: [],
    queue: [],
    piece: null,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    pieces: 0,
    dropAcc: 0,
    lockAcc: 0,
    grounded: false,
    pendingRows: [],
    screen: 'start'
  };

  var cells = [];
  var els = {};
  var record = 0;

  function emptyGrid() {
    return Array.from({ length: ROWS }, function () { return Array(COLS).fill(null); });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nextFromBag() {
    if (S.bag.length === 0) S.bag = shuffle(KEYS);
    return S.bag.pop();
  }

  function queueFill() {
    while (S.queue.length < 5) S.queue.push(nextFromBag());
  }

  function rotCW(m) {
    return m[0].map(function (_, c) { return m.map(function (r) { return r[c]; }).reverse(); });
  }
  function rotCCW(m) { return rotCW(rotCW(rotCW(m))); }

  function topFill(m) {
    for (var r = 0; r < m.length; r++) if (m[r].some(Boolean)) return r;
    return 0;
  }

  function collides(m, x, y) {
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gx = x + c;
        var gy = y + r;
        if (gy >= 0 && gy < ROWS && (gx < 0 || gx >= COLS)) return true;
        if (gy >= 0 && gy < ROWS && S.grid[gy][gx]) return true;
        if (gy >= ROWS) return true;
      }
    }
    return false;
  }

  function ghostY() {
    var m = S.piece.m, x = S.piece.x, y = S.piece.y;
    while (!collides(m, x, y + 1)) y++;
    return y;
  }

  function move(dx, dy, manual) {
    var p = S.piece;
    if (!p || collides(p.m, p.x + dx, p.y + dy)) return false;
    p.x += dx;
    p.y += dy;
    if (dy > 0 || manual) S.lockAcc = 0;
    S.grounded = false;
    return true;
  }

  function rotate(dir) {
    var p = S.piece;
    if (!p) return;
    if (p.t === 'O') { S.lockAcc = 0; return; }
    var m2 = dir > 0 ? rotCW(p.m) : rotCCW(p.m);
    for (var i = 0; i < KICKS.length; i++) {
      if (!collides(m2, p.x + KICKS[i][0], p.y + KICKS[i][1])) {
        p.m = m2;
        p.x += KICKS[i][0];
        p.y += KICKS[i][1];
        S.lockAcc = 0;
        return;
      }
    }
  }

  function spawnPiece() {
    queueFill();
    var t = S.queue.shift();
    queueFill();
    S.piece = { t: t, m: SHAPES[t].m.map(function (r) { return r.slice(); }), x: 3, y: -topFill(SHAPES[t].m) };
    if (collides(S.piece.m, S.piece.x, S.piece.y)) {
      gameOver();
      return false;
    }
    return true;
  }

  function lockPiece() {
    var p = S.piece;
    if (!p) return;
    var placed = [];
    for (var r = 0; r < p.m.length; r++) {
      for (var c = 0; c < p.m[r].length; c++) {
        if (!p.m[r][c]) continue;
        var gy = p.y + r;
        if (gy < 0) continue;
        if (gy >= ROWS) continue;
        if (S.grid[gy][p.x + c]) continue;
        S.grid[gy][p.x + c] = p.t;
        placed.push([gy, p.x + c]);
      }
    }
    S.pieces++;
    S.canHold = true;
    S.piece = null;
    S.dropAcc = 0;
    S.lockAcc = 0;
    S.grounded = false;

    bump(placed);
    clearFullRows();
    if (!spawnPiece()) return;
    updateHUD();
  }

  function bump(coords) {
    coords.forEach(function (rc) {
      var el = cells[rc[0]][rc[1]];
      el.classList.add('bump');
      setTimeout(function () { el.classList.remove('bump'); }, 150);
    });
  }

  function clearFullRows() {
    var full = [];
    for (var r = 0; r < ROWS; r++) {
      if (S.grid[r].every(Boolean)) full.push(r);
    }
    if (!full.length) return;
    var k = full.length;
    var gained = LINE_SCORES[Math.min(k, 4)] * S.level;
    S.lines += k;
    S.score += gained;
    var newLevel = Math.floor(S.lines / 10) + 1;
    if (newLevel !== S.level) {
      S.level = newLevel;
      showBill('Nivel ' + S.level);
    }
    S.pendingRows = full.slice();
    updateHUD();

    var removed = {};
    full.forEach(function (r) { removed[r] = true; });
    setTimeout(function () {
      S.grid = S.grid.filter(function (_, i) { return !removed[i]; });
      while (S.grid.length < ROWS) S.grid.unshift(Array(COLS).fill(null));
      S.pendingRows = [];
      render();
    }, 140);
  }

  function hardDrop() {
    if (!S.running || S.paused || S.over || !S.piece) return;
    var gy = ghostY();
    var dist = Math.max(0, gy - S.piece.y);
    S.piece.y = gy;
    S.score += dist * 2;
    updateHUD();
    lockPiece();
  }

  function softDrop() {
    if (!S.running || S.paused || S.over || !S.piece) return;
    if (move(0, 1, true)) {
      S.score += 1;
      updateHUD();
    }
  }

  function hold() {
    if (!S.running || S.paused || S.over || !S.piece || !S.canHold) return;
    var cur = S.piece.t;
    var prev = S.hold;
    S.hold = cur;
    S.canHold = false;
    S.piece = prev
      ? { t: prev, m: SHAPES[prev].m.map(function (r) { return r.slice(); }), x: 3, y: -topFill(SHAPES[prev].m) }
      : (function () {
          var t = S.queue.shift();
          queueFill();
          return { t: t, m: SHAPES[t].m.map(function (r) { return r.slice(); }), x: 3, y: -topFill(SHAPES[t].m) };
        })();
    if (collides(S.piece.m, S.piece.x, S.piece.y)) { gameOver(); return; }
    updateHUD();
  }

  function gravityFor(level) { return Math.max(55, Math.floor(1000 * Math.pow(0.82, level - 1))); }

  function update(dt) {
    if (!S.running || S.paused || S.over) return;
    if (!S.piece) return;
    var grav = gravityFor(S.level);
    S.dropAcc += dt;
    var dropped = false;
    while (S.dropAcc >= grav) {
      S.dropAcc -= grav;
      if (move(0, 1, false)) { dropped = true; }
      else { S.grounded = true; break; }
    }
    if (S.grounded) {
      S.lockAcc += dt;
      if (S.lockAcc >= LOCK_MS) lockPiece();
    }
    void dropped;
  }

  /* ---------------- render ---------------- */

  function buildCells() {
    var board = els.board;
    board.innerHTML = '';
    cells = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) {
        var el = document.createElement('div');
        el.className = 'cell';
        el.setAttribute('data-r', r);
        el.setAttribute('data-c', c);
        board.appendChild(el);
        row.push(el);
      }
      cells.push(row);
    }
  }

  function render() {
    var p = S.piece;
    var gh = 0;
    var live = {};
    var ghost = {};
    if (p) {
      gh = ghostY();
      for (var r = 0; r < p.m.length; r++) {
        for (var c = 0; c < p.m[r].length; c++) {
          if (!p.m[r][c]) continue;
          var lr = p.y + r;
          var lc = p.x + c;
          if (lr >= 0 && lr < ROWS && lc >= 0 && lc < COLS) live[lr + ',' + lc] = p.t;
          var gr = gh + r;
          if (gr >= 0 && gr < ROWS && lc >= 0 && lc < COLS) ghost[gr + ',' + lc] = true;
        }
      }
    }
    var clearing = {};
    S.pendingRows.forEach(function (r) { clearing[r] = true; });

    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc < COLS; cc++) {
        var k = rr + ',' + cc;
        var cell = cells[rr][cc];
        var t = S.grid[rr][cc] || (live[k] || '');
        var isLive = !!live[k];
        var isGhost = !!ghost[k] && !isLive;
        var isClear = !!clearing[rr];
        var key = t + (isLive ? 'L' : '') + (isGhost ? 'G' : '') + (isClear ? 'C' : '');
        if (cell._k === key) continue;
        cell._k = key;
        cell.classList.toggle('live', isLive);
        cell.classList.toggle('ghost', isGhost);
        cell.classList.toggle('clearing', isClear);
        if (cell.dataset.t !== t) {
          cell.dataset.t = t;
          cell.style.setProperty('--fill', t ? PALETTE[t].fill : '');
        }
      }
    }
  }

  function paintMini(el, t) {
    el.innerHTML = '';
    if (!t) return;
    var m = SHAPES[t].m;
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        var div = document.createElement('div');
        div.className = 'tile';
        div.style.setProperty('--fill', PALETTE[t].fill);
        div.style.setProperty('--rt', (Math.random() * 6 - 3) + 'deg');
        div.style.opacity = m[r][c] ? 1 : 0;
        el.appendChild(div);
      }
    }
  }

  var lastQueueSig = '';
  var lastHoldSig = '';
  var lastHud = '';
  function updateHUD() {
    var qs = (S.queue[0] || '') + (S.queue[1] || '') + (S.queue[2] || '');
    var hs = (S.hold || '') + (S.canHold ? '1' : '0');
    var key = S.score + '|' + S.level + '|' + S.lines + '|' + record + '|' + qs + '|' + hs;
    if (key === lastHud) return;
    lastHud = key;
    els.score.textContent = S.score;
    els.level.textContent = S.level;
    els.lines.textContent = S.lines;
    els.record.textContent = record;
    if (qs !== lastQueueSig) {
      lastQueueSig = qs;
      for (var i = 0; i < 3; i++) paintMini(els['next' + i], S.queue[i]);
    }
    if (hs !== lastHoldSig) {
      lastHoldSig = hs;
      paintMini(els.hold, S.hold);
      els.hold.classList.toggle('dim', !!S.canHold);
    }
  }

  function showBill(text) {
    var b = els.bill;
    b.textContent = text;
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    setTimeout(function () { b.hidden = true; }, 1400);
  }

  /* ---------------- juego / pantallas ---------------- */

  function startGame() {
    S.grid = emptyGrid();
    S.bag = [];
    S.queue = [];
    S.piece = null;
    S.hold = null;
    S.canHold = true;
    S.score = 0;
    S.lines = 0;
    S.level = 1;
    S.pieces = 0;
    S.dropAcc = 0;
    S.lockAcc = 0;
    S.grounded = false;
    S.pendingRows = [];
    queueFill();
    if (!spawnPiece()) return;
    S.running = true;
    S.over = false;
    S.paused = false;
    S.screen = 'none';
    hideOverlay();
    document.getElementById('btnPause').hidden = false;
    document.getElementById('btnRestart').hidden = false;
    updateHUD();
    render();
  }

  function pauseToggle() {
    if (!S.running) return;
    if (S.screen === 'pause') {
      S.paused = false;
      S.screen = 'none';
      hideOverlay();
    } else if (S.screen === 'none') {
      S.paused = true;
      S.screen = 'pause';
      showScreen('pause');
    }
  }

  function gameOver() {
    S.over = true;
    S.running = false;
    if (S.score > record) {
      record = S.score;
      try { localStorage.setItem('paper-tetris-record', String(record)); } catch (e) {}
    }
    showScreen('over');
  }

  function showScreen(kind) {
    S.screen = kind;
    var overlay = els.overlay;
    var title = els.cardTitle;
    var text = els.cardText;
    var btn = els.btnStart;
    var hint = els.cardHint;
    hint.textContent = '';
    if (kind === 'pause') {
      title.textContent = 'Pausa';
      text.textContent = 'Sigue cuando quieras.';
      btn.textContent = 'Continuar';
    } else if (kind === 'over') {
      title.textContent = 'Fin del juego';
      text.textContent = 'Score: ' + S.score + ' · Líneas: ' + S.lines;
      btn.textContent = 'Jugar de nuevo';
      hint.textContent = 'Récord: ' + record;
    } else {
      title.textContent = 'Paper Tetris';
      text.textContent = 'Recorta fichas, apila líneas y llénalas antes de que el papel se llene.';
      btn.textContent = 'Empezar';
    }
    overlay.hidden = false;
    btn.focus({ preventScroll: true });
  }

  function hideOverlay() {
    els.overlay.hidden = true;
    updateHUD();
  }

  /* ---------------- controles ---------------- */

  function keyPress(list) {
    function keyed(e) {
      var code = e.code || '';
      var k = list[code];
      if (k) {
        e.preventDefault();
        k();
      }
    }
    document.addEventListener('keydown', keyed);
    return keyed;
  }

  function bindKeys() {
    var map = {
      ArrowLeft: function () { move(-1, 0, true); render(); },
      ArrowRight: function () { move(1, 0, true); render(); },
      ArrowUp: function () { rotate(1); render(); },
      KeyW: function () { rotate(1); render(); },
      KeyX: function () { rotate(1); render(); },
      ArrowDown: function () { softDrop(); render(); },
      KeyS: function () { softDrop(); render(); },
      Space: function () {
        if (S.screen === 'start' || S.screen === 'over') startGame();
        else if (S.screen === 'pause') pauseToggle();
        else hardDrop();
        render();
      },
      KeyC: function () { hold(); render(); },
      KeyP: function () { pauseToggle(); render(); },
      Escape: function () { pauseToggle(); render(); },
      KeyR: function () { startGame(); },
      Enter: function () {
        if (S.screen === 'start' || S.screen === 'over') startGame();
        else if (S.screen === 'pause') pauseToggle();
        render();
      }
    };
    keyPress(map);
  }

  function bindTouch() {
    var acts = {
      left: function () { move(-1, 0, true); },
      right: function () { move(1, 0, true); },
      rotate: function () { rotate(1); },
      soft: function () { softDrop(); },
      hard: function () { hardDrop(); },
      hold: function () { hold(); }
    };
    function fire(act) {
      if (!acts[act]) return;
      acts[act]();
      render();
    }
    var rep = { left: 90, right: 90, soft: 70 };
    [].slice.call(document.querySelectorAll('.tbtn')).forEach(function (btn) {
      var act = btn.getAttribute('data-act');
      var timer = null;
      var start = null;
      function begin(e) {
        e.preventDefault();
        fire(act);
        if (rep[act] != null) {
          start = setInterval(function () { fire(act); }, rep[act]);
        }
      }
      function end() {
        if (start) clearInterval(start);
        start = null;
      }
      btn.addEventListener('pointerdown', begin);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('pointercancel', end);
    });
  }

  function layout() {
    var header = document.querySelector('.top');
    var touch = document.getElementById('touch');
    var hh = header ? header.offsetHeight : 0;
    var th = touch && !touch.hidden ? touch.offsetHeight : 0;
    var pad = 16;
    var availH = window.innerHeight - hh - th - pad;
    var side = window.innerWidth >= 861 && window.innerHeight >= 520;
    var hud = document.querySelector('.hud');
    var hudW = 0;
    if (side && hud) hudW = Math.min(320, hud.offsetWidth);
    var availW = window.innerWidth - (side ? hudW + 42 : 18);
    var cell = Math.max(6, Math.min(Math.floor(availW / COLS), Math.floor((availH - 14) / ROWS)));
    document.documentElement.style.setProperty('--cell', cell + 'px');
    document.documentElement.style.setProperty('--cmin', Math.max(4, Math.min(22, Math.round(cell * 0.48))) + 'px');
  }

  function boot() {
    els.board = document.getElementById('board');
    if (!els.board) return;
    els.score = document.getElementById('score');
    els.level = document.getElementById('level');
    els.lines = document.getElementById('lines');
    els.record = document.getElementById('record');
    els.hold = document.getElementById('hold');
    els.next0 = document.getElementById('next0');
    els.next1 = document.getElementById('next1');
    els.next2 = document.getElementById('next2');
    els.overlay = document.getElementById('overlay');
    els.cardTitle = document.getElementById('cardTitle');
    els.cardText = document.getElementById('cardText');
    els.btnStart = document.getElementById('btnStart');
    els.cardHint = document.getElementById('cardHint');
    els.bill = document.getElementById('bill');

    try { record = Number(localStorage.getItem('paper-tetris-record')) || 0; } catch (e) {}

    var touch = document.getElementById('touch');
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || 'ontouchstart' in window) touch.hidden = false;

    S.grid = emptyGrid();
    buildCells();
    paintMini(els.hold, null);
    paintMini(els.next0, null);
    paintMini(els.next1, null);
    paintMini(els.next2, null);

    bindKeys();
    bindTouch();

    els.btnStart.addEventListener('click', function () {
      if (S.screen === 'pause') pauseToggle();
      else startGame();
    });
    document.getElementById('btnPause').addEventListener('click', pauseToggle);
    document.getElementById('btnRestart').addEventListener('click', startGame);

    updateHUD();
    render();
    layout();

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(50, now - last);
      last = now;
      update(dt);
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    (document.defaultView || window).__tetris = {
      start: startGame,
      resume: pauseToggle,
      update: update,
      move: function (d) { move(d, 0, true); },
      rotate: function () { rotate(1); },
      softDrop: function () { softDrop(); },
      hardDrop: function () { hardDrop(); },
      hold: function () { hold(); },
      paint: render,
      debugGrid: function (rows) {
        S.grid = rows.map(function (r) { return r.slice(); });
        S.pendingRows = [];
      },
      debugClearCheck: clearFullRows,
      state: function () {
        return {
          score: S.score,
          lines: S.lines,
          level: S.level,
          pieces: S.pieces,
          over: S.over,
          screen: S.screen,
          grid: S.grid.map(function (r) { return r.slice(); }),
          queue: S.queue.slice(),
          hold: S.hold
        };
      }
    };
  }

  if (typeof globalThis !== 'undefined') globalThis.__paperTetrisBoot = boot;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else if (!document.defaultView || !document.defaultView.__tetris) {
      boot();
    }
  }
})();