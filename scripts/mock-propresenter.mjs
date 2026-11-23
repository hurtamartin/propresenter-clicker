// Fake ProPresenter 7 REST API for local UI development.
//
// Implements just the /v1 endpoints that server/proPresenterRestApi.ts calls,
// with made-up playlists/presentations and generated SVG slide thumbnails.
// Run the app against it with PROPRESENTER_PROTOCOL=rest.
//
//   node scripts/mock-propresenter.mjs            # listens on 50001
//   MOCK_PP_PORT=6000 node scripts/mock-propresenter.mjs

import http from "node:http";

const PORT = parseInt(process.env.MOCK_PP_PORT || "50001", 10);

// --- Fake content -----------------------------------------------------------

const GROUP_COLORS = {
  Titul: "#3b82f6",
  Sloka: "#8b5cf6",
  Refrén: "#ec4899",
  Most: "#f59e0b",
  Bod: "#10b981",
  Info: "#06b6d4",
  Konec: "#64748b",
};

function pres(uuid, name, groups) {
  return { uuid, name, groups };
}

const PRESENTATIONS = [
  pres("a1000000-0000-4000-8000-000000000001", "Uvítání", [
    { name: "Titul", slides: ["Vítejte!", "Jsme rádi, že jste dnes s námi"] },
    { name: "Info", slides: ["Wi-Fi: Host\nHeslo: vitejte2026"] },
  ]),
  pres("a1000000-0000-4000-8000-000000000002", "Píseň – Světlo nad městem", [
    { name: "Sloka", slides: ["Ráno se probouzí\nulice ztichlá", "první paprsek\nna střechy dopadá"] },
    { name: "Refrén", slides: ["Světlo nad městem\nnese nový den", "otevři okna\nať vejde sem"] },
    { name: "Sloka", slides: ["Kroky se mísí\ns hlasy lidí", "každý z nás\nto světlo vidí"] },
    { name: "Refrén", slides: ["Světlo nad městem\nnese nový den", "otevři okna\nať vejde sem"] },
    { name: "Most", slides: ["Ať je noc\njakkoli dlouhá", "ráno vždycky přijde"] },
    { name: "Refrén", slides: ["Světlo nad městem\nnese nový den", "otevři okna\nať vejde sem"] },
  ]),
  pres("a1000000-0000-4000-8000-000000000003", "Kázání – Naděje", [
    { name: "Titul", slides: ["Naděje\nkterá nezklame"] },
    { name: "Bod", slides: ["1. Naděje\nnení optimismus", "2. Naděje\nroste v těžkostech", "3. Naděje\nse sdílí"] },
    { name: "Konec", slides: ["Otázky\nk zamyšlení", "Děkujeme"] },
  ]),
  pres("a1000000-0000-4000-8000-000000000004", "Ohlášky", [
    { name: "Info", slides: ["Pátek 18:00\nSetkání mládeže", "Sobota 9:00\nBrigáda na zahradě", "Neděle 30. 11.\nAdventní koncert", "Sbírka\nna opravu střechy"] },
  ]),
  pres("a1000000-0000-4000-8000-000000000005", "Požehnání", [
    { name: "Konec", slides: ["Pokoj vám", "Na shledanou\npříští neděli"] },
  ]),
  pres("a1000000-0000-4000-8000-000000000006", "Hra – Kvíz pro mládež", [
    { name: "Titul", slides: ["Kvíz!"] },
    { name: "Bod", slides: ["Otázka 1", "Otázka 2", "Otázka 3", "Otázka 4", "Otázka 5", "Otázka 6", "Otázka 7", "Otázka 8", "Otázka 9", "Otázka 10"] },
    { name: "Konec", slides: ["Vyhlášení\nvítězů"] },
  ]),
];

const byUuid = new Map(PRESENTATIONS.map((p) => [p.uuid, p]));

const PLAYLISTS = [
  {
    uuid: "b2000000-0000-4000-8000-000000000001",
    name: "Neděle 23. 11.",
    items: [
      { type: "header", name: "Úvod" },
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000002",
      { type: "header", name: "Slovo" },
      "a1000000-0000-4000-8000-000000000003",
      "a1000000-0000-4000-8000-000000000004",
      "a1000000-0000-4000-8000-000000000005",
    ],
  },
  {
    uuid: "b2000000-0000-4000-8000-000000000002",
    name: "Mládež – pátek",
    items: ["a1000000-0000-4000-8000-000000000006", "a1000000-0000-4000-8000-000000000002"],
  },
  { uuid: "b2000000-0000-4000-8000-000000000003", name: "Prázdný playlist", items: [] },
];

const LIBRARIES = [{ uuid: "c3000000-0000-4000-8000-000000000001", name: "Default", index: 0 }];

// Flatten a presentation into a linear slide list (ProPresenter indexes slides
// across all groups).
function flatSlides(p) {
  return p.groups.flatMap((g) => g.slides.map((text) => ({ group: g.name, text })));
}

// --- Live state -------------------------------------------------------------

let current = null; // { uuid, index }

// --- Response shapes (mirroring ProPresenter 7.9+ REST) ---------------------

function idOf(uuid, name, index) {
  return { uuid, name, index };
}

function playlistsJson() {
  return PLAYLISTS.map((pl, i) => ({
    id: idOf(pl.uuid, pl.name, i),
    field_type: "playlist",
  }));
}

function playlistJson(pl, plIndex) {
  return {
    id: idOf(pl.uuid, pl.name, plIndex),
    items: pl.items.map((item, i) => {
      if (typeof item === "string") {
        const p = byUuid.get(item);
        return {
          id: idOf(`${pl.uuid}-item-${i}`, p.name, i),
          type: "presentation",
          is_hidden: false,
          is_pco: false,
          presentation_info: { presentation_uuid: p.uuid, arrangement_name: "", arrangement_uuid: null },
        };
      }
      return {
        id: idOf(`${pl.uuid}-item-${i}`, item.name, i),
        type: item.type,
        is_hidden: false,
        is_pco: false,
        header_color: { red: 0.4, green: 0.4, blue: 0.4, alpha: 1 },
      };
    }),
  };
}

function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255, alpha: 1 };
}

function presentationJson(p) {
  return {
    presentation: {
      id: idOf(p.uuid, p.name, 0),
      groups: p.groups.map((g) => ({
        name: g.name,
        color: hexToRgba(GROUP_COLORS[g.name] || "#64748b"),
        slides: g.slides.map((text) => ({ enabled: true, notes: "", text, label: "" })),
      })),
      has_timeline: false,
      presentation_path: `/Mock/Library/${p.name}.pro`,
      destination: "presentation",
    },
  };
}

// --- SVG thumbnails ---------------------------------------------------------

function escapeXml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

function thumbSvg(p, index) {
  const slides = flatSlides(p);
  const slide = slides[index];
  if (!slide) return null;
  const color = GROUP_COLORS[slide.group] || "#64748b";
  const lines = slide.text.split("\n");
  const fontSize = lines.length > 2 ? 96 : 120;
  const lineH = fontSize * 1.25;
  const startY = 540 - ((lines.length - 1) * lineH) / 2;
  const textEls = lines
    .map((l, i) => `<text x="960" y="${startY + i * lineH}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="600">${escapeXml(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="${color}" stop-opacity="0.55"/></linearGradient></defs>
<rect width="1920" height="1080" fill="url(#g)"/>
<rect x="0" y="1040" width="1920" height="40" fill="${color}"/>
<text x="60" y="90" font-size="48" fill="${color}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="700">${escapeXml(slide.group.toUpperCase())}</text>
${textEls}
<text x="1860" y="90" font-size="40" text-anchor="end" fill="#ffffff66" font-family="Segoe UI, Helvetica, Arial, sans-serif">MOCK · ${index + 1}/${slides.length}</text>
</svg>`;
}

// --- HTTP -------------------------------------------------------------------

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function step(delta) {
  if (!current) return;
  const p = byUuid.get(current.uuid);
  const max = flatSlides(p).length - 1;
  current = { uuid: current.uuid, index: Math.min(max, Math.max(0, current.index + delta)) };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${url.pathname}${url.search}`);

  if (parts[0] !== "v1") return send(res, 404, { error: "not found" });
  const [, a, b, c, d] = parts;

  // /v1/playlists
  if (a === "playlists" && !b) return send(res, 200, playlistsJson());

  // /v1/playlist/:id
  if (a === "playlist" && b) {
    const i = PLAYLISTS.findIndex((pl) => pl.uuid === b || pl.name === b);
    return i === -1 ? send(res, 404, { error: "no playlist" }) : send(res, 200, playlistJson(PLAYLISTS[i], i));
  }

  // /v1/libraries, /v1/library/:id
  if (a === "libraries" && !b) return send(res, 200, LIBRARIES);
  if (a === "library" && b) {
    return send(res, 200, {
      update_type: "all",
      items: PRESENTATIONS.map((p, i) => idOf(p.uuid, p.name, i)),
    });
  }

  // /v1/trigger/next, /v1/trigger/previous
  if (a === "trigger" && (b === "next" || b === "previous")) {
    step(b === "next" ? 1 : -1);
    res.writeHead(204);
    return res.end();
  }

  if (a === "presentation") {
    // /v1/presentation/slide_index
    if (b === "slide_index") {
      if (!current) return send(res, 200, { presentation_index: null });
      const p = byUuid.get(current.uuid);
      return send(res, 200, { presentation_index: { index: current.index, presentation_id: idOf(p.uuid, p.name, 0) } });
    }
    // /v1/presentation/active
    if (b === "active") {
      return current ? send(res, 200, presentationJson(byUuid.get(current.uuid))) : send(res, 200, { presentation: null });
    }

    const p = byUuid.get(b);
    if (!p) return send(res, 404, { error: "no presentation" });

    // /v1/presentation/:uuid
    if (!c) return send(res, 200, presentationJson(p));

    // /v1/presentation/:uuid/thumbnail/:index
    if (c === "thumbnail") {
      const svg = thumbSvg(p, parseInt(d, 10));
      return svg ? send(res, 200, svg, "image/svg+xml") : send(res, 404, { error: "no slide" });
    }

    // /v1/presentation/:uuid/trigger/:index
    if (c === "trigger") {
      const idx = parseInt(d, 10);
      if (!(idx >= 0 && idx < flatSlides(p).length)) return send(res, 400, { error: "bad index" });
      current = { uuid: p.uuid, index: idx };
      res.writeHead(204);
      return res.end();
    }
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock ProPresenter REST API on http://127.0.0.1:${PORT}/v1`);
  console.log(`${PLAYLISTS.length} playlists, ${PRESENTATIONS.length} presentations`);
});
