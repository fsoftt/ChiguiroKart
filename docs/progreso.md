# Progreso

Seguimiento del [plan de implementación](plan.md). Se actualiza al terminar cada tarea.

Leyenda: ✅ hecho · 🚧 en curso · ⬜ pendiente

## Resumen

| Etapa                                   | Estado |
| --------------------------------------- | ------ |
| 0 — Base del proyecto                   | ✅     |
| 1 — Kart que se maneja bien             | ✅     |
| 2 — Derrape, nitros y saltos            | ✅     |
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

## Etapa 1 — Kart que se maneja bien ✅

- ✅ Bucle de juego con simulación a paso fijo (60 Hz) e interpolación en el render (`sim/fixedStep.ts`, `game/game.ts`).
- ✅ Física arcade: aceleración, frenado, reversa, giro dependiente de la velocidad, agarre lateral y gravedad (`sim/kart/kartPhysics.ts`).
- ✅ Pista de prueba con curvas variadas, piso, paredes, pianos rojo y blanco, línea de salida y árboles (`config/tracks/testTrack.ts`, `render/trackView.ts`).
- ✅ Colisión con paredes: rebote, fricción proporcional al impacto y alineación con la pared al rozarla (`sim/kart/trackCollision.ts`).
- ✅ Cámara de persecución con suavizado, FOV según velocidad y vista hacia atrás (`render/chaseCamera.ts`).
- ✅ Capa de entrada abstracta `KartInput` con teclado y mando estándar (`input/`).
- ✅ Kart provisional con ruedas que giran, dirección y balanceo del chasis (`render/kartView.ts`).
- ✅ Valores de física y cámara en `config/`, con panel lil-gui en desarrollo o con `?debug`. lil-gui se carga aparte y no pesa en el bundle principal.
- ✅ Pruebas: física, colisiones, pista, entrada, paso fijo, matemáticas e interpolación (55 pruebas).
- ✅ Licencia MIT y README con controles y arquitectura.

**Notas:**

- La primera versión de la colisión dejaba el kart pegado a la pared: la fricción se aplicaba en cada paso y el agarre lateral anulaba la velocidad paralela a la pared. Se corrigió con fricción por impacto y alineación con la pared, como en CTR.
- El suelo es plano. Las pendientes y rampas llegan con la etapa 2 (saltos) y la etapa 3 (pista real).
- `R` reinicia el kart en la salida. Es temporal, hasta tener reaparición en la etapa 3.

## Etapa 2 — Derrape, nitros y saltos ✅

- ✅ Salto con `Espacio` (o bumper derecho) y entrada al derrape al aterrizar mientras se gira.
- ✅ Máquina de estados del kart en `drift` y `boost` de `KartState`: conduciendo, en el aire (`airTime`), derrapando y con nitro.
- ✅ Barra de carga del derrape con zona roja y colores del humo (`ui/hud.ts`, `ui/hudModel.ts`).
- ✅ Cadena de hasta 3 nitros por derrape (+15 %, +25 %, +35 %) en `sim/kart/drift.ts`.
- ✅ Ruptura de la cadena por mal tiempo, con humo negro y sacudida de cámara.
- ✅ Nitro perfecto y reserva de turbo hasta 3 s (`sim/kart/boost.ts`).
- ✅ Turbo de aterrizaje en saltos largos. El turbo de salida queda pendiente de la etapa 3, con la cuenta regresiva.
- ✅ Efectos: humo de color por carga, llamas por nivel, líneas de velocidad y empuje de FOV (`render/effects/`).
- ✅ HUD: velocidad, barra de derrape, pips de la cadena y nivel de nitro.
- ✅ Pruebas de la cadena de nitros y de sus tiempos (61 pruebas nuevas en esta etapa).

**Notas:**

- El contrato compartido `drift`/`boost` de `KartState` fue lo primero que se definió, para poder construir simulación, HUD y efectos en paralelo contra el mismo formato. La simulación escribe esos campos; el HUD y los efectos solo los leen.
- El derrape reduce el agarre lateral (`driftLateralGrip`) y fija un giro base hacia el lado del derrape; el volante lo estrecha o lo ensancha, pero nunca lo invierte. Así se evita que el kart girara en sentido contrario al derrape.
- Un nitro activo sube la velocidad máxima y acelera con `boostAcceleration`, por lo que el kart supera su tope base mientras quema turbo.
- El nitro de salida no está: requiere la cuenta regresiva de salida, que llega con la etapa 3.
- Las partículas usan una reserva fija reciclada, sin asignaciones por frame. Dos nubes de puntos: humo con mezcla normal y llamas con mezcla aditiva.
- `Espacio`/`Shift` en teclado; bumper derecho (salto) e izquierdo (nitro) en mando.

## Etapa 3 — Primera pista real: Valle de Cocora ⬜
