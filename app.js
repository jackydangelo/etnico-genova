const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Colori molto diversi tra loro, assegnati alle cucine nell'ordine in cui
// compaiono in ristoranti.yaml. Oltre i 24 se ne generano altri in automatico.
const PALETTE = [
  "#D55E00", "#0072B2", "#009E73", "#CC79A7", "#E69F00", "#56B4E9",
  "#6A3D9A", "#8C564B", "#00A0A0", "#7A7A00", "#E7298A", "#444444",
  "#BE0032", "#1F2A6B", "#8DB600", "#2B3D26", "#F99379", "#A0A0A0",
  "#C2B280", "#882D17", "#F3C300", "#A1CAF1", "#B000B0", "#00D26A"
];
const colori = new Map();
const colore = cucina => {
  if (!colori.has(cucina)) {
    const i = colori.size;
    colori.set(cucina, PALETTE[i] ?? `hsl(${(i * 137.5) % 360}, 65%, 42%)`);
  }
  return colori.get(cucina);
};

const mappa = L.map("mappa", { zoomControl: true, minZoom: 3, maxZoom: 19 })
  .setView([44.4056, 8.9463], 13);

// Mappa di base: OpenFreeMap (stile Positron, vettoriale, senza icone di musei/chiese ecc.).
// Se non si carica (librerie assenti, niente WebGL, errore di rete) si torna a OpenStreetMap.
const ATTR_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ATTR_OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> '
  + '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> '
  + 'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

let vettoriale = null;
let stileCaricato = false;
let ripiegato = false;

function ripiegaSuOSM() {
  if (ripiegato) return;
  ripiegato = true;
  if (vettoriale) mappa.removeLayer(vettoriale);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: ATTR_OSM
  }).addTo(mappa);
}

const webglDisponibile = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
};

// Nasconde i punti di interesse (musei, chiese, cimiteri, moschee, ecc.).
function nascondiPOI(gl) {
  gl.getStyle().layers.forEach(l => {
    if (l.id.startsWith("poi") || l["source-layer"] === "poi")
      gl.setLayoutProperty(l.id, "visibility", "none");
  });
}

if (window.maplibregl && L.maplibreGL && webglDisponibile()) {
  try {
    vettoriale = L.maplibreGL({
      style: "https://tiles.openfreemap.org/styles/positron",
      attribution: ATTR_OFM,
      attributionControl: false
    }).addTo(mappa);
    const gl = vettoriale.getMaplibreMap();
    gl.once("load", () => {
      if (ripiegato) return;
      stileCaricato = true;
      try { nascondiPOI(gl); } catch (e) { console.warn("POI non nascosti:", e); }
    });
    gl.on("error", () => { if (!stileCaricato) ripiegaSuOSM(); });
    setTimeout(() => { if (!stileCaricato) ripiegaSuOSM(); }, 8000);
  } catch (e) {
    console.warn("Mappa vettoriale non disponibile:", e);
    ripiegaSuOSM();
  }
} else {
  ripiegaSuOSM();
}

const gruppo = L.layerGroup().addTo(mappa);
let ristoranti = [];
const attive = new Set();      // cucine visibili
const attiveTipi = new Set();  // tipi di locale visibili

let visibili = [];
function disegna() {
  gruppo.clearLayers();
  visibili = ristoranti.filter(r => attive.has(r.cucina) && attiveTipi.has(r.tipo));
  // Ristoranti con le stesse coordinate (es. stesso mercato) condividono un unico pallino.
  const gruppi = new Map();
  visibili.forEach(r => {
    const k = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(r);
  });

  gruppi.forEach(lista => {
    const cols = [...new Set(lista.map(r => colore(r.cucina)))];
    const fondo = cols.length === 1
      ? cols[0]
      : `conic-gradient(${cols.map((c, i) =>
          `${c} ${(i * 100 / cols.length).toFixed(2)}% ${((i + 1) * 100 / cols.length).toFixed(2)}%`
        ).join(", ")})`;
    const icona = L.divIcon({
      className: "",
      html: `<div class="pin" style="--c:${fondo}"></div>`,
      iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
    });
    const scheda = r => {
      const web = u => /^https?:\/\//i.test(String(u ?? "")) ? u : "";
      const indirizzo = /genova/i.test(r.indirizzo) ? r.indirizzo : `${r.indirizzo}, Genova`;
      // "maps" nel YAML (facoltativo) sostituisce il link generato dall'indirizzo.
      const maps = web(r.maps)
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo)}`;
      const sito = web(r.sito)
        ? `<p><a href="${esc(web(r.sito))}" target="_blank" rel="noopener">Sito web</a></p>` : "";
      return `<div class="scheda"><h2>${esc(r.nome)}</h2>
        <p class="cucina"><i style="background:${colore(r.cucina)}"></i>${esc(r.cucina)} · ${esc(r.tipo)}</p>
        <p>${esc(r.indirizzo)}</p>
        <p class="vai"><a class="maps" href="${esc(maps)}" target="_blank" rel="noopener">Apri su Maps</a></p>
        ${r.note ? `<p>${esc(r.note)}</p>` : ""}${sito}</div>`;
    };
    const marker = L.marker([lista[0].lat, lista[0].lng], {
      icon: icona, title: lista.map(r => r.nome).join(" · ")
    })
      .bindPopup(`<div class="popup">${lista.map(scheda).join("")}</div>`, { maxHeight: 280 })
      .addTo(gruppo);
    lista.forEach(r => { r.marker = marker; });
  });
  document.getElementById("conteggio").textContent =
    visibili.length === 1 ? "1 locale" : `${visibili.length} locali`;
}

function filtri() {
  const ordina = a => [...new Set(a)].sort((x, y) => x.localeCompare(y, "it"));
  const gruppi = [
    { chiavi: ordina(ristoranti.map(r => r.tipo)), attive: attiveTipi, campo: "tipo",
      ul: document.getElementById("vociTipo"), col: () => "transparent" },
    { chiavi: ordina(ristoranti.map(r => r.cucina)), attive, campo: "cucina",
      ul: document.getElementById("voci"), col: colore }
  ];

  const pannello = document.getElementById("pannelloFiltri");
  const stato = document.getElementById("statoFiltri");

  const voce = (id, nome, col, n) => `<li>
    <button type="button" class="voce" role="switch" data-id="${id}">
      <i style="background:${col}"></i><span class="nome">${esc(nome)}</span>
      <small>${n}</small><span class="sw"></span>
    </button></li>`;

  const aggiorna = () => {
    gruppi.forEach(g => g.ul.querySelectorAll(".voce").forEach(b => {
      const acceso = b.dataset.id === "tutto"
        ? g.attive.size === g.chiavi.length
        : g.attive.has(g.chiavi[b.dataset.id]);
      b.setAttribute("aria-checked", acceso);
    }));
    // Contatori "olistici": ogni voce mostra quanti locali compaiono davvero
    // con l'altro filtro com'è in questo momento.
    gruppi.forEach(g => {
      const altro = gruppi.find(x => x !== g);
      g.ul.querySelectorAll(".voce").forEach(b => {
        const id = b.dataset.id;
        const n = ristoranti.filter(r =>
          altro.attive.has(r[altro.campo]) && (id === "tutto" || r[g.campo] === g.chiavi[id])).length;
        b.querySelector("small").textContent = n;
        b.classList.toggle("vuota", n === 0);
      });
    });
    const on = gruppi.reduce((n, g) => n + g.attive.size, 0);
    const tot = gruppi.reduce((n, g) => n + g.chiavi.length, 0);
    stato.textContent = `${on}/${tot}`;
    disegna();
  };

  gruppi.forEach(g => {
    g.chiavi.forEach(k => g.attive.add(k));
    g.ul.innerHTML = voce("tutto", "Tutto", "transparent", ristoranti.length)
      + g.chiavi.map((k, i) =>
          voce(i, k, g.col(k), ristoranti.filter(r => r[g.campo] === k).length)).join("");
    g.ul.onclick = e => {
      const b = e.target.closest(".voce");
      if (!b) return;
      if (b.dataset.id === "tutto") {
        if (g.attive.size === g.chiavi.length) g.attive.clear();
        else g.chiavi.forEach(k => g.attive.add(k));
      } else {
        const k = g.chiavi[b.dataset.id];
        g.attive.has(k) ? g.attive.delete(k) : g.attive.add(k);
      }
      aggiorna();
    };
  });

  document.getElementById("apriFiltri").onclick = () => pannello.showModal();
  document.getElementById("chiudiFiltri").onclick = () => pannello.close();
  pannello.addEventListener("click", e => { if (e.target === pannello) pannello.close(); });
  aggiorna();
}

const elenco = document.getElementById("elenco");
const righe = document.getElementById("righe");
let ordinati = [];

document.getElementById("conteggio").onclick = () => {
  ordinati = [...visibili].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  righe.innerHTML = ordinati.length
    ? ordinati.map((r, i) => `<li><button type="button" data-i="${i}">
        <strong>${esc(r.nome)}</strong><span>${esc(r.cucina)} · ${esc(r.tipo)}</span><span>${esc(r.indirizzo)}</span>
      </button></li>`).join("")
    : '<li class="vuoto">Nessun locale selezionato.</li>';
  elenco.showModal();
};
righe.onclick = e => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  const r = ordinati[b.dataset.i];
  elenco.close();
  mappa.setView([r.lat, r.lng], 16);
  r.marker.openPopup();
};
document.getElementById("chiudi").onclick = () => elenco.close();
elenco.addEventListener("click", e => { if (e.target === elenco) elenco.close(); });

fetch("ristoranti.yaml")
  .then(r => { if (!r.ok) throw new Error("ristoranti.yaml non trovato"); return r.text(); })
  .then(testo => {
    const dati = jsyaml.load(testo) || [];
    dati.forEach(r => {
      // "tipo" è facoltativo: se manca, il locale è un Ristorante.
      const tipo = String(r.tipo ?? "").trim() || "Ristorante";
      r.tipo = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
      colore(r.cucina);
    });
    const senza = dati.filter(r => typeof r.lat !== "number" || typeof r.lng !== "number");
    senza.forEach(r => console.warn("Senza coordinate, non mostrato:", r.nome));
    ristoranti = dati.filter(r => !senza.includes(r));
    filtri();
    if (ristoranti.length > 1)
      mappa.fitBounds(ristoranti.map(r => [r.lat, r.lng]), { padding: [40, 40], maxZoom: 15 });
  })
  .catch(e => {
    const d = document.createElement("div");
    d.id = "errore";
    d.textContent = "Impossibile caricare i ristoranti: " + e.message;
    document.querySelector("header").after(d);
  });
