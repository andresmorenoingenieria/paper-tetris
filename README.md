# Paper Tetris

Un Tetris sencillo con fichas de papel recortado, estilo **Paper Mario**: marcos de batalla con tornillos, stickers brillantes con borde grueso, paneles tipo ticket, fondo de cuaderno y sin ningún scroll — todo cabe en la pantalla.

Hecho para que **simplemente funcione**: sitio 100 % estático (HTML + CSS + JavaScript vanilla, cero build, cero servidor). Tócalo, usa el teclado o desplegarlo en Vercel directamente.

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

## Características

- Piezas tipo sticker con borde grueso y sombra de papel; silueta (ghost) punteada como boceto.
- Rotación con *wall kicks*, 7-bag, next ×3, hold, hard/soft drop.
- Líneas que "saltan" del tablero con animación; cartel de nivel y récord.
- **Sin scroll**: `overflow: hidden`, altura `100dvh`; el tablero se adapta automáticamente a cualquier pantalla (JS recalcula el tamaño de celda en `resize`).
- Breakpoints: en pantallas estrechas el HUD pasa abajo del tablero y se ocultan los paneles grandes; en pantallas bajas se esconden el 3.º preview y el récord.
- Accesible: botones con `aria-label`, foco visible, `prefers` de color táctiles `pointer: coarse`.

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

## Deploy en Vercel (2 minutos)

1. `npx vercel --prod` desde esta carpeta y confirma el framework ("Other" / estática).
2. O sube la carpeta a un repo (GitHub/GitLab) y conéctalo en el dashboard de Vercel. Vercel detecta el sitio estático y lo sirve directamente — no hay build, endpoint ni configuración extra.

Archivos que subir: `index.html`, `style.css`, `game.js` (los 3 de la raíz).

## License

MIT — libre de usar, copiar y modificar.