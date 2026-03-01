// demo-data.js
// Pre-computed synthetic data for a fictional band (~50k monthly Spotify listeners).
// All lat/long already resolved — no geocoding needed for the demo.

const DEMO_VIEWS = (function () {

  // Raw synthetic records (already geocoded)
  const raw = [
    // Spotify — city-level listeners
    { source: "spotify", city: "Nashville",     country: "United States", lat: 36.1623, lng: -86.7743, value: 4200 },
    { source: "spotify", city: "Los Angeles",   country: "United States", lat: 34.0537, lng: -118.2428, value: 3800 },
    { source: "spotify", city: "New York",      country: "United States", lat: 40.7127, lng: -74.0060,  value: 3100 },
    { source: "spotify", city: "Chicago",       country: "United States", lat: 41.8756, lng: -87.6244,  value: 2400 },
    { source: "spotify", city: "Austin",        country: "United States", lat: 30.2711, lng: -97.7437,  value: 2200 },
    { source: "spotify", city: "Seattle",       country: "United States", lat: 47.6062, lng: -122.3321, value: 1900 },
    { source: "spotify", city: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194, value: 1650 },
    { source: "spotify", city: "Atlanta",       country: "United States", lat: 33.7490, lng: -84.3880,  value: 1700 },
    { source: "spotify", city: "Denver",        country: "United States", lat: 39.7392, lng: -104.9903, value: 1400 },
    { source: "spotify", city: "Portland",      country: "United States", lat: 45.5051, lng: -122.6750, value: 1200 },
    { source: "spotify", city: "Boston",        country: "United States", lat: 42.3601, lng: -71.0589,  value: 1100 },
    { source: "spotify", city: "Minneapolis",   country: "United States", lat: 44.9778, lng: -93.2650,  value: 920 },
    { source: "spotify", city: "Phoenix",       country: "United States", lat: 33.4484, lng: -112.0740, value: 860 },
    { source: "spotify", city: "Philadelphia",  country: "United States", lat: 39.9526, lng: -75.1652,  value: 900 },
    { source: "spotify", city: "Dallas",        country: "United States", lat: 32.7767, lng: -96.7970,  value: 800 },
    { source: "spotify", city: "Kansas City",   country: "United States", lat: 39.0997, lng: -94.5786,  value: 620 },
    { source: "spotify", city: "St. Louis",     country: "United States", lat: 38.6270, lng: -90.1994,  value: 540 },
    { source: "spotify", city: "London",        country: "United Kingdom", lat: 51.5074, lng: -0.1278,  value: 750 },
    { source: "spotify", city: "Manchester",    country: "United Kingdom", lat: 53.4808, lng: -2.2426,  value: 340 },
    { source: "spotify", city: "Toronto",       country: "Canada",         lat: 43.6532, lng: -79.3832, value: 620 },
    { source: "spotify", city: "Vancouver",     country: "Canada",         lat: 49.2827, lng: -123.1207, value: 380 },
    { source: "spotify", city: "Melbourne",     country: "Australia",      lat: -37.8136, lng: 144.9631, value: 480 },
    { source: "spotify", city: "Sydney",        country: "Australia",      lat: -33.8688, lng: 151.2093, value: 440 },
    { source: "spotify", city: "Berlin",        country: "Germany",        lat: 52.5200, lng: 13.4050,  value: 290 },
    { source: "spotify", city: "Amsterdam",     country: "Netherlands",    lat: 52.3676, lng: 4.9041,   value: 260 },

    // Meta — region-level reach (US states)
    { source: "meta", city: "Tennessee",    country: "United States", lat: 35.8580, lng: -86.3505, value: 18400 },
    { source: "meta", city: "California",   country: "United States", lat: 36.7783, lng: -119.4179, value: 14200 },
    { source: "meta", city: "Texas",        country: "United States", lat: 31.9686, lng: -99.9018,  value: 10800 },
    { source: "meta", city: "New York",     country: "United States", lat: 42.1657, lng: -74.9481,  value: 8600 },
    { source: "meta", city: "Illinois",     country: "United States", lat: 40.3495, lng: -88.9861,  value: 7100 },
    { source: "meta", city: "Washington",   country: "United States", lat: 47.7511, lng: -120.7401, value: 6400 },
    { source: "meta", city: "Oregon",       country: "United States", lat: 44.5720, lng: -122.0709, value: 4900 },
    { source: "meta", city: "Colorado",     country: "United States", lat: 39.5501, lng: -105.7821, value: 5200 },
    { source: "meta", city: "Georgia",      country: "United States", lat: 33.0406, lng: -83.6431,  value: 5800 },
    { source: "meta", city: "Massachusetts", country: "United States", lat: 42.2302, lng: -71.5301, value: 4100 },
    { source: "meta", city: "United Kingdom", country: "United Kingdom", lat: 55.3781, lng: -3.4360, value: 3800 },
    { source: "meta", city: "Canada",        country: "Canada",          lat: 56.1304, lng: -106.3468, value: 2900 },
    { source: "meta", city: "Australia",     country: "Australia",       lat: -25.2744, lng: 133.7751, value: 1800 },

    // Shopify customers — city-level buyers
    { source: "shopify_customers", city: "Nashville",     country: "United States", lat: 36.1623, lng: -86.7743, value: 87 },
    { source: "shopify_customers", city: "Los Angeles",   country: "United States", lat: 34.0537, lng: -118.2428, value: 74 },
    { source: "shopify_customers", city: "New York",      country: "United States", lat: 40.7127, lng: -74.0060,  value: 62 },
    { source: "shopify_customers", city: "Chicago",       country: "United States", lat: 41.8756, lng: -87.6244,  value: 45 },
    { source: "shopify_customers", city: "Austin",        country: "United States", lat: 30.2711, lng: -97.7437,  value: 43 },
    { source: "shopify_customers", city: "Seattle",       country: "United States", lat: 47.6062, lng: -122.3321, value: 38 },
    { source: "shopify_customers", city: "Atlanta",       country: "United States", lat: 33.7490, lng: -84.3880,  value: 31 },
    { source: "shopify_customers", city: "Denver",        country: "United States", lat: 39.7392, lng: -104.9903, value: 28 },
    { source: "shopify_customers", city: "Portland",      country: "United States", lat: 45.5051, lng: -122.6750, value: 22 },
    { source: "shopify_customers", city: "Minneapolis",   country: "United States", lat: 44.9778, lng: -93.2650,  value: 19 },
    { source: "shopify_customers", city: "London",        country: "United Kingdom", lat: 51.5074, lng: -0.1278,  value: 24 },
    { source: "shopify_customers", city: "Toronto",       country: "Canada",         lat: 43.6532, lng: -79.3832, value: 19 },
    { source: "shopify_customers", city: "Melbourne",     country: "Australia",      lat: -37.8136, lng: 144.9631, value: 14 },

    // YouTube — country-level views
    { source: "youtube", city: "United States",  country: "United States",  lat: 37.0902, lng: -95.7129, value: 82000 },
    { source: "youtube", city: "United Kingdom", country: "United Kingdom", lat: 55.3781, lng: -3.4360,  value: 6400 },
    { source: "youtube", city: "Canada",         country: "Canada",         lat: 56.1304, lng: -106.3468, value: 5100 },
    { source: "youtube", city: "Australia",      country: "Australia",      lat: -25.2744, lng: 133.7751, value: 3800 },
    { source: "youtube", city: "Germany",        country: "Germany",        lat: 51.1657, lng: 10.4515,  value: 2100 },
    { source: "youtube", city: "Netherlands",    country: "Netherlands",    lat: 52.1326, lng: 5.2913,   value: 1200 },
  ];

  const WEIGHT_PROFILES = {
    listeners: { spotify: 0.60, meta: 0.00, shopify_customers: 0.00, shopify_sessions: 0.00, youtube: 0.40 },
    customers:  { spotify: 0.00, meta: 0.10, shopify_customers: 0.65, shopify_sessions: 0.25, youtube: 0.00 },
    blended:    { spotify: 0.25, meta: 0.15, shopify_customers: 0.30, shopify_sessions: 0.15, youtube: 0.15 },
  };

  // Normalize per source (0–1), assign lat/lng
  function normalize(records) {
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

  // Weight + aggregate by (lat, lng) bucket
  function computeView(prepared, weights) {
    const active = Object.entries(weights).filter(([, w]) => w > 0).map(([s]) => s);
    const relevant = prepared.filter(r => active.includes(r.source));
    if (!relevant.length) return [];

    const buckets = {};
    for (const r of relevant) {
      const w = weights[r.source] || 0;
      const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
      if (!buckets[key]) {
        buckets[key] = { lat: r.lat, lng: r.lng, city: r.city, country: r.country, score: 0, breakdown: {} };
      }
      buckets[key].score += r.normalized * w;
      buckets[key].breakdown[r.source] = (buckets[key].breakdown[r.source] || 0) + r.normalized * w;
    }

    const locs = Object.values(buckets);
    const maxScore = Math.max(...locs.map(l => l.score)) || 1;
    for (const l of locs) l.score = Math.round((l.score / maxScore) * 1000) / 1000;
    return locs.sort((a, b) => b.score - a.score);
  }

  const prepared = normalize(raw);
  return {
    listeners: computeView(prepared, WEIGHT_PROFILES.listeners),
    customers:  computeView(prepared, WEIGHT_PROFILES.customers),
    blended:    computeView(prepared, WEIGHT_PROFILES.blended),
  };
})();
