(function () {
  "use strict";
  const E = LBExplorer,
    bridge = LensBuilder,
    $ = (id) => document.getElementById(id);
  const button = document.createElement("button");
  button.className = "btn";
  button.textContent = "Search Lab";
  button.id = "openSearchLab";
  document.querySelector('[aria-label="Main toolbar"]').prepend(button);
  const panel = document.createElement("section");
  panel.id = "searchLab";
  panel.hidden = true;
  panel.className = "searchLab";
  panel.innerHTML = `
<header><h2>Search Lab · numerical optical experiments</h2><button id="labHide" class="btn">Back to editor (search continues)</button></header>
<p>Geometric infinity-conjugate analysis · spherical surfaces · offline numerical search. Pupil survival is an estimate, not illumination or certified image coverage. T-stop, PSF and MTF remain unavailable.</p>
<div class="labConfig"><section><h3>Base lens & targets</h3><button id="labCapture" class="btn">Capture current editor lens</button><p id="labBase"></p>
<label>Experiment name<input id="labName" value="LENS_SEARCH_001"></label>
<label>Specification & hard constraints (JSON)<textarea id="labSpec" rows="16"></textarea></label>
<p>Configuration changes apply only to a new experiment. Resume uses its frozen configuration. Fields/wavelengths must include every merit operand. Optional coarse screening can reject candidates that a denser grid would retain; it is off by default.</p>
</section><section><h3>Variables & bounds</h3><p>R = radius; t = glass thickness or air gap; stopPosition = iris translation. Disable a variable to lock it. Radius bounds retain sign. Units: mm.</p>
<label>Radius variation ± %<input id="labRadius" type="number" value="5" min="0.001" max="99"></label><label>Thickness / gap variation ± mm<input id="labThickness" type="number" value="0.25" min="0.000001" step="0.05"></label><button id="labMagnitudes" class="btn">Apply magnitudes to variable bounds</button>
<label>Parameter definitions (JSON)<textarea id="labVariables" rows="20"></textarea></label></section>
<section><h3>Merit editor</h3><p>Types: MINIMIZE, MAXIMIZE, TARGET VALUE, TARGET RANGE, MINIMUM, MAXIMUM. scale is the tolerance/normalization; target arrays specify ranges. RMS/color units mm; distortion %.</p><label>Operands (JSON)<textarea id="labOperands" rows="24"></textarea></label></section></div>
<h3>Search strategy & compute</h3><div class="labControls">
<label>Strategy<select id="labStrategy"><option value="de">Differential Evolution</option><option value="uniform">Uniform parameter exploration</option><option value="sensitivity">Sensitivity ±1% of bounds</option></select></label>
<label>Budget preset<select id="labPreset"><option value="10000">Quick · 10,000</option><option value="100000" selected>Medium · 100,000</option><option value="1000000">Deep · 1,000,000</option><option value="10000000">Extreme · 10,000,000</option></select></label>
<label>Total evaluation budget<input id="labBudget" type="number" value="100000"></label><label>Seed<input id="labSeed" type="number" value="1001"></label><label>Population / batch<input id="labPopulation" type="number" value="32"></label><label>Generations per run<input id="labGenerations" type="number" value="1000000"></label><label>Mutation F<input id="labMutation" type="number" value="0.7" step="0.1"></label><label>Crossover CR<input id="labCrossover" type="number" value="0.9" step="0.1"></label><label>Independent runs<input id="labRuns" type="number" value="1"></label><label>Workers<input id="labWorkers" type="number" value="2" min="1" max="64"></label><label>Time limit seconds (0 = off)<input id="labSeconds" type="number" value="0"></label><label>Target merit (blank = off)<input id="labTarget" type="number"></label><label>No improvement evaluations (0 = off)<input id="labStagnation" type="number" value="0"></label><label>Elite archive size<input id="labArchive" type="number" value="12"></label><label>Normalized diversity distance<input id="labDiversity" type="number" value="0.025" step="0.005"></label><label><input id="labCoarse" type="checkbox">Experimental coarse gate</label></div>
<div class="labActions"><button id="labStart" class="btn">Start new experiment</button><button id="labPause" class="btn">Pause & checkpoint</button><button id="labResume" class="btn">Resume</button><button id="labStop" class="btn">Stop after batch</button><button id="labExport" class="btn">Export checkpoint</button><label>Import checkpoint<input id="labImport" type="file" accept=".json"></label><button id="labList" class="btn">Refresh saved experiments</button><select id="labSaved" aria-label="Saved experiments"></select><button id="labRestore" class="btn">Restore autosave</button></div>
<p id="labMessage" role="status">Capture a lens to begin.</p><pre id="labProgress"></pre><canvas id="labConvergence" width="900" height="150" aria-label="Search merit convergence"></canvas>
<h3>Results · search metrics until dense-validated</h3><p>Select 2–6 candidates to compare. Dense validation uses a different sunflower pupil pattern, all default fields and F/d/C wavelengths. You choose which valid result to adopt.</p>
<button id="labValidate" class="btn">Dense-validate selected (or all)</button><button id="labRefine" class="btn">Locally refine selected (max 600 evaluations each)</button><button id="labCompare" class="btn">Compare selected</button><button id="labLoadBase" class="btn">Load experiment base into editor (undoable)</button>
<label>Sort by<select id="labSort"><option value="score">Search merit</option><option value="center">Center RMS</option><option value="corner">Corner RMS</option><option value="distortion">Distortion magnitude</option><option value="bfl">BFL</option><option value="color">Lateral color</option><option value="loca">Longitudinal color magnitude</option></select></label>
<div id="labResults"></div><div id="labComparison" class="labComparison"></div><pre id="labSensitivity"></pre>`;
  document.body.append(panel);
  let base = null,
    state = null,
    pool = null,
    running = false,
    pause = false,
    stop = false,
    lastSave = 0,
    lastPaint = 0,
    storageError = "",
    verified = true,
    validationBusy = false;
  const fmt = (x) => (Number.isFinite(x) ? Number(x).toPrecision(6) : "—");
  const fingerprint = (x) => {
    const y = structuredClone(x);
    delete y.project;
    delete y.focus;
    delete y.zoom;
    y.surfaces.forEach((s) => delete s.vx);
    return JSON.stringify(y);
  };
  function message(t) {
    $("labMessage").textContent = t;
  }
  function guard(fn) {
    return async () => {
      try {
        await fn();
      } catch (e) {
        message(e.message);
      }
    };
  }
  function json(id) {
    return JSON.parse($(id).value);
  }
  function put(id, v) {
    $(id).value = JSON.stringify(v, null, 2);
  }
  function capture() {
    if (running || validationBusy)
      throw Error("Pause before changing the configuration");
    base = bridge.snapshot();
    delete base.project;
    document.dispatchEvent(
      new CustomEvent("lb-base-captured", { detail: base }),
    );
    let first;
    try {
      first = LBOptics.paraxial(LBOptics.compile(base));
    } catch {}
    const sensor = bridge.sensor();
    const spec = {
      targetEflMm: first?.eflMm > 0 ? first.eflMm : 50,
      targetFNumber: first?.fNumber || 2,
      imageCircleMm: Math.hypot(sensor.w, sensor.h) || 43.27,
      pupilGrid: 9,
      minRayFraction: 0.5,
      allowApproximateMaterials: false,
      constraints: {
        minEdgeMm: 0.05,
        minCenterMm: 0.1,
        minAirGapMm: 0,
        maxDiameterMm: 150,
        maxLengthMm: 500,
        minBflMm: 0,
      },
    };
    put("labSpec", spec);
    put("labOperands", LBMerit.defaultOperands(spec));
    const vars = [];
    base.surfaces.slice(1, -1).forEach((s, j) => {
      const i = j + 1;
      if (s.R !== 0)
        vars.push({
          surface: i,
          key: "R",
          min: Math.min(s.R * 0.95, s.R * 1.05),
          max: Math.max(s.R * 0.95, s.R * 1.05),
          enabled: false,
        });
      if (s.t > 0)
        vars.push({
          surface: i,
          key: "t",
          min: Math.max(0, s.t - 0.25),
          max: s.t + 0.25,
          enabled: i === base.surfaces.length - 2,
        });
      if (
        s.stop &&
        s.R === 0 &&
        s.glass === "AIR" &&
        base.surfaces[i - 1].glass === "AIR" &&
        i > 1
      )
        vars.push({
          surface: i,
          key: "stopPosition",
          min: -0.25,
          max: 0.25,
          enabled: false,
        });
    });
    put("labVariables", vars);
    $("labBase").textContent =
      `${base.name || "Editor lens"} · ${base.surfaces.length - 2} physical surfaces captured`;
    message(
      "Configure variables, bounds, targets and seed, then start. Defaults vary only the image gap.",
    );
  }
  function config() {
    const num = (id) => Number($(id).value);
    return {
      id: $("labName").value.trim() || `experiment-${Date.now()}`,
      strategy: $("labStrategy").value,
      budget: num("labBudget"),
      seed: num("labSeed"),
      population: num("labPopulation"),
      generations: num("labGenerations"),
      mutation: num("labMutation"),
      crossover: num("labCrossover"),
      runs: num("labRuns"),
      seconds: num("labSeconds"),
      targetMerit: $("labTarget").value === "" ? null : num("labTarget"),
      stagnation: num("labStagnation"),
      archiveSize: num("labArchive"),
      diversity: num("labDiversity"),
      coarse: $("labCoarse").checked,
      software: window.LB_BUILD || { engine: E.VERSION },
    };
  }
  async function save() {
    if (!state) return;
    try {
      await LBExperiments.save(state);
      lastSave = Date.now();
      storageError = "";
    } catch (e) {
      storageError = `AUTOSAVE FAILED: ${e.message}. Export a checkpoint.`;
      pause = true;
      message(storageError);
    }
  }
  function controls() {
    if (running || validationBusy)
      $("labResults")
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = true));
    for (const id of [
      "labStart",
      "labCapture",
      "labMagnitudes",
      "labImport",
      "labRestore",
      "labValidate",
      "labRefine",
      "labLoadBase",
    ])
      $(id).disabled = running || validationBusy;
    $("labResume").disabled = running || validationBusy || !state || state.done;
    $("labPause").disabled = !running;
    $("labStop").disabled = !running;
  }
  function draw() {
    if (!state) return;
    const seconds = state.elapsedMs / 1000,
      rate = seconds ? state.evaluations / seconds : 0;
    $("labProgress").textContent =
      `${running ? "RUNNING" : state.done ? "FINISHED: " + state.reason : "PAUSED"} · ${state.id}\nEvaluations ${state.evaluations.toLocaleString()} / ${state.config.budget.toLocaleString()} · ${fmt(rate)} eval/s · ${fmt(seconds ? state.rays / seconds : 0)} sampled rays/s\nValid ${state.valid} · rejected ${state.evaluations - state.valid} · run ${state.run + 1}/${state.config.runs} · generation ${state.generation}\nBest search merit ${fmt(state.archive[0]?.score)} · best dense merit ${fmt(Math.min(...state.archive.filter((a) => a.dense?.score !== null && a.dense).map((a) => a.dense.score)))}\nElapsed ${seconds.toFixed(1)}s · workers ${pool?.workers.length || 0} · last batch occupancy ${((pool?.utilization || 0) * 100).toFixed(0)}% · approximate remaining ${rate ? ((state.config.budget - state.evaluations) / rate / 3600).toFixed(2) : "—"} hours\nLast checkpoint ${lastSave ? new Date(lastSave).toLocaleTimeString() : "not yet saved"} ${storageError}\nRejections ${JSON.stringify(state.rejections)}`;
    const c = $("labConvergence"),
      ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const h = state.history.filter((h) => Number.isFinite(h.score));
    if (h.length > 1) {
      const lo = Math.min(...h.map((x) => x.score)),
        hi = Math.max(...h.map((x) => x.score));
      ctx.strokeStyle = "#68d7b7";
      ctx.beginPath();
      h.forEach((x, i) => {
        const px = (x.evaluations / state.evaluations) * c.width,
          py = 10 + ((hi - x.score) / (hi - lo || 1)) * (c.height - 20);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    controls();
  }
  function selected() {
    return [...$("labResults").querySelectorAll("input:checked")].map(
      (e) => state.archive[Number(e.value)],
    );
  }
  function results() {
    if (!state) return;
    const host = $("labResults");
    host.replaceChildren();
    const table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Compare</th><th>Discovery</th><th>Search merit</th><th>Dense merit</th><th>Center RMS µm</th><th>Corner RMS µm</th><th>BFL mm</th><th>Adopt</th></tr></thead>";
    const tbody = document.createElement("tbody");
    const key = $("labSort").value,
      get = (a) =>
        key === "score"
          ? a.score
          : key === "center"
            ? a.metrics?.fields[0]?.rms
            : key === "corner"
              ? a.metrics?.fields.at(-1)?.rms
              : key === "bfl"
                ? a.metrics?.bfl
                : key === "loca"
                  ? Math.abs(a.metrics?.longitudinalColor)
                  : Math.max(
                      ...(a.metrics?.fields || []).map((f) =>
                        Math.abs(
                          key === "color" ? f.lateralColor : f.distortion,
                        ),
                      ),
                    );
    state.archive
      .map((a, i) => ({ a, i }))
      .sort((x, y) => get(x.a) - get(y.a))
      .forEach(({ a, i }) => {
        const tr = document.createElement("tr");
        const td = document.createElement("td"),
          cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = i;
        cb.setAttribute("aria-label", `Compare candidate ${i + 1}`);
        td.append(cb);
        tr.append(td);
        for (const v of [
          a.evaluation,
          fmt(a.score),
          a.dense ? fmt(a.dense.score) : "unvalidated",
          fmt((a.dense?.metrics || a.metrics)?.fields[0]?.rms * 1000),
          fmt((a.dense?.metrics || a.metrics)?.fields.at(-1)?.rms * 1000),
          fmt((a.dense?.metrics || a.metrics)?.bfl),
        ]) {
          const cell = document.createElement("td");
          cell.textContent = v;
          tr.append(cell);
        }
        const cell = document.createElement("td"),
          b = document.createElement("button");
        b.className = "btn";
        b.textContent = "Adopt";
        b.disabled =
          running || validationBusy || !a.dense || a.dense.score === null;
        b.onclick = guard(async () => {
          if (fingerprint(bridge.snapshot()) !== fingerprint(state.input))
            throw Error(
              "Editor differs from experiment base. Save your edits, then explicitly load the experiment base before adopting.",
            );
          bridge.adopt(a.dense.prescription, {
            experimentId: state.id,
            software: state.software,
            variables: state.variables,
            vector: a.vector,
            validation: a.dense.validation,
            metrics: a.dense.metrics,
          });
          message(
            "Dense-validated candidate adopted as one undoable editor change; multi-aperture candidates use their primary validated iris.",
          );
        });
        cell.append(b);
        tr.append(cell);
        tbody.append(tr);
      });
    table.append(tbody);
    host.append(table);
    if (state.config.strategy === "sensitivity")
      $("labSensitivity").textContent = JSON.stringify(
        E.sensitivity(state),
        null,
        2,
      );
    else $("labSensitivity").textContent = "";
  }
  async function setup() {
    pool?.close();
    pool = new LBEvaluationPool(Number($("labWorkers").value));
    await pool.init(state);
  }
  async function verify() {
    if (verified) return;
    const vectors = [
      ...state.population,
      ...state.archive.map((a) => a.vector),
    ];
    const checks = await pool.evaluate(vectors);
    const scores = [...state.scores, ...state.archive.map((a) => a.score)];
    checks.forEach((r, i) => {
      if (
        r.score === null
          ? scores[i] !== null
          : !Number.isFinite(scores[i]) ||
            Math.abs(r.score - scores[i]) >
              1e-8 * Math.max(1, Math.abs(r.score))
      )
        throw Error(
          "Checkpoint scores differ from this engine; restart from saved configuration.",
        );
    });
    verified = true;
  }
  async function loop() {
    if (running || validationBusy) throw Error("Computation already active");
    running = true;
    pause = false;
    stop = false;
    controls();
    try {
      await setup();
      await verify();
      let t = performance.now();
      while (!pause && !stop && !state.done) {
        const vectors = E.next(state);
        if (!vectors.length) break;
        const evaluated = await pool.evaluate(vectors);
        const now = performance.now();
        state.elapsedMs += now - t;
        t = now;
        E.accept(state, evaluated);
        if (Date.now() - lastSave > 10000) await save();
        if (Date.now() - lastPaint > 500) {
          draw();
          lastPaint = Date.now();
        }
      }
      if (stop) {
        state.done = true;
        state.reason = "user stop";
      }
      await save();
      message(
        storageError ||
          (state.done
            ? "Search ended. Select candidates for dense validation."
            : "Paused at a complete batch; checkpoint saved."),
      );
    } catch (e) {
      pause = true;
      await save();
      message(
        `Search interrupted: ${e.message}. Last complete batch is retained.`,
      );
    } finally {
      running = false;
      pool?.close();
      draw();
      results();
      controls();
    }
  }
  function load(s) {
    state = E.restore(s);
    base = state.input;
    document.dispatchEvent(
      new CustomEvent("lb-base-captured", { detail: base }),
    );
    verified = false;
    state.archive.forEach((a) => delete a.dense);
    lastSave = s.checkpointAt ? Date.parse(s.checkpointAt) : 0;
    put("labSpec", state.spec);
    put("labVariables", state.variables);
    put("labOperands", state.operands);
    $("labName").value = state.id;
    $("labBase").textContent = state.input.name || "Restored lens";
    const map = {
      Strategy: "strategy",
      Budget: "budget",
      Seed: "seed",
      Population: "population",
      Generations: "generations",
      Mutation: "mutation",
      Crossover: "crossover",
      Runs: "runs",
      Seconds: "seconds",
      Target: "targetMerit",
      Stagnation: "stagnation",
      Archive: "archiveSize",
      Diversity: "diversity",
    };
    for (const [id, key] of Object.entries(map))
      $("lab" + id).value = state.config[key] ?? "";
    $("labCoarse").checked = state.config.coarse;
    draw();
    results();
    message(
      "Restored. Resume rechecks saved rankings; imported validation must be rerun.",
    );
  }
  button.onclick = guard(() => {
    panel.hidden = false;
    if (!base) capture();
  });
  $("labHide").onclick = () => {
    panel.hidden = true;
  };
  $("labCapture").onclick = guard(capture);
  $("labWorkers").value = Math.max(
    1,
    Math.min(4, (navigator.hardwareConcurrency || 2) - 1),
  );
  $("labPreset").onchange = () => {
    $("labBudget").value = $("labPreset").value;
  };
  $("labMagnitudes").onclick = guard(() => {
    if (!base) throw Error("Capture a lens");
    const pct = Number($("labRadius").value) / 100,
      dt = Number($("labThickness").value);
    if (!(pct > 0 && pct < 1 && dt > 0 && Number.isFinite(dt)))
      throw Error("Invalid variation magnitude");
    const vars = json("labVariables");
    vars.forEach((v) => {
      const value =
          v.key === "stopPosition" ? 0 : base.surfaces[v.surface][v.key],
        d = v.key === "R" ? Math.abs(value) * pct : dt;
      v.min = v.key === "t" ? Math.max(0, value - d) : value - d;
      v.max = value + d;
      delete v.scale;
    });
    put("labVariables", vars);
  });
  $("labStart").onclick = guard(async () => {
    if (!base) capture();
    if (running || validationBusy) return;
    const c = config();
    c.id = `${c.id}-${Date.now()}`;
    state = E.create(
      base,
      json("labSpec"),
      json("labVariables"),
      json("labOperands"),
      c,
    );
    verified = true;
    results();
    $("labComparison").replaceChildren();
    validationBusy = true;
    controls();
    try {
      await save();
      if (storageError) throw Error(storageError);
    } finally {
      validationBusy = false;
      controls();
    }
    await loop();
  });
  $("labPause").onclick = () => {
    pause = true;
    message("Pausing after the current batch…");
  };
  $("labStop").onclick = () => {
    stop = true;
    message("Stopping after the current batch…");
  };
  $("labResume").onclick = guard(loop);
  $("labExport").onclick = guard(() => {
    if (!state) throw Error("No experiment");
    const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "lensbuilder-search-checkpoint.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("labImport").onchange = guard(async () => {
    const f = $("labImport").files[0];
    if (f) {
      if (f.size > 50e6) throw Error("Checkpoint exceeds 50 MB");
      load(JSON.parse(await f.text()));
    }
  });
  $("labList").onclick = guard(async () => {
    const rows = await LBExperiments.list();
    $("labSaved").replaceChildren();
    rows.forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = `${r.id} · ${r.evaluations} eval · ${r.checkpointAt}`;
      $("labSaved").append(o);
    });
    message(
      `${rows.length} saved experiments. Browser storage can be cleared; export important runs.`,
    );
  });
  $("labRestore").onclick = guard(async () => {
    const s = await LBExperiments.load($("labSaved").value);
    if (!s) throw Error("Refresh and select an experiment first");
    load(s);
  });
  $("labLoadBase").onclick = guard(() => {
    if (!state || running || validationBusy) throw Error("Pause search first");
    bridge.adopt(state.input, { experimentId: state.id });
    message("Experiment base loaded as one undoable edit.");
  });
  $("labSort").onchange = results;
  $("labValidate").onclick = guard(async () => {
    if (!state || running || validationBusy) throw Error("Pause search first");
    validationBusy = true;
    controls();
    try {
      await setup();
      const items = selected().length ? selected() : state.archive;
      if (!items.length) throw Error("No valid candidates");
      message("Dense validation in progress…");
      const validated = await pool.evaluate(
        items.map((a) => a.vector),
        true,
      );
      items.forEach((a, i) => (a.dense = validated[i]));
      await save();
      message(
        "Dense geometric validation complete. Search and validation scores are shown separately.",
      );
    } finally {
      validationBusy = false;
      pool?.close();
      results();
      draw();
    }
  });
  $("labRefine").onclick = guard(async () => {
    if (!state || running || validationBusy) throw Error("Pause search first");
    const items = selected();
    if (!items.length) throw Error("Select at least one candidate");
    validationBusy = true;
    controls();
    try {
      for (const item of items) {
        const refined = await new Promise((resolve, reject) => {
          const w = new Worker("./optimization/refine-worker.js");
          w.onmessage = ({ data }) => {
            w.terminate();
            data.error ? reject(Error(data.error)) : resolve(data);
          };
          w.onerror = (e) => {
            w.terminate();
            reject(Error(e.message));
          };
          w.postMessage({ state, vector: item.vector });
        });
        item.refinement = refined;
        item.dense = refined.dense;
        item.vector = refined.vector;
        item.score = refined.standard.score;
        item.metrics = refined.standard.metrics;
        item.breakdown = refined.standard.breakdown;
      }
      const refinedArchive = state.archive;
      state.archive = [];
      refinedArchive.forEach((a) => E.archive(state, a));
      await save();
      message(
        "Selected candidates locally refined and independently dense-validated. Refinement evaluation counts are included in export.",
      );
    } finally {
      validationBusy = false;
      results();
      draw();
    }
  });
  $("labCompare").onclick = guard(() => {
    const items = selected();
    if (items.length < 2 || items.length > 6)
      throw Error("Select 2–6 candidates");
    document.dispatchEvent(
      new CustomEvent("lb-compare-apertures", {
        detail: {
          items,
          configuration: state.spec,
          software: state.software,
          base: state.input,
        },
      }),
    );
    const host = $("labComparison");
    host.replaceChildren();
    items.forEach((a) => {
      const card = document.createElement("section"),
        h = document.createElement("h4");
      h.textContent = `Candidate at evaluation ${a.evaluation}`;
      card.append(h);
      const p = document.createElement("p");
      p.textContent = a.dense
        ? `Dense merit ${fmt(a.dense.score)} · ${a.dense.validation.kind}`
        : "UNVALIDATED SEARCH RESULT";
      card.append(p);
      if (a.dense?.layout) {
        const diagram = document.createElement("canvas");
        diagram.width = 360;
        diagram.height = 200;
        const ctx = diagram.getContext("2d"),
          layout = a.dense.layout,
          left = Math.min(
            -5,
            ...layout.traces.flatMap((t) => t.points.map((p) => p.x)),
          ),
          right = layout.imageX + 3,
          height = Math.max(...layout.surfaces.map((s) => s.ap)) * 1.3,
          sx = (x) => 10 + ((x - left) / (right - left)) * 340,
          sy = (y) => 100 - (y / height) * 90;
        ctx.strokeStyle = "#aebdd1";
        layout.surfaces.forEach((s) => {
          ctx.beginPath();
          for (let j = 0; j <= 40; j++) {
            const y = -s.ap + (2 * s.ap * j) / 40,
              x = s.x + LBOptics.sag(s.R, Math.abs(y));
            j ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y));
          }
          ctx.stroke();
        });
        layout.traces.forEach((t) => {
          ctx.strokeStyle = t.field ? "#e3b86c" : "#68d7b7";
          ctx.beginPath();
          t.points.forEach((p, i) =>
            i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y)),
          );
          ctx.stroke();
        });
        card.append(diagram);
      }
      if (a.dense?.analysis?.valid) {
        const canvas = document.createElement("canvas");
        canvas.width = 360;
        canvas.height = 180;
        const ctx = canvas.getContext("2d"),
          rows = (
            a.dense.analysis.apertures?.[0]?.analysis || a.dense.analysis
          ).rows.filter((r) => r.field === 1),
          hits = rows.flatMap((r) => r.hits);
        const cy = hits.reduce((n, h) => n + h.y, 0) / hits.length,
          cz = hits.reduce((n, h) => n + h.z, 0) / hits.length,
          range = Math.max(
            ...hits.map((h) => Math.hypot(h.y - cy, h.z - cz)),
            0.001,
          );
        rows.forEach((r, i) => {
          ctx.fillStyle = ["#68a8ff", "#68dd99", "#ff7979"][i % 3];
          r.hits.forEach((h) =>
            ctx.fillRect(
              180 + ((h.y - cy) / range) * 75,
              90 + ((h.z - cz) / range) * 75,
              2,
              2,
            ),
          );
        });
        const caption = document.createElement("p");
        caption.textContent = `Corner spot; independently scaled ±${fmt(range)} mm`;
        card.append(caption, canvas);
      }
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(
        {
          metrics: a.dense?.metrics || a.metrics,
          changedParameters: state.variables.map((v, i) => ({
            id: v.id,
            before: v.value,
            after: a.vector[i],
            delta: a.vector[i] - v.value,
          })),
          merit: a.dense?.breakdown || a.breakdown,
        },
        null,
        2,
      );
      card.append(pre);
      host.append(card);
    });
  });
  window.addEventListener("beforeunload", (e) => {
    if (running) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  controls();
})();
