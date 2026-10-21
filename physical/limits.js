(function(root){
 'use strict';
 const GRIDS=[16,32,64,128,256,512],MAX_FFT=2048;
 function estimate(grid,padding=4,retained=1){if(!GRIDS.includes(grid)||![2,4,8].includes(padding)||grid*padding>MAX_FFT)throw Error('Supported pupil 16–512, padding 2/4/8, FFT at most 2048²');const fft=grid*padding;return {pupilGrid:grid,fftGrid:fft,workingBytes:64*fft*fft+512*grid*grid,retainedBytes:retained*(24*fft*fft+256*grid*grid),roughMappingCalls:16*grid*grid};}
 function check(grid,padding=4,{memoryLimitMiB=512,retained=1}={}){if(!Number.isFinite(memoryLimitMiB)||memoryLimitMiB<32||memoryLimitMiB>1024)throw Error('Memory limit must be 32–1024 MiB');const e=estimate(grid,padding,retained);if(e.workingBytes+e.retainedBytes>memoryLimitMiB*1048576)throw Error('Physical analysis memory estimate exceeds configured limit');return e;}
 const api={GRIDS,MAX_FFT,estimate,check};root.LBPhysicalLimits=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
