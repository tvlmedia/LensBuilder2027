(function () {
  "use strict";
  const S = LBSynthesis,
    P = LBSynthesisPhysics,
    $ = (id) => document.getElementById(id),
    fmt = (x) => (Number.isFinite(x) ? Number(x).toPrecision(6) : "—");
  const button = document.createElement("button");
  button.className = "btn";
  button.id = "openSynthesis";
  button.textContent = "NEW LENS";
  document.querySelector('[aria-label="Main toolbar"]').prepend(button);
  const panel = document.createElement("section");
  panel.id = "synthesisPanel";
  panel.className = "searchLab synthesisPanel";
  panel.hidden = true;
  panel.innerHTML = `<header><div><p class="synthesisEyebrow">CLASSICAL OPTICS · NUMERICAL DESIGN</p><h2>New lens</h2></div><button class="btn" id="synthesisClose">Back to editor</button></header>
 <p>Start with requirements. LensBuilder generates physical prescriptions, traces real rays and optimizes the measured objective.</p>
 <div class="labActions"><button class="btn" id="synthesisManual">MANUAL DESIGN</button><button class="btn btnPrimary" id="synthesisAutomatic">GENERATE & OPTIMIZE</button></div>
 <div id="synthesisWorkflow" hidden><div class="synthesisIntro"><h3>From requirements to prescriptions</h3><p>Topology → generated seeds → geometry & paraxial filter → real rays → Differential Evolution → local refinement → dense multi-aperture validation.</p><p>Geometric f-number only. PSF, MTF and T-stop: unavailable. Sampled pupil survival is not certified image coverage. No manufacturing or production-readiness claim.</p></div>
 <div id="synthesisFields" class="labConfig"></div>
 <details><summary>Advanced specification, bounds policy & merit</summary><p>Read controls before editing JSON. Advanced JSON is applied when you press Apply advanced specification. Fields, wavelengths, mechanical envelope stations and budget fractions are editable here. Radius bounds preserve sign; iris position stays in air. Glass choices stay fixed during geometry search.</p><button class="btn" id="synthesisRead">Read controls into advanced specification</button><label>NewLensSpecification JSON<textarea id="synthesisSpec" rows="18"></textarea></label><button class="btn" id="synthesisApply">Apply advanced specification</button><label>TECHNICAL_BALANCED_v1 operands (blank = generate from aperture configuration)<textarea id="synthesisOperands" rows="12"></textarea></label><button class="btn" id="synthesisMerit">Build inspectable default operands</button></details>
 <div class="labActions"><button class="btn btnPrimary" id="synthesisStart">Start numerical synthesis</button><button class="btn" id="synthesisPause">Pause & checkpoint</button><button class="btn" id="synthesisResume">Resume synthesis</button><button class="btn" id="synthesisStop">Stop after batch</button><button class="btn" id="synthesisExport">Export synthesis experiment</button><label>Import synthesis checkpoint<input id="synthesisImport" type="file" accept=".json"></label><button class="btn" id="synthesisList">Refresh synthesis experiments</button><select id="synthesisSaved" aria-label="Saved synthesis experiments"></select><button class="btn" id="synthesisRestore">Restore synthesis autosave</button></div>
 <p role="status" id="synthesisMessage">Enter a specification, then start.</p><pre id="synthesisProgress"></pre><canvas id="synthesisLive" width="1000" height="240" aria-label="Current generated lens and real rays"></canvas>
 <h3>Candidate prescriptions</h3><p>All candidates use the same dense validation configuration. Merit is specific to the visible operands. Choose candidates to compare; adoption is one undoable editor change. The editor preview sensor remains independently configurable; the validated image circle is stored with the experiment. Optimize Glass is an additional search of up to 200 geometry evaluations per substitution.</p><button class="btn" id="synthesisCompare">Compare selected in measurement laboratory</button><button class="btn" id="synthesisCSV">Export results CSV</button><div id="synthesisResults"></div></div>`;
  document.body.append(panel);
  const groups = [
    [
      "Basic",
      [
        ["name", "Design name", "text"],
        ["targetEflMm", "Target EFL mm"],
        ["eflToleranceMm", "EFL tolerance ± mm"],
        ["targetFNumber", "Geometric f-number"],
        ["imageCircleMm", "Required image circle Ø mm"],
        ["sensorWidthMm", "Sensor width mm (optional)"],
        ["sensorHeightMm", "Sensor height mm (optional)"],
        ["mount", "Mount (metadata)", "text"],
        ["flangeFocalDistanceMm", "Flange focal distance mm"],
      ],
    ],
    [
      "Construction & mechanics",
      [
        ["minElements", "Minimum elements"],
        ["maxElements", "Maximum elements"],
        ["minGroups", "Minimum groups"],
        ["maxGroups", "Maximum groups"],
        ["cementedAllowed", "Cemented groups allowed", "checkbox"],
        ["maxOpticalLengthMm", "Maximum length incl. image gap mm"],
        ["maxDiameterMm", "Maximum diameter mm"],
        ["maxRearDiameterMm", "Maximum rear diameter mm"],
        ["minBflMm", "Minimum BFL / rear-to-image mm"],
        ["minCenterMm", "Minimum center thickness mm"],
        ["minEdgeMm", "Minimum edge thickness mm"],
        ["minAirGapMm", "Minimum air gap mm"],
        ["minMechanicalClearanceMm", "Minimum mechanical clearance mm"],
      ],
    ],
    [
      "Materials & analysis",
      [
        ["allowedGlasses", "Verified SCHOTT glasses (comma separated)", "text"],
        ["seedGlassPolicy", "Glass pairs during seed generation", "select"],
        ["maxUniqueGlasses", "Maximum unique glass types"],
        ["fields", "Normalized fields 0–1 (comma separated)", "text"],
        ["wavelengths", "Wavelengths nm (comma separated)", "text"],
        ["apertures", "Apertures f/ (comma separated)", "text"],
        ["minRayFraction", "Minimum sampled pupil survival"],
        ["pupilGrid", "Search pupil grid"],
        ["validationGrid", "Dense pupil grid"],
      ],
    ],
    [
      "Search",
      [
        ["topology", "Topology", "select"],
        ["budget", "Complete funnel budget"],
        ["workers", "Workers"],
        ["seed", "Random seed"],
        ["parentsPerTopology", "Parents per topology"],
        ["archiveSize", "Candidate archive size"],
      ],
    ],
  ];
  for (const [title, fields] of groups) {
    const section = document.createElement("section");
    const h = document.createElement("h3");
    h.textContent = title;
    section.append(h);
    for (const [key, label, type = "number"] of fields) {
      const l = document.createElement("label");
      l.append(document.createTextNode(label));
      const input = document.createElement(
        type === "select" ? "select" : "input",
      );
      input.id = "syn_" + key;
      if (type !== "select") {
        input.type = type;
        if (type === "number") input.step = "any";
      } else
        for (const f of key === "seedGlassPolicy" ? [
          { id: "first-pair-v1", name: "First crown / flint pair (legacy)" },
          { id: "sample-pairs-v1", name: "Explore allowed crown / flint pairs" },
        ] : [
          { id: "auto", name: "AUTO · explore suitable families" },
          ...LBDesignForms.forms,
        ]) {
          const o = document.createElement("option");
          o.value = f.id;
          o.textContent = f.name;
          input.append(o);
        }
      l.append(input);
      section.append(l);
    }
    $("synthesisFields").append(section);
  }
  const preset = document.createElement("label");
  preset.textContent = "Budget preset";
  const select = document.createElement("select");
  select.id = "synthesisBudgetPreset";
  for (const [name, n] of [
    ["Quick", 10000],
    ["Medium", 100000],
    ["Deep", 1000000],
    ["Extreme", 10000000],
    ["Custom", 0],
  ]) {
    const o = document.createElement("option");
    o.value = n;
    o.textContent = name + (n ? " · " + n.toLocaleString() : "");
    select.append(o);
  }
  preset.append(select);
  $("syn_budget").parentElement.before(preset);
  select.onchange = () => {
    if (+select.value) $("syn_budget").value = select.value;
  };
  let advanced = LBSynthesisSpec.specification(),
    state = null,
    pool = null,
    running = false,
    pause = false,
    stop = false,
    busy = false,
    lastSave = 0,
    lastPaint = 0;
  const glassPreset = document.createElement("button");
  glassPreset.className = "btn";
  glassPreset.id = "synthesisGlassPreset";
  glassPreset.textContent = "Use expanded verified glass set";
  $("syn_allowedGlasses").parentElement.after(glassPreset);
  glassPreset.onclick = () => {
    $("syn_allowedGlasses").value = "N-BK7,N-F2,N-LAK22,N-SK16,N-SF6,N-SF10,N-BAK4,N-PK52A";
    $("syn_seedGlassPolicy").value = "sample-pairs-v1";
    message("Eight distinct verified glass models selected. Seeds explore crown/flint pairs; each seed uses two glass types. Start a new run to apply.");
  };
  function message(t) {
    $("synthesisMessage").textContent = t;
  }
  const guard = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      message(e.message);
    }
  };
  function fill(s) {
    advanced = structuredClone(s);
    for (const [, fields] of groups)
      for (const [key, , type] of fields) {
        const input = $("syn_" + key);
        if (type === "checkbox") input.checked = s[key];
        else if (key === "seedGlassPolicy") input.value = s[key] || "first-pair-v1";
        else if (key === "wavelengths")
          input.value = s[key].map((w) => w.nm).join(",");
        else if (key === "apertures")
          input.value = s[key].map((a) => a.fNumber).join(",");
        else
          input.value = Array.isArray(s[key])
            ? s[key].join(",")
            : (s[key] ?? "");
      }
    $("synthesisSpec").value = JSON.stringify(s, null, 2);
  }
  function config() {
    const raw = structuredClone(advanced);
    for (const [, fields] of groups)
      for (const [key, , type = "number"] of fields) {
        const input = $("syn_" + key);
        if (type === "checkbox") raw[key] = input.checked;
        else if (type === "number") {
          if (input.value === "") {
            delete raw[key];
            continue;
          }
          raw[key] = Number(input.value);
        } else raw[key] = input.value;
      }
    raw.allowedGlasses = raw.allowedGlasses.split(",").map((s) => s.trim());
    raw.fields = raw.fields.split(",").map(Number);
    raw.wavelengths = raw.wavelengths
      .split(",")
      .map(Number)
      .map((nm) => ({
        nm,
        weight: advanced.wavelengths.find((w) => w.nm === nm)?.weight ?? 1,
      }));
    raw.apertures = raw.apertures
      .split(",")
      .map(Number)
      .map(
        (fNumber) =>
          advanced.apertures.find((a) => a.fNumber === fNumber) || {
            fNumber,
            optimization: true,
            validation: true,
            weight: 1,
          },
      );
    return LBSynthesisSpec.specification(raw);
  }
  async function save() {
    if (!state) return;
    await LBExperiments.save(state);
    lastSave = Date.now();
    localStorage.setItem("lensbuilder:last-synthesis", state.id);
  }
  async function list() {
    const rows = (await LBExperiments.list()).filter(
      (a) => a.version === S.VERSION,
    );
    $("synthesisSaved").replaceChildren(
      ...rows.map((a) => {
        const o = document.createElement("option");
        o.value = a.id;
        o.textContent = a.spec.name + " · " + a.stage + " · " + a.checkpointAt;
        return o;
      }),
    );
  }
  function draw() {
    if (!state) return;
    const n = Object.entries(state.counts)
      .filter(([k]) => k !== "paraxialPassed")
      .reduce((n, [, v]) => n + v, 0);
    $("synthesisProgress").textContent =
      `${running ? "RUNNING" : state.done ? "FINISHED" : "PAUSED"} · ${state.stage}\n${state.spec.name} · ${state.spec.targetEflMm} mm · f/${state.spec.targetFNumber} · circle Ø${state.spec.imageCircleMm} mm · maximum field height ${state.spec.maxFieldHeightMm} mm\nSensor diagonal ${state.spec.sensorDiagonalMm ?? "not supplied"} mm · workers ${state.spec.workers}\nFamilies: ${state.selected.map((a) => LBDesignForms.get(a.id).name).join(", ")}\nBudget allocation: ${JSON.stringify(state.allocation)}\nCounts: ${JSON.stringify(state.counts)}\nConsumed stage units ${n} / ${state.spec.budget} · elapsed ${fmt(state.elapsedMs / 1000)} s · ${fmt(n / Math.max(0.001, state.elapsedMs / 1000))} stage units/s\nCurrent topology ${state.jobs[state.jobIndex]?.topology || "—"} · best search merit ${fmt(state.current?.archive[0]?.score ?? state.archive[0]?.score)}\nBest dense merit ${fmt(Math.min(...state.results.filter((a) => a.status === "DENSE VALIDATED").map((a) => a.dense.score)))}\nLast checkpoint ${lastSave ? new Date(lastSave).toLocaleTimeString() : "not yet saved"}\nRejections by stage: ${JSON.stringify(state.stageRejections)}`;
    $("synthesisStart").disabled = running || busy;
    $("synthesisPause").disabled = !running;
    $("synthesisResume").disabled = running || busy || state.done;
    $("synthesisStop").disabled = !running;
    if (Date.now() - lastPaint > 1500) {
      const candidate = state.archive[0]?.system || state.seeds[0]?.system;
      if (candidate) layout($("synthesisLive"), candidate);
      lastPaint = Date.now();
    }
  }
  function layout(canvas, system) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      const c = LBOptics.compile(system),
        p = LBOptics.paraxial(c),
        radius = Math.max(
          state.spec.maxFieldHeightMm * 1.2,
          ...c.surfaces.map((a) => a.ap),
        ),
        scale = Math.min(
          (canvas.width - 45) / (c.imageX + 5),
          (canvas.height - 40) / (2 * radius),
        ),
        x = (v) => 20 + v * scale,
        y = (v) => canvas.height / 2 - v * scale;
      ctx.strokeStyle = "#41516a";
      ctx.beginPath();
      ctx.moveTo(0, y(0));
      ctx.lineTo(canvas.width, y(0));
      ctx.stroke();
      for (const a of c.surfaces) {
        ctx.strokeStyle = a.stop ? "#ffbd69" : "#a6d4ed";
        ctx.beginPath();
        for (let i = 0; i <= 50; i++) {
          const yy = a.ap * (i / 25 - 1),
            xx = a.vx + LBOptics.sag(a.R, Math.abs(yy));
          if (i === 0) ctx.moveTo(x(xx), y(yy));
          else ctx.lineTo(x(xx), y(yy));
        }
        ctx.stroke();
      }
      for (const field of [0, 1]) {
        const chief = LBOptics.aimChief(
          c,
          Math.atan(
            (field * state.spec.imageCircleMm) / 2 / state.spec.targetEflMm,
          ),
        );
        if (!chief) continue;
        for (const q of [-0.8, -0.4, 0, 0.4, 0.8]) {
          const ray = {
              p: { ...chief.p, y: chief.p.y + q * p.entrancePupilRadiusMm },
              d: chief.d,
            },
            tr = LBOptics.trace(c, ray, { record: true });
          if (!tr.ok) continue;
          ctx.strokeStyle = field ? "#ffad6680" : "#67d9a980";
          ctx.beginPath();
          [ray.p, ...tr.points, tr.hit].forEach((h, i) =>
            i ? ctx.lineTo(x(h.x), y(h.y)) : ctx.moveTo(x(h.x), y(h.y)),
          );
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#cbd6e4";
      ctx.fillText(
        "Actual surfaces and surviving d-line rays · on-axis / full field",
        16,
        18,
      );
    } catch (e) {
      ctx.fillText(e.message, 20, 20);
    }
  }
  async function run() {
    if (!state || state.done || running) return;
    running = true;
    pause = false;
    stop = false;
    pool = new LBEvaluationPool(state.spec.workers);
    try {
      if (state.current) await pool.init(state.current);
      while (!state.done && !pause && !stop) {
        await S.step(state, pool);
        if (Date.now() - lastSave > 3000) await save();
        draw();
        await new Promise((r) => setTimeout(r, 0));
      }
      if (stop) {
        state.stoppedAtStage = state.stage;
        message(
          "Stopped at a complete batch. Resume preserves this exact state.",
        );
      }
      await save();
    } catch (e) {
      message(
        "Paused: " +
          e.message +
          ". Export the checkpoint if storage is unavailable.",
      );
    } finally {
      pool.close();
      pool = null;
      running = false;
      draw();
      render();
      await list().catch(() => {});
    }
  }
  function download(name, content, type = "application/json") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function render() {
    const host = $("synthesisResults");
    host.replaceChildren();
    state?.results.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "synthesisCandidate";
      const h = document.createElement("h4");
      h.textContent = `${index + 1}. ${LBDesignForms.get(item.topology).name} · ${item.status}`;
      card.append(h);
      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.index = index;
      check.setAttribute(
        "aria-label",
        "Compare synthesis candidate " + (index + 1),
      );
      card.prepend(check);
      const p = document.createElement("p"),
        first = item.dense?.analysis?.firstOrder || P.firstOrder(item.system).p,
        counts = P.construction(item.system);
      p.textContent = `${counts.elements} elements / ${counts.groups} groups · ${counts.glasses.join(", ")}\nEFL ${fmt(first?.eflMm)} mm · f/${fmt(first?.fNumber)} · BFL ${fmt(first?.bflMm)} mm · rear-to-image ${fmt(first?.imageDistanceMm)} mm · optical length ${fmt(item.system.surfaces.slice(1, -1).reduce((n, a) => n + a.t, 0))} mm · diameter ${fmt(2 * Math.max(...item.system.surfaces.slice(1, -1).map((a) => a.ap)))} mm\n${state.meritPreset || "TECHNICAL_BALANCED_v1"}: initial ${fmt(item.initialScore)} → search ${fmt(item.score)} → dense ${fmt(item.dense?.score)}\n${Object.entries(
        item.checks || {},
      )
        .map(([k, v]) => k + ": " + (v ? "PASS" : "FAIL"))
        .join(" · ")}${item.failure ? " · " + item.failure : ""}`;
      card.append(p);
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 220;
      card.append(canvas);
      layout(canvas, item.system);
      for (const [label, fn] of [
        [
          "ADOPT DESIGN",
          () => {
            if (item.status !== "DENSE VALIDATED")
              throw Error("Dense validation required");
            LensBuilder.adopt(item.dense.prescription, {
              synthesis: {
                experimentId: state.id,
                specification: state.spec,
                topology: item.topology,
                seed: state.spec.seed,
                validation: item.dense.validation,
                checks: item.checks,
                software: state.software,
              },
            });
            panel.hidden = true;
          },
        ],
        [
          "CONTINUE SEARCH FROM THIS DESIGN",
          () => {
            LBSearchLab.loadGenerated(
              item.dense?.prescription || item.system,
              S.analysisSpec(state.spec),
              LBSynthesisSeeds.variables(item.system, state.spec),
              state.operands,
            );
            panel.hidden = true;
          },
        ],
        ["Inspect multi-aperture metrics", () => compare([item])],
        [
          "OPTIMIZE GLASS",
          async () => {
            if (running || busy) throw Error("Pause synthesis first");
            busy = true;
            message(
              "Testing verified glass substitutions and reoptimizing geometry…",
            );
            try {
              state.results[index] = await LBGlassSearch.optimize(
                item,
                state.spec,
                state.operands,
                { yield: () => new Promise((r) => setTimeout(r, 0)) },
              );
              await save();
              render();
              message(
                "Glass search complete; every accepted change was raytraced, locally refined and dense-validated.",
              );
            } finally {
              busy = false;
            }
          },
        ],
      ]) {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = label;
        b.onclick = guard(fn);
        if (label === "ADOPT DESIGN" && item.status !== "DENSE VALIDATED")
          b.disabled = true;
        card.append(b);
      }
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        pre = document.createElement("pre");
      summary.textContent =
        "Prescription, generated variable bounds, compliance & merit breakdown";
      pre.textContent = JSON.stringify(
        {
          prescription: item.dense?.prescription || item.system,
          variables: LBSynthesisSeeds.variables(item.system, state.spec),
          checks: item.checks,
          breakdown: item.dense?.breakdown,
          glassSearch: item.glassSearch,
        },
        null,
        2,
      );
      details.append(summary, pre);
      card.append(details);
      host.append(card);
    });
  }
  function compare(items) {
    if (items.some((a) => !a.dense?.analysis?.valid))
      throw Error("A valid dense analysis is required");
    LBSearchLab.show();
    document.dispatchEvent(
      new CustomEvent("lb-compare-apertures", {
        detail: {
          items,
          configuration: S.analysisSpec(state.spec),
          software: state.software,
        },
      }),
    );
    panel.hidden = true;
    $("measureMetric").scrollIntoView({ block: "center" });
  }
  button.onclick = () => {
    panel.hidden = false;
    list().catch((e) => message(e.message));
  };
  $("synthesisClose").onclick = () => (panel.hidden = true);
  $("synthesisAutomatic").onclick = () => {
    $("synthesisWorkflow").hidden = false;
  };
  $("synthesisManual").onclick = () => {
    panel.hidden = true;
    $("btnNew").click();
  };
  $("synthesisRead").onclick = guard(() => {
    $("synthesisSpec").value = JSON.stringify(config(), null, 2);
  });
  $("synthesisApply").onclick = guard(() => {
    fill(LBSynthesisSpec.specification(JSON.parse($("synthesisSpec").value)));
    message("Advanced specification applied.");
  });
  $("synthesisMerit").onclick = guard(() => {
    $("synthesisOperands").value = JSON.stringify(
      S.operands(config()),
      null,
      2,
    );
  });
  $("synthesisStart").onclick = guard(async () => {
    if (running || busy) throw Error("Pause current work first");
    state = S.create(
      config(),
      $("synthesisOperands").value.trim()
        ? JSON.parse($("synthesisOperands").value)
        : undefined,
      window.LB_BUILD || {},
    );
    message("Numerical synthesis started; editor unchanged until adoption.");
    await save();
    render();
    await run();
  });
  $("synthesisPause").onclick = () => (pause = true);
  $("synthesisStop").onclick = () => (stop = true);
  $("synthesisResume").onclick = guard(run);
  $("synthesisExport").onclick = guard(() => {
    if (!state) throw Error("No experiment");
    download(state.id + ".json", JSON.stringify(state, null, 2));
  });
  $("synthesisList").onclick = guard(list);
  async function restore(raw) {
    if (running || busy) throw Error("Pause current work first");
    state = S.restore(raw);
    fill(state.spec);
    $("synthesisOperands").value = JSON.stringify(state.operands, null, 2);
    lastSave = raw.checkpointAt ? Date.parse(raw.checkpointAt) : 0;
    draw();
    render();
    message(
      "Restored frozen specification and numerical state. Resume continues at the saved batch.",
    );
  }
  $("synthesisRestore").onclick = guard(async () => {
    const id = $("synthesisSaved").value;
    if (!id) throw Error("No saved synthesis selected");
    await restore(await LBExperiments.load(id));
  });
  $("synthesisImport").onchange = guard(async () => {
    const file = $("synthesisImport").files[0];
    if (file) await restore(JSON.parse(await file.text()));
  });
  $("synthesisCompare").onclick = guard(() => {
    const selected = [
      ...$("synthesisResults").querySelectorAll("input:checked"),
    ].map((a) => state.results[+a.dataset.index]);
    if (!selected.length || selected.length > 6)
      throw Error("Select 1–6 candidates");
    compare(selected);
  });
  $("synthesisCSV").onclick = guard(() => {
    if (!state) throw Error("No experiment");
    const rows = [
      [
        "topology",
        "status",
        "searchMerit",
        "denseMerit",
        "EFL_mm",
        "fNumber",
        "BFL_mm",
      ],
    ];
    for (const a of state.results) {
      const p = a.dense?.analysis?.firstOrder || {};
      rows.push([
        a.topology,
        a.status,
        a.score,
        a.dense?.score,
        p.eflMm,
        p.fNumber,
        p.bflMm,
      ]);
    }
    download(
      state.id + ".csv",
      rows
        .map((r) =>
          r
            .map((x) => '"' + String(x ?? "").replaceAll('"', '""') + '"')
            .join(","),
        )
        .join("\n"),
      "text/csv",
    );
  });
  fill(advanced);
  $("synthesisPause").disabled = true;
  $("synthesisResume").disabled = true;
  $("synthesisStop").disabled = true;
})();
