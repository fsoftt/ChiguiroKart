# Chigüiro Kart

Juego de karts en 3D estilo _Crash Team Racing_ con animales colombianos. Corre en el navegador y se publica en GitHub Pages.

**Jugar:** https://fsoftt.github.io/ChiguiroKart/

> En desarrollo. Hoy se puede manejar un kart provisional en una pista de prueba. Mira el [progreso](docs/progreso.md).

## Estado actual

| Etapa                        | Estado     |
| ---------------------------- | ---------- |
| 0 — Base del proyecto        | ✅         |
| 1 — Kart que se maneja bien  | ✅         |
| 2 — Derrape, nitros y saltos | Siguiente  |
| 3 a 11                       | Pendientes |

## Controles

| Acción           | Teclado           | Mando                 |
| ---------------- | ----------------- | --------------------- |
| Acelerar         | `W` / `↑`         | A o gatillo derecho   |
| Frenar / reversa | `S` / `↓`         | B o gatillo izquierdo |
| Girar            | `A` `D` / `←` `→` | Stick izquierdo       |
| Mirar atrás      | `Q`               | Y                     |
| Reiniciar kart   | `R`               | —                     |

Saltar, derrapar, nitro y poderes llegan en las próximas etapas.

## Panel de depuración

En desarrollo, o agregando `?debug` a la URL (por ejemplo `https://fsoftt.github.io/ChiguiroKart/?debug`), aparece un panel para ajustar en vivo la física del kart y la cámara, con contador de FPS.

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev      # servidor local con recarga
npm run check    # lint, formato, pruebas y build
```

| Script            | Qué hace                          |
| ----------------- | --------------------------------- |
| `npm run dev`     | Servidor de desarrollo de Vite    |
| `npm run build`   | Revisa tipos y compila a `dist/`  |
| `npm run preview` | Sirve el build de `dist/`         |
| `npm run test`    | Pruebas con Vitest                |
| `npm run lint`    | ESLint                            |
| `npm run format`  | Formatea con Prettier             |
| `npm run check`   | Todo lo anterior, igual que en CI |

Cada push a `main` corre las verificaciones y publica el sitio en GitHub Pages.

## Arquitectura

- `src/sim/` — simulación pura a 60 Hz (física, pista, colisiones). No depende de Three.js ni del DOM, así que se prueba sin navegador y la podrán usar el host online y los bots.
- `src/render/` — escena Three.js: pista, kart, cámara. Interpola entre pasos de simulación.
- `src/input/` — teclado y mando producen el mismo `KartInput`.
- `src/config/` — todos los valores ajustables (física, cámara, controles, pistas).
- `src/game/` — une entrada, simulación y render en el bucle de juego.
- `src/ui/` — interfaz y herramientas de depuración.

Más detalle en el [documento de diseño](docs/diseno.md).

## Documentación

- [Diseño del juego](docs/diseno.md)
- [Plan de implementación](docs/plan.md)
- [Progreso](docs/progreso.md)

## Licencia

[MIT](LICENSE)
