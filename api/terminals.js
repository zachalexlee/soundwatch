const API_CODE = process.env.WSDOT_ACCESS_CODE || "d39f3cc3-ae7c-4bb9-8e32-579a341dd680";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const upstream = await fetch(
      `https://www.wsdot.wa.gov/ferries/api/terminals/rest/terminallocations?apiaccesscode=${API_CODE}`,
      { headers: { Accept: "application/json", "User-Agent": "SoundWatch/2.0" } }
    );
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const data = await upstream.json();
    res.statusCode = 200;
    return res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
