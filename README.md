# Etnico Genova

Una mappa dei ristoranti etnici di Genova.

Il sito mostra la città su una mappa e, per ogni ristorante, un pallino colorato in base al tipo di cucina. Toccando un pallino si apre una scheda con nome, cucina, indirizzo, note e sito web. Si può filtrare per cucina e consultare l'elenco completo dei ristoranti visibili.

I ristoranti nello stesso indirizzo (per esempio dentro un mercato) condividono un unico pallino, diviso nei colori delle loro cucine, e la scheda li elenca tutti.

## Cosa non include

Il progetto non comprende:

- sushi
- ristoranti fusion
- catene

## Come funziona

Il sito è statico: non c'è un server né un database. Tutti i ristoranti risiedono in un unico file, [`ristoranti.yaml`](ristoranti.yaml), che la pagina legge al caricamento.

Se una voce non ha le coordinate (`lat` e `lng`), a ogni modifica una GitHub Action le calcola dall'indirizzo, le salva nel file e ripubblica il sito.

## Stack tecnologico

- **Frontend**: HTML, CSS e JavaScript puro, senza build né framework
- **Mappa**: [Leaflet](https://leafletjs.com/)
- **Mappa di base**: [OpenFreeMap](https://openfreemap.org/) (stile Positron), disegnata con [MapLibre GL JS](https://maplibre.org/) tramite [maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet). Se non si carica, il sito ripiega sulle tile di [OpenStreetMap](https://www.openstreetmap.org/)
- **Dati**: file YAML, letto nel browser con [js-yaml](https://github.com/nodeca/js-yaml)
- **Geocodifica**: script Node.js (`geocode.mjs`) che usa [Nominatim](https://nominatim.org/) e la libreria [yaml](https://eemeli.org/yaml/)
- **Pubblicazione**: GitHub Actions e GitHub Pages

## Struttura del repository

| File | Cosa contiene |
| --- | --- |
| `index.html` | Struttura della pagina |
| `style.css` | Stile |
| `app.js` | Mappa, filtri, elenco e schede |
| `ristoranti.yaml` | I ristoranti |
| `geocode.mjs` | Script che compila le coordinate mancanti |
| `.github/workflows/pubblica.yml` | Geocodifica e pubblicazione su GitHub Pages |

## Come contribuire

Per aggiungere o correggere un ristorante leggi [contributing.md](contributing.md).

## Crediti

Dati della mappa © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Mappa di base di [OpenFreeMap](https://openfreemap.org/) e [OpenMapTiles](https://openmaptiles.org/).
