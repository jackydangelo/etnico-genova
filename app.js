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

const mappa = L.map("mappa", { zoomControl: true }).setView([44.4056, 8.9463], 13);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mappa);

const gruppo = L.layerGroup().addTo(mappa);
let ristoranti = [];
const attive = new Set();

let visibili = [];
function disegna() {
  gruppo.clearLayers();
  visibili = ristoranti.filter(r => attive.has(r.cucina));
  visibili.forEach(r => {
    const icona = L.divIcon({
      className: "",
      html: `<div class="pin" style="--c:${colore(r.cucina)}"></div>`,
      iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
    });
    const sito = r.sito ? `<p><a href="${esc(r.sito)}" target="_blank" rel="noopener">Sito web</a></p>` : "";
    r.marker = L.marker([r.lat, r.lng], { icon: icona, title: r.nome })
      .bindPopup(`<div class="popup"><h2>${esc(r.nome)}</h2>
        <p class="cucina">${esc(r.cucina)}</p>
        <p>${esc(r.indirizzo)}</p>
        ${r.note ? `<p>${esc(r.note)}</p>` : ""}${sito}</div>`)
      .addTo(gruppo);
  });
  document.getElementById("conteggio").textContent =
    visibili.length === 1 ? "1 ristorante" : `${visibili.length} ristoranti`;
}

function filtri() {
  const cucine = [...new Set(ristoranti.map(r => r.cucina))]
    .sort((a, b) => a.localeCompare(b, "it"));
  cucine.forEach(c => attive.add(c));

  const pannello = document.getElementById("pannelloFiltri");
  const voci = document.getElementById("voci");
  const stato = document.getElementById("statoFiltri");

  const voce = (id, nome, col, n) => `<li>
    <button type="button" class="voce" role="switch" data-id="${id}">
      <i style="background:${col}"></i><span class="nome">${esc(nome)}</span>
      <small>${n}</small><span class="sw"></span>
    </button></li>`;

  voci.innerHTML = voce("tutto", "Tutto", "transparent", ristoranti.length)
    + cucine.map((c, i) =>
        voce(i, c, colore(c), ristoranti.filter(r => r.cucina === c).length)).join("");

  const aggiorna = () => {
    voci.querySelectorAll(".voce").forEach(b => {
      const acceso = b.dataset.id === "tutto"
        ? attive.size === cucine.length
        : attive.has(cucine[b.dataset.id]);
      b.setAttribute("aria-checked", acceso);
    });
    stato.textContent = `${attive.size}/${cucine.length}`;
    disegna();
  };

  voci.onclick = e => {
    const b = e.target.closest(".voce");
    if (!b) return;
    if (b.dataset.id === "tutto") {
      if (attive.size === cucine.length) attive.clear();
      else cucine.forEach(c => attive.add(c));
    } else {
      const c = cucine[b.dataset.id];
      attive.has(c) ? attive.delete(c) : attive.add(c);
    }
    aggiorna();
  };

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
        <strong>${esc(r.nome)}</strong><span>${esc(r.cucina)}</span><span>${esc(r.indirizzo)}</span>
      </button></li>`).join("")
    : '<li class="vuoto">Nessuna cucina selezionata.</li>';
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
    dati.forEach(r => colore(r.cucina));
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
