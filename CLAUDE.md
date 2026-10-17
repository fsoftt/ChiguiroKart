# Instrucciones para Claude

## Ahorro de tokens

- Delega en subagentes con modelos más baratos siempre que la tarea lo permita:
  - **Haiku:** tareas mecánicas: correr `npm run check`, revisar CI, buscar en el código, formato, actualizar docs.
  - **Sonnet:** cambios de código bien definidos: arreglos, funciones acotadas, pruebas.
  - **Opus (sesión principal):** diseño, arquitectura y revisión del diff antes de subir.
- No hagas tú una tarea que un subagente más barato puede hacer, salvo que delegarla cueste más que hacerla.

## Ramas

- La rama principal es `main`. Los cambios terminados se suben a `main` (cada push publica en GitHub Pages).

## Antes de cada push

- `npm run check` debe pasar completo (lint, formato, pruebas y build).
- Si el cambio toca el juego, verifica que arranca en el navegador sin errores de consola (Playwright con Chromium en `/opt/pw-browsers`).
- Actualiza `docs/progreso.md` y, si cambia el estado de una etapa, el README. No marques una etapa como ✅ si no cumple lo de `docs/plan.md`.

## Contexto

- Estado y pendientes: `docs/progreso.md`. Plan por etapas: `docs/plan.md`. Diseño: `docs/diseno.md`.
- Estilo: TypeScript estricto, sin `any`, sin `;` (Prettier), comentarios en inglés en el código, docs en español.
