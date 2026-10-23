// Analytical masks independent of the boundary detector. These are validation
// oracles, not new aperture types supported by the sequential spherical editor.
const disk=(x,y,r=1)=>x*x+y*y<r*r;
const circleDistance=(x,y,cx=0,cy=0,r=1)=>Math.abs(Math.hypot(x-cx,y-cy)-r);
// Closest point on the analytical ellipse, independently minimized in one quadrant.
function ellipseDistance(x,y){x=Math.abs(x);y=Math.abs(y);const d=t=>(Math.cos(t)-x)**2+(.5*Math.sin(t)-y)**2;let lo=0,hi=Math.PI/2;for(let i=0;i<80;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(d(a)<d(b))hi=b;else lo=a;}return Math.sqrt(Math.min(d(0),d(Math.PI/2),d((lo+hi)/2)));}
function catEyeDistance(x,y){const tip=Math.sqrt(1-.35**2),ds=[Math.hypot(x,y-tip),Math.hypot(x,y+tip)];for(const cx of [-.35,.35]){const t=Math.atan2(y,x-cx),px=cx+Math.cos(t),py=Math.sin(t);if((px+cx)**2+py**2<=1+1e-12)ds.push(Math.hypot(x-px,y-py));}return Math.min(...ds);}
module.exports=[
 {id:'circle',inside:(x,y)=>disk(x,y),area:Math.PI,distance:(x,y)=>circleDistance(x,y)},
 {id:'decentered',inside:(x,y)=>disk(x-.2,y+.1,.8),area:Math.PI*.8**2,distance:(x,y)=>circleDistance(x,y,.2,-.1,.8)},
 {id:'ellipse',inside:(x,y)=>x*x+4*y*y<1,area:Math.PI/2,distance:ellipseDistance},
 {id:'cat-eye',inside:(x,y)=>disk(x-.35,y)&&disk(x+.35,y),area:2*Math.acos(.35)-.7*Math.sqrt(1-.35**2),distance:catEyeDistance},
 {id:'annulus',inside:(x,y)=>disk(x,y)&&!disk(x,y,.5),area:Math.PI*.75,distance:(x,y)=>Math.min(circleDistance(x,y),circleDistance(x,y,0,0,.5))},
 {id:'disconnected',inside:(x,y)=>disk(x-.6,y,.3)||disk(x+.6,y,.3),area:Math.PI*.18,distance:(x,y)=>Math.min(circleDistance(x,y,.6,0,.3),circleDistance(x,y,-.6,0,.3))}
];
