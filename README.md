# Chigüiro Kart

Juego de karts en 3D estilo _Crash Team Racing_ con animales colombianos. Corre en el navegador y se publica en GitHub Pages.

**Jugar:** https://fsoftt.github.io/ChiguiroKart/

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
| `npm run test`    | Pruebas con Vitest                |
| `npm run lint`    | ESLint                            |
| `npm run format`  | Formatea con Prettier             |
| `npm run check`   | Todo lo anterior, igual que en CI |

Cada push a `main` corre las verificaciones y publica el sitio en GitHub Pages.

## Documentación

- [Diseño del juego](docs/diseno.md)
- [Plan de implementación](docs/plan.md)
- [Progreso](docs/progreso.md)
