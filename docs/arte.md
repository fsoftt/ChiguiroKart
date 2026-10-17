# Guía de arte

Referencia visual: _Crash Team Racing Nitro-Fueled_ (2019). Tomamos el nivel de acabado y el estilo caricaturesco, no sus personajes ni recursos (ver `diseno.md` §10.5). El juego debe verse llamativo, moderno y lleno de detalle.

## Personajes

- **Forma aprobada y congelada:** el Chigüiro (2026-10-17) tiene la forma que aprobó el dueño del proyecto. No se cambia su geometría, proporciones ni piezas; solo se pueden ajustar colores, sombreado e iluminación. Cada personaje que se apruebe se agrega aquí.
- **Proporciones de caricatura:** cabeza grande (como la del Chigüiro aprobado), cuerpo pequeño, manos y pies grandes. La silueta debe reconocerse a 30 m.
- **Cara simple y suave:** la referencia es el Chigüiro aprobado. Cabeza de una sola forma redonda, ojos pequeños a medianos (esclerótica blanca, pupila oscura y un brillo) que sobresalen poco, y marcas del animal **pintadas** en la superficie (anteojos del oso, manchas del jaguar), no en relieve. Pocas piezas: nada de cejas esculpidas, párpados salientes en reposo ni crestas; los párpados y la boca solo aparecen en las expresiones (golpe, victoria, derrota).
- **Formas suaves:** nada de cajas visibles. Esferas, cápsulas y tornos con suficientes segmentos, uniones que se solapan y piezas con bisel. Pelo y plumas sugeridos con mechones (no texturas realistas).
- **Material:** _toon_ de 3 tonos más luz de borde (_rim light_) y contorno fino. Colores saturados con variación (vientre más claro, puntas más oscuras).
- **Karts:** carrocería curva con personalidad del animal (no un chasis de cajas): guardabarros redondeados, escape cromado, número y calcomanías, volante y asiento visibles. Cada kart con color y forma propios.
- **Presupuesto:** hasta ~12 000 triángulos por piloto con kart en calidad Alta; los karts lejanos usan menos detalle.

## Pistas

- **Terreno esculpido:** nada de planos infinitos. Colinas, barrancos, montañas al fondo y bordes que encierran la pista; el suelo con variación de color (pasto, tierra, rocas).
- **Superficie de la pista:** asfalto o tierra con textura, bordillos, marcas, parches y transición suave al terreno. Las zonas de barro, arena, hielo y agua se ven distintas.
- **Vegetación densa:** cientos o miles de plantas instanciadas, con variación de tamaño, color y rotación, y vaivén con el viento. Capas: pasto alto y flores junto a la pista, arbustos, árboles, y siluetas lejanas.
- **Decoración:** vallas con pancartas, banderines, arcos de salida y meta, público, letreros con flechas en curvas, y objetos del lugar (palmas de cera, chivas, murallas coloniales, cafetales, malocas, etc.).
- **Atmósfera:** sombras en tiempo real, niebla de profundidad con el color de la pista, cielo con nubes, agua animada con reflejos y espuma, partículas ambientales (hojas, polvo, nieve).
- **Trazado:** curvas cerradas, desniveles, túneles, puentes y caminos a varias alturas, con atajos visibles pero arriesgados. Lo plano y ancho es la excepción.

## Iluminación y cámara

- Mapeo de tono ACES, colores saturados sin quemarse, luz de sol cálida con sombras y luz ambiental del color del cielo.
- _Bloom_ suave en nitros, poderes y luces.

## Calidad escalable

| Calidad | Sombras               | Vegetación | Detalle lejano | Efectos    |
| ------- | --------------------- | ---------- | -------------- | ---------- |
| Alta    | Mapa 2048, suaves     | 100 %      | Lejos          | Todos      |
| Media   | Mapa 1024             | 60 %       | Medio          | La mayoría |
| Baja    | Sin sombras o en blob | 30 %       | Cerca          | Básicos    |

Meta: 60 FPS en escritorio con Alta y 30 FPS en celular de gama media con Baja o Media.

## Recursos externos

- Solo licencia **CC0** (por ejemplo Quaternius o Kenney). Cada recurso se registra en `public/models/CREDITOS.md` con su origen y licencia.
- Los modelos externos se usan para vegetación, rocas y objetos; los personajes son propios y respetan el contrato de `render/characters/rig.ts`, para que un artista los pueda reemplazar archivo por archivo con modelos de Blender.
