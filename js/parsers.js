// parsers.js
// CSV parsers for Spotify, Meta, Shopify, and YouTube exports.
// Each parser returns an array of records: { source, city, region, country, value }

const Parsers = (function () {

  // Parse a CSV string into array-of-objects using the first row as headers.
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Skip leading metadata rows (YouTube exports have a header block)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      if (lines[i].includes(",")) { headerIdx = i; break; }
    }

    const headers = splitRow(lines[headerIdx]).map(h => h.toLowerCase().trim());

    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = splitRow(lines[i]);
      if (cells.every(c => !c.trim())) continue;
      const obj = {};
      headers.forEach((h, j) => { obj[h] = (cells[j] || "").trim(); });
      rows.push(obj);
    }
    return rows;
  }

  // Handle quoted fields with commas inside them.
  function splitRow(line) {
    const result = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { result.push(cur); cur = ""; continue; }
      cur += ch;
    }
    result.push(cur);
    return result;
  }

  function firstCol(headers, candidates) {
    for (const c of candidates) {
      if (headers.includes(c.toLowerCase())) return c.toLowerCase();
    }
    return null;
  }

  function parseNum(s) {
    if (!s) return 0;
    const n = parseFloat(String(s).replace(/,/g, "").trim());
    return isNaN(n) ? 0 : n;
  }

  // ---- Spotify ----
  // Expected CSV columns: city, country, listeners (or monthly listeners)
  function parseSpotify(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { records: [], error: "No data rows found." };

    const headers = Object.keys(rows[0]);
    const cityCol    = firstCol(headers, ["city"]);
    const countryCol = firstCol(headers, ["country"]);
    const valueCol   = firstCol(headers, ["monthly listeners", "listeners", "monthly_listeners"]);

    if (!cityCol || !countryCol || !valueCol) {
      return {
        records: [],
        error: `Unexpected columns: ${headers.join(", ")}. Expected: city, country, listeners.`,
      };
    }

    const records = [];
    for (const row of rows) {
      const city    = row[cityCol] || "";
      const country = row[countryCol] || "";
      const value   = parseNum(row[valueCol]);
      if (!country || value <= 0) continue;
      records.push({ source: "spotify", city, region: "", country, value });
    }
    return { records, error: null };
  }

  // ---- Meta ----
  // Columns: country or region (or "dma region"), reach/impressions/results, amount spent (optional)
  const META_GEO_COLS   = ["country", "region", "country or region", "delivery", "dma region"];
  const META_VALUE_COLS = ["reach", "impressions", "results"];
  const META_SPEND_COLS = ["amount spent (usd)", "amount spent", "spend"];

  function parseMeta(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { records: [], error: "No data rows found." };

    const headers = Object.keys(rows[0]);
    const geoCol   = firstCol(headers, META_GEO_COLS);
    const valueCol = firstCol(headers, META_VALUE_COLS);

    if (!geoCol || !valueCol) {
      return {
        records: [],
        error: `Unexpected columns: ${headers.join(", ")}. Expected a geography column (country/region) and a reach/impressions column.`,
      };
    }

    const spendCol = firstCol(headers, META_SPEND_COLS);
    const isDMA = geoCol === "dma region";

    const records = [];
    for (const row of rows) {
      const geoRaw = row[geoCol] || "";
      if (!geoRaw || ["nan", "total", "unknown", ""].includes(geoRaw.toLowerCase())) continue;
      const value = parseNum(row[valueCol]);
      if (value <= 0) continue;
      const spend = spendCol ? parseNum(row[spendCol]) : 0;

      let city = "", region = "", country = "";
      if (isDMA) {
        city = geoRaw; country = "United States";
      } else {
        const parts = geoRaw.split(",").map(s => s.trim());
        if (parts.length >= 2) {
          region = parts[0]; country = parts[parts.length - 1];
        } else {
          country = parts[0];
        }
      }

      records.push({ source: "meta", city, region, country, value, spend });
    }
    return { records, error: null };
  }

  // ---- Shopify ----
  // Handles both Customers by Location and Sessions by Location reports.
  const SHOPIFY_CITY_COLS    = ["city", "customer city", "session city", "billing city", "shipping city"];
  const SHOPIFY_REGION_COLS  = ["region", "customer region", "session region", "province", "state", "billing province", "shipping province"];
  const SHOPIFY_COUNTRY_COLS = ["country", "customer country", "session country", "billing country", "shipping country"];
  const SHOPIFY_CUSTOMER_VAL = ["customers", "customer count", "buyers", "new customer records", "customer records", "count"];
  const SHOPIFY_SESSION_VAL  = ["sessions", "online store visitors", "visits", "session count"];

  const ISO2_COUNTRY = {
    US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
    NZ: "New Zealand",   DE: "Germany",        FR: "France", IT: "Italy",
    ES: "Spain",         NL: "Netherlands",    SE: "Sweden", NO: "Norway",
    DK: "Denmark",       FI: "Finland",        CH: "Switzerland", AT: "Austria",
    BE: "Belgium",       PT: "Portugal",       IE: "Ireland", PL: "Poland",
    MX: "Mexico",        BR: "Brazil",         JP: "Japan",   KR: "South Korea",
    IN: "India",         ZA: "South Africa",   SG: "Singapore",
  };

  const SKIP_CITIES = new Set(["zz", "xx", "na", "n/a", "unknown", "other", "none", "-"]);
  const ISO_REGION_PAT = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

  function parseShopify(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { records: [], error: "No data rows found." };

    const headers = Object.keys(rows[0]);
    const cityCol    = firstCol(headers, SHOPIFY_CITY_COLS);
    const regionCol  = firstCol(headers, SHOPIFY_REGION_COLS);
    const countryCol = firstCol(headers, SHOPIFY_COUNTRY_COLS);

    if (!countryCol) {
      return {
        records: [],
        error: `Unexpected columns: ${headers.join(", ")}. Expected a country column.`,
      };
    }

    // Detect report type
    const valueCol = firstCol(headers, SHOPIFY_CUSTOMER_VAL) || firstCol(headers, SHOPIFY_SESSION_VAL);
    const isSession = !!firstCol(headers, SHOPIFY_SESSION_VAL);
    const sourceName = isSession ? "shopify_sessions" : "shopify_customers";

    const buckets = {};
    for (const row of rows) {
      let city    = cityCol    ? (row[cityCol]    || "") : "";
      let region  = regionCol  ? (row[regionCol]  || "") : "";
      let country = countryCol ? (row[countryCol] || "") : "";

      if (!country || country.toLowerCase() === "nan") continue;

      // Expand ISO country codes
      country = ISO2_COUNTRY[country.toUpperCase()] || country;

      // Drop ISO region codes (e.g. "US-TX")
      if (ISO_REGION_PAT.test(region)) region = "";

      // Skip placeholder city codes
      if (SKIP_CITIES.has(city.toLowerCase()) || (city.length <= 2 && city === city.toUpperCase())) {
        city = "";
      }

      const count = valueCol ? (parseNum(row[valueCol]) || 1) : 1;
      const key = `${city}|${region}|${country}`;
      if (!buckets[key]) {
        buckets[key] = { city, region, country, count: 0 };
      }
      buckets[key].count += count;
    }

    const records = Object.values(buckets)
      .filter(b => b.count > 0 && b.country)
      .map(b => ({ source: sourceName, city: b.city, region: b.region, country: b.country, value: b.count }));

    return { records, error: null };
  }

  // ---- YouTube ----
  // Columns: geography / country/territory / city, views / watch time (hours)
  const YT_GEO_COLS   = ["geography", "country/territory", "country", "city", "city name"];
  const YT_VALUE_COLS = ["views", "watch time (hours)"];
  const YT_CITY_LEVEL = new Set(["city", "city name"]);

  function parseYouTube(text) {
    // YouTube exports have a metadata header — try skipping 1 row first
    let rows = parseCSVSkip(text, 1);
    if (!rows.length || !firstCol(Object.keys(rows[0]), YT_GEO_COLS)) {
      rows = parseCSV(text);
    }
    if (!rows.length) return { records: [], error: "No data rows found." };

    const headers = Object.keys(rows[0]);
    const geoCol   = firstCol(headers, YT_GEO_COLS);
    const valueCol = firstCol(headers, YT_VALUE_COLS);

    if (!geoCol || !valueCol) {
      return {
        records: [],
        error: `Unexpected columns: ${headers.join(", ")}. Expected a geography column and a views column.`,
      };
    }

    const isCityLevel = YT_CITY_LEVEL.has(geoCol);
    const hasDate = headers.includes("date");

    // If time-series city data, aggregate totals per city
    const totals = {};
    for (const row of rows) {
      const geo = (row[geoCol] || "").trim();
      if (!geo || ["nan", "total", ""].includes(geo.toLowerCase())) continue;
      const val = parseNum(row[valueCol]);
      if (val <= 0) continue;
      totals[geo] = (totals[geo] || 0) + val;
    }

    const records = [];
    for (const [geo, value] of Object.entries(totals)) {
      let city = "", region = "", country = "";
      if (isCityLevel) {
        const raw = geo.replace(/,$/, "").trim();
        const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
        if (parts.length >= 3) {
          city = parts[0]; region = parts.slice(1, -1).join(", "); country = parts[parts.length - 1];
        } else if (parts.length === 2) {
          city = parts[0]; country = parts[1];
        } else {
          city = parts[0];
        }
      } else {
        country = geo;
      }
      records.push({ source: "youtube", city, region, country, value: Math.round(value) });
    }
    return { records, error: null };
  }

  function parseCSVSkip(text, skip) {
    const lines = text.trim().split(/\r?\n/).slice(skip);
    return parseCSV(lines.join("\n"));
  }

  // ---- Spotify OCR (screenshot parsing) ----

  const US_STATES = new Set([
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
    "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
    "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
    "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
    "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
    "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
    "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
    "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
    "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
  ]);

  function parseListenerCount(raw) {
    if (!raw) return 0;
    const s = String(raw).replace(/,/g, "").trim();
    const kMatch = s.match(/^([\d.]+)[Kk]$/);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
    const mMatch = s.match(/^([\d.]+)[Mm]$/);
    if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000);
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n);
  }

  // Parse OCR text extracted from a Spotify for Artists "Top cities" screenshot.
  // Handles both single-line ("Nashville, TN  12,456") and tabular formats.
  function parseSpotifyOCR(text) {
    const lines = text.split(/\r?\n/);
    const records = [];

    // Lines to skip (headers / labels)
    const SKIP_RE = /^(top\s*cities?|city|monthly\s*listeners?|listeners?|country|rank|#\s*$|\s*$)/i;
    // Pattern: optional leading rank, then location text, then a number at the end
    const LINE_RE = /^(?:\d+[.):\s]+)?(.+?)\s{2,}([\d,]+(?:\.\d+)?[KkMm]?)\s*$/;
    // Fallback: any line ending with a number after whitespace
    const FALLBACK_RE = /^(.+?)\s+([\d,]+(?:\.\d+)?[KkMm]?)\s*$/;

    for (let line of lines) {
      line = line.trim();
      if (!line || SKIP_RE.test(line)) continue;

      let locationRaw = null, countRaw = null;

      const m = LINE_RE.exec(line) || FALLBACK_RE.exec(line);
      if (!m) continue;

      locationRaw = m[1].trim().replace(/^\d+[.):\s]+/, "").trim();
      countRaw = m[2];

      const count = parseListenerCount(countRaw);
      if (count < 100) continue; // too small to be a listener count

      // Parse location: "City, State" / "City, Country" / "City"
      let city = "", country = "";
      const parts = locationRaw.split(/,\s*/).filter(Boolean);
      if (parts.length >= 2) {
        city = parts[0].trim();
        const qualifier = parts[parts.length - 1].trim();
        if (US_STATES.has(qualifier) || US_STATES.has(qualifier.toUpperCase())) {
          country = "United States";
        } else {
          country = qualifier;
        }
      } else {
        city = parts[0] || locationRaw;
      }

      if (!city) continue;
      records.push({ source: "spotify", city, region: "", country, value: count });
    }

    if (!records.length) {
      return {
        records: [],
        error: "No city data found in screenshot. Try the CSV template instead.",
      };
    }
    return { records, error: null };
  }

  // ---- Detect source from filename ----
  function detectSource(filename) {
    const f = filename.toLowerCase();
    if (f.includes("spotify"))  return "spotify";
    if (f.includes("meta") || f.includes("facebook") || f.includes("ads")) return "meta";
    if (f.includes("shopify"))  return "shopify";
    if (f.includes("youtube") || f.includes("yt_")) return "youtube";
    return null;
  }

  // ---- Spotify CSV template ----
  function spotifyTemplate() {
    return "city,country,listeners\nNashville,United States,4200\nLos Angeles,United States,3800\nNew York,United States,3100\n";
  }

  return { parseSpotify, parseSpotifyOCR, parseMeta, parseShopify, parseYouTube, detectSource, spotifyTemplate };
})();
