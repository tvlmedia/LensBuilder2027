/* Verified Sellmeier-only chromatic pairing diagnostics. Not a ray-trace ranking. */
(function(root){
 'use strict';const C=root.LBMaterials||require('../materials/catalog.js');
 function descriptor(name){if(C.catalog[name]?.model!=='sellmeier')throw Error('Verified Sellmeier glass required');const nd=C.index(name,587.5618),nF=C.index(name,486.1327),nC=C.index(name,656.2725),ng=C.index(name,435.8343);return {name,nd,Vd:(nd-1)/(nF-nC),PgF:(ng-nF)/(nF-nC)};}
 function pairs(names,totalPower=1/50){if(!Number.isFinite(totalPower))throw Error('Finite power required');const glasses=names.map(descriptor),out=[];for(const crown of glasses.filter(g=>g.Vd>50))for(const flint of glasses.filter(g=>g.Vd<50)){const crownPower=totalPower*crown.Vd/(crown.Vd-flint.Vd),flintPower=-totalPower*flint.Vd/(crown.Vd-flint.Vd);out.push({crown:crown.name,flint:flint.name,crownPower,flintPower,primaryColorPower:crownPower/crown.Vd+flintPower/flint.Vd,secondaryColorPower:crownPower*crown.PgF/crown.Vd+flintPower*flint.PgF/flint.Vd,assumption:'Thin contact achromat, diagnostic only; actual separated/cemented lens must be traced and reoptimized'});}return out;}
 root.LBChromatic={descriptor,pairs};if(typeof module!=='undefined')module.exports=root.LBChromatic;
})(globalThis);
