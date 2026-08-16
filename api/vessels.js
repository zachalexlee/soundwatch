const API_CODE = process.env.WSDOT_ACCESS_CODE || "d39f3cc3-ae7c-4bb9-8e32-579a341dd680";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=5");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const upstream = await fetch(
      `https://www.wsdot.wa.gov/ferries/api/vessels/rest/vessellocations?apiaccesscode=${API_CODE}`,
      { headers: { Accept: "application/json", "User-Agent": "SoundWatch/2.0" } }
    );
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const data = await upstream.json();
    res.statusCode = 200;
    return res.end(JSON.stringify(data));
  } catch (err) {
    try {
      const raw = await fetch("https://www.wsdot.com/ferries/vesselwatch/Vessels.ashx", {
        headers: { "User-Agent": "SoundWatch/2.0" },
      });
      const text = await raw.text();
      const feed = JSON.parse(text);
      const vessels = (feed.vessellist || []).map((v) => ({
        VesselID: v.vesselID ?? v.id,
        VesselName: v.name,
        Mmsi: v.mmsi,
        DepartingTerminalName: v.lastdock,
        DepartingTerminalAbbrev: v.lastdock_abbrev,
        ArrivingTerminalName: v.aterm,
        ArrivingTerminalAbbrev: v.aterm_abbrev,
        Latitude: v.lat,
        Longitude: v.lon,
        Speed: v.speed,
        Heading: v.head,
        InService: String(v.inservice).toLowerCase() === "true",
        AtDock: Number(v.speed) < 0.5,
        OpRouteAbbrev: v.route ? [String(v.route).toLowerCase()] : [],
        Eta: v.eta && v.eta !== "Calculating" ? `${v.eta} ${v.etaAMPM || ""}`.trim() : null,
        ScheduledDeparture: v.nextdep ? `${v.nextdep} ${v.nextdepAMPM || ""}`.trim() : null,
        VesselWatchShutMsg: v.vesselwatch?.shutoff?.shutmsg || null,
        _source: "vesselwatch",
        _etaText: v.eta,
        _etaAmPm: v.etaAMPM,
        _leftDock: v.leftdock ? `${v.leftdock} ${v.leftdockAMPM || ""}`.trim() : null,
        _delayed: String(v.departDelayed).toUpperCase() === "Y",
      }));
      res.statusCode = 200;
      return res.end(JSON.stringify(vessels));
    } catch (fallbackErr) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: String(err.message || err) }));
    }
  }
};
