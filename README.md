# Programări unghii — frontend

Aplicație web pentru programări la un salon de unghii: calendar cu orele libere, cont de clientă,
programările mele și panoul proprietarei (program de lucru, zile libere, programările zilei).

**Demo:** https://tufanionut.github.io/programari-unghii/

> Versiunea de pe GitHub Pages e un **demo fără server**: zilele, programările și conturile sunt simulate
> în browser și rămân doar pe dispozitivul tău (butonul „Resetează” le șterge). Pe pagina de login,
> „Intră ca admin (demo)” deschide panoul proprietarei.

## Tehnologii

React 19 + TypeScript + Vite, React Router. Paleta: roz pudrat `#E8C4C4`, prună `#6B3F52`, ivoriu `#FBF7F3`.

## Rulare

```bash
npm install
npm run dev          # cu backend-ul .NET pornit pe http://localhost:5228 (proxy pe /api)
npm run build:pages  # versiunea demo pentru GitHub Pages (date simulate, în dist/)
```

Publicarea pe Pages se face automat la fiecare push pe `main` (`.github/workflows/deploy-pages.yml`).
