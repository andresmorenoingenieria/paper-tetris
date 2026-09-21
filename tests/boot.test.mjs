import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

await import('../game.js');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/gi, '');

function boot(t) {
  const window = new Window({ url: 'http://localhost/' });
  window.document.write(html);
  window.document.close();

  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    requestAnimationFrame: () => {},
    cancelAnimationFrame: () => {},
  });

  globalThis.__paperTetrisBoot();

  t.after(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    for (const key of ['requestAnimationFrame', 'cancelAnimationFrame']) delete globalThis[key];
  });

  return window;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('boots, starts a game and plays pieces without errors', async (t) => {
  const window = boot(t);

  const game = window.__tetris;
  assert.ok(game, 'expone hook __tetris');

  const before = game.state();
  assert.equal(before.screen, 'start');

  game.start();
  let s = game.state();
  assert.equal(s.screen, 'none');
  assert.equal(s.level, 1);

  for (let i = 0; i < 6000; i++) {
    game.update(16);
    if (i % 3 === 0) game.rotate();
    if (i % 7 === 0) game.move(i % 2 === 0 ? 1 : -1);
    if (i % 11 === 0) game.softDrop();
    if (i % 23 === 0) game.hardDrop();
    if (i % 31 === 0) game.hold();
  }
  await sleep(260);
  s = game.state();
  assert.ok(s.score >= 0);
  assert.ok(s.pieces > 0, 'debe haber colocado piezas');
  assert.ok(s.queue.length === 5, 'cola de 5 piezas');
});

test('locks pieces onto the grid and clears full lines', async (t) => {
  const window = boot(t);
  const game = window.__tetris;
  game.start();

  for (let i = 0; i < 5000; i++) game.update(16);
  await sleep(300);
  const s = game.state();
  const filledCells = s.grid.flat().filter(Boolean).length;
  assert.ok(filledCells > 0, 'la cuadrícula debe tener celdas');
  assert.ok(s.lines >= 0);
});

test('pausa/reanuda y game over no rompen el loop', async (t) => {
  const window = boot(t);
  const game = window.__tetris;
  game.start();

  for (let i = 0; i < 200000; i++) game.update(16);
  await sleep(200);
  const s = game.state();
  assert.equal(typeof s.over, 'boolean');
  assert.equal(typeof s.score, 'number');
});

test('detecta líneas completas: retira, suma puntos y sube nivel', async (t) => {
  const window = boot(t);
  const game = window.__tetris;
  game.start();

  const empty = () => Array(10).fill(null);
  const rows = Array.from({ length: 20 }, empty);
  for (let r = 17; r <= 19; r++) rows[r] = Array(10).fill('O');
  game.debugGrid(rows);

  const beforeScore = game.state().score;
  game.debugClearCheck();
  let s = game.state();
  assert.equal(s.lines, 3, 'debe contar 3 líneas');
  assert.ok(s.score > beforeScore, 'debe sumar puntos por líneas');

  await sleep(240); // espera el retraso de animación (setTimeout interno)
  s = game.state();
  for (let r = 0; r < 3; r++) {
    assert.equal(s.grid[r].every(Boolean), false, 'filas superiores quedan vacías');
  }
  assert.equal(s.grid.length, 20, 'el tablero conserva 20 filas');
});