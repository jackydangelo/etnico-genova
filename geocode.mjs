// Compila lat/lng mancanti in ristoranti.yaml usando Nominatim (OpenStreetMap).
// Uso: npm i yaml && node geocode.mjs
// Poi controlla il diff in git prima del commit: le coordinate vanno verificate.
import { readFileSync, writeFileSync } from "node:fs";
import { parseDocument } from "yaml";

const FILE = "ristoranti.yaml";
const doc = parseDocument(readFileSync(FILE, "utf8"));
const attesa = ms => new Promise(r => setTimeout(r, ms));

for (const voce of doc.contents.items) {
  if (voce.has("lat") && voce.has("lng")) continue;
  const nome = voce.get("nome");
  let indirizzo = String(voce.get("indirizzo") ?? "");
  if (!/genova/i.test(indirizzo)) indirizzo += ", Genova";

  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q="
    + encodeURIComponent(indirizzo);
  const res = await fetch(url, { headers: { "User-Agent": "etnico-genova (sito statico personale)" } });
  const [hit] = await res.json();

  if (hit) {
    voce.set("lat", Number(Number(hit.lat).toFixed(5)));
    voce.set("lng", Number(Number(hit.lon).toFixed(5)));
    console.log(`OK    ${nome} -> ${hit.display_name}`);
  } else {
    console.warn(`MANCA ${nome}: nessun risultato per "${indirizzo}"`);
  }
  await attesa(1100); // limite Nominatim: 1 richiesta al secondo
}

writeFileSync(FILE, doc.toString());
