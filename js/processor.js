// processor.js
// Normalizes, weights, and aggregates records from all sources into
// scored geographic locations for each map view.

const Processor = (function () {

  const COUNTRY_ALIASES = {
    "uk":                  "United Kingdom",
    "usa":                 "United States",
    "us":                  "United States",
    "czechia":             "Czech Republic",
    "türkiye":             "Turkey",
    "turkiye":             "Turkey",
    "holland":             "Netherlands",
    "the netherlands":     "Netherlands",
    "republic of ireland": "Ireland",
    "south korea":         "South Korea",
    "republic of korea":   "South Korea",
  };

  const WEIGHT_PROFILES = {
    listeners: {
      label: "Listeners",
      description: "Reach — where people are listening and watching",
      spotify: 0.60, meta: 0.00, shopify_customers: 0.00, shopify_sessions: 0.00, youtube: 0.40,
    },
    customers: {
      label: "Customers",
      description: "Buyers — where fans are spending money",
      spotify: 0.00, meta: 0.10, shopify_customers: 0.65, shopify_sessions: 0.25, youtube: 0.00,
    },
    blended: {
      label: "Blended",
      description: "All signals — best overall picture",
      spotify: 0.25, meta: 0.15, shopify_customers: 0.30, shopify_sessions: 0.15, youtube: 0.15,
    },
  };

  function normalizeCountry(name) {
    if (!name) return name;
    return COUNTRY_ALIASES[name.toLowerCase().trim()] || name;
  }

  // Remove country-level records (city="") when city-level data exists for
  // that country from any source — prevents centroid dots when better data exists.
  function filterCountryFallbacks(records) {
    const hasCities = new Set();
    for (const r of records) {
      if (r.city && r.city.trim()) hasCities.add((r.country || "").toLowerCase().trim());
    }
    return records.filter(r => {
      if (!r.city || !r.city.trim()) {
        return !hasCities.has((r.country || "").toLowerCase().trim());
      }
      return true;
    });
  }

  // Scale each source's values to 0–1 relative to that source's max.
  function normalizeBySource(records) {
    const sources = [...new Set(records.map(r => r.source))];
    const out = [];
    for (const src of sources) {
      const batch = records.filter(r => r.source === src);
      const maxVal = Math.max(...batch.map(r => r.value));
      const minVal = Math.min(...batch.map(r => r.value));
      const span = (maxVal - minVal) || 1;
      for (const r of batch) {
        out.push({ ...r, normalized: (r.value - minVal) / span });
      }
    }
    return out;
  }

  // Weight + aggregate by (lat, lng) bucket. Returns scored location list.
  function computeView(prepared, weights) {
    const numericWeights = Object.fromEntries(
      Object.entries(weights).filter(([k, v]) => typeof v === "number")
    );
    const active = Object.entries(numericWeights).filter(([, w]) => w > 0).map(([s]) => s);
    const relevant = prepared.filter(r => active.includes(r.source));
    if (!relevant.length) return [];

    const buckets = {};
    for (const r of relevant) {
      const w = numericWeights[r.source] || 0;
      const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
      if (!buckets[key]) {
        buckets[key] = {
          lat: r.lat, lng: r.lng,
          city: r.city || r.region || r.country || "",
          country: r.country || "",
          score: 0,
          breakdown: {},
        };
      }
      buckets[key].score += r.normalized * w;
      const src = r.source;
      buckets[key].breakdown[src] = (buckets[key].breakdown[src] || 0) + r.normalized * w;
    }

    const locs = Object.values(buckets);
    const maxScore = Math.max(...locs.map(l => l.score)) || 1;
    for (const l of locs) {
      l.score = Math.round((l.score / maxScore) * 1000) / 1000;
    }
    return locs.sort((a, b) => b.score - a.score);
  }

  // Full pipeline: raw records → view locations (requires geocoding step in between)
  function prepareRecords(rawRecords) {
    const normalized = rawRecords.map(r => ({
      ...r,
      country: normalizeCountry(r.country),
    }));
    const filtered = filterCountryFallbacks(normalized);
    return normalizeBySource(filtered);
  }

  function computeAllViews(prepared) {
    return {
      listeners: computeView(prepared, WEIGHT_PROFILES.listeners),
      customers:  computeView(prepared, WEIGHT_PROFILES.customers),
      blended:    computeView(prepared, WEIGHT_PROFILES.blended),
    };
  }

  return { prepareRecords, computeAllViews, WEIGHT_PROFILES };
})();
