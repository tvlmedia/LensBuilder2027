(function(root){
'use strict';
function inspect(text){
 const report={supported:[],partial:[],ignored:[],failed:[],blocked:false};let surface=null;
 const supported=new Set('VERS MODE NAME UNIT SURF CURV DISZ DIAM GLAS STOP PWAV WAVM WAVL FTYP YFLN FWGN VDX VDY VCX VCY VDXN VDYN VCXN VCYN'.split(' '));
 const metadata=new Set('COMM NOTE GCAT ENVD COFN DMFS RAIM PUSH WAVN XFLN'.split(' '));
 const config=new Set('MNUM CONF THIC CRVT GLSS SDIA APER YFIE XFIE WAVE PRAM'.split(' '));
 for(const [i,raw] of String(text).split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||/^(#|!|\/\/)/.test(line))continue;
  const [key,...args]=line.split(/\s+/),k=key.toUpperCase(),entry={line:i+1,surface,keyword:k,text:line};
  if(k==='SURF'){surface=Number(args[0]);entry.surface=surface;}
  let category='supported';
  if(k==='MODE'&&args[0]?.toUpperCase()!=='SEQ')category='failed';
  else if(k==='UNIT'&&!['MM','CM','M','IN','INCH'].includes(args[0]?.toUpperCase()))category='failed';
  else if(k==='TYPE'){if(args[0]?.toUpperCase()!=='STANDARD')category='failed';}
  else if(k==='CONI'){if(Number(args[0])!==0)category='failed';}
  else if(k==='GLAS'&&args[0]?.toUpperCase()==='MIRROR')category='failed';
  else if(k==='DISZ'&&surface===0&&Number(args[0])!==0&&!/^INF(INITY)?$/i.test(args[0])){category='failed';entry.reason='Finite object conjugate import is not yet supported';}
  else if(k==='XFLN'&&args.some(v=>Number(v)!==0))category='failed';
  else if(k==='FTYP'&&Number(args[0])!==0){category='failed';entry.reason='Only angular fields supported';}
  else if(/^V[DC][XY]N?$/.test(k)&&args.some(v=>Number(v)!==0)){category='failed';entry.reason='Zemax pupil vignetting factors are not applied by analysis';}
  else if(config.has(k)){category='partial';entry.reason='Legacy configuration mapping; optimization of configurations unavailable';}
  else if(metadata.has(k)){category='ignored';entry.reason='Metadata/settings not reproduced by optical evaluator';}
  else if(!supported.has(k)&&!['TYPE','CONI'].includes(k)){category='failed';entry.reason='Unrecognized or unsupported keyword; optical compatibility not established';}
  report[category].push(entry);
 }
 report.blocked=report.failed.length>0||report.partial.length>0;
 return report;
}
function describe(r){return ['SUPPORTED: '+r.supported.length,'PARTIALLY SUPPORTED: '+r.partial.length,'IGNORED: '+r.ignored.length,'FAILED: '+r.failed.length,...r.failed.map(e=>`Line ${e.line}, surface ${e.surface??'global'}: ${e.keyword} — ${e.reason||'Unsupported optical feature'}`),...r.partial.map(e=>`Line ${e.line}: ${e.reason}`)].join('\n');}
const api={inspect,describe};root.LBImport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
