/* Read-only comparison of the two archived prescriptions. */
(function () {
  const fields = [0, 0.5, 0.7, 1];
  function compare(engine, best, m4) {
    const { specification, operands } = best.presetProvenance;
    function evaluate(system) {
      const state = engine.create(specification, operands, { source: 'reference', budget: 10000 }, system);
      const result = engine.validate(state, { system });
      if (result.status !== 'DENSE VALIDATED') throw Error('Reference validation failed');
      return result.dense;
    }
    const [b, m] = [evaluate(best), evaluate(m4)];
    const rows = fields.map(field => {
      const [best, m4] = [b, m].map(dense => {
        const f = dense.analysis.fields.find(f => f.field === field);
        if (!f || !Number.isFinite(f.rmsMm) || !(Number.isFinite(f.rayFraction) && f.rayFraction >= 0 && f.rayFraction <= 1))
          throw Error('Missing field measurements');
        return { rms: 1000 * f.rmsMm, survival: 100 * f.rayFraction };
      });
      return { field, best, m4, clippingWarning: best.rms < m4.rms && best.survival < m4.survival };
    });
    return { rows, merit: [b.score, m.score] };
  }
  if (typeof module !== 'undefined') module.exports = { compare };
  if (typeof document === 'undefined') return;
  document.getElementById('appVersion').textContent = 'v' + globalThis.LB_BUILD.applicationVersion;
  const panel = document.getElementById('omitComparison'), output = document.getElementById('omitResult');
  let loaded = false;
  panel.addEventListener('toggle', async () => {
    if (!panel.open || loaded) return;
    loaded = true;
    output.textContent = 'Tracing saved presets…';
    try {
      const presets = await Promise.all(['best', 'historical-m4'].map(async key => {
        const response = await fetch('./lenses/omit50-' + key + '.json');
        if (!response.ok) throw Error('Preset unavailable');
        return response.json();
      }));
      const { rows, merit } = compare(globalThis.LBDesignChallenge, ...presets);
      const table = document.createElement('table');
      const caption = table.createCaption();
      caption.textContent = 'Dense merit: Best ' + merit[0].toFixed(3) + ' · M4 ' + merit[1].toFixed(3);
      const headers = table.createTHead().insertRow();
      for (const label of ['Field', 'Best survival', 'M4 survival', 'Best RMS (µm)', 'M4 RMS (µm)']) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; headers.append(th);
      }
      const body = table.createTBody();
      for (const r of rows) {
        const row = body.insertRow();
        for (const value of [r.field * 100 + '%', r.best.survival.toFixed(2) + '%', r.m4.survival.toFixed(2) + '%', r.best.rms.toFixed(2), r.m4.rms.toFixed(2)])
          row.insertCell().textContent = value;
      }
      output.replaceChildren(table);
      const affected = rows.filter(r => r.clippingWarning).map(r => r.field * 100 + '%');
      if (affected.length) {
        const warning = document.createElement('p');
        warning.textContent = 'Clipping warning at ' + affected.join(', ') + ' field: Best has lower RMS but fewer surviving rays than M4. Clipping can reduce the measured spot; these results do not isolate its contribution.';
        output.append(warning);
      }
    } catch (error) {
      loaded = false;
      output.textContent = 'Comparison unavailable: ' + error.message + '. Reopen to retry.';
    }
  });
})();
