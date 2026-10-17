# Progreso

Seguimiento del [plan de implementación](plan.md). Se actualiza al terminar cada tarea.

Leyenda: ✅ hecho · 🚧 en curso · ⬜ pendiente

## Resumen

| Etapa                                   | Estado |
| --------------------------------------- | ------ |
| 0 — Base del proyecto                   | ✅     |
| 1 — Kart que se maneja bien             | ✅     |
| 2 — Derrape, nitros y saltos            | ✅     |
| 3 — Primera pista real: Valle de Cocora | ✅     |
| 4 — Bots                                | 🚧     |
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

## Etapa 3 — Primera pista real: Valle de Cocora ✅

- ✅ Formato de pista por datos con elevaciones 3D, compuertas de checkpoints, superficies y puntos de reaparición (`sim/track.ts`, `sim/race/checkpoint.ts`, `sim/race/surface.ts`).
- ✅ Circuito completo de Valle de Cocora con curvas de montaña, subida a cordillera, puente de madera colgante, atajo de barro en horquilla y rampa de salto entre palmas de cera (`config/tracks/cocoraTrack.ts`).
- ✅ Superficies físicas con agarre, velocidad máxima y aceleración (`asphalt`, `wood`, `mud`, `grass`).
- ✅ Conteo de vueltas por checkpoints obligatorios, validación de atajos legítimos y bloqueo de cortes indebidos (`sim/race/raceManager.ts`).
- ✅ Cuenta regresiva ("3, 2, 1, ¡YA!"), con turbo de salida por aceleración a tiempo y ahogo de motor (1s) por acelerar antes de tiempo.
- ✅ Detección de caída al vacío con reaparición automática en el último checkpoint válido.
- ✅ Minimapa 2D en tiempo real con trazado de la pista, meta y flecha de orientación del kart (`ui/minimap.ts`).
- ✅ HUD completo de carrera: contador de vueltas, cronómetro de vuelta actual, mejor vuelta, aviso de vía contraria y modal de resultados finales (`ui/hud.ts`, `ui/hudModel.ts`).
- ✅ Persistencia de récords en el navegador (`localStorage`) con detección de mejores tiempos (`sim/race/records.ts`).
- ✅ Render 3D con elevaciones en la pista, cinta coloreada según la superficie (madera/barro/asfalto) y palmas de cera gigantes instanciadas (`render/trackView.ts`).
- ✅ Pruebas completas de checkpoints, reglas de carrera, circuito y récords (19 pruebas nuevas en esta etapa, 135 en total).

**Notas:**

- Los atajos en Cocora (salto de cresta y trocha de barro) están rodeados de checkpoints obligatorios antes y después, lo que garantiza que tomar el atajo sea una maniobra válida sin que se pueda cortar camino arbitrariamente por el pasto.
- El minimapa renderiza el circuito en un canvas fuera de pantalla y solo actualiza el marcador del jugador en cada fotograma.
- Corrección en la etapa 4: el atajo de barro no existía de verdad (quedaba detrás de los muros y se saltaba un checkpoint obligatorio). Ahora las pistas admiten ramas (`TrackBranch`: polilínea abierta con su ancho, superficie y muros), y `Track.project` usa la unión de corredores. La "Trocha de barro" de Cocora mide 113 m frente a 155 m de la horquilla, el checkpoint del vértice de la horquilla pasó a opcional y el barro castiga menos (velocidad ×0,8) para que el atajo valga la pena.

## Etapa 4 — Bots 🚧

- ✅ Infraestructura: `BotInputProvider` recibe un contexto (`world`, `self`, `racers`) para ver a los demás karts, y `BotManager` mueve los bots con la misma física que el jugador (`input/botInput.ts`, `sim/botManager.ts`). `SimpleBot` se eliminó.
- ✅ Estado de carrera por kart: cada kart es un `Racer` con su propio `RaceManager` (vueltas, checkpoints, reaparición, ahogo de motor). Jugador y bots pasan por el mismo `stepRacer`, y cada bot apunta con sus propios checkpoints (`sim/racer.ts`).
- ✅ Vista 3D de los bots y choques entre karts: cada bot se dibuja con su propio `KartView` (color de carrocería distinto) y se interpola entre pasos fijos igual que el jugador (`game/game.ts`, `render/kartView.ts`). `resolveKartCollisions` trata los karts como círculos en XZ (`kartRadius`), los separa por igual y aplica un impulso de masas iguales con `kartRestitution` si se acercan; ignora pares con más de `kartHeight` de separación vertical. Se llama una vez por paso, tras mover al jugador y a todos los bots (`sim/kart/kartCollision.ts`, `BotManager.resolveCollisions`).
- ✅ Parrilla de salida: `gridPose(track, slot)` (dos karts por fila, escalonados a ambos lados de la línea central y cada fila más atrás sobre la dirección de salida; valores en `config/grid.ts`). El jugador usa la casilla 0, los bots 1, 2, ... en orden de `addBot`, y `resetRacer` devuelve cada kart a su casilla (`sim/racer.ts`).
- ✅ La partida lleva 7 bots, todos `RacingBot`. La dificultad se elige con `?dificultad=facil|normal|dificil` (por defecto `normal`) y `?remontada=0` apaga la ayuda de remontada (`readRaceSettings()` en `game/game.ts`).
- ✅ `RacingBot` (`ai/racingBot.ts`), determinista (RNG `mulberry32` con semilla por casilla, sin `Math.random`):
  - Sigue la línea de la pista con un índice de progreso local (`ai/route.ts`: ventana hacia adelante, así nunca salta al otro lado de la horquilla) y apunta a un punto por delante que crece con la velocidad (_pure pursuit_), con una desviación lateral pequeña y suavizada.
  - Calcula el giro que viene y baja la velocidad objetivo según `cornerSpeedFactor`; nunca frena hasta casi parar en curvas normales.
  - Derrape y nitros (`ai/driftControl.ts`): salta al entrar a una curva marcada, mantiene el derrape, pulsa nitro en la zona roja con el error de tiempo de su dificultad (fácil falla a veces y rompe la cadena, difícil casi siempre perfecto) y suelta al terminar la curva o si el derrape lo llevaría a una pared.
  - Atajos: al acercarse a una rama tira una vez la probabilidad de su dificultad; si la toma, sigue los puntos de la rama y retoma la pista en su fin.
  - Evita paredes (se centra cerca del borde) y karts (un kart a menos de 12 m delante, en un cono, desplaza la línea al lado libre).
  - Salida: sin acelerador en la cuenta regresiva, salvo el turbo de salida en los últimos 0,3 s según su dificultad. Recuperación: si queda casi parado más de 1,5 s, retrocede un segundo con el giro invertido.
- ✅ Dificultades y ayuda de remontada configurables en `config/bots.ts` (`botDifficulties`, `botBehavior`, `defaultRubberBand`). `Racer.speedScale` escala velocidad máxima y aceleración (el jugador usa 1); `BotManager` lo fija como factor de la dificultad por el factor de remontada, calculado con la brecha en metros respecto al jugador y suavizado (`ai/rubberBand.ts`).
- ✅ Posiciones en tiempo real y HUD de posición: `raceProgress` (vueltas completadas · N + último checkpoint + fracción del tramo al siguiente, medida sobre la dirección de cada compuerta para que el desvío lateral no altere el orden; sin límite inferior) y `computeStandings` (los que terminaron primero por tiempo total, el resto por progreso, desempate por casilla) en `sim/race/standings.ts`; `BotManager.getBotRacers()`; insignia grande "1.º /4" bajo la vuelta y línea "Posición: 2.º de 4" en el modal de resultados (`ui/hudModel.ts`, `ui/hud.ts`).
- ✅ Modo Carrera rápida contra 7 bots: menú de inicio (`ui/quickRaceMenu.ts`) con dificultad Fácil/Normal/Difícil y ayuda de remontada (por defecto, los de la URL `?dificultad` y `?remontada=0`; Enter empieza, ←/→ o A/D cambian la dificultad). La carrera y la cuenta regresiva no arrancan hasta pulsar «¡A correr!», que crea los 7 bots con lo elegido (`Game.startRace`). El modal de resultados ofrece «Revancha» (mismos ajustes, todo a la parrilla; también Enter) y «Menú» (vuelve al menú y detiene la carrera); R sigue reiniciando durante la carrera. Lógica pura en `game/raceSettings.ts`.
- ✅ Pruebas de los bots (`tests/bots.test.ts`, 24): vueltas completas en Cocora sin respawns ni salir del corredor, orden fácil > normal > difícil, derrapes y nitros perfectos, atajo con probabilidad 0 y 1, remontada, evasión de karts, salida, recuperación, determinismo y carrera completa con 8 karts y choques. Más estado de carrera por kart y `speedScale` en `tests/racer.test.ts` (219 pruebas en total, con `tests/raceSettings.test.ts`).
- 🚧 Falta validar a mano que la dificultad normal sea pareja para un jugador promedio, y que los bots usen poderes (etapa 5).

**Notas:**

- La primera versión de los bots rompió el build y el arranque del juego (`require()` en el navegador y campos de `KartInput` equivocados). Se corrigió junto con los shaders de partículas, que habían perdido los `;` desde la etapa 2 y no compilaban, por lo que el humo y las llamas no se veían.
- Los bots no aceleran durante la cuenta regresiva (mantener el acelerador ahoga el motor): solo pulsan en los últimos 0,3 s, y solo si su dificultad lo saca en la tirada.
- `R` reinicia también a los bots.
- La velocidad del kart es un vector (`velocity`) separado de `heading`, así que el impulso del choque modifica solo el vector, igual que el rebote contra el muro; el agarre lateral se encarga después de realinear la velocidad con el rumbo.
- La parrilla va detrás de la línea de salida, por lo que en pistas con una curva justo antes de la meta las filas traseras podrían quedar fuera del asfalto; se comprobó que las 8 casillas caben en Cocora.
- Tiempos de vuelta medidos en Cocora (un bot solo, sin remontada, 3 vueltas, promedio de 4 semillas; vuelta ideal = 786,6 m / 28 m/s = 28,1 s): fácil 35,1 s, normal 31,4 s, difícil 28,5 s. Con el atajo siempre tomado / nunca: fácil 34,2 / 35,3, normal 30,8 / 31,9, difícil 28,3 / 29,2. Sin derrape ni atajo: 35,6 / 32,3 / 30,1.
- Las curvas de Cocora son suaves (radio ~100 m casi todo el recorrido), así que los derrapes duran poco y rara vez se encadenan los 3 nitros. En curvas muy abiertas el derrape se mete hacia adentro (el giro mínimo en derrape es mayor que el que pide la curva), por eso el bot solo derrapa en curvas marcadas y suelta si va a tocar la pared.
- Se corrigió el rebote entre suelo y aire al bajar pendientes: con `groundSnapDistance` (0,4 m) un kart en el suelo que no está subiendo se pega al suelo si este baja como mucho esa distancia, y aterrizar durante un derrape lo continúa en vez de reiniciar la barra y la cadena de nitros. Afecta también al jugador. Con el arreglo, los bots (un bot solo, 3 vueltas) pasaron a: fácil ~103 s y 5-7 nitros, normal ~91 s y 12-16 nitros, difícil ~82 s y 20 nitros perfectos (mejor vuelta ~27 s, por debajo de la vuelta ideal sin nitros). Hay que comprobar jugando si difícil queda demasiado fuerte.
- Detrás del menú de Carrera rápida se ve el HUD borroso con "1.º /1" porque aún no hay bots; se podría ocultar mientras el menú está abierto.
