// geocoder.js
// Resolves city/country strings to lat/lng coordinates.
// Loads a pre-warmed cache from data/geocache.json, then falls back to
// Nominatim (OpenStreetMap) for any cache misses — one request per second.

const Geocoder = (function () {

  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const USER_AGENT    = "SignalAndStride-FanHeatMap/1.0 (signalandstride.com)";

  let _cache = {};         // { "city||country": { lat, lng } }
  let _cacheLoaded = false;

  async function loadCache() {
    if (_cacheLoaded) return;
    try {
      const res = await fetch("data/geocache.json");
      const data = await res.json();
      // Convert Python cache format { "city|region|country": { lat, long } }
      // to internal format using the same key scheme
      for (const [k, v] of Object.entries(data)) {
        if (v.lat != null && v.long != null) {
          _cache[k] = { lat: v.lat, lng: v.long };
        }
      }
      _cacheLoaded = true;
    } catch (e) {
      console.warn("Geocache not loaded:", e);
      _cacheLoaded = true;
    }
  }

  function cacheKey(city, region, country) {
    return `${(city || "").toLowerCase().trim()}|${(region || "").toLowerCase().trim()}|${(country || "").toLowerCase().trim()}`;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function geocodeOne(city, region, country) {
    const key = cacheKey(city, region, country);
    if (_cache[key]) return _cache[key];

    const parts = [city, region, country].filter(Boolean);
    if (!parts.length) return null;
    const query = parts.join(", ");

    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const results = await res.json();
      if (results && results.length) {
        const { lat, lon } = results[0];
        const coord = { lat: parseFloat(lat), lng: parseFloat(lon) };
        _cache[key] = coord;
        return coord;
      }
    } catch (e) {
      console.warn(`Geocode failed for "${query}":`, e);
    }

    _cache[key] = null;
    return null;
  }

  // Geocode all records. Returns records with lat/lng added.
  // onProgress(done, total) called after each lookup.
  async function geocodeAll(records, onProgress) {
    await loadCache();

    // Deduplicate locations to count unique lookups needed
    const unique = [];
    const seen = new Set();
    for (const r of records) {
      const k = cacheKey(r.city, r.region, r.country);
      if (!seen.has(k)) { seen.add(k); unique.push(r); }
    }

    const needsLookup = unique.filter(r => !_cache[cacheKey(r.city, r.region, r.country)]);
    let done = 0;
    const total = needsLookup.length;

    for (const r of needsLookup) {
      await geocodeOne(r.city, r.region, r.country);
      done++;
      if (onProgress) onProgress(done, total);
      if (done < total) await sleep(1100); // Nominatim: max 1 req/sec
    }

    // Apply coordinates to all records
    const geocoded = [];
    for (const r of records) {
      const coord = _cache[cacheKey(r.city, r.region, r.country)];
      if (coord) {
        geocoded.push({ ...r, lat: coord.lat, lng: coord.lng });
      }
    }
    return geocoded;
  }

  return { loadCache, geocodeAll };
})();
