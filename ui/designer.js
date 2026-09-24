(function () {
  "use strict";
  const bridge = window.LensBuilder,
    $ = (id) => document.getElementById(id),
    KEY = "lensbuilder:optimizer-checkpoint:v1";
  const dialog = document.createElement("dialog");
  dialog.id = "designerDialog";
  dialog.setAttribute("aria-label", "Optical analysis and optimization");
  dialog.className = "designer";
  dialog.innerHTML = `<div class="designerHeader"><div><h2>Optical analysis & optimization</h2><p>Existing spherical lens · infinity conjugate · geometric analysis</p></div><button id="designClose" class="btn">Close</button></div>
<div class="designNotice">T-stop, diffraction PSF, MTF and autonomous lens generation: unavailable. Preview focus shift is excluded: this analysis uses the prescription image gap. Pupil survival is a sampling estimate, not measured illumination.</div>
<div class="designerGrid"><section>
<h3>Design specification</h3><div class="designInputs">
<label>Target EFL (mm)<input id="designEfl" type="number" step="0.1" min="1"></label>
<label>Target f-number<input id="designF" type="number" step="0.01" min="0.1"></label>
<label>Field reference circle (mm)<input id="designCircle" type="number" step="0.1" min="1"></label>
<label>Minimum BFL (mm)<input id="designBfl" type="number" value="0" min="0" step="0.1"></label>
<label>Minimum edge (mm)<input id="designEdge" type="number" value="0.05" min="0" step="0.01"></label>
<label>Maximum diameter (mm)<input id="designDiameter" type="number" value="150" min="1"></label>
<label>Minimum ray fraction<input id="designSurvival" type="number" value="0.5" step="0.05" min="0.05" max="1"></label>
<label>Pupil grid<select id="designGrid"><option>5</option><option selected>9</option><option>13</option><option>19</option></select></label>
<label>Evaluation budget<input id="designBudget" type="number" value="600" min="2" max="100000"></label>
<label>Seed / experiment ID<input id="designSeed" type="number" value="1" step="1"></label>
</div>
<label class="designCheck"><input id="designApprox" type="checkbox">Allow APPROXIMATE nd/Vd dispersion</label>
<p class="hint">Six field positions: 0, 0.3, 0.5, 0.7, 0.85, 1. Fraunhofer F/d/C, weights 1/2/1. Local deterministic pattern search; seed is recorded but no randomness is used.</p>
<h3>Variables <span class="hint">Unchecked = locked</span></h3>
<p class="hint">Radii retain their sign. A separate iris can translate between two air gaps. Image-gap optimization is selected initially.</p>
<div class="variableScroll"><table><thead><tr><th>Vary</th><th>Surface / parameter</th><th>Min</th><th>Max</th></tr></thead><tbody id="designVariables"></tbody></table></div>
<details><summary>Merit operands · targets, ranges and weights</summary><p class="hint">Squared normalized error: weight × (distance to target / scale)². A two-value target defines an allowed range, including intentional nonzero aberration. Hard constraints reject the candidate first.</p><button id="designResetMerit" class="btn">Reset operands to current targets</button><textarea id="designOperands" rows="15" spellcheck="false" aria-label="Merit operands JSON"></textarea></details>
<div class="designActions"><button id="designAnalyze" class="btn">Analyze current lens</button><button id="designStart" class="btn btnPrimary">Auto Optimize</button></div>
</section><section>
<div class="designActions"><button id="designPause" class="btn" disabled>Pause</button><button id="designResume" class="btn" disabled>Resume</button><button id="designStop" class="btn" disabled>Stop & validate</button><button id="designCheckpoint" class="btn" disabled>Export checkpoint</button><button id="designRestore" class="btn">Restore autosave</button><label class="btn">Load checkpoint<input id="designCheckpointFile" type="file" accept=".json" hidden></label></div>
<p id="designStatus" role="status" aria-live="polite">Ready. Analyze the current prescription before starting.</p><p id="designStorage" class="warn"></p>
<canvas id="designConvergence" width="680" height="130" aria-label="Best merit convergence history"></canvas>
<div class="designActions"><button id="designAdopt" class="btn btnPrimary" disabled>Adopt validated result</button><button id="designExport" class="btn" disabled>Export experiment</button></div>
<div id="designResults"></div>
</section></div>`;
  document.body.appendChild(dialog);
  let worker = null,
    checkpoint = null,
    result = null,
    source = null,
    busy = false,
    sessionStarted = 0,
    defaultMeritText = null;
  const toMicrons = (v) => (Number.isFinite(v) ? v * 1000 : NaN);
  const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "unavailable");
  const fingerprint = (s) => {
    const c = structuredClone(s);
    delete c.project;
    c.surfaces.forEach((s) => delete s.vx);
    return JSON.stringify(c);
  };
  function status(message) {
    $("designStatus").textContent = message;
  }
  function setBusy(value) {
    busy = value;
    for (const id of [
      "designStart",
      "designAnalyze",
      "designRestore",
      "designCheckpointFile",
    ])
      $(id).disabled = value;
    for (const el of dialog.querySelectorAll(
      ".designerGrid > section:first-child input,.designerGrid > section:first-child select,.designerGrid > section:first-child textarea",
    ))
      el.disabled = value;
    $("designResetMerit").disabled = value;
    $("designPause").disabled = !value;
    $("designStop").disabled = !value;
  }
  function saveCheckpoint() {
    if (!checkpoint) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(checkpoint));
      $("designStorage").textContent = "";
    } catch {
      $("designStorage").textContent =
        "Autosave failed; export a checkpoint to keep this run.";
    }
  }
  function showCheckpointSettings(state) {
    const s = state.spec;
    for (const [id, value] of Object.entries({
      designEfl: s.targetEflMm,
      designF: s.targetFNumber,
      designCircle: s.imageCircleMm,
      designBfl: s.constraints?.minBflMm ?? 0,
      designEdge: s.constraints?.minEdgeMm ?? 0.05,
      designDiameter: s.constraints?.maxDiameterMm ?? 150,
      designSurvival: s.minRayFraction ?? 0.5,
      designGrid: s.pupilGrid ?? 9,
      designBudget: state.maxEvaluations,
      designSeed: state.seed,
    }))
      $(id).value = String(value);
    $("designApprox").checked = !!s.allowApproximateMaterials;
    $("designOperands").value = JSON.stringify(state.operands, null, 2);
    variables(state.input);
    for (const row of $("designVariables").rows) {
      const checkbox = row.cells[0].firstChild;
      const v = state.variables.find(
        (v) =>
          v.surface === Number(checkbox.dataset.surface) &&
          v.key === checkbox.dataset.key,
      );
      checkbox.checked = !!v;
      if (v) {
        row.cells[2].firstChild.value = v.min;
        row.cells[3].firstChild.value = v.max;
      }
    }
  }
  function saveFile(name, value) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function spec() {
    const out = {
      targetEflMm: Number($("designEfl").value),
      targetFNumber: Number($("designF").value),
      imageCircleMm: Number($("designCircle").value),
      pupilGrid: Number($("designGrid").value),
      minRayFraction: Number($("designSurvival").value),
      allowApproximateMaterials: $("designApprox").checked,
      constraints: {
        minBflMm: Number($("designBfl").value),
        minEdgeMm: Number($("designEdge").value),
        maxDiameterMm: Number($("designDiameter").value),
      },
    };
    for (const [k, v] of Object.entries(out.constraints))
      if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid ${k}`);
    if (!(out.targetFNumber > 0)) throw new Error("Invalid f-number");
    return LBAnalysis.settings(out);
  }
  function operands() {
    const value = JSON.parse($("designOperands").value);
    LBMerit.validateOperands(value);
    return value;
  }
  function resetMerit() {
    defaultMeritText = JSON.stringify(LBMerit.defaultOperands(spec()), null, 2);
    $("designOperands").value = defaultMeritText;
  }
  function variables(input) {
    const box = $("designVariables");
    box.replaceChildren();
    input.surfaces.slice(1, -1).forEach((s, j) => {
      const i = j + 1;
      for (const key of ["R", "t", "stopPosition"]) {
        if (key === "R" && s.R === 0) continue;
        if (
          key === "stopPosition" &&
          (!s.stop ||
            s.R !== 0 ||
            s.glass !== "AIR" ||
            input.surfaces[i - 1].glass !== "AIR" ||
            i <= 1)
        )
          continue;
        const val = key === "stopPosition" ? 0 : s[key];
        let min, max;
        if (key === "R") {
          min = val * 0.7;
          max = val * 1.3;
          [min, max] = [Math.min(min, max), Math.max(min, max)];
        } else if (key === "t") {
          min = Math.max(0, val * 0.5);
          max = Math.max(0.2, val * 1.5);
        } else {
          min = -input.surfaces[i - 1].t * 0.8;
          max = s.t * 0.8;
        }
        const tr = document.createElement("tr");
        const check = document.createElement("input");
        check.type = "checkbox";
        check.dataset.surface = i;
        check.dataset.key = key;
        check.setAttribute("aria-label", `Vary surface ${i} ${key}`);
        check.checked = key === "t" && i === input.surfaces.length - 2;
        const cell = document.createElement("td");
        cell.append(check);
        tr.append(cell);
        const label = document.createElement("td");
        label.textContent = `${i} · ${key === "stopPosition" ? "iris shift (mm)" : key + " (mm)"}`;
        tr.append(label);
        for (const v of [min, max]) {
          const td = document.createElement("td"),
            el = document.createElement("input");
          el.type = "number";
          el.step = "any";
          el.setAttribute(
            "aria-label",
            `Surface ${i} ${key} ${v === min ? "minimum" : "maximum"}`,
          );
          el.value = String(Number(v.toPrecision(8)));
          td.append(el);
          tr.append(td);
        }
        box.append(tr);
      }
    });
  }
  function selectedVariables() {
    return Array.from($("designVariables").rows)
      .filter((r) => r.cells[0].firstChild.checked)
      .map((r) => ({
        surface: Number(r.cells[0].firstChild.dataset.surface),
        key: r.cells[0].firstChild.dataset.key,
        min: Number(r.cells[2].firstChild.value),
        max: Number(r.cells[3].firstChild.value),
      }));
  }
  function getWorker() {
    if (worker) return worker;
    if (location.protocol === "file:")
      throw new Error(
        "Optimization workers require a local server. Run npm start and open http://localhost:8080.",
      );
    worker = new Worker("./optimization/worker.js");
    worker.onerror = (e) => {
      setBusy(false);
      status(`Worker failed: ${e.message}`);
      worker.terminate();
      worker = null;
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "error") {
        setBusy(false);
        $("designResume").disabled = true;
        status(data.message);
        return;
      }
      if (data.state) {
        checkpoint = data.state;
        $("designCheckpoint").disabled = false;
        saveCheckpoint();
        plot(checkpoint.history);
      }
      if (data.type === "progress")
        status(
          `Evaluations ${checkpoint.evaluations}/${checkpoint.maxEvaluations} · sweep ${checkpoint.iteration} · valid ${checkpoint.validCandidates} · merit ${fmt(checkpoint.bestScore, 6)} · ${Math.round((Date.now() - sessionStarted) / 1000)} s this session`,
        );
      if (data.type === "paused") {
        setBusy(false);
        $("designResume").disabled = checkpoint?.done ?? true;
        $("designStop").disabled = !checkpoint;
        if (checkpoint) {
          showCheckpointSettings(checkpoint);
          source = checkpoint.input;
        }
        status(
          checkpoint?.done
            ? "Completed checkpoint restored. Use Stop & validate to reconstruct the result."
            : "Paused. Resume uses the saved settings; Auto Optimize starts a new run with edited settings.",
        );
      }
      if (data.type === "analysis") {
        setBusy(false);
        renderEvaluation(data.evaluation);
        status(
          data.evaluation.analysis.valid
            ? "Analysis complete. Geometric results at the prescription image plane."
            : data.evaluation.analysis.errors.join("\n"),
        );
      }
      if (data.type === "result") {
        setBusy(false);
        result = data.result;
        checkpoint = result.state;
        saveCheckpoint();
        $("designResume").disabled = true;
        $("designAdopt").disabled = !result.accepted;
        $("designExport").disabled = false;
        renderEvaluation(result.after, result.before);
        status(
          `${result.reason}. Validation grid ${result.validationGrid} × ${result.validationGrid}.`,
        );
      }
    };
    return worker;
  }
  function plot(history) {
    const c = $("designConvergence"),
      ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (!history?.length) return;
    const lo = Math.min(...history.map((h) => h.score)),
      hi = Math.max(...history.map((h) => h.score)),
      end = history.at(-1).evaluations;
    ctx.strokeStyle = "#7de4c9";
    ctx.beginPath();
    history.forEach((h, i) => {
      const x = 12 + ((c.width - 24) * h.evaluations) / Math.max(1, end),
        y =
          c.height -
          20 -
          ((c.height - 40) * (h.score - lo)) / Math.max(1e-10, hi - lo);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#b4c2d6";
    ctx.font = "12px monospace";
    ctx.fillText(`best merit ${fmt(lo, 4)} … ${fmt(hi, 4)}`, 12, 15);
  }
  function table(headers, rows) {
    const t = document.createElement("table"),
      head = t.createTHead().insertRow();
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      head.append(th);
    });
    const body = t.createTBody();
    rows.forEach((row) => {
      const tr = body.insertRow();
      row.forEach((value) => {
        tr.insertCell().textContent = String(value);
      });
    });
    return t;
  }
  function renderEvaluation(after, before = null) {
    const host = $("designResults");
    host.replaceChildren();
    const r = after.analysis,
      b = before?.analysis;
    const notes = document.createElement("p");
    notes.className = "designNotice";
    notes.textContent = [
      ...r.errors,
      ...r.warnings,
      ...(r.limitations || []),
    ].join("\n");
    host.append(notes);
    if (!r.firstOrder) return;
    const metrics = [
      ["Merit", before?.merit.total, after.merit.total],
      ["EFL mm", b?.firstOrder?.eflMm, r.firstOrder.eflMm],
      ["BFL mm", b?.firstOrder?.bflMm, r.firstOrder.bflMm],
      ["f-number (paraxial)", b?.firstOrder?.fNumber, r.firstOrder.fNumber],
      [
        "F–C paraxial focus shift mm",
        b?.longitudinalColorMm,
        r.longitudinalColorMm,
      ],
    ];
    host.append(
      table(
        [
          "Metric",
          ...(before ? ["Before"] : []),
          "After / current",
          ...(before ? ["Delta"] : []),
        ],
        metrics.map(([k, x, y]) => [
          k,
          ...(before ? [fmt(x)] : []),
          fmt(y),
          ...(before ? [fmt(y - x)] : []),
        ]),
      ),
    );
    host.append(
      table(
        [
          "Field",
          "RMS µm",
          ...(before ? ["Before µm"] : []),
          "Distortion %",
          "Chief color µm",
          "Pupil survival",
        ],
        r.fields.map((f, i) => [
          fmt(f.field, 2),
          fmt(toMicrons(f.rmsMm), 2),
          ...(before ? [fmt(toMicrons(b.fields[i]?.rmsMm), 2)] : []),
          fmt(f.distortionPercent, 2),
          fmt(toMicrons(f.lateralChiefColorMm), 2),
          fmt(f.rayFraction, 3),
        ]),
      ),
    );
    drawSpots(host, r);
    const title = document.createElement("h3");
    title.textContent = "Merit breakdown";
    host.append(
      title,
      table(
        ["Operand", "Target", "Measured", "Contribution"],
        after.merit.breakdown.map((o) => [
          o.metric + (o.field != null ? ` @ ${o.field}` : ""),
          JSON.stringify(o.target),
          fmt(o.value),
          fmt(o.contribution),
        ]),
      ),
    );
  }
  function drawSpots(host, r) {
    const title = document.createElement("h3");
    title.textContent = "Geometric spots · common scale · centroid-referenced";
    host.append(title);
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 160;
    canvas.className = "spots";
    host.append(canvas);
    const ctx = canvas.getContext("2d");
    const radius = Math.max(0.001, ...r.fields.map((f) => f.maxRadiusMm || 0));
    ctx.font = "11px monospace";
    r.fields.forEach((f, i) => {
      const x = 60 + i * 120,
        y = 72;
      ctx.strokeStyle = "#34435a";
      ctx.beginPath();
      ctx.moveTo(x - 40, y);
      ctx.lineTo(x + 40, y);
      ctx.moveTo(x, y - 40);
      ctx.lineTo(x, y + 40);
      ctx.stroke();
      r.rows
        .filter((row) => row.field === f.field)
        .forEach((row, j) => {
          ctx.fillStyle = ["#71a4ff", "#7de4c9", "#ff838e"][j % 3];
          row.hits.forEach((h) => {
            ctx.fillRect(
              x + ((h.z - f.centroidZmm) / radius) * 40,
              y + ((h.y - f.centroidYmm) / radius) * 40,
              1.5,
              1.5,
            );
          });
        });
      ctx.fillStyle = "#c4ccda";
      ctx.fillText(`field ${f.field}`, x - 35, 130);
    });
    ctx.fillText(`±${fmt(radius * 1000, 1)} µm`, 10, 154);
  }
  window.addEventListener("keydown", (e) => {
    if (
      dialog.open ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? bridge.redo() : bridge.undo();
    }
  });
  function guarded(fn) {
    return (...args) => {
      try {
        fn(...args);
      } catch (e) {
        setBusy(false);
        status(e.message);
      }
    };
  }
  $("btnDesigner").onclick = guarded(() => {
    bridge.setPreview(false);
    if (
      !busy &&
      (!source || fingerprint(source) !== fingerprint(bridge.snapshot()))
    ) {
      source = bridge.snapshot();
      let f;
      try {
        f = LBOptics.paraxial(LBOptics.compile(source));
      } catch {}
      $("designEfl").value = fmt(f?.eflMm || 50, 5);
      $("designF").value = fmt(f?.fNumber || 2, 5);
      const sensor = bridge.sensor();
      $("designCircle").value = fmt(Math.hypot(sensor.w, sensor.h), 3);
      variables(source);
      resetMerit();
    }
    dialog.showModal();
  });
  $("designClose").onclick = () => dialog.close();
  $("btnUndo").onclick = bridge.undo;
  $("btnRedo").onclick = bridge.redo;
  $("designResetMerit").onclick = guarded(resetMerit);
  for (const id of ["designEfl", "designF"])
    $(id).addEventListener(
      "change",
      guarded(() => {
        if ($("designOperands").value === defaultMeritText) resetMerit();
        else
          status(
            "Specification changed. Custom merit operands are retained; review their targets or reset operands.",
          );
      }),
    );
  $("designAnalyze").onclick = guarded(() => {
    source = bridge.snapshot();
    result = null;
    $("designAdopt").disabled = true;
    $("designExport").disabled = true;
    getWorker().postMessage({
      type: "analyze",
      input: source,
      spec: spec(),
      operands: operands(),
    });
    setBusy(true);
    $("designPause").disabled = true;
    $("designStop").disabled = true;
    status("Tracing deterministic field/wavelength bundles…");
  });
  $("designStart").onclick = guarded(() => {
    source = bridge.snapshot();
    if (source.zoom?.configs?.length)
      throw new Error(
        "Multi-configuration optimization unavailable; export a single configuration first.",
      );
    const v = selectedVariables();
    LBSearch.validateVariables(source, v);
    result = null;
    $("designAdopt").disabled = true;
    $("designExport").disabled = true;
    const w = getWorker();
    w.postMessage({
      type: "start",
      input: source,
      spec: spec(),
      variables: v,
      operands: operands(),
      options: {
        maxEvaluations: Number($("designBudget").value),
        seed: Number($("designSeed").value),
        software: window.LB_BUILD || { engineVersion: LBSearch.VERSION },
      },
    });
    setBusy(true);
    sessionStarted = Date.now();
    bridge.setPreview(false);
    status("Starting bounded local optimization…");
  });
  $("designPause").onclick = () => worker?.postMessage({ type: "pause" });
  $("designResume").onclick = () => {
    worker?.postMessage({ type: "resume" });
    setBusy(true);
    $("designResume").disabled = true;
    sessionStarted = Date.now();
  };
  $("designStop").onclick = () => {
    worker?.postMessage({ type: "stop" });
    setBusy(true);
    $("designPause").disabled = true;
    $("designStop").disabled = true;
    status("Validating on a denser pupil grid…");
  };
  $("designCheckpoint").onclick = () =>
    checkpoint && saveFile("lensbuilder-checkpoint.json", checkpoint);
  function restore(s) {
    const w = getWorker();
    result = null;
    $("designExport").disabled = true;
    $("designAdopt").disabled = true;
    setBusy(true);
    w.postMessage({ type: "restore", state: s });
    status("Validating checkpoint…");
  }
  $("designRestore").onclick = guarded(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error("No saved checkpoint");
    restore(JSON.parse(raw));
  });
  $("designCheckpointFile").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (file) restore(JSON.parse(await file.text()));
    } catch (e) {
      status(e.message);
    } finally {
      e.target.value = "";
    }
  };
  $("designExport").onclick = () =>
    result &&
    saveFile("lensbuilder-experiment.json", {
      ...result,
      software: window.LB_BUILD || LBSearch.VERSION,
    });
  $("designAdopt").onclick = guarded(() => {
    if (!result?.accepted) throw new Error("No validated improvement");
    if (fingerprint(bridge.snapshot()) !== fingerprint(result.state.input))
      throw new Error(
        "Editor changed since this run. Export the experiment first; adoption is blocked to preserve newer edits.",
      );
    bridge.adopt(result.candidate, {
      specification: result.state.spec,
      operands: result.state.operands,
      experiment: result.state,
      validation: {
        before: result.before.merit,
        after: result.after.merit,
        grid: result.validationGrid,
      },
      software: window.LB_BUILD || LBSearch.VERSION,
    });
    $("designAdopt").disabled = true;
    status(
      "Result adopted as one undoable edit. Prescription image gap is active; preview refocus is disabled.",
    );
  });
  window.addEventListener("lensbuilder:import-report", (e) => {
    const pre = document.createElement("pre");
    pre.className = "importReport";
    pre.textContent = LBImport.describe(e.detail);
    $("designResults").replaceChildren(pre);
    status(
      e.detail.blocked
        ? "Import contains unsupported or partial features. Optimization blocked."
        : "Import report",
    );
    if (!dialog.open) dialog.showModal();
  });
})();
