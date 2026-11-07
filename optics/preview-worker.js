/* Browser-local renderer. Terminating the worker cancels without partial cache publication. */
importScripts('../materials/catalog.js','./core.js','./preview.js');
self.onmessage=({data:m})=>{
 try {
  const {W,H,sensorW,sensorH,sensorX,halfObjW,halfObjH,distance,orientation,spp,doCA,imgW,imgH,imgData,compiled}=m;
  const output=new Uint8ClampedArray(W*H*4),survival=new Float32Array(W*H);
  const pupils=spp===1?[{y:0,z:0}]:LBPreview.disk(spp);
  const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  const srgb=v=>255*(v<=.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-.055);
  function sample(u,v) {
    if(!imgData) return [1,1,1];
    if(u<0||v<0||u>1||v>1) return [0,0,0];
    const x=u*(imgW-1),y=v*(imgH-1),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(imgW-1,x0+1),y1=Math.min(imgH-1,y0+1),tx=x-x0,ty=y-y0;
    return [0,1,2].map(ch=> {
      const a=linear(imgData[(y0*imgW+x0)*4+ch]),b=linear(imgData[(y0*imgW+x1)*4+ch]),c=linear(imgData[(y1*imgW+x0)*4+ch]),d=linear(imgData[(y1*imgW+x1)*4+ch]);
      return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty;
    });
  }
  let last=performance.now();
  for(let y=0;y<H;y++) {
    for(let x=0;x<W;x++) {
      const p={x:sensorX,y:((x+.5)/W-.5)*sensorW,z:(.5-(y+.5)/H)*sensorH};
      const color=[0,0,0];let survived=0;
      for(const pupil of pupils) {
        let greenSurvived=false;
        for(let ch=0;ch<(doCA?3:1);ch++) {
          const ray=LBPreview.reverse(compiled[ch],p,pupil);if(!ray)continue;
          const t=(-distance-ray.p.x)/ray.d.x;
          if(!(t>=0))continue;
          let ox=distance>=1e8?-distance*ray.d.y/ray.d.x:ray.p.y+t*ray.d.y;
          let oy=distance>=1e8?-distance*ray.d.z/ray.d.x:ray.p.z+t*ray.d.z;
          if(orientation==='upright'){ox=-ox;oy=-oy;}
          const rgb=sample(.5+ox/(2*halfObjW),.5-oy/(2*halfObjH));
          if(doCA)color[ch]+=rgb[ch];else for(let k=0;k<3;k++)color[k]+=rgb[k];
          if(!doCA||ch===1)greenSurvived=true;
        }
        if(greenSurvived)survived++;
      }
      const i=y*W+x;survival[i]=survived/spp;
      for(let ch=0;ch<3;ch++)output[i*4+ch]=srgb(color[ch]/spp);
      output[i*4+3]=255;
    }
    if(performance.now()-last>150) {self.postMessage({progress:(y+1)/H});last=performance.now();}
  }
  self.postMessage({output,survival},[output.buffer,survival.buffer]);
 } catch(error) {self.postMessage({error:error.message||String(error)});}
};
