# Progreso

Seguimiento del [plan de implementación](plan.md). Se actualiza al terminar cada tarea.

Leyenda: ✅ hecho · 🚧 en curso · ⬜ pendiente

## Resumen

| Etapa                                   | Estado |
| --------------------------------------- | ------ |
| 0 — Base del proyecto                   | ✅     |
| 1 — Kart que se maneja bien             | ⬜     |
| 2 — Derrape, nitros y saltos            | ⬜     |
| 3 — Primera pista real: Valle de Cocora | ⬜     |
| 4 — Bots                                | ⬜     |
| 5 — Poderes y uchuvas                   | ⬜     |
| 6 — Personajes y animaciones            | ⬜     |
| 7 — Online: sala con código             | ⬜     |
| 8 — Online robusto                      | ⬜     |
| 9 — Contenido completo                  | ⬜     |
| 10 — Pulido                             | ⬜     |
| 11 — Lanzamiento                        | ⬜     |

## Etapa 0 — Base del proyecto ✅

- ✅ Proyecto Vite + TypeScript estricto + Three.js.
- ✅ ESLint (reglas estrictas de `typescript-eslint`), Prettier y Vitest.
- ✅ Estructura de carpetas de `diseno.md` §10.3.
- ✅ GitHub Actions: lint, formato, pruebas y build en cada push y PR; publicación en Pages en cada push a `main`.
- ✅ Escena 3D mínima: cubo con material _toon_ girando.
- ✅ Contador de FPS, visible solo en desarrollo, con pruebas.
- ✅ Repositorio `fsoftt/ChiguiroKart` creado y GitHub Pages activado.

**Notas:**

- Three.js pesa ~530 kB minificado (~130 kB gzip). Se subió el límite de aviso de Vite a 700 kB.
- GitHub Pages en plan gratuito requiere repositorio público.

## Etapa 1 — Kart que se maneja bien ⬜

- ⬜ Bucle de juego con simulación a paso fijo (60 Hz) e interpolación en el render.
- ⬜ Física arcade: aceleración, frenado, reversa, giro, agarre lateral, gravedad.
- ⬜ Colisión contra suelo y paredes de una pista de prueba.
- ⬜ Cámara de persecución con suavizado y FOV según velocidad.
- ⬜ Capa de entrada abstracta (`KartInput`) con teclado y mando.
- ⬜ Valores de física en `config/` con panel de depuración (lil-gui).
- ⬜ Pruebas de la física básica.
