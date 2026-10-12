# Chigüiro Kart — Documento de diseño

Juego de carreras de karts en 3D inspirado en _Crash Team Racing_ (CTR), protagonizado por animales colombianos y ambientado en paisajes de Colombia. Corre en el navegador (JavaScript/TypeScript), se publica en GitHub Pages y permite partidas online de hasta 8 jugadores mediante un código de sala, con bots que completan los cupos vacíos.

> Los valores numéricos de este documento son puntos de partida para ajustar con pruebas de juego, no especificaciones cerradas.

---

## 1. Pilares

1. **Sensación de CTR.** Derrape con cadena de 3 nitros, saltos con turbo, atajos arriesgados y poderes caóticos. Fácil de aprender, con techo de habilidad alto.
2. **Colombia con cariño.** Animales, paisajes, música, comida y expresiones colombianas, con humor y sin caricaturas ofensivas.
3. **Online sin fricción.** Crear partida, compartir código, jugar. Sin cuentas ni instalaciones.
4. **Siempre 8 en pista.** Si faltan jugadores, los bots llenan la parrilla.
5. **Código limpio.** Simulación separada del render, contenido definido por datos, módulos pequeños y probados.

---

## 2. Estética

### 2.1 Dirección visual

- Estilo caricaturesco como CTR: colores saturados, formas redondeadas y exageradas, karts con personalidad propia de cada animal.
- Modelos _low-poly_ estilizados con sombreado _toon_ (`MeshToonMaterial`) y contorno por casco invertido.
- Cielos con degradado, niebla de color por pista y _bloom_ suave en nitros, poderes y luces.
- Cada pista tiene una paleta propia (por ejemplo, Caño Cristales en rojos y verdes, Nevado en blancos y azules).

### 2.2 Animaciones de personajes (esqueléticas, glTF)

| Animación                | Cuándo                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| Idle                     | Parrilla de salida, menús. Respira, mira a los lados, tic propio del animal. |
| Giro izquierda / derecha | Se inclina con el volante, mezcla según el ángulo de giro.                   |
| Derrape                  | Cuerpo inclinado hacia afuera, expresión concentrada.                        |
| Nitro                    | Se echa hacia atrás, orejas o plumas al viento.                              |
| Salto / aire             | Brazos arriba, sorpresa. Truco opcional en saltos largos.                    |
| Golpeado                 | Vuelta en el aire, mareo con estrellitas o pajaritos.                        |
| Usar poder               | Lanza hacia adelante o hacia atrás.                                          |
| Victoria / derrota       | Baile propio (cumbia, champeta, joropo) o berrinche.                         |

### 2.3 Animación procedural del kart

- Suspensión con resortes: el chasis hace _squash & stretch_ al aterrizar, frenar y acelerar.
- Ruedas que giran según la velocidad y se orientan con la dirección.
- Inclinación del chasis en curvas y derrapes.
- Rebote exagerado al chocar con paredes.

### 2.4 Efectos

- **Humo del derrape** que cambia de color según la carga del nitro (gris → amarillo → naranja → azul).
- **Llamas del escape** por nivel de nitro: nivel 1 amarillas, nivel 2 naranjas, nivel 3 azules con chispas.
- **Líneas de velocidad** en pantalla y aumento de FOV de cámara con cada nitro.
- **Polvo, agua, barro, nieve o arena** según la superficie, con marcas de llantas.
- **Sacudida de cámara** en golpes, explosiones y aterrizajes fuertes.
- **Partículas instanciadas** para uchuvas recogidas, cajas rotas y explosiones.
- **Texto emergente** estilo cómic: "¡Totazo!", "¡Uy, no!", "¡Qué pique!".

### 2.5 Interfaz

- Tipografía gruesa y redondeada, botones grandes con rebote al pasar el cursor.
- HUD: posición grande, vuelta actual, contador de uchuvas, casilla de poder con ruleta, barra de carga del derrape y minimapa.
- Menús con fondo animado del personaje elegido.

### 2.6 Audio

- Música por pista con ritmos colombianos: cumbia, vallenato, joropo, champeta, salsa, currulao, bambuco.
- Voces cortas por personaje (gruñido del oso, chillido del tití, rugido del jaguar).
- Motor con tono que sube con la velocidad; sonido distinto por nivel de nitro.

---

## 3. Personajes

Cuatro atributos de 1 a 5: velocidad máxima, aceleración, manejo y peso. Cada personaje tiene además un _perk_ pasivo.

| Personaje           | Vel. | Acel. | Manejo | Peso | Perk                                                                              |
| ------------------- | ---- | ----- | ------ | ---- | --------------------------------------------------------------------------------- |
| **Chigüiro**        | 3    | 3     | 3      | 3    | **Tranquilo:** se recupera de golpes un 30 % más rápido.                          |
| **Oso de anteojos** | 4    | 2     | 2      | 5    | **Aplanadora:** empuja a los rivales al chocar y resiste mejor los empujones.     |
| **Tití**            | 2    | 5     | 4      | 1    | **Ágil:** carga el derrape más rápido.                                            |
| **Cóndor**          | 3    | 3     | 3      | 2    | **Planeo:** más tiempo en el aire y control en saltos; turbo de aterrizaje mayor. |
| **Jaguar**          | 5    | 3     | 2      | 3    | **Depredador:** gana velocidad extra al ir detrás de un rival (rebufo).           |
| **Guacamaya**       | 3    | 4     | 3      | 2    | **Coleccionista:** los poderes de sus cajas duran un 25 % más.                    |
| **Delfín rosado**   | 3    | 3     | 4      | 3    | **Anfibio:** sin penalización en agua y barro.                                    |
| **Perezoso**        | 2    | 2     | 4      | 3    | **Calma total:** nitros más largos; su tercer nitro dura el doble.                |

---

## 4. Conducción

### 4.1 Controles

| Acción                | Teclado              | Mando           | Táctil                |
| --------------------- | -------------------- | --------------- | --------------------- |
| Acelerar              | `W` / `↑`            | A / Cruz        | Automático o botón    |
| Frenar / reversa      | `S` / `↓`            | B / Círculo     | Botón                 |
| Girar                 | `A` `D` / `←` `→`    | Stick izquierdo | Inclinación o botones |
| Saltar / derrapar     | `Espacio` (mantener) | R1              | Botón                 |
| Nitro durante derrape | `Shift`              | L1              | Botón                 |
| Usar poder            | `E`                  | X / Cuadrado    | Botón                 |
| Mirar atrás           | `Q`                  | Y / Triángulo   | —                     |

Los controles se definen en una capa de entrada abstracta, así que se pueden reasignar.

### 4.2 Física arcade

- El kart no usa un motor de física realista. Se mueve con un modelo arcade propio: velocidad, dirección, agarre lateral y gravedad, con colisiones contra el _collider_ de la pista.
- La simulación corre a paso fijo (60 Hz), independiente de los FPS del render.
- Cada superficie define agarre y fricción: asfalto, tierra, pasto, barro, agua, hielo, arena.

### 4.3 Derrape y cadena de 3 nitros

Es la mecánica central, igual que en CTR:

1. El jugador salta (`Espacio`) mientras gira y, al aterrizar, mantiene el botón: entra en derrape.
2. Durante el derrape, una **barra de carga** se llena y el humo del escape cambia de color.
3. Cuando la barra llega a la **zona roja**, el jugador presiona `Shift` para soltar un nitro.
4. Se pueden encadenar **hasta 3 nitros por derrape**, y cada uno es más fuerte que el anterior.
5. Presionar `Shift` fuera de la zona roja, o esperar demasiado, **rompe la cadena**: el kart echa humo negro y pierde el resto de nitros de ese derrape.

| Nitro | Velocidad extra | Duración | Color del escape |
| ----- | --------------- | -------- | ---------------- |
| 1     | +15 %           | 0,8 s    | Amarillo         |
| 2     | +25 %           | 1,0 s    | Naranja          |
| 3     | +35 %           | 1,2 s    | Azul             |

- **Nitro perfecto:** presionar justo al inicio de la zona roja agrega +5 % y un destello en pantalla.
- **Reserva de turbo:** si se encadenan nitros sin soltar velocidad, la duración sobrante se acumula hasta un máximo de 3 s, como en CTR.
- La barra se carga más rápido con el Tití y los nitros duran más con el Perezoso.

### 4.4 Otros turbos

- **Turbo de salida:** acelerar justo cuando la cuenta regresiva marca "¡Ya!". Muy temprano = el motor se ahoga 1 s.
- **Turbo de salto:** saltos largos desde rampas dan un nitro al aterrizar, proporcional al tiempo en el aire.
- **Turbo de pista:** franjas de aceleración en el suelo.

### 4.5 Uchuvas (equivalente a las frutas Wumpa)

- Hay uchuvas repartidas por la pista y dentro de algunas cajas.
- Cada uchuva sube un poco la velocidad máxima, hasta 10.
- Con **10 uchuvas** el kart entra en **modo Bien Cargado**: los poderes salen en su versión mejorada.
- Los golpes hacen perder uchuvas.

---

## 5. Poderes

Se obtienen al romper cajas en la pista. La ruleta da poderes según la posición: los primeros reciben poderes defensivos y los últimos, poderes que ayudan a remontar.

Cada poder tiene versión normal y versión **Bien Cargado** (con 10 uchuvas).

| Poder                    | Efecto                                                                                              | Bien Cargado                          |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Coco bomba**           | Se lanza hacia adelante o atrás y explota al contacto o al pasar 3 s.                               | Explosión más grande.                 |
| **Tejo con mecha**       | Trampa que se deja en la pista; explota cuando alguien la pisa, como la mecha en el juego del tejo. | Dos tejos.                            |
| **Mango maduro**         | Cáscara resbalosa que hace girar al que la pisa.                                                    | Tres mangos.                          |
| **Panela turbo**         | Nitro instantáneo de nivel 2.                                                                       | Nitro de nivel 3.                     |
| **Escudo de armadillo**  | Protege de un golpe; se puede lanzar hacia adelante.                                                | Dura hasta recibir 2 golpes.          |
| **Avispa teledirigida**  | Persigue al rival de adelante.                                                                      | Persigue y además roba 3 uchuvas.     |
| **Colibrí del líder**    | Vuela directo al primer puesto y lo detiene.                                                        | Detiene a los dos primeros.           |
| **Nube de mosquitos**    | Tapa la pantalla de los rivales de adelante por 2 s.                                                | 3 s y los hace zigzaguear.            |
| **Sombrero vueltiao**    | Bumerán que va hacia adelante y regresa, golpeando a quien toque.                                   | Hace dos vueltas.                     |
| **Hormigas culonas**     | Enjambre que se le pega al rival más cercano y le roba uchuvas.                                     | Roba el doble.                        |
| **Aguacero**             | Nube sobre los rivales de adelante que les quita agarre por 3 s.                                    | También los frena.                    |
| **Rayo del Catatumbo**   | Golpea a todos los rivales que van adelante.                                                        | Además les quita el poder que tenían. |
| **Máscara del Carnaval** | Invencibilidad, velocidad extra y derriba a quien toque por 6 s, como la máscara Aku Aku.           | 8 s.                                  |

**Reparto sugerido por posición:**

| Posición  | Poderes más probables                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| 1.º – 2.º | Mango maduro, tejo con mecha, escudo de armadillo, coco bomba                            |
| 3.º – 5.º | Coco bomba, avispa teledirigida, sombrero vueltiao, panela turbo, hormigas culonas       |
| 6.º – 8.º | Colibrí del líder, aguacero, nube de mosquitos, Rayo del Catatumbo, Máscara del Carnaval |

---

## 6. Pistas

Doce pistas en tres copas de cuatro. Cada pista tiene al menos un **atajo**: más corto, pero con riesgo o con requisitos de habilidad.

### Copa Andina

| Pista                                  | Ambiente                                                       | Atajos                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Valle de Cocora**                    | Palmas de cera gigantes, neblina, puentes colgantes de madera. | Salto entre dos palmas caídas con turbo; sendero de barro que corta una curva larga.                               |
| **Nevado del Ruiz**                    | Hielo, nieve, fumarolas del volcán.                            | Lago congelado que corta una horquilla (muy poco agarre); túnel de hielo que solo se abre con un nitro de nivel 3. |
| **Catedral de Sal de Zipaquirá**       | Túneles subterráneos de sal con luces de colores.              | Pasaje estrecho entre columnas de sal; caída a un nivel inferior que ahorra media vuelta.                          |
| **Bogotá: La Candelaria y Monserrate** | Calles empedradas, grafitis, subida en zigzag a Monserrate.    | Callejón por dentro de una casa colonial; salto desde el teleférico.                                               |

### Copa Caribe

| Pista                        | Ambiente                                                           | Atajos                                                                               |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Murallas de Cartagena**    | Murallas, cañones, balcones con flores, atardecer.                 | Carrera por encima de la muralla; rampa con un cañón que lanza el kart.              |
| **Ciudad Perdida**           | Selva de la Sierra Nevada, terrazas de piedra, escaleras antiguas. | Escalinatas de piedra (salto en cadena); cascada que se cruza por detrás.            |
| **San Andrés**               | Mar de siete colores, playas, palmeras.                            | Banco de arena que solo aparece cuando baja la marea en ciertas vueltas.             |
| **Carnaval de Barranquilla** | Desfile, carrozas, papelillo, marimondas.                          | Pasar por dentro de una carroza en movimiento; tramo de confeti que oculta un turbo. |

### Copa Selva y Llano

| Pista                      | Ambiente                                          | Atajos                                                                                       |
| -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Caño Cristales**         | Río de cinco colores, rocas, plantas rojas.       | Cruce por el río sobre piedras (el Delfín rosado no pierde velocidad).                       |
| **Llanos Orientales**      | Llanura, ganado, atardecer naranja, morichales.   | Campo abierto con barro que corta una curva enorme; estampida de vacas que hay que esquivar. |
| **Amazonas**               | Selva espesa, río ancho, raíces gigantes.         | Rampa sobre un tronco hacia el otro lado del río; túnel por dentro de una ceiba.             |
| **Desierto de la Tatacoa** | Cañones rojos y grises, cactus, cielo estrellado. | Salto sobre un cañón que necesita turbo; laberinto de cárcavas con dos salidas.              |

**Pistas extra para más adelante:** Guatapé y la Piedra del Peñol, Pacífico chocoano con ballenas, Feria de las Flores en Medellín con Metrocable, Eje Cafetero entre cafetales.

### Diseño de pistas

- Cada pista se define como una curva (_spline_) más piezas decorativas, con _checkpoints_, puntos de reaparición y la línea de puntos que siguen los bots.
- Las vueltas se cuentan por _checkpoints_ en orden, así que un atajo es válido solo si pasa por los _checkpoints_ obligatorios.
- Los atajos tienen su propia línea para los bots, que la toman según su dificultad.

---

## 7. Modos de juego

1. **Carrera rápida:** una pista contra 7 bots.
2. **Copa:** cuatro pistas seguidas con puntos acumulados.
3. **Contrarreloj:** solo, contra el fantasma del mejor tiempo guardado en el navegador.
4. **Online:** sala con código, hasta 8 jugadores, bots en los cupos vacíos.
5. **Batalla** (futuro): arenas cerradas, 3 vidas, solo poderes.

---

## 8. Online

### 8.1 Flujo del jugador

1. Al entrar al juego, el jugador escribe su **nombre**. Se guarda en el navegador para la próxima vez.
2. Elige **Crear partida** o **Unirse**.
3. **Crear partida:** el juego genera un código de 6 caracteres, por ejemplo `CHG7K2`, y muestra también un link para compartir: `https://<usuario>.github.io/ChiguiroKart/?sala=CHG7K2`.
4. **Unirse:** escribe el código o abre el link.
5. En la **sala de espera** todos ven la lista de jugadores con su nombre y personaje. Cada uno elige su personaje; el host elige pista o copa, número de vueltas y dificultad de los bots.
6. El host inicia la carrera. Los cupos vacíos hasta 8 se llenan con bots.

### 8.2 Reglas del nombre

- Entre 2 y 16 caracteres; se permiten letras con tildes, `ñ`, números y espacios.
- Se recortan los espacios de los extremos y se escapa al mostrarlo (nunca se inserta como HTML).
- Si dos jugadores tienen el mismo nombre en la sala, el segundo recibe un sufijo: `Pepe (2)`.

### 8.3 Código de sala

- 6 caracteres del alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, sin `0`, `O`, `1`, `I`, `L`, para evitar confusiones.
- El código se usa como nombre de sala en Trystero:

```ts
import { joinRoom } from 'trystero/mqtt'

const room = joinRoom({ appId: 'chiguiro-kart' }, roomCode)
```

### 8.4 Arquitectura de red

- **Topología en estrella:** el creador de la sala es el **host autoritativo**. Los demás se conectan a él por WebRTC.
- **Host:** simula la carrera completa a 60 Hz, incluidos los bots, y envía _snapshots_ del estado a 20 Hz.
- **Clientes:** envían solo sus entradas (acelerar, girar, derrapar, nitro, poder) con número de _tick_.
- **Su propio kart:** el cliente lo predice localmente y corrige con el _snapshot_ del host (_reconciliation_).
- **Karts ajenos:** se interpolan unos 100 ms atrás para que se muevan suave.
- **Eventos importantes** (golpes, poderes, cruce de meta) los decide solo el host.

### 8.5 Mensajes

| Mensaje    | Dirección      | Contenido                                                 |
| ---------- | -------------- | --------------------------------------------------------- |
| `hello`    | Cliente → host | Nombre, versión del juego                                 |
| `lobby`    | Host → todos   | Jugadores, personajes, pista, configuración               |
| `pick`     | Cliente → host | Personaje elegido, listo / no listo                       |
| `start`    | Host → todos   | Pista, orden de salida, semilla aleatoria, hora de inicio |
| `input`    | Cliente → host | _Tick_ y entradas                                         |
| `snapshot` | Host → todos   | _Tick_, estado de cada kart, poderes activos              |
| `event`    | Host → todos   | Golpes, poderes usados, vueltas, meta                     |
| `result`   | Host → todos   | Clasificación final y tiempos                             |

Todos los mensajes llevan versión del protocolo; el host rechaza clientes con otra versión.

### 8.6 Bots y entradas/salidas

- Al iniciar, los cupos vacíos se llenan con bots con nombres de animales: "Chigüiro Bot", etc.
- Si alguien entra a la sala antes de la carrera, reemplaza a un bot.
- Si un jugador se desconecta en carrera, un bot toma su kart con su posición.
- **Migración de host:** si el host se va, el jugador que lleva más tiempo en la sala toma el rol, usando el último _snapshot_. Si falla, la carrera termina con la clasificación actual.

### 8.7 Conectividad

- Las conexiones WebRTC directas fallan en algunas redes. Para esos casos se configura un servidor TURN (plan gratuito de Cloudflare o metered.ca).
- Si un jugador no logra conectarse en 15 s, se le muestra un mensaje claro y la opción de reintentar.
- Si el juego crece y necesita emparejamiento automático o protección contra trampas, la red se puede migrar a un servidor Colyseus sin cambiar el cliente de juego, gracias a la capa de transporte abstracta.

---

## 9. Bots

- Siguen la línea de puntos de la pista con una desviación aleatoria pequeña.
- Derrapan en curvas marcadas y encadenan nitros según su dificultad (fácil: 1 nitro y a veces fallan; difícil: 3 nitros casi siempre).
- Toman atajos según dificultad y probabilidad.
- Usan poderes con reglas simples: defensivos si llevan a alguien cerca detrás, ofensivos si tienen a alguien cerca adelante.
- **Ayuda de remontada:** los bots que van muy atrás aceleran un poco; los que van muy adelante se frenan un poco. Configurable por el host.

---

## 10. Arquitectura técnica

### 10.1 Tecnologías

| Área       | Elección                                                   |
| ---------- | ---------------------------------------------------------- |
| Lenguaje   | TypeScript en modo estricto                                |
| Build      | Vite                                                       |
| Render 3D  | Three.js                                                   |
| Red        | Trystero (WebRTC, signaling vía MQTT público)              |
| Pruebas    | Vitest                                                     |
| Calidad    | ESLint + Prettier                                          |
| Despliegue | GitHub Actions → GitHub Pages                              |
| Modelos    | glTF/GLB creados en Blender, comprimidos con Draco/Meshopt |
| Audio      | Web Audio API (Howler.js opcional)                         |

### 10.2 Principios de código limpio

- **Simulación separada del render.** `sim/` no importa nada de Three.js ni del DOM; recibe entradas y devuelve estado. Así se prueba sin navegador y la usan el host, los clientes y los bots por igual.
- **Paso fijo.** La simulación avanza en _ticks_ de 1/60 s; el render interpola entre los dos últimos estados.
- **Contenido por datos.** Personajes, poderes, pistas y superficies se definen en archivos de configuración tipados, no en código.
- **Máquinas de estados explícitas** para el kart (conduciendo, derrapando, en el aire, golpeado, reapareciendo) y para el juego (menú, sala, cuenta regresiva, carrera, resultados).
- **Entrada abstracta.** Teclado, mando, táctil y bot producen el mismo objeto `KartInput`.
- **Transporte abstracto.** La red usa una interfaz `Transport`, con una implementación sobre Trystero y otra en memoria para pruebas.
- **Funciones pequeñas, nombres claros, sin números mágicos** (todo valor ajustable vive en configuración).
- **Pruebas** de física, cadena de nitros, conteo de vueltas, reparto de poderes, código de sala y validación de nombres.

### 10.3 Estructura de carpetas

```
ChiguiroKart/
├─ docs/
├─ public/
│  ├─ models/        # personajes, karts, pistas (glb)
│  ├─ textures/
│  └─ audio/
├─ src/
│  ├─ main.ts
│  ├─ config/        # personajes, poderes, pistas, física
│  ├─ sim/           # simulación pura (sin Three.js)
│  │  ├─ kart/       # física, derrape, nitros, estados
│  │  ├─ items/      # poderes y uchuvas
│  │  ├─ race/       # vueltas, posiciones, checkpoints
│  │  └─ world.ts
│  ├─ ai/            # bots
│  ├─ net/           # transporte, sala, protocolo, sincronización
│  ├─ input/         # teclado, mando, táctil
│  ├─ render/        # escena, cámara, materiales, efectos, animaciones
│  ├─ audio/
│  ├─ ui/            # menús, sala de espera, HUD
│  └─ game/          # máquina de estados del juego
└─ tests/
```

### 10.4 Rendimiento

- Meta: 60 FPS en escritorio y 30 FPS o más en celulares de gama media.
- Instanciación para vegetación, uchuvas y partículas.
- Niveles de detalle (LOD) para karts lejanos.
- Calidad gráfica ajustable: sombras, _bloom_, distancia de dibujo, resolución.
- Presupuesto inicial: menos de 150 _draw calls_ por cuadro y descarga inicial menor de 15 MB.

### 10.5 Arte y riesgos

- El arte 3D animado es el mayor costo del proyecto. Para avanzar sin bloquear, las primeras etapas usan modelos provisionales (por ejemplo, de Kenney, licencia CC0) y se reemplazan después.
- No se usan personajes, nombres ni recursos de _Crash Team Racing_: el juego toma la inspiración de mecánicas y estilo, con identidad propia.
