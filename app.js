/* SoundWatch — Live Washington Ferries */
(function () {
  "use strict";

  const ROUTES = [
    { id: "all", label: "All", codes: [], center: [-122.48, 47.72], zoom: 8.2 },
    { id: "sea-bi", label: "SEA–BI", codes: ["sea-bi"], center: [-122.425, 47.612], zoom: 11.1 },
    { id: "sea-br", label: "SEA–BR", codes: ["sea-br"], center: [-122.48, 47.575], zoom: 10.6 },
    { id: "ed-king", label: "ED–KING", codes: ["ed-king"], center: [-122.44, 47.804], zoom: 11.2 },
    { id: "muk-cl", label: "MUK–CL", codes: ["muk-cl"], center: [-122.323, 47.962], zoom: 11.6 },
    { id: "f-v-s", label: "F–V–S", codes: ["f-v-s"], center: [-122.445, 47.52], zoom: 11.4 },
    { id: "pd-tal", label: "PD–TAL", codes: ["pd-tal"], center: [-122.511, 47.319], zoom: 12.2 },
    { id: "pt-cou", label: "PT–COU", codes: ["pt-cou"], center: [-122.715, 48.135], zoom: 11.2 },
    { id: "ana-sj", label: "ANA–SJ", codes: ["ana-sj"], center: [-122.82, 48.54], zoom: 9.6 },
  ];

  const ROUTE_LINES = {
    "sea-bi": [[-122.340472, 47.602501], [-122.509617, 47.622339]],
    "sea-br": [[-122.340472, 47.602501], [-122.48, 47.575], [-122.624089, 47.561847]],
    "ed-king": [[-122.385378, 47.813378], [-122.494328, 47.794606]],
    "muk-cl": [[-122.297, 47.9506], [-122.349581, 47.9754]],
    "f-v-s": [[-122.3967, 47.5232], [-122.463639, 47.51095], [-122.495742, 47.513064]],
    "pd-tal": [[-122.514053, 47.306519], [-122.507786, 47.331961]],
    "pt-cou": [[-122.759039, 48.110847], [-122.672603, 48.159008]],
    "ana-sj": [[-122.677, 48.507351], [-122.882764, 48.570928], [-122.92965, 48.584792], [-122.943494, 48.597333], [-123.013844, 48.535783]],
  };

  const STYLES = {
    voyager: {
      version: 8,
      sources: { carto: { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png","https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"], tileSize: 256, attribution: "© OpenStreetMap © CARTO" } },
      layers: [{ id: "carto", type: "raster", source: "carto" }],
    },
    dark: {
      version: 8,
      sources: { carto: { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png","https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"], tileSize: 256, attribution: "© OpenStreetMap © CARTO" } },
      layers: [{ id: "carto", type: "raster", source: "carto" }],
    },
    satellite: {
      version: 8,
      sources: { esri: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Tiles © Esri" } },
      layers: [{ id: "esri", type: "raster", source: "esri" }],
    },
  };

  const state = { vessels: [], terminals: [], route: "all", search: "", tab: "vessels", selectedVesselId: null, selectedTerminalId: null, following: false, mapStyle: "voyager", panelOpen: true };
  let map = null;
  let vesselMarkers = new Map();
  let terminalMarkers = new Map();
  let mapReady = false;
  function $(id) { return document.getElementById(id); }
  function parseMsDate(value) {
    if (value == null) return null;
    if (typeof value === "string" && value.startsWith("/Date(")) {
      const m = value.match(/\/Date\((-?\d+)/);
      return m ? new Date(Number(m[1])) : null;
    }
    if (typeof value === "string" && value.includes(":")) return value;
    return null;
  }
  function formatTime(value) {
    if (value == null) return null;
    if (typeof value === "string" && !value.startsWith("/Date(")) return value;
    const d = parseMsDate(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function routeOf(v) { return String((v.OpRouteAbbrev && v.OpRouteAbbrev[0]) || "").toLowerCase(); }
  function statusOf(v) {
    if (!v.InService) return "oos";
    if (v._delayed) return "delay";
    if (v.AtDock || (v.Speed != null && v.Speed < 0.5)) return "docked";
    return "underway";
  }
  function statusLabel(s) { return { underway: "Underway", docked: "At dock", delay: "Delayed", oos: "Out of service" }[s] || s; }
  function vesselColor(v) {
    const s = statusOf(v);
    return { underway: "#4ea394", docked: "#c4a574", delay: "#d06a58", oos: "#6d7a7d" }[s];
  }
  function boatSvg(color) {
    return `<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true"><path d="M16 3 L22 20 L16 17.5 L10 20 Z" fill="${color}" stroke="#06110f" stroke-width="1.2" stroke-linejoin="round"/><path d="M13.2 18.6 h5.6 l1.2 3.6 h-8 z" fill="#e8eef0" stroke="#06110f" stroke-width="1"/></svg>`;
  }
  function paintRoutes() {
    if (!map || !mapReady) return;
    const filter = state.route;
    const features = Object.entries(ROUTE_LINES).filter(([code]) => filter === "all" || filter === code).map(([code, coords]) => ({ type: "Feature", properties: { code }, geometry: { type: "LineString", coordinates: coords } }));
    const data = { type: "FeatureCollection", features };
    if (map.getSource("routes")) map.getSource("routes").setData(data);
    else {
      map.addSource("routes", { type: "geojson", data });
      map.addLayer({ id: "routes-line", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#4ea394", "line-width": 2.2, "line-opacity": 0.55, "line-dasharray": [1.4, 1.6] } });
    }
  }
  function showMapFallback(msg) {
    const el = $("map");
    if (!el) return;
    const note = document.createElement("div");
    note.style.cssText = "position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#8b9a9d;z-index:1;pointer-events:none;font:14px Figtree,system-ui,sans-serif";
    note.textContent = msg || "Map unavailable";
    el.appendChild(note);
  }
  function initMap() {
    const container = $("map");
    if (!container) return;
    if (typeof maplibregl === "undefined") { $("statusText").textContent = "Map library failed to load"; showMapFallback("Map library did not load."); return; }
    let attempts = 0;
    function tryCreate() {
      attempts += 1;
      const rect = container.getBoundingClientRect();
      if ((rect.width < 2 || rect.height < 2) && attempts < 40) { requestAnimationFrame(tryCreate); return; }
      if (rect.width < 2 || rect.height < 2) { container.style.position = "absolute"; container.style.inset = "0"; container.style.width = "100vw"; container.style.height = "100dvh"; }
      try {
        map = new maplibregl.Map({ container: "map", style: STYLES.voyager, center: [-122.48, 47.72], zoom: 8.2, attributionControl: { compact: true }, failIfMajorPerformanceCaveat: false });
      } catch (err) { console.error(err); showMapFallback("Could not start the map on this device."); return; }
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => {
        mapReady = true; paintRoutes(); updateVesselMarkers(); updateTerminalMarkers();
        $("statusText").textContent = "Map ready"; $("liveDot").classList.add("on");
        map.resize();
        setTimeout(() => map && map.resize(), 100);
        setTimeout(() => map && map.resize(), 500);
        setTimeout(() => map && map.resize(), 1500);
      });
      map.on("error", (e) => console.error("Map error", e && e.error ? e.error : e));
      map.on("click", (e) => {
        const t = e.originalEvent.target;
        if (t && t.closest && t.closest(".vessel-marker, .terminal-pin")) return;
        clearSelection();
      });
      window.addEventListener("resize", () => map && map.resize());
      window.addEventListener("orientationchange", () => setTimeout(() => map && map.resize(), 250));
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if (map) map.resize(); }).observe(container);
    }
    tryCreate();
  }
  function updateVesselMarkers() {
    if (!map || !mapReady) return;
    const seen = new Set();
    for (const v of filteredVessels()) {
      if (v.Latitude == null || v.Longitude == null) continue;
      const id = v.VesselID; seen.add(id);
      let marker = vesselMarkers.get(id);
      if (!marker) {
        const el = document.createElement("button"); el.type = "button"; el.className = "vessel-marker";
        el.addEventListener("click", (ev) => { ev.stopPropagation(); selectVessel(id); });
        marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.Longitude, v.Latitude]).addTo(map);
        vesselMarkers.set(id, marker);
      }
      const el = marker.getElement();
      el.classList.toggle("selected", id === state.selectedVesselId);
      el.setAttribute("aria-label", v.VesselName);
      el.innerHTML = "";
      const boat = document.createElement("div"); boat.className = "vessel-boat"; boat.style.transform = `rotate(${v.Heading || 0}deg)`; boat.innerHTML = boatSvg(vesselColor(v));
      const label = document.createElement("div"); label.className = "vessel-label"; label.textContent = v.VesselName;
      el.append(boat, label);
      marker.setLngLat([v.Longitude, v.Latitude]);
    }
    for (const [id, marker] of vesselMarkers) { if (!seen.has(id)) { marker.remove(); vesselMarkers.delete(id); } }
  }
  function updateTerminalMarkers() {
    if (!map || !mapReady) return;
    const seen = new Set();
    for (const t of state.terminals) {
      if (t.Latitude == null || t.Longitude == null) continue;
      seen.add(t.TerminalID);
      let marker = terminalMarkers.get(t.TerminalID);
      if (!marker) {
        const el = document.createElement("button"); el.type = "button"; el.className = "terminal-pin"; el.title = t.TerminalName;
        el.addEventListener("click", (ev) => { ev.stopPropagation(); selectTerminal(t.TerminalID); });
        marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([t.Longitude, t.Latitude]).addTo(map);
        terminalMarkers.set(t.TerminalID, marker);
      }
      marker.getElement().classList.toggle("selected", t.TerminalID === state.selectedTerminalId);
      marker.setLngLat([t.Longitude, t.Latitude]);
    }
    for (const [id, marker] of terminalMarkers) { if (!seen.has(id)) { marker.remove(); terminalMarkers.delete(id); } }
  }
  function filteredVessels() {
    const q = state.search.trim().toLowerCase();
    return state.vessels.filter((v) => {
      if (state.route !== "all" && routeOf(v) !== state.route) return false;
      if (!q) return true;
      return [v.VesselName, v.DepartingTerminalName, v.ArrivingTerminalName, routeOf(v)].join(" ").toLowerCase().includes(q);
    });
  }
  function filteredTerminals() {
    const q = state.search.trim().toLowerCase();
    return state.terminals.filter((t) => !q || (t.TerminalName || "").toLowerCase().includes(q));
  }
  function renderRouteBar() {
    const bar = $("routeBar"); bar.innerHTML = "";
    for (const r of ROUTES) {
      const btn = document.createElement("button"); btn.type = "button";
      btn.className = "chip" + (state.route === r.id ? " active" : ""); btn.textContent = r.label;
      btn.addEventListener("click", () => {
        state.route = r.id; state.following = false;
        $("followBtn").disabled = state.selectedVesselId == null; $("followBtn").classList.remove("active");
        renderRouteBar(); renderList(); updateVesselMarkers(); paintRoutes();
        if (map) map.easeTo({ center: r.center, zoom: r.zoom, duration: 700 });
      });
      bar.appendChild(btn);
    }
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderList() {
    const body = $("panelBody");
    if (state.tab === "terminals") {
      const list = filteredTerminals();
      if (!list.length) { body.innerHTML = `<div class="empty">No terminals match.</div>`; return; }
      body.innerHTML = list.map((t) => `<button type="button" class="terminal-card ${t.TerminalID === state.selectedTerminalId ? "selected" : ""}" data-tid="${t.TerminalID}"><div class="name">${escapeHtml(t.TerminalName)}</div><div class="sub">${escapeHtml([t.City, t.State].filter(Boolean).join(", ") || "Washington")}</div></button>`).join("");
      body.querySelectorAll("[data-tid]").forEach((el) => el.addEventListener("click", () => selectTerminal(Number(el.dataset.tid))));
      return;
    }
    const list = filteredVessels();
    if (!list.length) { body.innerHTML = `<div class="empty">${state.vessels.length ? "No vessels match that filter." : "Loading vessels…"}</div>`; return; }
    body.innerHTML = list.map((v) => {
      const st = statusOf(v); const route = routeOf(v).toUpperCase() || "—";
      const eta = formatTime(v.Eta) || (v._etaText === "Calculating" ? "ETA calculating" : "—");
      return `<button type="button" class="vessel-card ${v.VesselID === state.selectedVesselId ? "selected" : ""}" data-vid="${v.VesselID}"><div class="row"><div><div class="name">${escapeHtml(v.VesselName)}</div><div class="sub">${escapeHtml(route)} · ${escapeHtml(v.DepartingTerminalName || "?")} → ${escapeHtml(v.ArrivingTerminalName || "?")}</div></div><span class="badge ${st}">${statusLabel(st)}</span></div><div class="meta"><span>${(v.Speed ?? 0).toFixed(1)} kn</span><span>${escapeHtml(String(eta))}</span></div></button>`;
    }).join("");
    body.querySelectorAll("[data-vid]").forEach((el) => el.addEventListener("click", () => selectVessel(Number(el.dataset.vid))));
  }
  function selectVessel(id) {
    state.selectedVesselId = id; state.selectedTerminalId = null; state.following = true;
    $("followBtn").disabled = false; $("followBtn").classList.add("active"); $("panel").classList.add("collapsed");
    renderList(); updateVesselMarkers(); updateTerminalMarkers(); renderDetail();
    const v = state.vessels.find((x) => x.VesselID === id);
    if (v && map) map.easeTo({ center: [v.Longitude, v.Latitude], zoom: Math.max(map.getZoom(), 11.4), duration: 700 });
  }
  function selectTerminal(id) {
    state.selectedTerminalId = id; state.selectedVesselId = null; state.following = false;
    $("followBtn").disabled = true; $("followBtn").classList.remove("active"); $("panel").classList.add("collapsed");
    renderList(); updateVesselMarkers(); updateTerminalMarkers(); renderDetail();
    const t = state.terminals.find((x) => x.TerminalID === id);
    if (t && map) map.easeTo({ center: [t.Longitude, t.Latitude], zoom: Math.max(map.getZoom(), 12.4), duration: 700 });
  }
  function clearSelection() {
    state.selectedVesselId = null; state.selectedTerminalId = null; state.following = false;
    $("followBtn").disabled = true; $("followBtn").classList.remove("active"); $("detail").hidden = true;
    if (window.matchMedia("(min-width: 801px)").matches) $("panel").classList.remove("collapsed");
    renderList(); updateVesselMarkers(); updateTerminalMarkers();
  }
  function renderDetail() {
    const box = $("detail");
    if (state.selectedVesselId != null) {
      const v = state.vessels.find((x) => x.VesselID === state.selectedVesselId);
      if (!v) { box.hidden = true; return; }
      const st = statusOf(v);
      const eta = formatTime(v.Eta) || (v._etaText === "Calculating" ? "Calculating" : "—");
      const left = formatTime(v.LeftDock) || v._leftDock || (statusOf(v) === "docked" ? "Still docked" : "—");
      const sched = formatTime(v.ScheduledDeparture) || "—";
      box.hidden = false;
      box.innerHTML = `<button type="button" class="close-x" id="closeDetail">×</button><div class="label">Vessel</div><h2>${escapeHtml(v.VesselName)}</h2><div style="margin-top:8px"><span class="badge ${st}">${statusLabel(st)}</span></div><div class="facts"><div class="fact"><div class="k">From</div><div class="v">${escapeHtml(v.DepartingTerminalName || "—")}</div></div><div class="fact"><div class="k">To</div><div class="v">${escapeHtml(v.ArrivingTerminalName || "—")}</div></div><div class="fact"><div class="k">Speed</div><div class="v">${(v.Speed ?? 0).toFixed(1)} kn</div></div><div class="fact"><div class="k">Heading</div><div class="v">${v.Heading != null ? v.Heading + "°" : "—"}</div></div><div class="fact"><div class="k">ETA</div><div class="v">${escapeHtml(String(eta))}</div></div><div class="fact"><div class="k">Left dock</div><div class="v">${escapeHtml(String(left))}</div></div></div><p style="margin:12px 0 0;font-size:13px;color:var(--muted)">Scheduled departure ${escapeHtml(String(sched))}</p><div class="detail-actions"><button type="button" class="btn primary" id="followDetail">${state.following ? "Following" : "Follow boat"}</button></div>`;
      $("closeDetail").onclick = clearSelection;
      $("followDetail").onclick = () => {
        state.following = !state.following; $("followBtn").classList.toggle("active", state.following); renderDetail();
        if (state.following && v) map.easeTo({ center: [v.Longitude, v.Latitude], zoom: Math.max(map.getZoom(), 11.4), duration: 500 });
      };
      return;
    }
    if (state.selectedTerminalId != null) {
      const t = state.terminals.find((x) => x.TerminalID === state.selectedTerminalId);
      if (!t) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = `<button type="button" class="close-x" id="closeDetail">×</button><div class="label">Terminal</div><h2>${escapeHtml(t.TerminalName)}</h2><div class="facts"><div class="fact"><div class="k">City</div><div class="v">${escapeHtml(t.City || "—")}</div></div><div class="fact"><div class="k">Code</div><div class="v">${escapeHtml(t.TerminalAbbrev || "—")}</div></div></div>${t.AddressLineOne ? `<p style="margin:12px 0 0;font-size:13px;color:var(--muted)">${escapeHtml(t.AddressLineOne)}</p>` : ""}`;
      $("closeDetail").onclick = clearSelection;
      return;
    }
    box.hidden = true;
  }
  async function loadVessels() {
    try {
      const res = await fetch("/api/vessels");
      if (!res.ok) throw new Error("vessels " + res.status);
      const data = await res.json();
      state.vessels = Array.isArray(data) ? data : [];
      const underway = state.vessels.filter((v) => statusOf(v) === "underway").length;
      $("statusText").textContent = `${underway} underway · ${state.vessels.length} boats`;
      $("liveDot").classList.add("on");
      renderList(); updateVesselMarkers();
      if (state.following && state.selectedVesselId != null) {
        const v = state.vessels.find((x) => x.VesselID === state.selectedVesselId);
        if (v && map) map.easeTo({ center: [v.Longitude, v.Latitude], duration: 600 });
      }
      if (state.selectedVesselId != null) renderDetail();
    } catch (err) {
      console.error(err);
      $("statusText").textContent = "Feed error — retrying";
      $("liveDot").classList.remove("on");
    }
  }
  async function loadTerminals() {
    try {
      const res = await fetch("/api/terminals");
      if (!res.ok) throw new Error("terminals " + res.status);
      const data = await res.json();
      state.terminals = Array.isArray(data) ? data : [];
      updateTerminalMarkers();
      if (state.tab === "terminals") renderList();
    } catch (err) { console.error(err); }
  }
  function bindUi() {
    $("listToggle").addEventListener("click", () => $("panel").classList.toggle("collapsed"));
    $("search").addEventListener("input", (e) => { state.search = e.target.value; renderList(); });
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.tab = tab.dataset.tab;
        document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
        renderList();
      });
    });
    document.querySelectorAll(".map-tools .tool[data-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mapStyle = btn.dataset.style;
        document.querySelectorAll(".map-tools .tool[data-style]").forEach((b) => b.classList.toggle("active", b === btn));
        if (!map) return;
        mapReady = false;
        map.setStyle(STYLES[state.mapStyle]);
        map.once("style.load", () => { mapReady = true; paintRoutes(); updateVesselMarkers(); updateTerminalMarkers(); });
      });
    });
    $("followBtn").addEventListener("click", () => {
      if (state.selectedVesselId == null) return;
      state.following = !state.following;
      $("followBtn").classList.toggle("active", state.following);
      renderDetail();
    });
  }
  function boot() {
    bindUi(); renderRouteBar(); renderList(); initMap(); loadVessels(); loadTerminals();
    setInterval(loadVessels, 10000);
    setInterval(loadTerminals, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
