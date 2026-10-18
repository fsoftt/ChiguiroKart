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
| 5 — Poderes y uchuvas                   | 🚧     |
| 6 — Personajes y animaciones            | 🚧     |
| 7 — Online: sala con código             | ⬜     |
| 8 — Online robusto                      | ⬜     |
| 9 — Contenido completo                  | 🚧     |
| 10 — Pulido                             | 🚧     |
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
- ✅ Contrarreloj con fantasma: modo elegible en el menú de inicio o con `?modo=contrarreloj` (jugador solo, sin bots, cajas ni uchuvas, 3 vueltas, cuenta regresiva normal). Se graba la pose del kart cada 3 pasos (20 Hz) y, si el tiempo total es el mejor de la pista, el fantasma se guarda en `localStorage`; en la siguiente contrarreloj se dibuja como un kart translúcido azul, interpolado y sincronizado con la luz verde (`sim/race/ghost.ts`, `Game.renderGhost`). El HUD muestra la diferencia con el fantasma al final de cada vuelta y el modal de resultados, «¡Nuevo récord!».
- ✅ Formato de pista por datos y editor en el navegador (`editor.html`, publicado en `/ChiguiroKart/editor.html`). `TrackData` (JSON versionado, `sim/trackData.ts`) describe puntos de control con altura y superficie, atajos, checkpoints (cantidad y opcionales), filas de cajas y líneas de uchuvas; `buildTrackDefinition` usa el mismo muestreo Catmull-Rom, interpolación de altura y mezcla de ramas que Cocora (`sim/trackSpline.ts`, compartido), y `parseTrackData` valida. El editor (`src/editor/*`, canvas 2D sin dependencias) permite mover/agregar/borrar puntos, editar altura y superficie, atajos, checkpoints y recogibles, avisa de cruces y puntos faltantes, importa/exporta JSON, autoguarda y prueba la pista en el juego con `?pista=custom` (clave `chiguirokart.customTrack.v1`, vuelve a Cocora si no es válida).

**Notas:**

- Cocora sigue definida en código (`cocoraTrack.ts`): el puente de madera es una caja fija y los checkpoints usan índices exactos que el formato de datos no expresa. Solo comparte las funciones genéricas (spline, altura, ramas) con `trackData`; el editor ofrece una versión aproximada (`config/tracks/trackPresets.ts`). Su geometría no cambió (comparada muestra a muestra antes y después de la refactorización).
- Formato del fantasma (`chiguirokart.ghost.v1.<pista>`): JSON con `v`, pista, tiempos en ms y muestras como enteros (x, y, z en cm, rumbo en mrad, banderas de suelo/derrape), codificadas como diferencias con la muestra anterior. Datos corruptos, de otra versión o de otra pista se ignoran, y todo acceso a `localStorage` va en `try/catch`. Una carrera de 3 vueltas en Cocora (~95 s, 1893 muestras) pesa ~29 kB; al terminar el fantasma desaparece. El récord de la contrarreloj es independiente del de Carrera rápida.
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
- 🚧 Falta el criterio de cierre de `plan.md`: validar a mano que una carrera contra bots en dificultad normal sea pareja para un jugador promedio (y de paso si difícil queda demasiado fuerte). Que los bots usen poderes es de la etapa 5, no de esta.

**Revisión contra `plan.md` (2026-10-17):** los siete puntos de la etapa están implementados y con pruebas: bot que produce `KartInput` siguiendo la línea con desviación, derrape y nitros por dificultad, atajos con probabilidad, evasión de paredes y karts, remontada configurable, posiciones en tiempo real con HUD y Carrera rápida contra 7 bots. `npm run check` pasa completo (lint, formato, 219 pruebas en 20 archivos y build; bundle principal de 614 kB, 159 kB gzip). La etapa sigue 🚧 solo por la prueba de juego.

**Notas:**

- La primera versión de los bots rompió el build y el arranque del juego (`require()` en el navegador y campos de `KartInput` equivocados). Se corrigió junto con los shaders de partículas, que habían perdido los `;` desde la etapa 2 y no compilaban, por lo que el humo y las llamas no se veían.
- Los bots no aceleran durante la cuenta regresiva (mantener el acelerador ahoga el motor): solo pulsan en los últimos 0,3 s, y solo si su dificultad lo saca en la tirada.
- `R` reinicia también a los bots.
- La velocidad del kart es un vector (`velocity`) separado de `heading`, así que el impulso del choque modifica solo el vector, igual que el rebote contra el muro; el agarre lateral se encarga después de realinear la velocidad con el rumbo.
- La parrilla va detrás de la línea de salida, por lo que en pistas con una curva justo antes de la meta las filas traseras podrían quedar fuera del asfalto; se comprobó que las 8 casillas caben en Cocora.
- Tiempos de vuelta medidos en Cocora (un bot solo, sin remontada, 3 vueltas, promedio de 4 semillas; vuelta ideal = 786,6 m / 28 m/s = 28,1 s): fácil 35,1 s, normal 31,4 s, difícil 28,5 s. Con el atajo siempre tomado / nunca: fácil 34,2 / 35,3, normal 30,8 / 31,9, difícil 28,3 / 29,2. Sin derrape ni atajo: 35,6 / 32,3 / 30,1.
- Las curvas de Cocora son suaves (radio ~100 m casi todo el recorrido), así que los derrapes duran poco y rara vez se encadenan los 3 nitros. En curvas muy abiertas el derrape se mete hacia adentro (el giro mínimo en derrape es mayor que el que pide la curva), por eso el bot solo derrapa en curvas marcadas y suelta si va a tocar la pared.
- Se corrigió el rebote entre suelo y aire al bajar pendientes: con `groundSnapDistance` (0,4 m) un kart en el suelo que no está subiendo se pega al suelo si este baja como mucho esa distancia, y aterrizar durante un derrape lo continúa en vez de reiniciar la barra y la cadena de nitros. Afecta también al jugador. Con el arreglo, los bots (un bot solo, 3 vueltas) pasaron a: fácil ~103 s y 5-7 nitros, normal ~91 s y 12-16 nitros, difícil ~82 s y 20 nitros perfectos (mejor vuelta ~27 s, por debajo de la vuelta ideal sin nitros). Hay que comprobar jugando si difícil queda demasiado fuerte.
- El HUD (con minimapa y modal de resultados) se oculta mientras está abierto el menú de Carrera rápida y vuelve al empezar la carrera (`Hud.setVisible`); antes se veía borroso detrás con "1.º /1".
- Ajuste de dificultades (2026-10-17), antes de la prueba de juego: difícil le ganaba a la vuelta ideal y normal parecía rápido para un jugador promedio. Normal: `speedFactor` 0,93 (antes 0,95), `nitroTimingError` 0,1. Difícil: `speedFactor` 0,94 (antes 1), `nitroTimingError` 0,05 y `nitroMistakeChance` 0,05 (antes 0). Fácil sin cambios. Medido (un bot solo, sin remontada, 3 vueltas, semillas 1–4): fácil 103,0 s (vuelta media 34,3 s, mejor 33,0 s), normal 96,8 s (32,3 s, mejor 30,3 s, 16 nitros), difícil 88,1 s (29,4 s, mejor 28,8 s, 19 nitros). Los tiempos no varían de forma suave con `speedFactor` (±0,005 puede mover la carrera varios segundos), así que el ajuste fino debe salir de la prueba de juego. La prueba de techo de física de `tests/bots.test.ts` fija `speedFactor: 1` para no depender del ajuste.

## Etapa 5 — Poderes y uchuvas 🚧

- ✅ Contrato compartido en `sim/items/itemTypes.ts` (13 poderes, ranura con ruleta, estados del kart, entidades, recogibles y eventos) y todos los valores en `config/items.ts`. La simulación escribe; HUD, render y bots solo leen. Cada `Racer` lleva sus `items` y `resetRacer` los reinicia.
- ✅ Uchuvas: recogida en pista (se quedan si el kart ya tiene 10), +0,8 % de velocidad máxima y aceleración por uchuva, 1 por caja, pérdida de 3 por golpe y modo Bien Cargado con 10 (`sim/items/pickups.ts`, `statusModifiers.ts`).
- ✅ Cajas de poder con reaparición a los 2 s, ruleta de 1,5 s y reparto por posición con pesos de `diseno.md` §5 y RNG con semilla (`distribution.ts`, `roulette.ts`). Cocora tiene 16 cajas (4 filas) y 28 uchuvas, fuera de la rampa; la pista de prueba, una fila y 5 uchuvas (`config/tracks/pickupLayout.ts`).
- ✅ Los 13 poderes, con versión normal y Bien Cargado (`powers.ts`, `entities.ts`): coco bomba (adelante, o atrás con `Q`), tejo con mecha, mango maduro, panela turbo, escudo de armadillo (segunda pulsación lo lanza), avispa teledirigida, colibrí del líder, nube de mosquitos, sombrero vueltiao, hormigas culonas, aguacero, Rayo del Catatumbo y Máscara del Carnaval.
- ✅ Estados del kart golpeado: girando, volando (salta y da una vuelta de campana) y mareado después; sin control durante el golpe, invulnerable 1,5 s después. Una sola regla de golpe (`hits.ts`): máscara > invulnerabilidad > escudo. Mosquitos (zigzag en Bien Cargado) y aguacero (menos agarre; también frena en Bien Cargado) modifican la conducción en `stepRacer`.
- ✅ Uso de poderes por los bots (`ai/itemControl.ts`): ofensivos con un rival cerca adelante, trampas y escudo con uno cerca detrás, globales si no van primeros, panela en recta, máscara de una; tiempo de reacción y probabilidad defensiva por dificultad, y uso forzado a los 8 s. Cegados por mosquitos manejan peor; golpeados no cuentan como atascados ni derrapan.
- ✅ Render provisional (`render/items/`): cajas, uchuvas, cada entidad, escudo, nube de lluvia, mosquitos, aura de la máscara, explosiones, rayos y estrellas al golpe; el `KartView` gira o da la vuelta de campana según el golpe.
- ✅ HUD: ranura de poder con ruleta, usos y etiqueta Bien Cargado, contador de uchuvas, pantalla de mosquitos, avisos de golpe/bloqueo/robo y destello del rayo; bots en el minimapa.
- ✅ Pruebas: reparto por posición, ruleta, uchuvas, cajas, cada poder en sus dos versiones, escudo, máscara, invulnerabilidad, golpes y recuperación, determinismo, recogibles sobre la pista, decisiones de los bots y carrera completa de 8 karts en Cocora usando poderes al azar sin NaN ni karts atascados (319 pruebas en total).
- 🚧 Falta el criterio de cierre de `plan.md`: comprobar jugando que los 13 poderes se sienten bien, que los bots los usan con sentido y que ninguno rompe la carrera.

**Notas:**

- El contrato se escribió primero para construir simulación, render/HUD y bots en paralelo, como en la etapa 2.
- Las uchuvas también suben la velocidad de los bots, así que los tiempos de la etapa 4 ya no aplican tal cual con poderes; el ajuste de dificultad debe rehacerse en la prueba de juego.
- La máscara toca a un kart a 2,6 m (más que la distancia de choque entre karts, 2,2 m), si no nunca llegaría a tocarlo.
- Sin rival a su alcance, las hormigas no se gastan. Sin nadie adelante, la avispa sale recta y desaparece.
- Comprobado en Chromium: la carrera arranca, los bots usan poderes y no hay errores de consola.

## Etapa 6 — Personajes y animaciones 🚧

- ✅ Atributos y _perks_ de los 8 personajes en `config/characters.ts` (`characterTuning` con todos los números). Un punto de atributo sobre o bajo 3 cambia la velocidad máxima un 2,5 %, la aceleración un 8 %, el giro y el agarre un 6 % y la masa de choque un 25 %; el atributo 3 deja la física igual que antes. `Racer.character` y `characterPhysics` se aplican en `stepRacer` (`sim/characters.ts`, `sim/kart/kartPerks.ts`).
  - Chigüiro (Tranquilo): los tiempos de golpe, giro, vuelta de campana y mareo corren ×1,3.
  - Oso (Aplanadora): masa ×1,3 sobre su peso 5; empuja más y lo empujan menos (`resolveKartCollisions` con masas).
  - Tití (Ágil): carga del derrape ×1,3.
  - Cóndor (Planeo): gravedad ×0,75 en el aire, control en el aire (1,2 rad/s) y turbo de aterrizaje ×1,5.
  - Jaguar (Depredador): rebufo con un rival a menos de 14 m en un cono de 14° delante: hasta +6 % de velocidad y +20 % de aceleración.
  - Guacamaya (Coleccionista): máscara, panela, escudo, mosquitos y aguacero duran ×1,25.
  - Delfín rosado (Anfibio): sin penalización en barro (y en agua, cuando exista).
  - Perezoso (Calma total): nitros ×1,25; el tercero ×2.
- ✅ Pipeline glTF: los modelos se arman con primitivas _low-poly_ en `render/characters/` (`modelKit.ts`, `kartModel.ts`, `characterModels.ts`, `characterClips.ts`) y `npm run models` (`scripts/buildModels.ts`, GLTFExporter en Node) los exporta a `public/models/<id>.glb`. El juego los carga con GLTFLoader (`characterAssets.ts`), valida el contrato de `rig.ts` (huesos y animaciones) y, si un archivo falla, construye el modelo en el momento. Cada kart con su piloto es una sola malla con esqueleto y colores por vértice: 1 _draw call_ más 1 del contorno.
- ✅ Los 8 personajes con kart propio (colores y estilo: clásico, deportivo, con hojas o bote) y 11 animaciones: reposo con tic propio, giro izquierda y derecha, derrape, nitro, aire, golpeado, victoria (cumbia, champeta o joropo), derrota, lanzar adelante y lanzar atrás.
- ✅ Mezcla de animaciones según giro, derrape, nitro, aire, golpes y resultado (`render/characterAnimLogic.ts`, lógica pura con pruebas) y gesto de lanzar al usar un poder (`CharacterView.playAction`).
- ✅ Animación procedural del kart: suspensión con resorte, _squash & stretch_ al aterrizar, acelerar y frenar, inclinación en curvas y derrapes, rebote al chocar con paredes, ruedas que giran y se orientan (`render/kartSuspension.ts`).
- ✅ Pantalla de selección de personaje: tercer paso del menú (modo, pista, personaje, dificultad), con los 8 pilotos, habilidad y barras de atributos (`ui/quickRaceMenu.ts`, `ui/characterSelectModel.ts`). Detrás se ve el kart elegido en reposo con una cámara de exhibición. También `?personaje=<id>`. Los bots llevan los otros 7 personajes.
- ✅ Sombreado _toon_ de 3 tonos, contorno por casco invertido (`render/characters/toon.ts`) y _bloom_ suave en llamas, explosiones y rayos (`EffectComposer` + `UnrealBloomPass` con umbral alto; `?bloom=0` lo apaga).
- ✅ Bailes de victoria (podio) y berrinche de derrota en la pantalla de resultados, con la cámara de frente al kart; la tarjeta de resultados pasó a la izquierda para que se vea el baile.
- ✅ Galería de personajes (`characters.html`, publicada en `/ChiguiroKart/characters.html`).
- ✅ Pruebas: atributos, cada _perk_, masas de choque, mezcla de animaciones, suspensión, contrato del rig, selección de personaje (413 pruebas en total).
- ✅ Retratos en la selección de personaje: cada círculo con la inicial se reemplaza por un retrato de la cabeza y los hombros, renderizado del modelo 3D real (`render/characterPortraits.ts`, marco de cámara en `render/portraitFraming.ts` con prueba). Se generan una sola vez al abrir el menú, 128 px con fondo transparente, en un `WebGLRenderer` temporal que se libera al terminar; si no hay WebGL se quedan las letras. El teclado y la rejilla no cambian.
- ℹ️ El kart ya era de carrocería curva (nariz, parachoques, pods laterales, alerón, escapes, asiento, volante, llantas con rin), así que no se rehízo la carrocería en esta pasada.
- 🚧 Falta el criterio de cierre: que apruebes el arte provisional y comprobar jugando que los personajes se sienten distintos al manejar.

**Notas:**

- Arte provisional hecho con código, no en Blender: es completo (esqueleto, 11 animaciones, kart propio) y se puede reemplazar archivo por archivo respetando `rig.ts`.
- Cada `.glb` pesa 400–620 kB (unos 7000 vértices); los 8 suman ~3,7 MB, dentro del presupuesto de 15 MB de descarga inicial.
- Con 8 karts en carrera se miden 46 _draw calls_ por cuadro (presupuesto: 150).
- El bundle principal pasó a ~804 kB (214 kB gzip) por el _bloom_ y el cargador glTF; se subió el aviso de Vite a 900 kB.
- Comprobado en Chromium: menú con vista previa, parrilla con 8 personajes distintos, carrera y pantalla de resultados sin errores de consola. Chromium sin GPU corre a ~2 FPS, así que la fluidez de las mezclas solo se revisó en capturas.

## Etapa 9 — Contenido completo 🚧

- ✅ Contrato de la etapa: superficies `ice`, `sand` y `water` (el Delfín rosado ignora agua y barro), atajos con marea (`TideRule`), franjas turbo (`BoostPad`) y peligros de pista (`HazardDefinition`: `herd`, `float`, `iceWall`, `rock`) en `sim/track.ts` y `TrackData` (el editor los conserva al importar y exportar); tema visual por pista (`config/tracks/theme.ts`) y catálogo de 12 pistas en 3 copas (`config/tracks/catalog.ts`).
- ✅ Las 11 pistas nuevas como datos (`config/tracks/<id>Track.ts`), de 918 a 1080 m, cada una con al menos un atajo legal (checkpoints opcionales solo donde el atajo salta), cajas, uchuvas, franjas turbo y tema propio:
  - Copa Andina: Nevado del Ruiz (lago congelado de hielo; túnel cerrado por un muro de hielo que solo rompe un nitro nivel 3), Catedral de Sal de Zipaquirá (subterránea; pasaje estrecho entre rocas y bajada a un nivel inferior), Bogotá (subida en zigzag a Monserrate hasta 17,5 m, callejón por una casa colonial, cresta del teleférico con turbo).
  - Copa Caribe: Murallas de Cartagena (paseo sobre la muralla, rampa del cañón), Ciudad Perdida (escalinata y paso tras la cascada), San Andrés (banco de arena que aparece con marea baja en la vuelta 2), Carnaval de Barranquilla (dos carrozas recorren el carril izquierdo; callejón de papelillo con turbo a la salida).
  - Copa Selva y Llano: Caño Cristales (vado sobre piedras), Llanos Orientales (campo de barro que corta la gran curva; estampida de vacas que hace girar), Amazonas (túnel de la ceiba y rampa del tronco sobre el río), Desierto de la Tatacoa (salto del cañón con turbo y cárcavas con dos salidas).
- ✅ Simulación (`sim/hazards/`): franjas turbo en `stepRacer` (nitro corto, solo en carrera y en el suelo); marea según la vuelta del líder; `HazardSystem` dentro de `ItemSystem` (también en contrarreloj) con movimiento determinista por tiempo de carrera (`loop` y `pingPong` con pausa); las vacas hacen girar por la regla única de golpes y carrozas, rocas y muro de hielo empujan como una pared; el muro se rompe con nitro nivel 3 y vuelve a los 8 s si no hay un kart encima. Valores en `config/hazards.ts`.
- ✅ Bots: esquivan obstáculos como a los karts de adelante (`RaceWorld.obstacles`), no toman un atajo cerrado por un muro de hielo salvo con nitro nivel 3 y solo toman el banco de arena con marea baja.
- ✅ Render: cielo con degradado, niebla, luces y suelo por tema (modo subterráneo para Zipaquirá), plano de mar o río, colores de hielo, arena y agua, franjas turbo brillantes, color del atajo según la marea, 18 tipos de decoración _low-poly_ instanciados y colocados con semilla (`render/scenery/`), y vacas, carrozas, muro de hielo (con estallido al romperse) y rocas (`render/hazardView.ts`). Unas 35–42 _draw calls_ sin karts (~90 con 8 karts).
- ✅ `Game` carga cualquier pista del catálogo al empezar una carrera: reconstruye `RaceWorld`, `ItemSystem` y la vista de objetos, reemplaza la escenografía (con `disposeObject` para liberar geometrías, materiales y texturas), aplica el tema (`applySceneTheme`) y actualiza el minimapa. `?pista=test` y `?pista=custom` siguen funcionando; se agregan `?pista=<TrackId>` y `?copa=<CupId>`. Pista por defecto: Cocora.
- ✅ Un solo lugar para lo que depende de la pista en `game/game.ts`: `setupTrack`, `teardownTrack` y `updateTrack` (escenografía con tema, vista de peligros y marea).
- ✅ Menú en cuatro pasos: modo (Carrera rápida, Copa, Contrarreloj), pista (12 pistas agrupadas por copa) o copa (3 copas con sus 4 pistas), personaje y dificultad. Teclado (flechas, WASD, Enter, Esc) y ratón. Lógica pura en `ui/trackSelectModel.ts`.
- ✅ Modo Copa: 4 carreras con el mismo personaje, dificultad y los mismos 7 bots; puntos 15, 12, 10, 8, 6, 4, 2, 1 (`config/cups.ts`); desempate por el mejor resultado de la última carrera y luego por el puesto en la parrilla (`game/cup.ts`). Al terminar cada carrera, tabla de la copa de 8 filas y botón «Siguiente carrera» (Enter); al terminar la cuarta, podio final con «Menú» y «Repetir copa» (`ui/cupResultsModel.ts`). Quienes no han terminado se ordenan por la clasificación en ese momento.
- ✅ HUD: «Carrera 2/4 · Copa Andina» durante las carreras de copa.
- ✅ Pruebas: ajustes, puntos, desempates, avance de la copa, vistas de resultados y selección de pista.
- ✅ Comprobado en Chromium: menú → pista → carrera sin errores de consola, cambio de pista desde el menú después de una carrera y la copa completa (4 carreras y repetir copa) forzando la llegada con `window.game` (solo en desarrollo).
- ✅ Prueba de integración `tests/tracksRace.test.ts`: las 12 pistas con 8 karts (el jugador conducido por un bot), poderes, colisiones y peligros activos, 1 vuelta cada una (San Andrés además 3 vueltas para ver la marea). Todos terminan, sin NaN, sin karts atascados (>8 s sin avanzar 3 m) y con 0 reapariciones en cada pista; las vacas de los Llanos y las carrozas de Barranquilla se mueven, los bots no chocan contra el muro de hielo del Nevado y en San Andrés usan el banco de arena solo con marea baja (vuelta 2). Comprobado en Chromium (`?pista=<id>` en las 12 pistas, sin errores de consola ni peticiones fallidas).
- ⬜ Falta: copas online (llegan con las etapas 7 y 8, que se dejaron para el final) y la prueba de juego de las 12 pistas.

**Notas:**

- El formato no permitía saltos de verdad: el suelo era una curva suave y el kart se pegaba al piso en las crestas, así que el teleférico de Bogotá, la rampa del cañón, el tronco del Amazonas y el cañón de la Tatacoa eran crestas con turbo. La altura de un atajo era una rampa recta entre sus dos extremos (la escalinata de Ciudad Perdida era una rampa empinada) y las franjas turbo solo iban en el circuito principal. Estas crestas se reemplazaron por saltos de verdad en la etapa 10. Pasar por dentro de una carroza en movimiento quedó fuera.
- Algunas curvas de Ciudad Perdida, San Andrés, Barranquilla, Amazonas, Tatacoa y Caño Cristales tienen radio de 18–29 m, menos que los 35 m buscados; los bots las toman sin rozar.
- Las pruebas de carreras completas tardan varios segundos; el límite de Vitest pasó a 20 s por prueba.

## Etapa 10 — Pulido 🚧

- ✅ Opciones (`game/settings.ts`, `ui/optionsMenu.ts`), guardadas en `chiguirokart.settings.v1`: calidad gráfica (Baja: resolución 1, sin _bloom_, partículas ×0,5, sin líneas de velocidad; Media: 1,5, _bloom_, ×0,75; Alta: 2, _bloom_, ×1; `config/quality.ts`), volumen general, música y efectos, modo daltonismo, reducir sacudidas y reasignar teclas (hasta 2 por acción; si una tecla ya estaba en otra acción, se mueve o se intercambian; `game/keyRebind.ts`). Se abre desde el menú (botón u O) y desde la pausa.
- ✅ Accesibilidad (`config/accessibility.ts`): modo daltonismo con paleta segura para los niveles de nitro (`#f0e442`, `#d55e00`, `#56b4e9`) en la barra, las llamas y el humo, más el número del nivel en el HUD; reducir sacudidas quita la sacudida de cámara y deja el cambio de FOV al 35 %.
- ✅ Pausa (`game/pause.ts`, `ui/pauseMenu.ts`): Esc, P, Start del mando o botón táctil; también al ocultar la pestaña. Congela simulación y cronómetros sin recuperar el tiempo al volver. Continuar, Reiniciar carrera, Opciones y Salir al menú.
- ✅ Audio procedural con Web Audio, sin archivos (`src/audio/`, `config/audio.ts`, `config/music.ts`): motor con timbre por personaje, chirrido de derrape, nitros por nivel, saltos, aterrizajes, choques, cajas, uchuvas, poderes, golpes, explosiones atenuadas por distancia, cuenta regresiva, vueltas y fanfarria, y voz corta por personaje al recibir golpes y al llegar. Música por pista con ritmos colombianos: bambuco (Cocora), andino (Nevado), pasillo (Zipaquirá), salsa (Bogotá), champeta (Cartagena), vallenato (Ciudad Perdida), calipso (San Andrés), cumbia (Barranquilla), currulao (Caño Cristales), joropo (Llanos), selva (Amazonas) y sanjuanero (Tatacoa), más tema de menú; la última vuelta va un 8 % más rápido. El contexto de audio se crea con el primer gesto del jugador y se suspende con la pestaña oculta o en pausa. `?volumen=0` silencia.
- ✅ Idioma español e inglés (`src/i18n/`): diccionarios tipados (si falta una clave en inglés no compila), plurales y ordinales por idioma, nombres de personajes, pistas, copas y poderes traducidos (las claves de récords y fantasmas siguen en español). Se elige en Opciones y cambia en vivo; por defecto, inglés si el navegador no está en español. El editor, la galería y el panel de depuración quedan en español.
- ✅ Iluminación y atmósfera (`render/shadows.ts`, `render/shadowMath.ts`, `render/mountains.ts`, `render/sky.ts`, `config/tracks/lighting.ts`): mapeo de tono ACES con exposición por pista, sol cálido más luz hemisférica, sombras en tiempo real con un solo mapa que sigue al kart y se ajusta a la rejilla de texeles (2048 en Alta, 1024 en Media; en Baja, sombra simple bajo cada kart), niebla de profundidad y distancia de dibujo según la calidad, cielo con degradado, halo del sol y nubes, y dos anillos de colinas en el horizonte que se funden con la niebla (Zipaquirá, subterránea, no los lleva). Cada pista tiene dirección y color de sol propios. _Draw calls_ en carrera: 67–90 en Alta y 41 en Baja.
- ✅ Piloto de personajes (`render/characters/modelKit.ts`, `characterParts.ts`, `heroPilots.ts`): `modelKit` suma superficies suaves (barrido, _loft_, tubos cónicos, torno, cajas redondeadas, cúpulas, degradados por vértice). `rig.ts` agrega huesos opcionales de cara (mandíbula, párpados y cejas): parpadeo en reposo, ojos abiertos o entrecerrados al recibir golpes, ojos cerrados con sonrisa en la victoria y cejas tristes en la derrota. Sombreado _toon_ con luz de borde y contorno más fino. Kart nuevo para los 8: carrocería curva, guardabarros, escapes cromados, llantas con taco, volante visible y número; el Oso lleva el estilo `heavy`. Oso de anteojos rehecho (11 936 triángulos, 650 kB). El Chigüiro conserva la forma aprobada (congelada en `arte.md`) con un kart nuevo (8266 triángulos, 483 kB).
- ✅ Oso de anteojos simplificado: cabeza de una sola forma, ojos al ras, anteojos como calcomanía de borde suave sobre la cabeza (11 388 triángulos, 631 kB). Aprobado de forma provisional.
- ✅ Piloto de entorno en Cocora (`render/environment/`, `config/tracks/environment.ts`, `cocoraTheme.ts`), todo por código y sin descargas: terreno esculpido con semilla (colinas y paredes de valle; a menos de 4,5 m de la pista queda 0,3 m bajo la vía, así la física no cambia), texturas de lienzo para asfalto (grietas, parches, línea de carrera y líneas), madera y barro con charcos, bordillos redondeados, cerca de madera con pancartas de marcas inventadas, ocho capas de vegetación instanciada que se mueven con el viento (pasto, flores, arbustos, helechos, palmas de cera, árboles, cipreses y siluetas lejanas; densidad 100/60/30 % según la calidad), arco de meta, banderines, flechas en curvas cerradas y objetos (fincas, yipaos, carretas, sacos de café). _Draw calls_: 96 en Alta (1,19 M triángulos) y 62 en Baja (0,39 M). Las otras 11 pistas lo recibieron después (ver abajo).
- ✅ Entorno rico en las otras 11 pistas (bloque `environment` en cada `config/tracks/<id>Track.ts`). El contrato creció (`config/tracks/environment.ts`): 27 modelos de planta que cada capa elige (`render/environment/plantModels.ts`: pasto seco y de páramo, frailejón, macarenia, agave, palma de coco, moriche, cardón, ceiba, selva con lianas, samán, árbol seco, eucalipto, pino nevado, cristales de sal, agujas de roca y siluetas lejanas), 13 objetos nuevos (`render/environment/props.ts`: tribuna con público, casa colonial, chiva, lancha, refugio de montaña, cruz de sal, cañón, casa isleña, terraza de piedra, palco de carnaval, maloca, corral y observatorio), texturas de adoquín, trocha, hielo, arena, vado y pasto (`road: 'cobble' | 'dirt'`), tierra que cae hacia el mar o el río (`valleySlope` negativo y `floor`; nada crece ni se coloca bajo el agua), barrancos bajo los huecos de los saltos (`gapDepth`), la rama de marea de San Andrés dentro del entorno y las decoraciones del tema puestas sobre el terreno. Pancartas con patrocinadores inventados por pista. Comprobado en Chromium: las 12 pistas sin errores de consola; _draw calls_ en Alta de 81 a 134 (presupuesto 150) y de 0,4 a 1,2 M triángulos.
- ✅ El terreno muestra el relieve: más allá del arcén tiende a una altura regional (promedio gaussiano de la vía, sigma 70 m), así que junto a una vía elevada la tierra cae como talud o barranco y junto a una vía hundida sube como pared (`TerrainSettings.drop`, 1 por defecto; Ciudad Perdida usa 2,5). Cocora se ve igual.
- 🚧 Dirección de arte cercana a _CTR Nitro-Fueled_ (`arte.md`): faltan los otros 6 personajes. Por mejorar en el entorno: la ceiba (copa de losas planas), la macarenia (se lee como púas) y revisar a mano los barrancos de Bogotá, Amazonas y Tatacoa y la rama de marea de San Andrés, que no salieron en las capturas.
- ✅ Efectos por superficie y marcas de llantas (`render/effects/surfaceFx.ts`, `surfaceFxLogic.ts`, `skidBuffer.ts`; ajustes en `config/effects.ts`): para el jugador y los bots, desde las dos ruedas traseras salen polvo (tierra, pasto; solo derrapando en asfalto y madera), salpicaduras (agua y barro), nieve (hielo, la única superficie nevada que existe) y arena, según la superficie bajo cada rueda, la velocidad y el derrape (más fuerte derrapando y con una ráfaga al aterrizar de un salto). Marcas de llantas oscuras en asfalto, café en tierra y barro, claras en arena y hielo y ninguna en agua ni pasto; salen al derrapar, patinar de lado, frenar fuerte o girar cerrado en asfalto, siguen la altura del suelo y se desvanecen en 7 s. Las decisiones (qué efecto, cuánto y cuándo marcar, desvanecido) son lógica pura con pruebas (`tests/surfaceFx.test.ts`). Todo el sistema son **2 _draw calls_** sin importar cuántos karts haya: una nube de puntos con 360 partículas compartidas y una malla de 1024 cuadrados en anillo (2048 triángulos; transparente de una sola pasada con `forceSinglePass`). La calidad escala las partículas (×0,5/×0,75/×1) y las marcas (30/70/100 % del anillo y de la vida; `skidMarkScale`). Los karts a más de 70 m del jugador no sueltan partículas y a más de 90 m no dejan marcas. La sacudida de cámara y los textos emergentes (golpes, nivel de nitro, nitro perfecto) ya existían.
- ✅ Controles táctiles para celular y tablet (`input/touch.ts`, `input/touchView.ts`, `input/touchControls.css`): `TouchSource` entra en `inputSources` junto al teclado y el mando. Se muestran con `(pointer: coarse)` o `maxTouchPoints > 0` sin puntero fino, o tras el primer `touchstart`; nunca en escritorio con ratón. Barra deslizable a la izquierda (giro analógico -1..1 con zona muerta) y a la derecha Acelerar, Frenar, Saltar/derrapar (se mantiene), Nitro, Poder y Atrás, con _pointer events_ multitáctil por `pointerId`, `touch-action: none` y áreas de seguridad (`viewport-fit=cover`). Se ocultan en el menú y en los resultados (ambos ya se manejan con toques). En modo táctil el HUD se reacomoda (velocímetro, minimapa y barra de nitro). Pruebas en `tests/touch.test.ts`. Comprobado en Chromium con Pixel 7 horizontal y vertical: el kart acelera y gira con toques, sin errores de consola, y en escritorio no aparecen.
- ✅ Saltos de verdad: rampas con borde que lanzan el kart (`TrackData.jumps`, `src/sim/hazards/jumps.ts`, `src/config/jumps.ts`) y huecos sin suelo (`groundHeight` devuelve -20, el kart cae y reaparece en el último punto de control). Como en CTR, saltar en la punta (o justo antes o hasta 0,15 s después) da un poco más de altura y nitro al aterrizar; sin el salto no hay nitro. Los bots saltan en la punta según la dificultad (`jumpTrickChance`: fácil 0,3, normal 0,7, difícil 0,95). Los atajos admiten alturas propias (`heights`) y escalones (`steps`), y franjas turbo (`boostPads` con `branch`). Pistas: teleférico de Bogotá con hueco de ~7 m, rampa del cañón de Cartagena (lanzamiento fuerte sin hueco), tronco roto del Amazonas con hueco de 10 m sobre el río, salto del cañón de la Tatacoa con hueco de 12 m y turbo antes, y escalinata de Ciudad Perdida con 9 escalones. Cada hueco se pasa a 20 m/s y a 8 m/s se cae. Pruebas en `tests/jumps.test.ts`.
- ✅ Ciudad Perdida rediseñada como pista piloto estilo CTR (`ciudadPerdidaTrack.ts`): 1 193 m, 30,8 m de desnivel (del río a la terraza superior y bajada rápida), carretera de 13 m (`halfWidth` 6,5), dos horquillas y una curva amplia en la subida, pendiente máxima de la carretera ~12 %, dos rampas de cresta sin hueco en la bajada y cuatro atajos: escalinata (9 escalones, ahorra ~60 m), cornisa estrecha (~26 m), cascada (~26 m) y salto de 12 m sobre un barranco (~32 m, se cae si se va lento). Vueltas de bot normal: 45 s con atajos, 49 s sin ellos. La física no lanza al kart en crestas del terreno (se pega al suelo hasta 0,4 m por paso), por eso las crestas son rampas de `jumps` sin hueco. Pruebas de relieve en `tests/tracksCaribe.test.ts` y de las rampas en `tests/jumps.test.ts`.
