(function(root){
"use strict";
const I=root.LBImport||require("./report.js");
  function sanitizeZoomFieldOverrideMap(src) {
    const out = {};
    const obj = (src && typeof src === "object") ? src : {};
    for (const [k, v] of Object.entries(obj)) {
      const keyNum = Number(k);
      const valNum = Number(v);
      if (!Number.isFinite(keyNum) || !Number.isFinite(valNum)) continue;
      out[String(Math.max(0, Math.trunc(keyNum)))] = valNum;
    }
    return out;
  }

  function parseZemaxFirstNumber(s) {
    const m = String(s ?? "").replace(/,/g, ".").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function parseZemaxNumberList(s) {
    const m = String(s ?? "").replace(/,/g, ".").match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!m) return [];
    return m
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
  }

  function unitTokenToMmScale(token) {
    const u = String(token ?? "").trim().toUpperCase();
    if (u === "MM" || u === "MILLIMETER" || u === "MILLIMETERS") return 1;
    if (u === "CM" || u === "CENTIMETER" || u === "CENTIMETERS") return 10;
    if (u === "M" || u === "METER" || u === "METERS") return 1000;
    if (u === "IN" || u === "INCH" || u === "INCHES") return 25.4;
    return 1;
  }

  function stripOptionalQuotes(s) {
    const raw = String(s ?? "").trim();
    if (!raw) return "";
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1).trim();
    }
    return raw;
  }

  function sourceNameToLensName(sourceName = "Zemax import") {
    return String(sourceName || "Zemax import").replace(/\.(zmx|seq|txt)$/i, "");
  }

  function isLikelyZemaxSequentialText(txt) {
    if (!txt) return false;
    const s = String(txt);
    const hasSurf = /(^|\n)\s*SURF\s+-?\d+/im.test(s);
    const hasModeSeq = /(^|\n)\s*MODE\s+SEQ\b/im.test(s);
    const hasCurv = /(^|\n)\s*CURV\s+/im.test(s);
    return hasSurf && (hasModeSeq || hasCurv);
  }

  function parseZemaxGlassLine(line) {
    const parts = String(line || "").trim().split(/\s+/).filter(Boolean);
    const glass = parts[1] ? String(parts[1]).trim() : "AIR";
    const glassUp = glass.toUpperCase();

    if (glassUp === "___BLANK") {
      const ndFixed = parseZemaxFirstNumber(parts[4]);
      const vdFixed = parseZemaxFirstNumber(parts[5]);
      let nd = (Number.isFinite(ndFixed) && ndFixed > 1) ? ndFixed : NaN;
      let vd = (Number.isFinite(vdFixed) && vdFixed > 0) ? vdFixed : NaN;

      // Fallback for variant formatting; still prefer the explicit slots above.
      if (!Number.isFinite(nd) || !Number.isFinite(vd)) {
        const nums = parts
          .slice(2)
          .map((p) => parseZemaxFirstNumber(p))
          .filter((n) => Number.isFinite(n));
        for (let i = 0; i < nums.length; i++) {
          const n = nums[i];
          if (n > 1.2 && n < 3.0) {
            nd = n;
            for (let j = i + 1; j < nums.length; j++) {
              if (nums[j] > 1) { vd = nums[j]; break; }
            }
            break;
          }
        }
      }

      return {
        glass,
        nd: Number.isFinite(nd) ? nd : null,
        vd: Number.isFinite(vd) ? vd : null,
      };
    }

    const nums = parts
      .slice(2)
      .map((p) => parseZemaxFirstNumber(p))
      .filter((n) => Number.isFinite(n));

    let nd = NaN;
    let ndIdx = -1;
    for (let i = 0; i < nums.length; i++) {
      const n = nums[i];
      if (n > 1.2 && n < 3.0) {
        nd = n;
        ndIdx = i;
        break;
      }
    }

    let vd = NaN;
    if (ndIdx >= 0) {
      for (let i = ndIdx + 1; i < nums.length; i++) {
        const v = nums[i];
        if (v > 1) {
          vd = v;
          break;
        }
      }
    }

    if (!Number.isFinite(nd) && nums.length >= 2) {
      const ndTail = nums[nums.length - 2];
      const vdTail = nums[nums.length - 1];
      if (ndTail > 1.2 && ndTail < 3.0 && vdTail > 1) {
        nd = ndTail;
        vd = vdTail;
      }
    }

    // Missing dispersion stays unavailable; do not fabricate an Abbe number.

    return {
      glass,
      nd: Number.isFinite(nd) ? nd : null,
      vd: Number.isFinite(vd) ? vd : null,
    };
  }

  function extractLikelyZemaxLinesFromText(txt) {
    const all = String(txt || "").replace(/\r/g, "").split("\n");
    if (!all.length) return [];
    const idxVers = all.findIndex((ln) => /^\s*VERS\b/i.test(ln));
    const idxModeSeq = all.findIndex((ln) => /^\s*MODE\s+SEQ\b/i.test(ln));
    const idxModeAny = all.findIndex((ln) => /^\s*MODE\b/i.test(ln));
    const idxSurf = all.findIndex((ln) => /^\s*SURF\s+-?\d+/i.test(ln));
    let start = -1;

    const preferred = [idxVers, idxModeSeq].filter((n) => n >= 0);
    if (preferred.length) {
      start = Math.min(...preferred);
    } else if (idxModeAny >= 0) {
      start = idxModeAny;
    } else if (idxSurf >= 0) {
      start = idxSurf;
    }

    if (start < 0) return all;
    return all.slice(start);
  }

  function parseZemaxMultiConfigLines(lines, unitScaleDefault = 1) {
    const out = {
      count: 1,
      configsByIndex: new Map(),
    };
    if (!Array.isArray(lines) || !lines.length) return out;

    let unitScaleToMm = Number.isFinite(Number(unitScaleDefault)) ? Number(unitScaleDefault) : 1;
    const ensureConfig = (cfgIndex) => {
      const idx = Number.isFinite(Number(cfgIndex)) ? Math.max(1, Math.trunc(Number(cfgIndex))) : 1;
      if (!out.configsByIndex.has(idx)) {
        out.configsByIndex.set(idx, {
          index: idx,
          label: null,
          aperture: null,
          thicknessOverrides: {},
          fieldOverrides: { vdx: {}, vdy: {}, vcx: {}, vcy: {} },
        });
      }
      return out.configsByIndex.get(idx);
    };

    for (const raw of lines) {
      const line = String(raw || "").trim();
      if (!line) continue;

      const mUnit = line.match(/^UNIT\s+([A-Za-z]+)/i);
      if (mUnit) {
        unitScaleToMm = unitTokenToMmScale(mUnit[1]);
        continue;
      }

      const mNum = line.match(/^MNUM\s+(\d+)/i);
      if (mNum) {
        out.count = Math.max(out.count, Math.max(1, Math.trunc(Number(mNum[1]))));
        continue;
      }

      const mOffQuoted = line.match(/^MOFF\s+0\s+(\d+)\s+"([^"]*)"/i);
      if (mOffQuoted) {
        const cfg = ensureConfig(Number(mOffQuoted[1]));
        const label = String(mOffQuoted[2] || "").trim();
        if (label) cfg.label = label;
        continue;
      }
      const mOffBare = line.match(/^MOFF\s+0\s+(\d+)\s+(.+)$/i);
      if (mOffBare) {
        const cfg = ensureConfig(Number(mOffBare[1]));
        const label = stripOptionalQuotes(String(mOffBare[2] || "")).trim();
        if (label) cfg.label = label;
        continue;
      }

      const mAper = line.match(/^APER\s+0\s+(\d+)\s+([-+0-9.Ee]+)/i);
      if (mAper) {
        const cfg = ensureConfig(Number(mAper[1]));
        const val = Number(mAper[2]);
        if (Number.isFinite(val)) cfg.aperture = val;
        continue;
      }

      const mThic = line.match(/^THIC\s+(\d+)\s+(\d+)\s+([-+0-9.Ee]+)/i);
      if (mThic) {
        const surfNo = Math.max(0, Math.trunc(Number(mThic[1])));
        const cfg = ensureConfig(Number(mThic[2]));
        const val = Number(mThic[3]);
        if (Number.isFinite(val)) cfg.thicknessOverrides[String(surfNo)] = val * unitScaleToMm;
        continue;
      }

      const mFv = line.match(/^FV(DX|DY|CX|CY)\s+(\d+)\s+(\d+)\s+([-+0-9.Ee]+)/i);
      if (mFv) {
        const axis = String(mFv[1] || "").toLowerCase();
        const fieldIndex = Math.max(0, Math.trunc(Number(mFv[2])));
        const cfg = ensureConfig(Number(mFv[3]));
        const val = Number(mFv[4]);
        if (!Number.isFinite(val)) continue;
        const key = `v${axis}`;
        if (!cfg.fieldOverrides[key]) cfg.fieldOverrides[key] = {};
        cfg.fieldOverrides[key][String(fieldIndex)] = val;
      }
    }

    for (let i = 1; i <= out.count; i++) ensureConfig(i);
    return out;
  }

  function buildZoomConfigsFromMeta(multiConfig, surfaces) {
    if (!multiConfig || typeof multiConfig !== "object") return [];
    const map = multiConfig.configsByIndex instanceof Map ? multiConfig.configsByIndex : new Map();
    if (!map.size && !(Number(multiConfig.count) > 1)) return [];

    const knownSurfNos = new Set(
      (Array.isArray(surfaces) ? surfaces : [])
        .map((s) => Number(s?.zmx?.surf))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.max(0, Math.trunc(n)))
    );

    const count = Math.max(1, Number.isFinite(Number(multiConfig.count)) ? Math.trunc(Number(multiConfig.count)) : 1);
    for (let i = 1; i <= count; i++) {
      if (!map.has(i)) {
        map.set(i, {
          index: i,
          label: null,
          aperture: null,
          thicknessOverrides: {},
          fieldOverrides: { vdx: {}, vdy: {}, vcx: {}, vcy: {} },
        });
      }
    }

    const list = Array.from(map.values())
      .map((cfg, arrIdx) => {
        const index = Math.max(1, Math.trunc(Number(cfg?.index || (arrIdx + 1))));
        const label = (cfg?.label != null && String(cfg.label).trim() !== "")
          ? String(cfg.label).trim()
          : null;
        const aperture = Number.isFinite(Number(cfg?.aperture)) ? Number(cfg.aperture) : null;

        const thicknessOverrides = {};
        for (const [k, v] of Object.entries(cfg?.thicknessOverrides || {})) {
          const surfNo = Math.max(0, Math.trunc(Number(k)));
          const val = Number(v);
          if (!Number.isFinite(surfNo) || !Number.isFinite(val)) continue;
          // Keep known surface overrides, but also keep unknown keys for diagnostics and round-trip.
          if (knownSurfNos.size > 0 && !knownSurfNos.has(surfNo)) {
            thicknessOverrides[String(surfNo)] = val;
            continue;
          }
          thicknessOverrides[String(surfNo)] = val;
        }

        const fieldOverrides = {
          vdx: sanitizeZoomFieldOverrideMap(cfg?.fieldOverrides?.vdx),
          vdy: sanitizeZoomFieldOverrideMap(cfg?.fieldOverrides?.vdy),
          vcx: sanitizeZoomFieldOverrideMap(cfg?.fieldOverrides?.vcx),
          vcy: sanitizeZoomFieldOverrideMap(cfg?.fieldOverrides?.vcy),
        };

        const overrideSurfaceNumbers = Object.keys(thicknessOverrides)
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);

        return {
          index,
          label,
          aperture,
          thicknessOverrides,
          fieldOverrides,
          overrideSurfaceNumbers,
        };
      })
      .sort((a, b) => a.index - b.index);

    const hasThic = list.some((cfg) => Object.keys(cfg.thicknessOverrides || {}).length > 0);
    if (!hasThic && list.length <= 1) return [];
    return list;
  }

  function parseZemaxSequentialText(txt, sourceName = "Zemax file") {
    const lines = extractLikelyZemaxLinesFromText(txt);
    const report = I.inspect(lines.join("\n"));
    if(report.failed.length)throw new Error(I.describe(report));
    if (!lines.length) throw new Error("Empty file");

    let unitScaleToMm = 1;
    const parsed = [];
    let cur = null;

    const zemaxMeta = {
      source: "zemax",
      name: null,
      version: null,
      mode: null,
      fieldType: "angle_deg",
      wavelengthsByIndex: new Map(),
      primaryWavelengthIndex: null,
      fieldsRaw: {
        yfln: [],
        fwgn: [],
        vdx: [],
        vdy: [],
        vcx: [],
        vcy: [],
      },
      multiConfig: parseZemaxMultiConfigLines(lines, unitScaleToMm),
    };

    const pushCur = () => {
      if (!cur) return;
      parsed.push(cur);
      cur = null;
    };

    for (const raw of lines) {
      const line = String(raw || "").trim();
      if (!line) continue;
      if (line.startsWith("!") || line.startsWith("#") || line.startsWith("//")) continue;

      const up = line.toUpperCase();

      if (/^VERS\b/i.test(line)) {
        zemaxMeta.version = stripOptionalQuotes(line.replace(/^VERS\b/i, ""));
        continue;
      }
      if (/^MODE\b/i.test(line)) {
        zemaxMeta.mode = stripOptionalQuotes(line.replace(/^MODE\b/i, "")).toUpperCase();
        continue;
      }
      if (/^NAME\b/i.test(line)) {
        const nm = stripOptionalQuotes(line.replace(/^NAME\b/i, ""));
        if (nm) zemaxMeta.name = nm;
        continue;
      }
      if (/^PWAV\b/i.test(line)) {
        const nums = parseZemaxNumberList(line.replace(/^PWAV\b/i, ""));
        if (nums.length) zemaxMeta.primaryWavelengthIndex = Math.max(1, Math.round(nums[0]));
        continue;
      }
      if (/^WAVM\b/i.test(line)) {
        const nums = parseZemaxNumberList(line.replace(/^WAVM\b/i, ""));
        if (nums.length) {
          let idx = 0;
          // Zemax WAVM format is typically: WAVM <idx> <lambda_um> <weight>
          // Use the wavelength slot (2nd numeric token), not the weight token.
          let lam = (nums.length >= 2) ? nums[1] : nums[nums.length - 1];
          if (nums.length >= 2) idx = Math.round(nums[0]);
          if (!Number.isFinite(idx) || idx <= 0) idx = zemaxMeta.wavelengthsByIndex.size + 1;
          if (Number.isFinite(lam) && lam > 0) {
            const lamNm = lam < 10 ? lam * 1000 : lam;
            zemaxMeta.wavelengthsByIndex.set(idx, lamNm);
          }
        }
        continue;
      }
      if (/^FTYP\b/i.test(line)) {
        const nums = parseZemaxNumberList(line.replace(/^FTYP\b/i, ""));
        const ftyp = nums.length ? Math.round(nums[0]) : 0;
        // 0 in Zemax is angular fields; keep default as angle_deg.
        if (ftyp === 0) zemaxMeta.fieldType = "angle_deg";
        else if (ftyp === 1) zemaxMeta.fieldType = "image_height";
        continue;
      }
      if (/^YFLN\b/i.test(line)) {
        zemaxMeta.fieldsRaw.yfln = parseZemaxNumberList(line.replace(/^YFLN\b/i, ""));
        continue;
      }
      if (/^FWGN\b/i.test(line)) {
        zemaxMeta.fieldsRaw.fwgn = parseZemaxNumberList(line.replace(/^FWGN\b/i, ""));
        continue;
      }
      if (/^VDXN?\b/i.test(line)) {
        zemaxMeta.fieldsRaw.vdx = parseZemaxNumberList(line.replace(/^VDXN?\b/i, ""));
        continue;
      }
      if (/^VDYN?\b/i.test(line)) {
        zemaxMeta.fieldsRaw.vdy = parseZemaxNumberList(line.replace(/^VDYN?\b/i, ""));
        continue;
      }
      if (/^VCXN?\b/i.test(line)) {
        zemaxMeta.fieldsRaw.vcx = parseZemaxNumberList(line.replace(/^VCXN?\b/i, ""));
        continue;
      }
      if (/^VCYN?\b/i.test(line)) {
        zemaxMeta.fieldsRaw.vcy = parseZemaxNumberList(line.replace(/^VCYN?\b/i, ""));
        continue;
      }

      if (up.startsWith("UNIT")) {
        const parts = up.split(/\s+/);
        unitScaleToMm = unitTokenToMmScale(parts[1] || "MM");
        continue;
      }

      const mSurf = up.match(/^SURF\s+(-?\d+)/);
      if (mSurf) {
        pushCur();
        cur = {
          idx: Number(mSurf[1]),
          CURV: 0,
          DISZ: 0,
          DIAM: NaN,
          GLAS: "AIR",
          ORIGINAL_GLASS: "AIR",
          nd: null,
          vd: null,
          GLAS_ND: null,
          GLAS_VD: null,
          STOP: false,
        };
        continue;
      }

      if (!cur) continue;

      if (up.startsWith("CURV")) {
        const v = parseZemaxFirstNumber(line.slice(4));
        if (Number.isFinite(v)) cur.CURV = v;
        continue;
      }

      if (up.startsWith("DISZ")) {
        const v = parseZemaxFirstNumber(line.slice(4));
        if (Number.isFinite(v)) cur.DISZ = v;
        continue;
      }

      if (up.startsWith("DIAM")) {
        const v = parseZemaxFirstNumber(line.slice(4));
        if (Number.isFinite(v)) cur.DIAM = Math.abs(v);
        continue;
      }

      if (up.startsWith("GLAS")) {
        const parsedGlass = parseZemaxGlassLine(line);
        const glassName = String(parsedGlass.glass || "AIR").trim();
        const isBlank = glassName.toUpperCase() === "___BLANK";
        cur.ORIGINAL_GLASS = glassName || "AIR";
        cur.GLAS = isBlank ? "CUSTOM" : glassName;
        cur.nd = parsedGlass.nd;
        cur.vd = parsedGlass.vd;
        cur.GLAS_ND = parsedGlass.nd;
        cur.GLAS_VD = parsedGlass.vd;
        continue;
      }

      if (/^STOP\b/i.test(line)) {
        cur.STOP = true;
        continue;
      }
    }

    pushCur();
    if (!parsed.length) throw new Error("No SURF blocks found");

    parsed.sort((a, b) => a.idx - b.idx);
    const surfaces = parsed.map((s, i) => {
      const isFirst = i === 0;
      const isLast = i === parsed.length - 1;
      const curv = Number(s.CURV || 0);
      const R = Math.abs(curv) < 1e-12 ? 0 : (1 / curv) * unitScaleToMm;
      const t = Number.isFinite(Number(s.DISZ)) ? Number(s.DISZ) * unitScaleToMm : 0;
      const apSemi = Number.isFinite(Number(s.DIAM)) ? Math.max(0.01, Number(s.DIAM) * unitScaleToMm) : 10;

      const g = String(s.GLAS || "AIR").trim();
      const glass = (!g || g === "-") ? "AIR" : g;
      const originalGlass = String(s.ORIGINAL_GLASS || g || "AIR").trim();
      const glassNd = (Number.isFinite(Number(s.nd ?? s.GLAS_ND)) && Number(s.nd ?? s.GLAS_ND) > 1)
        ? Number(s.nd ?? s.GLAS_ND)
        : null;
      const glassVd = (glassNd != null)
        ? ((Number.isFinite(Number(s.vd ?? s.GLAS_VD)) && Number(s.vd ?? s.GLAS_VD) > 0) ? Number(s.vd ?? s.GLAS_VD) : null)
        : null;

      return {
        type: isFirst ? "OBJ" : (isLast ? "IMS" : String(i)),
        R,
        t,
        ap: apSemi,
        ap_optical: apSemi,
        ap_mech: null,
        draw_mode: "optical",
        shoulder_mode: "none",
        shoulder_depth: 0,
        bevel: 0,
        edge_thickness_mode: "auto",
        glass,
        originalGlass,
        nd: glassNd,
        vd: glassVd,
        glass_nd: glassNd,
        glass_vd: glassVd,
        stop: isLast ? false : !!s.STOP,
        zmx: {
          surf: s.idx,
          curv: curv,
          baseCurv: curv,
          disz: t,
          disz_raw: Number(s.DISZ),
          baseDisz: t,
          diam: Number(s.DIAM),
          glass_name: originalGlass,
          nd: glassNd,
          vd: glassVd,
          glass_nd: glassNd,
          glass_vd: glassVd,
        },
      };
    });
    if (!surfaces.length) throw new Error("No valid surfaces after parse");

    const sortedWaveIdx = Array.from(zemaxMeta.wavelengthsByIndex.keys()).sort((a, b) => a - b);
    const wavelengthsNm = sortedWaveIdx
      .map((idx) => Number(zemaxMeta.wavelengthsByIndex.get(idx)))
      .filter((v) => Number.isFinite(v) && v > 0);

    const primaryWavelengthIndex = Number.isFinite(Number(zemaxMeta.primaryWavelengthIndex))
      ? Math.max(1, Math.round(Number(zemaxMeta.primaryWavelengthIndex)))
      : null;
    const primaryWavelengthNm = (primaryWavelengthIndex != null && zemaxMeta.wavelengthsByIndex.has(primaryWavelengthIndex))
      ? Number(zemaxMeta.wavelengthsByIndex.get(primaryWavelengthIndex))
      : null;

    const yfln = Array.isArray(zemaxMeta.fieldsRaw.yfln) ? zemaxMeta.fieldsRaw.yfln : [];
    const fwgn = Array.isArray(zemaxMeta.fieldsRaw.fwgn) ? zemaxMeta.fieldsRaw.fwgn : [];
    const vdx = Array.isArray(zemaxMeta.fieldsRaw.vdx) ? zemaxMeta.fieldsRaw.vdx : [];
    const vdy = Array.isArray(zemaxMeta.fieldsRaw.vdy) ? zemaxMeta.fieldsRaw.vdy : [];
    const vcx = Array.isArray(zemaxMeta.fieldsRaw.vcx) ? zemaxMeta.fieldsRaw.vcx : [];
    const vcy = Array.isArray(zemaxMeta.fieldsRaw.vcy) ? zemaxMeta.fieldsRaw.vcy : [];
    const fieldCount = Math.max(yfln.length, fwgn.length, vdx.length, vdy.length, vcx.length, vcy.length, 0);
    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      const angleDegRaw = Number(yfln[i]);
      const angleDeg = Number.isFinite(angleDegRaw) ? angleDegRaw : (i === 0 ? 0 : null);
      if (angleDeg == null) continue;
      const weightRaw = Number(fwgn[i]);
      fields.push({
        index: i,
        angleDeg,
        weight: Number.isFinite(weightRaw) ? Math.max(0, weightRaw) : 1,
        vdx: Number.isFinite(Number(vdx[i])) ? Number(vdx[i]) : 0,
        vdy: Number.isFinite(Number(vdy[i])) ? Number(vdy[i]) : 0,
        vcx: Number.isFinite(Number(vcx[i])) ? Number(vcx[i]) : 0,
        vcy: Number.isFinite(Number(vcy[i])) ? Number(vcy[i]) : 0,
      });
    }

    const zoomConfigs = buildZoomConfigsFromMeta(zemaxMeta.multiConfig, surfaces);
    const zoom = zoomConfigs.length
      ? { activeConfig: Number(zoomConfigs[0]?.index || 1), configs: zoomConfigs }
      : null;
    const imsSurfaceNumber = Number(surfaces?.[surfaces.length - 1]?.zmx?.surf);

    const lensName = zemaxMeta.name || sourceNameToLensName(sourceName);
    return {
      importReport: report,
      name: lensName,
      zemaxName: zemaxMeta.name || null,
      zemaxVersion: zemaxMeta.version || null,
      notes: [
        "Imported from Zemax sequential text.",
        "Mapping: R = 1/CURV, t = DISZ, glass = GLAS, ap = DIAM (semi-diameter).",
        "GLAS lines with explicit nd/Vd are preserved per surface (e.g. ___BLANK).",
        "Default draw mode for Zemax import is optical-only (no inferred mechanical shoulders).",
      ],
      import_options: {
        use_same_ap_for_optics_and_mechanics: false,
        preserve_ims_aperture: true,
        use_zemax_fields: fields.length > 0,
        match_zemax_wavelength: false,
      },
      zemax: {
        source: "zemax",
        name: zemaxMeta.name || null,
        version: zemaxMeta.version || null,
        mode: zemaxMeta.mode || null,
        fieldType: zemaxMeta.fieldType || "angle_deg",
        wavelengthsNm,
        primaryWavelengthIndex,
        primaryWavelengthNm,
        fields,
        zoomConfigCount: zoomConfigs.length,
        currentConfigIndex: zoom ? zoom.activeConfig : null,
        currentConfigLabel: zoom ? (zoom.configs[0]?.label || `Config ${zoom.activeConfig}`) : null,
        configAperture: zoom ? (Number.isFinite(Number(zoom.configs[0]?.aperture)) ? Number(zoom.configs[0].aperture) : null) : null,
        imsSurfaceNumber: Number.isFinite(imsSurfaceNumber) ? imsSurfaceNumber : null,
      },
      ...(zoom ? { zoom } : {}),
      surfaces,
    };
  }


const api={parseZemaxFirstNumber,parseZemaxNumberList,unitTokenToMmScale,stripOptionalQuotes,sourceNameToLensName,isLikelyZemaxSequentialText,extractLikelyZemaxLinesFromText,parseZemaxSequentialText};root.LBZemax=api;if(typeof module!=="undefined")module.exports=api;
})(globalThis);
