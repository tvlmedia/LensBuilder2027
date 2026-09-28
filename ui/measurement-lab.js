(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    section = document.createElement("section");
  section.className = "measurementLab";
  section.innerHTML = `
<h3>Apertures & optical measurement laboratory</h3><p>One prescription image plane for all apertures and fields. Distortion: d-line chief ray at d-line paraxial focus versus EFL × tan(field angle). Fixed-plane mapping is shown separately. T-stop, PSF, MTF and coma metric: UNAVAILABLE.</p>
<div class="labControls"><label>Focus policy<select id="measureFocus"><option value="fixed-prescription">Fixed prescription image plane</option><option value="global-image-plane-variable">Optimize one global image gap (select variable)</option></select></label><label>Physical iris maximum radius mm (blank = captured base aperture)<input id="measureCapacity" type="number" min="0" step="0.1"></label></div>
<table><thead><tr><th>Paraxial f-number</th><th>Optimize</th><th>Validate</th><th>Aperture weight</th><th></th></tr></thead><tbody id="measureApertures"></tbody></table><button id="measureAdd" class="btn">Add aperture</button><button id="measureRead" class="btn">Read analysis JSON into controls</button><button id="measureApply" class="btn">Apply apertures to analysis JSON</button><button id="measureDefaults" class="btn">Rebuild default aperture operands</button>
<details><summary>Structured merit editor (JSON remains available)</summary><p>Units: mm for RMS/color, % for distortion. Scale is the normalization tolerance. Cross-aperture CHANGE = A − B; RATIO = A / B, rejected below denominator floor 1e-9 metric units. Aperture weight A multiplies operand weight. Merit is an objective, not a universal quality rating.</p><button id="measureReadMerit" class="btn">Read operands JSON</button><button id="measureAddMerit" class="btn">Add operand</button><button id="measureWriteMerit" class="btn">Write table to operands JSON</button><div class="meritScroll"><table><thead><tr><th>Enabled</th><th>Metric</th><th>Field</th><th>Aperture A</th><th>Compare B</th><th>Operation</th><th>Mode</th><th>Target or [range]</th><th>Scale</th><th>Weight</th></tr></thead><tbody id="measureMerit"></tbody></table></div></details>
<div class="labActions"><button id="measureAnalyze" class="btn">Dense analysis of captured base</button><label>Preset name<input id="measurePresetName" value="MULTI_APERTURE_TEST"></label><button id="measureSavePreset" class="btn">Save numerical preset</button><select id="measurePresets" aria-label="Numerical presets"></select><button id="measureLoadPreset" class="btn">Load preset</button><button id="measureExport" class="btn">Export analysis JSON</button><button id="measureCSV" class="btn">Export matrix CSV</button></div>
<p id="measureStatus" role="status">Configure apertures, apply them to JSON, then analyze or start Search Lab. The captured prescription remains unchanged.</p>
<div id="measureMatrix"></div><label>Matrix graph<select id="measureMetric"><option value="rmsMm">RMS mm vs field</option><option value="distortionPercent">Distortion % vs field</option><option value="fixedPlaneMappingPercent">Fixed-plane mapping % vs field</option><option value="lateralChiefColorMm">Lateral chief color span mm</option><option value="bestRmsShiftMm">Diagnostic best RMS focus shift mm</option><option value="fieldCurvatureRelativeToAxisMm">Field curvature relative to axis mm</option><option value="astigmaticDifferenceMm">Diagnostic astigmatic separation mm</option></select></label><label>Graph horizontal axis<select id="measureXAxis"><option value="field">Field (one curve per aperture)</option><option value="aperture">f-number (one curve per candidate at selected field)</option></select></label><canvas id="measureGraph" width="900" height="240"></canvas><p id="measureLegend"></p>
<div class="labControls"><label>Inspect aperture<select id="measureInspectAperture"></select></label><label>Inspect field<select id="measureField"></select></label><label>Spot scale<select id="measureScale"><option value="common">Common scale across all fields/apertures/candidates</option><option value="individual">Individual scale</option></select></label></div><div id="measureWaves"></div><div id="measurePlots" class="labComparison"></div><pre id="measureData"></pre>`;
  $("searchLab").querySelector(".labConfig").after(section);
  let apertures = [2, 2.8, 4, 5.6].map((fNumber) => ({
      fNumber,
      optimization: true,
      validation: true,
      weight: 1,
    })),
    operands = [],
    report = null,
    candidates = null;
  const status = (t) => ($("measureStatus").textContent = t),
    guard = (fn) => async () => {
      try {
        await fn();
      } catch (e) {
        status(e.message);
      }
    },
    read = (id) => JSON.parse($(id).value),
    write = (id, v) => ($(id).value = JSON.stringify(v, null, 2)),
    fmt = (x) => (Number.isFinite(x) ? Number(x).toPrecision(6) : "—");
  function input(value, type = "number") {
    const e = document.createElement("input");
    e.type = type;
    if (type === "checkbox") e.checked = value;
    else e.value = value ?? "";
    return e;
  }
  function select(options, value) {
    const e = document.createElement("select");
    for (const t of options) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t || "none";
      e.append(o);
    }
    e.value = value ?? "";
    return e;
  }
  function apertureTable() {
    const b = $("measureApertures");
    b.replaceChildren();
    apertures.forEach((a, i) => {
      const tr = document.createElement("tr");
      for (const k of ["fNumber", "optimization", "validation", "weight"]) {
        const td = document.createElement("td"),
          e = input(a[k], typeof a[k] === "boolean" ? "checkbox" : "number");
        e.setAttribute("aria-label", `Aperture ${i + 1} ${k}`);
        e.onchange = () =>
          (a[k] = e.type === "checkbox" ? e.checked : Number(e.value));
        td.append(e);
        tr.append(td);
      }
      const td = document.createElement("td"),
        remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.className = "btn";
      remove.onclick = () => {
        apertures.splice(i, 1);
        apertureTable();
      };
      td.append(remove);
      tr.append(td);
      b.append(tr);
    });
  }
  function apply() {
    const s = read("labSpec");
    s.apertures = structuredClone(apertures);
    s.focusPolicy = $("measureFocus").value;
    if ($("measureCapacity").value !== "")
      s.maxStopRadiusMm = Number($("measureCapacity").value);
    else delete s.maxStopRadiusMm;
    LBMultiAperture.configuration(s);
    write("labSpec", s);
    return s;
  }
  function meritTable() {
    const body = $("measureMerit");
    body.replaceChildren();
    operands.forEach((o, i) => {
      const tr = document.createElement("tr");
      for (const k of [
        "enabled",
        "metric",
        "field",
        "aperture",
        "compareAperture",
        "operation",
        "type",
        "target",
        "scale",
        "weight",
      ]) {
        const td = document.createElement("td");
        let e;
        if (k === "enabled") e = input(o.enabled !== false, "checkbox");
        else if (k === "metric")
          e = select(
            [
              "efl",
              "bfl",
              "fNumber",
              "rms",
              "tangentialRms",
              "sagittalRms",
              "distortion",
              "lateralColor",
              "longitudinalColor",
              "pupilSurvival",
              "rayLoss",
            ],
            o[k],
          );
        else if (k === "operation") e = select(["", "CHANGE", "RATIO"], o[k]);
        else if (k === "type")
          e = select(
            [
              "TARGET VALUE",
              "TARGET RANGE",
              "MINIMIZE",
              "MAXIMIZE",
              "MINIMUM",
              "MAXIMUM",
            ],
            o[k] || (Array.isArray(o.target) ? "TARGET RANGE" : "TARGET VALUE"),
          );
        else
          e = input(
            k === "target" ? JSON.stringify(o.target) : o[k],
            k === "target" ? "text" : "number",
          );
        e.setAttribute("aria-label", `Operand ${i + 1} ${k}`);
        e.dataset.key = k;
        td.append(e);
        tr.append(td);
      }
      body.append(tr);
    });
  }
  function meritFromTable() {
    return [...$("measureMerit").rows].map((tr) => {
      const o = {};
      for (const e of tr.querySelectorAll("[data-key]")) {
        const k = e.dataset.key;
        if (e.type === "checkbox") o[k] = e.checked;
        else if (e.value !== "")
          o[k] =
            k === "target"
              ? JSON.parse(e.value)
              : e.type === "number"
                ? Number(e.value)
                : e.value;
      }
      return o;
    });
  }
  $("measureAdd").onclick = () => {
    apertures.push({
      fNumber: 8,
      optimization: true,
      validation: true,
      weight: 1,
    });
    apertureTable();
  };
  $("measureRead").onclick = guard(() => {
    const s = read("labSpec");
    apertures = s.apertures ? LBMultiAperture.configuration(s) : apertures;
    $("measureFocus").value = s.focusPolicy || "fixed-prescription";
    $("measureCapacity").value = s.maxStopRadiusMm ?? "";
    apertureTable();
  });
  $("measureApply").onclick = guard(() => {
    apply();
    status(
      "Apertures applied. Existing operands are preserved; give each operand an explicit aperture or rebuild defaults.",
    );
  });
  $("measureDefaults").onclick = guard(() => {
    const s = apply();
    operands = LBMerit.defaultOperands(s);
    write("labOperands", operands);
    meritTable();
    status(
      "Default aperture-specific operands rebuilt. Edit numerical targets as desired.",
    );
  });
  $("measureReadMerit").onclick = guard(() => {
    operands = read("labOperands");
    meritTable();
  });
  $("measureAddMerit").onclick = () => {
    operands = meritFromTable();
    operands.push({
      enabled: true,
      metric: "rms",
      field: 0,
      aperture: apertures[0]?.fNumber || 2,
      type: "TARGET VALUE",
      target: 0,
      scale: 0.05,
      weight: 1,
    });
    meritTable();
  };
  $("measureWriteMerit").onclick = guard(() => {
    operands = meritFromTable();
    LBMerit.validateOperands(operands);
    write("labOperands", operands);
    status("Structured operands written to Search Lab JSON.");
  });
  function download(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const PRESETS = "lensbuilder:numerical-presets:v1";
  function presetList() {
    const ps = JSON.parse(localStorage.getItem(PRESETS) || "{}");
    $("measurePresets").replaceChildren();
    for (const name of Object.keys(ps)) {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      $("measurePresets").append(o);
    }
    return ps;
  }
  $("measureSavePreset").onclick = guard(() => {
    const ps = presetList(),
      name = $("measurePresetName").value.trim();
    if (!name) throw Error("Name required");
    Object.defineProperty(ps, name, {
      value: { spec: read("labSpec"), operands: read("labOperands") },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    localStorage.setItem(PRESETS, JSON.stringify(ps));
    presetList();
    status(
      "Numerical preset saved locally; export important analysis configurations.",
    );
  });
  $("measureLoadPreset").onclick = guard(() => {
    const name = $("measurePresets").value,
      p = presetList()[name];
    if (!p) throw Error("Select a preset");
    write("labSpec", p.spec);
    write("labOperands", p.operands);
    apertures = p.spec.apertures
      ? LBMultiAperture.configuration(p.spec)
      : apertures;
    apertureTable();
    status(
      "Preset loaded into JSON; future experiments use this configuration.",
    );
  });
  // The Search Lab exposes its captured base through an event, not by reading hidden editor state.
  let captured = null;
  document.addEventListener(
    "lb-base-captured",
    (e) => (captured = structuredClone(e.detail)),
  );
  $("measureAnalyze").onclick = guard(async () => {
    if (!captured) throw Error("Capture the editor lens in Search Lab first");
    const spec = apply(),
      base = structuredClone(captured);
    status("Dense multi-aperture analysis running in worker…");
    $("measureAnalyze").disabled = true;
    try {
      const analysis = await new Promise((resolve, reject) => {
        const w = new Worker("./optimization/evaluation-worker.js");
        w.onmessage = ({ data }) => {
          w.terminate();
          data.error ? reject(Error(data.error)) : resolve(data.analysis);
        };
        w.onerror = (e) => {
          w.terminate();
          reject(Error(e.message));
        };
        w.postMessage({ type: "analysis", input: base, spec });
      });
      report = {
        schema: "optical-measurements-1",
        createdAt: new Date().toISOString(),
        software: window.LB_BUILD,
        prescription: base,
        analysis,
      };
      candidates = null;
      renderReport();
      status(
        analysis.valid
          ? "DENSE GEOMETRIC RESULT. Field focus diagnostics are experimental; fixed-plane RMS was not refocused."
          : analysis.errors.join("; "),
      );
    } finally {
      $("measureAnalyze").disabled = false;
    }
  });
  function analyses() {
    if (candidates)
      return candidates.map((c, i) => ({
        name: `Candidate ${i + 1}`,
        a: c.dense.analysis,
      }));
    return report ? [{ name: "Base", a: report.analysis }] : [];
  }
  function aps(a) {
    return (
      a.apertures || [
        { config: { fNumber: a.firstOrder?.fNumber }, analysis: a },
      ]
    );
  }
  function table(headers, rows) {
    const t = document.createElement("table"),
      head = document.createElement("tr");
    headers.forEach((v) => {
      const th = document.createElement("th");
      th.textContent = v;
      head.append(th);
    });
    t.append(head);
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((v) => {
        const td = document.createElement("td");
        td.textContent = typeof v === "number" ? fmt(v) : (v ?? "—");
        tr.append(td);
      });
      t.append(tr);
    });
    return t;
  }
  function matrixRows() {
    return analyses().flatMap(({ name, a }) =>
      aps(a).flatMap((ap) =>
        ap.analysis.fields.map((f) => [
          name,
          ap.config.fNumber,
          f.field,
          ap.analysis.firstOrder?.eflMm,
          ap.analysis.firstOrder?.bflMm,
          ap.analysis.firstOrder?.fNumber,
          f.rmsMm * 1000,
          f.tangentialRmsMm * 1000,
          f.sagittalRmsMm * 1000,
          f.distortionPercent,
          f.fixedPlaneMappingPercent,
          f.lateralChiefColorMm * 1000,
          ap.analysis.longitudinalColorMm,
          f.rayFraction,
          f.diagnosticFocus?.bestRmsShiftMm,
          f.diagnosticFocus?.tangentialShiftMm,
          f.diagnosticFocus?.sagittalShiftMm,
          f.diagnosticFocus?.astigmaticDifferenceMm,
        ]),
      ),
    );
  }
  const headers = [
    "Lens",
    "f/ requested",
    "Field",
    "EFL mm",
    "BFL mm",
    "f/ paraxial",
    "RMS µm",
    "Tangential RMS µm",
    "Sagittal RMS µm",
    "Distortion % (paraxial plane)",
    "Fixed-plane mapping %",
    "Lateral color span µm",
    "Paraxial F-C mm",
    "Pupil survival",
    "Best RMS shift mm",
    "T focus shift mm",
    "S focus shift mm",
    "T-S mm",
  ];
  function renderReport() {
    const all = analyses();
    $("measureMatrix").replaceChildren(table(headers, matrixRows()));
    const apNums = [
      ...new Set(all.flatMap((x) => aps(x.a).map((a) => a.config.fNumber))),
    ];
    $("measureInspectAperture").replaceChildren(
      ...apNums.map((f) => {
        const o = document.createElement("option");
        o.value = f;
        o.textContent = `f/${f}`;
        return o;
      }),
    );
    const fields = all[0]
      ? aps(all[0].a)[0].analysis.fields.map((f) => f.field)
      : [];
    $("measureField").replaceChildren(
      ...fields.map((f) => {
        const o = document.createElement("option");
        o.value = f;
        o.textContent = f;
        return o;
      }),
    );
    const waves = [...new Set(all.flatMap((x) => x.a.rows.map((r) => r.nm)))];
    $("measureWaves").replaceChildren();
    waves.forEach((nm) => {
      const l = document.createElement("label"),
        e = input(true, "checkbox");
      e.value = nm;
      e.onchange = plots;
      l.append(e, `${nm} nm`);
      $("measureWaves").append(l);
    });
    $("measureData").textContent = JSON.stringify(
      {
        metricStatus: all[0]?.a.metricStatus,
        cleanup: all.map((x) => ({ name: x.name, cleanup: x.a.cleanup })),
        focusPolicy: all[0]?.a.settings?.focusPolicy,
      },
      null,
      2,
    );
    graph();
    plots();
  }
  const colors = [
    "#67d9a9",
    "#ffb967",
    "#77adff",
    "#e895ff",
    "#ff7777",
    "#d4dd7b",
  ];
  function chart(canvas, series, xLabel, yLabel) {
    const ctx = canvas.getContext("2d"),
      w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pts = series
      .flatMap((s) => s.points)
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!pts.length) return;
    let lo = Math.min(...pts.map((p) => p.y)),
      hi = Math.max(...pts.map((p) => p.y)),
      xmin = Math.min(...pts.map((p) => p.x)),
      xmax = Math.max(...pts.map((p) => p.x));
    if (hi === lo) {
      hi += 0.001;
      lo -= 0.001;
    }
    ctx.fillStyle = "#dfe7f2";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${yLabel}: ${fmt(lo)} … ${fmt(hi)}`, 5, 15);
    ctx.fillText(`${xLabel}: ${fmt(xmin)} … ${fmt(xmax)}`, 5, h - 5);
    series.forEach((s, i) => {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.beginPath();
      let pen = false;
      s.points.forEach((p) => {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          pen = false;
          return;
        }
        const x = 30 + ((p.x - xmin) / (xmax - xmin || 1)) * (w - 50),
          y = 25 + ((hi - p.y) / (hi - lo)) * (h - 55);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      });
      ctx.stroke();
    });
  }
  function graph() {
    const key = $("measureMetric").value,
      field = Number($("measureField").value),
      apertureAxis = $("measureXAxis").value === "aperture";
    const value = (f) => f?.[key] ?? f?.diagnosticFocus?.[key];
    const series = apertureAxis
      ? analyses().map(({ name, a }) => ({
          name,
          points: aps(a)
            .map((ap) => ({
              x: ap.config.fNumber,
              y: value(ap.analysis.fields.find((f) => f.field === field)),
            }))
            .sort((a, b) => a.x - b.x),
        }))
      : analyses().flatMap(({ name, a }) =>
          aps(a).map((ap) => ({
            name: `${name} f/${ap.config.fNumber}`,
            points: ap.analysis.fields.map((f) => ({
              x: f.field,
              y: value(f),
            })),
          })),
        );
    chart(
      $("measureGraph"),
      series,
      apertureAxis ? `f-number, field ${field}` : "normalized field",
      key,
    );
    $("measureLegend").textContent = series
      .map((s, i) => `${colors[i % colors.length]} ${s.name}`)
      .join(" · ");
  }
  function plots() {
    const host = $("measurePlots");
    host.replaceChildren();
    const all = analyses(),
      aperture = Number($("measureInspectAperture").value),
      field = Number($("measureField").value),
      visible = [...$("measureWaves").querySelectorAll("input:checked")].map(
        (x) => Number(x.value),
      );
    let common = 0.000001;
    for (const x of all)
      for (const ap of aps(x.a))
        for (const f of ap.analysis.fields) {
          for (const r of ap.analysis.rows.filter((r) => r.field === f.field))
            for (const h of r.hits)
              common = Math.max(
                common,
                Math.abs(h.y - f.centroidYmm),
                Math.abs(h.z - f.centroidZmm),
              );
        }
    all.forEach(({ name, a }) => {
      const ap = aps(a).find(
        (x) => Math.abs(x.config.fNumber - aperture) < 1e-8,
      );
      if (!ap) return;
      const f = ap.analysis.fields.find((f) => f.field === field),
        rows = ap.analysis.rows.filter(
          (r) => r.field === field && visible.includes(r.nm),
        );
      if (!f) return;
      const card = document.createElement("section"),
        title = document.createElement("h4");
      title.textContent = `${name} · f/${aperture} · field ${field}`;
      card.append(title);
      const canvas = document.createElement("canvas");
      canvas.width = 380;
      canvas.height = 260;
      const ctx = canvas.getContext("2d"),
        scale =
          $("measureScale").value === "common"
            ? common
            : Math.max(
                0.000001,
                ...rows.flatMap((r) =>
                  r.hits.map((h) =>
                    Math.max(
                      Math.abs(h.y - f.centroidYmm),
                      Math.abs(h.z - f.centroidZmm),
                    ),
                  ),
                ),
              );
      rows.forEach((r, i) => {
        ctx.fillStyle = colors[i % colors.length];
        r.hits.forEach((h) =>
          ctx.fillRect(
            190 + ((h.y - f.centroidYmm) / scale) * 110,
            125 - ((h.z - f.centroidZmm) / scale) * 110,
            2,
            2,
          ),
        );
      });
      ctx.strokeStyle = "white";
      ctx.beginPath();
      ctx.moveTo(184, 125);
      ctx.lineTo(196, 125);
      ctx.moveTo(190, 119);
      ctx.lineTo(190, 131);
      ctx.stroke();
      const caption = document.createElement("p");
      caption.textContent = `Geometric spot, ±${fmt(scale * 1000)} µm; cross = polychromatic centroid. Tangential y horizontal; sagittal z vertical. No PSF/Airy overlay.`;
      card.append(caption, canvas);
      for (const axis of ["tangential", "sagittal"]) {
        const c = document.createElement("canvas");
        c.width = 380;
        c.height = 220;
        chart(
          c,
          rows.map((r) => ({
            points: (r.fans || [])
              .filter((p) => p.axis === axis)
              .map((p) => ({
                x: p.pupil,
                y: p.transverseMm === null ? null : p.transverseMm * 1000,
              })),
          })),
          `${axis} normalized pupil`,
          "transverse µm vs d chief",
        );
        card.append(c);
      }
      const pupil = document.createElement("canvas");
      pupil.width = 220;
      pupil.height = 220;
      const pc = pupil.getContext("2d");
      for (const p of rows[0]?.pupil || []) {
        pc.fillStyle = p.ok ? "#67d9a9" : "#ff7777";
        pc.fillRect(110 + p.y * 95, 110 - p.z * 95, 3, 3);
      }
      const pl = document.createElement("p");
      pl.textContent = `Pupil survival map (${rows[0]?.nm ?? "—"} nm): green survives, red lost. Not illumination.`;
      card.append(pl, pupil);
      if (field === 0) {
        const c = document.createElement("canvas");
        c.width = 380;
        c.height = 220;
        chart(
          c,
          rows.map((r) => ({
            points: (r.fans || [])
              .filter((p) => p.axis === "tangential" && p.pupil > 0)
              .map((p) => ({
                x: p.pupil,
                y:
                  p.longitudinalFocusXMm === null
                    ? null
                    : p.longitudinalFocusXMm - r.paraxialFocusXMm,
              })),
          })),
          "positive pupil zone",
          "LSA mm from same-wave paraxial focus",
        );
        card.append(c);
      }
      const data = document.createElement("details"),
        summary = document.createElement("summary"),
        pre = document.createElement("pre");
      summary.textContent = "Numeric diagnostic data";
      pre.textContent = JSON.stringify(
        {
          field: f,
          wavelengths: rows.map((r) => ({
            nm: r.nm,
            focus: r.focus,
            fans: r.fans,
          })),
        },
        null,
        2,
      );
      data.append(summary, pre);
      card.append(data);
      host.append(card);
    });
  }
  $("measureMetric").onchange = graph;
  $("measureXAxis").onchange = graph;
  for (const id of ["measureInspectAperture", "measureField", "measureScale"])
    $(id).onchange = () => {
      plots();
      graph();
    };
  $("measureExport").onclick = guard(() => {
    if (!report && !candidates) throw Error("Analyze first");
    download(
      "lensbuilder-optical-analysis.json",
      JSON.stringify(
        candidates ? { software: window.LB_BUILD, candidates } : report,
        null,
        2,
      ),
      "application/json",
    );
  });
  $("measureCSV").onclick = guard(() => {
    if (!report && !candidates) throw Error("Analyze first");
    const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    download(
      "lensbuilder-aperture-matrix.csv",
      [headers, ...matrixRows()].map((r) => r.map(quote).join(",")).join("\n"),
      "text/csv",
    );
  });
  document.addEventListener("lb-compare-apertures", (e) => {
    const valid = e.detail.items.filter((c) => c.dense?.analysis?.valid);
    if (valid.length !== e.detail.items.length) {
      status(
        "Dense-validate all selected candidates before multi-aperture comparison.",
      );
      return;
    }
    candidates = valid;
    report = null;
    renderReport();
    status(
      "DENSE candidate comparison. Switch aperture/field; common spot scale is the default.",
    );
  });
  apertureTable();
  try {
    presetList();
  } catch (e) {
    status(`Preset storage unavailable: ${e.message}`);
  }
})();
