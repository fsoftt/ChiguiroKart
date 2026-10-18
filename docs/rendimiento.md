# Rendimiento

Medidas y presupuestos de render para cumplir la meta de **30 FPS en un celular de gama media** (`plan.md`, etapa 10). No hay un celular real a mano, así que el trabajo se hace contra presupuestos medibles: llamadas de dibujo (_draw calls_) y triángulos por cuadro, que son lo que más pesa en una GPU móvil. Medido el 2026-10-18.

## Presupuestos

Por cuadro, con 8 karts en pantalla, contando la pasada de sombras y el _bloom_ (`renderer.info`). Viven en `src/config/perfBudget.ts`.

| Calidad | _Draw calls_ | Triángulos |
| ------- | -----------: | ---------: |
| Baja    |        ≤ 150 |     ≤ 300k |
| Media   |        ≤ 250 |     ≤ 700k |
| Alta    |   sin límite | sin límite |

Baja es la calidad por defecto en celulares (ver «Calidad automática»). Los números de las tablas son el **peor** de cuatro cámaras por pista: la salida y tres puntos del circuito (25 %, 50 %, 75 %), con el jugador y los 7 bots delante de la cámara (el caso más pesado: toda la parrilla a la vista). Un barrido más fino (24 puntos) en las pistas más justas dio como máximo 144 _draw calls_ en Baja (San Andrés, antes de quitar las uchuvas lejanas; ahora 116), 268k triángulos en Baja (Barranquilla, antes de partir la decoración; ahora 221k) y 599k en Media (Ciudad Perdida).

## Cómo medir

```sh
npx vite --port 5214 &
PLAYWRIGHT_MODULE=/ruta/a/node_modules/playwright/index.mjs \
  node scripts/perfReport.mjs [--track cocora,tatacoa] [--json salida.json]
```

`scripts/perfReport.mjs` abre el juego en desarrollo con Chromium (Playwright no es una dependencia del proyecto), y para cada pista y calidad llama a `game.perfStart(pista, calidad)` y `game.perfSample(fracción)` (`src/game/game.ts`, `src/game/perfProbe.ts`): arranca una carrera de 8 karts, pone al jugador en cada punto, dibuja un cuadro y devuelve `renderer.info`. Imprime la tabla y termina con código 1 si alguna fila pasa su presupuesto. `game.perfBreakdown()` (`src/render/perfBreakdown.ts`) lista qué mallas cuestan más en la vista, útil para buscar culpables. La columna «Pixel ratio» es el tope de la calidad en un celular de pixel ratio 3 (`resolveQuality(calidad, 3)`); en el navegador de pruebas el pixel ratio real es 1.

## Resultado

_Draw calls_ / triángulos, peor caso de la pista:

| Pista         | Baja antes | Baja ahora | Media antes | Media ahora |  Alta antes | Alta ahora |
| ------------- | ---------: | ---------: | ----------: | ----------: | ----------: | ---------: |
| cocora        |  74 / 444k |  91 / 178k |  119 / 935k |  193 / 506k | 119 / 1266k | 224 / 673k |
| nevado        |  74 / 347k | 101 / 179k |  113 / 570k |  195 / 413k |  113 / 650k | 234 / 473k |
| zipaquira     |  62 / 313k |  82 / 174k |  106 / 499k |  149 / 381k |  106 / 499k | 152 / 389k |
| bogota        |  85 / 411k |  96 / 191k |  122 / 790k |  206 / 479k | 123 / 1025k | 298 / 691k |
| cartagena     |  80 / 390k |  95 / 169k |  127 / 728k |  194 / 418k |  127 / 934k | 285 / 559k |
| ciudadPerdida |  77 / 516k | 101 / 225k |  127 / 969k |  218 / 580k | 127 / 1192k | 277 / 719k |
| sanAndres     |  92 / 389k | 100 / 197k |  127 / 729k |  209 / 479k |  127 / 930k | 279 / 640k |
| barranquilla  |  76 / 477k | 100 / 200k |  124 / 791k |  188 / 442k |  124 / 966k | 280 / 615k |
| canoCristales |  77 / 410k | 108 / 171k |  119 / 756k |  211 / 423k |  119 / 989k | 261 / 568k |
| llanos        |  84 / 375k |  95 / 172k |  139 / 653k |  204 / 433k |  139 / 801k | 318 / 583k |
| amazonas      |  66 / 448k |  87 / 173k |  123 / 891k |  186 / 458k | 123 / 1130k | 287 / 651k |
| tatacoa       |  85 / 374k | 104 / 171k |  130 / 674k |  190 / 407k |  131 / 804k | 277 / 486k |

Peor pista por calidad (triángulos): Baja 516k → 225k (Ciudad Perdida), Media 969k → 580k (Ciudad Perdida), Alta 1 266k → 719k (Ciudad Perdida; antes Cocora). _Draw calls_ máximos: Baja 92 → 108 (Caño Cristales), Media 139 → 218 (Ciudad Perdida), Alta 139 → 318 (Llanos). Las llamadas suben porque lo que antes era una sola malla enorme ahora son varias por zona; los triángulos bajan mucho porque las zonas fuera de cámara no se dibujan. Alta se ve igual (nada se oculta por distancia), pero hace más llamadas; en escritorio no es problema.

### Tabla completa (después)

| Pista         | Calidad | Draw calls | Triángulos | Geometrías | Texturas | Sombra | Pixel ratio |
| ------------- | ------- | ---------: | ---------: | ---------: | -------: | -----: | ----------: |
| cocora        | low     |         91 |       178k |         63 |       34 |   blob |           1 |
| cocora        | medium  |        193 |       506k |         68 |       54 |   1024 |         1.5 |
| cocora        | high    |        224 |       673k |         69 |       61 |   2048 |           2 |
| nevado        | low     |        101 |       179k |         70 |       34 |   blob |           1 |
| nevado        | medium  |        195 |       413k |         72 |       54 |   1024 |         1.5 |
| nevado        | high    |        234 |       473k |         72 |       61 |   2048 |           2 |
| zipaquira     | low     |         82 |       174k |         56 |       33 |   blob |           1 |
| zipaquira     | medium  |        149 |       381k |         58 |       53 |   1024 |         1.5 |
| zipaquira     | high    |        152 |       389k |         58 |       60 |   2048 |           2 |
| bogota        | low     |         96 |       191k |         70 |       33 |   blob |           1 |
| bogota        | medium  |        206 |       479k |         73 |       53 |   1024 |         1.5 |
| bogota        | high    |        298 |       691k |         75 |       60 |   2048 |           2 |
| cartagena     | low     |         95 |       169k |         77 |       32 |   blob |           1 |
| cartagena     | medium  |        194 |       418k |         80 |       52 |   1024 |         1.5 |
| cartagena     | high    |        285 |       559k |         82 |       59 |   2048 |           2 |
| ciudadPerdida | low     |        101 |       225k |         76 |       33 |   blob |           1 |
| ciudadPerdida | medium  |        218 |       580k |         79 |       54 |   1024 |         1.5 |
| ciudadPerdida | high    |        277 |       719k |         83 |       61 |   2048 |           2 |
| sanAndres     | low     |        100 |       197k |         78 |       33 |   blob |           1 |
| sanAndres     | medium  |        209 |       479k |         83 |       53 |   1024 |         1.5 |
| sanAndres     | high    |        279 |       640k |         83 |       60 |   2048 |           2 |
| barranquilla  | low     |        100 |       200k |         86 |       32 |   blob |           1 |
| barranquilla  | medium  |        188 |       442k |         90 |       53 |   1024 |         1.5 |
| barranquilla  | high    |        280 |       615k |         91 |       60 |   2048 |           2 |
| canoCristales | low     |        108 |       171k |         80 |       33 |   blob |           1 |
| canoCristales | medium  |        211 |       423k |         87 |       53 |   1024 |         1.5 |
| canoCristales | high    |        261 |       568k |         88 |       60 |   2048 |           2 |
| llanos        | low     |         95 |       172k |         78 |       35 |   blob |           1 |
| llanos        | medium  |        204 |       433k |         79 |       55 |   1024 |         1.5 |
| llanos        | high    |        318 |       583k |         79 |       62 |   2048 |           2 |
| amazonas      | low     |         87 |       173k |         81 |       33 |   blob |           1 |
| amazonas      | medium  |        186 |       458k |         91 |       53 |   1024 |         1.5 |
| amazonas      | high    |        287 |       651k |         92 |       60 |   2048 |           2 |
| tatacoa       | low     |        104 |       171k |         81 |       34 |   blob |           1 |
| tatacoa       | medium  |        190 |       407k |         88 |       54 |   1024 |         1.5 |
| tatacoa       | high    |        277 |       486k |         91 |       61 |   2048 |           2 |

## Qué costaba y qué se hizo

Desglose de Ciudad Perdida en Baja, antes de optimizar (515k triángulos): los 8 karts 91k más 91k de sus contornos, terreno 55k, postes de la cerca 53k, árboles 36k, bordillos 32k, arbustos 27k, rieles 27k, flores 24k, pasto 23k. Casi todo eran mallas de toda la pista dibujadas siempre, aunque solo se vea un tramo.

- **Partir en zonas (celdas) lo grande y estático** (`render/environment/chunking.ts`): terreno, carretera, bordillos, rieles, decoración, postes, las 8 capas de plantas y la decoración dispersa (`scenery`) se dividen en celdas cuadradas (160 m el terreno y las mallas largas; 48–160 m las plantas según la capa; 56 m los postes; 128 m la decoración). Las mallas partidas comparten los atributos de vértices y solo tienen su propio índice y su esfera, así que no cuesta memoria; las plantas e instancias se agrupan por celda. Three descarta las celdas fuera de la cámara (y fuera del mapa de sombras). No cambia nada de lo que se ve.
- **Distancia de dibujo de plantas por calidad** (`vegetationDrawScale`: Baja 0,7, Media 1, Alta sin límite; distancias base en `LAYER_DRAW_DISTANCE`: pasto y flores 60 m, helechos 90, arbustos 120, palmas 200, árboles 220, cipreses 260, siluetas lejanas siempre). Los postes de la cerca (110 m × escala) y el confeti (90 m × escala) también. Se aplica por celda cada cuadro con la posición del jugador.
- **Karts**: los bots fuera de la cámara o más allá de la distancia de dibujo no se dibujan (`render/racerCulling.ts`; el modelo con huesos no usa el recorte de three), y en Baja los bots no llevan contorno de tinta (`botOutlines`; el del jugador sí), con lo que se ahorran ~80k triángulos con la parrilla completa a la vista.
- **Uchuvas y cajas de poder** lejanas (110 m en Baja, 170 en Media) no se dibujan: eran ~60 _draw calls_ en San Andrés (`pickupDrawDistance`).
- Ya estaban antes: sin sombras de verdad en Baja (círculo bajo cada kart), 1024 en Media, 2048 en Alta; densidad de plantas 30/60/100 %; niebla más corta en Baja y Media (también acorta la distancia de dibujo de la cámara); _bloom_ solo en Media y Alta; pixel ratio de 1/1,5/2.

## Calidad automática y resolución dinámica

- **Calidad inicial** (`config/deviceQuality.ts`, `game/settings.ts`): mientras el jugador no elija una calidad (`qualityChosen` en los ajustes), se decide por el dispositivo: puntero táctil (`pointer: coarse`) → Baja; `deviceMemory` ≤ 2 GB o `hardwareConcurrency` ≤ 2 → Baja; ≤ 4 GB o ≤ 4 núcleos → Media; el resto o sin datos → Alta. Se vuelve a calcular en cada arranque hasta que elija una en Opciones; después se respeta siempre. Los ajustes guardados antes de este cambio cuentan como elegidos. Antes los celulares empezaban en Media.
- **Resolución dinámica** (`render/dynamicResolution.ts`, activa siempre; `?dynres=0` la apaga): si el tiempo de cuadro (suavizado) pasa de 33 ms durante 3 s, baja el pixel ratio de 0,25 en 0,25, nunca por debajo de 0,75; si se mantiene bajo 22 ms durante 6 s, lo sube de nuevo hasta el tope de la calidad elegida. Si una subida no aguanta (vuelve a bajar), la siguiente espera el doble (hasta 60 s) para no oscilar. No cuenta los cuadros en pausa ni de pestañas ocultas. Solo ajusta dentro de la calidad: nunca pasa del pixel ratio de esa calidad, y al cambiar de calidad vuelve a empezar desde su tope.
- Lógica pura con pruebas en `tests/deviceQuality.test.ts`, `tests/dynamicResolution.test.ts`, `tests/chunking.test.ts` y `tests/settings.test.ts`.

## Pendiente

- Medir en un celular real de gama media (FPS reales, temperatura y memoria): estas cifras son un proxy. Los umbrales de la resolución dinámica (33/22 ms) y las distancias de dibujo se ajustan con esa prueba.
- Los modelos de los karts siguen en ~11k triángulos cada uno; si Baja no alcanza, hace falta una versión simplificada (LOD) para los bots.
- Cajas de poder, uchuvas y objetos de `Mesh` sueltos aún son una llamada por objeto; se podrían pasar a instancias.
