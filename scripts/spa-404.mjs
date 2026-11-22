// GitHub Pages nu știe de rutele aplicației (/profil, /admin…): la reîncărcarea unei astfel
// de pagini întoarce 404.html. Copia lui index.html face ca aplicația să pornească oricum,
// iar React Router afișează pagina corectă.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('dist/404.html creat')
