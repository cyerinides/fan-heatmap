// map-renderer.js
// Renders a Leaflet map with switchable heat + dot layers for each view.

const MapRenderer = (function () {

  const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const VIEW_STYLES = {
    listeners: {
      gradient:     { 0.2: "#44e5e7", 0.6: "#c3f5f8", 1.0: "#ffffff" },
      markerColor:  "#44e5e7",
    },
    customers: {
      gradient:     { 0.2: "#c082c4", 0.6: "#e9d1ea", 1.0: "#ffffff" },
      markerColor:  "#c082c4",
    },
    blended: {
      gradient:     { 0.2: "#ff6f59", 0.55: "#ffe047", 1.0: "#ffffff" },
      markerColor:  "#ff6f59",
    },
  };

  const SOURCE_LABELS = {
    spotify:           "Spotify",
    meta:              "Meta Ads",
    shopify_customers: "Shopify Buyers",
    shopify_sessions:  "Shopify Sessions",
    youtube:           "YouTube",
  };

  // Build and return a map instance. viewLocations: { listeners: [...], customers: [...], blended: [...] }
  function create(containerId, viewLocations, options = {}) {
    const defaultCenter = options.center || [30, -20];
    const defaultZoom   = options.zoom   || 2;

    const map = L.map(containerId, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);

    // Build layers for all views
    const layers = {};
    for (const [viewKey, locations] of Object.entries(viewLocations)) {
      if (!locations || !locations.length) continue;
      layers[viewKey] = buildLayers(map, locations, viewKey);
    }

    // Show first available view
    const firstKey = Object.keys(layers)[0];
    if (firstKey) showView(layers, firstKey);

    // Fit map to data bounds
    const allLocs = Object.values(viewLocations).flat();
    if (allLocs.length) {
      const lats = allLocs.map(l => l.lat);
      const lngs = allLocs.map(l => l.lng);
      const pad = 0.2;
      map.fitBounds([
        [Math.min(...lats) - pad, Math.min(...lngs) - pad],
        [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      ], { padding: [20, 20] });
    }

    return { map, layers, showView: (k) => showView(layers, k) };
  }

  function buildLayers(map, locations, viewKey) {
    const style = VIEW_STYLES[viewKey] || VIEW_STYLES.blended;
    const top25 = locations.slice(0, 25);

    // HeatMap layer
    const heatData = locations.map(l => [l.lat, l.lng, l.score]);
    const heat = L.heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 10,
      max: 1.0,
      gradient: style.gradient,
    });

    // Dot + popup layer
    const markerGroup = L.layerGroup();
    const minRadius = 4, maxRadius = 14;
    for (const loc of top25) {
      const r = minRadius + (maxRadius - minRadius) * loc.score;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: r,
        color: style.markerColor,
        fillColor: style.markerColor,
        fillOpacity: 0.8,
        weight: 0,
      });
      marker.bindPopup(buildPopup(loc), { maxWidth: 220 });
      marker.addTo(markerGroup);
    }

    return { heat, markers: markerGroup };
  }

  function showView(layers, viewKey) {
    for (const [k, { heat, markers }] of Object.entries(layers)) {
      if (k === viewKey) {
        heat.addTo(arguments[0]._map || heat._map || findMap(heat));
        markers.addTo(arguments[0]._map || markers._map || findMap(markers));
      }
    }
    // Hide all, then show active
    for (const { heat, markers } of Object.values(layers)) {
      removeIfOnMap(heat);
      removeIfOnMap(markers);
    }
    if (layers[viewKey]) {
      layers[viewKey].heat.addTo(layers[viewKey].heat._map || getMapFromLayer(layers[viewKey].heat));
      layers[viewKey].markers.addTo(layers[viewKey].markers._map || getMapFromLayer(layers[viewKey].markers));
    }
  }

  // Simpler approach: keep a reference to the map
  function createRenderer(containerId, viewLocations, options = {}) {
    const defaultZoom = options.zoom || 2;

    const map = L.map(containerId, {
      center: options.center || [30, -20],
      zoom: defaultZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);

    // Build layer groups per view
    const viewGroups = {};
    for (const [viewKey, locations] of Object.entries(viewLocations)) {
      if (!locations || !locations.length) continue;
      viewGroups[viewKey] = buildViewGroup(locations, viewKey);
    }

    let activeView = null;

    function switchTo(viewKey) {
      if (activeView && viewGroups[activeView]) {
        viewGroups[activeView].heat.removeFrom(map);
        viewGroups[activeView].markers.removeFrom(map);
      }
      if (viewGroups[viewKey]) {
        viewGroups[viewKey].heat.addTo(map);
        viewGroups[viewKey].markers.addTo(map);
        activeView = viewKey;
      }
    }

    // Start with listeners (or first available)
    const startView = viewGroups.listeners ? "listeners" : Object.keys(viewGroups)[0];
    if (startView) switchTo(startView);

    // Fit bounds
    const allLocs = Object.values(viewLocations).flat().filter(l => l.lat && l.lng);
    if (allLocs.length) {
      const lats = allLocs.map(l => l.lat);
      const lngs = allLocs.map(l => l.lng);
      try {
        map.fitBounds([
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ], { padding: [30, 30], maxZoom: 6 });
      } catch (e) {
        map.setView([30, -20], 2);
      }
    }

    return { map, switchTo };
  }

  function buildViewGroup(locations, viewKey) {
    const style = VIEW_STYLES[viewKey] || VIEW_STYLES.blended;

    // Heat layer
    const heatData = locations.map(l => [l.lat, l.lng, l.score]);
    const heat = L.heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 10,
      max: 1.0,
      gradient: style.gradient,
    });

    // Marker layer (top 30 cities)
    const markers = L.layerGroup();
    const top = locations.slice(0, 30);
    const minR = 4, maxR = 14;
    for (const loc of top) {
      const r = Math.round(minR + (maxR - minR) * loc.score);
      const m = L.circleMarker([loc.lat, loc.lng], {
        radius: r,
        color: "rgba(0,0,0,0.3)",
        weight: 1,
        fillColor: style.markerColor,
        fillOpacity: 0.85,
      });
      m.bindPopup(buildPopup(loc), { maxWidth: 240 });
      m.addTo(markers);
    }

    return { heat, markers };
  }

  function buildPopup(loc) {
    const pct = Math.round(loc.score * 100);
    let html = `<div class="popup-city">${loc.city || loc.country}</div>`;
    if (loc.country && loc.country !== loc.city) {
      html += `<div class="popup-score">${loc.country} &mdash; score: ${pct}%</div>`;
    } else {
      html += `<div class="popup-score">Score: ${pct}%</div>`;
    }
    if (loc.breakdown && Object.keys(loc.breakdown).length) {
      html += `<div class="popup-breakdown">`;
      for (const [src, val] of Object.entries(loc.breakdown).sort(([,a],[,b]) => b - a)) {
        const srcPct = Math.round((val / loc.score) * 100);
        const label = SOURCE_LABELS[src] || src;
        html += `<div><span class="popup-source-label">${label}:</span> ${srcPct}%</div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  return { createRenderer };
})();
