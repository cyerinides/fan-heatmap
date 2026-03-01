// app.js
// Main application — initializes demo map, handles email gate,
// file uploads, processing pipeline, and results map.

// ---- HubSpot configuration ----
// Fill in your HubSpot portal ID and form ID before going live.
const HUBSPOT_PORTAL_ID = "244429096";
const HUBSPOT_FORM_ID   = "42a795ee-f7b8-4c09-b2ed-73f8ec5a78b9";

(function () {

  // ---- State ----
  const uploadedFiles = {}; // { spotify: File, meta: File, shopify: File, youtube: File }
  let demoRenderer   = null;
  let resultsRenderer = null;

  // ---- DOM refs ----
  const emailGate      = document.getElementById("email-gate");
  const emailInput     = document.getElementById("email-input");
  const emailSubmit    = document.getElementById("email-submit");
  const emailError     = document.getElementById("email-error");
  const uploadUI       = document.getElementById("upload-ui");
  const generateBtn    = document.getElementById("generate-btn");
  const generateHint   = document.getElementById("generate-hint");
  const progressSection = document.getElementById("progress-section");
  const progressBar    = document.getElementById("progress-bar");
  const progressLabel  = document.getElementById("progress-label");
  const processError   = document.getElementById("process-error");
  const resultsSection = document.getElementById("results-section");
  const resetBtn       = document.getElementById("reset-btn");

  // ---- Init ----
  document.addEventListener("DOMContentLoaded", () => {
    initDemoMap();
    initEmailGate();
    initFileUploads();
    initTemplateLinks();
    initResetButton();
  });

  // ---- Demo map ----
  function initDemoMap() {
    demoRenderer = MapRenderer.createRenderer("demo-map", DEMO_VIEWS, { zoom: 2 });
    wireTabs("demo-tabs", (view) => demoRenderer.switchTo(view));
  }

  // ---- Tab wiring ----
  function wireTabs(tabsId, onSwitch) {
    const container = document.getElementById(tabsId);
    if (!container) return;
    container.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        onSwitch(btn.dataset.view);
      });
    });
  }

  // ---- Email gate ----
  function initEmailGate() {
    emailSubmit.addEventListener("click", handleEmailSubmit);
    emailInput.addEventListener("keydown", e => {
      if (e.key === "Enter") handleEmailSubmit();
    });
  }

  function handleEmailSubmit() {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      emailError.classList.remove("hidden");
      emailInput.focus();
      return;
    }
    emailError.classList.add("hidden");
    submitToHubSpot(email);
    revealUploadUI();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function revealUploadUI() {
    emailGate.classList.add("hidden");
    uploadUI.classList.remove("hidden");
  }

  async function submitToHubSpot(email) {
    if (HUBSPOT_PORTAL_ID === "YOUR_PORTAL_ID") return; // Not yet configured
    try {
      await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: [{ name: "email", value: email }],
          context: { pageUri: window.location.href, pageName: "Fan Heat Map" },
        }),
      });
    } catch (e) {
      // Non-blocking — don't interrupt the user experience
      console.warn("HubSpot submission failed:", e);
    }
  }

  // ---- File uploads ----
  function initFileUploads() {
    document.querySelectorAll(".dropzone").forEach(zone => {
      const source = zone.dataset.source;
      const input  = zone.querySelector(".file-input");
      const label  = zone.querySelector(".file-name");
      const card   = zone.closest(".source-card");

      // Click on zone triggers file input
      zone.addEventListener("click", e => {
        if (e.target !== input) input.click();
      });

      // Drag-and-drop styles
      zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", e => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) handleFile(source, file, label, card);
      });

      input.addEventListener("change", () => {
        if (input.files[0]) handleFile(source, input.files[0], label, card);
      });
    });
  }

  function handleFile(source, file, labelEl, card) {
    uploadedFiles[source] = file;
    labelEl.textContent = file.name;
    card.classList.add("has-file");
    updateGenerateButton();
  }

  function updateGenerateButton() {
    const hasAny = Object.keys(uploadedFiles).length > 0;
    generateBtn.disabled = !hasAny;
    generateHint.textContent = hasAny ? "Ready to generate your map" : "Upload at least one file above";
    generateBtn.onclick = hasAny ? handleGenerate : null;
  }

  // ---- Spotify template download ----
  function initTemplateLinks() {
    document.querySelectorAll(".template-link").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const source = link.dataset.source;
        if (source === "spotify") downloadSpotifyTemplate();
      });
    });
  }

  function downloadSpotifyTemplate() {
    const csv = Parsers.spotifyTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spotify-cities-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Generate ----
  async function handleGenerate() {
    generateBtn.disabled = true;
    processError.classList.add("hidden");
    progressSection.classList.remove("hidden");
    setProgress(0, "Reading files...");

    try {
      // 1. Parse all uploaded CSVs
      const allRecords = [];
      const parseErrors = [];

      for (const [source, file] of Object.entries(uploadedFiles)) {
        let result;
        if (source === "spotify" && isImageFile(file)) {
          result = await runSpotifyOCR(file);
        } else {
          const text = await readFileText(file);
          if (source === "spotify")       result = Parsers.parseSpotify(text);
          else if (source === "meta")     result = Parsers.parseMeta(text);
          else if (source === "shopify")  result = Parsers.parseShopify(text);
          else if (source === "youtube")  result = Parsers.parseYouTube(text);
          else continue;
        }

        if (result.error) {
          parseErrors.push(`${source}: ${result.error}`);
        } else {
          allRecords.push(...result.records);
        }
      }

      if (parseErrors.length && !allRecords.length) {
        throw new Error(parseErrors.join("\n"));
      }

      if (!allRecords.length) throw new Error("No valid records found in any uploaded file.");
      setProgress(15, `Loaded ${allRecords.length} records. Preparing...`);

      // 2. Normalize countries + filter country fallbacks
      const prepared = Processor.prepareRecords(allRecords);
      setProgress(20, "Looking up city coordinates...");

      // 3. Geocode
      const needsLookup = countCacheMisses(prepared);
      const geocoded = await Geocoder.geocodeAll(prepared, (done, total) => {
        const pct = 20 + Math.round((done / (total || 1)) * 60);
        const eta = (total - done);
        const etaStr = eta > 0 ? ` (~${eta}s remaining)` : "";
        setProgress(pct, `Looking up coordinates: ${done}/${total}${etaStr}`);
      });

      if (!geocoded.length) throw new Error("No locations could be geocoded. Check your file formats.");
      setProgress(82, "Computing views...");

      // 4. Compute views
      const views = Processor.computeAllViews(geocoded);
      const viewCounts = Object.values(views).map(v => v.length);
      if (viewCounts.every(c => c === 0)) throw new Error("No data available for any map view.");
      setProgress(92, "Rendering map...");

      // 5. Render results
      renderResults(views);
      setProgress(100, "Done.");

      // Show parse warnings if any
      if (parseErrors.length) {
        processError.textContent = `Note: some files had issues — ${parseErrors.join("; ")}`;
        processError.classList.remove("hidden");
      }

    } catch (err) {
      processError.textContent = `Error: ${err.message}`;
      processError.classList.remove("hidden");
      progressSection.classList.add("hidden");
      generateBtn.disabled = false;
    }
  }

  function countCacheMisses(records) {
    // Rough estimate — actual count handled inside geocoder
    return records.length;
  }

  function setProgress(pct, label) {
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = label;
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsText(file);
    });
  }

  // ---- Results map ----
  function renderResults(views) {
    progressSection.classList.add("hidden");
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Destroy previous map if any
    if (resultsRenderer) {
      resultsRenderer.map.remove();
      resultsRenderer = null;
    }

    // Re-create the container (Leaflet needs a fresh DOM element)
    const oldMap = document.getElementById("results-map");
    const newMap = document.createElement("div");
    newMap.id = "results-map";
    newMap.className = "map-container";
    oldMap.replaceWith(newMap);

    resultsRenderer = MapRenderer.createRenderer("results-map", views, { zoom: 2 });
    wireTabs("results-tabs", (view) => resultsRenderer.switchTo(view));
  }

  // ---- Spotify OCR ----

  function isImageFile(file) {
    return /\.(png|jpe?g)$/i.test(file.name) || (file.type && file.type.startsWith("image/"));
  }

  async function runSpotifyOCR(file) {
    const ocrProgress = document.getElementById("ocr-progress");
    const ocrBar      = document.getElementById("ocr-bar");
    const ocrLabel    = document.getElementById("ocr-label");

    ocrProgress.classList.remove("hidden");
    ocrBar.style.width = "0%";
    ocrLabel.textContent = "Reading screenshot...";

    try {
      const { data: { text } } = await Tesseract.recognize(file, "eng", {
        logger: m => {
          if (m.status === "recognizing text") {
            const pct = Math.round(m.progress * 100);
            ocrBar.style.width = `${pct}%`;
            ocrLabel.textContent = `Reading screenshot... ${pct}%`;
          }
        },
      });
      ocrProgress.classList.add("hidden");
      return Parsers.parseSpotifyOCR(text);
    } catch (e) {
      ocrProgress.classList.add("hidden");
      return { records: [], error: `Could not read screenshot: ${e.message}` };
    }
  }

  // ---- Reset ----
  function initResetButton() {
    resetBtn.addEventListener("click", () => {
      // Clear state
      for (const k of Object.keys(uploadedFiles)) delete uploadedFiles[k];
      document.querySelectorAll(".source-card").forEach(c => c.classList.remove("has-file"));
      document.querySelectorAll(".file-name").forEach(el => { el.textContent = ""; });
      document.querySelectorAll(".file-input").forEach(el => { el.value = ""; });

      // Reset UI
      resultsSection.classList.add("hidden");
      uploadUI.classList.remove("hidden");
      processError.classList.add("hidden");
      progressSection.classList.add("hidden");
      generateBtn.disabled = true;
      generateHint.textContent = "Upload at least one file above";

      if (resultsRenderer) {
        resultsRenderer.map.remove();
        resultsRenderer = null;
      }
    });
  }

})();
