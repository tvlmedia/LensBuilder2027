/* Existing nd/Vd records retained with explicit approximate provenance. */
(function(root) {
"use strict";
const catalog = {
  // --- baseline ---
  AIR: { nd: 1.0, Vd: 999.0 },

  // --- SCHOTT (heel gangbaar in foto/cine) ---
  "N-BK7HT":   { nd: 1.5168,  Vd: 64.17 },
  "N-BK10":    { nd: 1.49782, Vd: 66.95 },

  "N-K5":      { nd: 1.52249, Vd: 59.48 },
  "N-KF9":     { nd: 1.52346, Vd: 51.54 },
  "N-PK52A":   { nd: 1.49700, Vd: 81.61 },
  "N-ZK7A":    { nd: 1.508054, Vd: 61.04 },

  // Borosilicate / barium crowns
  "N-BAK1":    { nd: 1.5725,  Vd: 57.55 },
  "N-BAK2":    { nd: 1.53996, Vd: 59.71 },
  "N-BAK4":    { nd: 1.56883, Vd: 55.98 },

  // Barium / “BALF”
  "N-BALF4":   { nd: 1.57956, Vd: 53.87 },
  "N-BALF5":   { nd: 1.54739, Vd: 53.63 },

  // Barium flints / special flints
  "N-BAF4":    { nd: 1.60568, Vd: 43.72 },
  "N-BAF10":   { nd: 1.67003, Vd: 47.11 },
  "N-BAF51":   { nd: 1.65224, Vd: 44.96 },
  "N-BAF52":   { nd: 1.60863, Vd: 46.6 },
  "N-BASF2":   { nd: 1.66446, Vd: 36.0 },

  // Dense crowns / short flints / “SK”
  "N-SK2":     { nd: 1.60738, Vd: 56.65 },
  "N-SK4":     { nd: 1.61272, Vd: 58.63 },
  "N-SK5":     { nd: 1.58913, Vd: 61.27 },
  "N-SK11":    { nd: 1.56384, Vd: 60.8 },
  "N-SK14":    { nd: 1.60311, Vd: 60.6 },
  "N-SK16":    { nd: 1.62041, Vd: 60.32 },

  // “SSK” (veel gebruikt als partner in correctiegroepen)
  "N-SSK2":    { nd: 1.62229, Vd: 53.27 },
  "N-SSK5":    { nd: 1.65844, Vd: 50.88 },
  "N-SSK8":    { nd: 1.61773, Vd: 49.83 },

  // “PSK”
  "N-PSK3":    { nd: 1.55232, Vd: 63.46 },
  "N-PSK53A":  { nd: 1.61800, Vd: 63.39 },

  // “KZFS” (correctie / high performance partners)
  "N-KZFS2":   { nd: 1.55836, Vd: 54.01 },
  "N-KZFS4":   { nd: 1.61336, Vd: 44.49 },
  "N-KZFS5":   { nd: 1.65412, Vd: 39.7 },
  "N-KZFS8":   { nd: 1.72047, Vd: 34.7 },

  // “LAK” (lanthanum crowns — super cinema-typisch)
  "N-LAK9":    { nd: 1.69100, Vd: 54.71 },
  "N-LAK10":   { nd: 1.72003, Vd: 50.62 },
  "N-LAK22":   { nd: 1.65113, Vd: 55.89 },
  "N-LAK28":   { nd: 1.74429, Vd: 50.77 },
  "N-LAK34":   { nd: 1.72916, Vd: 54.5 },

  // “LAF” (lanthanum flints)
  "N-LAF2":    { nd: 1.74397, Vd: 44.85 },
  "N-LAF7":    { nd: 1.7495,  Vd: 34.82 },
  "N-LAF21":   { nd: 1.7880,  Vd: 47.49 },
  "N-LAF34":   { nd: 1.7725,  Vd: 49.62 },

  // “LASF” (high-index lanthanum flints — heel veel cinema correctie)
  "N-LASF9":   { nd: 1.85025, Vd: 32.17 },
  "N-LASF40":  { nd: 1.83404, Vd: 37.3 },
  "N-LASF41":  { nd: 1.83501, Vd: 43.13 },
  "N-LASF43":  { nd: 1.8061,  Vd: 40.61 },
  "N-LASF44":  { nd: 1.8042,  Vd: 46.5 },
  "N-LASF45":  { nd: 1.80107, Vd: 34.97 },

  // Classic “F” / “SF” families (flints) — ook super common
  "N-F2":      { nd: 1.62005, Vd: 36.43 },
  "N-FK5":     { nd: 1.48749, Vd: 70.41 },
  "N-FK58":    { nd: 1.45600, Vd: 90.9 },

  "N-SF1":     { nd: 1.71736, Vd: 29.62 },
  "N-SF2":     { nd: 1.64769, Vd: 33.82 },
  "N-SF4":     { nd: 1.75513, Vd: 27.38 },
  "N-SF5":     { nd: 1.67271, Vd: 32.25 },
  "N-SF6":     { nd: 1.80518, Vd: 25.36 },
  "N-SF8":     { nd: 1.68894, Vd: 31.31 },
  "N-SF10":    { nd: 1.72828, Vd: 28.53 },
  "N-SF11":    { nd: 1.78472, Vd: 25.68 },
  "N-SF15":    { nd: 1.69892, Vd: 30.2 },
  "N-SF57":    { nd: 1.84666, Vd: 23.78 },
  "N-SF66":    { nd: 1.92286, Vd: 20.88 }
};
const source = "https://www.schott.com/en-gb/products/optical-glass/-/media/Project/OnEx/Products/O/optical-glass/Downloads/schott-optical-glass-collection-datasheets-english-may2019.pdf?rev=5358bb64e13a44f2b37f5065490509af";
for (const [name, g] of Object.entries(catalog)) Object.assign(g, {name, model: "nd-vd-approximate", source: "Original LensBuilder nd/Vd table; not independently catalog-verified", transmission: null});
Object.assign(catalog.AIR, {model: "constant", source: "Reference ambient medium n=1"});
for (const name of ["N-BK7", "N-BK7HT"]) catalog[name] = {name, manufacturer: "SCHOTT", nd:1.5168, Vd:64.17, model:"sellmeier", B:[1.03961212,0.231792344,1.010469450], C:[0.00600069867,0.0200179144,103.5606530], rangeNm:[400,700], source, transmission:null};
catalog["N-F2"] = {name:"N-F2", manufacturer:"SCHOTT", nd:1.62005,Vd:36.43, model:"sellmeier",B:[1.39757037,0.159201403,1.268654300],C:[0.00995906143,0.0546931752,119.2483460],rangeNm:[400,700],source,transmission:null};
// These legacy names are NOT silently treated as material equivalences.
const substitutions = {BK7:"N-BK7HT", F2:"N-F2", LASF35:"N-LASF43", LASFN31:"N-LASF43", LF5:"N-SF5", "S-LAM3":"N-LAK9", "S-BAH11":"N-BAK4"};
const wavelengths = Object.freeze({C:656.2725,d:587.5618,F:486.1327,g:435.8343});
function material(surface) {
  if (typeof surface === "string") surface = {glass:surface};
  const name = String(surface.glass || "AIR").toUpperCase();
  if (name === "MIRROR") throw new Error("Unknown/unsupported reflective material MIRROR");
  // Verified catalog takes priority over approximate nd/Vd in imported GLAS records.
  if (catalog[name]?.model === "sellmeier") return catalog[name];
  const nd = Number(surface.nd ?? surface.glass_nd), Vd = Number(surface.vd ?? surface.glass_vd);
  if (Number.isFinite(nd) && nd>1 && Number.isFinite(Vd) && Vd>0) return {name,nd,Vd,model:"nd-vd-approximate",source:"User-supplied nd/Vd",transmission:null};
  if (catalog[name]) return catalog[name];
  throw new Error(`Unknown material ${name}${substitutions[name] ? `; legacy substitution ${substitutions[name]} requires explicit glass selection` : ""}`);
}
function index(surface, nm=wavelengths.d) {
  if (!Number.isFinite(nm) || nm<=0) throw new Error("Invalid wavelength (nm)");
  const g = material(surface);
  if (g.model === "constant") return g.nd;
  if (nm<400 || nm>700) throw new Error(`Material ${g.name}: validated wavelength scope is 400–700 nm`);
  const l2 = (nm/1000)**2;
  if (g.model === "sellmeier") {
    const n2=1+g.B.reduce((v,b,i)=>v+b*l2/(l2-g.C[i]),0);
    if (!(n2>0) || !Number.isFinite(n2)) throw new Error("Invalid Sellmeier result");
    return Math.sqrt(n2);
  }
  // Two-term Cauchy constrained to nd and nF-nC; partial dispersion is unknown.
  const b=((g.nd-1)/g.Vd)/(1/(wavelengths.F/1000)**2-1/(wavelengths.C/1000)**2);
  return g.nd+b*(1/l2-1/(wavelengths.d/1000)**2);
}
const api={catalog,substitutions,wavelengths,material,index};
root.LBMaterials=api;
if(typeof module!=="undefined") module.exports=api;
})(globalThis);
