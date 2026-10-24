# Excursions amb nens

Recull d'excursions fetes en família. Web estàtica (HTML + JS, sense base de dades) publicada a GitHub Pages. Cada excursió és un fitxer YAML amb un track GPX opcional que es mostra en un mapa amb perfil d'elevació.

## Afegir una excursió

1. Copia la carpeta `excursions/_plantilla/` i reanomena-la `excursions/AAAA-MM-DD-lloc/` (per exemple `2026-11-15-montseny`).
2. Omple `excursio.yaml`. Els camps opcionals es poden esborrar.
3. Si tens el GPX (per exemple descarregat de Wikiloc), desa'l a la mateixa carpeta i indica'n el nom al camp `gpx`.
   - Si no poses `distancia_km` o `desnivell_m`, es calculen automàticament a partir del GPX.
4. Fes commit i push a `main`. L'Action de GitHub regenera l'índex i publica la web.

Les carpetes que comencen per `_` no surten al llistat.

### Camps principals

| Camp | Descripció |
|---|---|
| `titol`, `data` (AAAA-MM-DD), `lloc`, `comarca` | Identificació de l'excursió |
| `resum` | Frase curta per a la fitxa del llistat |
| `descripcio`, `notes` | Text lliure (paràgrafs separats per una línia en blanc) |
| `ruta` | Llista de punts de pas |
| `distancia_km`, `desnivell_m`, `durada`, `tipus`, `circular` | Dades de la ruta |
| `transport`, `punt_de_trobada`, `que_cal_portar`, `organitzador` | Informació pràctica |
| `edats` | Edats dels nens el dia de l'excursió, p. ex. `[4, 7]` (també admet text com `"18 mesos"`) |
| `gpx` | Nom del fitxer GPX dins la carpeta |
| `enllacos` | Llista de `{ titol, url }` |

## Provar-ho en local

```sh
node scripts/build-index.mjs   # genera excursions/index.json
python3 -m http.server 8000    # obre http://localhost:8000
```

(No n'hi ha prou amb obrir `index.html` directament: el navegador necessita un servidor per carregar els YAML.)

## Publicació a GitHub Pages (només la primera vegada)

1. Crea el repositori a GitHub i puja-hi el codi a la branca `main`.
2. A *Settings → Pages → Build and deployment → Source*, tria **GitHub Actions**.
3. Cada push a `main` executa `.github/workflows/pages.yml` i publica la web.

## Estructura

```
index.html, excursio.html   pàgines (llistat i fitxa)
assets/css/style.css        estils (mode clar/fosc)
assets/js/                  càrrega de dades, GPX, mapa i perfil
excursions/<id>/            excursio.yaml + track.gpx
scripts/build-index.mjs     genera excursions/index.json
```

Mapes: OpenTopoMap, ICGC i OpenStreetMap (amb [Leaflet](https://leafletjs.com)). YAML amb [js-yaml](https://github.com/nodeca/js-yaml).
