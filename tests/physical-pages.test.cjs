const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Pages subpath keeps scripts, physical worker imports and fixtures inside project root',()=>{
 const root=path.resolve(__dirname,'..'),base=new URL('https://example.test/LensBuilder2027/'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 function resolve(relative,from){const url=new URL(relative,from);a.ok(url.pathname.startsWith('/LensBuilder2027/'));const file=path.join(root,url.pathname.slice('/LensBuilder2027/'.length));a.ok(fs.existsSync(file),file);return {url,file};}
 for(const match of html.matchAll(/<script src="([^"]+)"/g))resolve(match[1],base);
 const ui=resolve('ui/physical.js',base),worker=resolve('../physical/worker.js',ui.url),text=fs.readFileSync(worker.file,'utf8'),imports=text.match(/importScripts\(([^)]+)\)/)[1];
 for(const match of imports.matchAll(/'([^']+)'/g))resolve(match[1],worker.url);
 resolve('./benchmarks/physical-omit50.json',base);resolve('./benchmarks/optical-suite-v1.json',base);
});
