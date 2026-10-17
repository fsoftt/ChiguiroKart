# Chigüiro Kart — Plan de implementación

Plan por etapas. Cada etapa termina con algo jugable y publicado en GitHub Pages, para probarlo desde el navegador. El detalle del juego está en [diseno.md](diseno.md).

Cada etapa lista su objetivo, las tareas y los criterios para darla por terminada.

---

## Etapa 0 — Base del proyecto

**Objetivo:** proyecto vacío pero listo para crecer con orden.

- Crear proyecto Vite + TypeScript estricto + Three.js.
- Configurar ESLint, Prettier y Vitest.
- Crear la estructura de carpetas de `diseno.md` §10.3.
- GitHub Actions: en cada push a `main`, correr lint y pruebas, compilar y publicar en GitHub Pages.
- Página inicial con una escena 3D mínima (cubo girando) y contador de FPS en desarrollo.

**Terminada cuando:** el sitio se publica solo al hacer push y el pipeline falla si fallan lint o pruebas.

---

## Etapa 1 — Kart que se maneja bien

**Objetivo:** un kart en una pista de prueba que se sienta divertido de manejar.

- Bucle de juego con simulación a paso fijo (60 Hz) e interpolación en el render.
- Física arcade: aceleración, frenado, reversa, giro, agarre lateral, gravedad.
- Colisión contra el suelo y paredes de una pista de prueba simple.
- Cámara de persecución con suavizado y ajuste de FOV según la velocidad.
- Capa de entrada abstracta (`KartInput`) con teclado y mando.
- Valores de física en `config/`, ajustables en vivo con un panel de depuración (lil-gui).
- Pruebas de la física básica.

**Terminada cuando:** se maneja una vuelta completa sin atascos y con control preciso.

---

## Etapa 2 — Derrape, nitros y saltos

**Objetivo:** la mecánica central de CTR.

- Salto con `Espacio` y entrada al derrape al aterrizar mientras se gira.
- Máquina de estados del kart: conduciendo, en el aire, derrapando, con nitro.
- Barra de carga del derrape con zona roja.
- Cadena de hasta 3 nitros por derrape, cada uno más fuerte (+15 %, +25 %, +35 %).
- Ruptura de la cadena por mal tiempo, con humo negro.
- Nitro perfecto y reserva de turbo hasta 3 s.
- Turbo de salida en la cuenta regresiva y turbo de aterrizaje en saltos largos.
- Efectos básicos: humo de color por carga, llamas por nivel, líneas de velocidad.
- HUD mínimo: velocidad, barra de derrape, nivel de nitro.
- Pruebas de la cadena de nitros y de sus tiempos.

**Terminada cuando:** un jugador con práctica encadena 3 nitros de forma consistente y se nota la diferencia de cada nivel.

---

## Etapa 3 — Primera pista real: Valle de Cocora

**Objetivo:** el flujo de construcción de pistas y una carrera completa en solitario.

- Formato de pista por datos: _spline_, _checkpoints_, puntos de reaparición, línea de bots, cajas, uchuvas, superficies.
- Herramienta o script para exportar esos datos desde Blender (o editor simple en el navegador).
- Valle de Cocora con decoración provisional, superficies (asfalto, barro, pasto) y su atajo.
- Conteo de vueltas por _checkpoints_, validación de atajos y reaparición al caer.
- Cuenta regresiva, carrera de 3 vueltas, pantalla de resultados con tiempos.
- Minimapa.
- Modo Contrarreloj con fantasma guardado en el navegador.

**Terminada cuando:** se corre una carrera completa en Cocora, el atajo funciona y no se puede hacer trampa saltándose _checkpoints_.

---

## Etapa 4 — Bots

**Objetivo:** 8 karts en pista, 7 controlados por la IA.

- Bot que produce un `KartInput` siguiendo la línea de puntos con desviación aleatoria.
- Derrape y nitros según dificultad (fácil, normal, difícil).
- Uso de atajos con probabilidad por dificultad.
- Evitar paredes y otros karts.
- Ayuda de remontada configurable.
- Cálculo de posiciones en tiempo real y HUD de posición.
- Modo Carrera rápida contra 7 bots.

**Terminada cuando:** una carrera contra bots en dificultad normal es pareja para un jugador promedio.

---

## Etapa 5 — Poderes y uchuvas

**Objetivo:** el caos divertido.

- Uchuvas: recogida, velocidad extra por unidad, pérdida al ser golpeado, modo Bien Cargado con 10.
- Cajas de poder con reaparición, ruleta y reparto por posición.
- Sistema de poderes por datos, con versión normal y Bien Cargado.
- Primer grupo: coco bomba, mango maduro, panela turbo, escudo de armadillo, tejo con mecha, avispa teledirigida.
- Segundo grupo: colibrí del líder, nube de mosquitos, sombrero vueltiao, hormigas culonas, aguacero, Rayo del Catatumbo, Máscara del Carnaval.
- Estados del kart golpeado: girando, volando, mareado.
- Uso de poderes por los bots.
- Pruebas del reparto por posición y de cada efecto.

**Terminada cuando:** los 13 poderes funcionan, los usan jugador y bots, y ninguno rompe la carrera.

---

## Etapa 6 — Personajes y animaciones

**Objetivo:** que el juego se vea y se sienta como CTR con fauna colombiana.

- Pipeline de modelos glTF: personaje + kart, con esqueleto y animaciones de `diseno.md` §2.2.
- Primero 2 personajes completos (Chigüiro y Oso de anteojos) para validar el pipeline; luego los otros 6.
- Mezcla de animaciones según giro, derrape, nitro, aire y golpes.
- Animación procedural del kart: suspensión, _squash & stretch_, ruedas, inclinación.
- Atributos y _perks_ de cada personaje en `config/`.
- Pantalla de selección de personaje con estadísticas y animación de idle.
- Sombreado _toon_, contornos y _bloom_.
- Bailes de victoria y derrota en la pantalla de resultados.

**Terminada cuando:** los 8 personajes son jugables, se diferencian al manejar y tienen todas sus animaciones.

---

## Etapa 7 — Online: sala con código

**Objetivo:** jugar con amigos usando un código.

- Pantalla de nombre con validación y guardado en el navegador.
- Crear partida: genera código de 6 caracteres y link `?sala=CÓDIGO`, con botón de copiar y compartir.
- Unirse: campo para el código o entrada directa desde el link.
- Interfaz `Transport` con implementación sobre Trystero y otra en memoria para pruebas.
- Protocolo versionado: `hello`, `lobby`, `pick`, `start`, `input`, `snapshot`, `event`, `result`.
- Sala de espera: lista de jugadores, elección de personaje, listo / no listo, configuración del host.
- Host autoritativo: simula la carrera y los bots, envía _snapshots_ a 20 Hz.
- Clientes: envían entradas e interpolan el estado recibido.
- Bots en los cupos vacíos; un jugador que entra antes de la carrera reemplaza a un bot.
- Pruebas del protocolo con el transporte en memoria.

**Terminada cuando:** 8 navegadores en redes distintas corren una carrera completa con código de sala.

---

## Etapa 8 — Online robusto

**Objetivo:** que el online aguante redes reales.

- Predicción del propio kart y corrección con el _snapshot_ del host.
- Compensación de latencia para golpes y poderes.
- Servidor TURN para redes donde falla la conexión directa.
- Mensajes claros de error y reintento si no se logra conectar.
- Un bot toma el kart de quien se desconecta en carrera.
- Migración de host si el host se va.
- Indicador de latencia por jugador en la sala.
- Pruebas con latencia y pérdida de paquetes simuladas.

**Terminada cuando:** una carrera con 150 ms de latencia y 2 % de pérdida se siente jugable, y la salida del host no deja a todos colgados.

---

## Etapa 9 — Contenido completo

**Objetivo:** las 12 pistas y las 3 copas.

- Copa Andina: Valle de Cocora, Nevado del Ruiz, Catedral de Sal de Zipaquirá, Bogotá.
- Copa Caribe: Murallas de Cartagena, Ciudad Perdida, San Andrés, Carnaval de Barranquilla.
- Copa Selva y Llano: Caño Cristales, Llanos Orientales, Amazonas, Desierto de la Tatacoa.
- Atajos de cada pista y línea de bots para cada atajo.
- Elementos especiales: marea de San Andrés, carrozas en movimiento, estampida en los Llanos, hielo del Nevado.
- Modo Copa con puntos y podio.
- Copas también disponibles online.

**Terminada cuando:** las 12 pistas se corren completas, con atajos, contra bots y online.

---

## Etapa 9B — Modo historia

**Objetivo:** un modo de un jugador con historia, jefes y una copa final desbloqueable. Va antes del online.

- Modo historia para un jugador: se recorren las tres copas en orden, con escenas cortas entre carreras.
- Cada copa tiene un **jefe** en su última pista: un rival más fuerte, con presentación propia y una habilidad especial. Hay que ganarle para pasar a la siguiente copa.
- Al terminar las tres copas se desbloquea una **cuarta copa** con cuatro pistas del paisaje colombiano dañado por el capitalismo salvaje: campos de _fracking_, bosques incendiados, ríos contaminados por minería y deforestación.
- **Villano final:** un tigre malvado, jefe de la última pista de la cuarta copa. Lleva cadena de oro con un medallón del signo de pesos ($), anillos de oro en los dedos y un diente de oro.
- El progreso se guarda en el navegador (`localStorage`).

**Terminada cuando:** se puede jugar la historia de principio a fin, con los cuatro jefes y la copa final desbloqueable.

---

## Etapa 10 — Pulido

**Objetivo:** que se sienta como un juego terminado.

- Música por pista y efectos de sonido por personaje, motor, nitros y poderes.
- Efectos finales: polvo, agua, nieve y arena por superficie; marcas de llantas; sacudida de cámara; textos emergentes.
- Menús animados y transiciones.
- Controles táctiles para celular.
- Opciones: calidad gráfica, volumen, reasignar controles, idioma.
- Accesibilidad: modo para daltonismo en colores de nitro, reducir sacudidas de cámara.
- Optimización para cumplir las metas de rendimiento en celular.

**Terminada cuando:** el juego se ve y suena completo y corre a 30 FPS en un celular de gama media.

---

## Etapa 11 — Lanzamiento

**Objetivo:** publicar y aprender de los jugadores.

- Página de inicio con video corto y botón Jugar.
- Revisión final de licencias de todos los recursos.
- Recoger opiniones de los primeros jugadores y ajustar física, poderes y bots.
- Decidir con datos si hace falta migrar la red a Colyseus o agregar el modo Batalla y las pistas extra.

---

## Resumen

| Etapa | Resultado jugable              |
| ----- | ------------------------------ |
| 0     | Sitio que se publica solo      |
| 1     | Kart manejable                 |
| 2     | Derrape con cadena de 3 nitros |
| 3     | Carrera completa en Cocora     |
| 4     | Carrera contra 7 bots          |
| 5     | Poderes y uchuvas              |
| 6     | 8 personajes animados          |
| 7     | Online con código de sala      |
| 8     | Online estable                 |
| 9     | 12 pistas, 3 copas             |
| 9B    | Modo historia con jefes        |
| 10    | Juego pulido                   |
| 11    | Lanzamiento                    |
