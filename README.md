# Chigüiro Kart

Juego de karts en 3D estilo _Crash Team Racing_ con animales colombianos. Corre en el navegador y se publica en GitHub Pages.

**Jugar:** https://fsoftt.github.io/ChiguiroKart/

> En desarrollo. Ya se puede correr una carrera completa de 3 vueltas en el Valle de Cocora contra 7 bots, con poderes y 8 personajes jugables. Mira el [progreso](docs/progreso.md).

## Estado actual

| Etapa                                   | Estado     |
| --------------------------------------- | ---------- |
| 0 — Base del proyecto                   | ✅         |
| 1 — Kart que se maneja bien             | ✅         |
| 2 — Derrape, nitros y saltos            | ✅         |
| 3 — Primera pista real: Valle de Cocora | ✅         |
| 4 — Bots                                | En curso   |
| 5 — Poderes y uchuvas                   | En curso   |
| 6 — Personajes y animaciones            | En curso   |
| 9 — Contenido completo                  | En curso   |
| 10 — Pulido                             | En curso   |
| 7, 8 y 11                               | Pendientes |

## Controles

| Acción            | Teclado           | Mando                 |
| ----------------- | ----------------- | --------------------- |
| Acelerar          | `W` / `↑`         | A o gatillo derecho   |
| Frenar / reversa  | `S` / `↓`         | B o gatillo izquierdo |
| Girar             | `A` `D` / `←` `→` | Stick izquierdo       |
| Saltar y derrapar | `Espacio`         | Bumper derecho        |
| Nitro             | `Shift`           | Bumper izquierdo      |
| Usar poder        | `E`               | X                     |
| Mirar atrás       | `Q`               | Y                     |
| Reiniciar kart    | `R`               | —                     |

Para derrapar, salta con `Espacio` y sigue girando al aterrizar. Mantén pulsado y carga la barra hasta la zona roja; cada `Shift` dentro de esa zona encadena un nitro más fuerte hasta tres. Pulsar antes de la zona roja o dejar la barra llena demasiado tiempo rompe la cadena.

En celulares y tablets aparecen controles táctiles en pantalla durante la carrera (nunca en una computadora con ratón): una barra deslizable a la izquierda para girar (el dedo a izquierda o derecha del centro gira hacia ese lado) y a la derecha los botones Acelerar, Frenar, Saltar (se mantiene para derrapar), Nitro, Poder y Atrás (mirar atrás). Se pueden usar varios dedos a la vez y se combinan con teclado y mando.

Con un poder en la ranura, `E` (o el botón X del mando) lo usa; mantener `Q` (o Y) mientras lo usas lo lanza hacia atrás.

## Panel de depuración

En desarrollo, o agregando `?debug` a la URL (por ejemplo `https://fsoftt.github.io/ChiguiroKart/?debug`), aparece un panel para ajustar en vivo la física del kart y la cámara, con contador de FPS.

## Editor de pistas

Hay un editor de pistas en el navegador en [`editor.html`](https://fsoftt.github.io/ChiguiroKart/editor.html) (en desarrollo: `npm run dev` y abre `/ChiguiroKart/editor.html`). Permite mover y agregar puntos de control, ajustar altura y superficie, editar atajos, checkpoints y recogibles, importar y exportar JSON, y probar la pista con el botón "Probar en el juego" (`?pista=custom`).

## Personajes

Hay 8 pilotos, cada uno con 4 atributos (velocidad, aceleración, manejo y peso) y una habilidad pasiva; se eligen en el menú o con `?personaje=chiguiro|oso|titi|condor|jaguar|guacamaya|delfin|perezoso`. La [galería de personajes](https://fsoftt.github.io/ChiguiroKart/characters.html) muestra cada modelo con sus animaciones.

Los modelos son archivos glTF en `public/models/`, generados con `npm run models` a partir de `src/render/characters/`. Cualquier modelo con los huesos y animaciones de `src/render/characters/rig.ts` (por ejemplo, uno hecho en Blender) puede reemplazarlos sin cambiar código.

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
| `npm run models`  | Regenera los modelos `.glb`       |
| `npm run test`    | Pruebas con Vitest                |
| `npm run lint`    | ESLint                            |
| `npm run format`  | Formatea con Prettier             |
| `npm run check`   | Todo lo anterior, igual que en CI |

Cada push a `main` corre las verificaciones y publica el sitio en GitHub Pages.

## Arquitectura

- `src/sim/` — simulación pura a 60 Hz (física, pista, colisiones). No depende de Three.js ni del DOM, así que se prueba sin navegador y la podrán usar el host online y los bots.
- `src/render/` — escena Three.js: pista, kart, cámara. Interpola entre pasos de simulación.
- `src/input/` — teclado y mando producen el mismo `KartInput`.
- `src/ai/` — bots: siguen la línea de la pista, derrapan, toman atajos y se ayudan con la remontada. `?dificultad=facil|normal|dificil` y `?remontada=0` en la URL fijan los valores por defecto del menú de Carrera rápida.
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
