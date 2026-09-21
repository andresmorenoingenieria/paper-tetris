# Paper Tetris

Un Tetris sencillo con fichas de papel recortado, estilo **Paper Mario**: marcos de batalla con tornillos, stickers brillantes con borde grueso, paneles tipo ticket, fondo de cuaderno.

Hecho para que **simplemente funcione**: sitio 100 % estático (HTML + CSS + JavaScript vanilla, cero build, cero servidor). 

## Cómo jugar

| Tecla | Acción |
| --- | --- |
| `←` `→` / `A` `D` | Mover pieza |
| `↑` / `W` `X` | Rotar |
| `↓` / `S` | Bajar (soft drop) |
| `Espacio` | Soltar (hard drop) |
| `C` | Cambiar pieza (hold) |
| `P` / `Esc` | Pausa |
| `R` | Reiniciar |

En móvil/táctil aparecen botones en la parte inferior (mantén pulsado `◀` `▶` `▼` para repetir movimiento). El récord se guarda en `localStorage`.

## Estructura

```
index.html   — marcado completo (tablero, HUD, paneles, overlay)
style.css    — diseño Paper Mario + responsive sin scroll
game.js      — motor de Tetris + render + controles (vanilla JS)
tests/       — smoke tests con happy-dom (node --test)
```

## Pruebas

```bash
npm install
npm test
```

Smoke tests (con `happy-dom`, sin navegador): bootea la página real, arranca una partida, mueve/rota/suelta/cambia piezas durante miles de frames sin errores, detecta líneas completas (retira filas, suma puntos, sube nivel) y aguanta hasta game over.

## Ejecutar localmente

No requiere build:

```bash
python3 -m http.server 8080   # abre http://localhost:8080
```

o simplemente abre `index.html` con doble clic.

## License

MIT.
