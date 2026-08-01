var wh=i=>{throw TypeError(i)};var Rh=(i,t,e)=>t.has(i)||wh("Cannot "+e);var Qi=(i,t,e)=>(Rh(i,t,"read from private field"),e?e.call(i):t.get(i)),Be=(i,t,e)=>t.has(i)?wh("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(i):t.set(i,e);var J=(i,t,e)=>(Rh(i,t,"access private method"),e);function Em(i,t){for(var e=0;e<t.length;e++){const n=t[e];if(typeof n!="string"&&!Array.isArray(n)){for(const s in n)if(s!=="default"&&!(s in i)){const r=Object.getOwnPropertyDescriptor(n,s);r&&Object.defineProperty(i,s,r.get?r:{enumerable:!0,get:()=>n[s]})}}}return Object.freeze(Object.defineProperty(i,Symbol.toStringTag,{value:"Module"}))}(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=e(s);fetch(s.href,r)}})();const Tm=7.32,Cm=2.44,Pi=.06,bs=1.1,ur=2.4,Ss=.14,ee=.15,pc=.43,Ph=Math.PI*ee*ee,Lh=1.2,Am=.14,di=1/60,Ih=12,Dh=3,wm=.02,Rm=1.06,Pm=2e-6,Lm=6e-4,Im=2e-6,Uh=.004,Dm=.62,Nh=.7,Um=.72,Nm=.25,Dt=18,Dr=11,Cn=11.5,Ur=21.4,Om=.76,Li=.35,km=1.7,Oo=6.5,zm=9,Hl=1.5,Fm=.55,ca=11,Oh=24,kh=.06,Bm=.42,Vl=.6,Hm=11,zh=1.5,Vm=1.2,Fh=7,la=4.5,Gm=6,Bh=1.2,Wm=8,Xm=180,$m=5,ha=2.5,Ym=90,qm=.5,jm=1.6,Km=10,Zm=3600,Jm=99,ua=(i,t,e)=>Math.max(t,Math.min(e,i)),da=(i,t)=>typeof i=="number"&&Number.isFinite(i)?i:t;function Ln(i={}){const t=i&&typeof i=="object"?i:{},e=ua(da(t.goalScale,1),qm,jm);return{goalScale:e,goalW:Tm*e,goalH:Cm*e,matchTime:ua(Math.round(da(t.matchTime,Xm)),Km,Zm),goalLimit:ua(Math.round(da(t.goalLimit,$m)),0,Jm),keepers:t.keepers===void 0?!0:!!t.keepers}}function Qm(i){const t=[{z:0,y:i},{z:-bs,y:i-.1},{z:-ur,y:0}],e=[];let n=0;for(let s=0;s<t.length-1;s++){const r=t[s],o=t[s+1],a=Math.hypot(o.z-r.z,o.y-r.y),c=Math.max(1,Math.round(a/Ss));for(let l=0;l<c;l++){const h=l/c;e.push({z:r.z+(o.z-r.z)*h,y:r.y+(o.y-r.y)*h})}s===0&&(n=e.length)}return e.push({z:t[2].z,y:t[2].y}),{profile:e,kinkIndex:n}}class Hh{constructor(t=Ln(),{goalZ:e=0,sign:n=1}={}){const{goalW:s,goalH:r}=t;this.goalZ=e,this.sign=n;const o=[],a=[],c=(T,S,y,R)=>(o.push(T,S,y),a.push(R),o.length/3-1),{profile:l,kinkIndex:h}=Qm(r),u=l.length,d=Math.round(s/Ss),f=s/2,g=[];for(let T=0;T<u;T++){g.push([]);for(let S=0;S<=d;S++){const y=-f+s*S/d;let R=1/Uh;T===0&&(R=0),T===h&&(S===0||S===d)&&(R=0),T===u-1&&S%3===0&&(R=0),g[T].push(c(y,l[T].y,l[T].z,R))}}const _=[],m=[],p=[],x=(T,S)=>{const y=o[T*3],R=o[T*3+1],F=o[T*3+2],k=o[S*3],V=o[S*3+1],O=o[S*3+2];return Math.hypot(k-y,V-R,O-F)},M=(T,S,y,R=1)=>T.push([S,y,x(S,y)*R]);for(let T=0;T<u;T++)for(let S=0;S<=d;S++)S<d&&M(_,g[T][S],g[T][S+1]),T<u-1&&M(_,g[T][S],g[T+1][S]),S<d&&T<u-1&&M(m,g[T][S],g[T+1][S+1]);const v=T=>{if(T>=-bs){const y=-T/bs;return r+(r-.1-r)*y}const S=(-T-bs)/(ur-bs);return(r-.1)*(1-S)},L=T=>g.map(S=>S[T<0?0:d]);for(const T of[-1,1]){const S=T*f,y=Math.round(ur/Ss),R=[];for(let k=0;k<=y;k++){const V=-(ur*k)/y,O=v(V),W=Math.floor(O/Ss);if(k>0&&W<1){R.push([]);continue}const K=[];for(let G=0;G<=W;G++){const nt=Math.min(G*Ss,O);let rt=1/Uh;k===0&&(rt=0),G===0&&k%2===0&&(rt=0),K.push(c(S,nt===0?.012:nt,V,rt))}R.push(K)}for(let k=0;k<R.length;k++){const V=R[k];for(let O=0;O<V.length;O++){O<V.length-1&&M(_,V[O],V[O+1]);const W=R[k+1];W&&W[O]!==void 0&&(M(_,V[O],W[O]),O<V.length-1&&W[O+1]!==void 0&&M(m,V[O],W[O+1]))}}const F=L(T);for(let k=1;k<R.length;k++){const V=R[k];if(!V.length)continue;const O=V[V.length-1];let W=F[0],K=1/0;for(const G of F){const nt=x(O,G);nt<K&&(K=nt,W=G)}K<Ss*1.8&&M(p,O,W)}}const w=o.length/3;for(let T=0;T<w;T++)o[T*3+2]=e+n*o[T*3+2];this.count=w,this.pos=new Float32Array(o),this.prev=new Float32Array(o),this.vel=new Float32Array(w*3),this.invMass=new Float32Array(a);const A=T=>({ids:new Int32Array(T.flatMap(([S,y])=>[S,y])),rest:new Float32Array(T.map(([,,S])=>S)),n:T.length});this.struct=A(_),this.shear=A(m),this.stitch=A(p),this.collidable=[this.struct,this.stitch]}integrate(t,e){const{pos:n,prev:s,vel:r,invMass:o,count:a}=this,c=Math.exp(-2.2*t);for(let l=0;l<a;l++){if(o[l]===0)continue;const h=l*3;r[h+1]-=9.81*t,r[h+2]+=.05*Math.sin(e*.8+n[h]*.9)*t,r[h]*=c,r[h+1]*=c,r[h+2]*=c,s[h]=n[h],s[h+1]=n[h+1],s[h+2]=n[h+2],n[h]+=r[h]*t,n[h+1]+=r[h+1]*t,n[h+2]+=r[h+2]*t}}solveGroup(t,e,n){const{pos:s,invMass:r}=this,o=e/(n*n),{ids:a,rest:c,n:l}=t;for(let h=0;h<l;h++){const u=a[h*2],d=a[h*2+1],f=r[u],g=r[d],_=f+g;if(_===0)continue;const m=u*3,p=d*3,x=s[p]-s[m],M=s[p+1]-s[m+1],v=s[p+2]-s[m+2],L=Math.sqrt(x*x+M*M+v*v);if(L<1e-9)continue;const w=(L-c[h])/(L*(_+o)),A=x*w,T=M*w,S=v*w;s[m]+=A*f,s[m+1]+=T*f,s[m+2]+=S*f,s[p]-=A*g,s[p+1]-=T*g,s[p+2]-=S*g}}solveConstraints(t){this.solveGroup(this.struct,Pm,t),this.solveGroup(this.stitch,Im,t),this.solveGroup(this.shear,Lm,t)}limitStrain(){const{pos:t,invMass:e}=this;for(const n of[this.struct,this.stitch]){const{ids:s,rest:r,n:o}=n;for(let a=0;a<o;a++){const c=s[a*2],l=s[a*2+1],h=e[c],u=e[l],d=h+u;if(d===0)continue;const f=c*3,g=l*3,_=t[g]-t[f],m=t[g+1]-t[f+1],p=t[g+2]-t[f+2],x=Math.sqrt(_*_+m*m+p*p),M=r[a]*Rm;if(x<=M||x<1e-9)continue;const v=(x-M)/(x*d),L=_*v,w=m*v,A=p*v;t[f]+=L*h,t[f+1]+=w*h,t[f+2]+=A*h,t[g]-=L*u,t[g+1]-=w*u,t[g+2]-=A*u}}}collideGround(){const{pos:t,prev:e,invMass:n,count:s}=this;for(let r=0;r<s;r++){if(n[r]===0)continue;const o=r*3;t[o+1]<.012&&(t[o+1]=.012,e[o]+=(t[o]-e[o])*.9,e[o+2]+=(t[o+2]-e[o+2])*.9)}}updateVelocities(t){const{pos:e,prev:n,vel:s,invMass:r,count:o}=this,a=1/t;for(let c=0;c<o;c++){if(r[c]===0)continue;const l=c*3;s[l]=(e[l]-n[l])*a,s[l+1]=(e[l+1]-n[l+1])*a,s[l+2]=(e[l+2]-n[l+2])*a}}}const tg={ground:Dm,post:Nh,crossbar:Nh,wall:Um,player:Nm};class Zd{constructor(){this.pos={x:0,y:ee,z:0},this.prev={x:0,y:ee,z:0},this.vel={x:0,y:0,z:0},this.omega={x:0,y:0,z:0},this.grounded=!0,this.contacts=[]}place(t,e){this.pos={x:t,y:ee,z:e},this.prev={...this.pos},this.vel={x:0,y:0,z:0},this.omega={x:0,y:0,z:0},this.grounded=!0}accel(){const{vel:t,omega:e}=this,n=Math.hypot(t.x,t.y,t.z);let s=0,r=-9.81,o=0;if(n>.001){const a=-.5*Lh*Am*Ph*n/pc;s+=a*t.x,r+=a*t.y,o+=a*t.z;const c=Math.hypot(e.x,e.y,e.z);if(c>.5){const l=1/(2+n/(ee*c));let h=e.y*t.z-e.z*t.y,u=e.z*t.x-e.x*t.z,d=e.x*t.y-e.y*t.x;const f=Math.hypot(h,u,d);if(f>1e-6){const g=.5*Lh*Ph*l*n*n/(pc*f);s+=g*h,r+=g*u,o+=g*d}}}return{ax:s,ay:r,az:o}}integrate(t){const{pos:e,prev:n,vel:s}=this,{ax:r,ay:o,az:a}=this.accel();s.x+=r*t,s.y+=o*t,s.z+=a*t,n.x=e.x,n.y=e.y,n.z=e.z,e.x+=s.x*t,e.y+=s.y*t,e.z+=s.z*t,this.contacts.length=0;const c=Math.exp(-.12*t);this.omega.x*=c,this.omega.y*=c,this.omega.z*=c}updateVelocity(t){const{pos:e,prev:n,vel:s,omega:r}=this,o=1/t;s.x=(e.x-n.x)*o,s.y=(e.y-n.y)*o,s.z=(e.z-n.z)*o,this.grounded=!1;for(const c of this.contacts){const l=c.cvx||0,h=c.cvz||0,u=(s.x-l)*c.nx+s.y*c.ny+(s.z-h)*c.nz;if(u<0){const d=-(1+(tg[c.type]??.6))*u;s.x+=d*c.nx,s.y+=d*c.ny,s.z+=d*c.nz,c.type==="ground"&&u<-.8&&(s.x=s.x*.82+(r.z*c.ny-r.y*c.nz)*ee*.25,s.z=s.z*.82+(r.y*c.nx-r.x*c.ny)*ee*.25,r.x*=.75,r.y*=.75,r.z*=.75)}c.type==="ground"&&(this.grounded=!0)}if(this.grounded&&Math.abs(s.y)<.4){s.y=Math.max(s.y,0);const c=Math.max(0,1-.6*t);s.x*=c,s.z*=c}const a=Math.hypot(s.x,s.y,s.z);if(a>34){const c=34/a;s.x*=c,s.y*=c,s.z*=c}}speed(){return Math.hypot(this.vel.x,this.vel.y,this.vel.z)}}class eg{constructor(t,e="field"){this.team=t,this.role=e,this.pos={x:0,z:0},this.vel={x:0,z:0},this.input={x:0,z:0},this.facing=t===0?0:Math.PI,this.charge=0,this.kickAnim=0,this.headerAnim=0,this.celebrate=0,this.down=0,this.downTotal=zh,this.tumbleSpin=0,this.knockCooldown=0,this.jumpY=0,this.jumpVy=0,this.dive=0,this.diveTotal=.55,this.diveKind="dive",this.diveRecover=0,this.diveDir={x:1,z:0}}startJump(){return this.jumpY>0||this.down>0||this.dive>0?!1:(this.jumpVy=4.4,this.jumpY=.001,!0)}startSlide(t,e){if(this.dive>0||this.diveRecover>0||this.down>0)return!1;const n=Math.hypot(t,e)||1;return this.diveDir={x:t/n,z:e/n},this.diveKind="slide",this.dive=this.diveTotal=.6,this.vel.x+=this.diveDir.x*7.5,this.vel.z+=this.diveDir.z*7.5,this.facing=Math.atan2(this.diveDir.x,this.diveDir.z),this.charge=0,!0}startDive(t,e,n=8.5){if(this.dive>0||this.diveRecover>0||this.down>0)return!1;const s=Math.hypot(t,e)||1;return this.diveDir={x:t/s,z:e/s},this.diveKind="dive",this.dive=this.diveTotal=.55,this.vel.x+=this.diveDir.x*n,this.vel.z+=this.diveDir.z*n,this.charge=0,!0}reset(t,e){this.pos={x:t,z:e},this.vel={x:0,z:0},this.input={x:0,z:0},this.facing=this.team===0?0:Math.PI,this.charge=0,this.kickAnim=0,this.down=0,this.knockCooldown=0,this.dive=0,this.diveRecover=0,this.jumpY=0,this.jumpVy=0,this.celebrate=0}knockDown(t,e,n){if(this.down>0||this.knockCooldown>0)return;this.knockCooldown=6,this.dive=0,this.diveRecover=0,this.down=this.downTotal=zh;const s=Math.min(9,n*.42);this.vel.x+=t*s,this.vel.z+=e*s,this.facing=Math.atan2(-t,-e),this.tumbleSpin=(Math.random()-.5)*4,this.charge=0}integrate(t){if(this.knockCooldown=Math.max(0,this.knockCooldown-t),this.jumpY>0&&(this.jumpY+=this.jumpVy*t,this.jumpVy-=9.81*t,this.jumpY<=0&&(this.jumpY=0,this.jumpVy=0)),this.down>0){this.down=Math.max(0,this.down-t);const e=Math.exp(-2.2*t);this.vel.x*=e,this.vel.z*=e}else if(this.dive>0){this.dive=Math.max(0,this.dive-t),this.dive===0&&(this.diveRecover=.45);const e=Math.exp(-1.4*t);this.vel.x*=e,this.vel.z*=e}else if(this.diveRecover>0){this.diveRecover=Math.max(0,this.diveRecover-t);const e=Math.exp(-6*t);this.vel.x*=e,this.vel.z*=e}else{let{x:e,z:n}=this.input;const s=Math.hypot(e,n);s>1&&(e/=s,n/=s);const r=Math.min(1,zm*t);this.vel.x+=(e*Oo-this.vel.x)*r,this.vel.z+=(n*Oo-this.vel.z)*r,Math.hypot(this.vel.x,this.vel.z)>.5&&(this.facing=Math.atan2(this.vel.x,this.vel.z))}this.pos.x+=this.vel.x*t,this.pos.z+=this.vel.z*t}speed(){return Math.hypot(this.vel.x,this.vel.z)}}const ng=.9;function Vh(i,t,e){return[{ax:-t,ay:0,az:i,bx:-t,by:e,bz:i,name:"post"},{ax:t,ay:0,az:i,bx:t,by:e,bz:i,name:"post"},{ax:-t,ay:e,az:i,bx:t,by:e,bz:i,name:"crossbar"}]}class ig{constructor(t=Ln()){this.config=t,this.halfW=t.goalW/2,this.nets=[new Hh(t,{goalZ:-Dt,sign:1}),new Hh(t,{goalZ:Dt,sign:-1})],this.frames=[...Vh(-Dt,this.halfW,t.goalH),...Vh(Dt,this.halfW,t.goalH)],this.ball=new Zd,this.players=[],this.time=0,this.events=[],this.scoringLocked=!1,this.restartTeam=null,this.sideSwap=!1;for(let e=0;e<50;e++)this.step(di);this.events.length=0}attackSign(t){return(t===0?1:-1)*(this.sideSwap?-1:1)}scorerAt(t){return this.attackSign(0)*Math.sign(t)>0?0:1}addPlayer(t,e="field"){const n=new eg(t,e);return this.players.push(n),n}step(t=di){const e=t/Ih,{ball:n}=this;for(let s=0;s<Ih;s++){this.time+=e;const r=n.pos.z;for(const o of this.nets)o.integrate(e,this.time);if(this.puppet){for(let o=0;o<Dh;o++)for(const a of this.nets)a.solveConstraints(e),Math.abs(n.pos.z-a.goalZ)<3.5&&this.collideBallNet(a),a.limitStrain();for(const o of this.nets)o.collideGround();for(const o of this.nets)o.updateVelocities(e);this.events.length=0;continue}n.integrate(e);for(const o of this.players)o.integrate(e);this.netContact=!1;for(let o=0;o<Dh;o++)for(const a of this.nets)a.solveConstraints(e),Math.abs(n.pos.z-a.goalZ)<3.5&&this.collideBallNet(a),a.limitStrain();this.collidePlayers(),this.enforceRestartZone(),this.collideBallPlayers(),this.collideBallStatic();for(const o of this.nets)o.collideGround();for(const o of this.nets)o.updateVelocities(e);if(n.updateVelocity(e),this.netContact){const o=Math.exp(-14*e);n.vel.x*=o,n.vel.y*=o,n.vel.z*=o,n.omega.x*=o,n.omega.y*=o,n.omega.z*=o}this.dribbleAssist(e),this.checkGoal(r)}}checkGoal(t){if(this.scoringLocked)return;const e=this.ball.pos;Math.abs(e.x)<this.halfW-.02&&e.y<this.config.goalH-.02&&(t>-Dt&&e.z<=-Dt?(this.scoringLocked=!0,this.events.push({type:"goal",scorer:this.scorerAt(-Dt)})):t<Dt&&e.z>=Dt&&(this.scoringLocked=!0,this.events.push({type:"goal",scorer:this.scorerAt(Dt)})))}collidePlayers(){const t=this.players;for(let s=0;s<t.length;s++)for(let r=s+1;r<t.length;r++){const o=t[s],a=t[r],c=a.pos.x-o.pos.x,l=a.pos.z-o.pos.z,h=Math.sqrt(c*c+l*l),u=Li*2;if(h>=u||h<1e-6)continue;const d=(u-h)/(2*h);o.pos.x-=c*d,o.pos.z-=l*d,a.pos.x+=c*d,a.pos.z+=l*d;for(const[f,g]of[[o,a],[a,o]])if(f.dive>0&&f.diveKind==="slide"&&f.team!==g.team&&g.down<=0&&g.dive<=0){const _=Math.hypot(this.ball.pos.x-f.pos.x,this.ball.pos.z-f.pos.z)<=Vm;g.knockDown(f.diveDir.x,f.diveDir.z,13),g.down>0&&(this.events.push({type:"ragdoll",team:g.team}),_||this.events.push({type:"foul",team:g.team,x:g.pos.x,z:g.pos.z}))}}const e=Cn-Li,n=Dt-Li-.1;for(const s of t)s.pos.x=Math.max(-e,Math.min(e,s.pos.x)),s.pos.z=Math.max(-n,Math.min(n,s.pos.z))}enforceRestartZone(){if(this.restartTeam===null)return;const t=this.ball.pos,e=3,n=Cn-Li,s=Dt-Li-.1;for(const r of this.players){if(r.team===this.restartTeam)continue;const o=r.pos.x-t.x,a=r.pos.z-t.z,c=Math.sqrt(o*o+a*a);if(c>=e)continue;const l=c>1e-4?o/c:1,h=c>1e-4?a/c:0;r.pos.x=Math.max(-n,Math.min(n,t.x+l*e)),r.pos.z=Math.max(-s,Math.min(s,t.z+h*e));const u=r.vel.x*l+r.vel.z*h;u<0&&(r.vel.x-=u*l,r.vel.z-=u*h)}}collideBallPlayers(){const t=this.ball;for(const e of this.players){if(this.restartTeam!==null&&e.team!==this.restartTeam)continue;const n=km+e.jumpY+(e.jumpY>.05?.45:0);if(t.pos.y>n)continue;const s=t.pos.x-e.pos.x,r=t.pos.z-e.pos.z,o=Math.sqrt(s*s+r*r),a=e.dive>0?e.diveKind==="slide"?.6:.85:Li,c=ee+a;if(o>=c||o<1e-6)continue;const l=s/o,h=r/o,u=c-o,d=e.vel.x*l+e.vel.z*h,f=d<0?Math.min(u*.25,.02):u;t.pos.x+=l*f,t.pos.z+=h*f,t.prev.x+=l*f,t.prev.z+=h*f,t.contacts.push({nx:l,ny:0,nz:h,type:"player",cvx:d<0?0:e.vel.x,cvz:d<0?0:e.vel.z}),t.lastTouch=e.team,this.restartTeam===e.team&&(this.restartTeam=null);const g=t.vel.x-e.vel.x,_=t.vel.z-e.vel.z,m=Math.sqrt(g*g+_*_);m>Hm&&e.down<=0&&e.dive<=0&&(e.knockDown(g/m,_/m,m),this.events.push({type:"ragdoll",team:e.team}))}}dribbleAssist(t){const e=this.ball;if(e.pos.y>.5){this.carrier=null;return}const n=O=>Math.hypot(O.vel.x,O.vel.z)>.6||Math.hypot(O.input.x,O.input.z)>.2;let s=this.carrier,r=s?Math.hypot(e.pos.x-s.pos.x,e.pos.z-s.pos.z):1/0;const o=O=>this.restartTeam===null||O.team===this.restartTeam;if(!(s&&s.down<=0&&s.dive<=0&&n(s)&&r<2.3&&o(s))){s=null,r=1.45;for(const O of this.players){if(O.down>0||O.dive>0||!n(O)||!o(O))continue;const W=Math.hypot(e.pos.x-O.pos.x,e.pos.z-O.pos.z);W<r&&(r=W,s=O)}if(!s){this.carrier=null;return}}const c=e.vel.x-s.vel.x,l=e.vel.z-s.vel.z,h=Math.hypot(c,l),u=this.carrier===s;if(h>(u?13:4.5)){this.carrier=null;return}const d=r>1e-4?1/r:0,f=(e.pos.x-s.pos.x)*d,g=(e.pos.z-s.pos.z)*d;if(c*f+l*g>(u?8:4.5)){this.carrier=null;return}this.carrier=s;let _=s.input.x,m=s.input.z;const p=Math.hypot(_,m);if(p<.2){const O=Math.hypot(s.vel.x,s.vel.z);O>.5?(_=s.vel.x/O,m=s.vel.z/O):(_=Math.sin(s.facing),m=Math.cos(s.facing))}else _/=p,m/=p;const x=Math.atan2(_,m),M=Math.atan2(f,g);let v=x-M;v>Math.PI&&(v-=2*Math.PI),v<-Math.PI&&(v+=2*Math.PI);const L=14*t,w=Math.max(-L,Math.min(L,v)),A=M+w;this.touchPhase=(this.touchPhase||0)+t*(.9+Math.hypot(s.vel.x,s.vel.z)*.12);const T=.62+.16*Math.sin(this.touchPhase*Math.PI*2),S=s.pos.x+Math.sin(A)*T,y=s.pos.z+Math.cos(A)*T,R=w/t*T,F=s.vel.x+Math.cos(A)*R,k=s.vel.z-Math.sin(A)*R,V=10+Math.min(14,Math.abs(v)*10);if(e.vel.x+=((S-e.pos.x)*60+(F-e.vel.x)*V)*t,e.vel.z+=((y-e.pos.z)*60+(k-e.vel.z)*V)*t,u&&Math.abs(v)>1.2){const O=Math.exp(-2.6*t);s.vel.x*=O,s.vel.z*=O}e.lastTouch=s.team}collideBallStatic(){const{ball:t}=this,e=t.pos;e.y<ee&&(e.y=ee,t.contacts.push({nx:0,ny:1,nz:0,type:"ground"}));const n=e.y<Om,s=Math.abs(t.prev.x)<Cn-ee+.02;n&&s&&(e.x>Cn-ee?(e.x=Cn-ee,t.contacts.push({nx:-1,ny:0,nz:0,type:"wall"})):e.x<-11.35&&(e.x=-11.35,t.contacts.push({nx:1,ny:0,nz:0,type:"wall"})));const r=Math.abs(t.prev.z)<Dt-ee+.02;if(n&&r&&Math.abs(e.x)>this.halfW+.1&&(e.z>Dt-ee?(e.z=Dt-ee,t.contacts.push({nx:0,ny:0,nz:-1,type:"wall"})):e.z<-17.85&&(e.z=-17.85,t.contacts.push({nx:0,ny:0,nz:1,type:"wall"}))),this.scoringLocked){const o=e.z>=0?1:-1,a=o*e.z-Dt,c=o*t.prev.z-Dt;Math.abs(e.x)<this.halfW+ee&&e.y<this.config.goalH+ee&&a<ng&&c>-.02&&a<c&&(e.z=t.prev.z)}e.z>Ur?(e.z=Ur,t.contacts.push({nx:0,ny:0,nz:-1,type:"wall"})):e.z<-Ur&&(e.z=-Ur,t.contacts.push({nx:0,ny:0,nz:1,type:"wall"}));for(const o of this.frames){if(Math.abs(e.z-o.az)>1)continue;const a=o.bx-o.ax,c=o.by-o.ay,l=o.bz-o.az,h=e.x-o.ax,u=e.y-o.ay,d=e.z-o.az,f=a*a+c*c+l*l;let g=(h*a+u*c+d*l)/f;g=Math.max(0,Math.min(1,g));const _=o.ax+a*g,m=o.ay+c*g,p=o.az+l*g;let x=e.x-_,M=e.y-m,v=e.z-p;const L=Math.sqrt(x*x+M*M+v*v),w=ee+Pi;if(L>=w||L<1e-9)continue;x/=L,M/=L,v/=L;const A=w-L;e.x+=x*A,e.y+=M*A,e.z+=v*A,t.contacts.push({nx:x,ny:M,nz:v,type:o.name}),this.events.push({type:o.name})}}collideBallNet(t){const{ball:e}=this,{pos:n,prev:s,invMass:r}=t,o=e.pos,a=1/pc,c=ee+wm,l=c+.25;for(const h of t.collidable){const{ids:u,n:d}=h;for(let f=0;f<d;f++){const g=u[f*2],_=u[f*2+1],m=g*3,p=_*3,x=n[m],M=n[m+1],v=n[m+2];if(Math.abs(x-o.x)>l||Math.abs(M-o.y)>l||Math.abs(v-o.z)>l)continue;const L=n[p],w=n[p+1],A=n[p+2],T=L-x,S=w-M,y=A-v,R=o.x-x,F=o.y-M,k=o.z-v,V=T*T+S*S+y*y;let O=V>1e-12?(R*T+F*S+k*y)/V:0;O=Math.max(0,Math.min(1,O));const W=x+T*O,K=M+S*O,G=v+y*O;let nt=o.x-W,rt=o.y-K,_t=o.z-G;const Lt=Math.sqrt(nt*nt+rt*rt+_t*_t);if(Lt>=c||Lt<1e-9)continue;nt/=Lt,rt/=Lt,_t/=Lt;const Qt=c-Lt,$=r[g],Q=r[_],vt=a+$*(1-O)*(1-O)+Q*O*O,st=Qt/vt;o.x+=nt*st*a,o.y+=rt*st*a,o.z+=_t*st*a;const Tt=st*$*(1-O),Rt=st*Q*O;n[m]-=nt*Tt,n[m+1]-=rt*Tt,n[m+2]-=_t*Tt,n[p]-=nt*Rt,n[p+1]-=rt*Rt,n[p+2]-=_t*Rt,this.netContact=!0;for(const[Bt,oe]of[[g,1-O],[_,O]]){if(r[Bt]===0||oe<.05)continue;const Ut=Bt*3,ue=.5*oe;s[Ut]+=(n[Ut]-s[Ut])*ue,s[Ut+1]+=(n[Ut+1]-s[Ut+1])*ue,s[Ut+2]+=(n[Ut+2]-s[Ut+2])*ue}}}}kickParams(t,e,n=0){const s=this.ball;if(s.pos.y>2.15)return null;const r=s.pos.y>1.15,o=s.pos.x-t.pos.x,a=s.pos.z-t.pos.z,c=Math.sqrt(o*o+a*a);if(c>(r?1:Hl)+ee+n||c<1e-6)return null;let h=o/c,u=a/c;const d=this.attackSign(t.team)*Dt;let f=-s.pos.x,g=d-s.pos.z;const _=Math.sqrt(f*f+g*g)||1;f/=_,g/=_;const m=h*f+u*g;if(m>.25){const A=Fm*m;h=h*(1-A)+f*A,u=u*(1-A)+g*A;const T=Math.sqrt(h*h+u*u)||1;h/=T,u/=T}const p=r?8+(Oh-ca)*.5*e:ca+(Oh-ca)*e;let x=r?.03+.12*e:kh+(Bm-kh)*e;if(!r&&m>.5&&_<15){let A=0,T=x;for(let S=0;S<10;S++){const y=(A+T)/2,R=_/(p*Math.cos(y));s.pos.y+p*Math.sin(y)*R-4.905*R*R>this.config.goalH-.45?T=y:A=y}x=Math.min(x,A)}const M=Math.cos(x),v=Math.sin(x),L=h*t.vel.z-u*t.vel.x,w=(5+x*25)*(r?.4:1);return{vel:{x:h*M*p,y:v*p,z:u*M*p},omega:{x:-u*w,y:L*7,z:h*w},header:r}}tryKick(t,e){if(this.restartTeam!==null&&t.team!==this.restartTeam)return!1;const n=this.kickParams(t,e);if(!n)return!1;const s=this.ball;return s.vel={...n.vel},s.omega={...n.omega},s.grounded=!1,s.lastTouch=t.team,this.restartTeam===t.team&&(this.restartTeam=null),this.lastShot={x:s.pos.x,z:s.pos.z},this.events.push({type:"kick",team:t.team}),n.header?"header":!0}placeBall(t,e){this.ball.place(t,e),this.scoringLocked=!1}drainEvents(){const t=this.events.slice();return this.events.length=0,t}}/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Gl="170",sg=0,Gh=1,rg=2,Jd=1,Qd=2,Hn=3,xi=0,je=1,vn=2,fi=0,Ts=1,mc=2,Wh=3,Xh=4,og=5,Ui=100,ag=101,cg=102,lg=103,hg=104,ug=200,dg=201,fg=202,pg=203,gc=204,_c=205,mg=206,gg=207,_g=208,vg=209,xg=210,yg=211,Sg=212,Mg=213,bg=214,vc=0,xc=1,yc=2,Ns=3,Sc=4,Mc=5,bc=6,Ec=7,Wl=0,Eg=1,Tg=2,pi=0,Cg=1,Ag=2,wg=3,tf=4,Rg=5,Pg=6,Lg=7,ef=300,Os=301,ks=302,Tc=303,Cc=304,Qo=306,Ac=1e3,zi=1001,wc=1002,tn=1003,Ig=1004,Nr=1005,yn=1006,fa=1007,Fi=1008,jn=1009,nf=1010,sf=1011,Sr=1012,Xl=1013,Gi=1014,wn=1015,Ar=1016,$l=1017,Yl=1018,zs=1020,rf=35902,of=1021,af=1022,Sn=1023,cf=1024,lf=1025,Cs=1026,Fs=1027,ql=1028,jl=1029,hf=1030,Kl=1031,Zl=1033,vo=33776,xo=33777,yo=33778,So=33779,Rc=35840,Pc=35841,Lc=35842,Ic=35843,Dc=36196,Uc=37492,Nc=37496,Oc=37808,kc=37809,zc=37810,Fc=37811,Bc=37812,Hc=37813,Vc=37814,Gc=37815,Wc=37816,Xc=37817,$c=37818,Yc=37819,qc=37820,jc=37821,Mo=36492,Kc=36494,Zc=36495,uf=36283,Jc=36284,Qc=36285,tl=36286,Dg=3200,Ug=3201,Jl=0,Ng=1,ci="",Oe="srgb",Vs="srgb-linear",ta="linear",se="srgb",ts=7680,$h=519,Og=512,kg=513,zg=514,df=515,Fg=516,Bg=517,Hg=518,Vg=519,el=35044,Yh=35048,qh="300 es",Wn=2e3,ko=2001;class Gs{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}}const Ue=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let jh=1234567;const dr=Math.PI/180,Mr=180/Math.PI;function $n(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ue[i&255]+Ue[i>>8&255]+Ue[i>>16&255]+Ue[i>>24&255]+"-"+Ue[t&255]+Ue[t>>8&255]+"-"+Ue[t>>16&15|64]+Ue[t>>24&255]+"-"+Ue[e&63|128]+Ue[e>>8&255]+"-"+Ue[e>>16&255]+Ue[e>>24&255]+Ue[n&255]+Ue[n>>8&255]+Ue[n>>16&255]+Ue[n>>24&255]).toLowerCase()}function Se(i,t,e){return Math.max(t,Math.min(e,i))}function Ql(i,t){return(i%t+t)%t}function Gg(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function Wg(i,t,e){return i!==t?(e-i)/(t-i):0}function fr(i,t,e){return(1-e)*i+e*t}function Xg(i,t,e,n){return fr(i,t,1-Math.exp(-e*n))}function $g(i,t=1){return t-Math.abs(Ql(i,t*2)-t)}function Yg(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function qg(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function jg(i,t){return i+Math.floor(Math.random()*(t-i+1))}function Kg(i,t){return i+Math.random()*(t-i)}function Zg(i){return i*(.5-Math.random())}function Jg(i){i!==void 0&&(jh=i);let t=jh+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Qg(i){return i*dr}function t0(i){return i*Mr}function e0(i){return(i&i-1)===0&&i!==0}function n0(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function i0(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function s0(i,t,e,n,s){const r=Math.cos,o=Math.sin,a=r(e/2),c=o(e/2),l=r((t+n)/2),h=o((t+n)/2),u=r((t-n)/2),d=o((t-n)/2),f=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*h,c*u,c*d,a*l);break;case"YZY":i.set(c*d,a*h,c*u,a*l);break;case"ZXZ":i.set(c*u,c*d,a*h,a*l);break;case"XZX":i.set(a*h,c*g,c*f,a*l);break;case"YXY":i.set(c*f,a*h,c*g,a*l);break;case"ZYZ":i.set(c*g,c*f,a*h,a*l);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function xn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function ne(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const r0={DEG2RAD:dr,RAD2DEG:Mr,generateUUID:$n,clamp:Se,euclideanModulo:Ql,mapLinear:Gg,inverseLerp:Wg,lerp:fr,damp:Xg,pingpong:$g,smoothstep:Yg,smootherstep:qg,randInt:jg,randFloat:Kg,randFloatSpread:Zg,seededRandom:Jg,degToRad:Qg,radToDeg:t0,isPowerOfTwo:e0,ceilPowerOfTwo:n0,floorPowerOfTwo:i0,setQuaternionFromProperEuler:s0,normalize:ne,denormalize:xn};class ct{constructor(t=0,e=0){ct.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class zt{constructor(t,e,n,s,r,o,a,c,l){zt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,c,l)}set(t,e,n,s,r,o,a,c,l){const h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=c,h[6]=n,h[7]=o,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],f=n[5],g=n[8],_=s[0],m=s[3],p=s[6],x=s[1],M=s[4],v=s[7],L=s[2],w=s[5],A=s[8];return r[0]=o*_+a*x+c*L,r[3]=o*m+a*M+c*w,r[6]=o*p+a*v+c*A,r[1]=l*_+h*x+u*L,r[4]=l*m+h*M+u*w,r[7]=l*p+h*v+u*A,r[2]=d*_+f*x+g*L,r[5]=d*m+f*M+g*w,r[8]=d*p+f*v+g*A,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8];return e*o*h-e*a*l-n*r*h+n*a*c+s*r*l-s*o*c}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8],u=h*o-a*l,d=a*c-h*r,f=l*r-o*c,g=e*u+n*d+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(s*l-h*n)*_,t[2]=(a*n-s*o)*_,t[3]=d*_,t[4]=(h*e-s*c)*_,t[5]=(s*r-a*e)*_,t[6]=f*_,t[7]=(n*c-l*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){const c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*o+l*a)+o+t,-s*l,s*c,-s*(-l*o+c*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(pa.makeScale(t,e)),this}rotate(t){return this.premultiply(pa.makeRotation(-t)),this}translate(t,e){return this.premultiply(pa.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const pa=new zt;function ff(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function zo(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function o0(){const i=zo("canvas");return i.style.display="block",i}const Kh={};function sr(i){i in Kh||(Kh[i]=!0,console.warn(i))}function a0(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function c0(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function l0(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Yt={enabled:!0,workingColorSpace:Vs,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===se&&(i.r=Yn(i.r),i.g=Yn(i.g),i.b=Yn(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===se&&(i.r=As(i.r),i.g=As(i.g),i.b=As(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===ci?ta:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function Yn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function As(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const Zh=[.64,.33,.3,.6,.15,.06],Jh=[.2126,.7152,.0722],Qh=[.3127,.329],tu=new zt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),eu=new zt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Yt.define({[Vs]:{primaries:Zh,whitePoint:Qh,transfer:ta,toXYZ:tu,fromXYZ:eu,luminanceCoefficients:Jh,workingColorSpaceConfig:{unpackColorSpace:Oe},outputColorSpaceConfig:{drawingBufferColorSpace:Oe}},[Oe]:{primaries:Zh,whitePoint:Qh,transfer:se,toXYZ:tu,fromXYZ:eu,luminanceCoefficients:Jh,outputColorSpaceConfig:{drawingBufferColorSpace:Oe}}});let es;class h0{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{es===void 0&&(es=zo("canvas")),es.width=t.width,es.height=t.height;const n=es.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=es}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=zo("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Yn(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Yn(e[n]/255)*255):e[n]=Yn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let u0=0;class pf{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:u0++}),this.uuid=$n(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(ma(s[o].image)):r.push(ma(s[o]))}else r=ma(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function ma(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?h0.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let d0=0;class ze extends Gs{constructor(t=ze.DEFAULT_IMAGE,e=ze.DEFAULT_MAPPING,n=zi,s=zi,r=yn,o=Fi,a=Sn,c=jn,l=ze.DEFAULT_ANISOTROPY,h=ci){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:d0++}),this.uuid=$n(),this.name="",this.source=new pf(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new ct(0,0),this.repeat=new ct(1,1),this.center=new ct(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new zt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==ef)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Ac:t.x=t.x-Math.floor(t.x);break;case zi:t.x=t.x<0?0:1;break;case wc:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Ac:t.y=t.y-Math.floor(t.y);break;case zi:t.y=t.y<0?0:1;break;case wc:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}ze.DEFAULT_IMAGE=null;ze.DEFAULT_MAPPING=ef;ze.DEFAULT_ANISOTROPY=1;class re{constructor(t=0,e=0,n=0,s=1){re.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const c=t.elements,l=c[0],h=c[4],u=c[8],d=c[1],f=c[5],g=c[9],_=c[2],m=c[6],p=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(g+m)<.1&&Math.abs(l+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const M=(l+1)/2,v=(f+1)/2,L=(p+1)/2,w=(h+d)/4,A=(u+_)/4,T=(g+m)/4;return M>v&&M>L?M<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(M),s=w/n,r=A/n):v>L?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=w/s,r=T/s):L<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(L),n=A/r,s=T/r),this.set(n,s,r,e),this}let x=Math.sqrt((m-g)*(m-g)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(x)<.001&&(x=1),this.x=(m-g)/x,this.y=(u-_)/x,this.z=(d-h)/x,this.w=Math.acos((l+f+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class f0 extends Gs{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new re(0,0,t,e),this.scissorTest=!1,this.viewport=new re(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:yn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new ze(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new pf(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Wi extends f0{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class mf extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=tn,this.minFilter=tn,this.wrapR=zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class p0 extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=tn,this.minFilter=tn,this.wrapR=zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Yi{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let c=n[s+0],l=n[s+1],h=n[s+2],u=n[s+3];const d=r[o+0],f=r[o+1],g=r[o+2],_=r[o+3];if(a===0){t[e+0]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u;return}if(a===1){t[e+0]=d,t[e+1]=f,t[e+2]=g,t[e+3]=_;return}if(u!==_||c!==d||l!==f||h!==g){let m=1-a;const p=c*d+l*f+h*g+u*_,x=p>=0?1:-1,M=1-p*p;if(M>Number.EPSILON){const L=Math.sqrt(M),w=Math.atan2(L,p*x);m=Math.sin(m*w)/L,a=Math.sin(a*w)/L}const v=a*x;if(c=c*m+d*v,l=l*m+f*v,h=h*m+g*v,u=u*m+_*v,m===1-a){const L=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=L,l*=L,h*=L,u*=L}}t[e]=c,t[e+1]=l,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,o){const a=n[s],c=n[s+1],l=n[s+2],h=n[s+3],u=r[o],d=r[o+1],f=r[o+2],g=r[o+3];return t[e]=a*g+h*u+c*f-l*d,t[e+1]=c*g+h*d+l*u-a*f,t[e+2]=l*g+h*f+a*d-c*u,t[e+3]=h*g-a*u-c*d-l*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,c=Math.sin,l=a(n/2),h=a(s/2),u=a(r/2),d=c(n/2),f=c(s/2),g=c(r/2);switch(o){case"XYZ":this._x=d*h*u+l*f*g,this._y=l*f*u-d*h*g,this._z=l*h*g+d*f*u,this._w=l*h*u-d*f*g;break;case"YXZ":this._x=d*h*u+l*f*g,this._y=l*f*u-d*h*g,this._z=l*h*g-d*f*u,this._w=l*h*u+d*f*g;break;case"ZXY":this._x=d*h*u-l*f*g,this._y=l*f*u+d*h*g,this._z=l*h*g+d*f*u,this._w=l*h*u-d*f*g;break;case"ZYX":this._x=d*h*u-l*f*g,this._y=l*f*u+d*h*g,this._z=l*h*g-d*f*u,this._w=l*h*u+d*f*g;break;case"YZX":this._x=d*h*u+l*f*g,this._y=l*f*u+d*h*g,this._z=l*h*g-d*f*u,this._w=l*h*u-d*f*g;break;case"XZY":this._x=d*h*u-l*f*g,this._y=l*f*u-d*h*g,this._z=l*h*g+d*f*u,this._w=l*h*u+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],c=e[9],l=e[2],h=e[6],u=e[10],d=n+a+u;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-c)*f,this._y=(r-l)*f,this._z=(o-s)*f}else if(n>a&&n>u){const f=2*Math.sqrt(1+n-a-u);this._w=(h-c)/f,this._x=.25*f,this._y=(s+o)/f,this._z=(r+l)/f}else if(a>u){const f=2*Math.sqrt(1+a-n-u);this._w=(r-l)/f,this._x=(s+o)/f,this._y=.25*f,this._z=(c+h)/f}else{const f=2*Math.sqrt(1+u-n-a);this._w=(o-s)/f,this._x=(r+l)/f,this._y=(c+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Se(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,c=e._y,l=e._z,h=e._w;return this._x=n*h+o*a+s*l-r*c,this._y=s*h+o*c+r*a-n*l,this._z=r*h+o*l+n*c-s*a,this._w=o*h-n*a-s*c-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*t._w+n*t._x+s*t._y+r*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const c=1-a*a;if(c<=Number.EPSILON){const f=1-e;return this._w=f*o+e*this._w,this._x=f*n+e*this._x,this._y=f*s+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}const l=Math.sqrt(c),h=Math.atan2(l,a),u=Math.sin((1-e)*h)/l,d=Math.sin(e*h)/l;return this._w=o*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class P{constructor(t=0,e=0,n=0){P.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(nu.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(nu.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,c=t.w,l=2*(o*s-a*n),h=2*(a*e-r*s),u=2*(r*n-o*e);return this.x=e+c*l+o*u-a*h,this.y=n+c*h+a*l-r*u,this.z=s+c*u+r*h-o*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,c=e.z;return this.x=s*c-r*a,this.y=r*o-n*c,this.z=n*a-s*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return ga.copy(this).projectOnVector(t),this.sub(ga)}reflect(t){return this.sub(ga.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Se(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const ga=new P,nu=new Yi;class In{constructor(t=new P(1/0,1/0,1/0),e=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(pn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(pn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=pn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,pn):pn.fromBufferAttribute(r,o),pn.applyMatrix4(t.matrixWorld),this.expandByPoint(pn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Or.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Or.copy(n.boundingBox)),Or.applyMatrix4(t.matrixWorld),this.union(Or)}const s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,pn),pn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ys),kr.subVectors(this.max,Ys),ns.subVectors(t.a,Ys),is.subVectors(t.b,Ys),ss.subVectors(t.c,Ys),ti.subVectors(is,ns),ei.subVectors(ss,is),Mi.subVectors(ns,ss);let e=[0,-ti.z,ti.y,0,-ei.z,ei.y,0,-Mi.z,Mi.y,ti.z,0,-ti.x,ei.z,0,-ei.x,Mi.z,0,-Mi.x,-ti.y,ti.x,0,-ei.y,ei.x,0,-Mi.y,Mi.x,0];return!_a(e,ns,is,ss,kr)||(e=[1,0,0,0,1,0,0,0,1],!_a(e,ns,is,ss,kr))?!1:(zr.crossVectors(ti,ei),e=[zr.x,zr.y,zr.z],_a(e,ns,is,ss,kr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,pn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(pn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(On[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),On[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),On[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),On[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),On[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),On[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),On[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),On[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(On),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const On=[new P,new P,new P,new P,new P,new P,new P,new P],pn=new P,Or=new In,ns=new P,is=new P,ss=new P,ti=new P,ei=new P,Mi=new P,Ys=new P,kr=new P,zr=new P,bi=new P;function _a(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){bi.fromArray(i,r);const a=s.x*Math.abs(bi.x)+s.y*Math.abs(bi.y)+s.z*Math.abs(bi.z),c=t.dot(bi),l=e.dot(bi),h=n.dot(bi);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>a)return!1}return!0}const m0=new In,qs=new P,va=new P;class Zn{constructor(t=new P,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):m0.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;qs.subVectors(t,this.center);const e=qs.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(qs,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(va.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(qs.copy(t.center).add(va)),this.expandByPoint(qs.copy(t.center).sub(va))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const kn=new P,xa=new P,Fr=new P,ni=new P,ya=new P,Br=new P,Sa=new P;class gf{constructor(t=new P,e=new P(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,kn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=kn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(kn.copy(this.origin).addScaledVector(this.direction,e),kn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){xa.copy(t).add(e).multiplyScalar(.5),Fr.copy(e).sub(t).normalize(),ni.copy(this.origin).sub(xa);const r=t.distanceTo(e)*.5,o=-this.direction.dot(Fr),a=ni.dot(this.direction),c=-ni.dot(Fr),l=ni.lengthSq(),h=Math.abs(1-o*o);let u,d,f,g;if(h>0)if(u=o*c-a,d=o*a-c,g=r*h,u>=0)if(d>=-g)if(d<=g){const _=1/h;u*=_,d*=_,f=u*(u+o*d+2*a)+d*(o*u+d+2*c)+l}else d=r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*c)+l;else d=-r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*c)+l;else d<=-g?(u=Math.max(0,-(-o*r+a)),d=u>0?-r:Math.min(Math.max(-r,-c),r),f=-u*u+d*(d+2*c)+l):d<=g?(u=0,d=Math.min(Math.max(-r,-c),r),f=d*(d+2*c)+l):(u=Math.max(0,-(o*r+a)),d=u>0?r:Math.min(Math.max(-r,-c),r),f=-u*u+d*(d+2*c)+l);else d=o>0?-r:r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(xa).addScaledVector(Fr,d),f}intersectSphere(t,e){kn.subVectors(t.center,this.origin);const n=kn.dot(this.direction),s=kn.dot(kn)-n*n,r=t.radius*t.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,c=n+o;return c<0?null:a<0?this.at(c,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,c;const l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(t.min.x-d.x)*l,s=(t.max.x-d.x)*l):(n=(t.max.x-d.x)*l,s=(t.min.x-d.x)*l),h>=0?(r=(t.min.y-d.y)*h,o=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,o=(t.min.y-d.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),u>=0?(a=(t.min.z-d.z)*u,c=(t.max.z-d.z)*u):(a=(t.max.z-d.z)*u,c=(t.min.z-d.z)*u),n>c||a>s)||((a>n||n!==n)&&(n=a),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,kn)!==null}intersectTriangle(t,e,n,s,r){ya.subVectors(e,t),Br.subVectors(n,t),Sa.crossVectors(ya,Br);let o=this.direction.dot(Sa),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;ni.subVectors(this.origin,t);const c=a*this.direction.dot(Br.crossVectors(ni,Br));if(c<0)return null;const l=a*this.direction.dot(ya.cross(ni));if(l<0||c+l>o)return null;const h=-a*ni.dot(Sa);return h<0?null:this.at(h/o,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class qt{constructor(t,e,n,s,r,o,a,c,l,h,u,d,f,g,_,m){qt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,c,l,h,u,d,f,g,_,m)}set(t,e,n,s,r,o,a,c,l,h,u,d,f,g,_,m){const p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=c,p[2]=l,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=g,p[11]=_,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new qt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/rs.setFromMatrixColumn(t,0).length(),r=1/rs.setFromMatrixColumn(t,1).length(),o=1/rs.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),c=Math.cos(s),l=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=o*h,f=o*u,g=a*h,_=a*u;e[0]=c*h,e[4]=-c*u,e[8]=l,e[1]=f+g*l,e[5]=d-_*l,e[9]=-a*c,e[2]=_-d*l,e[6]=g+f*l,e[10]=o*c}else if(t.order==="YXZ"){const d=c*h,f=c*u,g=l*h,_=l*u;e[0]=d+_*a,e[4]=g*a-f,e[8]=o*l,e[1]=o*u,e[5]=o*h,e[9]=-a,e[2]=f*a-g,e[6]=_+d*a,e[10]=o*c}else if(t.order==="ZXY"){const d=c*h,f=c*u,g=l*h,_=l*u;e[0]=d-_*a,e[4]=-o*u,e[8]=g+f*a,e[1]=f+g*a,e[5]=o*h,e[9]=_-d*a,e[2]=-o*l,e[6]=a,e[10]=o*c}else if(t.order==="ZYX"){const d=o*h,f=o*u,g=a*h,_=a*u;e[0]=c*h,e[4]=g*l-f,e[8]=d*l+_,e[1]=c*u,e[5]=_*l+d,e[9]=f*l-g,e[2]=-l,e[6]=a*c,e[10]=o*c}else if(t.order==="YZX"){const d=o*c,f=o*l,g=a*c,_=a*l;e[0]=c*h,e[4]=_-d*u,e[8]=g*u+f,e[1]=u,e[5]=o*h,e[9]=-a*h,e[2]=-l*h,e[6]=f*u+g,e[10]=d-_*u}else if(t.order==="XZY"){const d=o*c,f=o*l,g=a*c,_=a*l;e[0]=c*h,e[4]=-u,e[8]=l*h,e[1]=d*u+_,e[5]=o*h,e[9]=f*u-g,e[2]=g*u-f,e[6]=a*h,e[10]=_*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(g0,t,_0)}lookAt(t,e,n){const s=this.elements;return Ze.subVectors(t,e),Ze.lengthSq()===0&&(Ze.z=1),Ze.normalize(),ii.crossVectors(n,Ze),ii.lengthSq()===0&&(Math.abs(n.z)===1?Ze.x+=1e-4:Ze.z+=1e-4,Ze.normalize(),ii.crossVectors(n,Ze)),ii.normalize(),Hr.crossVectors(Ze,ii),s[0]=ii.x,s[4]=Hr.x,s[8]=Ze.x,s[1]=ii.y,s[5]=Hr.y,s[9]=Ze.y,s[2]=ii.z,s[6]=Hr.z,s[10]=Ze.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],f=n[13],g=n[2],_=n[6],m=n[10],p=n[14],x=n[3],M=n[7],v=n[11],L=n[15],w=s[0],A=s[4],T=s[8],S=s[12],y=s[1],R=s[5],F=s[9],k=s[13],V=s[2],O=s[6],W=s[10],K=s[14],G=s[3],nt=s[7],rt=s[11],_t=s[15];return r[0]=o*w+a*y+c*V+l*G,r[4]=o*A+a*R+c*O+l*nt,r[8]=o*T+a*F+c*W+l*rt,r[12]=o*S+a*k+c*K+l*_t,r[1]=h*w+u*y+d*V+f*G,r[5]=h*A+u*R+d*O+f*nt,r[9]=h*T+u*F+d*W+f*rt,r[13]=h*S+u*k+d*K+f*_t,r[2]=g*w+_*y+m*V+p*G,r[6]=g*A+_*R+m*O+p*nt,r[10]=g*T+_*F+m*W+p*rt,r[14]=g*S+_*k+m*K+p*_t,r[3]=x*w+M*y+v*V+L*G,r[7]=x*A+M*R+v*O+L*nt,r[11]=x*T+M*F+v*W+L*rt,r[15]=x*S+M*k+v*K+L*_t,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],c=t[9],l=t[13],h=t[2],u=t[6],d=t[10],f=t[14],g=t[3],_=t[7],m=t[11],p=t[15];return g*(+r*c*u-s*l*u-r*a*d+n*l*d+s*a*f-n*c*f)+_*(+e*c*f-e*l*d+r*o*d-s*o*f+s*l*h-r*c*h)+m*(+e*l*u-e*a*f-r*o*u+n*o*f+r*a*h-n*l*h)+p*(-s*a*h-e*c*u+e*a*d+s*o*u-n*o*d+n*c*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8],u=t[9],d=t[10],f=t[11],g=t[12],_=t[13],m=t[14],p=t[15],x=u*m*l-_*d*l+_*c*f-a*m*f-u*c*p+a*d*p,M=g*d*l-h*m*l-g*c*f+o*m*f+h*c*p-o*d*p,v=h*_*l-g*u*l+g*a*f-o*_*f-h*a*p+o*u*p,L=g*u*c-h*_*c-g*a*d+o*_*d+h*a*m-o*u*m,w=e*x+n*M+s*v+r*L;if(w===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const A=1/w;return t[0]=x*A,t[1]=(_*d*r-u*m*r-_*s*f+n*m*f+u*s*p-n*d*p)*A,t[2]=(a*m*r-_*c*r+_*s*l-n*m*l-a*s*p+n*c*p)*A,t[3]=(u*c*r-a*d*r-u*s*l+n*d*l+a*s*f-n*c*f)*A,t[4]=M*A,t[5]=(h*m*r-g*d*r+g*s*f-e*m*f-h*s*p+e*d*p)*A,t[6]=(g*c*r-o*m*r-g*s*l+e*m*l+o*s*p-e*c*p)*A,t[7]=(o*d*r-h*c*r+h*s*l-e*d*l-o*s*f+e*c*f)*A,t[8]=v*A,t[9]=(g*u*r-h*_*r-g*n*f+e*_*f+h*n*p-e*u*p)*A,t[10]=(o*_*r-g*a*r+g*n*l-e*_*l-o*n*p+e*a*p)*A,t[11]=(h*a*r-o*u*r-h*n*l+e*u*l+o*n*f-e*a*f)*A,t[12]=L*A,t[13]=(h*_*s-g*u*s+g*n*d-e*_*d-h*n*m+e*u*m)*A,t[14]=(g*a*s-o*_*s-g*n*c+e*_*c+o*n*m-e*a*m)*A,t[15]=(o*u*s-h*a*s+h*n*c-e*u*c-o*n*d+e*a*d)*A,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,c=t.z,l=r*o,h=r*a;return this.set(l*o+n,l*a-s*c,l*c+s*a,0,l*a+s*c,h*a+n,h*c-s*o,0,l*c-s*a,h*c+s*o,r*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,o=e._y,a=e._z,c=e._w,l=r+r,h=o+o,u=a+a,d=r*l,f=r*h,g=r*u,_=o*h,m=o*u,p=a*u,x=c*l,M=c*h,v=c*u,L=n.x,w=n.y,A=n.z;return s[0]=(1-(_+p))*L,s[1]=(f+v)*L,s[2]=(g-M)*L,s[3]=0,s[4]=(f-v)*w,s[5]=(1-(d+p))*w,s[6]=(m+x)*w,s[7]=0,s[8]=(g+M)*A,s[9]=(m-x)*A,s[10]=(1-(d+_))*A,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=rs.set(s[0],s[1],s[2]).length();const o=rs.set(s[4],s[5],s[6]).length(),a=rs.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],mn.copy(this);const l=1/r,h=1/o,u=1/a;return mn.elements[0]*=l,mn.elements[1]*=l,mn.elements[2]*=l,mn.elements[4]*=h,mn.elements[5]*=h,mn.elements[6]*=h,mn.elements[8]*=u,mn.elements[9]*=u,mn.elements[10]*=u,e.setFromRotationMatrix(mn),n.x=r,n.y=o,n.z=a,this}makePerspective(t,e,n,s,r,o,a=Wn){const c=this.elements,l=2*r/(e-t),h=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s);let f,g;if(a===Wn)f=-(o+r)/(o-r),g=-2*o*r/(o-r);else if(a===ko)f=-o/(o-r),g=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=l,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=h,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=f,c[14]=g,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Wn){const c=this.elements,l=1/(e-t),h=1/(n-s),u=1/(o-r),d=(e+t)*l,f=(n+s)*h;let g,_;if(a===Wn)g=(o+r)*u,_=-2*u;else if(a===ko)g=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-d,c[1]=0,c[5]=2*h,c[9]=0,c[13]=-f,c[2]=0,c[6]=0,c[10]=_,c[14]=-g,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const rs=new P,mn=new qt,g0=new P(0,0,0),_0=new P(1,1,1),ii=new P,Hr=new P,Ze=new P,iu=new qt,su=new Yi;class un{constructor(t=0,e=0,n=0,s=un.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],o=s[4],a=s[8],c=s[1],l=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(Se(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Se(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Se(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-Se(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(Se(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-Se(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return iu.makeRotationFromQuaternion(t),this.setFromRotationMatrix(iu,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return su.setFromEuler(this),this.setFromQuaternion(su,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}un.DEFAULT_ORDER="XYZ";class _f{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let v0=0;const ru=new P,os=new Yi,zn=new qt,Vr=new P,js=new P,x0=new P,y0=new Yi,ou=new P(1,0,0),au=new P(0,1,0),cu=new P(0,0,1),lu={type:"added"},S0={type:"removed"},as={type:"childadded",child:null},Ma={type:"childremoved",child:null};class Me extends Gs{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:v0++}),this.uuid=$n(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Me.DEFAULT_UP.clone();const t=new P,e=new un,n=new Yi,s=new P(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new qt},normalMatrix:{value:new zt}}),this.matrix=new qt,this.matrixWorld=new qt,this.matrixAutoUpdate=Me.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new _f,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return os.setFromAxisAngle(t,e),this.quaternion.multiply(os),this}rotateOnWorldAxis(t,e){return os.setFromAxisAngle(t,e),this.quaternion.premultiply(os),this}rotateX(t){return this.rotateOnAxis(ou,t)}rotateY(t){return this.rotateOnAxis(au,t)}rotateZ(t){return this.rotateOnAxis(cu,t)}translateOnAxis(t,e){return ru.copy(t).applyQuaternion(this.quaternion),this.position.add(ru.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(ou,t)}translateY(t){return this.translateOnAxis(au,t)}translateZ(t){return this.translateOnAxis(cu,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(zn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Vr.copy(t):Vr.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),js.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?zn.lookAt(js,Vr,this.up):zn.lookAt(Vr,js,this.up),this.quaternion.setFromRotationMatrix(zn),s&&(zn.extractRotation(s.matrixWorld),os.setFromRotationMatrix(zn),this.quaternion.premultiply(os.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(lu),as.child=t,this.dispatchEvent(as),as.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(S0),Ma.child=t,this.dispatchEvent(Ma),Ma.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),zn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),zn.multiply(t.parent.matrixWorld)),t.applyMatrix4(zn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(lu),as.child=t,this.dispatchEvent(as),as.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(js,t,x0),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(js,y0,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const c=a.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){const u=c[l];r(t.shapes,u)}else r(t.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(r(t.materials,this.material[c]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const c=this.animations[a];s.animations.push(r(t.animations,c))}}if(e){const a=o(t.geometries),c=o(t.materials),l=o(t.textures),h=o(t.images),u=o(t.shapes),d=o(t.skeletons),f=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){const c=[];for(const l in a){const h=a[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}Me.DEFAULT_UP=new P(0,1,0);Me.DEFAULT_MATRIX_AUTO_UPDATE=!0;Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const gn=new P,Fn=new P,ba=new P,Bn=new P,cs=new P,ls=new P,hu=new P,Ea=new P,Ta=new P,Ca=new P,Aa=new re,wa=new re,Ra=new re;class hn{constructor(t=new P,e=new P,n=new P){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),gn.subVectors(t,e),s.cross(gn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){gn.subVectors(s,e),Fn.subVectors(n,e),ba.subVectors(t,e);const o=gn.dot(gn),a=gn.dot(Fn),c=gn.dot(ba),l=Fn.dot(Fn),h=Fn.dot(ba),u=o*l-a*a;if(u===0)return r.set(0,0,0),null;const d=1/u,f=(l*c-a*h)*d,g=(o*h-a*c)*d;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Bn)===null?!1:Bn.x>=0&&Bn.y>=0&&Bn.x+Bn.y<=1}static getInterpolation(t,e,n,s,r,o,a,c){return this.getBarycoord(t,e,n,s,Bn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,Bn.x),c.addScaledVector(o,Bn.y),c.addScaledVector(a,Bn.z),c)}static getInterpolatedAttribute(t,e,n,s,r,o){return Aa.setScalar(0),wa.setScalar(0),Ra.setScalar(0),Aa.fromBufferAttribute(t,e),wa.fromBufferAttribute(t,n),Ra.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Aa,r.x),o.addScaledVector(wa,r.y),o.addScaledVector(Ra,r.z),o}static isFrontFacing(t,e,n,s){return gn.subVectors(n,e),Fn.subVectors(t,e),gn.cross(Fn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return gn.subVectors(this.c,this.b),Fn.subVectors(this.a,this.b),gn.cross(Fn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return hn.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return hn.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return hn.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return hn.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return hn.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let o,a;cs.subVectors(s,n),ls.subVectors(r,n),Ea.subVectors(t,n);const c=cs.dot(Ea),l=ls.dot(Ea);if(c<=0&&l<=0)return e.copy(n);Ta.subVectors(t,s);const h=cs.dot(Ta),u=ls.dot(Ta);if(h>=0&&u<=h)return e.copy(s);const d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return o=c/(c-h),e.copy(n).addScaledVector(cs,o);Ca.subVectors(t,r);const f=cs.dot(Ca),g=ls.dot(Ca);if(g>=0&&f<=g)return e.copy(r);const _=f*l-c*g;if(_<=0&&l>=0&&g<=0)return a=l/(l-g),e.copy(n).addScaledVector(ls,a);const m=h*g-f*u;if(m<=0&&u-h>=0&&f-g>=0)return hu.subVectors(r,s),a=(u-h)/(u-h+(f-g)),e.copy(s).addScaledVector(hu,a);const p=1/(m+_+d);return o=_*p,a=d*p,e.copy(n).addScaledVector(cs,o).addScaledVector(ls,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const vf={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},si={h:0,s:0,l:0},Gr={h:0,s:0,l:0};function Pa(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class Ft{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Oe){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Yt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=Yt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Yt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=Yt.workingColorSpace){if(t=Ql(t,1),e=Se(e,0,1),n=Se(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=Pa(o,r,t+1/3),this.g=Pa(o,r,t),this.b=Pa(o,r,t-1/3)}return Yt.toWorkingColorSpace(this,s),this}setStyle(t,e=Oe){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Oe){const n=vf[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Yn(t.r),this.g=Yn(t.g),this.b=Yn(t.b),this}copyLinearToSRGB(t){return this.r=As(t.r),this.g=As(t.g),this.b=As(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Oe){return Yt.fromWorkingColorSpace(Ne.copy(this),t),Math.round(Se(Ne.r*255,0,255))*65536+Math.round(Se(Ne.g*255,0,255))*256+Math.round(Se(Ne.b*255,0,255))}getHexString(t=Oe){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Yt.workingColorSpace){Yt.fromWorkingColorSpace(Ne.copy(this),e);const n=Ne.r,s=Ne.g,r=Ne.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let c,l;const h=(a+o)/2;if(a===o)c=0,l=0;else{const u=o-a;switch(l=h<=.5?u/(o+a):u/(2-o-a),o){case n:c=(s-r)/u+(s<r?6:0);break;case s:c=(r-n)/u+2;break;case r:c=(n-s)/u+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,e=Yt.workingColorSpace){return Yt.fromWorkingColorSpace(Ne.copy(this),e),t.r=Ne.r,t.g=Ne.g,t.b=Ne.b,t}getStyle(t=Oe){Yt.fromWorkingColorSpace(Ne.copy(this),t);const e=Ne.r,n=Ne.g,s=Ne.b;return t!==Oe?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(si),this.setHSL(si.h+t,si.s+e,si.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(si),t.getHSL(Gr);const n=fr(si.h,Gr.h,e),s=fr(si.s,Gr.s,e),r=fr(si.l,Gr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ne=new Ft;Ft.NAMES=vf;let M0=0;class yi extends Gs{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:M0++}),this.uuid=$n(),this.name="",this.blending=Ts,this.side=xi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=gc,this.blendDst=_c,this.blendEquation=Ui,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ft(0,0,0),this.blendAlpha=0,this.depthFunc=Ns,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=$h,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ts,this.stencilZFail=ts,this.stencilZPass=ts,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ts&&(n.blending=this.blending),this.side!==xi&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==gc&&(n.blendSrc=this.blendSrc),this.blendDst!==_c&&(n.blendDst=this.blendDst),this.blendEquation!==Ui&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ns&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==$h&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ts&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ts&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ts&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const c=r[a];delete c.metadata,o.push(c)}return o}if(e){const r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class mi extends yi{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Ft(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new un,this.combine=Wl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ve=new P,Wr=new ct;class en{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=el,this.updateRanges=[],this.gpuType=wn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Wr.fromBufferAttribute(this,e),Wr.applyMatrix3(t),this.setXY(e,Wr.x,Wr.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)ve.fromBufferAttribute(this,e),ve.applyMatrix3(t),this.setXYZ(e,ve.x,ve.y,ve.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)ve.fromBufferAttribute(this,e),ve.applyMatrix4(t),this.setXYZ(e,ve.x,ve.y,ve.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)ve.fromBufferAttribute(this,e),ve.applyNormalMatrix(t),this.setXYZ(e,ve.x,ve.y,ve.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)ve.fromBufferAttribute(this,e),ve.transformDirection(t),this.setXYZ(e,ve.x,ve.y,ve.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=xn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=ne(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=xn(e,this.array)),e}setX(t,e){return this.normalized&&(e=ne(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=xn(e,this.array)),e}setY(t,e){return this.normalized&&(e=ne(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=xn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=ne(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=xn(e,this.array)),e}setW(t,e){return this.normalized&&(e=ne(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array),s=ne(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array),s=ne(s,this.array),r=ne(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==el&&(t.usage=this.usage),t}}class xf extends en{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class yf extends en{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class he extends en{constructor(t,e,n){super(new Float32Array(t),e,n)}}let b0=0;const rn=new qt,La=new Me,hs=new P,Je=new In,Ks=new In,Ce=new P;class Ie extends Gs{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:b0++}),this.uuid=$n(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(ff(t)?yf:xf)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new zt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return rn.makeRotationFromQuaternion(t),this.applyMatrix4(rn),this}rotateX(t){return rn.makeRotationX(t),this.applyMatrix4(rn),this}rotateY(t){return rn.makeRotationY(t),this.applyMatrix4(rn),this}rotateZ(t){return rn.makeRotationZ(t),this.applyMatrix4(rn),this}translate(t,e,n){return rn.makeTranslation(t,e,n),this.applyMatrix4(rn),this}scale(t,e,n){return rn.makeScale(t,e,n),this.applyMatrix4(rn),this}lookAt(t){return La.lookAt(t),La.updateMatrix(),this.applyMatrix4(La.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(hs).negate(),this.translate(hs.x,hs.y,hs.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new he(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new In);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];Je.setFromBufferAttribute(r),this.morphTargetsRelative?(Ce.addVectors(this.boundingBox.min,Je.min),this.boundingBox.expandByPoint(Ce),Ce.addVectors(this.boundingBox.max,Je.max),this.boundingBox.expandByPoint(Ce)):(this.boundingBox.expandByPoint(Je.min),this.boundingBox.expandByPoint(Je.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Zn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new P,1/0);return}if(t){const n=this.boundingSphere.center;if(Je.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){const a=e[r];Ks.setFromBufferAttribute(a),this.morphTargetsRelative?(Ce.addVectors(Je.min,Ks.min),Je.expandByPoint(Ce),Ce.addVectors(Je.max,Ks.max),Je.expandByPoint(Ce)):(Je.expandByPoint(Ks.min),Je.expandByPoint(Ks.max))}Je.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Ce.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ce));if(e)for(let r=0,o=e.length;r<o;r++){const a=e[r],c=this.morphTargetsRelative;for(let l=0,h=a.count;l<h;l++)Ce.fromBufferAttribute(a,l),c&&(hs.fromBufferAttribute(t,l),Ce.add(hs)),s=Math.max(s,n.distanceToSquared(Ce))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new en(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],c=[];for(let T=0;T<n.count;T++)a[T]=new P,c[T]=new P;const l=new P,h=new P,u=new P,d=new ct,f=new ct,g=new ct,_=new P,m=new P;function p(T,S,y){l.fromBufferAttribute(n,T),h.fromBufferAttribute(n,S),u.fromBufferAttribute(n,y),d.fromBufferAttribute(r,T),f.fromBufferAttribute(r,S),g.fromBufferAttribute(r,y),h.sub(l),u.sub(l),f.sub(d),g.sub(d);const R=1/(f.x*g.y-g.x*f.y);isFinite(R)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(u,-f.y).multiplyScalar(R),m.copy(u).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(R),a[T].add(_),a[S].add(_),a[y].add(_),c[T].add(m),c[S].add(m),c[y].add(m))}let x=this.groups;x.length===0&&(x=[{start:0,count:t.count}]);for(let T=0,S=x.length;T<S;++T){const y=x[T],R=y.start,F=y.count;for(let k=R,V=R+F;k<V;k+=3)p(t.getX(k+0),t.getX(k+1),t.getX(k+2))}const M=new P,v=new P,L=new P,w=new P;function A(T){L.fromBufferAttribute(s,T),w.copy(L);const S=a[T];M.copy(S),M.sub(L.multiplyScalar(L.dot(S))).normalize(),v.crossVectors(w,S);const R=v.dot(c[T])<0?-1:1;o.setXYZW(T,M.x,M.y,M.z,R)}for(let T=0,S=x.length;T<S;++T){const y=x[T],R=y.start,F=y.count;for(let k=R,V=R+F;k<V;k+=3)A(t.getX(k+0)),A(t.getX(k+1)),A(t.getX(k+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new en(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const s=new P,r=new P,o=new P,a=new P,c=new P,l=new P,h=new P,u=new P;if(t)for(let d=0,f=t.count;d<f;d+=3){const g=t.getX(d+0),_=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,m),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),a.fromBufferAttribute(n,g),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,m),a.add(h),c.add(h),l.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(m,l.x,l.y,l.z)}else for(let d=0,f=e.count;d<f;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),o.fromBufferAttribute(e,d+2),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ce.fromBufferAttribute(t,e),Ce.normalize(),t.setXYZ(e,Ce.x,Ce.y,Ce.z)}toNonIndexed(){function t(a,c){const l=a.array,h=a.itemSize,u=a.normalized,d=new l.constructor(c.length*h);let f=0,g=0;for(let _=0,m=c.length;_<m;_++){a.isInterleavedBufferAttribute?f=c[_]*a.data.stride+a.offset:f=c[_]*h;for(let p=0;p<h;p++)d[g++]=l[f++]}return new en(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new Ie,n=this.index.array,s=this.attributes;for(const a in s){const c=s[a],l=t(c,n);e.setAttribute(a,l)}const r=this.morphAttributes;for(const a in r){const c=[],l=r[a];for(let h=0,u=l.length;h<u;h++){const d=l[h],f=t(d,n);c.push(f)}e.morphAttributes[a]=c}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,c=o.length;a<c;a++){const l=o[a];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const c in n){const l=n[c];t.data.attributes[c]=l.toJSON(t.data)}const s={};let r=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){const f=l[u];h.push(f.toJSON(t.data))}h.length>0&&(s[c]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const l in s){const h=s[l];this.setAttribute(l,h.clone(e))}const r=t.morphAttributes;for(const l in r){const h=[],u=r[l];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let l=0,h=o.length;l<h;l++){const u=o[l];this.addGroup(u.start,u.count,u.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const uu=new qt,Ei=new gf,Xr=new Zn,du=new P,$r=new P,Yr=new P,qr=new P,Ia=new P,jr=new P,fu=new P,Kr=new P;class ie extends Me{constructor(t=new Ie,e=new mi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const a=this.morphTargetInfluences;if(r&&a){jr.set(0,0,0);for(let c=0,l=r.length;c<l;c++){const h=a[c],u=r[c];h!==0&&(Ia.fromBufferAttribute(u,t),o?jr.addScaledVector(Ia,h):jr.addScaledVector(Ia.sub(e),h))}e.add(jr)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Xr.copy(n.boundingSphere),Xr.applyMatrix4(r),Ei.copy(t.ray).recast(t.near),!(Xr.containsPoint(Ei.origin)===!1&&(Ei.intersectSphere(Xr,du)===null||Ei.origin.distanceToSquared(du)>(t.far-t.near)**2))&&(uu.copy(r).invert(),Ei.copy(t.ray).applyMatrix4(uu),!(n.boundingBox!==null&&Ei.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ei)))}_computeIntersections(t,e,n){let s;const r=this.geometry,o=this.material,a=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=d.length;g<_;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(a.count,Math.min(m.start+m.count,f.start+f.count));for(let v=x,L=M;v<L;v+=3){const w=a.getX(v),A=a.getX(v+1),T=a.getX(v+2);s=Zr(this,p,t,n,l,h,u,w,A,T),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),_=Math.min(a.count,f.start+f.count);for(let m=g,p=_;m<p;m+=3){const x=a.getX(m),M=a.getX(m+1),v=a.getX(m+2);s=Zr(this,o,t,n,l,h,u,x,M,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(c!==void 0)if(Array.isArray(o))for(let g=0,_=d.length;g<_;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(c.count,Math.min(m.start+m.count,f.start+f.count));for(let v=x,L=M;v<L;v+=3){const w=v,A=v+1,T=v+2;s=Zr(this,p,t,n,l,h,u,w,A,T),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),_=Math.min(c.count,f.start+f.count);for(let m=g,p=_;m<p;m+=3){const x=m,M=m+1,v=m+2;s=Zr(this,o,t,n,l,h,u,x,M,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}}function E0(i,t,e,n,s,r,o,a){let c;if(t.side===je?c=n.intersectTriangle(o,r,s,!0,a):c=n.intersectTriangle(s,r,o,t.side===xi,a),c===null)return null;Kr.copy(a),Kr.applyMatrix4(i.matrixWorld);const l=e.ray.origin.distanceTo(Kr);return l<e.near||l>e.far?null:{distance:l,point:Kr.clone(),object:i}}function Zr(i,t,e,n,s,r,o,a,c,l){i.getVertexPosition(a,$r),i.getVertexPosition(c,Yr),i.getVertexPosition(l,qr);const h=E0(i,t,e,n,$r,Yr,qr,fu);if(h){const u=new P;hn.getBarycoord(fu,$r,Yr,qr,u),s&&(h.uv=hn.getInterpolatedAttribute(s,a,c,l,u,new ct)),r&&(h.uv1=hn.getInterpolatedAttribute(r,a,c,l,u,new ct)),o&&(h.normal=hn.getInterpolatedAttribute(o,a,c,l,u,new P),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a,b:c,c:l,normal:new P,materialIndex:0};hn.getNormal($r,Yr,qr,d.normal),h.face=d,h.barycoord=u}return h}class cn extends Ie{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const c=[],l=[],h=[],u=[];let d=0,f=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new he(l,3)),this.setAttribute("normal",new he(h,3)),this.setAttribute("uv",new he(u,2));function g(_,m,p,x,M,v,L,w,A,T,S){const y=v/A,R=L/T,F=v/2,k=L/2,V=w/2,O=A+1,W=T+1;let K=0,G=0;const nt=new P;for(let rt=0;rt<W;rt++){const _t=rt*R-k;for(let Lt=0;Lt<O;Lt++){const Qt=Lt*y-F;nt[_]=Qt*x,nt[m]=_t*M,nt[p]=V,l.push(nt.x,nt.y,nt.z),nt[_]=0,nt[m]=0,nt[p]=w>0?1:-1,h.push(nt.x,nt.y,nt.z),u.push(Lt/A),u.push(1-rt/T),K+=1}}for(let rt=0;rt<T;rt++)for(let _t=0;_t<A;_t++){const Lt=d+_t+O*rt,Qt=d+_t+O*(rt+1),$=d+(_t+1)+O*(rt+1),Q=d+(_t+1)+O*rt;c.push(Lt,Qt,Q),c.push(Qt,$,Q),G+=6}a.addGroup(f,G,S),f+=G,d+=K}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new cn(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Bs(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function Ve(i){const t={};for(let e=0;e<i.length;e++){const n=Bs(i[e]);for(const s in n)t[s]=n[s]}return t}function T0(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Sf(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Yt.workingColorSpace}const th={clone:Bs,merge:Ve};var C0=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,A0=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Kn extends yi{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=C0,this.fragmentShader=A0,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Bs(t.uniforms),this.uniformsGroups=T0(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Mf extends Me{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new qt,this.projectionMatrix=new qt,this.projectionMatrixInverse=new qt,this.coordinateSystem=Wn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const ri=new P,pu=new ct,mu=new ct;class ln extends Mf{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Mr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(dr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Mr*2*Math.atan(Math.tan(dr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){ri.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(ri.x,ri.y).multiplyScalar(-t/ri.z),ri.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ri.x,ri.y).multiplyScalar(-t/ri.z)}getViewSize(t,e){return this.getViewBounds(t,pu,mu),e.subVectors(mu,pu)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(dr*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const c=o.fullWidth,l=o.fullHeight;r+=o.offsetX*s/c,e-=o.offsetY*n/l,s*=o.width/c,n*=o.height/l}const a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const us=-90,ds=1;class w0 extends Me{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new ln(us,ds,t,e);s.layers=this.layers,this.add(s);const r=new ln(us,ds,t,e);r.layers=this.layers,this.add(r);const o=new ln(us,ds,t,e);o.layers=this.layers,this.add(o);const a=new ln(us,ds,t,e);a.layers=this.layers,this.add(a);const c=new ln(us,ds,t,e);c.layers=this.layers,this.add(c);const l=new ln(us,ds,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,c]=e;for(const l of e)this.remove(l);if(t===Wn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===ko)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,c,l,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,o),t.setRenderTarget(n,2,s),t.render(e,a),t.setRenderTarget(n,3,s),t.render(e,c),t.setRenderTarget(n,4,s),t.render(e,l),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class bf extends ze{constructor(t,e,n,s,r,o,a,c,l,h){t=t!==void 0?t:[],e=e!==void 0?e:Os,super(t,e,n,s,r,o,a,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class R0 extends Wi{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new bf(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:yn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new cn(5,5,5),r=new Kn({name:"CubemapFromEquirect",uniforms:Bs(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:je,blending:fi});r.uniforms.tEquirect.value=e;const o=new ie(s,r),a=e.minFilter;return e.minFilter===Fi&&(e.minFilter=yn),new w0(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}}const Da=new P,P0=new P,L0=new zt;class Ii{constructor(t=new P(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=Da.subVectors(n,e).cross(P0.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Da),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||L0.getNormalMatrix(t),s=this.coplanarPoint(Da).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Ti=new Zn,Jr=new P;class eh{constructor(t=new Ii,e=new Ii,n=new Ii,s=new Ii,r=new Ii,o=new Ii){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Wn){const n=this.planes,s=t.elements,r=s[0],o=s[1],a=s[2],c=s[3],l=s[4],h=s[5],u=s[6],d=s[7],f=s[8],g=s[9],_=s[10],m=s[11],p=s[12],x=s[13],M=s[14],v=s[15];if(n[0].setComponents(c-r,d-l,m-f,v-p).normalize(),n[1].setComponents(c+r,d+l,m+f,v+p).normalize(),n[2].setComponents(c+o,d+h,m+g,v+x).normalize(),n[3].setComponents(c-o,d-h,m-g,v-x).normalize(),n[4].setComponents(c-a,d-u,m-_,v-M).normalize(),e===Wn)n[5].setComponents(c+a,d+u,m+_,v+M).normalize();else if(e===ko)n[5].setComponents(a,u,_,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ti.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Ti.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ti)}intersectsSprite(t){return Ti.center.set(0,0,0),Ti.radius=.7071067811865476,Ti.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ti)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(Jr.x=s.normal.x>0?t.max.x:t.min.x,Jr.y=s.normal.y>0?t.max.y:t.min.y,Jr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Jr)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Ef(){let i=null,t=!1,e=null,n=null;function s(r,o){e(r,o),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function I0(i){const t=new WeakMap;function e(a,c){const l=a.array,h=a.usage,u=l.byteLength,d=i.createBuffer();i.bindBuffer(c,d),i.bufferData(c,l,h),a.onUploadCallback();let f;if(l instanceof Float32Array)f=i.FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)f=i.SHORT;else if(l instanceof Uint32Array)f=i.UNSIGNED_INT;else if(l instanceof Int32Array)f=i.INT;else if(l instanceof Int8Array)f=i.BYTE;else if(l instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:d,type:f,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,c,l){const h=c.array,u=c.updateRanges;if(i.bindBuffer(l,a),u.length===0)i.bufferSubData(l,0,h);else{u.sort((f,g)=>f.start-g.start);let d=0;for(let f=1;f<u.length;f++){const g=u[d],_=u[f];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++d,u[d]=_)}u.length=d+1;for(let f=0,g=u.length;f<g;f++){const _=u[f];i.bufferSubData(l,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const c=t.get(a);c&&(i.deleteBuffer(c.buffer),t.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const l=t.get(a);if(l===void 0)t.set(a,e(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,a,c),l.version=a.version}}return{get:s,remove:r,update:o}}class qn extends Ie{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,o=e/2,a=Math.floor(n),c=Math.floor(s),l=a+1,h=c+1,u=t/a,d=e/c,f=[],g=[],_=[],m=[];for(let p=0;p<h;p++){const x=p*d-o;for(let M=0;M<l;M++){const v=M*u-r;g.push(v,-x,0),_.push(0,0,1),m.push(M/a),m.push(1-p/c)}}for(let p=0;p<c;p++)for(let x=0;x<a;x++){const M=x+l*p,v=x+l*(p+1),L=x+1+l*(p+1),w=x+1+l*p;f.push(M,v,w),f.push(v,L,w)}this.setIndex(f),this.setAttribute("position",new he(g,3)),this.setAttribute("normal",new he(_,3)),this.setAttribute("uv",new he(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new qn(t.width,t.height,t.widthSegments,t.heightSegments)}}var D0=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,U0=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,N0=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,O0=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,k0=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,z0=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,F0=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,B0=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,H0=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,V0=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,G0=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,W0=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,X0=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,$0=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Y0=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,q0=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,j0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,K0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Z0=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,J0=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Q0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,t_=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,e_=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,n_=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,i_=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,s_=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,r_=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,o_=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,a_=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,c_=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,l_="gl_FragColor = linearToOutputTexel( gl_FragColor );",h_=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,u_=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,d_=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,f_=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,p_=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,m_=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,g_=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,__=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,v_=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,x_=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,y_=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,S_=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,M_=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,b_=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,E_=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,T_=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,C_=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,A_=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,w_=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,R_=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,P_=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,L_=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,I_=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,D_=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,U_=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,N_=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,O_=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,k_=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,z_=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,F_=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,B_=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,H_=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,V_=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,G_=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,W_=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,X_=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,$_=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Y_=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,q_=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,j_=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,K_=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Z_=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,J_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Q_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,tv=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,ev=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,nv=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,iv=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,sv=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,rv=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ov=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,av=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,cv=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,lv=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,hv=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,uv=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,dv=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,fv=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,pv=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,mv=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,gv=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,_v=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,vv=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,xv=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,yv=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Sv=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Mv=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,bv=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Ev=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Tv=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Cv=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Av=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,wv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Rv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Pv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Lv=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Iv=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Dv=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Uv=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Nv=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ov=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,kv=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zv=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Fv=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Bv=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Hv=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Vv=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Gv=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Wv=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Xv=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,$v=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Yv=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qv=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jv=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Kv=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Zv=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jv=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Qv=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,tx=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ex=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,nx=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,ix=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sx=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rx=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ox=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,ax=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,cx=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lx=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,hx=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ux=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Vt={alphahash_fragment:D0,alphahash_pars_fragment:U0,alphamap_fragment:N0,alphamap_pars_fragment:O0,alphatest_fragment:k0,alphatest_pars_fragment:z0,aomap_fragment:F0,aomap_pars_fragment:B0,batching_pars_vertex:H0,batching_vertex:V0,begin_vertex:G0,beginnormal_vertex:W0,bsdfs:X0,iridescence_fragment:$0,bumpmap_pars_fragment:Y0,clipping_planes_fragment:q0,clipping_planes_pars_fragment:j0,clipping_planes_pars_vertex:K0,clipping_planes_vertex:Z0,color_fragment:J0,color_pars_fragment:Q0,color_pars_vertex:t_,color_vertex:e_,common:n_,cube_uv_reflection_fragment:i_,defaultnormal_vertex:s_,displacementmap_pars_vertex:r_,displacementmap_vertex:o_,emissivemap_fragment:a_,emissivemap_pars_fragment:c_,colorspace_fragment:l_,colorspace_pars_fragment:h_,envmap_fragment:u_,envmap_common_pars_fragment:d_,envmap_pars_fragment:f_,envmap_pars_vertex:p_,envmap_physical_pars_fragment:T_,envmap_vertex:m_,fog_vertex:g_,fog_pars_vertex:__,fog_fragment:v_,fog_pars_fragment:x_,gradientmap_pars_fragment:y_,lightmap_pars_fragment:S_,lights_lambert_fragment:M_,lights_lambert_pars_fragment:b_,lights_pars_begin:E_,lights_toon_fragment:C_,lights_toon_pars_fragment:A_,lights_phong_fragment:w_,lights_phong_pars_fragment:R_,lights_physical_fragment:P_,lights_physical_pars_fragment:L_,lights_fragment_begin:I_,lights_fragment_maps:D_,lights_fragment_end:U_,logdepthbuf_fragment:N_,logdepthbuf_pars_fragment:O_,logdepthbuf_pars_vertex:k_,logdepthbuf_vertex:z_,map_fragment:F_,map_pars_fragment:B_,map_particle_fragment:H_,map_particle_pars_fragment:V_,metalnessmap_fragment:G_,metalnessmap_pars_fragment:W_,morphinstance_vertex:X_,morphcolor_vertex:$_,morphnormal_vertex:Y_,morphtarget_pars_vertex:q_,morphtarget_vertex:j_,normal_fragment_begin:K_,normal_fragment_maps:Z_,normal_pars_fragment:J_,normal_pars_vertex:Q_,normal_vertex:tv,normalmap_pars_fragment:ev,clearcoat_normal_fragment_begin:nv,clearcoat_normal_fragment_maps:iv,clearcoat_pars_fragment:sv,iridescence_pars_fragment:rv,opaque_fragment:ov,packing:av,premultiplied_alpha_fragment:cv,project_vertex:lv,dithering_fragment:hv,dithering_pars_fragment:uv,roughnessmap_fragment:dv,roughnessmap_pars_fragment:fv,shadowmap_pars_fragment:pv,shadowmap_pars_vertex:mv,shadowmap_vertex:gv,shadowmask_pars_fragment:_v,skinbase_vertex:vv,skinning_pars_vertex:xv,skinning_vertex:yv,skinnormal_vertex:Sv,specularmap_fragment:Mv,specularmap_pars_fragment:bv,tonemapping_fragment:Ev,tonemapping_pars_fragment:Tv,transmission_fragment:Cv,transmission_pars_fragment:Av,uv_pars_fragment:wv,uv_pars_vertex:Rv,uv_vertex:Pv,worldpos_vertex:Lv,background_vert:Iv,background_frag:Dv,backgroundCube_vert:Uv,backgroundCube_frag:Nv,cube_vert:Ov,cube_frag:kv,depth_vert:zv,depth_frag:Fv,distanceRGBA_vert:Bv,distanceRGBA_frag:Hv,equirect_vert:Vv,equirect_frag:Gv,linedashed_vert:Wv,linedashed_frag:Xv,meshbasic_vert:$v,meshbasic_frag:Yv,meshlambert_vert:qv,meshlambert_frag:jv,meshmatcap_vert:Kv,meshmatcap_frag:Zv,meshnormal_vert:Jv,meshnormal_frag:Qv,meshphong_vert:tx,meshphong_frag:ex,meshphysical_vert:nx,meshphysical_frag:ix,meshtoon_vert:sx,meshtoon_frag:rx,points_vert:ox,points_frag:ax,shadow_vert:cx,shadow_frag:lx,sprite_vert:hx,sprite_frag:ux},it={common:{diffuse:{value:new Ft(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new zt},alphaMap:{value:null},alphaMapTransform:{value:new zt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new zt}},envmap:{envMap:{value:null},envMapRotation:{value:new zt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new zt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new zt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new zt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new zt},normalScale:{value:new ct(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new zt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new zt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new zt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new zt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ft(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ft(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new zt},alphaTest:{value:0},uvTransform:{value:new zt}},sprite:{diffuse:{value:new Ft(16777215)},opacity:{value:1},center:{value:new ct(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new zt},alphaMap:{value:null},alphaMapTransform:{value:new zt},alphaTest:{value:0}}},qe={basic:{uniforms:Ve([it.common,it.specularmap,it.envmap,it.aomap,it.lightmap,it.fog]),vertexShader:Vt.meshbasic_vert,fragmentShader:Vt.meshbasic_frag},lambert:{uniforms:Ve([it.common,it.specularmap,it.envmap,it.aomap,it.lightmap,it.emissivemap,it.bumpmap,it.normalmap,it.displacementmap,it.fog,it.lights,{emissive:{value:new Ft(0)}}]),vertexShader:Vt.meshlambert_vert,fragmentShader:Vt.meshlambert_frag},phong:{uniforms:Ve([it.common,it.specularmap,it.envmap,it.aomap,it.lightmap,it.emissivemap,it.bumpmap,it.normalmap,it.displacementmap,it.fog,it.lights,{emissive:{value:new Ft(0)},specular:{value:new Ft(1118481)},shininess:{value:30}}]),vertexShader:Vt.meshphong_vert,fragmentShader:Vt.meshphong_frag},standard:{uniforms:Ve([it.common,it.envmap,it.aomap,it.lightmap,it.emissivemap,it.bumpmap,it.normalmap,it.displacementmap,it.roughnessmap,it.metalnessmap,it.fog,it.lights,{emissive:{value:new Ft(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Vt.meshphysical_vert,fragmentShader:Vt.meshphysical_frag},toon:{uniforms:Ve([it.common,it.aomap,it.lightmap,it.emissivemap,it.bumpmap,it.normalmap,it.displacementmap,it.gradientmap,it.fog,it.lights,{emissive:{value:new Ft(0)}}]),vertexShader:Vt.meshtoon_vert,fragmentShader:Vt.meshtoon_frag},matcap:{uniforms:Ve([it.common,it.bumpmap,it.normalmap,it.displacementmap,it.fog,{matcap:{value:null}}]),vertexShader:Vt.meshmatcap_vert,fragmentShader:Vt.meshmatcap_frag},points:{uniforms:Ve([it.points,it.fog]),vertexShader:Vt.points_vert,fragmentShader:Vt.points_frag},dashed:{uniforms:Ve([it.common,it.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Vt.linedashed_vert,fragmentShader:Vt.linedashed_frag},depth:{uniforms:Ve([it.common,it.displacementmap]),vertexShader:Vt.depth_vert,fragmentShader:Vt.depth_frag},normal:{uniforms:Ve([it.common,it.bumpmap,it.normalmap,it.displacementmap,{opacity:{value:1}}]),vertexShader:Vt.meshnormal_vert,fragmentShader:Vt.meshnormal_frag},sprite:{uniforms:Ve([it.sprite,it.fog]),vertexShader:Vt.sprite_vert,fragmentShader:Vt.sprite_frag},background:{uniforms:{uvTransform:{value:new zt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Vt.background_vert,fragmentShader:Vt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new zt}},vertexShader:Vt.backgroundCube_vert,fragmentShader:Vt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Vt.cube_vert,fragmentShader:Vt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Vt.equirect_vert,fragmentShader:Vt.equirect_frag},distanceRGBA:{uniforms:Ve([it.common,it.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Vt.distanceRGBA_vert,fragmentShader:Vt.distanceRGBA_frag},shadow:{uniforms:Ve([it.lights,it.fog,{color:{value:new Ft(0)},opacity:{value:1}}]),vertexShader:Vt.shadow_vert,fragmentShader:Vt.shadow_frag}};qe.physical={uniforms:Ve([qe.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new zt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new zt},clearcoatNormalScale:{value:new ct(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new zt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new zt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new zt},sheen:{value:0},sheenColor:{value:new Ft(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new zt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new zt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new zt},transmissionSamplerSize:{value:new ct},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new zt},attenuationDistance:{value:0},attenuationColor:{value:new Ft(0)},specularColor:{value:new Ft(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new zt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new zt},anisotropyVector:{value:new ct},anisotropyMap:{value:null},anisotropyMapTransform:{value:new zt}}]),vertexShader:Vt.meshphysical_vert,fragmentShader:Vt.meshphysical_frag};const Qr={r:0,b:0,g:0},Ci=new un,dx=new qt;function fx(i,t,e,n,s,r,o){const a=new Ft(0);let c=r===!0?0:1,l,h,u=null,d=0,f=null;function g(x){let M=x.isScene===!0?x.background:null;return M&&M.isTexture&&(M=(x.backgroundBlurriness>0?e:t).get(M)),M}function _(x){let M=!1;const v=g(x);v===null?p(a,c):v&&v.isColor&&(p(v,1),M=!0);const L=i.xr.getEnvironmentBlendMode();L==="additive"?n.buffers.color.setClear(0,0,0,1,o):L==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||M)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(x,M){const v=g(M);v&&(v.isCubeTexture||v.mapping===Qo)?(h===void 0&&(h=new ie(new cn(1,1,1),new Kn({name:"BackgroundCubeMaterial",uniforms:Bs(qe.backgroundCube.uniforms),vertexShader:qe.backgroundCube.vertexShader,fragmentShader:qe.backgroundCube.fragmentShader,side:je,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(L,w,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),Ci.copy(M.backgroundRotation),Ci.x*=-1,Ci.y*=-1,Ci.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(Ci.y*=-1,Ci.z*=-1),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(dx.makeRotationFromEuler(Ci)),h.material.toneMapped=Yt.getTransfer(v.colorSpace)!==se,(u!==v||d!==v.version||f!==i.toneMapping)&&(h.material.needsUpdate=!0,u=v,d=v.version,f=i.toneMapping),h.layers.enableAll(),x.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new ie(new qn(2,2),new Kn({name:"BackgroundMaterial",uniforms:Bs(qe.background.uniforms),vertexShader:qe.background.vertexShader,fragmentShader:qe.background.fragmentShader,side:xi,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,l.material.toneMapped=Yt.getTransfer(v.colorSpace)!==se,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||f!==i.toneMapping)&&(l.material.needsUpdate=!0,u=v,d=v.version,f=i.toneMapping),l.layers.enableAll(),x.unshift(l,l.geometry,l.material,0,0,null))}function p(x,M){x.getRGB(Qr,Sf(i)),n.buffers.color.setClear(Qr.r,Qr.g,Qr.b,M,o)}return{getClearColor:function(){return a},setClearColor:function(x,M=1){a.set(x),c=M,p(a,c)},getClearAlpha:function(){return c},setClearAlpha:function(x){c=x,p(a,c)},render:_,addToRenderList:m}}function px(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,o=!1;function a(y,R,F,k,V){let O=!1;const W=u(k,F,R);r!==W&&(r=W,l(r.object)),O=f(y,k,F,V),O&&g(y,k,F,V),V!==null&&t.update(V,i.ELEMENT_ARRAY_BUFFER),(O||o)&&(o=!1,v(y,R,F,k),V!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(V).buffer))}function c(){return i.createVertexArray()}function l(y){return i.bindVertexArray(y)}function h(y){return i.deleteVertexArray(y)}function u(y,R,F){const k=F.wireframe===!0;let V=n[y.id];V===void 0&&(V={},n[y.id]=V);let O=V[R.id];O===void 0&&(O={},V[R.id]=O);let W=O[k];return W===void 0&&(W=d(c()),O[k]=W),W}function d(y){const R=[],F=[],k=[];for(let V=0;V<e;V++)R[V]=0,F[V]=0,k[V]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:R,enabledAttributes:F,attributeDivisors:k,object:y,attributes:{},index:null}}function f(y,R,F,k){const V=r.attributes,O=R.attributes;let W=0;const K=F.getAttributes();for(const G in K)if(K[G].location>=0){const rt=V[G];let _t=O[G];if(_t===void 0&&(G==="instanceMatrix"&&y.instanceMatrix&&(_t=y.instanceMatrix),G==="instanceColor"&&y.instanceColor&&(_t=y.instanceColor)),rt===void 0||rt.attribute!==_t||_t&&rt.data!==_t.data)return!0;W++}return r.attributesNum!==W||r.index!==k}function g(y,R,F,k){const V={},O=R.attributes;let W=0;const K=F.getAttributes();for(const G in K)if(K[G].location>=0){let rt=O[G];rt===void 0&&(G==="instanceMatrix"&&y.instanceMatrix&&(rt=y.instanceMatrix),G==="instanceColor"&&y.instanceColor&&(rt=y.instanceColor));const _t={};_t.attribute=rt,rt&&rt.data&&(_t.data=rt.data),V[G]=_t,W++}r.attributes=V,r.attributesNum=W,r.index=k}function _(){const y=r.newAttributes;for(let R=0,F=y.length;R<F;R++)y[R]=0}function m(y){p(y,0)}function p(y,R){const F=r.newAttributes,k=r.enabledAttributes,V=r.attributeDivisors;F[y]=1,k[y]===0&&(i.enableVertexAttribArray(y),k[y]=1),V[y]!==R&&(i.vertexAttribDivisor(y,R),V[y]=R)}function x(){const y=r.newAttributes,R=r.enabledAttributes;for(let F=0,k=R.length;F<k;F++)R[F]!==y[F]&&(i.disableVertexAttribArray(F),R[F]=0)}function M(y,R,F,k,V,O,W){W===!0?i.vertexAttribIPointer(y,R,F,V,O):i.vertexAttribPointer(y,R,F,k,V,O)}function v(y,R,F,k){_();const V=k.attributes,O=F.getAttributes(),W=R.defaultAttributeValues;for(const K in O){const G=O[K];if(G.location>=0){let nt=V[K];if(nt===void 0&&(K==="instanceMatrix"&&y.instanceMatrix&&(nt=y.instanceMatrix),K==="instanceColor"&&y.instanceColor&&(nt=y.instanceColor)),nt!==void 0){const rt=nt.normalized,_t=nt.itemSize,Lt=t.get(nt);if(Lt===void 0)continue;const Qt=Lt.buffer,$=Lt.type,Q=Lt.bytesPerElement,vt=$===i.INT||$===i.UNSIGNED_INT||nt.gpuType===Xl;if(nt.isInterleavedBufferAttribute){const st=nt.data,Tt=st.stride,Rt=nt.offset;if(st.isInstancedInterleavedBuffer){for(let Bt=0;Bt<G.locationSize;Bt++)p(G.location+Bt,st.meshPerAttribute);y.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=st.meshPerAttribute*st.count)}else for(let Bt=0;Bt<G.locationSize;Bt++)m(G.location+Bt);i.bindBuffer(i.ARRAY_BUFFER,Qt);for(let Bt=0;Bt<G.locationSize;Bt++)M(G.location+Bt,_t/G.locationSize,$,rt,Tt*Q,(Rt+_t/G.locationSize*Bt)*Q,vt)}else{if(nt.isInstancedBufferAttribute){for(let st=0;st<G.locationSize;st++)p(G.location+st,nt.meshPerAttribute);y.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=nt.meshPerAttribute*nt.count)}else for(let st=0;st<G.locationSize;st++)m(G.location+st);i.bindBuffer(i.ARRAY_BUFFER,Qt);for(let st=0;st<G.locationSize;st++)M(G.location+st,_t/G.locationSize,$,rt,_t*Q,_t/G.locationSize*st*Q,vt)}}else if(W!==void 0){const rt=W[K];if(rt!==void 0)switch(rt.length){case 2:i.vertexAttrib2fv(G.location,rt);break;case 3:i.vertexAttrib3fv(G.location,rt);break;case 4:i.vertexAttrib4fv(G.location,rt);break;default:i.vertexAttrib1fv(G.location,rt)}}}}x()}function L(){T();for(const y in n){const R=n[y];for(const F in R){const k=R[F];for(const V in k)h(k[V].object),delete k[V];delete R[F]}delete n[y]}}function w(y){if(n[y.id]===void 0)return;const R=n[y.id];for(const F in R){const k=R[F];for(const V in k)h(k[V].object),delete k[V];delete R[F]}delete n[y.id]}function A(y){for(const R in n){const F=n[R];if(F[y.id]===void 0)continue;const k=F[y.id];for(const V in k)h(k[V].object),delete k[V];delete F[y.id]}}function T(){S(),o=!0,r!==s&&(r=s,l(r.object))}function S(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:T,resetDefaultState:S,dispose:L,releaseStatesOfGeometry:w,releaseStatesOfProgram:A,initAttributes:_,enableAttribute:m,disableUnusedAttributes:x}}function mx(i,t,e){let n;function s(l){n=l}function r(l,h){i.drawArrays(n,l,h),e.update(h,n,1)}function o(l,h,u){u!==0&&(i.drawArraysInstanced(n,l,h,u),e.update(h,n,u))}function a(l,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,h,0,u);let f=0;for(let g=0;g<u;g++)f+=h[g];e.update(f,n,1)}function c(l,h,u,d){if(u===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let g=0;g<l.length;g++)o(l[g],h[g],d[g]);else{f.multiDrawArraysInstancedWEBGL(n,l,0,h,0,d,0,u);let g=0;for(let _=0;_<u;_++)g+=h[_]*d[_];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=c}function gx(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const A=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(A){return!(A!==Sn&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(A){const T=A===Ar&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(A!==jn&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&A!==wn&&!T)}function c(A){if(A==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=e.precision!==void 0?e.precision:"highp";const h=c(l);h!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),x=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),M=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),L=g>0,w=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:x,maxVaryings:M,maxFragmentUniforms:v,vertexTextures:L,maxSamples:w}}function _x(i){const t=this;let e=null,n=0,s=!1,r=!1;const o=new Ii,a=new zt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){const g=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,p=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):l();else{const x=r?0:n,M=x*4;let v=p.clippingState||null;c.value=v,v=h(g,d,M,f);for(let L=0;L!==M;++L)v[L]=e[L];p.clippingState=v,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=x}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,g){const _=u!==null?u.length:0;let m=null;if(_!==0){if(m=c.value,g!==!0||m===null){const p=f+_*4,x=d.matrixWorldInverse;a.getNormalMatrix(x),(m===null||m.length<p)&&(m=new Float32Array(p));for(let M=0,v=f;M!==_;++M,v+=4)o.copy(u[M]).applyMatrix4(x,a),o.normal.toArray(m,v),m[v+3]=o.constant}c.value=m,c.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function vx(i){let t=new WeakMap;function e(o,a){return a===Tc?o.mapping=Os:a===Cc&&(o.mapping=ks),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Tc||a===Cc)if(t.has(o)){const c=t.get(o).texture;return e(c,o.mapping)}else{const c=o.image;if(c&&c.height>0){const l=new R0(c.height);return l.fromEquirectangularTexture(i,o),t.set(o,l),o.addEventListener("dispose",s),e(l.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const c=t.get(a);c!==void 0&&(t.delete(a),c.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Tf extends Mf{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,o=n+t,a=s+e,c=s-e;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,o=r+l*this.view.width,a-=h*this.view.offsetY,c=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Es=4,gu=[.125,.215,.35,.446,.526,.582],Ni=20,Ua=new Tf,_u=new Ft;let Na=null,Oa=0,ka=0,za=!1;const Di=(1+Math.sqrt(5))/2,fs=1/Di,vu=[new P(-Di,fs,0),new P(Di,fs,0),new P(-fs,0,Di),new P(fs,0,Di),new P(0,Di,-fs),new P(0,Di,fs),new P(-1,1,-1),new P(1,1,-1),new P(-1,1,1),new P(1,1,1)];class xu{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){Na=this._renderer.getRenderTarget(),Oa=this._renderer.getActiveCubeFace(),ka=this._renderer.getActiveMipmapLevel(),za=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Mu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Su(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Na,Oa,ka),this._renderer.xr.enabled=za,t.scissorTest=!1,to(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Os||t.mapping===ks?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Na=this._renderer.getRenderTarget(),Oa=this._renderer.getActiveCubeFace(),ka=this._renderer.getActiveMipmapLevel(),za=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:yn,minFilter:yn,generateMipmaps:!1,type:Ar,format:Sn,colorSpace:Vs,depthBuffer:!1},s=yu(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=yu(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=xx(r)),this._blurMaterial=yx(r,t,e)}return s}_compileMaterial(t){const e=new ie(this._lodPlanes[0],t);this._renderer.compile(e,Ua)}_sceneToCubeUV(t,e,n,s){const a=new ln(90,1,e,n),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(_u),h.toneMapping=pi,h.autoClear=!1;const f=new mi({name:"PMREM.Background",side:je,depthWrite:!1,depthTest:!1}),g=new ie(new cn,f);let _=!1;const m=t.background;m?m.isColor&&(f.color.copy(m),t.background=null,_=!0):(f.color.copy(_u),_=!0);for(let p=0;p<6;p++){const x=p%3;x===0?(a.up.set(0,c[p],0),a.lookAt(l[p],0,0)):x===1?(a.up.set(0,0,c[p]),a.lookAt(0,l[p],0)):(a.up.set(0,c[p],0),a.lookAt(0,0,l[p]));const M=this._cubeSize;to(s,x*M,p>2?M:0,M,M),h.setRenderTarget(s),_&&h.render(g,a),h.render(t,a)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===Os||t.mapping===ks;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Mu()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Su());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new ie(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=t;const c=this._cubeSize;to(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(o,Ua)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=vu[(s-r-1)%vu.length];this._blur(t,r-1,r,o,a)}e.autoClear=n}_blur(t,e,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,s,"latitudinal",r),this._halfBlur(o,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,o,a){const c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ie(this._lodPlanes[s],l),d=l.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*Ni-1),_=r/g,m=isFinite(r)?1+Math.floor(h*_):Ni;m>Ni&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Ni}`);const p=[];let x=0;for(let A=0;A<Ni;++A){const T=A/_,S=Math.exp(-T*T/2);p.push(S),A===0?x+=S:A<m&&(x+=2*S)}for(let A=0;A<p.length;A++)p[A]=p[A]/x;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);const{_lodMax:M}=this;d.dTheta.value=g,d.mipInt.value=M-n;const v=this._sizeLods[s],L=3*v*(s>M-Es?s-M+Es:0),w=4*(this._cubeSize-v);to(e,L,w,3*v,2*v),c.setRenderTarget(e),c.render(u,Ua)}}function xx(i){const t=[],e=[],n=[];let s=i;const r=i-Es+1+gu.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);e.push(a);let c=1/a;o>i-Es?c=gu[o-i+Es-1]:o===0&&(c=0),n.push(c);const l=1/(a-2),h=-l,u=1+l,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,g=6,_=3,m=2,p=1,x=new Float32Array(_*g*f),M=new Float32Array(m*g*f),v=new Float32Array(p*g*f);for(let w=0;w<f;w++){const A=w%3*2/3-1,T=w>2?0:-1,S=[A,T,0,A+2/3,T,0,A+2/3,T+1,0,A,T,0,A+2/3,T+1,0,A,T+1,0];x.set(S,_*g*w),M.set(d,m*g*w);const y=[w,w,w,w,w,w];v.set(y,p*g*w)}const L=new Ie;L.setAttribute("position",new en(x,_)),L.setAttribute("uv",new en(M,m)),L.setAttribute("faceIndex",new en(v,p)),t.push(L),s>Es&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function yu(i,t,e){const n=new Wi(i,t,e);return n.texture.mapping=Qo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function to(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function yx(i,t,e){const n=new Float32Array(Ni),s=new P(0,1,0);return new Kn({name:"SphericalGaussianBlur",defines:{n:Ni,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:nh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:fi,depthTest:!1,depthWrite:!1})}function Su(){return new Kn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:nh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:fi,depthTest:!1,depthWrite:!1})}function Mu(){return new Kn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:nh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:fi,depthTest:!1,depthWrite:!1})}function nh(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Sx(i){let t=new WeakMap,e=null;function n(a){if(a&&a.isTexture){const c=a.mapping,l=c===Tc||c===Cc,h=c===Os||c===ks;if(l||h){let u=t.get(a);const d=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return e===null&&(e=new xu(i)),u=l?e.fromEquirectangular(a,u):e.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),u.texture;if(u!==void 0)return u.texture;{const f=a.image;return l&&f&&f.height>0||h&&f&&s(f)?(e===null&&(e=new xu(i)),u=l?e.fromEquirectangular(a):e.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function s(a){let c=0;const l=6;for(let h=0;h<l;h++)a[h]!==void 0&&c++;return c===l}function r(a){const c=a.target;c.removeEventListener("dispose",r);const l=t.get(c);l!==void 0&&(t.delete(c),l.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:o}}function Mx(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&sr("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function bx(i,t,e,n){const s={},r=new WeakMap;function o(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const _=d.morphAttributes[g];for(let m=0,p=_.length;m<p;m++)t.remove(_[m])}d.removeEventListener("dispose",o),delete s[d.id];const f=r.get(d);f&&(t.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(u,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,e.memory.geometries++),d}function c(u){const d=u.attributes;for(const g in d)t.update(d[g],i.ARRAY_BUFFER);const f=u.morphAttributes;for(const g in f){const _=f[g];for(let m=0,p=_.length;m<p;m++)t.update(_[m],i.ARRAY_BUFFER)}}function l(u){const d=[],f=u.index,g=u.attributes.position;let _=0;if(f!==null){const x=f.array;_=f.version;for(let M=0,v=x.length;M<v;M+=3){const L=x[M+0],w=x[M+1],A=x[M+2];d.push(L,w,w,A,A,L)}}else if(g!==void 0){const x=g.array;_=g.version;for(let M=0,v=x.length/3-1;M<v;M+=3){const L=M+0,w=M+1,A=M+2;d.push(L,w,w,A,A,L)}}else return;const m=new(ff(d)?yf:xf)(d,1);m.version=_;const p=r.get(u);p&&t.remove(p),r.set(u,m)}function h(u){const d=r.get(u);if(d){const f=u.index;f!==null&&d.version<f.version&&l(u)}else l(u);return r.get(u)}return{get:a,update:c,getWireframeAttribute:h}}function Ex(i,t,e){let n;function s(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function c(d,f){i.drawElements(n,f,r,d*o),e.update(f,n,1)}function l(d,f,g){g!==0&&(i.drawElementsInstanced(n,f,r,d*o,g),e.update(f,n,g))}function h(d,f,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,r,d,0,g);let m=0;for(let p=0;p<g;p++)m+=f[p];e.update(m,n,1)}function u(d,f,g,_){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)l(d[p]/o,f[p],_[p]);else{m.multiDrawElementsInstancedWEBGL(n,f,0,r,d,0,_,0,g);let p=0;for(let x=0;x<g;x++)p+=f[x]*_[x];e.update(p,n,1)}}this.setMode=s,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Tx(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Cx(i,t,e){const n=new WeakMap,s=new re;function r(o,a,c){const l=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(a);if(d===void 0||d.count!==u){let y=function(){T.dispose(),n.delete(a),a.removeEventListener("dispose",y)};var f=y;d!==void 0&&d.texture.dispose();const g=a.morphAttributes.position!==void 0,_=a.morphAttributes.normal!==void 0,m=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],x=a.morphAttributes.normal||[],M=a.morphAttributes.color||[];let v=0;g===!0&&(v=1),_===!0&&(v=2),m===!0&&(v=3);let L=a.attributes.position.count*v,w=1;L>t.maxTextureSize&&(w=Math.ceil(L/t.maxTextureSize),L=t.maxTextureSize);const A=new Float32Array(L*w*4*u),T=new mf(A,L,w,u);T.type=wn,T.needsUpdate=!0;const S=v*4;for(let R=0;R<u;R++){const F=p[R],k=x[R],V=M[R],O=L*w*4*R;for(let W=0;W<F.count;W++){const K=W*S;g===!0&&(s.fromBufferAttribute(F,W),A[O+K+0]=s.x,A[O+K+1]=s.y,A[O+K+2]=s.z,A[O+K+3]=0),_===!0&&(s.fromBufferAttribute(k,W),A[O+K+4]=s.x,A[O+K+5]=s.y,A[O+K+6]=s.z,A[O+K+7]=0),m===!0&&(s.fromBufferAttribute(V,W),A[O+K+8]=s.x,A[O+K+9]=s.y,A[O+K+10]=s.z,A[O+K+11]=V.itemSize===4?s.w:1)}}d={count:u,texture:T,size:new ct(L,w)},n.set(a,d),a.addEventListener("dispose",y)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let g=0;for(let m=0;m<l.length;m++)g+=l[m];const _=a.morphTargetsRelative?1:1-g;c.getUniforms().setValue(i,"morphTargetBaseInfluence",_),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),c.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Ax(i,t,e,n){let s=new WeakMap;function r(c){const l=n.render.frame,h=c.geometry,u=t.get(c,h);if(s.get(u)!==l&&(t.update(u),s.set(u,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),s.get(c)!==l&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),s.set(c,l))),c.isSkinnedMesh){const d=c.skeleton;s.get(d)!==l&&(d.update(),s.set(d,l))}return u}function o(){s=new WeakMap}function a(c){const l=c.target;l.removeEventListener("dispose",a),e.remove(l.instanceMatrix),l.instanceColor!==null&&e.remove(l.instanceColor)}return{update:r,dispose:o}}class Cf extends ze{constructor(t,e,n,s,r,o,a,c,l,h=Cs){if(h!==Cs&&h!==Fs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Cs&&(n=Gi),n===void 0&&h===Fs&&(n=zs),super(null,s,r,o,a,c,h,n,l),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:tn,this.minFilter=c!==void 0?c:tn,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Af=new ze,bu=new Cf(1,1),wf=new mf,Rf=new p0,Pf=new bf,Eu=[],Tu=[],Cu=new Float32Array(16),Au=new Float32Array(9),wu=new Float32Array(4);function Ws(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Eu[s];if(r===void 0&&(r=new Float32Array(s),Eu[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function be(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ee(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function ea(i,t){let e=Tu[t];e===void 0&&(e=new Int32Array(t),Tu[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function wx(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Rx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;i.uniform2fv(this.addr,t),Ee(e,t)}}function Px(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(be(e,t))return;i.uniform3fv(this.addr,t),Ee(e,t)}}function Lx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;i.uniform4fv(this.addr,t),Ee(e,t)}}function Ix(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(be(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ee(e,t)}else{if(be(e,n))return;wu.set(n),i.uniformMatrix2fv(this.addr,!1,wu),Ee(e,n)}}function Dx(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(be(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ee(e,t)}else{if(be(e,n))return;Au.set(n),i.uniformMatrix3fv(this.addr,!1,Au),Ee(e,n)}}function Ux(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(be(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ee(e,t)}else{if(be(e,n))return;Cu.set(n),i.uniformMatrix4fv(this.addr,!1,Cu),Ee(e,n)}}function Nx(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Ox(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;i.uniform2iv(this.addr,t),Ee(e,t)}}function kx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(be(e,t))return;i.uniform3iv(this.addr,t),Ee(e,t)}}function zx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;i.uniform4iv(this.addr,t),Ee(e,t)}}function Fx(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Bx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;i.uniform2uiv(this.addr,t),Ee(e,t)}}function Hx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(be(e,t))return;i.uniform3uiv(this.addr,t),Ee(e,t)}}function Vx(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;i.uniform4uiv(this.addr,t),Ee(e,t)}}function Gx(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(bu.compareFunction=df,r=bu):r=Af,e.setTexture2D(t||r,s)}function Wx(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Rf,s)}function Xx(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Pf,s)}function $x(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||wf,s)}function Yx(i){switch(i){case 5126:return wx;case 35664:return Rx;case 35665:return Px;case 35666:return Lx;case 35674:return Ix;case 35675:return Dx;case 35676:return Ux;case 5124:case 35670:return Nx;case 35667:case 35671:return Ox;case 35668:case 35672:return kx;case 35669:case 35673:return zx;case 5125:return Fx;case 36294:return Bx;case 36295:return Hx;case 36296:return Vx;case 35678:case 36198:case 36298:case 36306:case 35682:return Gx;case 35679:case 36299:case 36307:return Wx;case 35680:case 36300:case 36308:case 36293:return Xx;case 36289:case 36303:case 36311:case 36292:return $x}}function qx(i,t){i.uniform1fv(this.addr,t)}function jx(i,t){const e=Ws(t,this.size,2);i.uniform2fv(this.addr,e)}function Kx(i,t){const e=Ws(t,this.size,3);i.uniform3fv(this.addr,e)}function Zx(i,t){const e=Ws(t,this.size,4);i.uniform4fv(this.addr,e)}function Jx(i,t){const e=Ws(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function Qx(i,t){const e=Ws(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function ty(i,t){const e=Ws(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function ey(i,t){i.uniform1iv(this.addr,t)}function ny(i,t){i.uniform2iv(this.addr,t)}function iy(i,t){i.uniform3iv(this.addr,t)}function sy(i,t){i.uniform4iv(this.addr,t)}function ry(i,t){i.uniform1uiv(this.addr,t)}function oy(i,t){i.uniform2uiv(this.addr,t)}function ay(i,t){i.uniform3uiv(this.addr,t)}function cy(i,t){i.uniform4uiv(this.addr,t)}function ly(i,t,e){const n=this.cache,s=t.length,r=ea(e,s);be(n,r)||(i.uniform1iv(this.addr,r),Ee(n,r));for(let o=0;o!==s;++o)e.setTexture2D(t[o]||Af,r[o])}function hy(i,t,e){const n=this.cache,s=t.length,r=ea(e,s);be(n,r)||(i.uniform1iv(this.addr,r),Ee(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||Rf,r[o])}function uy(i,t,e){const n=this.cache,s=t.length,r=ea(e,s);be(n,r)||(i.uniform1iv(this.addr,r),Ee(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||Pf,r[o])}function dy(i,t,e){const n=this.cache,s=t.length,r=ea(e,s);be(n,r)||(i.uniform1iv(this.addr,r),Ee(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||wf,r[o])}function fy(i){switch(i){case 5126:return qx;case 35664:return jx;case 35665:return Kx;case 35666:return Zx;case 35674:return Jx;case 35675:return Qx;case 35676:return ty;case 5124:case 35670:return ey;case 35667:case 35671:return ny;case 35668:case 35672:return iy;case 35669:case 35673:return sy;case 5125:return ry;case 36294:return oy;case 36295:return ay;case 36296:return cy;case 35678:case 36198:case 36298:case 36306:case 35682:return ly;case 35679:case 36299:case 36307:return hy;case 35680:case 36300:case 36308:case 36293:return uy;case 36289:case 36303:case 36311:case 36292:return dy}}class py{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Yx(e.type)}}class my{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=fy(e.type)}}class gy{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(t,e[a.id],n)}}}const Fa=/(\w+)(\])?(\[|\.)?/g;function Ru(i,t){i.seq.push(t),i.map[t.id]=t}function _y(i,t,e){const n=i.name,s=n.length;for(Fa.lastIndex=0;;){const r=Fa.exec(n),o=Fa.lastIndex;let a=r[1];const c=r[2]==="]",l=r[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===s){Ru(e,l===void 0?new py(a,i,t):new my(a,i,t));break}else{let u=e.map[a];u===void 0&&(u=new gy(a),Ru(e,u)),e=u}}}class bo{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),o=t.getUniformLocation(e,r.name);_y(r,o,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){const a=e[r],c=n[a.id];c.needsUpdate!==!1&&a.setValue(t,c.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const o=t[s];o.id in e&&n.push(o)}return n}}function Pu(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const vy=37297;let xy=0;function yy(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}const Lu=new zt;function Sy(i){Yt._getMatrix(Lu,Yt.workingColorSpace,i);const t=`mat3( ${Lu.elements.map(e=>e.toFixed(4))} )`;switch(Yt.getTransfer(i)){case ta:return[t,"LinearTransferOETF"];case se:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Iu(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const o=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+yy(i.getShaderSource(t),o)}else return s}function My(i,t){const e=Sy(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function by(i,t){let e;switch(t){case Cg:e="Linear";break;case Ag:e="Reinhard";break;case wg:e="Cineon";break;case tf:e="ACESFilmic";break;case Pg:e="AgX";break;case Lg:e="Neutral";break;case Rg:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const eo=new P;function Ey(){Yt.getLuminanceCoefficients(eo);const i=eo.x.toFixed(4),t=eo.y.toFixed(4),e=eo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Ty(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(rr).join(`
`)}function Cy(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Ay(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function rr(i){return i!==""}function Du(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Uu(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const wy=/^[ \t]*#include +<([\w\d./]+)>/gm;function nl(i){return i.replace(wy,Py)}const Ry=new Map;function Py(i,t){let e=Vt[t];if(e===void 0){const n=Ry.get(t);if(n!==void 0)e=Vt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return nl(e)}const Ly=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Nu(i){return i.replace(Ly,Iy)}function Iy(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Ou(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Dy(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Jd?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===Qd?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===Hn&&(t="SHADOWMAP_TYPE_VSM"),t}function Uy(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Os:case ks:t="ENVMAP_TYPE_CUBE";break;case Qo:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Ny(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case ks:t="ENVMAP_MODE_REFRACTION";break}return t}function Oy(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Wl:t="ENVMAP_BLENDING_MULTIPLY";break;case Eg:t="ENVMAP_BLENDING_MIX";break;case Tg:t="ENVMAP_BLENDING_ADD";break}return t}function ky(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function zy(i,t,e,n){const s=i.getContext(),r=e.defines;let o=e.vertexShader,a=e.fragmentShader;const c=Dy(e),l=Uy(e),h=Ny(e),u=Oy(e),d=ky(e),f=Ty(e),g=Cy(r),_=s.createProgram();let m,p,x=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(rr).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(rr).join(`
`),p.length>0&&(p+=`
`)):(m=[Ou(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(rr).join(`
`),p=[Ou(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==pi?"#define TONE_MAPPING":"",e.toneMapping!==pi?Vt.tonemapping_pars_fragment:"",e.toneMapping!==pi?by("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Vt.colorspace_pars_fragment,My("linearToOutputTexel",e.outputColorSpace),Ey(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(rr).join(`
`)),o=nl(o),o=Du(o,e),o=Uu(o,e),a=nl(a),a=Du(a,e),a=Uu(a,e),o=Nu(o),a=Nu(a),e.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",e.glslVersion===qh?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===qh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const M=x+m+o,v=x+p+a,L=Pu(s,s.VERTEX_SHADER,M),w=Pu(s,s.FRAGMENT_SHADER,v);s.attachShader(_,L),s.attachShader(_,w),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function A(R){if(i.debug.checkShaderErrors){const F=s.getProgramInfoLog(_).trim(),k=s.getShaderInfoLog(L).trim(),V=s.getShaderInfoLog(w).trim();let O=!0,W=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(O=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,L,w);else{const K=Iu(s,L,"vertex"),G=Iu(s,w,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+F+`
`+K+`
`+G)}else F!==""?console.warn("THREE.WebGLProgram: Program Info Log:",F):(k===""||V==="")&&(W=!1);W&&(R.diagnostics={runnable:O,programLog:F,vertexShader:{log:k,prefix:m},fragmentShader:{log:V,prefix:p}})}s.deleteShader(L),s.deleteShader(w),T=new bo(s,_),S=Ay(s,_)}let T;this.getUniforms=function(){return T===void 0&&A(this),T};let S;this.getAttributes=function(){return S===void 0&&A(this),S};let y=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=s.getProgramParameter(_,vy)),y},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=xy++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=L,this.fragmentShader=w,this}let Fy=0;class By{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(t);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Hy(t),e.set(t,n)),n}}class Hy{constructor(t){this.id=Fy++,this.code=t,this.usedTimes=0}}function Vy(i,t,e,n,s,r,o){const a=new _f,c=new By,l=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures;let f=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(S){return l.add(S),S===0?"uv":`uv${S}`}function m(S,y,R,F,k){const V=F.fog,O=k.geometry,W=S.isMeshStandardMaterial?F.environment:null,K=(S.isMeshStandardMaterial?e:t).get(S.envMap||W),G=K&&K.mapping===Qo?K.image.height:null,nt=g[S.type];S.precision!==null&&(f=s.getMaxPrecision(S.precision),f!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",f,"instead."));const rt=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,_t=rt!==void 0?rt.length:0;let Lt=0;O.morphAttributes.position!==void 0&&(Lt=1),O.morphAttributes.normal!==void 0&&(Lt=2),O.morphAttributes.color!==void 0&&(Lt=3);let Qt,$,Q,vt;if(nt){const te=qe[nt];Qt=te.vertexShader,$=te.fragmentShader}else Qt=S.vertexShader,$=S.fragmentShader,c.update(S),Q=c.getVertexShaderID(S),vt=c.getFragmentShaderID(S);const st=i.getRenderTarget(),Tt=i.state.buffers.depth.getReversed(),Rt=k.isInstancedMesh===!0,Bt=k.isBatchedMesh===!0,oe=!!S.map,Ut=!!S.matcap,ue=!!K,N=!!S.aoMap,nn=!!S.lightMap,Gt=!!S.bumpMap,Wt=!!S.normalMap,At=!!S.displacementMap,de=!!S.emissiveMap,Ct=!!S.metalnessMap,C=!!S.roughnessMap,b=S.anisotropy>0,z=S.clearcoat>0,q=S.dispersion>0,Z=S.iridescence>0,Y=S.sheen>0,Mt=S.transmission>0,at=b&&!!S.anisotropyMap,ft=z&&!!S.clearcoatMap,$t=z&&!!S.clearcoatNormalMap,tt=z&&!!S.clearcoatRoughnessMap,pt=Z&&!!S.iridescenceMap,wt=Z&&!!S.iridescenceThicknessMap,Pt=Y&&!!S.sheenColorMap,mt=Y&&!!S.sheenRoughnessMap,Xt=!!S.specularMap,Ht=!!S.specularColorMap,ae=!!S.specularIntensityMap,I=Mt&&!!S.transmissionMap,ot=Mt&&!!S.thicknessMap,X=!!S.gradientMap,j=!!S.alphaMap,ut=S.alphaTest>0,lt=!!S.alphaHash,Ot=!!S.extensions;let ge=pi;S.toneMapped&&(st===null||st.isXRRenderTarget===!0)&&(ge=i.toneMapping);const De={shaderID:nt,shaderType:S.type,shaderName:S.name,vertexShader:Qt,fragmentShader:$,defines:S.defines,customVertexShaderID:Q,customFragmentShaderID:vt,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:f,batching:Bt,batchingColor:Bt&&k._colorsTexture!==null,instancing:Rt,instancingColor:Rt&&k.instanceColor!==null,instancingMorph:Rt&&k.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:st===null?i.outputColorSpace:st.isXRRenderTarget===!0?st.texture.colorSpace:Vs,alphaToCoverage:!!S.alphaToCoverage,map:oe,matcap:Ut,envMap:ue,envMapMode:ue&&K.mapping,envMapCubeUVHeight:G,aoMap:N,lightMap:nn,bumpMap:Gt,normalMap:Wt,displacementMap:d&&At,emissiveMap:de,normalMapObjectSpace:Wt&&S.normalMapType===Ng,normalMapTangentSpace:Wt&&S.normalMapType===Jl,metalnessMap:Ct,roughnessMap:C,anisotropy:b,anisotropyMap:at,clearcoat:z,clearcoatMap:ft,clearcoatNormalMap:$t,clearcoatRoughnessMap:tt,dispersion:q,iridescence:Z,iridescenceMap:pt,iridescenceThicknessMap:wt,sheen:Y,sheenColorMap:Pt,sheenRoughnessMap:mt,specularMap:Xt,specularColorMap:Ht,specularIntensityMap:ae,transmission:Mt,transmissionMap:I,thicknessMap:ot,gradientMap:X,opaque:S.transparent===!1&&S.blending===Ts&&S.alphaToCoverage===!1,alphaMap:j,alphaTest:ut,alphaHash:lt,combine:S.combine,mapUv:oe&&_(S.map.channel),aoMapUv:N&&_(S.aoMap.channel),lightMapUv:nn&&_(S.lightMap.channel),bumpMapUv:Gt&&_(S.bumpMap.channel),normalMapUv:Wt&&_(S.normalMap.channel),displacementMapUv:At&&_(S.displacementMap.channel),emissiveMapUv:de&&_(S.emissiveMap.channel),metalnessMapUv:Ct&&_(S.metalnessMap.channel),roughnessMapUv:C&&_(S.roughnessMap.channel),anisotropyMapUv:at&&_(S.anisotropyMap.channel),clearcoatMapUv:ft&&_(S.clearcoatMap.channel),clearcoatNormalMapUv:$t&&_(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:tt&&_(S.clearcoatRoughnessMap.channel),iridescenceMapUv:pt&&_(S.iridescenceMap.channel),iridescenceThicknessMapUv:wt&&_(S.iridescenceThicknessMap.channel),sheenColorMapUv:Pt&&_(S.sheenColorMap.channel),sheenRoughnessMapUv:mt&&_(S.sheenRoughnessMap.channel),specularMapUv:Xt&&_(S.specularMap.channel),specularColorMapUv:Ht&&_(S.specularColorMap.channel),specularIntensityMapUv:ae&&_(S.specularIntensityMap.channel),transmissionMapUv:I&&_(S.transmissionMap.channel),thicknessMapUv:ot&&_(S.thicknessMap.channel),alphaMapUv:j&&_(S.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(Wt||b),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!O.attributes.uv&&(oe||j),fog:!!V,useFog:S.fog===!0,fogExp2:!!V&&V.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Tt,skinning:k.isSkinnedMesh===!0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:_t,morphTextureStride:Lt,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:S.dithering,shadowMapEnabled:i.shadowMap.enabled&&R.length>0,shadowMapType:i.shadowMap.type,toneMapping:ge,decodeVideoTexture:oe&&S.map.isVideoTexture===!0&&Yt.getTransfer(S.map.colorSpace)===se,decodeVideoTextureEmissive:de&&S.emissiveMap.isVideoTexture===!0&&Yt.getTransfer(S.emissiveMap.colorSpace)===se,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===vn,flipSided:S.side===je,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:Ot&&S.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ot&&S.extensions.multiDraw===!0||Bt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return De.vertexUv1s=l.has(1),De.vertexUv2s=l.has(2),De.vertexUv3s=l.has(3),l.clear(),De}function p(S){const y=[];if(S.shaderID?y.push(S.shaderID):(y.push(S.customVertexShaderID),y.push(S.customFragmentShaderID)),S.defines!==void 0)for(const R in S.defines)y.push(R),y.push(S.defines[R]);return S.isRawShaderMaterial===!1&&(x(y,S),M(y,S),y.push(i.outputColorSpace)),y.push(S.customProgramCacheKey),y.join()}function x(S,y){S.push(y.precision),S.push(y.outputColorSpace),S.push(y.envMapMode),S.push(y.envMapCubeUVHeight),S.push(y.mapUv),S.push(y.alphaMapUv),S.push(y.lightMapUv),S.push(y.aoMapUv),S.push(y.bumpMapUv),S.push(y.normalMapUv),S.push(y.displacementMapUv),S.push(y.emissiveMapUv),S.push(y.metalnessMapUv),S.push(y.roughnessMapUv),S.push(y.anisotropyMapUv),S.push(y.clearcoatMapUv),S.push(y.clearcoatNormalMapUv),S.push(y.clearcoatRoughnessMapUv),S.push(y.iridescenceMapUv),S.push(y.iridescenceThicknessMapUv),S.push(y.sheenColorMapUv),S.push(y.sheenRoughnessMapUv),S.push(y.specularMapUv),S.push(y.specularColorMapUv),S.push(y.specularIntensityMapUv),S.push(y.transmissionMapUv),S.push(y.thicknessMapUv),S.push(y.combine),S.push(y.fogExp2),S.push(y.sizeAttenuation),S.push(y.morphTargetsCount),S.push(y.morphAttributeCount),S.push(y.numDirLights),S.push(y.numPointLights),S.push(y.numSpotLights),S.push(y.numSpotLightMaps),S.push(y.numHemiLights),S.push(y.numRectAreaLights),S.push(y.numDirLightShadows),S.push(y.numPointLightShadows),S.push(y.numSpotLightShadows),S.push(y.numSpotLightShadowsWithMaps),S.push(y.numLightProbes),S.push(y.shadowMapType),S.push(y.toneMapping),S.push(y.numClippingPlanes),S.push(y.numClipIntersection),S.push(y.depthPacking)}function M(S,y){a.disableAll(),y.supportsVertexTextures&&a.enable(0),y.instancing&&a.enable(1),y.instancingColor&&a.enable(2),y.instancingMorph&&a.enable(3),y.matcap&&a.enable(4),y.envMap&&a.enable(5),y.normalMapObjectSpace&&a.enable(6),y.normalMapTangentSpace&&a.enable(7),y.clearcoat&&a.enable(8),y.iridescence&&a.enable(9),y.alphaTest&&a.enable(10),y.vertexColors&&a.enable(11),y.vertexAlphas&&a.enable(12),y.vertexUv1s&&a.enable(13),y.vertexUv2s&&a.enable(14),y.vertexUv3s&&a.enable(15),y.vertexTangents&&a.enable(16),y.anisotropy&&a.enable(17),y.alphaHash&&a.enable(18),y.batching&&a.enable(19),y.dispersion&&a.enable(20),y.batchingColor&&a.enable(21),S.push(a.mask),a.disableAll(),y.fog&&a.enable(0),y.useFog&&a.enable(1),y.flatShading&&a.enable(2),y.logarithmicDepthBuffer&&a.enable(3),y.reverseDepthBuffer&&a.enable(4),y.skinning&&a.enable(5),y.morphTargets&&a.enable(6),y.morphNormals&&a.enable(7),y.morphColors&&a.enable(8),y.premultipliedAlpha&&a.enable(9),y.shadowMapEnabled&&a.enable(10),y.doubleSided&&a.enable(11),y.flipSided&&a.enable(12),y.useDepthPacking&&a.enable(13),y.dithering&&a.enable(14),y.transmission&&a.enable(15),y.sheen&&a.enable(16),y.opaque&&a.enable(17),y.pointsUvs&&a.enable(18),y.decodeVideoTexture&&a.enable(19),y.decodeVideoTextureEmissive&&a.enable(20),y.alphaToCoverage&&a.enable(21),S.push(a.mask)}function v(S){const y=g[S.type];let R;if(y){const F=qe[y];R=th.clone(F.uniforms)}else R=S.uniforms;return R}function L(S,y){let R;for(let F=0,k=h.length;F<k;F++){const V=h[F];if(V.cacheKey===y){R=V,++R.usedTimes;break}}return R===void 0&&(R=new zy(i,y,S,r),h.push(R)),R}function w(S){if(--S.usedTimes===0){const y=h.indexOf(S);h[y]=h[h.length-1],h.pop(),S.destroy()}}function A(S){c.remove(S)}function T(){c.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:v,acquireProgram:L,releaseProgram:w,releaseShaderCache:A,programs:h,dispose:T}}function Gy(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,c){i.get(o)[a]=c}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Wy(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function ku(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function zu(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u,d,f,g,_,m){let p=i[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:g,renderOrder:u.renderOrder,z:_,group:m},i[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=g,p.renderOrder=u.renderOrder,p.z=_,p.group=m),t++,p}function a(u,d,f,g,_,m){const p=o(u,d,f,g,_,m);f.transmission>0?n.push(p):f.transparent===!0?s.push(p):e.push(p)}function c(u,d,f,g,_,m){const p=o(u,d,f,g,_,m);f.transmission>0?n.unshift(p):f.transparent===!0?s.unshift(p):e.unshift(p)}function l(u,d){e.length>1&&e.sort(u||Wy),n.length>1&&n.sort(d||ku),s.length>1&&s.sort(d||ku)}function h(){for(let u=t,d=i.length;u<d;u++){const f=i[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:a,unshift:c,finish:h,sort:l}}function Xy(){let i=new WeakMap;function t(n,s){const r=i.get(n);let o;return r===void 0?(o=new zu,i.set(n,[o])):s>=r.length?(o=new zu,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function $y(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new P,color:new Ft};break;case"SpotLight":e={position:new P,direction:new P,color:new Ft,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new P,color:new Ft,distance:0,decay:0};break;case"HemisphereLight":e={direction:new P,skyColor:new Ft,groundColor:new Ft};break;case"RectAreaLight":e={color:new Ft,position:new P,halfWidth:new P,halfHeight:new P};break}return i[t.id]=e,e}}}function Yy(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let qy=0;function jy(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Ky(i){const t=new $y,e=Yy(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new P);const s=new P,r=new qt,o=new qt;function a(l){let h=0,u=0,d=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let f=0,g=0,_=0,m=0,p=0,x=0,M=0,v=0,L=0,w=0,A=0;l.sort(jy);for(let S=0,y=l.length;S<y;S++){const R=l[S],F=R.color,k=R.intensity,V=R.distance,O=R.shadow&&R.shadow.map?R.shadow.map.texture:null;if(R.isAmbientLight)h+=F.r*k,u+=F.g*k,d+=F.b*k;else if(R.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(R.sh.coefficients[W],k);A++}else if(R.isDirectionalLight){const W=t.get(R);if(W.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const K=R.shadow,G=e.get(R);G.shadowIntensity=K.intensity,G.shadowBias=K.bias,G.shadowNormalBias=K.normalBias,G.shadowRadius=K.radius,G.shadowMapSize=K.mapSize,n.directionalShadow[f]=G,n.directionalShadowMap[f]=O,n.directionalShadowMatrix[f]=R.shadow.matrix,x++}n.directional[f]=W,f++}else if(R.isSpotLight){const W=t.get(R);W.position.setFromMatrixPosition(R.matrixWorld),W.color.copy(F).multiplyScalar(k),W.distance=V,W.coneCos=Math.cos(R.angle),W.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),W.decay=R.decay,n.spot[_]=W;const K=R.shadow;if(R.map&&(n.spotLightMap[L]=R.map,L++,K.updateMatrices(R),R.castShadow&&w++),n.spotLightMatrix[_]=K.matrix,R.castShadow){const G=e.get(R);G.shadowIntensity=K.intensity,G.shadowBias=K.bias,G.shadowNormalBias=K.normalBias,G.shadowRadius=K.radius,G.shadowMapSize=K.mapSize,n.spotShadow[_]=G,n.spotShadowMap[_]=O,v++}_++}else if(R.isRectAreaLight){const W=t.get(R);W.color.copy(F).multiplyScalar(k),W.halfWidth.set(R.width*.5,0,0),W.halfHeight.set(0,R.height*.5,0),n.rectArea[m]=W,m++}else if(R.isPointLight){const W=t.get(R);if(W.color.copy(R.color).multiplyScalar(R.intensity),W.distance=R.distance,W.decay=R.decay,R.castShadow){const K=R.shadow,G=e.get(R);G.shadowIntensity=K.intensity,G.shadowBias=K.bias,G.shadowNormalBias=K.normalBias,G.shadowRadius=K.radius,G.shadowMapSize=K.mapSize,G.shadowCameraNear=K.camera.near,G.shadowCameraFar=K.camera.far,n.pointShadow[g]=G,n.pointShadowMap[g]=O,n.pointShadowMatrix[g]=R.shadow.matrix,M++}n.point[g]=W,g++}else if(R.isHemisphereLight){const W=t.get(R);W.skyColor.copy(R.color).multiplyScalar(k),W.groundColor.copy(R.groundColor).multiplyScalar(k),n.hemi[p]=W,p++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=it.LTC_FLOAT_1,n.rectAreaLTC2=it.LTC_FLOAT_2):(n.rectAreaLTC1=it.LTC_HALF_1,n.rectAreaLTC2=it.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const T=n.hash;(T.directionalLength!==f||T.pointLength!==g||T.spotLength!==_||T.rectAreaLength!==m||T.hemiLength!==p||T.numDirectionalShadows!==x||T.numPointShadows!==M||T.numSpotShadows!==v||T.numSpotMaps!==L||T.numLightProbes!==A)&&(n.directional.length=f,n.spot.length=_,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=x,n.directionalShadowMap.length=x,n.pointShadow.length=M,n.pointShadowMap.length=M,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=x,n.pointShadowMatrix.length=M,n.spotLightMatrix.length=v+L-w,n.spotLightMap.length=L,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=A,T.directionalLength=f,T.pointLength=g,T.spotLength=_,T.rectAreaLength=m,T.hemiLength=p,T.numDirectionalShadows=x,T.numPointShadows=M,T.numSpotShadows=v,T.numSpotMaps=L,T.numLightProbes=A,n.version=qy++)}function c(l,h){let u=0,d=0,f=0,g=0,_=0;const m=h.matrixWorldInverse;for(let p=0,x=l.length;p<x;p++){const M=l[p];if(M.isDirectionalLight){const v=n.directional[u];v.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),u++}else if(M.isSpotLight){const v=n.spot[f];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),v.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(m),f++}else if(M.isRectAreaLight){const v=n.rectArea[g];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),o.identity(),r.copy(M.matrixWorld),r.premultiply(m),o.extractRotation(r),v.halfWidth.set(M.width*.5,0,0),v.halfHeight.set(0,M.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),g++}else if(M.isPointLight){const v=n.point[d];v.position.setFromMatrixPosition(M.matrixWorld),v.position.applyMatrix4(m),d++}else if(M.isHemisphereLight){const v=n.hemi[_];v.direction.setFromMatrixPosition(M.matrixWorld),v.direction.transformDirection(m),_++}}}return{setup:a,setupView:c,state:n}}function Fu(i){const t=new Ky(i),e=[],n=[];function s(h){l.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function o(h){n.push(h)}function a(){t.setup(e)}function c(h){t.setupView(e,h)}const l={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:l,setupLights:a,setupLightsView:c,pushLight:r,pushShadow:o}}function Zy(i){let t=new WeakMap;function e(s,r=0){const o=t.get(s);let a;return o===void 0?(a=new Fu(i),t.set(s,[a])):r>=o.length?(a=new Fu(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}class Jy extends yi{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Dg,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Qy extends yi{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const tS=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,eS=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function nS(i,t,e){let n=new eh;const s=new ct,r=new ct,o=new re,a=new Jy({depthPacking:Ug}),c=new Qy,l={},h=e.maxTextureSize,u={[xi]:je,[je]:xi,[vn]:vn},d=new Kn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ct},radius:{value:4}},vertexShader:tS,fragmentShader:eS}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const g=new Ie;g.setAttribute("position",new en(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ie(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Jd;let p=this.type;this.render=function(w,A,T){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||w.length===0)return;const S=i.getRenderTarget(),y=i.getActiveCubeFace(),R=i.getActiveMipmapLevel(),F=i.state;F.setBlending(fi),F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const k=p!==Hn&&this.type===Hn,V=p===Hn&&this.type!==Hn;for(let O=0,W=w.length;O<W;O++){const K=w[O],G=K.shadow;if(G===void 0){console.warn("THREE.WebGLShadowMap:",K,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;s.copy(G.mapSize);const nt=G.getFrameExtents();if(s.multiply(nt),r.copy(G.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/nt.x),s.x=r.x*nt.x,G.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/nt.y),s.y=r.y*nt.y,G.mapSize.y=r.y)),G.map===null||k===!0||V===!0){const _t=this.type!==Hn?{minFilter:tn,magFilter:tn}:{};G.map!==null&&G.map.dispose(),G.map=new Wi(s.x,s.y,_t),G.map.texture.name=K.name+".shadowMap",G.camera.updateProjectionMatrix()}i.setRenderTarget(G.map),i.clear();const rt=G.getViewportCount();for(let _t=0;_t<rt;_t++){const Lt=G.getViewport(_t);o.set(r.x*Lt.x,r.y*Lt.y,r.x*Lt.z,r.y*Lt.w),F.viewport(o),G.updateMatrices(K,_t),n=G.getFrustum(),v(A,T,G.camera,K,this.type)}G.isPointLightShadow!==!0&&this.type===Hn&&x(G,T),G.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(S,y,R)};function x(w,A){const T=t.update(_);d.defines.VSM_SAMPLES!==w.blurSamples&&(d.defines.VSM_SAMPLES=w.blurSamples,f.defines.VSM_SAMPLES=w.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new Wi(s.x,s.y)),d.uniforms.shadow_pass.value=w.map.texture,d.uniforms.resolution.value=w.mapSize,d.uniforms.radius.value=w.radius,i.setRenderTarget(w.mapPass),i.clear(),i.renderBufferDirect(A,null,T,d,_,null),f.uniforms.shadow_pass.value=w.mapPass.texture,f.uniforms.resolution.value=w.mapSize,f.uniforms.radius.value=w.radius,i.setRenderTarget(w.map),i.clear(),i.renderBufferDirect(A,null,T,f,_,null)}function M(w,A,T,S){let y=null;const R=T.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(R!==void 0)y=R;else if(y=T.isPointLight===!0?c:a,i.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0){const F=y.uuid,k=A.uuid;let V=l[F];V===void 0&&(V={},l[F]=V);let O=V[k];O===void 0&&(O=y.clone(),V[k]=O,A.addEventListener("dispose",L)),y=O}if(y.visible=A.visible,y.wireframe=A.wireframe,S===Hn?y.side=A.shadowSide!==null?A.shadowSide:A.side:y.side=A.shadowSide!==null?A.shadowSide:u[A.side],y.alphaMap=A.alphaMap,y.alphaTest=A.alphaTest,y.map=A.map,y.clipShadows=A.clipShadows,y.clippingPlanes=A.clippingPlanes,y.clipIntersection=A.clipIntersection,y.displacementMap=A.displacementMap,y.displacementScale=A.displacementScale,y.displacementBias=A.displacementBias,y.wireframeLinewidth=A.wireframeLinewidth,y.linewidth=A.linewidth,T.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const F=i.properties.get(y);F.light=T}return y}function v(w,A,T,S,y){if(w.visible===!1)return;if(w.layers.test(A.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&y===Hn)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(T.matrixWorldInverse,w.matrixWorld);const k=t.update(w),V=w.material;if(Array.isArray(V)){const O=k.groups;for(let W=0,K=O.length;W<K;W++){const G=O[W],nt=V[G.materialIndex];if(nt&&nt.visible){const rt=M(w,nt,S,y);w.onBeforeShadow(i,w,A,T,k,rt,G),i.renderBufferDirect(T,null,k,rt,w,G),w.onAfterShadow(i,w,A,T,k,rt,G)}}}else if(V.visible){const O=M(w,V,S,y);w.onBeforeShadow(i,w,A,T,k,O,null),i.renderBufferDirect(T,null,k,O,w,null),w.onAfterShadow(i,w,A,T,k,O,null)}}const F=w.children;for(let k=0,V=F.length;k<V;k++)v(F[k],A,T,S,y)}function L(w){w.target.removeEventListener("dispose",L);for(const T in l){const S=l[T],y=w.target.uuid;y in S&&(S[y].dispose(),delete S[y])}}}const iS={[vc]:xc,[yc]:bc,[Sc]:Ec,[Ns]:Mc,[xc]:vc,[bc]:yc,[Ec]:Sc,[Mc]:Ns};function sS(i,t){function e(){let I=!1;const ot=new re;let X=null;const j=new re(0,0,0,0);return{setMask:function(ut){X!==ut&&!I&&(i.colorMask(ut,ut,ut,ut),X=ut)},setLocked:function(ut){I=ut},setClear:function(ut,lt,Ot,ge,De){De===!0&&(ut*=ge,lt*=ge,Ot*=ge),ot.set(ut,lt,Ot,ge),j.equals(ot)===!1&&(i.clearColor(ut,lt,Ot,ge),j.copy(ot))},reset:function(){I=!1,X=null,j.set(-1,0,0,0)}}}function n(){let I=!1,ot=!1,X=null,j=null,ut=null;return{setReversed:function(lt){if(ot!==lt){const Ot=t.get("EXT_clip_control");ot?Ot.clipControlEXT(Ot.LOWER_LEFT_EXT,Ot.ZERO_TO_ONE_EXT):Ot.clipControlEXT(Ot.LOWER_LEFT_EXT,Ot.NEGATIVE_ONE_TO_ONE_EXT);const ge=ut;ut=null,this.setClear(ge)}ot=lt},getReversed:function(){return ot},setTest:function(lt){lt?st(i.DEPTH_TEST):Tt(i.DEPTH_TEST)},setMask:function(lt){X!==lt&&!I&&(i.depthMask(lt),X=lt)},setFunc:function(lt){if(ot&&(lt=iS[lt]),j!==lt){switch(lt){case vc:i.depthFunc(i.NEVER);break;case xc:i.depthFunc(i.ALWAYS);break;case yc:i.depthFunc(i.LESS);break;case Ns:i.depthFunc(i.LEQUAL);break;case Sc:i.depthFunc(i.EQUAL);break;case Mc:i.depthFunc(i.GEQUAL);break;case bc:i.depthFunc(i.GREATER);break;case Ec:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}j=lt}},setLocked:function(lt){I=lt},setClear:function(lt){ut!==lt&&(ot&&(lt=1-lt),i.clearDepth(lt),ut=lt)},reset:function(){I=!1,X=null,j=null,ut=null,ot=!1}}}function s(){let I=!1,ot=null,X=null,j=null,ut=null,lt=null,Ot=null,ge=null,De=null;return{setTest:function(te){I||(te?st(i.STENCIL_TEST):Tt(i.STENCIL_TEST))},setMask:function(te){ot!==te&&!I&&(i.stencilMask(te),ot=te)},setFunc:function(te,dn,Un){(X!==te||j!==dn||ut!==Un)&&(i.stencilFunc(te,dn,Un),X=te,j=dn,ut=Un)},setOp:function(te,dn,Un){(lt!==te||Ot!==dn||ge!==Un)&&(i.stencilOp(te,dn,Un),lt=te,Ot=dn,ge=Un)},setLocked:function(te){I=te},setClear:function(te){De!==te&&(i.clearStencil(te),De=te)},reset:function(){I=!1,ot=null,X=null,j=null,ut=null,lt=null,Ot=null,ge=null,De=null}}}const r=new e,o=new n,a=new s,c=new WeakMap,l=new WeakMap;let h={},u={},d=new WeakMap,f=[],g=null,_=!1,m=null,p=null,x=null,M=null,v=null,L=null,w=null,A=new Ft(0,0,0),T=0,S=!1,y=null,R=null,F=null,k=null,V=null;const O=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,K=0;const G=i.getParameter(i.VERSION);G.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(G)[1]),W=K>=1):G.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),W=K>=2);let nt=null,rt={};const _t=i.getParameter(i.SCISSOR_BOX),Lt=i.getParameter(i.VIEWPORT),Qt=new re().fromArray(_t),$=new re().fromArray(Lt);function Q(I,ot,X,j){const ut=new Uint8Array(4),lt=i.createTexture();i.bindTexture(I,lt),i.texParameteri(I,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(I,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ot=0;Ot<X;Ot++)I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY?i.texImage3D(ot,0,i.RGBA,1,1,j,0,i.RGBA,i.UNSIGNED_BYTE,ut):i.texImage2D(ot+Ot,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ut);return lt}const vt={};vt[i.TEXTURE_2D]=Q(i.TEXTURE_2D,i.TEXTURE_2D,1),vt[i.TEXTURE_CUBE_MAP]=Q(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),vt[i.TEXTURE_2D_ARRAY]=Q(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),vt[i.TEXTURE_3D]=Q(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),st(i.DEPTH_TEST),o.setFunc(Ns),Gt(!1),Wt(Gh),st(i.CULL_FACE),N(fi);function st(I){h[I]!==!0&&(i.enable(I),h[I]=!0)}function Tt(I){h[I]!==!1&&(i.disable(I),h[I]=!1)}function Rt(I,ot){return u[I]!==ot?(i.bindFramebuffer(I,ot),u[I]=ot,I===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ot),I===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ot),!0):!1}function Bt(I,ot){let X=f,j=!1;if(I){X=d.get(ot),X===void 0&&(X=[],d.set(ot,X));const ut=I.textures;if(X.length!==ut.length||X[0]!==i.COLOR_ATTACHMENT0){for(let lt=0,Ot=ut.length;lt<Ot;lt++)X[lt]=i.COLOR_ATTACHMENT0+lt;X.length=ut.length,j=!0}}else X[0]!==i.BACK&&(X[0]=i.BACK,j=!0);j&&i.drawBuffers(X)}function oe(I){return g!==I?(i.useProgram(I),g=I,!0):!1}const Ut={[Ui]:i.FUNC_ADD,[ag]:i.FUNC_SUBTRACT,[cg]:i.FUNC_REVERSE_SUBTRACT};Ut[lg]=i.MIN,Ut[hg]=i.MAX;const ue={[ug]:i.ZERO,[dg]:i.ONE,[fg]:i.SRC_COLOR,[gc]:i.SRC_ALPHA,[xg]:i.SRC_ALPHA_SATURATE,[_g]:i.DST_COLOR,[mg]:i.DST_ALPHA,[pg]:i.ONE_MINUS_SRC_COLOR,[_c]:i.ONE_MINUS_SRC_ALPHA,[vg]:i.ONE_MINUS_DST_COLOR,[gg]:i.ONE_MINUS_DST_ALPHA,[yg]:i.CONSTANT_COLOR,[Sg]:i.ONE_MINUS_CONSTANT_COLOR,[Mg]:i.CONSTANT_ALPHA,[bg]:i.ONE_MINUS_CONSTANT_ALPHA};function N(I,ot,X,j,ut,lt,Ot,ge,De,te){if(I===fi){_===!0&&(Tt(i.BLEND),_=!1);return}if(_===!1&&(st(i.BLEND),_=!0),I!==og){if(I!==m||te!==S){if((p!==Ui||v!==Ui)&&(i.blendEquation(i.FUNC_ADD),p=Ui,v=Ui),te)switch(I){case Ts:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case mc:i.blendFunc(i.ONE,i.ONE);break;case Wh:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Xh:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case Ts:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case mc:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case Wh:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Xh:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}x=null,M=null,L=null,w=null,A.set(0,0,0),T=0,m=I,S=te}return}ut=ut||ot,lt=lt||X,Ot=Ot||j,(ot!==p||ut!==v)&&(i.blendEquationSeparate(Ut[ot],Ut[ut]),p=ot,v=ut),(X!==x||j!==M||lt!==L||Ot!==w)&&(i.blendFuncSeparate(ue[X],ue[j],ue[lt],ue[Ot]),x=X,M=j,L=lt,w=Ot),(ge.equals(A)===!1||De!==T)&&(i.blendColor(ge.r,ge.g,ge.b,De),A.copy(ge),T=De),m=I,S=!1}function nn(I,ot){I.side===vn?Tt(i.CULL_FACE):st(i.CULL_FACE);let X=I.side===je;ot&&(X=!X),Gt(X),I.blending===Ts&&I.transparent===!1?N(fi):N(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),o.setFunc(I.depthFunc),o.setTest(I.depthTest),o.setMask(I.depthWrite),r.setMask(I.colorWrite);const j=I.stencilWrite;a.setTest(j),j&&(a.setMask(I.stencilWriteMask),a.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),a.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),de(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?st(i.SAMPLE_ALPHA_TO_COVERAGE):Tt(i.SAMPLE_ALPHA_TO_COVERAGE)}function Gt(I){y!==I&&(I?i.frontFace(i.CW):i.frontFace(i.CCW),y=I)}function Wt(I){I!==sg?(st(i.CULL_FACE),I!==R&&(I===Gh?i.cullFace(i.BACK):I===rg?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Tt(i.CULL_FACE),R=I}function At(I){I!==F&&(W&&i.lineWidth(I),F=I)}function de(I,ot,X){I?(st(i.POLYGON_OFFSET_FILL),(k!==ot||V!==X)&&(i.polygonOffset(ot,X),k=ot,V=X)):Tt(i.POLYGON_OFFSET_FILL)}function Ct(I){I?st(i.SCISSOR_TEST):Tt(i.SCISSOR_TEST)}function C(I){I===void 0&&(I=i.TEXTURE0+O-1),nt!==I&&(i.activeTexture(I),nt=I)}function b(I,ot,X){X===void 0&&(nt===null?X=i.TEXTURE0+O-1:X=nt);let j=rt[X];j===void 0&&(j={type:void 0,texture:void 0},rt[X]=j),(j.type!==I||j.texture!==ot)&&(nt!==X&&(i.activeTexture(X),nt=X),i.bindTexture(I,ot||vt[I]),j.type=I,j.texture=ot)}function z(){const I=rt[nt];I!==void 0&&I.type!==void 0&&(i.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function q(){try{i.compressedTexImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Z(){try{i.compressedTexImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Y(){try{i.texSubImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Mt(){try{i.texSubImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function at(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ft(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function $t(){try{i.texStorage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function tt(){try{i.texStorage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function pt(){try{i.texImage2D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function wt(){try{i.texImage3D.apply(i,arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Pt(I){Qt.equals(I)===!1&&(i.scissor(I.x,I.y,I.z,I.w),Qt.copy(I))}function mt(I){$.equals(I)===!1&&(i.viewport(I.x,I.y,I.z,I.w),$.copy(I))}function Xt(I,ot){let X=l.get(ot);X===void 0&&(X=new WeakMap,l.set(ot,X));let j=X.get(I);j===void 0&&(j=i.getUniformBlockIndex(ot,I.name),X.set(I,j))}function Ht(I,ot){const j=l.get(ot).get(I);c.get(ot)!==j&&(i.uniformBlockBinding(ot,j,I.__bindingPointIndex),c.set(ot,j))}function ae(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},nt=null,rt={},u={},d=new WeakMap,f=[],g=null,_=!1,m=null,p=null,x=null,M=null,v=null,L=null,w=null,A=new Ft(0,0,0),T=0,S=!1,y=null,R=null,F=null,k=null,V=null,Qt.set(0,0,i.canvas.width,i.canvas.height),$.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:st,disable:Tt,bindFramebuffer:Rt,drawBuffers:Bt,useProgram:oe,setBlending:N,setMaterial:nn,setFlipSided:Gt,setCullFace:Wt,setLineWidth:At,setPolygonOffset:de,setScissorTest:Ct,activeTexture:C,bindTexture:b,unbindTexture:z,compressedTexImage2D:q,compressedTexImage3D:Z,texImage2D:pt,texImage3D:wt,updateUBOMapping:Xt,uniformBlockBinding:Ht,texStorage2D:$t,texStorage3D:tt,texSubImage2D:Y,texSubImage3D:Mt,compressedTexSubImage2D:at,compressedTexSubImage3D:ft,scissor:Pt,viewport:mt,reset:ae}}function Bu(i,t,e,n){const s=rS(n);switch(e){case of:return i*t;case cf:return i*t;case lf:return i*t*2;case ql:return i*t/s.components*s.byteLength;case jl:return i*t/s.components*s.byteLength;case hf:return i*t*2/s.components*s.byteLength;case Kl:return i*t*2/s.components*s.byteLength;case af:return i*t*3/s.components*s.byteLength;case Sn:return i*t*4/s.components*s.byteLength;case Zl:return i*t*4/s.components*s.byteLength;case vo:case xo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case yo:case So:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Pc:case Ic:return Math.max(i,16)*Math.max(t,8)/4;case Rc:case Lc:return Math.max(i,8)*Math.max(t,8)/2;case Dc:case Uc:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Nc:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Oc:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case kc:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case zc:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Fc:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Bc:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Hc:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case Vc:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Gc:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case Wc:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Xc:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case $c:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Yc:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case qc:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case jc:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Mo:case Kc:case Zc:return Math.ceil(i/4)*Math.ceil(t/4)*16;case uf:case Jc:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Qc:case tl:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function rS(i){switch(i){case jn:case nf:return{byteLength:1,components:1};case Sr:case sf:case Ar:return{byteLength:2,components:1};case $l:case Yl:return{byteLength:2,components:4};case Gi:case Xl:case wn:return{byteLength:4,components:1};case rf:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function oS(i,t,e,n,s,r,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new ct,h=new WeakMap;let u;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(C,b){return f?new OffscreenCanvas(C,b):zo("canvas")}function _(C,b,z){let q=1;const Z=Ct(C);if((Z.width>z||Z.height>z)&&(q=z/Math.max(Z.width,Z.height)),q<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){const Y=Math.floor(q*Z.width),Mt=Math.floor(q*Z.height);u===void 0&&(u=g(Y,Mt));const at=b?g(Y,Mt):u;return at.width=Y,at.height=Mt,at.getContext("2d").drawImage(C,0,0,Y,Mt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+Y+"x"+Mt+")."),at}else return"data"in C&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),C;return C}function m(C){return C.generateMipmaps}function p(C){i.generateMipmap(C)}function x(C){return C.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:C.isWebGL3DRenderTarget?i.TEXTURE_3D:C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(C,b,z,q,Z=!1){if(C!==null){if(i[C]!==void 0)return i[C];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let Y=b;if(b===i.RED&&(z===i.FLOAT&&(Y=i.R32F),z===i.HALF_FLOAT&&(Y=i.R16F),z===i.UNSIGNED_BYTE&&(Y=i.R8)),b===i.RED_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.R8UI),z===i.UNSIGNED_SHORT&&(Y=i.R16UI),z===i.UNSIGNED_INT&&(Y=i.R32UI),z===i.BYTE&&(Y=i.R8I),z===i.SHORT&&(Y=i.R16I),z===i.INT&&(Y=i.R32I)),b===i.RG&&(z===i.FLOAT&&(Y=i.RG32F),z===i.HALF_FLOAT&&(Y=i.RG16F),z===i.UNSIGNED_BYTE&&(Y=i.RG8)),b===i.RG_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RG8UI),z===i.UNSIGNED_SHORT&&(Y=i.RG16UI),z===i.UNSIGNED_INT&&(Y=i.RG32UI),z===i.BYTE&&(Y=i.RG8I),z===i.SHORT&&(Y=i.RG16I),z===i.INT&&(Y=i.RG32I)),b===i.RGB_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RGB8UI),z===i.UNSIGNED_SHORT&&(Y=i.RGB16UI),z===i.UNSIGNED_INT&&(Y=i.RGB32UI),z===i.BYTE&&(Y=i.RGB8I),z===i.SHORT&&(Y=i.RGB16I),z===i.INT&&(Y=i.RGB32I)),b===i.RGBA_INTEGER&&(z===i.UNSIGNED_BYTE&&(Y=i.RGBA8UI),z===i.UNSIGNED_SHORT&&(Y=i.RGBA16UI),z===i.UNSIGNED_INT&&(Y=i.RGBA32UI),z===i.BYTE&&(Y=i.RGBA8I),z===i.SHORT&&(Y=i.RGBA16I),z===i.INT&&(Y=i.RGBA32I)),b===i.RGB&&z===i.UNSIGNED_INT_5_9_9_9_REV&&(Y=i.RGB9_E5),b===i.RGBA){const Mt=Z?ta:Yt.getTransfer(q);z===i.FLOAT&&(Y=i.RGBA32F),z===i.HALF_FLOAT&&(Y=i.RGBA16F),z===i.UNSIGNED_BYTE&&(Y=Mt===se?i.SRGB8_ALPHA8:i.RGBA8),z===i.UNSIGNED_SHORT_4_4_4_4&&(Y=i.RGBA4),z===i.UNSIGNED_SHORT_5_5_5_1&&(Y=i.RGB5_A1)}return(Y===i.R16F||Y===i.R32F||Y===i.RG16F||Y===i.RG32F||Y===i.RGBA16F||Y===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function v(C,b){let z;return C?b===null||b===Gi||b===zs?z=i.DEPTH24_STENCIL8:b===wn?z=i.DEPTH32F_STENCIL8:b===Sr&&(z=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===Gi||b===zs?z=i.DEPTH_COMPONENT24:b===wn?z=i.DEPTH_COMPONENT32F:b===Sr&&(z=i.DEPTH_COMPONENT16),z}function L(C,b){return m(C)===!0||C.isFramebufferTexture&&C.minFilter!==tn&&C.minFilter!==yn?Math.log2(Math.max(b.width,b.height))+1:C.mipmaps!==void 0&&C.mipmaps.length>0?C.mipmaps.length:C.isCompressedTexture&&Array.isArray(C.image)?b.mipmaps.length:1}function w(C){const b=C.target;b.removeEventListener("dispose",w),T(b),b.isVideoTexture&&h.delete(b)}function A(C){const b=C.target;b.removeEventListener("dispose",A),y(b)}function T(C){const b=n.get(C);if(b.__webglInit===void 0)return;const z=C.source,q=d.get(z);if(q){const Z=q[b.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&S(C),Object.keys(q).length===0&&d.delete(z)}n.remove(C)}function S(C){const b=n.get(C);i.deleteTexture(b.__webglTexture);const z=C.source,q=d.get(z);delete q[b.__cacheKey],o.memory.textures--}function y(C){const b=n.get(C);if(C.depthTexture&&(C.depthTexture.dispose(),n.remove(C.depthTexture)),C.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(b.__webglFramebuffer[q]))for(let Z=0;Z<b.__webglFramebuffer[q].length;Z++)i.deleteFramebuffer(b.__webglFramebuffer[q][Z]);else i.deleteFramebuffer(b.__webglFramebuffer[q]);b.__webglDepthbuffer&&i.deleteRenderbuffer(b.__webglDepthbuffer[q])}else{if(Array.isArray(b.__webglFramebuffer))for(let q=0;q<b.__webglFramebuffer.length;q++)i.deleteFramebuffer(b.__webglFramebuffer[q]);else i.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&i.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&i.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let q=0;q<b.__webglColorRenderbuffer.length;q++)b.__webglColorRenderbuffer[q]&&i.deleteRenderbuffer(b.__webglColorRenderbuffer[q]);b.__webglDepthRenderbuffer&&i.deleteRenderbuffer(b.__webglDepthRenderbuffer)}const z=C.textures;for(let q=0,Z=z.length;q<Z;q++){const Y=n.get(z[q]);Y.__webglTexture&&(i.deleteTexture(Y.__webglTexture),o.memory.textures--),n.remove(z[q])}n.remove(C)}let R=0;function F(){R=0}function k(){const C=R;return C>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+C+" texture units while this GPU supports only "+s.maxTextures),R+=1,C}function V(C){const b=[];return b.push(C.wrapS),b.push(C.wrapT),b.push(C.wrapR||0),b.push(C.magFilter),b.push(C.minFilter),b.push(C.anisotropy),b.push(C.internalFormat),b.push(C.format),b.push(C.type),b.push(C.generateMipmaps),b.push(C.premultiplyAlpha),b.push(C.flipY),b.push(C.unpackAlignment),b.push(C.colorSpace),b.join()}function O(C,b){const z=n.get(C);if(C.isVideoTexture&&At(C),C.isRenderTargetTexture===!1&&C.version>0&&z.__version!==C.version){const q=C.image;if(q===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{$(z,C,b);return}}e.bindTexture(i.TEXTURE_2D,z.__webglTexture,i.TEXTURE0+b)}function W(C,b){const z=n.get(C);if(C.version>0&&z.__version!==C.version){$(z,C,b);return}e.bindTexture(i.TEXTURE_2D_ARRAY,z.__webglTexture,i.TEXTURE0+b)}function K(C,b){const z=n.get(C);if(C.version>0&&z.__version!==C.version){$(z,C,b);return}e.bindTexture(i.TEXTURE_3D,z.__webglTexture,i.TEXTURE0+b)}function G(C,b){const z=n.get(C);if(C.version>0&&z.__version!==C.version){Q(z,C,b);return}e.bindTexture(i.TEXTURE_CUBE_MAP,z.__webglTexture,i.TEXTURE0+b)}const nt={[Ac]:i.REPEAT,[zi]:i.CLAMP_TO_EDGE,[wc]:i.MIRRORED_REPEAT},rt={[tn]:i.NEAREST,[Ig]:i.NEAREST_MIPMAP_NEAREST,[Nr]:i.NEAREST_MIPMAP_LINEAR,[yn]:i.LINEAR,[fa]:i.LINEAR_MIPMAP_NEAREST,[Fi]:i.LINEAR_MIPMAP_LINEAR},_t={[Og]:i.NEVER,[Vg]:i.ALWAYS,[kg]:i.LESS,[df]:i.LEQUAL,[zg]:i.EQUAL,[Hg]:i.GEQUAL,[Fg]:i.GREATER,[Bg]:i.NOTEQUAL};function Lt(C,b){if(b.type===wn&&t.has("OES_texture_float_linear")===!1&&(b.magFilter===yn||b.magFilter===fa||b.magFilter===Nr||b.magFilter===Fi||b.minFilter===yn||b.minFilter===fa||b.minFilter===Nr||b.minFilter===Fi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(C,i.TEXTURE_WRAP_S,nt[b.wrapS]),i.texParameteri(C,i.TEXTURE_WRAP_T,nt[b.wrapT]),(C===i.TEXTURE_3D||C===i.TEXTURE_2D_ARRAY)&&i.texParameteri(C,i.TEXTURE_WRAP_R,nt[b.wrapR]),i.texParameteri(C,i.TEXTURE_MAG_FILTER,rt[b.magFilter]),i.texParameteri(C,i.TEXTURE_MIN_FILTER,rt[b.minFilter]),b.compareFunction&&(i.texParameteri(C,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(C,i.TEXTURE_COMPARE_FUNC,_t[b.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===tn||b.minFilter!==Nr&&b.minFilter!==Fi||b.type===wn&&t.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||n.get(b).__currentAnisotropy){const z=t.get("EXT_texture_filter_anisotropic");i.texParameterf(C,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,s.getMaxAnisotropy())),n.get(b).__currentAnisotropy=b.anisotropy}}}function Qt(C,b){let z=!1;C.__webglInit===void 0&&(C.__webglInit=!0,b.addEventListener("dispose",w));const q=b.source;let Z=d.get(q);Z===void 0&&(Z={},d.set(q,Z));const Y=V(b);if(Y!==C.__cacheKey){Z[Y]===void 0&&(Z[Y]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,z=!0),Z[Y].usedTimes++;const Mt=Z[C.__cacheKey];Mt!==void 0&&(Z[C.__cacheKey].usedTimes--,Mt.usedTimes===0&&S(b)),C.__cacheKey=Y,C.__webglTexture=Z[Y].texture}return z}function $(C,b,z){let q=i.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(q=i.TEXTURE_2D_ARRAY),b.isData3DTexture&&(q=i.TEXTURE_3D);const Z=Qt(C,b),Y=b.source;e.bindTexture(q,C.__webglTexture,i.TEXTURE0+z);const Mt=n.get(Y);if(Y.version!==Mt.__version||Z===!0){e.activeTexture(i.TEXTURE0+z);const at=Yt.getPrimaries(Yt.workingColorSpace),ft=b.colorSpace===ci?null:Yt.getPrimaries(b.colorSpace),$t=b.colorSpace===ci||at===ft?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,b.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,b.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,$t);let tt=_(b.image,!1,s.maxTextureSize);tt=de(b,tt);const pt=r.convert(b.format,b.colorSpace),wt=r.convert(b.type);let Pt=M(b.internalFormat,pt,wt,b.colorSpace,b.isVideoTexture);Lt(q,b);let mt;const Xt=b.mipmaps,Ht=b.isVideoTexture!==!0,ae=Mt.__version===void 0||Z===!0,I=Y.dataReady,ot=L(b,tt);if(b.isDepthTexture)Pt=v(b.format===Fs,b.type),ae&&(Ht?e.texStorage2D(i.TEXTURE_2D,1,Pt,tt.width,tt.height):e.texImage2D(i.TEXTURE_2D,0,Pt,tt.width,tt.height,0,pt,wt,null));else if(b.isDataTexture)if(Xt.length>0){Ht&&ae&&e.texStorage2D(i.TEXTURE_2D,ot,Pt,Xt[0].width,Xt[0].height);for(let X=0,j=Xt.length;X<j;X++)mt=Xt[X],Ht?I&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,pt,wt,mt.data):e.texImage2D(i.TEXTURE_2D,X,Pt,mt.width,mt.height,0,pt,wt,mt.data);b.generateMipmaps=!1}else Ht?(ae&&e.texStorage2D(i.TEXTURE_2D,ot,Pt,tt.width,tt.height),I&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,tt.width,tt.height,pt,wt,tt.data)):e.texImage2D(i.TEXTURE_2D,0,Pt,tt.width,tt.height,0,pt,wt,tt.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){Ht&&ae&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ot,Pt,Xt[0].width,Xt[0].height,tt.depth);for(let X=0,j=Xt.length;X<j;X++)if(mt=Xt[X],b.format!==Sn)if(pt!==null)if(Ht){if(I)if(b.layerUpdates.size>0){const ut=Bu(mt.width,mt.height,b.format,b.type);for(const lt of b.layerUpdates){const Ot=mt.data.subarray(lt*ut/mt.data.BYTES_PER_ELEMENT,(lt+1)*ut/mt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,lt,mt.width,mt.height,1,pt,Ot)}b.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,mt.width,mt.height,tt.depth,pt,mt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,X,Pt,mt.width,mt.height,tt.depth,0,mt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ht?I&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,X,0,0,0,mt.width,mt.height,tt.depth,pt,wt,mt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,X,Pt,mt.width,mt.height,tt.depth,0,pt,wt,mt.data)}else{Ht&&ae&&e.texStorage2D(i.TEXTURE_2D,ot,Pt,Xt[0].width,Xt[0].height);for(let X=0,j=Xt.length;X<j;X++)mt=Xt[X],b.format!==Sn?pt!==null?Ht?I&&e.compressedTexSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,pt,mt.data):e.compressedTexImage2D(i.TEXTURE_2D,X,Pt,mt.width,mt.height,0,mt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ht?I&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,mt.width,mt.height,pt,wt,mt.data):e.texImage2D(i.TEXTURE_2D,X,Pt,mt.width,mt.height,0,pt,wt,mt.data)}else if(b.isDataArrayTexture)if(Ht){if(ae&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ot,Pt,tt.width,tt.height,tt.depth),I)if(b.layerUpdates.size>0){const X=Bu(tt.width,tt.height,b.format,b.type);for(const j of b.layerUpdates){const ut=tt.data.subarray(j*X/tt.data.BYTES_PER_ELEMENT,(j+1)*X/tt.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,j,tt.width,tt.height,1,pt,wt,ut)}b.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,tt.width,tt.height,tt.depth,pt,wt,tt.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,Pt,tt.width,tt.height,tt.depth,0,pt,wt,tt.data);else if(b.isData3DTexture)Ht?(ae&&e.texStorage3D(i.TEXTURE_3D,ot,Pt,tt.width,tt.height,tt.depth),I&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,tt.width,tt.height,tt.depth,pt,wt,tt.data)):e.texImage3D(i.TEXTURE_3D,0,Pt,tt.width,tt.height,tt.depth,0,pt,wt,tt.data);else if(b.isFramebufferTexture){if(ae)if(Ht)e.texStorage2D(i.TEXTURE_2D,ot,Pt,tt.width,tt.height);else{let X=tt.width,j=tt.height;for(let ut=0;ut<ot;ut++)e.texImage2D(i.TEXTURE_2D,ut,Pt,X,j,0,pt,wt,null),X>>=1,j>>=1}}else if(Xt.length>0){if(Ht&&ae){const X=Ct(Xt[0]);e.texStorage2D(i.TEXTURE_2D,ot,Pt,X.width,X.height)}for(let X=0,j=Xt.length;X<j;X++)mt=Xt[X],Ht?I&&e.texSubImage2D(i.TEXTURE_2D,X,0,0,pt,wt,mt):e.texImage2D(i.TEXTURE_2D,X,Pt,pt,wt,mt);b.generateMipmaps=!1}else if(Ht){if(ae){const X=Ct(tt);e.texStorage2D(i.TEXTURE_2D,ot,Pt,X.width,X.height)}I&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,pt,wt,tt)}else e.texImage2D(i.TEXTURE_2D,0,Pt,pt,wt,tt);m(b)&&p(q),Mt.__version=Y.version,b.onUpdate&&b.onUpdate(b)}C.__version=b.version}function Q(C,b,z){if(b.image.length!==6)return;const q=Qt(C,b),Z=b.source;e.bindTexture(i.TEXTURE_CUBE_MAP,C.__webglTexture,i.TEXTURE0+z);const Y=n.get(Z);if(Z.version!==Y.__version||q===!0){e.activeTexture(i.TEXTURE0+z);const Mt=Yt.getPrimaries(Yt.workingColorSpace),at=b.colorSpace===ci?null:Yt.getPrimaries(b.colorSpace),ft=b.colorSpace===ci||Mt===at?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,b.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,b.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ft);const $t=b.isCompressedTexture||b.image[0].isCompressedTexture,tt=b.image[0]&&b.image[0].isDataTexture,pt=[];for(let j=0;j<6;j++)!$t&&!tt?pt[j]=_(b.image[j],!0,s.maxCubemapSize):pt[j]=tt?b.image[j].image:b.image[j],pt[j]=de(b,pt[j]);const wt=pt[0],Pt=r.convert(b.format,b.colorSpace),mt=r.convert(b.type),Xt=M(b.internalFormat,Pt,mt,b.colorSpace),Ht=b.isVideoTexture!==!0,ae=Y.__version===void 0||q===!0,I=Z.dataReady;let ot=L(b,wt);Lt(i.TEXTURE_CUBE_MAP,b);let X;if($t){Ht&&ae&&e.texStorage2D(i.TEXTURE_CUBE_MAP,ot,Xt,wt.width,wt.height);for(let j=0;j<6;j++){X=pt[j].mipmaps;for(let ut=0;ut<X.length;ut++){const lt=X[ut];b.format!==Sn?Pt!==null?Ht?I&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,0,0,lt.width,lt.height,Pt,lt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,Xt,lt.width,lt.height,0,lt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ht?I&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,0,0,lt.width,lt.height,Pt,mt,lt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,Xt,lt.width,lt.height,0,Pt,mt,lt.data)}}}else{if(X=b.mipmaps,Ht&&ae){X.length>0&&ot++;const j=Ct(pt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,ot,Xt,j.width,j.height)}for(let j=0;j<6;j++)if(tt){Ht?I&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,pt[j].width,pt[j].height,Pt,mt,pt[j].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Xt,pt[j].width,pt[j].height,0,Pt,mt,pt[j].data);for(let ut=0;ut<X.length;ut++){const Ot=X[ut].image[j].image;Ht?I&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,0,0,Ot.width,Ot.height,Pt,mt,Ot.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,Xt,Ot.width,Ot.height,0,Pt,mt,Ot.data)}}else{Ht?I&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Pt,mt,pt[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Xt,Pt,mt,pt[j]);for(let ut=0;ut<X.length;ut++){const lt=X[ut];Ht?I&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,0,0,Pt,mt,lt.image[j]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,Xt,Pt,mt,lt.image[j])}}}m(b)&&p(i.TEXTURE_CUBE_MAP),Y.__version=Z.version,b.onUpdate&&b.onUpdate(b)}C.__version=b.version}function vt(C,b,z,q,Z,Y){const Mt=r.convert(z.format,z.colorSpace),at=r.convert(z.type),ft=M(z.internalFormat,Mt,at,z.colorSpace),$t=n.get(b),tt=n.get(z);if(tt.__renderTarget=b,!$t.__hasExternalTextures){const pt=Math.max(1,b.width>>Y),wt=Math.max(1,b.height>>Y);Z===i.TEXTURE_3D||Z===i.TEXTURE_2D_ARRAY?e.texImage3D(Z,Y,ft,pt,wt,b.depth,0,Mt,at,null):e.texImage2D(Z,Y,ft,pt,wt,0,Mt,at,null)}e.bindFramebuffer(i.FRAMEBUFFER,C),Wt(b)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,q,Z,tt.__webglTexture,0,Gt(b)):(Z===i.TEXTURE_2D||Z>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,q,Z,tt.__webglTexture,Y),e.bindFramebuffer(i.FRAMEBUFFER,null)}function st(C,b,z){if(i.bindRenderbuffer(i.RENDERBUFFER,C),b.depthBuffer){const q=b.depthTexture,Z=q&&q.isDepthTexture?q.type:null,Y=v(b.stencilBuffer,Z),Mt=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=Gt(b);Wt(b)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,at,Y,b.width,b.height):z?i.renderbufferStorageMultisample(i.RENDERBUFFER,at,Y,b.width,b.height):i.renderbufferStorage(i.RENDERBUFFER,Y,b.width,b.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Mt,i.RENDERBUFFER,C)}else{const q=b.textures;for(let Z=0;Z<q.length;Z++){const Y=q[Z],Mt=r.convert(Y.format,Y.colorSpace),at=r.convert(Y.type),ft=M(Y.internalFormat,Mt,at,Y.colorSpace),$t=Gt(b);z&&Wt(b)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,$t,ft,b.width,b.height):Wt(b)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,$t,ft,b.width,b.height):i.renderbufferStorage(i.RENDERBUFFER,ft,b.width,b.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Tt(C,b){if(b&&b.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,C),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const q=n.get(b.depthTexture);q.__renderTarget=b,(!q.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),O(b.depthTexture,0);const Z=q.__webglTexture,Y=Gt(b);if(b.depthTexture.format===Cs)Wt(b)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Z,0,Y):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Z,0);else if(b.depthTexture.format===Fs)Wt(b)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Z,0,Y):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Z,0);else throw new Error("Unknown depthTexture format")}function Rt(C){const b=n.get(C),z=C.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==C.depthTexture){const q=C.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),q){const Z=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,q.removeEventListener("dispose",Z)};q.addEventListener("dispose",Z),b.__depthDisposeCallback=Z}b.__boundDepthTexture=q}if(C.depthTexture&&!b.__autoAllocateDepthBuffer){if(z)throw new Error("target.depthTexture not supported in Cube render targets");Tt(b.__webglFramebuffer,C)}else if(z){b.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(e.bindFramebuffer(i.FRAMEBUFFER,b.__webglFramebuffer[q]),b.__webglDepthbuffer[q]===void 0)b.__webglDepthbuffer[q]=i.createRenderbuffer(),st(b.__webglDepthbuffer[q],C,!1);else{const Z=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Y=b.__webglDepthbuffer[q];i.bindRenderbuffer(i.RENDERBUFFER,Y),i.framebufferRenderbuffer(i.FRAMEBUFFER,Z,i.RENDERBUFFER,Y)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=i.createRenderbuffer(),st(b.__webglDepthbuffer,C,!1);else{const q=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Z=b.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,Z),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,Z)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function Bt(C,b,z){const q=n.get(C);b!==void 0&&vt(q.__webglFramebuffer,C,C.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),z!==void 0&&Rt(C)}function oe(C){const b=C.texture,z=n.get(C),q=n.get(b);C.addEventListener("dispose",A);const Z=C.textures,Y=C.isWebGLCubeRenderTarget===!0,Mt=Z.length>1;if(Mt||(q.__webglTexture===void 0&&(q.__webglTexture=i.createTexture()),q.__version=b.version,o.memory.textures++),Y){z.__webglFramebuffer=[];for(let at=0;at<6;at++)if(b.mipmaps&&b.mipmaps.length>0){z.__webglFramebuffer[at]=[];for(let ft=0;ft<b.mipmaps.length;ft++)z.__webglFramebuffer[at][ft]=i.createFramebuffer()}else z.__webglFramebuffer[at]=i.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){z.__webglFramebuffer=[];for(let at=0;at<b.mipmaps.length;at++)z.__webglFramebuffer[at]=i.createFramebuffer()}else z.__webglFramebuffer=i.createFramebuffer();if(Mt)for(let at=0,ft=Z.length;at<ft;at++){const $t=n.get(Z[at]);$t.__webglTexture===void 0&&($t.__webglTexture=i.createTexture(),o.memory.textures++)}if(C.samples>0&&Wt(C)===!1){z.__webglMultisampledFramebuffer=i.createFramebuffer(),z.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let at=0;at<Z.length;at++){const ft=Z[at];z.__webglColorRenderbuffer[at]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,z.__webglColorRenderbuffer[at]);const $t=r.convert(ft.format,ft.colorSpace),tt=r.convert(ft.type),pt=M(ft.internalFormat,$t,tt,ft.colorSpace,C.isXRRenderTarget===!0),wt=Gt(C);i.renderbufferStorageMultisample(i.RENDERBUFFER,wt,pt,C.width,C.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+at,i.RENDERBUFFER,z.__webglColorRenderbuffer[at])}i.bindRenderbuffer(i.RENDERBUFFER,null),C.depthBuffer&&(z.__webglDepthRenderbuffer=i.createRenderbuffer(),st(z.__webglDepthRenderbuffer,C,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Y){e.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),Lt(i.TEXTURE_CUBE_MAP,b);for(let at=0;at<6;at++)if(b.mipmaps&&b.mipmaps.length>0)for(let ft=0;ft<b.mipmaps.length;ft++)vt(z.__webglFramebuffer[at][ft],C,b,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+at,ft);else vt(z.__webglFramebuffer[at],C,b,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+at,0);m(b)&&p(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(Mt){for(let at=0,ft=Z.length;at<ft;at++){const $t=Z[at],tt=n.get($t);e.bindTexture(i.TEXTURE_2D,tt.__webglTexture),Lt(i.TEXTURE_2D,$t),vt(z.__webglFramebuffer,C,$t,i.COLOR_ATTACHMENT0+at,i.TEXTURE_2D,0),m($t)&&p(i.TEXTURE_2D)}e.unbindTexture()}else{let at=i.TEXTURE_2D;if((C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)&&(at=C.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(at,q.__webglTexture),Lt(at,b),b.mipmaps&&b.mipmaps.length>0)for(let ft=0;ft<b.mipmaps.length;ft++)vt(z.__webglFramebuffer[ft],C,b,i.COLOR_ATTACHMENT0,at,ft);else vt(z.__webglFramebuffer,C,b,i.COLOR_ATTACHMENT0,at,0);m(b)&&p(at),e.unbindTexture()}C.depthBuffer&&Rt(C)}function Ut(C){const b=C.textures;for(let z=0,q=b.length;z<q;z++){const Z=b[z];if(m(Z)){const Y=x(C),Mt=n.get(Z).__webglTexture;e.bindTexture(Y,Mt),p(Y),e.unbindTexture()}}}const ue=[],N=[];function nn(C){if(C.samples>0){if(Wt(C)===!1){const b=C.textures,z=C.width,q=C.height;let Z=i.COLOR_BUFFER_BIT;const Y=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Mt=n.get(C),at=b.length>1;if(at)for(let ft=0;ft<b.length;ft++)e.bindFramebuffer(i.FRAMEBUFFER,Mt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ft,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,Mt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ft,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,Mt.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,Mt.__webglFramebuffer);for(let ft=0;ft<b.length;ft++){if(C.resolveDepthBuffer&&(C.depthBuffer&&(Z|=i.DEPTH_BUFFER_BIT),C.stencilBuffer&&C.resolveStencilBuffer&&(Z|=i.STENCIL_BUFFER_BIT)),at){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Mt.__webglColorRenderbuffer[ft]);const $t=n.get(b[ft]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,$t,0)}i.blitFramebuffer(0,0,z,q,0,0,z,q,Z,i.NEAREST),c===!0&&(ue.length=0,N.length=0,ue.push(i.COLOR_ATTACHMENT0+ft),C.depthBuffer&&C.resolveDepthBuffer===!1&&(ue.push(Y),N.push(Y),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,N)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ue))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),at)for(let ft=0;ft<b.length;ft++){e.bindFramebuffer(i.FRAMEBUFFER,Mt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ft,i.RENDERBUFFER,Mt.__webglColorRenderbuffer[ft]);const $t=n.get(b[ft]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,Mt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ft,i.TEXTURE_2D,$t,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,Mt.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.resolveDepthBuffer===!1&&c){const b=C.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[b])}}}function Gt(C){return Math.min(s.maxSamples,C.samples)}function Wt(C){const b=n.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function At(C){const b=o.render.frame;h.get(C)!==b&&(h.set(C,b),C.update())}function de(C,b){const z=C.colorSpace,q=C.format,Z=C.type;return C.isCompressedTexture===!0||C.isVideoTexture===!0||z!==Vs&&z!==ci&&(Yt.getTransfer(z)===se?(q!==Sn||Z!==jn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",z)),b}function Ct(C){return typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement?(l.width=C.naturalWidth||C.width,l.height=C.naturalHeight||C.height):typeof VideoFrame<"u"&&C instanceof VideoFrame?(l.width=C.displayWidth,l.height=C.displayHeight):(l.width=C.width,l.height=C.height),l}this.allocateTextureUnit=k,this.resetTextureUnits=F,this.setTexture2D=O,this.setTexture2DArray=W,this.setTexture3D=K,this.setTextureCube=G,this.rebindTextures=Bt,this.setupRenderTarget=oe,this.updateRenderTargetMipmap=Ut,this.updateMultisampleRenderTarget=nn,this.setupDepthRenderbuffer=Rt,this.setupFrameBufferTexture=vt,this.useMultisampledRTT=Wt}function aS(i,t){function e(n,s=ci){let r;const o=Yt.getTransfer(s);if(n===jn)return i.UNSIGNED_BYTE;if(n===$l)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Yl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===rf)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===nf)return i.BYTE;if(n===sf)return i.SHORT;if(n===Sr)return i.UNSIGNED_SHORT;if(n===Xl)return i.INT;if(n===Gi)return i.UNSIGNED_INT;if(n===wn)return i.FLOAT;if(n===Ar)return i.HALF_FLOAT;if(n===of)return i.ALPHA;if(n===af)return i.RGB;if(n===Sn)return i.RGBA;if(n===cf)return i.LUMINANCE;if(n===lf)return i.LUMINANCE_ALPHA;if(n===Cs)return i.DEPTH_COMPONENT;if(n===Fs)return i.DEPTH_STENCIL;if(n===ql)return i.RED;if(n===jl)return i.RED_INTEGER;if(n===hf)return i.RG;if(n===Kl)return i.RG_INTEGER;if(n===Zl)return i.RGBA_INTEGER;if(n===vo||n===xo||n===yo||n===So)if(o===se)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===vo)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===xo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===yo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===So)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===vo)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===xo)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===yo)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===So)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Rc||n===Pc||n===Lc||n===Ic)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Rc)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Pc)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Lc)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ic)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Dc||n===Uc||n===Nc)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Dc||n===Uc)return o===se?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Nc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Oc||n===kc||n===zc||n===Fc||n===Bc||n===Hc||n===Vc||n===Gc||n===Wc||n===Xc||n===$c||n===Yc||n===qc||n===jc)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Oc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===kc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===zc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Fc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Bc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Hc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Vc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Gc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Wc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Xc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===$c)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Yc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===qc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===jc)return o===se?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Mo||n===Kc||n===Zc)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Mo)return o===se?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Kc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Zc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===uf||n===Jc||n===Qc||n===tl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Mo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Jc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Qc)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===tl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===zs?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class cS extends ln{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Bi extends Me{constructor(){super(),this.isGroup=!0,this.type="Group"}}const lS={type:"move"};class Ba{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Bi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Bi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Bi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null;const a=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){o=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),p=this._getHandJoint(l,_);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,g=.005;l.inputState.pinching&&d>f+g?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&d<=f-g&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(lS)))}return a!==null&&(a.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Bi;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const hS=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,uS=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class dS{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new ze,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new Kn({vertexShader:hS,fragmentShader:uS,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new ie(new qn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class fS extends Gs{constructor(t,e){super();const n=this;let s=null,r=1,o=null,a="local-floor",c=1,l=null,h=null,u=null,d=null,f=null,g=null;const _=new dS,m=e.getContextAttributes();let p=null,x=null;const M=[],v=[],L=new ct;let w=null;const A=new ln;A.viewport=new re;const T=new ln;T.viewport=new re;const S=[A,T],y=new cS;let R=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let Q=M[$];return Q===void 0&&(Q=new Ba,M[$]=Q),Q.getTargetRaySpace()},this.getControllerGrip=function($){let Q=M[$];return Q===void 0&&(Q=new Ba,M[$]=Q),Q.getGripSpace()},this.getHand=function($){let Q=M[$];return Q===void 0&&(Q=new Ba,M[$]=Q),Q.getHandSpace()};function k($){const Q=v.indexOf($.inputSource);if(Q===-1)return;const vt=M[Q];vt!==void 0&&(vt.update($.inputSource,$.frame,l||o),vt.dispatchEvent({type:$.type,data:$.inputSource}))}function V(){s.removeEventListener("select",k),s.removeEventListener("selectstart",k),s.removeEventListener("selectend",k),s.removeEventListener("squeeze",k),s.removeEventListener("squeezestart",k),s.removeEventListener("squeezeend",k),s.removeEventListener("end",V),s.removeEventListener("inputsourceschange",O);for(let $=0;$<M.length;$++){const Q=v[$];Q!==null&&(v[$]=null,M[$].disconnect(Q))}R=null,F=null,_.reset(),t.setRenderTarget(p),f=null,d=null,u=null,s=null,x=null,Qt.stop(),n.isPresenting=!1,t.setPixelRatio(w),t.setSize(L.width,L.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){a=$,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function($){l=$},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(p=t.getRenderTarget(),s.addEventListener("select",k),s.addEventListener("selectstart",k),s.addEventListener("selectend",k),s.addEventListener("squeeze",k),s.addEventListener("squeezestart",k),s.addEventListener("squeezeend",k),s.addEventListener("end",V),s.addEventListener("inputsourceschange",O),m.xrCompatible!==!0&&await e.makeXRCompatible(),w=t.getPixelRatio(),t.getSize(L),s.renderState.layers===void 0){const Q={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,Q),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new Wi(f.framebufferWidth,f.framebufferHeight,{format:Sn,type:jn,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let Q=null,vt=null,st=null;m.depth&&(st=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Q=m.stencil?Fs:Cs,vt=m.stencil?zs:Gi);const Tt={colorFormat:e.RGBA8,depthFormat:st,scaleFactor:r};u=new XRWebGLBinding(s,e),d=u.createProjectionLayer(Tt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),x=new Wi(d.textureWidth,d.textureHeight,{format:Sn,type:jn,depthTexture:new Cf(d.textureWidth,d.textureHeight,vt,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await s.requestReferenceSpace(a),Qt.setContext(s),Qt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function O($){for(let Q=0;Q<$.removed.length;Q++){const vt=$.removed[Q],st=v.indexOf(vt);st>=0&&(v[st]=null,M[st].disconnect(vt))}for(let Q=0;Q<$.added.length;Q++){const vt=$.added[Q];let st=v.indexOf(vt);if(st===-1){for(let Rt=0;Rt<M.length;Rt++)if(Rt>=v.length){v.push(vt),st=Rt;break}else if(v[Rt]===null){v[Rt]=vt,st=Rt;break}if(st===-1)break}const Tt=M[st];Tt&&Tt.connect(vt)}}const W=new P,K=new P;function G($,Q,vt){W.setFromMatrixPosition(Q.matrixWorld),K.setFromMatrixPosition(vt.matrixWorld);const st=W.distanceTo(K),Tt=Q.projectionMatrix.elements,Rt=vt.projectionMatrix.elements,Bt=Tt[14]/(Tt[10]-1),oe=Tt[14]/(Tt[10]+1),Ut=(Tt[9]+1)/Tt[5],ue=(Tt[9]-1)/Tt[5],N=(Tt[8]-1)/Tt[0],nn=(Rt[8]+1)/Rt[0],Gt=Bt*N,Wt=Bt*nn,At=st/(-N+nn),de=At*-N;if(Q.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(de),$.translateZ(At),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),Tt[10]===-1)$.projectionMatrix.copy(Q.projectionMatrix),$.projectionMatrixInverse.copy(Q.projectionMatrixInverse);else{const Ct=Bt+At,C=oe+At,b=Gt-de,z=Wt+(st-de),q=Ut*oe/C*Ct,Z=ue*oe/C*Ct;$.projectionMatrix.makePerspective(b,z,q,Z,Ct,C),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function nt($,Q){Q===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(Q.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let Q=$.near,vt=$.far;_.texture!==null&&(_.depthNear>0&&(Q=_.depthNear),_.depthFar>0&&(vt=_.depthFar)),y.near=T.near=A.near=Q,y.far=T.far=A.far=vt,(R!==y.near||F!==y.far)&&(s.updateRenderState({depthNear:y.near,depthFar:y.far}),R=y.near,F=y.far),A.layers.mask=$.layers.mask|2,T.layers.mask=$.layers.mask|4,y.layers.mask=A.layers.mask|T.layers.mask;const st=$.parent,Tt=y.cameras;nt(y,st);for(let Rt=0;Rt<Tt.length;Rt++)nt(Tt[Rt],st);Tt.length===2?G(y,A,T):y.projectionMatrix.copy(A.projectionMatrix),rt($,y,st)};function rt($,Q,vt){vt===null?$.matrix.copy(Q.matrixWorld):($.matrix.copy(vt.matrixWorld),$.matrix.invert(),$.matrix.multiply(Q.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(Q.projectionMatrix),$.projectionMatrixInverse.copy(Q.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=Mr*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&f===null))return c},this.setFoveation=function($){c=$,d!==null&&(d.fixedFoveation=$),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=$)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(y)};let _t=null;function Lt($,Q){if(h=Q.getViewerPose(l||o),g=Q,h!==null){const vt=h.views;f!==null&&(t.setRenderTargetFramebuffer(x,f.framebuffer),t.setRenderTarget(x));let st=!1;vt.length!==y.cameras.length&&(y.cameras.length=0,st=!0);for(let Rt=0;Rt<vt.length;Rt++){const Bt=vt[Rt];let oe=null;if(f!==null)oe=f.getViewport(Bt);else{const ue=u.getViewSubImage(d,Bt);oe=ue.viewport,Rt===0&&(t.setRenderTargetTextures(x,ue.colorTexture,d.ignoreDepthValues?void 0:ue.depthStencilTexture),t.setRenderTarget(x))}let Ut=S[Rt];Ut===void 0&&(Ut=new ln,Ut.layers.enable(Rt),Ut.viewport=new re,S[Rt]=Ut),Ut.matrix.fromArray(Bt.transform.matrix),Ut.matrix.decompose(Ut.position,Ut.quaternion,Ut.scale),Ut.projectionMatrix.fromArray(Bt.projectionMatrix),Ut.projectionMatrixInverse.copy(Ut.projectionMatrix).invert(),Ut.viewport.set(oe.x,oe.y,oe.width,oe.height),Rt===0&&(y.matrix.copy(Ut.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),st===!0&&y.cameras.push(Ut)}const Tt=s.enabledFeatures;if(Tt&&Tt.includes("depth-sensing")){const Rt=u.getDepthInformation(vt[0]);Rt&&Rt.isValid&&Rt.texture&&_.init(t,Rt,s.renderState)}}for(let vt=0;vt<M.length;vt++){const st=v[vt],Tt=M[vt];st!==null&&Tt!==void 0&&Tt.update(st,Q,l||o)}_t&&_t($,Q),Q.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Q}),g=null}const Qt=new Ef;Qt.setAnimationLoop(Lt),this.setAnimationLoop=function($){_t=$},this.dispose=function(){}}}const Ai=new un,pS=new qt;function mS(i,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Sf(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,x,M,v){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(m,p):p.isMeshToonMaterial?(r(m,p),u(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,v)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),_(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(o(m,p),p.isLineDashedMaterial&&a(m,p)):p.isPointsMaterial?c(m,p,x,M):p.isSpriteMaterial?l(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===je&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===je&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const x=t.get(p),M=x.envMap,v=x.envMapRotation;M&&(m.envMap.value=M,Ai.copy(v),Ai.x*=-1,Ai.y*=-1,Ai.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(Ai.y*=-1,Ai.z*=-1),m.envMapRotation.value.setFromMatrix4(pS.makeRotationFromEuler(Ai)),m.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function o(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function c(m,p,x,M){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*x,m.scale.value=M*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function l(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,x){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===je&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=x.texture,m.transmissionSamplerSize.value.set(x.width,x.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function _(m,p){const x=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(x.matrixWorld),m.nearDistance.value=x.shadow.camera.near,m.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function gS(i,t,e,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(x,M){const v=M.program;n.uniformBlockBinding(x,v)}function l(x,M){let v=s[x.id];v===void 0&&(g(x),v=h(x),s[x.id]=v,x.addEventListener("dispose",m));const L=M.program;n.updateUBOMapping(x,L);const w=t.render.frame;r[x.id]!==w&&(d(x),r[x.id]=w)}function h(x){const M=u();x.__bindingPointIndex=M;const v=i.createBuffer(),L=x.__size,w=x.usage;return i.bindBuffer(i.UNIFORM_BUFFER,v),i.bufferData(i.UNIFORM_BUFFER,L,w),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,v),v}function u(){for(let x=0;x<a;x++)if(o.indexOf(x)===-1)return o.push(x),x;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(x){const M=s[x.id],v=x.uniforms,L=x.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let w=0,A=v.length;w<A;w++){const T=Array.isArray(v[w])?v[w]:[v[w]];for(let S=0,y=T.length;S<y;S++){const R=T[S];if(f(R,w,S,L)===!0){const F=R.__offset,k=Array.isArray(R.value)?R.value:[R.value];let V=0;for(let O=0;O<k.length;O++){const W=k[O],K=_(W);typeof W=="number"||typeof W=="boolean"?(R.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,F+V,R.__data)):W.isMatrix3?(R.__data[0]=W.elements[0],R.__data[1]=W.elements[1],R.__data[2]=W.elements[2],R.__data[3]=0,R.__data[4]=W.elements[3],R.__data[5]=W.elements[4],R.__data[6]=W.elements[5],R.__data[7]=0,R.__data[8]=W.elements[6],R.__data[9]=W.elements[7],R.__data[10]=W.elements[8],R.__data[11]=0):(W.toArray(R.__data,V),V+=K.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,F,R.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(x,M,v,L){const w=x.value,A=M+"_"+v;if(L[A]===void 0)return typeof w=="number"||typeof w=="boolean"?L[A]=w:L[A]=w.clone(),!0;{const T=L[A];if(typeof w=="number"||typeof w=="boolean"){if(T!==w)return L[A]=w,!0}else if(T.equals(w)===!1)return T.copy(w),!0}return!1}function g(x){const M=x.uniforms;let v=0;const L=16;for(let A=0,T=M.length;A<T;A++){const S=Array.isArray(M[A])?M[A]:[M[A]];for(let y=0,R=S.length;y<R;y++){const F=S[y],k=Array.isArray(F.value)?F.value:[F.value];for(let V=0,O=k.length;V<O;V++){const W=k[V],K=_(W),G=v%L,nt=G%K.boundary,rt=G+nt;v+=nt,rt!==0&&L-rt<K.storage&&(v+=L-rt),F.__data=new Float32Array(K.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=v,v+=K.storage}}}const w=v%L;return w>0&&(v+=L-w),x.__size=v,x.__cache={},this}function _(x){const M={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(M.boundary=4,M.storage=4):x.isVector2?(M.boundary=8,M.storage=8):x.isVector3||x.isColor?(M.boundary=16,M.storage=12):x.isVector4?(M.boundary=16,M.storage=16):x.isMatrix3?(M.boundary=48,M.storage=48):x.isMatrix4?(M.boundary=64,M.storage=64):x.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",x),M}function m(x){const M=x.target;M.removeEventListener("dispose",m);const v=o.indexOf(M.__bindingPointIndex);o.splice(v,1),i.deleteBuffer(s[M.id]),delete s[M.id],delete r[M.id]}function p(){for(const x in s)i.deleteBuffer(s[x]);o=[],s={},r={}}return{bind:c,update:l,dispose:p}}class _S{constructor(t={}){const{canvas:e=o0(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=o;const g=new Uint32Array(4),_=new Int32Array(4);let m=null,p=null;const x=[],M=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Oe,this.toneMapping=pi,this.toneMappingExposure=1;const v=this;let L=!1,w=0,A=0,T=null,S=-1,y=null;const R=new re,F=new re;let k=null;const V=new Ft(0);let O=0,W=e.width,K=e.height,G=1,nt=null,rt=null;const _t=new re(0,0,W,K),Lt=new re(0,0,W,K);let Qt=!1;const $=new eh;let Q=!1,vt=!1;const st=new qt,Tt=new qt,Rt=new P,Bt=new re,oe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Ut=!1;function ue(){return T===null?G:1}let N=n;function nn(E,D){return e.getContext(E,D)}try{const E={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Gl}`),e.addEventListener("webglcontextlost",j,!1),e.addEventListener("webglcontextrestored",ut,!1),e.addEventListener("webglcontextcreationerror",lt,!1),N===null){const D="webgl2";if(N=nn(D,E),N===null)throw nn(D)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let Gt,Wt,At,de,Ct,C,b,z,q,Z,Y,Mt,at,ft,$t,tt,pt,wt,Pt,mt,Xt,Ht,ae,I;function ot(){Gt=new Mx(N),Gt.init(),Ht=new aS(N,Gt),Wt=new gx(N,Gt,t,Ht),At=new sS(N,Gt),Wt.reverseDepthBuffer&&d&&At.buffers.depth.setReversed(!0),de=new Tx(N),Ct=new Gy,C=new oS(N,Gt,At,Ct,Wt,Ht,de),b=new vx(v),z=new Sx(v),q=new I0(N),ae=new px(N,q),Z=new bx(N,q,de,ae),Y=new Ax(N,Z,q,de),Pt=new Cx(N,Wt,C),tt=new _x(Ct),Mt=new Vy(v,b,z,Gt,Wt,ae,tt),at=new mS(v,Ct),ft=new Xy,$t=new Zy(Gt),wt=new fx(v,b,z,At,Y,f,c),pt=new nS(v,Y,Wt),I=new gS(N,de,Wt,At),mt=new mx(N,Gt,de),Xt=new Ex(N,Gt,de),de.programs=Mt.programs,v.capabilities=Wt,v.extensions=Gt,v.properties=Ct,v.renderLists=ft,v.shadowMap=pt,v.state=At,v.info=de}ot();const X=new fS(v,N);this.xr=X,this.getContext=function(){return N},this.getContextAttributes=function(){return N.getContextAttributes()},this.forceContextLoss=function(){const E=Gt.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=Gt.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return G},this.setPixelRatio=function(E){E!==void 0&&(G=E,this.setSize(W,K,!1))},this.getSize=function(E){return E.set(W,K)},this.setSize=function(E,D,B=!0){if(X.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=E,K=D,e.width=Math.floor(E*G),e.height=Math.floor(D*G),B===!0&&(e.style.width=E+"px",e.style.height=D+"px"),this.setViewport(0,0,E,D)},this.getDrawingBufferSize=function(E){return E.set(W*G,K*G).floor()},this.setDrawingBufferSize=function(E,D,B){W=E,K=D,G=B,e.width=Math.floor(E*B),e.height=Math.floor(D*B),this.setViewport(0,0,E,D)},this.getCurrentViewport=function(E){return E.copy(R)},this.getViewport=function(E){return E.copy(_t)},this.setViewport=function(E,D,B,H){E.isVector4?_t.set(E.x,E.y,E.z,E.w):_t.set(E,D,B,H),At.viewport(R.copy(_t).multiplyScalar(G).round())},this.getScissor=function(E){return E.copy(Lt)},this.setScissor=function(E,D,B,H){E.isVector4?Lt.set(E.x,E.y,E.z,E.w):Lt.set(E,D,B,H),At.scissor(F.copy(Lt).multiplyScalar(G).round())},this.getScissorTest=function(){return Qt},this.setScissorTest=function(E){At.setScissorTest(Qt=E)},this.setOpaqueSort=function(E){nt=E},this.setTransparentSort=function(E){rt=E},this.getClearColor=function(E){return E.copy(wt.getClearColor())},this.setClearColor=function(){wt.setClearColor.apply(wt,arguments)},this.getClearAlpha=function(){return wt.getClearAlpha()},this.setClearAlpha=function(){wt.setClearAlpha.apply(wt,arguments)},this.clear=function(E=!0,D=!0,B=!0){let H=0;if(E){let U=!1;if(T!==null){const et=T.texture.format;U=et===Zl||et===Kl||et===jl}if(U){const et=T.texture.type,ht=et===jn||et===Gi||et===Sr||et===zs||et===$l||et===Yl,xt=wt.getClearColor(),yt=wt.getClearAlpha(),It=xt.r,kt=xt.g,St=xt.b;ht?(g[0]=It,g[1]=kt,g[2]=St,g[3]=yt,N.clearBufferuiv(N.COLOR,0,g)):(_[0]=It,_[1]=kt,_[2]=St,_[3]=yt,N.clearBufferiv(N.COLOR,0,_))}else H|=N.COLOR_BUFFER_BIT}D&&(H|=N.DEPTH_BUFFER_BIT),B&&(H|=N.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),N.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",j,!1),e.removeEventListener("webglcontextrestored",ut,!1),e.removeEventListener("webglcontextcreationerror",lt,!1),ft.dispose(),$t.dispose(),Ct.dispose(),b.dispose(),z.dispose(),Y.dispose(),ae.dispose(),I.dispose(),Mt.dispose(),X.dispose(),X.removeEventListener("sessionstart",yh),X.removeEventListener("sessionend",Sh),Si.stop()};function j(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),L=!0}function ut(){console.log("THREE.WebGLRenderer: Context Restored."),L=!1;const E=de.autoReset,D=pt.enabled,B=pt.autoUpdate,H=pt.needsUpdate,U=pt.type;ot(),de.autoReset=E,pt.enabled=D,pt.autoUpdate=B,pt.needsUpdate=H,pt.type=U}function lt(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Ot(E){const D=E.target;D.removeEventListener("dispose",Ot),ge(D)}function ge(E){De(E),Ct.remove(E)}function De(E){const D=Ct.get(E).programs;D!==void 0&&(D.forEach(function(B){Mt.releaseProgram(B)}),E.isShaderMaterial&&Mt.releaseShaderCache(E))}this.renderBufferDirect=function(E,D,B,H,U,et){D===null&&(D=oe);const ht=U.isMesh&&U.matrixWorld.determinant()<0,xt=Sm(E,D,B,H,U);At.setMaterial(H,ht);let yt=B.index,It=1;if(H.wireframe===!0){if(yt=Z.getWireframeAttribute(B),yt===void 0)return;It=2}const kt=B.drawRange,St=B.attributes.position;let jt=kt.start*It,ce=(kt.start+kt.count)*It;et!==null&&(jt=Math.max(jt,et.start*It),ce=Math.min(ce,(et.start+et.count)*It)),yt!==null?(jt=Math.max(jt,0),ce=Math.min(ce,yt.count)):St!=null&&(jt=Math.max(jt,0),ce=Math.min(ce,St.count));const fe=ce-jt;if(fe<0||fe===1/0)return;ae.setup(U,H,xt,B,yt);let $e,Zt=mt;if(yt!==null&&($e=q.get(yt),Zt=Xt,Zt.setIndex($e)),U.isMesh)H.wireframe===!0?(At.setLineWidth(H.wireframeLinewidth*ue()),Zt.setMode(N.LINES)):Zt.setMode(N.TRIANGLES);else if(U.isLine){let bt=H.linewidth;bt===void 0&&(bt=1),At.setLineWidth(bt*ue()),U.isLineSegments?Zt.setMode(N.LINES):U.isLineLoop?Zt.setMode(N.LINE_LOOP):Zt.setMode(N.LINE_STRIP)}else U.isPoints?Zt.setMode(N.POINTS):U.isSprite&&Zt.setMode(N.TRIANGLES);if(U.isBatchedMesh)if(U._multiDrawInstances!==null)Zt.renderMultiDrawInstances(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount,U._multiDrawInstances);else if(Gt.get("WEBGL_multi_draw"))Zt.renderMultiDraw(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount);else{const bt=U._multiDrawStarts,Nn=U._multiDrawCounts,Jt=U._multiDrawCount,fn=yt?q.get(yt).bytesPerElement:1,Ji=Ct.get(H).currentProgram.getUniforms();for(let Ke=0;Ke<Jt;Ke++)Ji.setValue(N,"_gl_DrawID",Ke),Zt.render(bt[Ke]/fn,Nn[Ke])}else if(U.isInstancedMesh)Zt.renderInstances(jt,fe,U.count);else if(B.isInstancedBufferGeometry){const bt=B._maxInstanceCount!==void 0?B._maxInstanceCount:1/0,Nn=Math.min(B.instanceCount,bt);Zt.renderInstances(jt,fe,Nn)}else Zt.render(jt,fe)};function te(E,D,B){E.transparent===!0&&E.side===vn&&E.forceSinglePass===!1?(E.side=je,E.needsUpdate=!0,Ir(E,D,B),E.side=xi,E.needsUpdate=!0,Ir(E,D,B),E.side=vn):Ir(E,D,B)}this.compile=function(E,D,B=null){B===null&&(B=E),p=$t.get(B),p.init(D),M.push(p),B.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),E!==B&&E.traverseVisible(function(U){U.isLight&&U.layers.test(D.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),p.setupLights();const H=new Set;return E.traverse(function(U){if(!(U.isMesh||U.isPoints||U.isLine||U.isSprite))return;const et=U.material;if(et)if(Array.isArray(et))for(let ht=0;ht<et.length;ht++){const xt=et[ht];te(xt,B,U),H.add(xt)}else te(et,B,U),H.add(et)}),M.pop(),p=null,H},this.compileAsync=function(E,D,B=null){const H=this.compile(E,D,B);return new Promise(U=>{function et(){if(H.forEach(function(ht){Ct.get(ht).currentProgram.isReady()&&H.delete(ht)}),H.size===0){U(E);return}setTimeout(et,10)}Gt.get("KHR_parallel_shader_compile")!==null?et():setTimeout(et,10)})};let dn=null;function Un(E){dn&&dn(E)}function yh(){Si.stop()}function Sh(){Si.start()}const Si=new Ef;Si.setAnimationLoop(Un),typeof self<"u"&&Si.setContext(self),this.setAnimationLoop=function(E){dn=E,X.setAnimationLoop(E),E===null?Si.stop():Si.start()},X.addEventListener("sessionstart",yh),X.addEventListener("sessionend",Sh),this.render=function(E,D){if(D!==void 0&&D.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),X.enabled===!0&&X.isPresenting===!0&&(X.cameraAutoUpdate===!0&&X.updateCamera(D),D=X.getCamera()),E.isScene===!0&&E.onBeforeRender(v,E,D,T),p=$t.get(E,M.length),p.init(D),M.push(p),Tt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),$.setFromProjectionMatrix(Tt),vt=this.localClippingEnabled,Q=tt.init(this.clippingPlanes,vt),m=ft.get(E,x.length),m.init(),x.push(m),X.enabled===!0&&X.isPresenting===!0){const et=v.xr.getDepthSensingMesh();et!==null&&aa(et,D,-1/0,v.sortObjects)}aa(E,D,0,v.sortObjects),m.finish(),v.sortObjects===!0&&m.sort(nt,rt),Ut=X.enabled===!1||X.isPresenting===!1||X.hasDepthSensing()===!1,Ut&&wt.addToRenderList(m,E),this.info.render.frame++,Q===!0&&tt.beginShadows();const B=p.state.shadowsArray;pt.render(B,E,D),Q===!0&&tt.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=m.opaque,U=m.transmissive;if(p.setupLights(),D.isArrayCamera){const et=D.cameras;if(U.length>0)for(let ht=0,xt=et.length;ht<xt;ht++){const yt=et[ht];bh(H,U,E,yt)}Ut&&wt.render(E);for(let ht=0,xt=et.length;ht<xt;ht++){const yt=et[ht];Mh(m,E,yt,yt.viewport)}}else U.length>0&&bh(H,U,E,D),Ut&&wt.render(E),Mh(m,E,D);T!==null&&(C.updateMultisampleRenderTarget(T),C.updateRenderTargetMipmap(T)),E.isScene===!0&&E.onAfterRender(v,E,D),ae.resetDefaultState(),S=-1,y=null,M.pop(),M.length>0?(p=M[M.length-1],Q===!0&&tt.setGlobalState(v.clippingPlanes,p.state.camera)):p=null,x.pop(),x.length>0?m=x[x.length-1]:m=null};function aa(E,D,B,H){if(E.visible===!1)return;if(E.layers.test(D.layers)){if(E.isGroup)B=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(D);else if(E.isLight)p.pushLight(E),E.castShadow&&p.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||$.intersectsSprite(E)){H&&Bt.setFromMatrixPosition(E.matrixWorld).applyMatrix4(Tt);const ht=Y.update(E),xt=E.material;xt.visible&&m.push(E,ht,xt,B,Bt.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||$.intersectsObject(E))){const ht=Y.update(E),xt=E.material;if(H&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Bt.copy(E.boundingSphere.center)):(ht.boundingSphere===null&&ht.computeBoundingSphere(),Bt.copy(ht.boundingSphere.center)),Bt.applyMatrix4(E.matrixWorld).applyMatrix4(Tt)),Array.isArray(xt)){const yt=ht.groups;for(let It=0,kt=yt.length;It<kt;It++){const St=yt[It],jt=xt[St.materialIndex];jt&&jt.visible&&m.push(E,ht,jt,B,Bt.z,St)}}else xt.visible&&m.push(E,ht,xt,B,Bt.z,null)}}const et=E.children;for(let ht=0,xt=et.length;ht<xt;ht++)aa(et[ht],D,B,H)}function Mh(E,D,B,H){const U=E.opaque,et=E.transmissive,ht=E.transparent;p.setupLightsView(B),Q===!0&&tt.setGlobalState(v.clippingPlanes,B),H&&At.viewport(R.copy(H)),U.length>0&&Lr(U,D,B),et.length>0&&Lr(et,D,B),ht.length>0&&Lr(ht,D,B),At.buffers.depth.setTest(!0),At.buffers.depth.setMask(!0),At.buffers.color.setMask(!0),At.setPolygonOffset(!1)}function bh(E,D,B,H){if((B.isScene===!0?B.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[H.id]===void 0&&(p.state.transmissionRenderTarget[H.id]=new Wi(1,1,{generateMipmaps:!0,type:Gt.has("EXT_color_buffer_half_float")||Gt.has("EXT_color_buffer_float")?Ar:jn,minFilter:Fi,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Yt.workingColorSpace}));const et=p.state.transmissionRenderTarget[H.id],ht=H.viewport||R;et.setSize(ht.z,ht.w);const xt=v.getRenderTarget();v.setRenderTarget(et),v.getClearColor(V),O=v.getClearAlpha(),O<1&&v.setClearColor(16777215,.5),v.clear(),Ut&&wt.render(B);const yt=v.toneMapping;v.toneMapping=pi;const It=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),p.setupLightsView(H),Q===!0&&tt.setGlobalState(v.clippingPlanes,H),Lr(E,B,H),C.updateMultisampleRenderTarget(et),C.updateRenderTargetMipmap(et),Gt.has("WEBGL_multisampled_render_to_texture")===!1){let kt=!1;for(let St=0,jt=D.length;St<jt;St++){const ce=D[St],fe=ce.object,$e=ce.geometry,Zt=ce.material,bt=ce.group;if(Zt.side===vn&&fe.layers.test(H.layers)){const Nn=Zt.side;Zt.side=je,Zt.needsUpdate=!0,Eh(fe,B,H,$e,Zt,bt),Zt.side=Nn,Zt.needsUpdate=!0,kt=!0}}kt===!0&&(C.updateMultisampleRenderTarget(et),C.updateRenderTargetMipmap(et))}v.setRenderTarget(xt),v.setClearColor(V,O),It!==void 0&&(H.viewport=It),v.toneMapping=yt}function Lr(E,D,B){const H=D.isScene===!0?D.overrideMaterial:null;for(let U=0,et=E.length;U<et;U++){const ht=E[U],xt=ht.object,yt=ht.geometry,It=H===null?ht.material:H,kt=ht.group;xt.layers.test(B.layers)&&Eh(xt,D,B,yt,It,kt)}}function Eh(E,D,B,H,U,et){E.onBeforeRender(v,D,B,H,U,et),E.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),U.onBeforeRender(v,D,B,H,E,et),U.transparent===!0&&U.side===vn&&U.forceSinglePass===!1?(U.side=je,U.needsUpdate=!0,v.renderBufferDirect(B,D,H,U,E,et),U.side=xi,U.needsUpdate=!0,v.renderBufferDirect(B,D,H,U,E,et),U.side=vn):v.renderBufferDirect(B,D,H,U,E,et),E.onAfterRender(v,D,B,H,U,et)}function Ir(E,D,B){D.isScene!==!0&&(D=oe);const H=Ct.get(E),U=p.state.lights,et=p.state.shadowsArray,ht=U.state.version,xt=Mt.getParameters(E,U.state,et,D,B),yt=Mt.getProgramCacheKey(xt);let It=H.programs;H.environment=E.isMeshStandardMaterial?D.environment:null,H.fog=D.fog,H.envMap=(E.isMeshStandardMaterial?z:b).get(E.envMap||H.environment),H.envMapRotation=H.environment!==null&&E.envMap===null?D.environmentRotation:E.envMapRotation,It===void 0&&(E.addEventListener("dispose",Ot),It=new Map,H.programs=It);let kt=It.get(yt);if(kt!==void 0){if(H.currentProgram===kt&&H.lightsStateVersion===ht)return Ch(E,xt),kt}else xt.uniforms=Mt.getUniforms(E),E.onBeforeCompile(xt,v),kt=Mt.acquireProgram(xt,yt),It.set(yt,kt),H.uniforms=xt.uniforms;const St=H.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(St.clippingPlanes=tt.uniform),Ch(E,xt),H.needsLights=bm(E),H.lightsStateVersion=ht,H.needsLights&&(St.ambientLightColor.value=U.state.ambient,St.lightProbe.value=U.state.probe,St.directionalLights.value=U.state.directional,St.directionalLightShadows.value=U.state.directionalShadow,St.spotLights.value=U.state.spot,St.spotLightShadows.value=U.state.spotShadow,St.rectAreaLights.value=U.state.rectArea,St.ltc_1.value=U.state.rectAreaLTC1,St.ltc_2.value=U.state.rectAreaLTC2,St.pointLights.value=U.state.point,St.pointLightShadows.value=U.state.pointShadow,St.hemisphereLights.value=U.state.hemi,St.directionalShadowMap.value=U.state.directionalShadowMap,St.directionalShadowMatrix.value=U.state.directionalShadowMatrix,St.spotShadowMap.value=U.state.spotShadowMap,St.spotLightMatrix.value=U.state.spotLightMatrix,St.spotLightMap.value=U.state.spotLightMap,St.pointShadowMap.value=U.state.pointShadowMap,St.pointShadowMatrix.value=U.state.pointShadowMatrix),H.currentProgram=kt,H.uniformsList=null,kt}function Th(E){if(E.uniformsList===null){const D=E.currentProgram.getUniforms();E.uniformsList=bo.seqWithValue(D.seq,E.uniforms)}return E.uniformsList}function Ch(E,D){const B=Ct.get(E);B.outputColorSpace=D.outputColorSpace,B.batching=D.batching,B.batchingColor=D.batchingColor,B.instancing=D.instancing,B.instancingColor=D.instancingColor,B.instancingMorph=D.instancingMorph,B.skinning=D.skinning,B.morphTargets=D.morphTargets,B.morphNormals=D.morphNormals,B.morphColors=D.morphColors,B.morphTargetsCount=D.morphTargetsCount,B.numClippingPlanes=D.numClippingPlanes,B.numIntersection=D.numClipIntersection,B.vertexAlphas=D.vertexAlphas,B.vertexTangents=D.vertexTangents,B.toneMapping=D.toneMapping}function Sm(E,D,B,H,U){D.isScene!==!0&&(D=oe),C.resetTextureUnits();const et=D.fog,ht=H.isMeshStandardMaterial?D.environment:null,xt=T===null?v.outputColorSpace:T.isXRRenderTarget===!0?T.texture.colorSpace:Vs,yt=(H.isMeshStandardMaterial?z:b).get(H.envMap||ht),It=H.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,kt=!!B.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),St=!!B.morphAttributes.position,jt=!!B.morphAttributes.normal,ce=!!B.morphAttributes.color;let fe=pi;H.toneMapped&&(T===null||T.isXRRenderTarget===!0)&&(fe=v.toneMapping);const $e=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,Zt=$e!==void 0?$e.length:0,bt=Ct.get(H),Nn=p.state.lights;if(Q===!0&&(vt===!0||E!==y)){const sn=E===y&&H.id===S;tt.setState(H,E,sn)}let Jt=!1;H.version===bt.__version?(bt.needsLights&&bt.lightsStateVersion!==Nn.state.version||bt.outputColorSpace!==xt||U.isBatchedMesh&&bt.batching===!1||!U.isBatchedMesh&&bt.batching===!0||U.isBatchedMesh&&bt.batchingColor===!0&&U.colorTexture===null||U.isBatchedMesh&&bt.batchingColor===!1&&U.colorTexture!==null||U.isInstancedMesh&&bt.instancing===!1||!U.isInstancedMesh&&bt.instancing===!0||U.isSkinnedMesh&&bt.skinning===!1||!U.isSkinnedMesh&&bt.skinning===!0||U.isInstancedMesh&&bt.instancingColor===!0&&U.instanceColor===null||U.isInstancedMesh&&bt.instancingColor===!1&&U.instanceColor!==null||U.isInstancedMesh&&bt.instancingMorph===!0&&U.morphTexture===null||U.isInstancedMesh&&bt.instancingMorph===!1&&U.morphTexture!==null||bt.envMap!==yt||H.fog===!0&&bt.fog!==et||bt.numClippingPlanes!==void 0&&(bt.numClippingPlanes!==tt.numPlanes||bt.numIntersection!==tt.numIntersection)||bt.vertexAlphas!==It||bt.vertexTangents!==kt||bt.morphTargets!==St||bt.morphNormals!==jt||bt.morphColors!==ce||bt.toneMapping!==fe||bt.morphTargetsCount!==Zt)&&(Jt=!0):(Jt=!0,bt.__version=H.version);let fn=bt.currentProgram;Jt===!0&&(fn=Ir(H,D,U));let Ji=!1,Ke=!1,Xs=!1;const pe=fn.getUniforms(),Mn=bt.uniforms;if(At.useProgram(fn.program)&&(Ji=!0,Ke=!0,Xs=!0),H.id!==S&&(S=H.id,Ke=!0),Ji||y!==E){At.buffers.depth.getReversed()?(st.copy(E.projectionMatrix),c0(st),l0(st),pe.setValue(N,"projectionMatrix",st)):pe.setValue(N,"projectionMatrix",E.projectionMatrix),pe.setValue(N,"viewMatrix",E.matrixWorldInverse);const Jn=pe.map.cameraPosition;Jn!==void 0&&Jn.setValue(N,Rt.setFromMatrixPosition(E.matrixWorld)),Wt.logarithmicDepthBuffer&&pe.setValue(N,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&pe.setValue(N,"isOrthographic",E.isOrthographicCamera===!0),y!==E&&(y=E,Ke=!0,Xs=!0)}if(U.isSkinnedMesh){pe.setOptional(N,U,"bindMatrix"),pe.setOptional(N,U,"bindMatrixInverse");const sn=U.skeleton;sn&&(sn.boneTexture===null&&sn.computeBoneTexture(),pe.setValue(N,"boneTexture",sn.boneTexture,C))}U.isBatchedMesh&&(pe.setOptional(N,U,"batchingTexture"),pe.setValue(N,"batchingTexture",U._matricesTexture,C),pe.setOptional(N,U,"batchingIdTexture"),pe.setValue(N,"batchingIdTexture",U._indirectTexture,C),pe.setOptional(N,U,"batchingColorTexture"),U._colorsTexture!==null&&pe.setValue(N,"batchingColorTexture",U._colorsTexture,C));const $s=B.morphAttributes;if(($s.position!==void 0||$s.normal!==void 0||$s.color!==void 0)&&Pt.update(U,B,fn),(Ke||bt.receiveShadow!==U.receiveShadow)&&(bt.receiveShadow=U.receiveShadow,pe.setValue(N,"receiveShadow",U.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(Mn.envMap.value=yt,Mn.flipEnvMap.value=yt.isCubeTexture&&yt.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&D.environment!==null&&(Mn.envMapIntensity.value=D.environmentIntensity),Ke&&(pe.setValue(N,"toneMappingExposure",v.toneMappingExposure),bt.needsLights&&Mm(Mn,Xs),et&&H.fog===!0&&at.refreshFogUniforms(Mn,et),at.refreshMaterialUniforms(Mn,H,G,K,p.state.transmissionRenderTarget[E.id]),bo.upload(N,Th(bt),Mn,C)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(bo.upload(N,Th(bt),Mn,C),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&pe.setValue(N,"center",U.center),pe.setValue(N,"modelViewMatrix",U.modelViewMatrix),pe.setValue(N,"normalMatrix",U.normalMatrix),pe.setValue(N,"modelMatrix",U.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const sn=H.uniformsGroups;for(let Jn=0,Qn=sn.length;Jn<Qn;Jn++){const Ah=sn[Jn];I.update(Ah,fn),I.bind(Ah,fn)}}return fn}function Mm(E,D){E.ambientLightColor.needsUpdate=D,E.lightProbe.needsUpdate=D,E.directionalLights.needsUpdate=D,E.directionalLightShadows.needsUpdate=D,E.pointLights.needsUpdate=D,E.pointLightShadows.needsUpdate=D,E.spotLights.needsUpdate=D,E.spotLightShadows.needsUpdate=D,E.rectAreaLights.needsUpdate=D,E.hemisphereLights.needsUpdate=D}function bm(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return w},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return T},this.setRenderTargetTextures=function(E,D,B){Ct.get(E.texture).__webglTexture=D,Ct.get(E.depthTexture).__webglTexture=B;const H=Ct.get(E);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=B===void 0,H.__autoAllocateDepthBuffer||Gt.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,D){const B=Ct.get(E);B.__webglFramebuffer=D,B.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(E,D=0,B=0){T=E,w=D,A=B;let H=!0,U=null,et=!1,ht=!1;if(E){const yt=Ct.get(E);if(yt.__useDefaultFramebuffer!==void 0)At.bindFramebuffer(N.FRAMEBUFFER,null),H=!1;else if(yt.__webglFramebuffer===void 0)C.setupRenderTarget(E);else if(yt.__hasExternalTextures)C.rebindTextures(E,Ct.get(E.texture).__webglTexture,Ct.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){const St=E.depthTexture;if(yt.__boundDepthTexture!==St){if(St!==null&&Ct.has(St)&&(E.width!==St.image.width||E.height!==St.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");C.setupDepthRenderbuffer(E)}}const It=E.texture;(It.isData3DTexture||It.isDataArrayTexture||It.isCompressedArrayTexture)&&(ht=!0);const kt=Ct.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(kt[D])?U=kt[D][B]:U=kt[D],et=!0):E.samples>0&&C.useMultisampledRTT(E)===!1?U=Ct.get(E).__webglMultisampledFramebuffer:Array.isArray(kt)?U=kt[B]:U=kt,R.copy(E.viewport),F.copy(E.scissor),k=E.scissorTest}else R.copy(_t).multiplyScalar(G).floor(),F.copy(Lt).multiplyScalar(G).floor(),k=Qt;if(At.bindFramebuffer(N.FRAMEBUFFER,U)&&H&&At.drawBuffers(E,U),At.viewport(R),At.scissor(F),At.setScissorTest(k),et){const yt=Ct.get(E.texture);N.framebufferTexture2D(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_CUBE_MAP_POSITIVE_X+D,yt.__webglTexture,B)}else if(ht){const yt=Ct.get(E.texture),It=D||0;N.framebufferTextureLayer(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,yt.__webglTexture,B||0,It)}S=-1},this.readRenderTargetPixels=function(E,D,B,H,U,et,ht){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let xt=Ct.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ht!==void 0&&(xt=xt[ht]),xt){At.bindFramebuffer(N.FRAMEBUFFER,xt);try{const yt=E.texture,It=yt.format,kt=yt.type;if(!Wt.textureFormatReadable(It)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Wt.textureTypeReadable(kt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=E.width-H&&B>=0&&B<=E.height-U&&N.readPixels(D,B,H,U,Ht.convert(It),Ht.convert(kt),et)}finally{const yt=T!==null?Ct.get(T).__webglFramebuffer:null;At.bindFramebuffer(N.FRAMEBUFFER,yt)}}},this.readRenderTargetPixelsAsync=async function(E,D,B,H,U,et,ht){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let xt=Ct.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ht!==void 0&&(xt=xt[ht]),xt){const yt=E.texture,It=yt.format,kt=yt.type;if(!Wt.textureFormatReadable(It))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Wt.textureTypeReadable(kt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(D>=0&&D<=E.width-H&&B>=0&&B<=E.height-U){At.bindFramebuffer(N.FRAMEBUFFER,xt);const St=N.createBuffer();N.bindBuffer(N.PIXEL_PACK_BUFFER,St),N.bufferData(N.PIXEL_PACK_BUFFER,et.byteLength,N.STREAM_READ),N.readPixels(D,B,H,U,Ht.convert(It),Ht.convert(kt),0);const jt=T!==null?Ct.get(T).__webglFramebuffer:null;At.bindFramebuffer(N.FRAMEBUFFER,jt);const ce=N.fenceSync(N.SYNC_GPU_COMMANDS_COMPLETE,0);return N.flush(),await a0(N,ce,4),N.bindBuffer(N.PIXEL_PACK_BUFFER,St),N.getBufferSubData(N.PIXEL_PACK_BUFFER,0,et),N.deleteBuffer(St),N.deleteSync(ce),et}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,D=null,B=0){E.isTexture!==!0&&(sr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),D=arguments[0]||null,E=arguments[1]);const H=Math.pow(2,-B),U=Math.floor(E.image.width*H),et=Math.floor(E.image.height*H),ht=D!==null?D.x:0,xt=D!==null?D.y:0;C.setTexture2D(E,0),N.copyTexSubImage2D(N.TEXTURE_2D,B,0,0,ht,xt,U,et),At.unbindTexture()},this.copyTextureToTexture=function(E,D,B=null,H=null,U=0){E.isTexture!==!0&&(sr("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,E=arguments[1],D=arguments[2],U=arguments[3]||0,B=null);let et,ht,xt,yt,It,kt,St,jt,ce;const fe=E.isCompressedTexture?E.mipmaps[U]:E.image;B!==null?(et=B.max.x-B.min.x,ht=B.max.y-B.min.y,xt=B.isBox3?B.max.z-B.min.z:1,yt=B.min.x,It=B.min.y,kt=B.isBox3?B.min.z:0):(et=fe.width,ht=fe.height,xt=fe.depth||1,yt=0,It=0,kt=0),H!==null?(St=H.x,jt=H.y,ce=H.z):(St=0,jt=0,ce=0);const $e=Ht.convert(D.format),Zt=Ht.convert(D.type);let bt;D.isData3DTexture?(C.setTexture3D(D,0),bt=N.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(C.setTexture2DArray(D,0),bt=N.TEXTURE_2D_ARRAY):(C.setTexture2D(D,0),bt=N.TEXTURE_2D),N.pixelStorei(N.UNPACK_FLIP_Y_WEBGL,D.flipY),N.pixelStorei(N.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),N.pixelStorei(N.UNPACK_ALIGNMENT,D.unpackAlignment);const Nn=N.getParameter(N.UNPACK_ROW_LENGTH),Jt=N.getParameter(N.UNPACK_IMAGE_HEIGHT),fn=N.getParameter(N.UNPACK_SKIP_PIXELS),Ji=N.getParameter(N.UNPACK_SKIP_ROWS),Ke=N.getParameter(N.UNPACK_SKIP_IMAGES);N.pixelStorei(N.UNPACK_ROW_LENGTH,fe.width),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,fe.height),N.pixelStorei(N.UNPACK_SKIP_PIXELS,yt),N.pixelStorei(N.UNPACK_SKIP_ROWS,It),N.pixelStorei(N.UNPACK_SKIP_IMAGES,kt);const Xs=E.isDataArrayTexture||E.isData3DTexture,pe=D.isDataArrayTexture||D.isData3DTexture;if(E.isRenderTargetTexture||E.isDepthTexture){const Mn=Ct.get(E),$s=Ct.get(D),sn=Ct.get(Mn.__renderTarget),Jn=Ct.get($s.__renderTarget);At.bindFramebuffer(N.READ_FRAMEBUFFER,sn.__webglFramebuffer),At.bindFramebuffer(N.DRAW_FRAMEBUFFER,Jn.__webglFramebuffer);for(let Qn=0;Qn<xt;Qn++)Xs&&N.framebufferTextureLayer(N.READ_FRAMEBUFFER,N.COLOR_ATTACHMENT0,Ct.get(E).__webglTexture,U,kt+Qn),E.isDepthTexture?(pe&&N.framebufferTextureLayer(N.DRAW_FRAMEBUFFER,N.COLOR_ATTACHMENT0,Ct.get(D).__webglTexture,U,ce+Qn),N.blitFramebuffer(yt,It,et,ht,St,jt,et,ht,N.DEPTH_BUFFER_BIT,N.NEAREST)):pe?N.copyTexSubImage3D(bt,U,St,jt,ce+Qn,yt,It,et,ht):N.copyTexSubImage2D(bt,U,St,jt,ce+Qn,yt,It,et,ht);At.bindFramebuffer(N.READ_FRAMEBUFFER,null),At.bindFramebuffer(N.DRAW_FRAMEBUFFER,null)}else pe?E.isDataTexture||E.isData3DTexture?N.texSubImage3D(bt,U,St,jt,ce,et,ht,xt,$e,Zt,fe.data):D.isCompressedArrayTexture?N.compressedTexSubImage3D(bt,U,St,jt,ce,et,ht,xt,$e,fe.data):N.texSubImage3D(bt,U,St,jt,ce,et,ht,xt,$e,Zt,fe):E.isDataTexture?N.texSubImage2D(N.TEXTURE_2D,U,St,jt,et,ht,$e,Zt,fe.data):E.isCompressedTexture?N.compressedTexSubImage2D(N.TEXTURE_2D,U,St,jt,fe.width,fe.height,$e,fe.data):N.texSubImage2D(N.TEXTURE_2D,U,St,jt,et,ht,$e,Zt,fe);N.pixelStorei(N.UNPACK_ROW_LENGTH,Nn),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,Jt),N.pixelStorei(N.UNPACK_SKIP_PIXELS,fn),N.pixelStorei(N.UNPACK_SKIP_ROWS,Ji),N.pixelStorei(N.UNPACK_SKIP_IMAGES,Ke),U===0&&D.generateMipmaps&&N.generateMipmap(bt),At.unbindTexture()},this.copyTextureToTexture3D=function(E,D,B=null,H=null,U=0){return E.isTexture!==!0&&(sr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),B=arguments[0]||null,H=arguments[1]||null,E=arguments[2],D=arguments[3],U=arguments[4]||0),sr('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(E,D,B,H,U)},this.initRenderTarget=function(E){Ct.get(E).__webglFramebuffer===void 0&&C.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?C.setTextureCube(E,0):E.isData3DTexture?C.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?C.setTexture2DArray(E,0):C.setTexture2D(E,0),At.unbindTexture()},this.resetState=function(){w=0,A=0,T=null,At.reset(),ae.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Wn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Yt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Yt._getUnpackColorSpace()}}class ih{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new Ft(t),this.near=e,this.far=n}clone(){return new ih(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class vS extends Me{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new un,this.environmentIntensity=1,this.environmentRotation=new un,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Lf{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=el,this.updateRanges=[],this.version=0,this.uuid=$n()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=$n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=$n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const He=new P;class Rn{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)He.fromBufferAttribute(this,e),He.applyMatrix4(t),this.setXYZ(e,He.x,He.y,He.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)He.fromBufferAttribute(this,e),He.applyNormalMatrix(t),this.setXYZ(e,He.x,He.y,He.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)He.fromBufferAttribute(this,e),He.transformDirection(t),this.setXYZ(e,He.x,He.y,He.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=xn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=ne(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=ne(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=ne(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=ne(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=ne(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=xn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=xn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=xn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=xn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array),s=ne(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=ne(e,this.array),n=ne(n,this.array),s=ne(s,this.array),r=ne(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new en(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Rn(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class If extends yi{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new Ft(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let ps;const Zs=new P,ms=new P,gs=new P,_s=new ct,Js=new ct,Df=new qt,no=new P,Qs=new P,io=new P,Hu=new ct,Ha=new ct,Vu=new ct;class xS extends Me{constructor(t=new If){if(super(),this.isSprite=!0,this.type="Sprite",ps===void 0){ps=new Ie;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Lf(e,5);ps.setIndex([0,1,2,0,2,3]),ps.setAttribute("position",new Rn(n,3,0,!1)),ps.setAttribute("uv",new Rn(n,2,3,!1))}this.geometry=ps,this.material=t,this.center=new ct(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ms.setFromMatrixScale(this.matrixWorld),Df.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),gs.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ms.multiplyScalar(-gs.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const o=this.center;so(no.set(-.5,-.5,0),gs,o,ms,s,r),so(Qs.set(.5,-.5,0),gs,o,ms,s,r),so(io.set(.5,.5,0),gs,o,ms,s,r),Hu.set(0,0),Ha.set(1,0),Vu.set(1,1);let a=t.ray.intersectTriangle(no,Qs,io,!1,Zs);if(a===null&&(so(Qs.set(-.5,.5,0),gs,o,ms,s,r),Ha.set(0,1),a=t.ray.intersectTriangle(no,io,Qs,!1,Zs),a===null))return;const c=t.ray.origin.distanceTo(Zs);c<t.near||c>t.far||e.push({distance:c,point:Zs.clone(),uv:hn.getInterpolation(Zs,no,Qs,io,Hu,Ha,Vu,new ct),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function so(i,t,e,n,s,r){_s.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(Js.x=r*_s.x-s*_s.y,Js.y=s*_s.x+r*_s.y):Js.copy(_s),i.copy(t),i.x+=Js.x,i.y+=Js.y,i.applyMatrix4(Df)}class yS extends ze{constructor(t=null,e=1,n=1,s,r,o,a,c,l=tn,h=tn,u,d){super(null,o,a,c,l,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class pr extends en{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const vs=new qt,Gu=new qt,ro=[],Wu=new In,SS=new qt,tr=new ie,er=new Zn;class Fo extends ie{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new pr(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,SS)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new In),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,vs),Wu.copy(t.boundingBox).applyMatrix4(vs),this.boundingBox.union(Wu)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Zn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,vs),er.copy(t.boundingSphere).applyMatrix4(vs),this.boundingSphere.union(er)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){const n=this.matrixWorld,s=this.count;if(tr.geometry=this.geometry,tr.material=this.material,tr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),er.copy(this.boundingSphere),er.applyMatrix4(n),t.ray.intersectsSphere(er)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,vs),Gu.multiplyMatrices(n,vs),tr.matrixWorld=Gu,tr.raycast(t,ro);for(let o=0,a=ro.length;o<a;o++){const c=ro[o];c.instanceId=r,c.object=this,e.push(c)}ro.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new pr(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new yS(new Float32Array(s*this.count),s,this.count,ql,wn));const r=this.morphTexture.source.data.data;let o=0;for(let l=0;l<n.length;l++)o+=n[l];const a=this.geometry.morphTargetsRelative?1:1-o,c=s*t;r[c]=a,r.set(n,c+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class Uf extends yi{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new Ft(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const Bo=new P,Ho=new P,Xu=new qt,nr=new gf,oo=new Zn,Va=new P,$u=new P;class MS extends Me{constructor(t=new Ie,e=new Uf){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)Bo.fromBufferAttribute(e,s-1),Ho.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=Bo.distanceTo(Ho);t.setAttribute("lineDistance",new he(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),oo.copy(n.boundingSphere),oo.applyMatrix4(s),oo.radius+=r,t.ray.intersectsSphere(oo)===!1)return;Xu.copy(s).invert(),nr.copy(t.ray).applyMatrix4(Xu);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){const f=Math.max(0,o.start),g=Math.min(h.count,o.start+o.count);for(let _=f,m=g-1;_<m;_+=l){const p=h.getX(_),x=h.getX(_+1),M=ao(this,t,nr,c,p,x);M&&e.push(M)}if(this.isLineLoop){const _=h.getX(g-1),m=h.getX(f),p=ao(this,t,nr,c,_,m);p&&e.push(p)}}else{const f=Math.max(0,o.start),g=Math.min(d.count,o.start+o.count);for(let _=f,m=g-1;_<m;_+=l){const p=ao(this,t,nr,c,_,_+1);p&&e.push(p)}if(this.isLineLoop){const _=ao(this,t,nr,c,g-1,f);_&&e.push(_)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function ao(i,t,e,n,s,r){const o=i.geometry.attributes.position;if(Bo.fromBufferAttribute(o,s),Ho.fromBufferAttribute(o,r),e.distanceSqToSegment(Bo,Ho,Va,$u)>n)return;Va.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Va);if(!(c<t.near||c>t.far))return{distance:c,point:$u.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}class na extends ze{constructor(t,e,n,s,r,o,a,c,l){super(t,e,n,s,r,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Dn{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let s=0;const r=n.length;let o;e?o=e:o=t*n[r-1];let a=0,c=r-1,l;for(;a<=c;)if(s=Math.floor(a+(c-a)/2),l=n[s]-o,l<0)a=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,n[s]===o)return s/(r-1);const h=n[s],d=n[s+1]-h,f=(o-h)/d;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);const o=this.getPoint(s),a=this.getPoint(r),c=e||(o.isVector2?new ct:new P);return c.copy(a).sub(o).normalize(),c}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new P,s=[],r=[],o=[],a=new P,c=new qt;for(let f=0;f<=t;f++){const g=f/t;s[f]=this.getTangentAt(g,new P)}r[0]=new P,o[0]=new P;let l=Number.MAX_VALUE;const h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(s[f-1],s[f]),a.length()>Number.EPSILON){a.normalize();const g=Math.acos(Se(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(c.makeRotationAxis(a,g))}o[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(Se(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(c.makeRotationAxis(s[g],f*g)),o[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class sh extends Dn{constructor(t=0,e=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=c}getPoint(t,e=new ct){const n=e,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);const a=this.aStartAngle+t*r;let c=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,f=l-this.aY;c=d*h-f*u+this.aX,l=d*u+f*h+this.aY}return n.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class bS extends sh{constructor(t,e,n,s,r,o){super(t,e,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}}function rh(){let i=0,t=0,e=0,n=0;function s(r,o,a,c){i=r,t=a,e=-3*r+3*o-2*a-c,n=2*r-2*o+a+c}return{initCatmullRom:function(r,o,a,c,l){s(o,a,l*(a-r),l*(c-o))},initNonuniformCatmullRom:function(r,o,a,c,l,h,u){let d=(o-r)/l-(a-r)/(l+h)+(a-o)/h,f=(a-o)/h-(c-o)/(h+u)+(c-a)/u;d*=h,f*=h,s(o,a,d,f)},calc:function(r){const o=r*r,a=o*r;return i+t*r+e*o+n*a}}}const co=new P,Ga=new rh,Wa=new rh,Xa=new rh;class ES extends Dn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new P){const n=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t;let a=Math.floor(o),c=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:c===0&&a===r-1&&(a=r-2,c=1);let l,h;this.closed||a>0?l=s[(a-1)%r]:(co.subVectors(s[0],s[1]).add(s[0]),l=co);const u=s[a%r],d=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(co.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=co),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let g=Math.pow(l.distanceToSquared(u),f),_=Math.pow(u.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(h),f);_<1e-4&&(_=1),g<1e-4&&(g=_),m<1e-4&&(m=_),Ga.initNonuniformCatmullRom(l.x,u.x,d.x,h.x,g,_,m),Wa.initNonuniformCatmullRom(l.y,u.y,d.y,h.y,g,_,m),Xa.initNonuniformCatmullRom(l.z,u.z,d.z,h.z,g,_,m)}else this.curveType==="catmullrom"&&(Ga.initCatmullRom(l.x,u.x,d.x,h.x,this.tension),Wa.initCatmullRom(l.y,u.y,d.y,h.y,this.tension),Xa.initCatmullRom(l.z,u.z,d.z,h.z,this.tension));return n.set(Ga.calc(c),Wa.calc(c),Xa.calc(c)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new P().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function Yu(i,t,e,n,s){const r=(n-t)*.5,o=(s-e)*.5,a=i*i,c=i*a;return(2*e-2*n+r+o)*c+(-3*e+3*n-2*r-o)*a+r*i+e}function TS(i,t){const e=1-i;return e*e*t}function CS(i,t){return 2*(1-i)*i*t}function AS(i,t){return i*i*t}function mr(i,t,e,n){return TS(i,t)+CS(i,e)+AS(i,n)}function wS(i,t){const e=1-i;return e*e*e*t}function RS(i,t){const e=1-i;return 3*e*e*i*t}function PS(i,t){return 3*(1-i)*i*i*t}function LS(i,t){return i*i*i*t}function gr(i,t,e,n,s){return wS(i,t)+RS(i,e)+PS(i,n)+LS(i,s)}class Nf extends Dn{constructor(t=new ct,e=new ct,n=new ct,s=new ct){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new ct){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(gr(t,s.x,r.x,o.x,a.x),gr(t,s.y,r.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class IS extends Dn{constructor(t=new P,e=new P,n=new P,s=new P){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new P){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(gr(t,s.x,r.x,o.x,a.x),gr(t,s.y,r.y,o.y,a.y),gr(t,s.z,r.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Of extends Dn{constructor(t=new ct,e=new ct){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new ct){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new ct){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class DS extends Dn{constructor(t=new P,e=new P){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new P){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new P){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class kf extends Dn{constructor(t=new ct,e=new ct,n=new ct){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new ct){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(mr(t,s.x,r.x,o.x),mr(t,s.y,r.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class US extends Dn{constructor(t=new P,e=new P,n=new P){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new P){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(mr(t,s.x,r.x,o.x),mr(t,s.y,r.y,o.y),mr(t,s.z,r.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class zf extends Dn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new ct){const n=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,c=s[o===0?o:o-1],l=s[o],h=s[o>s.length-2?s.length-1:o+1],u=s[o>s.length-3?s.length-1:o+2];return n.set(Yu(a,c.x,l.x,h.x,u.x),Yu(a,c.y,l.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new ct().fromArray(s))}return this}}var qu=Object.freeze({__proto__:null,ArcCurve:bS,CatmullRomCurve3:ES,CubicBezierCurve:Nf,CubicBezierCurve3:IS,EllipseCurve:sh,LineCurve:Of,LineCurve3:DS,QuadraticBezierCurve:kf,QuadraticBezierCurve3:US,SplineCurve:zf});class NS extends Dn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new qu[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const o=s[r]-n,a=this.curves[r],c=a.getLength(),l=c===0?0:1-o/c;return a.getPointAt(l,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,c=o.getPoints(a);for(let l=0;l<c.length;l++){const h=c[l];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(new qu[s.type]().fromJSON(s))}return this}}class OS extends NS{constructor(t){super(),this.type="Path",this.currentPoint=new ct,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new Of(this.currentPoint.clone(),new ct(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){const r=new kf(this.currentPoint.clone(),new ct(t,e),new ct(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,o){const a=new Nf(this.currentPoint.clone(),new ct(t,e),new ct(n,s),new ct(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new zf(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,o){const a=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(t+a,e+c,n,s,r,o),this}absarc(t,e,n,s,r,o){return this.absellipse(t,e,n,n,s,r,o),this}ellipse(t,e,n,s,r,o,a,c){const l=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+l,e+h,n,s,r,o,a,c),this}absellipse(t,e,n,s,r,o,a,c){const l=new sh(t,e,n,s,r,o,a,c);if(this.curves.length>0){const u=l.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(l);const h=l.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class oh extends Ie{constructor(t=[new ct(0,-.5),new ct(.5,0),new ct(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=Se(s,0,Math.PI*2);const r=[],o=[],a=[],c=[],l=[],h=1/e,u=new P,d=new ct,f=new P,g=new P,_=new P;let m=0,p=0;for(let x=0;x<=t.length-1;x++)switch(x){case 0:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,_.copy(f),f.normalize(),c.push(f.x,f.y,f.z);break;case t.length-1:c.push(_.x,_.y,_.z);break;default:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,g.copy(f),f.x+=_.x,f.y+=_.y,f.z+=_.z,f.normalize(),c.push(f.x,f.y,f.z),_.copy(g)}for(let x=0;x<=e;x++){const M=n+x*h*s,v=Math.sin(M),L=Math.cos(M);for(let w=0;w<=t.length-1;w++){u.x=t[w].x*v,u.y=t[w].y,u.z=t[w].x*L,o.push(u.x,u.y,u.z),d.x=x/e,d.y=w/(t.length-1),a.push(d.x,d.y);const A=c[3*w+0]*v,T=c[3*w+1],S=c[3*w+0]*L;l.push(A,T,S)}}for(let x=0;x<e;x++)for(let M=0;M<t.length-1;M++){const v=M+x*t.length,L=v,w=v+t.length,A=v+t.length+1,T=v+1;r.push(L,w,T),r.push(A,T,w)}this.setIndex(r),this.setAttribute("position",new he(o,3)),this.setAttribute("uv",new he(a,2)),this.setAttribute("normal",new he(l,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new oh(t.points,t.segments,t.phiStart,t.phiLength)}}class ah extends oh{constructor(t=1,e=1,n=4,s=8){const r=new OS;r.absarc(0,-e/2,t,Math.PI*1.5,0),r.absarc(0,e/2,t,0,Math.PI*.5),super(r.getPoints(n),s),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:n,radialSegments:s}}static fromJSON(t){return new ah(t.radius,t.length,t.capSegments,t.radialSegments)}}class Hs extends Ie{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:c};const l=this;s=Math.floor(s),r=Math.floor(r);const h=[],u=[],d=[],f=[];let g=0;const _=[],m=n/2;let p=0;x(),o===!1&&(t>0&&M(!0),e>0&&M(!1)),this.setIndex(h),this.setAttribute("position",new he(u,3)),this.setAttribute("normal",new he(d,3)),this.setAttribute("uv",new he(f,2));function x(){const v=new P,L=new P;let w=0;const A=(e-t)/n;for(let T=0;T<=r;T++){const S=[],y=T/r,R=y*(e-t)+t;for(let F=0;F<=s;F++){const k=F/s,V=k*c+a,O=Math.sin(V),W=Math.cos(V);L.x=R*O,L.y=-y*n+m,L.z=R*W,u.push(L.x,L.y,L.z),v.set(O,A,W).normalize(),d.push(v.x,v.y,v.z),f.push(k,1-y),S.push(g++)}_.push(S)}for(let T=0;T<s;T++)for(let S=0;S<r;S++){const y=_[S][T],R=_[S+1][T],F=_[S+1][T+1],k=_[S][T+1];(t>0||S!==0)&&(h.push(y,R,k),w+=3),(e>0||S!==r-1)&&(h.push(R,F,k),w+=3)}l.addGroup(p,w,0),p+=w}function M(v){const L=g,w=new ct,A=new P;let T=0;const S=v===!0?t:e,y=v===!0?1:-1;for(let F=1;F<=s;F++)u.push(0,m*y,0),d.push(0,y,0),f.push(.5,.5),g++;const R=g;for(let F=0;F<=s;F++){const V=F/s*c+a,O=Math.cos(V),W=Math.sin(V);A.x=S*W,A.y=m*y,A.z=S*O,u.push(A.x,A.y,A.z),d.push(0,y,0),w.x=O*.5+.5,w.y=W*.5*y+.5,f.push(w.x,w.y),g++}for(let F=0;F<s;F++){const k=L+F,V=R+F;v===!0?h.push(V,V+1,k):h.push(V+1,V,k),T+=3}l.addGroup(p,T,v===!0?1:2),p+=T}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Hs(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class ch extends Ie{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};const r=[],o=[];a(s),l(n),h(),this.setAttribute("position",new he(r,3)),this.setAttribute("normal",new he(r.slice(),3)),this.setAttribute("uv",new he(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(x){const M=new P,v=new P,L=new P;for(let w=0;w<e.length;w+=3)f(e[w+0],M),f(e[w+1],v),f(e[w+2],L),c(M,v,L,x)}function c(x,M,v,L){const w=L+1,A=[];for(let T=0;T<=w;T++){A[T]=[];const S=x.clone().lerp(v,T/w),y=M.clone().lerp(v,T/w),R=w-T;for(let F=0;F<=R;F++)F===0&&T===w?A[T][F]=S:A[T][F]=S.clone().lerp(y,F/R)}for(let T=0;T<w;T++)for(let S=0;S<2*(w-T)-1;S++){const y=Math.floor(S/2);S%2===0?(d(A[T][y+1]),d(A[T+1][y]),d(A[T][y])):(d(A[T][y+1]),d(A[T+1][y+1]),d(A[T+1][y]))}}function l(x){const M=new P;for(let v=0;v<r.length;v+=3)M.x=r[v+0],M.y=r[v+1],M.z=r[v+2],M.normalize().multiplyScalar(x),r[v+0]=M.x,r[v+1]=M.y,r[v+2]=M.z}function h(){const x=new P;for(let M=0;M<r.length;M+=3){x.x=r[M+0],x.y=r[M+1],x.z=r[M+2];const v=m(x)/2/Math.PI+.5,L=p(x)/Math.PI+.5;o.push(v,1-L)}g(),u()}function u(){for(let x=0;x<o.length;x+=6){const M=o[x+0],v=o[x+2],L=o[x+4],w=Math.max(M,v,L),A=Math.min(M,v,L);w>.9&&A<.1&&(M<.2&&(o[x+0]+=1),v<.2&&(o[x+2]+=1),L<.2&&(o[x+4]+=1))}}function d(x){r.push(x.x,x.y,x.z)}function f(x,M){const v=x*3;M.x=t[v+0],M.y=t[v+1],M.z=t[v+2]}function g(){const x=new P,M=new P,v=new P,L=new P,w=new ct,A=new ct,T=new ct;for(let S=0,y=0;S<r.length;S+=9,y+=6){x.set(r[S+0],r[S+1],r[S+2]),M.set(r[S+3],r[S+4],r[S+5]),v.set(r[S+6],r[S+7],r[S+8]),w.set(o[y+0],o[y+1]),A.set(o[y+2],o[y+3]),T.set(o[y+4],o[y+5]),L.copy(x).add(M).add(v).divideScalar(3);const R=m(L);_(w,y+0,x,R),_(A,y+2,M,R),_(T,y+4,v,R)}}function _(x,M,v,L){L<0&&x.x===1&&(o[M]=x.x-1),v.x===0&&v.z===0&&(o[M]=L/2/Math.PI+.5)}function m(x){return Math.atan2(x.z,-x.x)}function p(x){return Math.atan2(-x.y,Math.sqrt(x.x*x.x+x.z*x.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ch(t.vertices,t.indices,t.radius,t.details)}}class lh extends ch{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new lh(t.radius,t.detail)}}class wr extends Ie{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const c=Math.min(o+a,Math.PI);let l=0;const h=[],u=new P,d=new P,f=[],g=[],_=[],m=[];for(let p=0;p<=n;p++){const x=[],M=p/n;let v=0;p===0&&o===0?v=.5/e:p===n&&c===Math.PI&&(v=-.5/e);for(let L=0;L<=e;L++){const w=L/e;u.x=-t*Math.cos(s+w*r)*Math.sin(o+M*a),u.y=t*Math.cos(o+M*a),u.z=t*Math.sin(s+w*r)*Math.sin(o+M*a),g.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(w+v,1-M),x.push(l++)}h.push(x)}for(let p=0;p<n;p++)for(let x=0;x<e;x++){const M=h[p][x+1],v=h[p][x],L=h[p+1][x],w=h[p+1][x+1];(p!==0||o>0)&&f.push(M,v,w),(p!==n-1||c<Math.PI)&&f.push(v,L,w)}this.setIndex(f),this.setAttribute("position",new he(g,3)),this.setAttribute("normal",new he(_,3)),this.setAttribute("uv",new he(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new wr(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class hh extends Ie{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const o=[],a=[],c=[],l=[],h=new P,u=new P,d=new P;for(let f=0;f<=n;f++)for(let g=0;g<=s;g++){const _=g/s*r,m=f/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(_),u.y=(t+e*Math.cos(m))*Math.sin(_),u.z=e*Math.sin(m),a.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),d.subVectors(u,h).normalize(),c.push(d.x,d.y,d.z),l.push(g/s),l.push(f/n)}for(let f=1;f<=n;f++)for(let g=1;g<=s;g++){const _=(s+1)*f+g-1,m=(s+1)*(f-1)+g-1,p=(s+1)*(f-1)+g,x=(s+1)*f+g;o.push(_,m,x),o.push(m,p,x)}this.setIndex(o),this.setAttribute("position",new he(a,3)),this.setAttribute("normal",new he(c,3)),this.setAttribute("uv",new he(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new hh(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class kS extends Ie{constructor(t=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:t},t!==null){const e=[],n=new Set,s=new P,r=new P;if(t.index!==null){const o=t.attributes.position,a=t.index;let c=t.groups;c.length===0&&(c=[{start:0,count:a.count,materialIndex:0}]);for(let l=0,h=c.length;l<h;++l){const u=c[l],d=u.start,f=u.count;for(let g=d,_=d+f;g<_;g+=3)for(let m=0;m<3;m++){const p=a.getX(g+m),x=a.getX(g+(m+1)%3);s.fromBufferAttribute(o,p),r.fromBufferAttribute(o,x),ju(s,r,n)===!0&&(e.push(s.x,s.y,s.z),e.push(r.x,r.y,r.z))}}}else{const o=t.attributes.position;for(let a=0,c=o.count/3;a<c;a++)for(let l=0;l<3;l++){const h=3*a+l,u=3*a+(l+1)%3;s.fromBufferAttribute(o,h),r.fromBufferAttribute(o,u),ju(s,r,n)===!0&&(e.push(s.x,s.y,s.z),e.push(r.x,r.y,r.z))}}this.setAttribute("position",new he(e,3))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}}function ju(i,t,e){const n=`${i.x},${i.y},${i.z}-${t.x},${t.y},${t.z}`,s=`${t.x},${t.y},${t.z}-${i.x},${i.y},${i.z}`;return e.has(n)===!0||e.has(s)===!0?!1:(e.add(n),e.add(s),!0)}class _r extends yi{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Ft(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ft(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Jl,this.normalScale=new ct(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new un,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Gn extends yi{static get type(){return"MeshLambertMaterial"}constructor(t){super(),this.isMeshLambertMaterial=!0,this.color=new Ft(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ft(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Jl,this.normalScale=new ct(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new un,this.combine=Wl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class zS extends Uf{static get type(){return"LineDashedMaterial"}constructor(t){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}}class Ff extends Me{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ft(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class FS extends Ff{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Me.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ft(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const $a=new qt,Ku=new P,Zu=new P;class BS{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ct(512,512),this.map=null,this.mapPass=null,this.matrix=new qt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new eh,this._frameExtents=new ct(1,1),this._viewportCount=1,this._viewports=[new re(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;Ku.setFromMatrixPosition(t.matrixWorld),e.position.copy(Ku),Zu.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Zu),e.updateMatrixWorld(),$a.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix($a),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply($a)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class HS extends BS{constructor(){super(new Tf(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class VS extends Ff{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Me.DEFAULT_UP),this.updateMatrix(),this.target=new Me,this.shadow=new HS}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class GS extends Ie{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(t){return super.copy(t),this.instanceCount=t.instanceCount,this}toJSON(){const t=super.toJSON();return t.instanceCount=this.instanceCount,t.isInstancedBufferGeometry=!0,t}}class il extends Lf{constructor(t,e,n=1){super(t,e),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}clone(t){const e=super.clone(t);return e.meshPerAttribute=this.meshPerAttribute,e}toJSON(t){const e=super.toJSON(t);return e.isInstancedInterleavedBuffer=!0,e.meshPerAttribute=this.meshPerAttribute,e}}const Ju=new P,lo=new P;class WS{constructor(t=new P,e=new P){this.start=t,this.end=e}set(t,e){return this.start.copy(t),this.end.copy(e),this}copy(t){return this.start.copy(t.start),this.end.copy(t.end),this}getCenter(t){return t.addVectors(this.start,this.end).multiplyScalar(.5)}delta(t){return t.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(t,e){return this.delta(e).multiplyScalar(t).add(this.start)}closestPointToPointParameter(t,e){Ju.subVectors(t,this.start),lo.subVectors(this.end,this.start);const n=lo.dot(lo);let r=lo.dot(Ju)/n;return e&&(r=Se(r,0,1)),r}closestPointToPoint(t,e,n){const s=this.closestPointToPointParameter(t,e);return this.delta(n).multiplyScalar(s).add(this.start)}applyMatrix4(t){return this.start.applyMatrix4(t),this.end.applyMatrix4(t),this}equals(t){return t.start.equals(this.start)&&t.end.equals(this.end)}clone(){return new this.constructor().copy(this)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Gl}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Gl);function ho(i,t,e,n){const s=new P().subVectors(t,i),r=s.length(),o=new ie(new Hs(e,e,r,14),n);return o.position.copy(i).addScaledVector(s,.5),o.quaternion.setFromUnitVectors(new P(0,1,0),s.normalize()),o.castShadow=!0,o}function XS(){const n=document.createElement("canvas");n.width=1600*(30/48),n.height=1600;const s=n.getContext("2d"),r=48/1600,o=h=>h/r,a=h=>o(h+30/2),c=h=>o(h+48/2);for(let h=0;h<16;h++)s.fillStyle=h%2?"#2c8a3c":"#33984a",s.fillRect(0,o(h*3),n.width,o(3));s.createImageData(n.width,n.height);for(let h=0;h<6e4;h++){const u=Math.random()*n.width|0,d=Math.random()*n.height|0;s.fillStyle=Math.random()>.5?"rgba(0,0,0,0.05)":"rgba(255,255,255,0.04)",s.fillRect(u,d,2,2)}s.strokeStyle="rgba(255,255,255,0.92)",s.fillStyle="rgba(255,255,255,0.92)",s.lineWidth=o(.12),s.strokeRect(a(-Dr),c(-Dt),o(Dr*2),o(Dt*2)),s.beginPath(),s.moveTo(a(-Dr),c(0)),s.lineTo(a(Dr),c(0)),s.stroke(),s.beginPath(),s.arc(a(0),c(0),o(3),0,Math.PI*2),s.stroke(),s.beginPath(),s.arc(a(0),c(0),o(.16),0,Math.PI*2),s.fill();for(const h of[-1,1]){const u=h*Dt;s.strokeRect(a(-7),Math.min(c(u),c(u-h*4.5)),o(14),o(4.5)),s.strokeRect(a(-4.5),Math.min(c(u),c(u-h*1.8)),o(9),o(1.8)),s.beginPath(),s.arc(a(0),c(u-h*6),o(.16),0,Math.PI*2),s.fill(),s.beginPath();const d=h>0?Math.PI*1.25:Math.PI*.25;s.arc(a(0),c(u-h*6),o(2.6),d,d+Math.PI*.5),s.stroke()}const l=new na(n);return l.colorSpace=Oe,l.anisotropy=8,l}function $S(i,t){const{goalW:e,goalH:n}=t,s=e/2,r=new Bi,o=new _r({color:16119285,roughness:.35}),a=(c,l,h)=>new P(c,l,h);for(const c of[-1,1]){const l=c*Dt,h=c*(Dt+ur),u=c*(Dt+bs);for(const d of[-1,1])r.add(ho(a(d*s,0,l),a(d*s,n+Pi,l),Pi,o)),r.add(ho(a(d*s,n+Pi,l),a(d*s,n-.1,u),.028,o)),r.add(ho(a(d*s,n-.1,u),a(d*s,0,h),.028,o));r.add(ho(a(-s-Pi,n,l),a(s+Pi,n,l),Pi,o))}return i.add(r),{group:r,dispose(){i.remove(r);for(const c of r.children)c.geometry.dispose();r.clear(),o.dispose()}}}function YS(i){const t=new Gn({color:2305092}),e=new Gn({color:3029596});for(const l of[-1,1])for(let h=0;h<3;h++){if(l<0){const d=new ie(new cn(2.2,1.6+h*.4,52),h%2?e:t);d.position.set(l*(14.5+h*2.3),(1.6+h*.4)/2+h*1.1,0),i.add(d)}const u=new ie(new cn(34,1.6+h*.4,2.2),h%2?e:t);u.position.set(0,(1.6+h*.4)/2+h*1.1,l*(23.5+h*2.3)),i.add(u)}const n=new Gn({color:9147560}),s=new mi({color:16774872});for(const l of[-1,1])for(const h of[-1,1]){const u=new ie(new Hs(.12,.16,14,8),n);u.position.set(l*13.5,7,h*22.5),i.add(u);const d=new ie(new cn(1.8,.9,.3),s);d.position.set(l*13.5,14.2,h*22.5),d.lookAt(0,0,0),i.add(d)}const r=[1851279,9378862,1871706,11040796];new cn(6,.75,.1);const o=new cn(.1,.75,6),a=new cn(3.8,.75,.1);let c=0;for(const l of[-1,1]){for(let h=-18;h<18;h+=6){const u=new Gn({color:r[c++%4]});l>0&&(u.transparent=!0,u.opacity=.3,u.depthWrite=!1);const d=new ie(o,u);d.position.set(l*(Cn+.06),.38,h+3),d.castShadow=l<0,i.add(d)}for(const h of[-1,1])for(let u=0;u<2;u++){const d=new ie(a,new Gn({color:r[c++%4]}));d.position.set(h*(3.85+1.9+u*3.8),.38,l*(Dt+.12)),d.castShadow=!0,i.add(d)}}}function qS(i){const t=new _S({antialias:!0});t.setPixelRatio(Math.min(devicePixelRatio,2)),t.setSize(innerWidth,innerHeight),t.shadowMap.enabled=!0,t.shadowMap.type=Qd,t.toneMapping=tf,i.appendChild(t.domElement);const e=new vS;e.background=new Ft(725542),e.fog=new ih(725542,60,160);const n=new ln(50,innerWidth/innerHeight,.1,300);n.position.set(28,23,0),n.lookAt(0,0,0),e.add(new FS(12900095,1849892,.8));const s=new VS(16773848,1.5);s.position.set(24,34,12),s.castShadow=!0,s.shadow.mapSize.set(2048,2048),s.shadow.camera.left=-30,s.shadow.camera.right=30,s.shadow.camera.top=30,s.shadow.camera.bottom=-30,s.shadow.camera.far=90,e.add(s);const r=new ie(new qn(30,48),new Gn({map:XS()}));r.rotation.x=-Math.PI/2,r.receiveShadow=!0,e.add(r);const o=new ie(new qn(400,400),new Gn({color:1055790}));o.rotation.x=-Math.PI/2,o.position.y=-.02,e.add(o),YS(e);const a=()=>{n.aspect=innerWidth/innerHeight,n.updateProjectionMatrix(),t.setSize(innerWidth,innerHeight)};return addEventListener("resize",a),{renderer:t,scene:e,camera:n}}const Qu=new In,uo=new P;class Bf extends GS{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";const t=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],e=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],n=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(n),this.setAttribute("position",new he(t,3)),this.setAttribute("uv",new he(e,2))}applyMatrix4(t){const e=this.attributes.instanceStart,n=this.attributes.instanceEnd;return e!==void 0&&(e.applyMatrix4(t),n.applyMatrix4(t),e.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(t){let e;t instanceof Float32Array?e=t:Array.isArray(t)&&(e=new Float32Array(t));const n=new il(e,6,1);return this.setAttribute("instanceStart",new Rn(n,3,0)),this.setAttribute("instanceEnd",new Rn(n,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(t){let e;t instanceof Float32Array?e=t:Array.isArray(t)&&(e=new Float32Array(t));const n=new il(e,6,1);return this.setAttribute("instanceColorStart",new Rn(n,3,0)),this.setAttribute("instanceColorEnd",new Rn(n,3,3)),this}fromWireframeGeometry(t){return this.setPositions(t.attributes.position.array),this}fromEdgesGeometry(t){return this.setPositions(t.attributes.position.array),this}fromMesh(t){return this.fromWireframeGeometry(new kS(t.geometry)),this}fromLineSegments(t){const e=t.geometry;return this.setPositions(e.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new In);const t=this.attributes.instanceStart,e=this.attributes.instanceEnd;t!==void 0&&e!==void 0&&(this.boundingBox.setFromBufferAttribute(t),Qu.setFromBufferAttribute(e),this.boundingBox.union(Qu))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Zn),this.boundingBox===null&&this.computeBoundingBox();const t=this.attributes.instanceStart,e=this.attributes.instanceEnd;if(t!==void 0&&e!==void 0){const n=this.boundingSphere.center;this.boundingBox.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)uo.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(uo)),uo.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(uo));this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(t){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(t)}}it.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new ct(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};qe.line={uniforms:th.merge([it.common,it.fog,it.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};class Hf extends Kn{static get type(){return"LineMaterial"}constructor(t){super({uniforms:th.clone(qe.line.uniforms),vertexShader:qe.line.vertexShader,fragmentShader:qe.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(t)}get color(){return this.uniforms.diffuse.value}set color(t){this.uniforms.diffuse.value=t}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(t){t===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(t){this.uniforms.linewidth&&(this.uniforms.linewidth.value=t)}get dashed(){return"USE_DASH"in this.defines}set dashed(t){t===!0!==this.dashed&&(this.needsUpdate=!0),t===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(t){this.uniforms.dashScale.value=t}get dashSize(){return this.uniforms.dashSize.value}set dashSize(t){this.uniforms.dashSize.value=t}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(t){this.uniforms.dashOffset.value=t}get gapSize(){return this.uniforms.gapSize.value}set gapSize(t){this.uniforms.gapSize.value=t}get opacity(){return this.uniforms.opacity.value}set opacity(t){this.uniforms&&(this.uniforms.opacity.value=t)}get resolution(){return this.uniforms.resolution.value}set resolution(t){this.uniforms.resolution.value.copy(t)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(t){this.defines&&(t===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),t===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}const Ya=new re,td=new P,ed=new P,we=new re,Re=new re,bn=new re,qa=new P,ja=new qt,Pe=new WS,nd=new P,fo=new In,po=new Zn,En=new re;let An,Vi;function id(i,t,e){return En.set(0,0,-t,1).applyMatrix4(i.projectionMatrix),En.multiplyScalar(1/En.w),En.x=Vi/e.width,En.y=Vi/e.height,En.applyMatrix4(i.projectionMatrixInverse),En.multiplyScalar(1/En.w),Math.abs(Math.max(En.x,En.y))}function jS(i,t){const e=i.matrixWorld,n=i.geometry,s=n.attributes.instanceStart,r=n.attributes.instanceEnd,o=Math.min(n.instanceCount,s.count);for(let a=0,c=o;a<c;a++){Pe.start.fromBufferAttribute(s,a),Pe.end.fromBufferAttribute(r,a),Pe.applyMatrix4(e);const l=new P,h=new P;An.distanceSqToSegment(Pe.start,Pe.end,h,l),h.distanceTo(l)<Vi*.5&&t.push({point:h,pointOnLine:l,distance:An.origin.distanceTo(h),object:i,face:null,faceIndex:a,uv:null,uv1:null})}}function KS(i,t,e){const n=t.projectionMatrix,r=i.material.resolution,o=i.matrixWorld,a=i.geometry,c=a.attributes.instanceStart,l=a.attributes.instanceEnd,h=Math.min(a.instanceCount,c.count),u=-t.near;An.at(1,bn),bn.w=1,bn.applyMatrix4(t.matrixWorldInverse),bn.applyMatrix4(n),bn.multiplyScalar(1/bn.w),bn.x*=r.x/2,bn.y*=r.y/2,bn.z=0,qa.copy(bn),ja.multiplyMatrices(t.matrixWorldInverse,o);for(let d=0,f=h;d<f;d++){if(we.fromBufferAttribute(c,d),Re.fromBufferAttribute(l,d),we.w=1,Re.w=1,we.applyMatrix4(ja),Re.applyMatrix4(ja),we.z>u&&Re.z>u)continue;if(we.z>u){const M=we.z-Re.z,v=(we.z-u)/M;we.lerp(Re,v)}else if(Re.z>u){const M=Re.z-we.z,v=(Re.z-u)/M;Re.lerp(we,v)}we.applyMatrix4(n),Re.applyMatrix4(n),we.multiplyScalar(1/we.w),Re.multiplyScalar(1/Re.w),we.x*=r.x/2,we.y*=r.y/2,Re.x*=r.x/2,Re.y*=r.y/2,Pe.start.copy(we),Pe.start.z=0,Pe.end.copy(Re),Pe.end.z=0;const _=Pe.closestPointToPointParameter(qa,!0);Pe.at(_,nd);const m=r0.lerp(we.z,Re.z,_),p=m>=-1&&m<=1,x=qa.distanceTo(nd)<Vi*.5;if(p&&x){Pe.start.fromBufferAttribute(c,d),Pe.end.fromBufferAttribute(l,d),Pe.start.applyMatrix4(o),Pe.end.applyMatrix4(o);const M=new P,v=new P;An.distanceSqToSegment(Pe.start,Pe.end,v,M),e.push({point:v,pointOnLine:M,distance:An.origin.distanceTo(v),object:i,face:null,faceIndex:d,uv:null,uv1:null})}}}class ZS extends ie{constructor(t=new Bf,e=new Hf({color:Math.random()*16777215})){super(t,e),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){const t=this.geometry,e=t.attributes.instanceStart,n=t.attributes.instanceEnd,s=new Float32Array(2*e.count);for(let o=0,a=0,c=e.count;o<c;o++,a+=2)td.fromBufferAttribute(e,o),ed.fromBufferAttribute(n,o),s[a]=a===0?0:s[a-1],s[a+1]=s[a]+td.distanceTo(ed);const r=new il(s,2,1);return t.setAttribute("instanceDistanceStart",new Rn(r,1,0)),t.setAttribute("instanceDistanceEnd",new Rn(r,1,1)),this}raycast(t,e){const n=this.material.worldUnits,s=t.camera;s===null&&!n&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');const r=t.params.Line2!==void 0&&t.params.Line2.threshold||0;An=t.ray;const o=this.matrixWorld,a=this.geometry,c=this.material;Vi=c.linewidth+r,a.boundingSphere===null&&a.computeBoundingSphere(),po.copy(a.boundingSphere).applyMatrix4(o);let l;if(n)l=Vi*.5;else{const u=Math.max(s.near,po.distanceToPoint(An.origin));l=id(s,u,c.resolution)}if(po.radius+=l,An.intersectsSphere(po)===!1)return;a.boundingBox===null&&a.computeBoundingBox(),fo.copy(a.boundingBox).applyMatrix4(o);let h;if(n)h=Vi*.5;else{const u=Math.max(s.near,fo.distanceToPoint(An.origin));h=id(s,u,c.resolution)}fo.expandByScalar(h),An.intersectsBox(fo)!==!1&&(n?jS(this,e):KS(this,s,e))}onBeforeRender(t){const e=this.material.uniforms;e&&e.resolution&&(t.getViewport(Ya),this.material.uniforms.resolution.value.set(Ya.z,Ya.w))}}class JS{constructor(t,e){this.entries=t.flatMap(s=>s.collidable.map(r=>({net:s,g:r}))),this.segCount=this.entries.reduce((s,r)=>s+r.g.n,0),this.array=new Float32Array(this.segCount*6),this.fill();const n=new Bf;n.setPositions(this.array),n.boundingSphere=new Zn(new P(0,1.2,0),30),this.material=new Hf({color:15921903,linewidth:.013,worldUnits:!0}),this.mesh=new ZS(n,this.material),this.mesh.frustumCulled=!1,e.add(this.mesh),this.buffer=n.attributes.instanceStart.data}fill(){let t=0;for(const{net:e,g:n}of this.entries){const{pos:s}=e,{ids:r,n:o}=n;for(let a=0;a<o;a++){const c=r[a*2]*3,l=r[a*2+1]*3;this.array[t++]=s[c],this.array[t++]=s[c+1],this.array[t++]=s[c+2],this.array[t++]=s[l],this.array[t++]=s[l+1],this.array[t++]=s[l+2]}}}update(){this.fill(),this.buffer.array.set(this.array),this.buffer.needsUpdate=!0}dispose(){var t;(t=this.mesh.parent)==null||t.remove(this.mesh),this.mesh.geometry.dispose(),this.material.dispose()}}function QS(){const t=document.createElement("canvas");t.width=1024*2,t.height=1024;const e=t.getContext("2d");e.fillStyle="#f4f4f4",e.fillRect(0,0,t.width,t.height);const n=(1+Math.sqrt(5))/2,s=[];for(const a of[-1,1])for(const c of[-n,n])s.push([0,a,c],[a,c,0],[c,0,a]);const r=a=>{const c=Math.hypot(...a),[l,h,u]=a.map(g=>g/c),d=Math.asin(h);return{u:(Math.atan2(u,l)+Math.PI)/(2*Math.PI)*t.width,v:(Math.PI/2-d)/Math.PI*t.height,lat:d}};e.strokeStyle="rgba(40,40,40,0.55)",e.lineWidth=7;for(let a=0;a<s.length;a++)for(let c=a+1;c<s.length;c++){const l=s[a],h=s[c],u=Math.hypot(...l),d=Math.hypot(...h),f=(l[0]*h[0]+l[1]*h[1]+l[2]*h[2])/(u*d);if(f<.35||f>.55)continue;const g=r(l),_=r(h);if(!(Math.abs(g.lat)>1.15||Math.abs(_.lat)>1.15))for(const m of[-t.width,0,t.width]){let p=g.u+m,x=_.u+m;Math.abs(p-x)>t.width/2||(e.beginPath(),e.moveTo(p,g.v),e.lineTo(x,_.v),e.stroke())}}e.fillStyle="#181818";for(const a of s){const{u:c,v:l,lat:h}=r(a),u=95,d=Math.min(u/Math.max(Math.cos(h),.25),420);for(const f of[-t.width,0,t.width])e.beginPath(),e.ellipse(c+f,l,d,u,0,0,Math.PI*2),e.fill()}const o=new na(t);return o.colorSpace=Oe,o.anisotropy=8,o}class tM{constructor(t,e){this.ball=t,this.mesh=new ie(new wr(ee,40,28),new _r({map:QS(),roughness:.55})),this.mesh.castShadow=!0,e.add(this.mesh),this.spinAxis=new P}update(t){const{pos:e,vel:n,omega:s,grounded:r}=this.ball;if(this.mesh.position.set(e.x,e.y,e.z),r){const o=Math.hypot(n.x,n.z);o>.05&&(this.spinAxis.set(n.z/o,0,-n.x/o),this.mesh.rotateOnWorldAxis(this.spinAxis,o/ee*t))}else{const o=Math.hypot(s.x,s.y,s.z);o>.001&&(this.spinAxis.set(s.x/o,s.y/o,s.z/o),this.mesh.rotateOnWorldAxis(this.spinAxis,o*t))}}dispose(){var t,e;(t=this.mesh.parent)==null||t.remove(this.mesh),this.mesh.geometry.dispose(),(e=this.mesh.material.map)==null||e.dispose(),this.mesh.material.dispose()}}const eM=[14826299,3894754],ws=new Ft,hi={h:0,s:0,l:0};function sd(i,t){ws.setHex(i>>>0),ws.getHSL(hi);const e=Math.max(0,Math.min(1,hi.l+t));return ws.setHSL(hi.h,hi.s,e).getHex()}function rd(i){ws.setHex(i>>>0),ws.getHSL(hi);const t=(hi.h+.5)%1,e=Math.max(.55,Math.min(1,hi.s)),n=Math.max(.52,Math.min(.72,hi.l+.16));return ws.setHSL(t,e,n).getHex()}function nM(i){const t=[0,1].map(e=>{const n=Array.isArray(i)?i[e]:void 0;return Number.isFinite(n)?n>>>0&16777215:eM[e]});return{jersey:t,shorts:t.map(e=>sd(e,-.22)),keeper:t.map(rd),keeperShorts:t.map(e=>sd(rd(e),-.28)),ring:t}}const iM=14,od=1.1,sM=2.06;function ad(i,t=iM){if(typeof i!="string")return"";const e=i.replace(new RegExp(String.raw`[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f]`,"g")," ").replace(/\s+/g," ").trim();return e?e.length<=t?e:`${e.slice(0,Math.max(1,t-1))}…`:""}function rM(i,t,e,n,s,r){i.beginPath(),i.moveTo(t+r,e),i.arcTo(t+n,e,t+n,e+s,r),i.arcTo(t+n,e+s,t,e+s,r),i.arcTo(t,e+s,t,e,r),i.arcTo(t,e,t+n,e,r),i.closePath()}function cd(i){if(typeof document>"u")return null;const t=256,e=72,n=10,s=document.createElement("canvas");s.width=t,s.height=e;const r=s.getContext("2d");if(!r)return null;r.clearRect(0,0,t,e),r.font='bold 34px "Segoe UI", system-ui, sans-serif',r.textAlign="center",r.textBaseline="middle";const o=Math.min(t-n*2,r.measureText(i).width+34),a=Math.max(64,o),c=e-n*2;r.fillStyle="rgba(12,16,22,0.72)",rM(r,(t-a)/2,n,a,c,c/2),r.fill(),r.strokeStyle="rgba(255,255,255,0.28)",r.lineWidth=2,r.stroke(),r.fillStyle="#ffffff",r.fillText(i,t/2,e/2+1);const l=new na(s);l.colorSpace=Oe,l.minFilter=yn,l.generateMipmaps=!1;const h=new xS(new If({map:l,transparent:!0,depthTest:!0,depthWrite:!1}));return h.scale.set(od,od*(e/t),1),h.renderOrder=5,h}class oM{constructor(t,e,n=null){this.player=t,this.group=new Bi;const s=nM(n);this.palette=s;const r=t.role==="keeper",o=r?s.keeper[t.team]:s.jersey[t.team],a=r?s.keeperShorts[t.team]:s.shorts[t.team],c=new _r({color:o,roughness:.7}),l=new _r({color:a,roughness:.7}),h=new _r({color:15251855,roughness:.8}),u=new ie(new ah(.26,.45,6,14),c);u.position.y=.95,u.castShadow=!0,this.group.add(u);const d=new ie(new wr(.16,18,14),h);d.position.y=1.52,d.castShadow=!0,this.head=d,this.group.add(d);const f=new Hs(.075,.06,.55,10);f.translate(0,-.275,0),this.legs=[-1,1].map(_=>{const m=new ie(f,l);return m.position.set(_*.11,.62,0),m.castShadow=!0,this.group.add(m),m});const g=new Hs(.055,.045,.48,10);g.translate(0,-.24,0),this.arms=[-1,1].map(_=>{const m=new ie(g,c);return m.position.set(_*.32,1.28,0),m.rotation.z=_*.16,m.castShadow=!0,this.group.add(m),m}),this.ring=new ie(new hh(.5,.045,10,32),new mi({color:s.ring[t.team],transparent:!0,opacity:.85})),this.ring.rotation.x=-Math.PI/2,this.ring.position.y=.04,this.ring.visible=!1,this.group.add(this.ring),this.tagName=ad(t.mpName),this.tag=this.tagName?cd(this.tagName):null,this.tag&&e.add(this.tag),this.walkPhase=0,e.add(this.group)}setName(t){var s,r,o;const e=ad(t);if(e===this.tagName)return;const n=((s=this.tag)==null?void 0:s.parent)??this.group.parent;this.tag&&((r=this.tag.parent)==null||r.remove(this.tag),(o=this.tag.material.map)==null||o.dispose(),this.tag.material.dispose(),this.tag=null),this.tagName=e,this.tag=e?cd(e):null,this.tag&&n&&n.add(this.tag)}update(t){const e=this.player,n=e.speed();if(this.tag&&(this.tag.visible=e.down<=0,this.tag.visible&&this.tag.position.set(e.pos.x,sM+(e.jumpY||0),e.pos.z)),e.down>0){const h=1-e.down/e.downTotal,u=Math.min(h/.2,1),d=Math.max(0,(h-.72)/.28),f=u*u*(1-d*d),g=-f*(Math.PI/2)*1.04,_=Math.sin(Math.min(h/.3,1)*Math.PI)*.3*(1-h),m=Math.sin(h*26)*.45*(1-h);this.group.position.set(e.pos.x,_+f*.3,e.pos.z),this.group.rotation.set(g,e.facing+e.tumbleSpin*f,m*.4,"YXZ"),this.legs[0].rotation.x=m+f*.5,this.legs[1].rotation.x=-m+f*.7,this.legs[0].rotation.z=f*.35,this.legs[1].rotation.z=-f*.35;const p=Math.sin(h*32+1.3)*.9*(1-h);this.arms[0].rotation.x=-2.4*f+p,this.arms[1].rotation.x=-2.4*f-p,this.arms[0].rotation.z=.16+f*1.1+p*.3,this.arms[1].rotation.z=-.16-f*1.1+p*.3,this.ring.visible=!1;return}this.legs[0].rotation.z=0,this.legs[1].rotation.z=0;const s=e.dive>0?Math.min((e.diveTotal-e.dive)/.18,1):e.diveRecover>0?e.diveRecover/.45:0;if(s>.01){const h=Math.atan2(e.diveDir.x,e.diveDir.z);if(e.diveKind==="slide")this.group.position.set(e.pos.x,-.35*s,e.pos.z),this.group.rotation.set(-s*1.05,h,0,"YXZ"),this.legs[0].rotation.x=-s*1.5,this.legs[1].rotation.x=s*.5,this.arms[0].rotation.x=s*1.6,this.arms[1].rotation.x=-s*.7,this.arms[0].rotation.z=.16+s*.5,this.arms[1].rotation.z=-.16-s*.3;else{const u=e.dive>0?Math.sin(Math.min((e.diveTotal-e.dive)/e.diveTotal,1)*Math.PI):0;this.group.position.set(e.pos.x,u*.55,e.pos.z),this.group.rotation.set(s*1.35,h,0,"YXZ");for(const[d,f]of[[0,1],[1,-1]])this.legs[d].rotation.x=s*.25*f,this.arms[d].rotation.x=-s*2.9,this.arms[d].rotation.z=f*.16*(1-s)}this.ring.visible=!1;return}if(e.celebrate!==0&&e.down<=0&&e.dive<=0){if(this.walkPhase+=t*6,e.celebrate===1){const h=Math.abs(Math.sin(this.walkPhase))*.28,u=Math.sin(this.walkPhase*1.7)*.25;this.group.position.set(e.pos.x,h,e.pos.z),this.group.rotation.set(0,e.facing,0,"YXZ"),this.arms[0].rotation.x=-2.7+u,this.arms[1].rotation.x=-2.7-u,this.arms[0].rotation.z=.35,this.arms[1].rotation.z=-.35,this.legs[0].rotation.x=h*.6,this.legs[1].rotation.x=-h*.6}else this.group.position.set(e.pos.x,0,e.pos.z),this.group.rotation.set(.34,e.facing,0,"YXZ"),this.arms[0].rotation.x=.25,this.arms[1].rotation.x=.25,this.arms[0].rotation.z=.05,this.arms[1].rotation.z=-.05,this.legs[0].rotation.x=0,this.legs[1].rotation.x=0;this.ring.visible=!1,this.tag&&this.tag.position.set(e.pos.x,2.06+(this.group.position.y||0),e.pos.z);return}this.group.position.set(e.pos.x,e.jumpY||0,e.pos.z);const r=e.headerAnim>0?Math.sin(Math.min(e.headerAnim,1)*Math.PI):0,o=Math.min(n/Oo,1)*.16+r*.5;if(this.group.rotation.set(o,e.facing,0,"YXZ"),e.jumpY>.03){this.arms[0].rotation.x=-2.9,this.arms[1].rotation.x=-2.9,this.arms[0].rotation.z=.1,this.arms[1].rotation.z=-.1,this.legs[0].rotation.x=.35,this.legs[1].rotation.x=-.2,this.ring.visible=!1;return}this.head.position.y=1.52+r*.1,this.head.position.z=r*.16,this.walkPhase+=t*(4+n*2.6);const a=Math.min(n/Oo,1)*.55,c=e.kickAnim>0?Math.sin(Math.min(e.kickAnim,1)*Math.PI):0;this.legs[0].rotation.x=Math.sin(this.walkPhase)*a,this.legs[1].rotation.x=c>0?-c*1.5:Math.sin(this.walkPhase+Math.PI)*a,this.arms[0].rotation.x=Math.sin(this.walkPhase+Math.PI)*a*.8+c*.9,this.arms[1].rotation.x=Math.sin(this.walkPhase)*a*.8-c*.5,this.arms[0].rotation.z=.16+c*.5,this.arms[1].rotation.z=-.16-c*.2;const l=e.charge;if(this.ring.visible=l>.02,this.ring.visible){const h=1+l*.5;this.ring.scale.set(h,h,1),this.ring.material.opacity=.35+l*.6}}dispose(){var t,e,n;this.tag&&((t=this.tag.parent)==null||t.remove(this.tag),(e=this.tag.material.map)==null||e.dispose(),this.tag.material.dispose(),this.tag=null),(n=this.group.parent)==null||n.remove(this.group),this.group.traverse(s=>{s.geometry&&s.geometry.dispose(),s.material&&s.material.dispose()})}}const ld=[16751258,10139903];class aM{constructor(t,e,n){this.player=t,this.world=e,this.maxPoints=44;const s=new Ie;s.setAttribute("position",new en(new Float32Array(this.maxPoints*3),3)),this.line=new MS(s,new zS({color:ld[t.team],transparent:!0,opacity:.5,dashSize:.3,gapSize:.22})),this.line.visible=!1,this.line.frustumCulled=!1,n.add(this.line),this.dot=new ie(new wr(.09,10,8),new mi({color:ld[t.team],transparent:!0,opacity:.8})),this.dot.visible=!1,n.add(this.dot),this.sim=new Zd}update(t){const e=this.player,n=e.charge>.01,s=t?this.world.kickParams(e,n?e.charge:.12,.3):null;if(!s){this.line.visible=this.dot.visible=!1;return}const{sim:r}=this,o=this.world.ball;r.pos={...o.pos},r.prev={...o.pos},r.vel={...s.vel},r.omega={...s.omega};const a=this.line.geometry.attributes.position,c=1/40;let l=0;for(let h=0;h<this.maxPoints&&(a.setXYZ(h,r.pos.x,r.pos.y,r.pos.z),l=h+1,!(h>2&&r.pos.y<=ee&&r.vel.y<0||Math.abs(r.pos.z)>18));h++)r.integrate(c);this.line.geometry.setDrawRange(0,l),a.needsUpdate=!0,this.line.computeLineDistances(),this.line.material.opacity=n?.95:.45,this.line.visible=!0,this.dot.position.set(r.pos.x,Math.max(r.pos.y,.05),r.pos.z),this.dot.visible=!0}dispose(){var t;for(const e of[this.line,this.dot])(t=e.parent)==null||t.remove(e),e.geometry.dispose(),e.material.dispose()}}const Vf=3,Gf=2.2,uh=i=>14.5+i*2.3,Wf=i=>23.5+i*2.3,Xf=i=>1.6+1.5*i,sl=52,rl=uh(0)-Gf/2-.2,xs={tiers:Vf,tierDepth:Gf,sideLen:sl,sideX:uh,endZ:Wf,tierTop:Xf,endHalfX:rl},mo=.6,hd=[-.62,0,.62],cM=.08,lM=.34,ol=.62,hM=.28,$f=.14,uM=ol+$f+.015,dM=0,ud=1,dd=2,fM=[4872826,7035466,4156250,8018539,9075274,5921370,7031370,4877178,8022610,5595258],pM=[12728890,11022127,13914954,9315878,12075072],mM=[3498184,2838184,4880088,2375807,4156351],gM=[14735037,14460476],_M=[13490410,3129264],vM=.16,fd=[15251855,13209446,10119749,15780774,8016440],Ka=2.5,pd=.55;function xM(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const yM=`
attribute float aPhase;
attribute float aSec;
attribute float aRate;
uniform float uTime;
uniform vec3 uAmp;   // celebration amplitude per section: neutral, red, blue
uniform vec3 uSad;   // mourning slump per section (conceding fans)
uniform float uOoh;  // synchronized near-miss bounce envelope
`,SM=`
float amp = aSec < 0.5 ? uAmp.x : (aSec < 1.5 ? uAmp.y : uAmp.z);
float sad = aSec < 0.5 ? uSad.x : (aSec < 1.5 ? uSad.y : uSad.z);
float idleBob = sin(uTime * 1.7 + aPhase) * 0.014;
float idleSway = sin(uTime * 0.9 + aPhase * 1.3) * 0.055;
float jump = abs(sin(uTime * (7.0 + aRate * 3.5) + aPhase * 2.0)) * 0.34 * amp;
float ooh = uOoh * 0.10 * (0.85 + 0.3 * sin(aPhase));
// mourning: sink and hunch forward, idle motion dies down
transformed.y += idleBob * (1.0 - sad * 0.8) + jump + ooh - sad * 0.10 * step(0.15, transformed.y);
transformed.x += idleSway * (1.0 - sad * 0.7) * (1.0 + amp * 2.2) * transformed.y;
transformed.z += sad * 0.14 * max(transformed.y, 0.0);
`;class MM{constructor(t){const e=xM(6221079),n=bM(e);this.count=n.length,this.uniforms={uTime:{value:0},uAmp:{value:new P(0,0,0)},uSad:{value:new P(0,0,0)},uOoh:{value:0}},this._clock=0,this._cheer=0,this._cheerTeam=0,this._mourn=0,this._ooh=0;const s=new pr(new Float32Array(this.count),1),r=new pr(new Float32Array(this.count),1),o=new pr(new Float32Array(this.count),1),a=new cn(lM,ol,hM);a.translate(0,ol/2,0);const c=new lh($f,0);c.translate(0,uM,0);for(const p of[a,c])p.setAttribute("aPhase",s),p.setAttribute("aSec",r),p.setAttribute("aRate",o);const l=new Gn({color:16777215}),h=new Gn({color:16777215});for(const p of[l,h])p.onBeforeCompile=x=>{Object.assign(x.uniforms,this.uniforms),x.vertexShader=yM+x.vertexShader,x.vertexShader=x.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
${SM}`)},p.customProgramCacheKey=()=>"crowdWobble";this.bodies=new Fo(a,l,this.count),this.heads=new Fo(c,h,this.count);const u=new qt,d=new P,f=new Yi,g=new P(0,1,0),_=new P,m=new Ft;for(let p=0;p<this.count;p++){const x=n[p];d.set(x.x,x.y,x.z),f.setFromAxisAngle(g,x.rot),_.setScalar(x.scale),u.compose(d,f,_),this.bodies.setMatrixAt(p,u),this.heads.setMatrixAt(p,u),this.bodies.setColorAt(p,m.setHex(x.color)),this.heads.setColorAt(p,m.setHex(x.skin)),s.setX(p,x.phase),r.setX(p,x.sec),o.setX(p,x.rate)}for(const p of[this.bodies,this.heads])p.instanceMatrix.needsUpdate=!0,p.instanceColor.needsUpdate=!0,p.castShadow=!1,p.receiveShadow=!1,p.computeBoundingSphere(),p.boundingSphere.radius+=.5;this.group=new Bi,this.group.add(this.bodies,this.heads),t.add(this.group)}update(t,e){this._clock+=t,this.uniforms.uTime.value=Number.isFinite(e)?e:this._clock;const n=this.uniforms.uAmp.value;if(this._cheer>0){this._cheer=Math.max(0,this._cheer-t);const r=(this._cheer/Ka)**1.4;n.set(r*.35,0,0),this._cheerTeam===0?(n.y=r,n.z=r*.06):(n.z=r,n.y=r*.06)}else n.lengthSq()>0&&n.set(0,0,0);const s=this.uniforms.uSad.value;if(this._mourn>0){this._mourn=Math.max(0,this._mourn-t);const r=Math.min(1,this._mourn/1.4);s.set(0,0,0),this._cheerTeam===0?s.z=r:s.y=r}else s.lengthSq()>0&&s.set(0,0,0);this._ooh>0?(this._ooh=Math.max(0,this._ooh-t),this.uniforms.uOoh.value=Math.sin((1-this._ooh/pd)*Math.PI)):this.uniforms.uOoh.value!==0&&(this.uniforms.uOoh.value=0)}onGoal(t){this._cheerTeam=t===1?1:0,this._cheer=Ka,this._mourn=Ka+1.6,this._ooh=0}onNearMiss(){this._cheer>0||(this._ooh=pd)}}function bM(i){const t=[],e=(n,s,r,o)=>{if(i()<cM)return;let a,c;o===ud?(a=pM,c=gM):o===dd?(a=mM,c=_M):(a=fM,c=null);const l=c&&i()<vM?c[i()*c.length|0]:a[i()*a.length|0];t.push({x:n,y:s,z:r,sec:o,color:l,skin:fd[i()*fd.length|0],rot:Math.atan2(-n,-r)+(i()-.5)*.44,scale:.88+i()*.24,phase:i()*Math.PI*2,rate:i()})};for(const n of[-1,1])for(let s=0;s<Vf;s++){const r=Xf(s);if(n<0){const l=n*uh(s),h=Math.floor(sl/mo);for(const u of hd)for(let d=0;d<h;d++){const f=-sl/2+(d+.5)*mo+(i()-.5)*.12,g=l+u+(i()-.5)*.1;e(g,r,f,dM)}}const o=n*Wf(s),a=n<0?ud:dd,c=Math.floor(rl*2/mo);for(const l of hd)for(let h=0;h<c;h++){const u=-rl+(h+.5)*mo+(i()-.5)*.12,d=o+l+(i()-.5)*.1;e(u,r,d,a)}}return t}const Za=320,md=260,EM=3.3,TM=3.6,CM=.85,AM=[[14173244,15759962,16765286,16117990,11546415],[3498184,5999848,9426687,15397375,2375807]],Ja=1200,gd=12,wM=15.5,Qa=.13,tc=17,RM=27,_d=396056,PM=34,LM=115,IM=.55,DM=.5,ec=new qt().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);function UM(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const NM=["acik","yagmur"];var Ae,Yf,qf,jf,al,cl,Kf,Zf;class OM{constructor(t){Be(this,Ae);this.scene=t,this.weather="acik",this.time=0,this.confettiActive=0,this.allocations={confetti:0,rain:0,sheen:0},this._rnd=UM(12648430),this._m=new qt,this._p=new P,this._q=new Yi,this._e=new un,this._s=new P,this._col=new Ft,this._sceneBase=null,this.rain=null,this.sheen=null,J(this,Ae,Yf).call(this)}onGoal(t,e){const n=t===1?1:0,s=Math.sign(e)||(n===0?1:-1),r=AM[n],o=this._rnd,a=this.c,c=xs.endHalfX;for(let l=0;l<Za;l++){if(l>=md){a.alive[l]=0,this.confetti.setMatrixAt(l,ec);continue}const h=Math.min(xs.tiers-1,o()*xs.tiers|0);a.x[l]=(o()*2-1)*c,a.y[l]=xs.tierTop(h)+1.1+o()*1.9,a.z[l]=s*(xs.endZ(h)+(o()-.5)*xs.tierDepth),a.vx[l]=(o()-.5)*3,a.vy[l]=1.8+o()*2.2,a.vz[l]=-s*(.6+o()*2.4),a.rx[l]=o()*Math.PI*2,a.ry[l]=o()*Math.PI*2,a.rz[l]=o()*Math.PI*2,a.sx[l]=(o()-.5)*9,a.sy[l]=(o()-.5)*7,a.sz[l]=(o()-.5)*11,a.life[l]=EM+o(),a.size[l]=.8+o()*.7,a.phase[l]=o()*Math.PI*2,a.sway[l]=1.3+o()*2.2,a.alive[l]=1,this.confetti.setColorAt(l,this._col.setHex(r[o()*r.length|0]))}this.confettiActive=md,this.confetti.instanceMatrix.needsUpdate=!0,this.confetti.instanceColor&&(this.confetti.instanceColor.needsUpdate=!0)}setWeather(t){const e=NM.includes(t)?t:"acik";return this.weather=e,e==="yagmur"&&(J(this,Ae,jf).call(this),J(this,Ae,Zf).call(this)),this.rain&&(this.rain.visible=e==="yagmur"),this.sheen&&(this.sheen.visible=e==="yagmur"),this.applyWeatherToScene(this.scene),this.weather}applyWeatherToScene(t=this.scene){var s,r;if(!t||typeof t.traverse!="function")return!1;if(!this._sceneBase||this._sceneBase.scene!==t){const o=[];t.traverse(a=>{(a.isHemisphereLight||a.isDirectionalLight)&&o.push({light:a,intensity:a.intensity})}),this._sceneBase={scene:t,lights:o,fog:t.fog?{color:t.fog.color.getHex(),near:t.fog.near,far:t.fog.far}:null,background:(s=t.background)!=null&&s.isColor?t.background.getHex():null}}const e=this._sceneBase,n=this.weather==="yagmur";for(const{light:o,intensity:a}of e.lights)o.intensity=a*(n?o.isHemisphereLight?IM:DM:1);return t.fog&&e.fog&&(t.fog.color.setHex(n?_d:e.fog.color),t.fog.near=n?PM:e.fog.near,t.fog.far=n?LM:e.fog.far),(r=t.background)!=null&&r.isColor&&e.background!==null&&t.background.setHex(n?_d:e.background),!0}update(t){if(!Number.isFinite(t)||t<=0)return;const e=Math.min(t,.05);this.time+=e,this.confettiActive>0&&J(this,Ae,qf).call(this,e),this.weather==="yagmur"&&this.rain&&J(this,Ae,Kf).call(this,e)}dispose(){var t;for(const e of[this.confetti,this.rain,this.sheen])e&&(this.scene.remove(e),e.geometry.dispose(),(t=e.material.map)==null||t.dispose(),e.material.dispose());this.confetti=this.rain=this.sheen=null,this.confettiActive=0}}Ae=new WeakSet,Yf=function(){const t=Za;this.c={x:new Float32Array(t),y:new Float32Array(t),z:new Float32Array(t),vx:new Float32Array(t),vy:new Float32Array(t),vz:new Float32Array(t),rx:new Float32Array(t),ry:new Float32Array(t),rz:new Float32Array(t),sx:new Float32Array(t),sy:new Float32Array(t),sz:new Float32Array(t),life:new Float32Array(t),size:new Float32Array(t),phase:new Float32Array(t),sway:new Float32Array(t),alive:new Uint8Array(t)};const e=new qn(.19,.12),n=new mi({side:vn,toneMapped:!1});this.confetti=new Fo(e,n,t),this.confetti.frustumCulled=!1,this.confetti.instanceMatrix.setUsage(Yh),this.confetti.castShadow=!1,this.confetti.receiveShadow=!1;for(let s=0;s<t;s++)this.confetti.setMatrixAt(s,ec),this.confetti.setColorAt(s,this._col.setHex(16777215));this.confetti.instanceMatrix.needsUpdate=!0,this.confetti.instanceColor&&(this.confetti.instanceColor.needsUpdate=!0),this.scene.add(this.confetti),this.allocations.confetti++},qf=function(t){const e=this.c,n=this._m,s=this._p,r=this._q,o=this._e,a=this._s;let c=0;for(let l=0;l<Za;l++){if(!e.alive[l])continue;if(e.life[l]-=t,e.life[l]<=0||e.y[l]<=.03){e.alive[l]=0,this.confetti.setMatrixAt(l,ec);continue}const h=Math.sin(this.time*e.sway[l]+e.phase[l]);e.vx[l]+=h*1.7*t,e.vz[l]+=Math.cos(this.time*e.sway[l]*.8+e.phase[l])*1.2*t,e.vy[l]-=TM*t,e.vy[l]<-1.9&&(e.vy[l]=-1.9);const u=Math.max(0,1-CM*t);e.vx[l]*=u,e.vz[l]*=u,e.x[l]+=e.vx[l]*t,e.y[l]+=e.vy[l]*t,e.z[l]+=e.vz[l]*t,e.rx[l]+=e.sx[l]*t,e.ry[l]+=e.sy[l]*t,e.rz[l]+=e.sz[l]*t;const d=Math.min(1,e.life[l]/.5),f=e.size[l]*d;s.set(e.x[l],e.y[l],e.z[l]),o.set(e.rx[l],e.ry[l],e.rz[l]),r.setFromEuler(o),a.set(f,f,f),n.compose(s,r,a),this.confetti.setMatrixAt(l,n),c++}this.confettiActive=c,this.confetti.instanceMatrix.needsUpdate=!0},jf=function(){if(this.rain)return;const t=Ja,e=this._rnd;this.r={x:new Float32Array(t),y:new Float32Array(t),z:new Float32Array(t),len:new Float32Array(t),speed:new Float32Array(t)};for(let r=0;r<t;r++)J(this,Ae,al).call(this,r,e()*gd);const n=new qn(.022,.85);n.translate(0,-.425,0);const s=new mi({color:12177392,transparent:!0,opacity:.34,depthWrite:!1,toneMapped:!1,side:vn});this.rain=new Fo(n,s,t),this.rain.frustumCulled=!1,this.rain.instanceMatrix.setUsage(Yh),this.rain.castShadow=!1,this.rain.receiveShadow=!1,this.rain.renderOrder=2,this._rainBase=new qt().makeRotationZ(Qa),J(this,Ae,cl).call(this),this.scene.add(this.rain),this.allocations.rain++},al=function(t,e){const n=this._rnd,s=this.r;s.x[t]=(n()*2-1)*tc,s.z[t]=(n()*2-1)*RM,s.y[t]=e,s.len[t]=.75+n()*.8,s.speed[t]=wM*(.85+n()*.35)},cl=function(){const t=this.r,e=this._m.copy(this._rainBase);for(let n=0;n<Ja;n++)e.elements[4]=-Math.sin(Qa)*t.len[n],e.elements[5]=Math.cos(Qa)*t.len[n],e.elements[12]=t.x[n],e.elements[13]=t.y[n],e.elements[14]=t.z[n],this.rain.setMatrixAt(n,e);this.rain.instanceMatrix.needsUpdate=!0},Kf=function(t){const e=this.r,n=2.1*t;for(let s=0;s<Ja;s++)e.y[s]-=e.speed[s]*t,e.x[s]+=n,e.y[s]<0?J(this,Ae,al).call(this,s,gd+this._rnd()*2):e.x[s]>tc&&(e.x[s]-=tc*2);J(this,Ae,cl).call(this)},Zf=function(){if(this.sheen)return;const t=new mi({color:16777215,transparent:!0,opacity:.085,depthWrite:!1,blending:mc,toneMapped:!1});if(typeof document<"u"&&document.createElement){const e=document.createElement("canvas");e.width=e.height=128;const n=e.getContext("2d"),s=n.createRadialGradient(64,64,4,64,64,64);s.addColorStop(0,"rgba(255,255,255,1)"),s.addColorStop(.55,"rgba(255,255,255,0.45)"),s.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=s,n.fillRect(0,0,128,128);const r=new na(e);r.colorSpace=Oe,t.map=r}this.sheen=new ie(new qn(30,48),t),this.sheen.rotation.x=-Math.PI/2,this.sheen.position.y=.014,this.sheen.renderOrder=1,this.scene.add(this.sheen),this.allocations.sheen++};const kM=new Set(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","Enter"]),Eo=new Set;let vd=!1;function zM(){vd||typeof addEventListener=="function"&&(vd=!0,addEventListener("keydown",i=>{kM.has(i.code)&&i.preventDefault(),Eo.add(i.code)}),addEventListener("keyup",i=>Eo.delete(i.code)),addEventListener("blur",()=>Eo.clear()))}const Xi={up:"KeyW",down:"KeyS",left:"KeyA",right:"KeyD",kick:"Space",slide:"ShiftLeft"},ll={up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight",kick:"KeyX",slide:"KeyC"},FM={kick:"KeyX",slide:"KeyC"},Rr={up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight",kick:"Enter",slide:"ShiftRight"},Jf="goalnet-keys";function BM(){try{const i=JSON.parse(localStorage.getItem(Jf)||"{}");Object.assign(Xi,i.p1||{}),Object.assign(Rr,i.p2||{})}catch{}}function HM(){try{localStorage.setItem(Jf,JSON.stringify({p1:Xi,p2:Rr}))}catch{}}BM();let Qf={x:-1,z:0},tp={x:0,z:-1};function VM(i,t,e,n){Qf={x:i,z:t},tp={x:e,z:n}}function GM(i,t,e=Qf,n=tp){return{x:e.x*t+n.x*i,z:e.z*t+n.z*i}}const ep=.18,wi={kick:0,slide:1,camera:3,dpadUp:12,dpadDown:13,dpadLeft:14,dpadRight:15};function WM(i,t,e=ep){const n=Math.hypot(i,t);if(!(n>e))return{x:0,y:0,m:0};const s=Math.min(1,(n-e)/(1-e));return{x:i/n*s,y:t/n*s,m:s}}function Ri(i){return i==null?!1:typeof i=="number"?i>.5:i.pressed?!0:typeof i.value=="number"&&i.value>.5}function XM(i){const t=[];for(const e of i||[])e&&e.connected!==!1&&t.push(e);return t}function $M(i,t=ep){if(!i)return null;const e=i.axes||[],n=i.buttons||[],s=WM(Number(e[0])||0,Number(e[1])||0,t);let r=s.x,o=-s.y;return s.m===0&&(r=(Ri(n[wi.dpadRight])?1:0)-(Ri(n[wi.dpadLeft])?1:0),o=(Ri(n[wi.dpadUp])?1:0)-(Ri(n[wi.dpadDown])?1:0)),{right:r,up:o,kick:Ri(n[wi.kick]),slide:Ri(n[wi.slide]),camera:Ri(n[wi.camera])}}const YM=()=>typeof navigator<"u"&&typeof navigator.getGamepads=="function"?navigator.getGamepads():[];let qM=YM;function jM(){try{return XM(qM())}catch{return[]}}typeof addEventListener=="function"&&(addEventListener("gamepaddisconnected",()=>{}),addEventListener("gamepadconnected",()=>{}));const ye={root:"gn-touch",zone:"gn-touch-zone",stick:"gn-touch-stick",knob:"gn-touch-knob",buttons:"gn-touch-buttons",button:"gn-touch-btn",kick:"gn-touch-kick",slide:"gn-touch-slide",style:"gn-touch-style"},Hi=56,nc=.14;function KM(){return typeof window>"u"?!1:"ontouchstart"in window||typeof navigator<"u"&&navigator.maxTouchPoints>0?!0:!!(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)}const ZM=`
.${ye.root} { position: fixed; inset: 0; z-index: 15; pointer-events: none;
  touch-action: none; -webkit-user-select: none; user-select: none;
  font-family: 'Segoe UI', system-ui, sans-serif; }
.${ye.zone} { position: absolute; left: 0; top: 0; width: 50%; height: 100%;
  pointer-events: auto; touch-action: none; }
.${ye.stick} { position: absolute; width: ${Hi*2}px; height: ${Hi*2}px;
  margin: -${Hi}px 0 0 -${Hi}px; border-radius: 50%;
  background: rgba(255,255,255,0.10); border: 2px solid rgba(255,255,255,0.35);
  opacity: 0; transition: opacity 120ms ease; pointer-events: none; }
.${ye.stick}.on { opacity: 1; }
.${ye.knob} { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px;
  margin: -27px 0 0 -27px; border-radius: 50%;
  background: rgba(255,255,255,0.45); border: 2px solid rgba(255,255,255,0.7); }
.${ye.buttons} { position: absolute; right: 18px; bottom: 22px;
  display: flex; align-items: flex-end; gap: 14px; pointer-events: none; }
.${ye.button} { pointer-events: auto; touch-action: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; letter-spacing: 0.5px;
  border: 2px solid rgba(255,255,255,0.55); background: rgba(0,0,0,0.32);
  text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
.${ye.button}.on { background: rgba(255,255,255,0.4); transform: scale(0.94); }
.${ye.kick} { width: 96px; height: 96px; font-size: 19px;
  background: rgba(226,59,59,0.34); }
.${ye.slide} { width: 74px; height: 74px; font-size: 14px;
  background: rgba(59,109,226,0.34); }
`;var Cr,hl,Zo,Jo,Us;class JM{constructor(t){Be(this,Cr);Be(this,Zo,t=>{if(this.pointerId===null){t.preventDefault(),this.pointerId=t.pointerId,this.anchor={x:t.clientX,y:t.clientY},this.stick.style.left=`${t.clientX}px`,this.stick.style.top=`${t.clientY}px`,this.stick.classList.add("on");try{this.zone.setPointerCapture(t.pointerId)}catch{}}});Be(this,Jo,t=>{if(t.pointerId!==this.pointerId)return;t.preventDefault();const e=t.clientX-this.anchor.x,n=t.clientY-this.anchor.y,s=Math.hypot(e,n),r=Math.min(1,s/Hi);if(r<=nc||s===0){this.state.right=0,this.state.up=0,this.knob.style.transform="translate(0px, 0px)";return}const o=(r-nc)/(1-nc),a=e/s,c=n/s;this.state.right=a*o,this.state.up=-c*o;const l=a*r*Hi,h=c*r*Hi;this.knob.style.transform=`translate(${l.toFixed(1)}px, ${h.toFixed(1)}px)`});Be(this,Us,t=>{t.pointerId===this.pointerId&&(this.pointerId=null,this.state.right=0,this.state.up=0,this.stick.classList.remove("on"),this.knob.style.transform="translate(0px, 0px)")});const e=t.ownerDocument||document;if(!e.getElementById(ye.style)){const s=e.createElement("style");s.id=ye.style,s.textContent=ZM,e.head.appendChild(s)}this.state={right:0,up:0,kick:!1,slide:!1},this.pointerId=null,this.anchor={x:0,y:0},this.el=e.createElement("div"),this.el.className=ye.root,this.zone=e.createElement("div"),this.zone.className=ye.zone,this.el.appendChild(this.zone),this.stick=e.createElement("div"),this.stick.className=ye.stick,this.knob=e.createElement("div"),this.knob.className=ye.knob,this.stick.appendChild(this.knob),this.zone.appendChild(this.stick);const n=e.createElement("div");n.className=ye.buttons,this.slideBtn=J(this,Cr,hl).call(this,e,ye.slide,"KAYMA","slide"),this.kickBtn=J(this,Cr,hl).call(this,e,ye.kick,"ŞUT","kick"),n.append(this.slideBtn,this.kickBtn),this.el.appendChild(n),this.zone.addEventListener("pointerdown",Qi(this,Zo),{passive:!1}),this.zone.addEventListener("pointermove",Qi(this,Jo),{passive:!1}),this.zone.addEventListener("pointerup",Qi(this,Us)),this.zone.addEventListener("pointercancel",Qi(this,Us)),this.zone.addEventListener("lostpointercapture",Qi(this,Us)),t.appendChild(this.el)}setVisible(t){this.el.style.display=t?"":"none"}destroy(){var t;(t=this.el.parentNode)==null||t.removeChild(this.el),this.state={right:0,up:0,kick:!1,slide:!1}}}Cr=new WeakSet,hl=function(t,e,n,s){const r=t.createElement("div");r.className=`${ye.button} ${e}`,r.textContent=n;const o=a=>c=>{if(c.preventDefault(),this.state[s]=a,r.classList.toggle("on",a),a&&r.setPointerCapture)try{r.setPointerCapture(c.pointerId)}catch{}};return r.addEventListener("pointerdown",o(!0),{passive:!1}),r.addEventListener("pointerup",o(!1)),r.addEventListener("pointercancel",o(!1)),r.addEventListener("lostpointercapture",o(!1)),r},Zo=new WeakMap,Jo=new WeakMap,Us=new WeakMap;let Oi=null,xd=!1;function QM(i={}){return xd&&!i.force||(xd=!0,Oi)?Oi:typeof document>"u"||!document.body||!i.force&&!KM()?null:(Oi=new JM(i.root||document.body),Oi)}function tb(i){let t=0,e=0,n=0,s=!1,r=!1,o=!1;for(const a of i){if(!a)continue;s=s||!!a.kick,r=r||!!a.slide,o=o||!!a.camera;const c=Math.hypot(a.right||0,a.up||0);c>n+1e-9&&(n=c,t=a.right||0,e=a.up||0)}return{right:t,up:e,kick:s,slide:r,camera:o}}function eb(i,t=Eo){let e=0,n=0,s=!1,r=!1;for(const o of i)e+=(t.has(o.right)?1:0)-(t.has(o.left)?1:0),n+=(t.has(o.up)?1:0)-(t.has(o.down)?1:0),s=s||t.has(o.kick),r=r||t.has(o.slide);return{right:Math.max(-1,Math.min(1,e)),up:Math.max(-1,Math.min(1,n)),kick:s,slide:r}}class vr{constructor(t,e={}){this.maps=Array.isArray(t)?t:[t],this.slot=e.slot??(this.maps.includes(Rr)?1:0),this.useGamepad=e.gamepad!==!1,this.useTouch=e.touch!==!1&&this.slot===0,this.cameraEdge=!1,this._cameraWas=!1,zM(),this.useTouch&&QM()}intent(){const t=[eb(this.maps)];return this.useTouch&&Oi&&t.push(Oi.state),this.useGamepad&&t.push($M(jM()[this.slot])),tb(t)}update(){const t=this.intent();this.cameraEdge=t.camera&&!this._cameraWas,this._cameraWas=t.camera;const e=GM(t.right,t.up);return{x:e.x,z:e.z,kick:t.kick,slide:t.slide,camera:this.cameraEdge}}}class np{constructor(t,e){this.world=t,this.player=e,this.attackSign=e.team===0?1:-1,this.decideTimer=0,this.target={x:0,z:0},this.holdingKick=!1,this.chargeWant=0,this.noise={x:0,z:0}}update(t){const{world:e,player:n,attackSign:s}=this,r=e.ball.pos,o={x:0,z:s*Dt},a={x:0,z:-s*Dt};if(this.decideTimer-=t,this.decideTimer<=0){this.decideTimer=.14,this.noise={x:(Math.random()-.5)*.7,z:(Math.random()-.5)*.7};let g=o.x-r.x,_=o.z-r.z;const m=Math.sqrt(g*g+_*_)||1;g/=m,_/=m;const p={x:r.x-g*.55,z:r.z-_*.55};if((n.pos.z-r.z)*s>.2){const L=n.pos.x>=r.x?1:-1;this.target={x:r.x+L*(Li+ee+.8),z:r.z-_*1.4}}else this.target=p;const M=(e.ball.vel.z||0)*-s>3,v=(r.z-0)*s<0;M&&v&&(this.target={x:(r.x+a.x)/2,z:(r.z+a.z)/2})}let c=this.target.x+this.noise.x-n.pos.x,l=this.target.z+this.noise.z-n.pos.z;const h=Math.sqrt(c*c+l*l);h>.15?(c/=h,l/=h):(c=0,l=0);const u=Math.hypot(r.x-n.pos.x,r.z-n.pos.z),d=Math.hypot(o.x-r.x,o.z-r.z);let f=!1;return u<Hl+ee+.35?(this.holdingKick||(this.holdingKick=!0,this.chargeWant=Math.min(1,Math.max(.25,d/26)),this.heldFor=0),this.heldFor+=t,f=this.heldFor<this.chargeWant*Vl):(this.holdingKick=!1,f=!1),{x:c,z:l,kick:f}}}class ip{constructor(t,e){this.world=t,this.player=e,this.attackSign=e.team===0?1:-1,this.guardZ=-this.attackSign*(Dt-.9),this.holdingKick=!1,this.heldFor=0,this.diveCooldown=0,this.actionCooldown=0,this.decideTimer=0,this.cachedMove={x:0,z:0}}update(t){const{world:e,player:n,attackSign:s}=this,r=e.ball.pos,o=e.ball.vel;if(this.actionCooldown=Math.max(0,this.actionCooldown-t),this.diveCooldown=Math.max(0,this.diveCooldown-t),o.z*-s>9&&this.diveCooldown<=0&&this.actionCooldown<=0&&n.dive<=0&&r.y<2.2){const g=Math.abs(r.z-n.pos.z),_=g/Math.abs(o.z||1);if(g>2.5&&g<7.5&&_<.5){const m=r.x+o.x*_,p=m-n.pos.x,x=Math.abs(m)<e.config.goalW/2+.35,M=r.y+o.y*_-4.905*_*_;x&&M>1.5&&M<2.75&&Math.abs(p)<1&&n.jumpY<=0&&(n.startJump(),this.actionCooldown=Math.max(this.actionCooldown,.9));const v=Math.abs(p)/Math.max(_,.06);if(x&&v>5.5&&Math.abs(p)>1&&Math.abs(p)<3){const L=Math.min(8.5,Math.max(3.2,Math.abs(p)*2.6));n.startDive(Math.sign(p),0,L),this.diveCooldown=1.6,this.actionCooldown=1.4}}}const l=Math.hypot(r.x,r.z+this.attackSign*Dt)<5&&r.y<1.8;let h;if(l){h={x:r.x,z:r.z-s*.35},h.x=Math.max(-6.5,Math.min(6.5,h.x));const g=-s*Dt;h.z=s>0?Math.max(g+.6,Math.min(g+5.5,h.z)):Math.min(g-.6,Math.max(g-5.5,h.z))}else{const g=Math.max(-1,Math.min(1,o.x*.18)),_=Math.max(0,e.config.goalW/2-.4);h={x:Math.max(-_,Math.min(_,r.x*.55+g)),z:this.guardZ}}if(this.decideTimer-=t,this.decideTimer<=0){this.decideTimer=.12;let g=h.x-n.pos.x,_=h.z-n.pos.z;const m=Math.sqrt(g*g+_*_);m>.12?(g/=m,_/=m):(g=0,_=0);const p=this.actionCooldown>0?.55:1;this.cachedMove={x:g*p,z:_*p}}const u=(r.z-n.pos.z)*s>0,d=Math.hypot(r.x-n.pos.x,r.z-n.pos.z);let f=!1;return this.actionCooldown<=0&&u&&d<Hl+ee+.25?(this.holdingKick||(this.holdingKick=!0,this.heldFor=0),this.heldFor+=t,f=this.heldFor<.45*Vl,f||(this.holdingKick=!1,this.actionCooldown=1.2)):this.holdingKick=!1,{x:this.cachedMove.x,z:this.cachedMove.z,kick:f}}}const yd="goalnet-cam",nb=.8,Sd=1e-4;function ic(i,t){return Math.sin(i*13.1+t)*.6+Math.sin(i*23.7+t*2.3)*.3+Math.sin(i*41.3+t*4.1)*.1}const or=[{id:"yayin",label:"Kamera: Yayın"},{id:"capraz",label:"Kamera: Çapraz"},{id:"fpv",label:"Kamera: Oyuncu"}];class sp{constructor(t){this.camera=t;let e=null;try{e=localStorage.getItem(yd)}catch{}this.modeIndex=Math.max(0,or.findIndex(n=>n.id===e)),this.camZ=0,this.goalT=0,this.cam={x:28,y:24.5,z:0,lx:2.6,ly:.2,lz:0},this.shakeAmp=0,this.shakeT=0,this.shakeOffset={x:0,y:0,z:0}}shake(t){const e=Number.isFinite(t)?Math.abs(t):0;e>this.shakeAmp&&(this.shakeAmp=Math.min(e,nb))}get mode(){return or[this.modeIndex].id}cycle(){this.modeIndex=(this.modeIndex+1)%or.length;try{localStorage.setItem(yd,this.mode)}catch{}return or[this.modeIndex].label}update(t,e){const n=e.ball;this.camZ+=(n.z*.28-this.camZ)*Math.min(1,t*3);let s;if(e.state==="goal"){this.goalT+=t;const u=Math.sign(n.z)||1,d=Math.min(this.goalT/3,1);this.mode==="fpv"?s={x:n.x*.55+4,y:1.6+d*.5,z:u*(10.8+d*3),lx:n.x,ly:n.y+.3,lz:n.z}:this.mode==="capraz"?s={x:13-d*4,y:7-d*3.6,z:u*(10.5+d*3),lx:n.x,ly:n.y+.4,lz:n.z}:s={x:8.5-d*2.5,y:2.8-d*.7,z:u*(12.6+d*2.2),lx:n.x,ly:n.y+.3,lz:n.z}}else if(this.mode==="fpv"&&e.me){const u=e.me,d=Math.sin(u.facing),f=Math.cos(u.facing);s={x:u.pos.x-d*3.6,y:2.4,z:u.pos.z-f*3.6,lx:u.pos.x+d*4,ly:.8,lz:u.pos.z+f*4}}else this.mode==="capraz"?s={x:23,y:15,z:this.camZ*.55+11,lx:n.x*.45,ly:.6,lz:n.z*.55}:s={x:28,y:24.5,z:this.camZ,lx:2.6,ly:.2,lz:this.camZ*1.2};e.state!=="goal"&&(this.goalT=0);const r=Math.min(1,t*(e.state==="goal"?this.goalT<.8?5.5:2.2:this.mode==="fpv"?6.5:3.2)),o=this.cam;for(const u of["x","y","z","lx","ly","lz"])o[u]+=(s[u]-o[u])*r;const a=this.shakeOffset;if(this.shakeAmp>Sd){this.shakeT+=t,this.shakeAmp*=Math.exp(-5*t),this.shakeAmp<=Sd&&(this.shakeAmp=0);const u=this.shakeAmp;a.x=ic(this.shakeT,0)*u,a.y=ic(this.shakeT,1.7)*u*.7,a.z=ic(this.shakeT,3.4)*u}else(a.x!==0||a.y!==0||a.z!==0)&&(this.shakeAmp=0,a.x=a.y=a.z=0);this.camera.position.set(o.x+a.x,o.y+a.y,o.z+a.z),this.camera.lookAt(o.lx,o.ly,o.lz);let c=o.lx-o.x,l=o.lz-o.z;const h=Math.hypot(c,l)||1;c/=h,l/=h,VM(c,l,-l,c)}}const ib=6,sb=8,rb=3.5,ob=1,Md=["KIRMIZI","MAVİ"];class ab{constructor(){this.reset()}reset(){this.shots=[0,0],this.onTarget=[0,0],this.saves=[0,0],this.possession=[0,0],this.fouls=[0,0],this.pending=null,this.saveCool=0}foul(t){(t===0||t===1)&&this.fouls[t]++}onKick(t,e){if(t!==0&&t!==1)return;const n=e.attackSign(t),s=e.ball;s.vel.z*n<ib||Math.abs(s.pos.z)>Dt||(this.shots[t]++,this.pending={team:t,life:0,onTarget:!1})}onGoal(t){this.markOnTarget(t)||(this.shots[t]++,this.onTarget[t]++),this.pending=null}markOnTarget(t){const e=this.pending;return!e||e.team!==t?!1:(e.onTarget||(e.onTarget=!0,this.onTarget[t]++),!0)}update(t,e){const n=e.ball,s=n.lastTouch;if((s===0||s===1)&&(this.possession[s]+=t),this.pending){const r=this.pending;r.life+=t;const o=e.attackSign(r.team),c=(o*Dt-n.pos.z)*o<1.2,l=Math.abs(n.pos.x)<e.config.goalW/2+.2&&n.pos.y<e.config.goalH+.2;n.vel.z*o>2&&c&&l&&this.markOnTarget(r.team),r.life>rb&&(this.pending=null)}if(this.saveCool=Math.max(0,this.saveCool-t),!(this.saveCool>0))for(const r of e.players){if(r.role!=="keeper")continue;const o=-e.attackSign(r.team);if(!(n.vel.z*o<sb||Math.hypot(n.pos.x-r.pos.x,n.pos.z-r.pos.z)>1.3||n.pos.y>2.6)){this.saves[r.team]++,this.saveCool=ob,this.markOnTarget(1-r.team);break}}}possessionPct(){const t=this.possession[0]+this.possession[1];if(t<=0)return[50,50];const e=Math.round(this.possession[0]/t*100);return[e,100-e]}rows(){const t=this.possessionPct();return[["Şut",this.shots[0],this.shots[1]],["İsabetli şut",this.onTarget[0],this.onTarget[1]],["Kurtarış",this.saves[0],this.saves[1]],["Topa sahip olma",`%${t[0]}`,`%${t[1]}`],["Faul",this.fouls[0],this.fouls[1]]]}renderPanel(t){if(!t||typeof document>"u")return null;let e=this.panel;if(!e||e.parentNode!==t){e=document.createElement("div"),e.id="statsPanel",this.panel=e,Object.assign(e.style,{margin:"4px 0 22px",padding:"14px 22px",borderRadius:"14px",background:"rgba(8, 14, 30, .55)",border:"1px solid rgba(120, 150, 220, .18)",backdropFilter:"blur(6px)",minWidth:"320px",color:"#fff"});const o=t.querySelector("#btnAgain");t.insertBefore(e,o??null)}e.textContent="";const n=document.createElement("table");Object.assign(n.style,{borderCollapse:"collapse",width:"100%",fontSize:"15px"});const s=(o,a={})=>{const c=document.createElement(a.head?"th":"td");return c.textContent=String(o),Object.assign(c.style,{padding:"7px 12px",textAlign:a.align??"center",color:a.color??"#fff",fontWeight:a.head||a.align==="left"?"700":"600",borderBottom:"1px solid rgba(120, 150, 220, .14)"}),c},r=document.createElement("tr");r.appendChild(s("",{head:!0})),r.appendChild(s(Md[0],{head:!0,color:"#ff8a8a"})),r.appendChild(s(Md[1],{head:!0,color:"#8aa8ff"})),n.appendChild(r);for(const[o,a,c]of this.rows()){const l=document.createElement("tr");l.appendChild(s(o,{align:"left",color:"#9fb0d8"})),l.appendChild(s(a)),l.appendChild(s(c)),n.appendChild(l)}return e.appendChild(n),e}}const cb=["KIRMIZI","MAVİ"];function lb(i){const t=[{id:"p1",team:0,role:"field"},{id:"p2",team:1,role:"field"}];return i.keepers&&t.push({id:"kr",team:0,role:"keeper"},{id:"kb",team:1,role:"keeper"}),t}class hb{constructor(t,e,n,s=null){this.world=t,this.camera=e,this.dom=n,this.state="menu",this.timeScale=1,this.score=[0,0],this.halfLength=t.config.matchTime/2,this.timeLeft=this.halfLength,this.half=1,this.golden=!1,this.setPiece=null,this.frozenUntil=0,this.stats=new ab,this.msgTimer=null,this.setPieceMsgTimer=null,this.outTimer=0,this.rig=new sp(e),this.byId=new Map;for(const r of s??lb(t.config)){const o=t.addPlayer(r.team,r.role??"field");o.mpId=r.id,o.mpName=r.name??"",this.byId.set(r.id,o)}this.playerRed=t.players.find(r=>r.team===0&&r.role==="field")??null,this.playerBlue=t.players.find(r=>r.team===1&&r.role==="field")??null,this.keepers=t.players.filter(r=>r.role==="keeper"),this.chargeState=new Map,this.layoutKickoff()}startMatch(t){this.mode=t;const e=t==="2p"?[Xi,FM]:[Xi,ll],n=new Map([[this.playerRed,new vr(e)]]);this.playerBlue&&n.set(this.playerBlue,t==="2p"?new vr(Rr):new np(this.world,this.playerBlue));for(const s of this.keepers)n.set(s,new ip(this.world,s));this.beginMatch(n,t)}beginMatch(t,e=this.mode){this.mode=e,this.controllers=t,this.score=[0,0],this.halfLength=this.world.config.matchTime/2,this.timeLeft=this.halfLength,this.half=1,this.golden=!1,this.setPiece=null,this.frozenUntil=0,this.kickoffTeam=null,this.world.sideSwap=!1,this.applyAttackSigns(),this.stats.reset(),this.dom.menu.classList.add("hidden"),this.dom.end.classList.add("hidden"),this.updateScoreboard(),this.kickoff()}applyAttackSigns(){if(this.controllers)for(const[t,e]of this.controllers)!e||typeof e.attackSign!="number"||(e.attackSign=this.world.attackSign(t.team),typeof e.guardZ=="number"&&(e.guardZ=-e.attackSign*(Dt-.9)))}layoutKickoff(){const t=[0,-2.4,2.4];for(const e of[0,1]){const n=-this.world.attackSign(e);this.world.players.filter(r=>r.team===e&&r.role==="field").forEach((r,o)=>r.reset(t[o%t.length],n*5));for(const r of this.keepers.filter(o=>o.team===e))r.reset(0,n*(Dt-.9))}this.world.placeBall(0,0),this.world.restartTeam=null,this.chargeState.clear()}kickoff(){this.layoutKickoff(),this.setPiece=null,this.timeScale=1,this.state="kickoff",this.kickoffAt=performance.now()/1e3+1.1,this.kickoffTeam!=null&&(this.world.restartTeam=this.kickoffTeam,this.restartClearAt=performance.now()/1e3+6,this.kickoffTeam=null),this.showMessage("Hazır…","hazir",1e3)}beginRestart(t,e){this.restartFreezeUntil=t+1,this.world.restartTeam=e??null,this.restartClearAt=t+6}showMessage(t,e,n=1600){const s=this.dom.msg;s.textContent=t,s.className=`hud show ${e}`,clearTimeout(this.msgTimer),this.msgTimer=setTimeout(()=>{s.className="hud"},n)}isHuman(t){return!!this.controllers&&this.controllers.get(t)instanceof vr}nearestOf(t,e,n){let s=null,r=1/0;for(const o of["field","any"]){for(const a of this.world.players){if(a.team!==t||o==="field"&&a.role!=="field")continue;const c=Math.hypot(a.pos.x-e,a.pos.z-n);c<r&&(r=c,s=a)}if(s)return s}return s}onFoul(t,e){const n=1-t.team;this.stats.foul(n);const s=-this.world.attackSign(n)*Dt;Math.abs(t.x)<Fh&&Math.abs(t.z-s)<la?this.awardPenalty(t.team,Math.sign(s),e):this.awardFreeKick(t.team,t.x,t.z,e)}awardFreeKick(t,e,n,s){var l;const r=Math.max(-10.3,Math.min(Cn-1.2,e)),o=Math.max(-16.8,Math.min(Dt-1.2,n));this.world.placeBall(r,o);const a=this.nearestOf(t,r,o),c=this.world.attackSign(t);a&&(a.reset(r,o-c*.9),a.facing=c>0?0:Math.PI),this.beginSetPiece("freekick",t,a,null,s),(l=this.onWorldEvent)==null||l.call(this,{type:"freekick",team:t},!0),this.announce("Serbest vuruş!","direk")}awardPenalty(t,e,n){var h;const s=e*(Dt-Gm),r=e*Dt;this.world.placeBall(0,s);const o=this.nearestOf(t,0,s),a=this.keepers.find(u=>u.team===1-t)??null,c=e*(Dt-la-1.6);let l=0;for(const u of this.world.players){if(u===o||u===a||!(Math.abs(u.pos.x)<Fh&&Math.abs(u.pos.z-r)<la))continue;const f=(l%2===0?1:-1)*(1.6+Math.floor(l/2)*1.7);l++,u.reset(Math.max(-10.5,Math.min(Cn-1,f)),c)}o&&(o.reset(0,s-e*1),o.facing=e>0?0:Math.PI),a&&(a.reset(0,r-e*.9),a.facing=e>0?Math.PI:0),this.beginSetPiece("penalty",t,o,a,n),(h=this.onWorldEvent)==null||h.call(this,{type:"penalty",team:t},!0),this.announce("Penaltı!","gol")}beginSetPiece(t,e,n,s,r){this.setPiece={kind:t,team:e,kicker:n,keeper:s,live:!1,deadline:r+Bh+Wm},this.timeScale=1,this.state="kickoff",this.kickoffAt=r+Bh,this.chargeState.clear()}announce(t,e){const n=this.setPiece;this.showMessage("Faul!","kacti",700),clearTimeout(this.setPieceMsgTimer),this.setPieceMsgTimer=setTimeout(()=>{this.setPiece===n&&this.showMessage(t,e,1400)},750)}canAct(t){const e=this.setPiece;return e?e.live?t===e.kicker?!0:e.kind==="penalty"?t===e.keeper:t.team===e.team:!1:!0}resolveSetPiece(t){const e=this.setPiece;if(!e||!e.live)return;const n=this.world.ball;(n.lastTouch===e.team&&Math.hypot(n.vel.x,n.vel.z)>1.5||t>e.deadline)&&(this.setPiece=null)}halfTime(t){var e;this.half=2,this.world.sideSwap=!this.world.sideSwap,this.applyAttackSigns(),this.timeLeft=this.halfLength,this.setPiece=null,this.layoutKickoff(),this.timeScale=1,this.state="kickoff",this.kickoffAt=t+ha,this.frozenUntil=t+ha,this.updateScoreboard(),(e=this.onWorldEvent)==null||e.call(this,{type:"half"},!0),this.showMessage("Devre Arası","hazir",ha*1e3)}startGolden(t){var e;this.golden=!0,this.timeLeft=Ym,this.updateScoreboard(),(e=this.onWorldEvent)==null||e.call(this,{type:"golden"},!0),this.showMessage("Altın Gol!","gol",2200)}updateScoreboard(){if(this.dom.scoreRed.textContent=this.score[0],this.dom.scoreBlue.textContent=this.score[1],this.mode==="train"){this.dom.timer.textContent="∞";return}const t=Math.max(0,Math.ceil(this.timeLeft));this.dom.timer.textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}applyControls(t,e){const n=e<this.frozenUntil||e<(this.restartFreezeUntil??0);for(const[s,r]of this.controllers){const o=r.update(t),a=!n&&this.canAct(s);s.input.x=a?o.x:0,s.input.z=a?o.z:0;let c=this.chargeState.get(s);if(c||(c={held:!1,t:0},this.chargeState.set(s,c)),!a){c.held=!1,c.slideHeld=!!o.slide,s.charge=0,s.kickAnim=Math.max(0,s.kickAnim-t*4);continue}if(s.down>0){c.held=!1,s.charge=0,s.kickAnim=Math.max(0,s.kickAnim-t*4);continue}if(o.slide&&!c.slideHeld){const l=o.x||Math.sin(s.facing),h=o.z||Math.cos(s.facing);s.startSlide(l,h)}if(c.slideHeld=!!o.slide,o.kick&&!c.held&&(c.held=!0,c.t=e),c.held&&(s.charge=Math.min((e-c.t)/Vl,1)),!o.kick&&c.held){c.held=!1;const l=this.world.tryKick(s,s.charge);l==="header"?s.headerAnim=1:l&&(s.kickAnim=1),s.charge=0}s.kickAnim=Math.max(0,s.kickAnim-t*4),s.headerAnim=Math.max(0,s.headerAnim-t*5)}}endMatch(){var n;this.state="end",this.setPiece=null,this.frozenUntil=0;const[t,e]=this.score;this.dom.endTitle.textContent=t===e?"Berabere!":`${cb[t>e?0:1]} kazandı!`,this.dom.endScore.textContent=`${t} — ${e}`,this.stats.renderPanel(this.dom.end),this.dom.end.classList.remove("hidden"),(n=this.onMatchEnd)==null||n.call(this)}onGoal(t,e){for(const n of this.world.players)n.celebrate=n.team===t?1:-1;this.kickoffTeam=1-t,this.score[t]++,this.stats.onGoal(t),this.setPiece=null,this.updateScoreboard(),this.showMessage("GOOOL!","gol",2600),this.timeScale=.3,this.slowUntil=e+2.2,this.state="goal",this.goalResetAt=e+4.6}update(t,e){var r,o,a,c,l;const n=this.state==="play";this.state==="kickoff"&&e>this.kickoffAt&&(this.state="play",this.setPiece&&(this.setPiece.live=!0)),(this.state==="play"||this.state==="kickoff")&&this.applyControls(t,e);let s=!1;for(const h of this.world.drainEvents())(r=this.onWorldEvent)==null||r.call(this,h,n),h.type==="goal"&&n?this.onGoal(h.scorer,e):h.type==="post"&&n?this.showMessage("Direk!","direk",900):h.type==="crossbar"&&n?this.showMessage("Üst direk!","direk",900):h.type==="kick"&&n?(this.stats.onKick(h.team,this.world),(o=this.setPiece)!=null&&o.live&&h.team===this.setPiece.team&&(this.setPiece=null)):h.type==="foul"&&n&&!s&&(s=!0,this.onFoul(h,e));if(!s){if(n&&(this.stats.update(t,this.world),this.resolveSetPiece(e)),n&&this.mode!=="train"&&(this.timeLeft-=t,this.updateScoreboard(),this.timeLeft<=0)){if(this.half===1){this.halfTime(e);return}if(!this.golden&&this.score[0]===this.score[1])this.startGolden(e);else{this.endMatch();return}}if(n){this.world.restartTeam!==null&&e>(this.restartClearAt??0)&&(this.world.restartTeam=null);const h=this.world.ball.pos;if(Math.abs(h.x)>Cn+ee){const u=Math.sign(h.x),d=Math.max(-Dt+2,Math.min(Dt-2,h.z)),f=this.world.ball.lastTouch;this.world.placeBall(u*(Cn-1.2),d),this.showMessage("Taç!","kacti",1e3),(a=this.onWorldEvent)==null||a.call(this,{type:"throwin"},!0),this.beginRestart(e,f===null?null:1-f),this.outTimer=0}else if(Math.abs(h.z)>Dt+.2&&!this.world.scoringLocked){const u=Math.sign(h.z),d=this.world.attackSign(0)===u?1:0;if(this.world.ball.lastTouch===d){const f=(Math.sign(h.x)||1)*10.6;this.world.placeBall(f,u*(Dt-.4)),this.showMessage("Korner!","direk",1e3),(c=this.onWorldEvent)==null||c.call(this,{type:"corner"},!0),this.beginRestart(e,1-d)}else this.world.placeBall(0,u*(Dt-3.2)),this.showMessage("Kale vuruşu!","kacti",1e3),(l=this.onWorldEvent)==null||l.call(this,{type:"goalkick"},!0),this.beginRestart(e,d)}}if(this.state==="goal"&&(this.timeScale<1&&e>this.slowUntil&&(this.timeScale=1),e>this.goalResetAt)){const h=this.world.config.goalLimit;this.mode!=="train"&&this.golden?this.endMatch():this.mode!=="train"&&h>0&&(this.score[0]>=h||this.score[1]>=h)?this.endMatch():this.kickoff()}this.rig.update(t,{ball:this.world.ball.pos,state:this.state,me:this.playerRed})}}}class ub{constructor(){this.encoder=new TextEncoder,this._pieces=[],this._parts=[]}append_buffer(t){this.flush(),this._parts.push(t)}append(t){this._pieces.push(t)}flush(){if(this._pieces.length>0){const t=new Uint8Array(this._pieces);this._parts.push(t),this._pieces=[]}}toArrayBuffer(){const t=[];for(const e of this._parts)t.push(e);return db(t).buffer}}function db(i){let t=0;for(const s of i)t+=s.byteLength;const e=new Uint8Array(t);let n=0;for(const s of i){const r=new Uint8Array(s.buffer,s.byteOffset,s.byteLength);e.set(r,n),n+=s.byteLength}return e}function rp(i){return new fb(i).unpack()}function op(i){const t=new pb,e=t.pack(i);return e instanceof Promise?e.then(()=>t.getBuffer()):t.getBuffer()}class fb{constructor(t){this.index=0,this.dataBuffer=t,this.dataView=new Uint8Array(this.dataBuffer),this.length=this.dataBuffer.byteLength}unpack(){const t=this.unpack_uint8();if(t<128)return t;if((t^224)<32)return(t^224)-32;let e;if((e=t^160)<=15)return this.unpack_raw(e);if((e=t^176)<=15)return this.unpack_string(e);if((e=t^144)<=15)return this.unpack_array(e);if((e=t^128)<=15)return this.unpack_map(e);switch(t){case 192:return null;case 193:return;case 194:return!1;case 195:return!0;case 202:return this.unpack_float();case 203:return this.unpack_double();case 204:return this.unpack_uint8();case 205:return this.unpack_uint16();case 206:return this.unpack_uint32();case 207:return this.unpack_uint64();case 208:return this.unpack_int8();case 209:return this.unpack_int16();case 210:return this.unpack_int32();case 211:return this.unpack_int64();case 212:return;case 213:return;case 214:return;case 215:return;case 216:return e=this.unpack_uint16(),this.unpack_string(e);case 217:return e=this.unpack_uint32(),this.unpack_string(e);case 218:return e=this.unpack_uint16(),this.unpack_raw(e);case 219:return e=this.unpack_uint32(),this.unpack_raw(e);case 220:return e=this.unpack_uint16(),this.unpack_array(e);case 221:return e=this.unpack_uint32(),this.unpack_array(e);case 222:return e=this.unpack_uint16(),this.unpack_map(e);case 223:return e=this.unpack_uint32(),this.unpack_map(e)}}unpack_uint8(){const t=this.dataView[this.index]&255;return this.index++,t}unpack_uint16(){const t=this.read(2),e=(t[0]&255)*256+(t[1]&255);return this.index+=2,e}unpack_uint32(){const t=this.read(4),e=((t[0]*256+t[1])*256+t[2])*256+t[3];return this.index+=4,e}unpack_uint64(){const t=this.read(8),e=((((((t[0]*256+t[1])*256+t[2])*256+t[3])*256+t[4])*256+t[5])*256+t[6])*256+t[7];return this.index+=8,e}unpack_int8(){const t=this.unpack_uint8();return t<128?t:t-256}unpack_int16(){const t=this.unpack_uint16();return t<32768?t:t-65536}unpack_int32(){const t=this.unpack_uint32();return t<2**31?t:t-2**32}unpack_int64(){const t=this.unpack_uint64();return t<2**63?t:t-2**64}unpack_raw(t){if(this.length<this.index+t)throw new Error(`BinaryPackFailure: index is out of range ${this.index} ${t} ${this.length}`);const e=this.dataBuffer.slice(this.index,this.index+t);return this.index+=t,e}unpack_string(t){const e=this.read(t);let n=0,s="",r,o;for(;n<t;)r=e[n],r<160?(o=r,n++):(r^192)<32?(o=(r&31)<<6|e[n+1]&63,n+=2):(r^224)<16?(o=(r&15)<<12|(e[n+1]&63)<<6|e[n+2]&63,n+=3):(o=(r&7)<<18|(e[n+1]&63)<<12|(e[n+2]&63)<<6|e[n+3]&63,n+=4),s+=String.fromCodePoint(o);return this.index+=t,s}unpack_array(t){const e=new Array(t);for(let n=0;n<t;n++)e[n]=this.unpack();return e}unpack_map(t){const e={};for(let n=0;n<t;n++){const s=this.unpack();e[s]=this.unpack()}return e}unpack_float(){const t=this.unpack_uint32(),e=t>>31,n=(t>>23&255)-127,s=t&8388607|8388608;return(e===0?1:-1)*s*2**(n-23)}unpack_double(){const t=this.unpack_uint32(),e=this.unpack_uint32(),n=t>>31,s=(t>>20&2047)-1023,o=(t&1048575|1048576)*2**(s-20)+e*2**(s-52);return(n===0?1:-1)*o}read(t){const e=this.index;if(e+t<=this.length)return this.dataView.subarray(e,e+t);throw new Error("BinaryPackFailure: read index out of range")}}class pb{getBuffer(){return this._bufferBuilder.toArrayBuffer()}pack(t){if(typeof t=="string")this.pack_string(t);else if(typeof t=="number")Math.floor(t)===t?this.pack_integer(t):this.pack_double(t);else if(typeof t=="boolean")t===!0?this._bufferBuilder.append(195):t===!1&&this._bufferBuilder.append(194);else if(t===void 0)this._bufferBuilder.append(192);else if(typeof t=="object")if(t===null)this._bufferBuilder.append(192);else{const e=t.constructor;if(t instanceof Array){const n=this.pack_array(t);if(n instanceof Promise)return n.then(()=>this._bufferBuilder.flush())}else if(t instanceof ArrayBuffer)this.pack_bin(new Uint8Array(t));else if("BYTES_PER_ELEMENT"in t){const n=t;this.pack_bin(new Uint8Array(n.buffer,n.byteOffset,n.byteLength))}else if(t instanceof Date)this.pack_string(t.toString());else{if(t instanceof Blob)return t.arrayBuffer().then(n=>{this.pack_bin(new Uint8Array(n)),this._bufferBuilder.flush()});if(e==Object||e.toString().startsWith("class")){const n=this.pack_object(t);if(n instanceof Promise)return n.then(()=>this._bufferBuilder.flush())}else throw new Error(`Type "${e.toString()}" not yet supported`)}}else throw new Error(`Type "${typeof t}" not yet supported`);this._bufferBuilder.flush()}pack_bin(t){const e=t.length;if(e<=15)this.pack_uint8(160+e);else if(e<=65535)this._bufferBuilder.append(218),this.pack_uint16(e);else if(e<=4294967295)this._bufferBuilder.append(219),this.pack_uint32(e);else throw new Error("Invalid length");this._bufferBuilder.append_buffer(t)}pack_string(t){const e=this._textEncoder.encode(t),n=e.length;if(n<=15)this.pack_uint8(176+n);else if(n<=65535)this._bufferBuilder.append(216),this.pack_uint16(n);else if(n<=4294967295)this._bufferBuilder.append(217),this.pack_uint32(n);else throw new Error("Invalid length");this._bufferBuilder.append_buffer(e)}pack_array(t){const e=t.length;if(e<=15)this.pack_uint8(144+e);else if(e<=65535)this._bufferBuilder.append(220),this.pack_uint16(e);else if(e<=4294967295)this._bufferBuilder.append(221),this.pack_uint32(e);else throw new Error("Invalid length");const n=s=>{if(s<e){const r=this.pack(t[s]);return r instanceof Promise?r.then(()=>n(s+1)):n(s+1)}};return n(0)}pack_integer(t){if(t>=-32&&t<=127)this._bufferBuilder.append(t&255);else if(t>=0&&t<=255)this._bufferBuilder.append(204),this.pack_uint8(t);else if(t>=-128&&t<=127)this._bufferBuilder.append(208),this.pack_int8(t);else if(t>=0&&t<=65535)this._bufferBuilder.append(205),this.pack_uint16(t);else if(t>=-32768&&t<=32767)this._bufferBuilder.append(209),this.pack_int16(t);else if(t>=0&&t<=4294967295)this._bufferBuilder.append(206),this.pack_uint32(t);else if(t>=-2147483648&&t<=2147483647)this._bufferBuilder.append(210),this.pack_int32(t);else if(t>=-9223372036854776e3&&t<=9223372036854776e3)this._bufferBuilder.append(211),this.pack_int64(t);else if(t>=0&&t<=18446744073709552e3)this._bufferBuilder.append(207),this.pack_uint64(t);else throw new Error("Invalid integer")}pack_double(t){let e=0;t<0&&(e=1,t=-t);const n=Math.floor(Math.log(t)/Math.LN2),s=t/2**n-1,r=Math.floor(s*2**52),o=2**32,a=e<<31|n+1023<<20|r/o&1048575,c=r%o;this._bufferBuilder.append(203),this.pack_int32(a),this.pack_int32(c)}pack_object(t){const e=Object.keys(t),n=e.length;if(n<=15)this.pack_uint8(128+n);else if(n<=65535)this._bufferBuilder.append(222),this.pack_uint16(n);else if(n<=4294967295)this._bufferBuilder.append(223),this.pack_uint32(n);else throw new Error("Invalid length");const s=r=>{if(r<e.length){const o=e[r];if(t.hasOwnProperty(o)){this.pack(o);const a=this.pack(t[o]);if(a instanceof Promise)return a.then(()=>s(r+1))}return s(r+1)}};return s(0)}pack_uint8(t){this._bufferBuilder.append(t)}pack_uint16(t){this._bufferBuilder.append(t>>8),this._bufferBuilder.append(t&255)}pack_uint32(t){const e=t&4294967295;this._bufferBuilder.append((e&4278190080)>>>24),this._bufferBuilder.append((e&16711680)>>>16),this._bufferBuilder.append((e&65280)>>>8),this._bufferBuilder.append(e&255)}pack_uint64(t){const e=t/4294967296,n=t%2**32;this._bufferBuilder.append((e&4278190080)>>>24),this._bufferBuilder.append((e&16711680)>>>16),this._bufferBuilder.append((e&65280)>>>8),this._bufferBuilder.append(e&255),this._bufferBuilder.append((n&4278190080)>>>24),this._bufferBuilder.append((n&16711680)>>>16),this._bufferBuilder.append((n&65280)>>>8),this._bufferBuilder.append(n&255)}pack_int8(t){this._bufferBuilder.append(t&255)}pack_int16(t){this._bufferBuilder.append((t&65280)>>8),this._bufferBuilder.append(t&255)}pack_int32(t){this._bufferBuilder.append(t>>>24&255),this._bufferBuilder.append((t&16711680)>>>16),this._bufferBuilder.append((t&65280)>>>8),this._bufferBuilder.append(t&255)}pack_int64(t){const e=Math.floor(t/4294967296),n=t%2**32;this._bufferBuilder.append((e&4278190080)>>>24),this._bufferBuilder.append((e&16711680)>>>16),this._bufferBuilder.append((e&65280)>>>8),this._bufferBuilder.append(e&255),this._bufferBuilder.append((n&4278190080)>>>24),this._bufferBuilder.append((n&16711680)>>>16),this._bufferBuilder.append((n&65280)>>>8),this._bufferBuilder.append(n&255)}constructor(){this._bufferBuilder=new ub,this._textEncoder=new TextEncoder}}let ap=!0,cp=!0;function ar(i,t,e){const n=i.match(t);return n&&n.length>=e&&parseFloat(n[e],10)}function qi(i,t,e){if(!i.RTCPeerConnection)return;if(!Object.getOwnPropertyDescriptor(EventTarget.prototype,"addEventListener").writable){dh("Unable to polyfill events");return}const s=i.RTCPeerConnection.prototype,r=s.addEventListener;s.addEventListener=function(a,c){if(a!==t)return r.apply(this,arguments);const l=h=>{const u=e(h);u&&(c.handleEvent?c.handleEvent(u):c(u))};return this._eventMap=this._eventMap||{},this._eventMap[t]||(this._eventMap[t]=new Map),this._eventMap[t].set(c,l),r.apply(this,[a,l])};const o=s.removeEventListener;s.removeEventListener=function(a,c){if(a!==t||!this._eventMap||!this._eventMap[t])return o.apply(this,arguments);if(!this._eventMap[t].has(c))return o.apply(this,arguments);const l=this._eventMap[t].get(c);return this._eventMap[t].delete(c),this._eventMap[t].size===0&&delete this._eventMap[t],Object.keys(this._eventMap).length===0&&delete this._eventMap,o.apply(this,[a,l])},Object.defineProperty(s,"on"+t,{get(){return this["_on"+t]},set(a){this["_on"+t]&&(this.removeEventListener(t,this["_on"+t]),delete this["_on"+t]),a&&this.addEventListener(t,this["_on"+t]=a)},enumerable:!0,configurable:!0})}function mb(i){return typeof i!="boolean"?new Error("Argument type: "+typeof i+". Please use a boolean."):(ap=i,i?"adapter.js logging disabled":"adapter.js logging enabled")}function gb(i){return typeof i!="boolean"?new Error("Argument type: "+typeof i+". Please use a boolean."):(cp=!i,"adapter.js deprecation warnings "+(i?"disabled":"enabled"))}function dh(){if(typeof window=="object"){if(ap)return;typeof console<"u"&&typeof console.log=="function"&&console.log.apply(console,arguments)}}function fh(i,t){cp&&console.warn(i+" is deprecated, please use "+t+" instead.")}function _b(i){const t={browser:null,version:null};if(typeof i>"u"||!i.navigator||!i.navigator.userAgent)return t.browser="Not a browser.",t;const{navigator:e}=i;if(e.userAgentData&&e.userAgentData.brands){const n=e.userAgentData.brands.find(s=>s.brand==="Chromium");if(n){const s=parseInt(n.version,10);if(s>=90)return{browser:"chrome",version:s}}}if(e.mozGetUserMedia)t.browser="firefox",t.version=parseInt(ar(e.userAgent,/Firefox\/(\d+)\./,1));else if(e.webkitGetUserMedia||i.isSecureContext===!1&&i.webkitRTCPeerConnection)t.browser="chrome",t.version=parseInt(ar(e.userAgent,/Chrom(e|ium)\/(\d+)\./,2))||null;else if(i.RTCPeerConnection&&e.userAgent.match(/AppleWebKit\/(\d+)\./))t.browser="safari",t.version=parseInt(ar(e.userAgent,/AppleWebKit\/(\d+)\./,1)),t.supportsUnifiedPlan=i.RTCRtpTransceiver&&"currentDirection"in i.RTCRtpTransceiver.prototype,t._safariVersion=ar(e.userAgent,/Version\/(\d+(\.?\d+))/,1);else return t.browser="Not a supported browser.",t;return t}function bd(i){return Object.prototype.toString.call(i)==="[object Object]"}function lp(i){return bd(i)?Object.keys(i).reduce(function(t,e){const n=bd(i[e]),s=n?lp(i[e]):i[e],r=n&&!Object.keys(s).length;return s===void 0||r?t:Object.assign(t,{[e]:s})},{}):i}function ul(i,t,e){!t||e.has(t.id)||(e.set(t.id,t),Object.keys(t).forEach(n=>{n.endsWith("Id")?ul(i,i.get(t[n]),e):n.endsWith("Ids")&&t[n].forEach(s=>{ul(i,i.get(s),e)})}))}function Ed(i,t,e){const n=e?"outbound-rtp":"inbound-rtp",s=new Map;if(t===null)return s;const r=[];return i.forEach(o=>{o.type==="track"&&o.trackIdentifier===t.id&&r.push(o)}),r.forEach(o=>{i.forEach(a=>{a.type===n&&a.trackId===o.id&&ul(i,a,s)})}),s}const Td=dh;function hp(i,t){if(t.version>=64)return;const e=i&&i.navigator;if(!e.mediaDevices)return;const n=function(a){if(typeof a!="object"||a.mandatory||a.optional)return a;const c={};return Object.keys(a).forEach(l=>{if(l==="require"||l==="advanced"||l==="mediaSource")return;const h=typeof a[l]=="object"?a[l]:{ideal:a[l]};h.exact!==void 0&&typeof h.exact=="number"&&(h.min=h.max=h.exact);const u=function(d,f){return d?d+f.charAt(0).toUpperCase()+f.slice(1):f==="deviceId"?"sourceId":f};if(h.ideal!==void 0){c.optional=c.optional||[];let d={};typeof h.ideal=="number"?(d[u("min",l)]=h.ideal,c.optional.push(d),d={},d[u("max",l)]=h.ideal,c.optional.push(d)):(d[u("",l)]=h.ideal,c.optional.push(d))}h.exact!==void 0&&typeof h.exact!="number"?(c.mandatory=c.mandatory||{},c.mandatory[u("",l)]=h.exact):["min","max"].forEach(d=>{h[d]!==void 0&&(c.mandatory=c.mandatory||{},c.mandatory[u(d,l)]=h[d])})}),a.advanced&&(c.optional=(c.optional||[]).concat(a.advanced)),c},s=function(a,c){if(t.version>=61)return c(a);if(a=JSON.parse(JSON.stringify(a)),a&&typeof a.audio=="object"){const l=function(h,u,d){u in h&&!(d in h)&&(h[d]=h[u],delete h[u])};a=JSON.parse(JSON.stringify(a)),l(a.audio,"autoGainControl","googAutoGainControl"),l(a.audio,"noiseSuppression","googNoiseSuppression"),a.audio=n(a.audio)}if(a&&typeof a.video=="object"){let l=a.video.facingMode;l=l&&(typeof l=="object"?l:{ideal:l});const h=t.version<66;if(l&&(l.exact==="user"||l.exact==="environment"||l.ideal==="user"||l.ideal==="environment")&&!(e.mediaDevices.getSupportedConstraints&&e.mediaDevices.getSupportedConstraints().facingMode&&!h)){delete a.video.facingMode;let u;if(l.exact==="environment"||l.ideal==="environment"?u=["back","rear"]:(l.exact==="user"||l.ideal==="user")&&(u=["front"]),u)return e.mediaDevices.enumerateDevices().then(d=>{d=d.filter(g=>g.kind==="videoinput");let f=d.find(g=>u.some(_=>g.label.toLowerCase().includes(_)));return!f&&d.length&&u.includes("back")&&(f=d[d.length-1]),f&&(a.video.deviceId=l.exact?{exact:f.deviceId}:{ideal:f.deviceId}),a.video=n(a.video),Td("chrome: "+JSON.stringify(a)),c(a)})}a.video=n(a.video)}return Td("chrome: "+JSON.stringify(a)),c(a)},r=function(a){return t.version>=64?a:{name:{PermissionDeniedError:"NotAllowedError",PermissionDismissedError:"NotAllowedError",InvalidStateError:"NotAllowedError",DevicesNotFoundError:"NotFoundError",ConstraintNotSatisfiedError:"OverconstrainedError",TrackStartError:"NotReadableError",MediaDeviceFailedDueToShutdown:"NotAllowedError",MediaDeviceKillSwitchOn:"NotAllowedError",TabCaptureError:"AbortError",ScreenCaptureError:"AbortError",DeviceCaptureError:"AbortError"}[a.name]||a.name,message:a.message,constraint:a.constraint||a.constraintName,toString(){return this.name+(this.message&&": ")+this.message}}},o=function(a,c,l){s(a,h=>{e.webkitGetUserMedia(h,c,u=>{l&&l(r(u))})})};if(e.getUserMedia=o.bind(e),e.mediaDevices.getUserMedia){const a=e.mediaDevices.getUserMedia.bind(e.mediaDevices);e.mediaDevices.getUserMedia=function(c){return s(c,l=>a(l).then(h=>{if(l.audio&&!h.getAudioTracks().length||l.video&&!h.getVideoTracks().length)throw h.getTracks().forEach(u=>{u.stop()}),new DOMException("","NotFoundError");return h},h=>Promise.reject(r(h))))}}}function up(i){i.MediaStream=i.MediaStream||i.webkitMediaStream}function dp(i,t){if(!(t.version>102))if(typeof i=="object"&&i.RTCPeerConnection&&!("ontrack"in i.RTCPeerConnection.prototype)){Object.defineProperty(i.RTCPeerConnection.prototype,"ontrack",{get(){return this._ontrack},set(n){this._ontrack&&this.removeEventListener("track",this._ontrack),this.addEventListener("track",this._ontrack=n)},enumerable:!0,configurable:!0});const e=i.RTCPeerConnection.prototype.setRemoteDescription;i.RTCPeerConnection.prototype.setRemoteDescription=function(){return this._ontrackpoly||(this._ontrackpoly=s=>{s.stream.addEventListener("addtrack",r=>{let o;i.RTCPeerConnection.prototype.getReceivers?o=this.getReceivers().find(c=>c.track&&c.track.id===r.track.id):o={track:r.track};const a=new Event("track");a.track=r.track,a.receiver=o,a.transceiver={receiver:o},a.streams=[s.stream],this.dispatchEvent(a)}),s.stream.getTracks().forEach(r=>{let o;i.RTCPeerConnection.prototype.getReceivers?o=this.getReceivers().find(c=>c.track&&c.track.id===r.id):o={track:r};const a=new Event("track");a.track=r,a.receiver=o,a.transceiver={receiver:o},a.streams=[s.stream],this.dispatchEvent(a)})},this.addEventListener("addstream",this._ontrackpoly)),e.apply(this,arguments)}}else qi(i,"track",e=>(e.transceiver||Object.defineProperty(e,"transceiver",{value:{receiver:e.receiver}}),e))}function fp(i){if(typeof i=="object"&&i.RTCPeerConnection&&!("getSenders"in i.RTCPeerConnection.prototype)&&"createDTMFSender"in i.RTCPeerConnection.prototype){const t=function(s,r){return{track:r,get dtmf(){return this._dtmf===void 0&&(r.kind==="audio"?this._dtmf=s.createDTMFSender(r):this._dtmf=null),this._dtmf},_pc:s}};if(!i.RTCPeerConnection.prototype.getSenders){i.RTCPeerConnection.prototype.getSenders=function(){return this._senders=this._senders||[],this._senders.slice()};const s=i.RTCPeerConnection.prototype.addTrack;i.RTCPeerConnection.prototype.addTrack=function(a,c){let l=s.apply(this,arguments);return l||(l=t(this,a),this._senders.push(l)),l};const r=i.RTCPeerConnection.prototype.removeTrack;i.RTCPeerConnection.prototype.removeTrack=function(a){r.apply(this,arguments);const c=this._senders.indexOf(a);c!==-1&&this._senders.splice(c,1)}}const e=i.RTCPeerConnection.prototype.addStream;i.RTCPeerConnection.prototype.addStream=function(r){this._senders=this._senders||[],e.apply(this,[r]),r.getTracks().forEach(o=>{this._senders.push(t(this,o))})};const n=i.RTCPeerConnection.prototype.removeStream;i.RTCPeerConnection.prototype.removeStream=function(r){this._senders=this._senders||[],n.apply(this,[r]),r.getTracks().forEach(o=>{const a=this._senders.find(c=>c.track===o);a&&this._senders.splice(this._senders.indexOf(a),1)})}}else if(typeof i=="object"&&i.RTCPeerConnection&&"getSenders"in i.RTCPeerConnection.prototype&&"createDTMFSender"in i.RTCPeerConnection.prototype&&i.RTCRtpSender&&!("dtmf"in i.RTCRtpSender.prototype)){const t=i.RTCPeerConnection.prototype.getSenders;i.RTCPeerConnection.prototype.getSenders=function(){const n=t.apply(this,[]);return n.forEach(s=>s._pc=this),n},Object.defineProperty(i.RTCRtpSender.prototype,"dtmf",{get(){return this._dtmf===void 0&&(this.track.kind==="audio"?this._dtmf=this._pc.createDTMFSender(this.track):this._dtmf=null),this._dtmf}})}}function pp(i,t){if(t.version>=67||!(typeof i=="object"&&i.RTCPeerConnection&&i.RTCRtpSender&&i.RTCRtpReceiver))return;if(!("getStats"in i.RTCRtpSender.prototype)){const n=i.RTCPeerConnection.prototype.getSenders;n&&(i.RTCPeerConnection.prototype.getSenders=function(){const o=n.apply(this,[]);return o.forEach(a=>a._pc=this),o});const s=i.RTCPeerConnection.prototype.addTrack;s&&(i.RTCPeerConnection.prototype.addTrack=function(){const o=s.apply(this,arguments);return o._pc=this,o}),i.RTCRtpSender.prototype.getStats=function(){const o=this;return this._pc.getStats().then(a=>Ed(a,o.track,!0))}}if(!("getStats"in i.RTCRtpReceiver.prototype)){const n=i.RTCPeerConnection.prototype.getReceivers;n&&(i.RTCPeerConnection.prototype.getReceivers=function(){const r=n.apply(this,[]);return r.forEach(o=>o._pc=this),r}),qi(i,"track",s=>(s.receiver._pc=s.srcElement,s)),i.RTCRtpReceiver.prototype.getStats=function(){const r=this;return this._pc.getStats().then(o=>Ed(o,r.track,!1))}}if(!("getStats"in i.RTCRtpSender.prototype&&"getStats"in i.RTCRtpReceiver.prototype))return;const e=i.RTCPeerConnection.prototype.getStats;i.RTCPeerConnection.prototype.getStats=function(){if(arguments.length>0&&arguments[0]instanceof i.MediaStreamTrack){const s=arguments[0];let r,o,a;return this.getSenders().forEach(c=>{c.track===s&&(r?a=!0:r=c)}),this.getReceivers().forEach(c=>(c.track===s&&(o?a=!0:o=c),c.track===s)),a||r&&o?Promise.reject(new DOMException("There are more than one sender or receiver for the track.","InvalidAccessError")):r?r.getStats():o?o.getStats():Promise.reject(new DOMException("There is no sender or receiver for the track.","InvalidAccessError"))}return e.apply(this,arguments)}}function mp(i){i.RTCPeerConnection.prototype.getLocalStreams=function(){return this._shimmedLocalStreams=this._shimmedLocalStreams||{},Object.keys(this._shimmedLocalStreams).map(o=>this._shimmedLocalStreams[o][0])};const t=i.RTCPeerConnection.prototype.addTrack;i.RTCPeerConnection.prototype.addTrack=function(o,a){if(!a)return t.apply(this,arguments);this._shimmedLocalStreams=this._shimmedLocalStreams||{};const c=t.apply(this,arguments);return this._shimmedLocalStreams[a.id]?this._shimmedLocalStreams[a.id].indexOf(c)===-1&&this._shimmedLocalStreams[a.id].push(c):this._shimmedLocalStreams[a.id]=[a,c],c};const e=i.RTCPeerConnection.prototype.addStream;i.RTCPeerConnection.prototype.addStream=function(o){this._shimmedLocalStreams=this._shimmedLocalStreams||{},o.getTracks().forEach(l=>{if(this.getSenders().find(u=>u.track===l))throw new DOMException("Track already exists.","InvalidAccessError")});const a=this.getSenders();e.apply(this,arguments);const c=this.getSenders().filter(l=>a.indexOf(l)===-1);this._shimmedLocalStreams[o.id]=[o].concat(c)};const n=i.RTCPeerConnection.prototype.removeStream;i.RTCPeerConnection.prototype.removeStream=function(o){return this._shimmedLocalStreams=this._shimmedLocalStreams||{},delete this._shimmedLocalStreams[o.id],n.apply(this,arguments)};const s=i.RTCPeerConnection.prototype.removeTrack;i.RTCPeerConnection.prototype.removeTrack=function(o){return this._shimmedLocalStreams=this._shimmedLocalStreams||{},o&&Object.keys(this._shimmedLocalStreams).forEach(a=>{const c=this._shimmedLocalStreams[a].indexOf(o);c!==-1&&this._shimmedLocalStreams[a].splice(c,1),this._shimmedLocalStreams[a].length===1&&delete this._shimmedLocalStreams[a]}),s.apply(this,arguments)}}function gp(i,t){if(!i.RTCPeerConnection)return;if(i.RTCPeerConnection.prototype.addTrack&&t.version>=65)return mp(i);const e=i.RTCPeerConnection.prototype.getLocalStreams;i.RTCPeerConnection.prototype.getLocalStreams=function(){const h=e.apply(this);return this._reverseStreams=this._reverseStreams||{},h.map(u=>this._reverseStreams[u.id])};const n=i.RTCPeerConnection.prototype.addStream;i.RTCPeerConnection.prototype.addStream=function(h){if(this._streams=this._streams||{},this._reverseStreams=this._reverseStreams||{},h.getTracks().forEach(u=>{if(this.getSenders().find(f=>f.track===u))throw new DOMException("Track already exists.","InvalidAccessError")}),!this._reverseStreams[h.id]){const u=new i.MediaStream(h.getTracks());this._streams[h.id]=u,this._reverseStreams[u.id]=h,h=u}n.apply(this,[h])};const s=i.RTCPeerConnection.prototype.removeStream;i.RTCPeerConnection.prototype.removeStream=function(h){this._streams=this._streams||{},this._reverseStreams=this._reverseStreams||{},s.apply(this,[this._streams[h.id]||h]),delete this._reverseStreams[this._streams[h.id]?this._streams[h.id].id:h.id],delete this._streams[h.id]},i.RTCPeerConnection.prototype.addTrack=function(h,u){if(this.signalingState==="closed")throw new DOMException("The RTCPeerConnection's signalingState is 'closed'.","InvalidStateError");const d=[].slice.call(arguments,1);if(d.length!==1||!d[0].getTracks().find(_=>_===h))throw new DOMException("The adapter.js addTrack polyfill only supports a single  stream which is associated with the specified track.","NotSupportedError");if(this.getSenders().find(_=>_.track===h))throw new DOMException("Track already exists.","InvalidAccessError");this._streams=this._streams||{},this._reverseStreams=this._reverseStreams||{};const g=this._streams[u.id];if(g)g.addTrack(h),Promise.resolve().then(()=>{this.dispatchEvent(new Event("negotiationneeded"))});else{const _=new i.MediaStream([h]);this._streams[u.id]=_,this._reverseStreams[_.id]=u,this.addStream(_)}return this.getSenders().find(_=>_.track===h)};function r(l,h){let u=h.sdp;return Object.keys(l._reverseStreams||[]).forEach(d=>{const f=l._reverseStreams[d],g=l._streams[f.id];u=u.replace(new RegExp(g.id,"g"),f.id)}),new RTCSessionDescription({type:h.type,sdp:u})}function o(l,h){let u=h.sdp;return Object.keys(l._reverseStreams||[]).forEach(d=>{const f=l._reverseStreams[d],g=l._streams[f.id];u=u.replace(new RegExp(f.id,"g"),g.id)}),new RTCSessionDescription({type:h.type,sdp:u})}["createOffer","createAnswer"].forEach(function(l){const h=i.RTCPeerConnection.prototype[l],u={[l](){const d=arguments;return arguments.length&&typeof arguments[0]=="function"?h.apply(this,[g=>{const _=r(this,g);d[0].apply(null,[_])},g=>{d[1]&&d[1].apply(null,g)},arguments[2]]):h.apply(this,arguments).then(g=>r(this,g))}};i.RTCPeerConnection.prototype[l]=u[l]});const a=i.RTCPeerConnection.prototype.setLocalDescription;i.RTCPeerConnection.prototype.setLocalDescription=function(){return!arguments.length||!arguments[0].type?a.apply(this,arguments):(arguments[0]=o(this,arguments[0]),a.apply(this,arguments))};const c=Object.getOwnPropertyDescriptor(i.RTCPeerConnection.prototype,"localDescription");Object.defineProperty(i.RTCPeerConnection.prototype,"localDescription",{get(){const l=c.get.apply(this);return l.type===""?l:r(this,l)}}),i.RTCPeerConnection.prototype.removeTrack=function(h){if(this.signalingState==="closed")throw new DOMException("The RTCPeerConnection's signalingState is 'closed'.","InvalidStateError");if(!h._pc)throw new DOMException("Argument 1 of RTCPeerConnection.removeTrack does not implement interface RTCRtpSender.","TypeError");if(!(h._pc===this))throw new DOMException("Sender was not created by this connection.","InvalidAccessError");this._streams=this._streams||{};let d;Object.keys(this._streams).forEach(f=>{this._streams[f].getTracks().find(_=>h.track===_)&&(d=this._streams[f])}),d&&(d.getTracks().length===1?this.removeStream(this._reverseStreams[d.id]):d.removeTrack(h.track),this.dispatchEvent(new Event("negotiationneeded")))}}function dl(i,t){!i.RTCPeerConnection&&i.webkitRTCPeerConnection&&(i.RTCPeerConnection=i.webkitRTCPeerConnection),i.RTCPeerConnection&&t.version<53&&["setLocalDescription","setRemoteDescription","addIceCandidate"].forEach(function(e){const n=i.RTCPeerConnection.prototype[e],s={[e](){return arguments[0]=new(e==="addIceCandidate"?i.RTCIceCandidate:i.RTCSessionDescription)(arguments[0]),n.apply(this,arguments)}};i.RTCPeerConnection.prototype[e]=s[e]})}function _p(i,t){t.version>102||qi(i,"negotiationneeded",e=>{const n=e.target;if(!((t.version<72||n.getConfiguration&&n.getConfiguration().sdpSemantics==="plan-b")&&n.signalingState!=="stable"))return e})}const Cd=Object.freeze(Object.defineProperty({__proto__:null,fixNegotiationNeeded:_p,shimAddTrackRemoveTrack:gp,shimAddTrackRemoveTrackWithNative:mp,shimGetSendersWithDtmf:fp,shimGetUserMedia:hp,shimMediaStream:up,shimOnTrack:dp,shimPeerConnection:dl,shimSenderReceiverGetStats:pp},Symbol.toStringTag,{value:"Module"}));function vp(i,t){const e=i&&i.navigator;if(!e.mediaDevices)return;const n=i&&i.MediaStreamTrack;if(e.getUserMedia=function(s,r,o){fh("navigator.getUserMedia","navigator.mediaDevices.getUserMedia"),e.mediaDevices.getUserMedia(s).then(r,o)},!(t.version>55&&"autoGainControl"in e.mediaDevices.getSupportedConstraints())){const s=function(o,a,c){a in o&&!(c in o)&&(o[c]=o[a],delete o[a])},r=e.mediaDevices.getUserMedia.bind(e.mediaDevices);if(e.mediaDevices.getUserMedia=function(o){return typeof o=="object"&&typeof o.audio=="object"&&(o=JSON.parse(JSON.stringify(o)),s(o.audio,"autoGainControl","mozAutoGainControl"),s(o.audio,"noiseSuppression","mozNoiseSuppression")),r(o)},n&&n.prototype.getSettings){const o=n.prototype.getSettings;n.prototype.getSettings=function(){const a=o.apply(this,arguments);return s(a,"mozAutoGainControl","autoGainControl"),s(a,"mozNoiseSuppression","noiseSuppression"),a}}if(n&&n.prototype.applyConstraints){const o=n.prototype.applyConstraints;n.prototype.applyConstraints=function(a){return this.kind==="audio"&&typeof a=="object"&&(a=JSON.parse(JSON.stringify(a)),s(a,"autoGainControl","mozAutoGainControl"),s(a,"noiseSuppression","mozNoiseSuppression")),o.apply(this,[a])}}}}function vb(i,t){i.navigator.mediaDevices&&(i.navigator.mediaDevices&&"getDisplayMedia"in i.navigator.mediaDevices||(i.navigator.mediaDevices.getDisplayMedia=function(n){if(!(n&&n.video)){const s=new DOMException("getDisplayMedia without video constraints is undefined");return s.name="NotFoundError",s.code=8,Promise.reject(s)}return n.video===!0?n.video={mediaSource:t}:n.video.mediaSource=t,i.navigator.mediaDevices.getUserMedia(n)}))}function xp(i){typeof i=="object"&&i.RTCTrackEvent&&"receiver"in i.RTCTrackEvent.prototype&&!("transceiver"in i.RTCTrackEvent.prototype)&&Object.defineProperty(i.RTCTrackEvent.prototype,"transceiver",{get(){return{receiver:this.receiver}}})}function fl(i,t){typeof i!="object"||!(i.RTCPeerConnection||i.mozRTCPeerConnection)||(!i.RTCPeerConnection&&i.mozRTCPeerConnection&&(i.RTCPeerConnection=i.mozRTCPeerConnection),t.version<53&&["setLocalDescription","setRemoteDescription","addIceCandidate"].forEach(function(e){const n=i.RTCPeerConnection.prototype[e],s={[e](){return arguments[0]=new(e==="addIceCandidate"?i.RTCIceCandidate:i.RTCSessionDescription)(arguments[0]),n.apply(this,arguments)}};i.RTCPeerConnection.prototype[e]=s[e]}))}function yp(i,t){if(typeof i!="object"||!(i.RTCPeerConnection||i.mozRTCPeerConnection)||t.version>=151)return;const e={inboundrtp:"inbound-rtp",outboundrtp:"outbound-rtp",candidatepair:"candidate-pair",localcandidate:"local-candidate",remotecandidate:"remote-candidate"},n=i.RTCPeerConnection.prototype.getStats;i.RTCPeerConnection.prototype.getStats=function(){const[r,o,a]=arguments;return this.signalingState==="closed"?Promise.resolve(new Map):n.apply(this,[r||null]).then(c=>{if(t.version<53&&!o)try{c.forEach(l=>{l.type=e[l.type]||l.type})}catch(l){if(l.name!=="TypeError")throw l;c.forEach((h,u)=>{c.set(u,Object.assign({},h,{type:e[h.type]||h.type}))})}return c}).then(o,a)}}function Sp(i){if(!(typeof i=="object"&&i.RTCPeerConnection&&i.RTCRtpSender)||i.RTCRtpSender&&"getStats"in i.RTCRtpSender.prototype)return;const t=i.RTCPeerConnection.prototype.getSenders;t&&(i.RTCPeerConnection.prototype.getSenders=function(){const s=t.apply(this,[]);return s.forEach(r=>r._pc=this),s});const e=i.RTCPeerConnection.prototype.addTrack;e&&(i.RTCPeerConnection.prototype.addTrack=function(){const s=e.apply(this,arguments);return s._pc=this,s}),i.RTCRtpSender.prototype.getStats=function(){return this.track?this._pc.getStats(this.track):Promise.resolve(new Map)}}function Mp(i){if(!(typeof i=="object"&&i.RTCPeerConnection&&i.RTCRtpSender)||i.RTCRtpSender&&"getStats"in i.RTCRtpReceiver.prototype)return;const t=i.RTCPeerConnection.prototype.getReceivers;t&&(i.RTCPeerConnection.prototype.getReceivers=function(){const n=t.apply(this,[]);return n.forEach(s=>s._pc=this),n}),qi(i,"track",e=>(e.receiver._pc=e.srcElement,e)),i.RTCRtpReceiver.prototype.getStats=function(){return this._pc.getStats(this.track)}}function bp(i){!i.RTCPeerConnection||"removeStream"in i.RTCPeerConnection.prototype||(i.RTCPeerConnection.prototype.removeStream=function(e){fh("removeStream","removeTrack"),this.getSenders().forEach(n=>{n.track&&e.getTracks().includes(n.track)&&this.removeTrack(n)})})}function Ep(i){i.DataChannel&&!i.RTCDataChannel&&(i.RTCDataChannel=i.DataChannel)}function Tp(i,t){if(!(typeof i=="object"&&i.RTCPeerConnection)||t.version>=110)return;const e=i.RTCPeerConnection.prototype.addTransceiver;e&&(i.RTCPeerConnection.prototype.addTransceiver=function(){this.setParametersPromises=[];let s=arguments[1]&&arguments[1].sendEncodings;s===void 0&&(s=[]),s=[...s];const r=s.length>0;r&&s.forEach(a=>{if("rid"in a&&!/^[a-z0-9]{0,16}$/i.test(a.rid))throw new TypeError("Invalid RID value provided.");if("scaleResolutionDownBy"in a&&!(parseFloat(a.scaleResolutionDownBy)>=1))throw new RangeError("scale_resolution_down_by must be >= 1.0");if("maxFramerate"in a&&!(parseFloat(a.maxFramerate)>=0))throw new RangeError("max_framerate must be >= 0.0")});const o=e.apply(this,arguments);if(r){const{sender:a}=o,c=a.getParameters();(!("encodings"in c)||c.encodings.length===1&&Object.keys(c.encodings[0]).length===0)&&(c.encodings=s,a.sendEncodings=s,this.setParametersPromises.push(a.setParameters(c).then(()=>{delete a.sendEncodings}).catch(()=>{delete a.sendEncodings})))}return o})}function Cp(i,t){if(!(typeof i=="object"&&i.RTCRtpSender)||t.version>=110)return;const e=i.RTCRtpSender.prototype.getParameters;e&&(i.RTCRtpSender.prototype.getParameters=function(){const s=e.apply(this,arguments);return"encodings"in s||(s.encodings=[].concat(this.sendEncodings||[{}])),s})}function Ap(i,t){if(!(typeof i=="object"&&i.RTCPeerConnection)||t.version>=110)return;const e=i.RTCPeerConnection.prototype.createOffer;i.RTCPeerConnection.prototype.createOffer=function(){return this.setParametersPromises&&this.setParametersPromises.length?Promise.all(this.setParametersPromises).then(()=>e.apply(this,arguments)).finally(()=>{this.setParametersPromises=[]}):e.apply(this,arguments)}}function wp(i,t){if(!(typeof i=="object"&&i.RTCPeerConnection)||t.version>=110)return;const e=i.RTCPeerConnection.prototype.createAnswer;i.RTCPeerConnection.prototype.createAnswer=function(){return this.setParametersPromises&&this.setParametersPromises.length?Promise.all(this.setParametersPromises).then(()=>e.apply(this,arguments)).finally(()=>{this.setParametersPromises=[]}):e.apply(this,arguments)}}const Ad=Object.freeze(Object.defineProperty({__proto__:null,shimAddTransceiver:Tp,shimCreateAnswer:wp,shimCreateOffer:Ap,shimGetDisplayMedia:vb,shimGetParameters:Cp,shimGetStats:yp,shimGetUserMedia:vp,shimOnTrack:xp,shimPeerConnection:fl,shimRTCDataChannel:Ep,shimReceiverGetStats:Mp,shimRemoveStream:bp,shimSenderGetStats:Sp},Symbol.toStringTag,{value:"Module"}));function Rp(i){if(!(typeof i!="object"||!i.RTCPeerConnection)){if("getLocalStreams"in i.RTCPeerConnection.prototype||(i.RTCPeerConnection.prototype.getLocalStreams=function(){return this._localStreams||(this._localStreams=[]),this._localStreams}),!("addStream"in i.RTCPeerConnection.prototype)){const t=i.RTCPeerConnection.prototype.addTrack;i.RTCPeerConnection.prototype.addStream=function(n){this._localStreams||(this._localStreams=[]),this._localStreams.includes(n)||this._localStreams.push(n),n.getAudioTracks().forEach(s=>t.call(this,s,n)),n.getVideoTracks().forEach(s=>t.call(this,s,n))},i.RTCPeerConnection.prototype.addTrack=function(n,...s){return s&&s.forEach(r=>{this._localStreams?this._localStreams.includes(r)||this._localStreams.push(r):this._localStreams=[r]}),t.apply(this,arguments)}}"removeStream"in i.RTCPeerConnection.prototype||(i.RTCPeerConnection.prototype.removeStream=function(e){this._localStreams||(this._localStreams=[]);const n=this._localStreams.indexOf(e);if(n===-1)return;this._localStreams.splice(n,1);const s=e.getTracks();this.getSenders().forEach(r=>{s.includes(r.track)&&this.removeTrack(r)})})}}function Pp(i){if(!(typeof i!="object"||!i.RTCPeerConnection)&&("getRemoteStreams"in i.RTCPeerConnection.prototype||(i.RTCPeerConnection.prototype.getRemoteStreams=function(){return this._remoteStreams?this._remoteStreams:[]}),!("onaddstream"in i.RTCPeerConnection.prototype))){Object.defineProperty(i.RTCPeerConnection.prototype,"onaddstream",{get(){return this._onaddstream},set(e){this._onaddstream&&(this.removeEventListener("addstream",this._onaddstream),this.removeEventListener("track",this._onaddstreampoly)),this.addEventListener("addstream",this._onaddstream=e),this.addEventListener("track",this._onaddstreampoly=n=>{n.streams.forEach(s=>{if(this._remoteStreams||(this._remoteStreams=[]),this._remoteStreams.includes(s))return;this._remoteStreams.push(s);const r=new Event("addstream");r.stream=s,this.dispatchEvent(r)})})}});const t=i.RTCPeerConnection.prototype.setRemoteDescription;i.RTCPeerConnection.prototype.setRemoteDescription=function(){const n=this;return this._onaddstreampoly||this.addEventListener("track",this._onaddstreampoly=function(s){s.streams.forEach(r=>{if(n._remoteStreams||(n._remoteStreams=[]),n._remoteStreams.indexOf(r)>=0)return;n._remoteStreams.push(r);const o=new Event("addstream");o.stream=r,n.dispatchEvent(o)})}),t.apply(n,arguments)}}}function Lp(i){if(typeof i!="object"||!i.RTCPeerConnection)return;const t=i.RTCPeerConnection.prototype,e=t.createOffer,n=t.createAnswer,s=t.setLocalDescription,r=t.setRemoteDescription,o=t.addIceCandidate;t.createOffer=function(l,h){const u=arguments.length>=2?arguments[2]:arguments[0],d=e.apply(this,[u]);return h?(d.then(l,h),Promise.resolve()):d},t.createAnswer=function(l,h){const u=arguments.length>=2?arguments[2]:arguments[0],d=n.apply(this,[u]);return h?(d.then(l,h),Promise.resolve()):d};let a=function(c,l,h){const u=s.apply(this,[c]);return h?(u.then(l,h),Promise.resolve()):u};t.setLocalDescription=a,a=function(c,l,h){const u=r.apply(this,[c]);return h?(u.then(l,h),Promise.resolve()):u},t.setRemoteDescription=a,a=function(c,l,h){const u=o.apply(this,[c]);return h?(u.then(l,h),Promise.resolve()):u},t.addIceCandidate=a}function Ip(i){const t=i&&i.navigator;if(t.mediaDevices&&t.mediaDevices.getUserMedia){const e=t.mediaDevices,n=e.getUserMedia.bind(e);t.mediaDevices.getUserMedia=s=>n(Dp(s))}!t.getUserMedia&&t.mediaDevices&&t.mediaDevices.getUserMedia&&(t.getUserMedia=(function(n,s,r){t.mediaDevices.getUserMedia(n).then(s,r)}).bind(t))}function Dp(i){return i&&i.video!==void 0?Object.assign({},i,{video:lp(i.video)}):i}function Up(i){if(!i.RTCPeerConnection)return;const t=i.RTCPeerConnection;i.RTCPeerConnection=function(n,s){if(n&&n.iceServers){const r=[];for(let o=0;o<n.iceServers.length;o++){let a=n.iceServers[o];a.urls===void 0&&a.url?(fh("RTCIceServer.url","RTCIceServer.urls"),a=JSON.parse(JSON.stringify(a)),a.urls=a.url,delete a.url,r.push(a)):r.push(n.iceServers[o])}n.iceServers=r}return new t(n,s)},i.RTCPeerConnection.prototype=t.prototype,"generateCertificate"in t&&Object.defineProperty(i.RTCPeerConnection,"generateCertificate",{get(){return t.generateCertificate}})}function Np(i){typeof i=="object"&&i.RTCTrackEvent&&"receiver"in i.RTCTrackEvent.prototype&&!("transceiver"in i.RTCTrackEvent.prototype)&&Object.defineProperty(i.RTCTrackEvent.prototype,"transceiver",{get(){return{receiver:this.receiver}}})}function Op(i){const t=i.RTCPeerConnection.prototype.createOffer;i.RTCPeerConnection.prototype.createOffer=function(n){if(n){typeof n.offerToReceiveAudio<"u"&&(n.offerToReceiveAudio=!!n.offerToReceiveAudio);const s=this.getTransceivers().find(o=>o.receiver.track.kind==="audio");n.offerToReceiveAudio===!1&&s?s.direction==="sendrecv"?s.setDirection?s.setDirection("sendonly"):s.direction="sendonly":s.direction==="recvonly"&&(s.setDirection?s.setDirection("inactive"):s.direction="inactive"):n.offerToReceiveAudio===!0&&!s&&this.addTransceiver("audio",{direction:"recvonly"}),typeof n.offerToReceiveVideo<"u"&&(n.offerToReceiveVideo=!!n.offerToReceiveVideo);const r=this.getTransceivers().find(o=>o.receiver.track.kind==="video");n.offerToReceiveVideo===!1&&r?r.direction==="sendrecv"?r.setDirection?r.setDirection("sendonly"):r.direction="sendonly":r.direction==="recvonly"&&(r.setDirection?r.setDirection("inactive"):r.direction="inactive"):n.offerToReceiveVideo===!0&&!r&&this.addTransceiver("video",{direction:"recvonly"})}return t.apply(this,arguments)}}function kp(i){typeof i!="object"||i.AudioContext||(i.AudioContext=i.webkitAudioContext)}const wd=Object.freeze(Object.defineProperty({__proto__:null,shimAudioContext:kp,shimCallbacksAPI:Lp,shimConstraints:Dp,shimCreateOfferLegacy:Op,shimGetUserMedia:Ip,shimLocalStreamsAPI:Rp,shimRTCIceServerUrls:Up,shimRemoteStreamsAPI:Pp,shimTrackEventTransceiver:Np},Symbol.toStringTag,{value:"Module"}));function xb(i){return i&&i.__esModule&&Object.prototype.hasOwnProperty.call(i,"default")?i.default:i}var sc={exports:{}},Rd;function yb(){return Rd||(Rd=1,(function(i){const t={};t.generateIdentifier=function(){return Math.random().toString(36).substring(2,12)},t.localCName=t.generateIdentifier(),t.splitLines=function(e){return e.trim().split(`
`).map(n=>n.trim())},t.splitSections=function(e){return e.split(`
m=`).map((s,r)=>(r>0?"m="+s:s).trim()+`\r
`)},t.getDescription=function(e){const n=t.splitSections(e);return n&&n[0]},t.getMediaSections=function(e){const n=t.splitSections(e);return n.shift(),n},t.matchPrefix=function(e,n){return t.splitLines(e).filter(s=>s.indexOf(n)===0)},t.parseCandidate=function(e){let n;e.indexOf("a=candidate:")===0?n=e.substring(12).split(" "):n=e.substring(10).split(" ");const s={foundation:n[0],component:{1:"rtp",2:"rtcp"}[n[1]]||n[1],protocol:n[2].toLowerCase(),priority:parseInt(n[3],10),ip:n[4],address:n[4],port:parseInt(n[5],10),type:n[7]};for(let r=8;r<n.length;r+=2)switch(n[r]){case"raddr":s.relatedAddress=n[r+1];break;case"rport":s.relatedPort=parseInt(n[r+1],10);break;case"tcptype":s.tcpType=n[r+1];break;case"ufrag":s.ufrag=n[r+1],s.usernameFragment=n[r+1];break;default:s[n[r]]===void 0&&(s[n[r]]=n[r+1]);break}return s},t.writeCandidate=function(e){const n=[];n.push(e.foundation);const s=e.component;s==="rtp"?n.push(1):s==="rtcp"?n.push(2):n.push(s),n.push(e.protocol.toUpperCase()),n.push(e.priority),n.push(e.address||e.ip),n.push(e.port);const r=e.type;return n.push("typ"),n.push(r),r!=="host"&&e.relatedAddress&&e.relatedPort!==void 0&&(n.push("raddr"),n.push(e.relatedAddress),n.push("rport"),n.push(e.relatedPort)),e.tcpType&&e.protocol.toLowerCase()==="tcp"&&(n.push("tcptype"),n.push(e.tcpType)),(e.usernameFragment||e.ufrag)&&(n.push("ufrag"),n.push(e.usernameFragment||e.ufrag)),"candidate:"+n.join(" ")},t.parseIceOptions=function(e){return e.substring(14).split(" ")},t.parseRtpMap=function(e){let n=e.substring(9).split(" ");const s={payloadType:parseInt(n.shift(),10)};return n=n[0].split("/"),s.name=n[0],s.clockRate=parseInt(n[1],10),s.channels=n.length===3?parseInt(n[2],10):1,s.numChannels=s.channels,s},t.writeRtpMap=function(e){let n=e.payloadType;e.preferredPayloadType!==void 0&&(n=e.preferredPayloadType);const s=e.channels||e.numChannels||1;return"a=rtpmap:"+n+" "+e.name+"/"+e.clockRate+(s!==1?"/"+s:"")+`\r
`},t.parseExtmap=function(e){const n=e.substring(9).split(" ");return{id:parseInt(n[0],10),direction:n[0].indexOf("/")>0?n[0].split("/")[1]:"sendrecv",uri:n[1],attributes:n.slice(2).join(" ")}},t.writeExtmap=function(e){return"a=extmap:"+(e.id||e.preferredId)+(e.direction&&e.direction!=="sendrecv"?"/"+e.direction:"")+" "+e.uri+(e.attributes?" "+e.attributes:"")+`\r
`},t.parseFmtp=function(e){const n={};let s;const r=e.substring(e.indexOf(" ")+1).split(";");for(let o=0;o<r.length;o++)s=r[o].trim().split("="),n[s[0].trim()]=s[1];return n},t.writeFmtp=function(e){let n="",s=e.payloadType;if(e.preferredPayloadType!==void 0&&(s=e.preferredPayloadType),e.parameters&&Object.keys(e.parameters).length){const r=[];Object.keys(e.parameters).forEach(o=>{e.parameters[o]!==void 0?r.push(o+"="+e.parameters[o]):r.push(o)}),n+="a=fmtp:"+s+" "+r.join(";")+`\r
`}return n},t.parseRtcpFb=function(e){const n=e.substring(e.indexOf(" ")+1).split(" ");return{type:n.shift(),parameter:n.join(" ")}},t.writeRtcpFb=function(e){let n="",s=e.payloadType;return e.preferredPayloadType!==void 0&&(s=e.preferredPayloadType),e.rtcpFeedback&&e.rtcpFeedback.length&&e.rtcpFeedback.forEach(r=>{n+="a=rtcp-fb:"+s+" "+r.type+(r.parameter&&r.parameter.length?" "+r.parameter:"")+`\r
`}),n},t.parseSsrcMedia=function(e){const n=e.indexOf(" "),s={ssrc:parseInt(e.substring(7,n),10)},r=e.indexOf(":",n);return r>-1?(s.attribute=e.substring(n+1,r),s.value=e.substring(r+1)):s.attribute=e.substring(n+1),s},t.parseSsrcGroup=function(e){const n=e.substring(13).split(" ");return{semantics:n.shift(),ssrcs:n.map(s=>parseInt(s,10))}},t.getMid=function(e){const n=t.matchPrefix(e,"a=mid:")[0];if(n)return n.substring(6)},t.parseFingerprint=function(e){const n=e.substring(14).split(" ");return{algorithm:n[0].toLowerCase(),value:n[1].toUpperCase()}},t.getDtlsParameters=function(e,n){return{role:"auto",fingerprints:t.matchPrefix(e+n,"a=fingerprint:").map(t.parseFingerprint)}},t.writeDtlsParameters=function(e,n){let s="a=setup:"+n+`\r
`;return e.fingerprints.forEach(r=>{s+="a=fingerprint:"+r.algorithm+" "+r.value+`\r
`}),s},t.parseCryptoLine=function(e){const n=e.substring(9).split(" ");return{tag:parseInt(n[0],10),cryptoSuite:n[1],keyParams:n[2],sessionParams:n.slice(3)}},t.writeCryptoLine=function(e){return"a=crypto:"+e.tag+" "+e.cryptoSuite+" "+(typeof e.keyParams=="object"?t.writeCryptoKeyParams(e.keyParams):e.keyParams)+(e.sessionParams?" "+e.sessionParams.join(" "):"")+`\r
`},t.parseCryptoKeyParams=function(e){if(e.indexOf("inline:")!==0)return null;const n=e.substring(7).split("|");return{keyMethod:"inline",keySalt:n[0],lifeTime:n[1],mkiValue:n[2]?n[2].split(":")[0]:void 0,mkiLength:n[2]?n[2].split(":")[1]:void 0}},t.writeCryptoKeyParams=function(e){return e.keyMethod+":"+e.keySalt+(e.lifeTime?"|"+e.lifeTime:"")+(e.mkiValue&&e.mkiLength?"|"+e.mkiValue+":"+e.mkiLength:"")},t.getCryptoParameters=function(e,n){return t.matchPrefix(e+n,"a=crypto:").map(t.parseCryptoLine)},t.getIceParameters=function(e,n){const s=t.matchPrefix(e+n,"a=ice-ufrag:")[0],r=t.matchPrefix(e+n,"a=ice-pwd:")[0];return s&&r?{usernameFragment:s.substring(12),password:r.substring(10)}:null},t.writeIceParameters=function(e){let n="a=ice-ufrag:"+e.usernameFragment+`\r
a=ice-pwd:`+e.password+`\r
`;return e.iceLite&&(n+=`a=ice-lite\r
`),n},t.parseRtpParameters=function(e){const n={codecs:[],headerExtensions:[],fecMechanisms:[],rtcp:[]},r=t.splitLines(e)[0].split(" ");n.profile=r[2];for(let a=3;a<r.length;a++){const c=r[a],l=t.matchPrefix(e,"a=rtpmap:"+c+" ")[0];if(l){const h=t.parseRtpMap(l),u=t.matchPrefix(e,"a=fmtp:"+c+" ");switch(h.parameters=u.length?t.parseFmtp(u[0]):{},h.rtcpFeedback=t.matchPrefix(e,"a=rtcp-fb:"+c+" ").map(t.parseRtcpFb),n.codecs.push(h),h.name.toUpperCase()){case"RED":case"ULPFEC":n.fecMechanisms.push(h.name.toUpperCase());break}}}t.matchPrefix(e,"a=extmap:").forEach(a=>{n.headerExtensions.push(t.parseExtmap(a))});const o=t.matchPrefix(e,"a=rtcp-fb:* ").map(t.parseRtcpFb);return n.codecs.forEach(a=>{o.forEach(c=>{a.rtcpFeedback.find(h=>h.type===c.type&&h.parameter===c.parameter)||a.rtcpFeedback.push(c)})}),n},t.writeRtpDescription=function(e,n){let s="";s+="m="+e+" ",s+=n.codecs.length>0?"9":"0",s+=" "+(n.profile||"UDP/TLS/RTP/SAVPF")+" ",s+=n.codecs.map(o=>o.preferredPayloadType!==void 0?o.preferredPayloadType:o.payloadType).join(" ")+`\r
`,s+=`c=IN IP4 0.0.0.0\r
`,s+=`a=rtcp:9 IN IP4 0.0.0.0\r
`,n.codecs.forEach(o=>{s+=t.writeRtpMap(o),s+=t.writeFmtp(o),s+=t.writeRtcpFb(o)});let r=0;return n.codecs.forEach(o=>{o.maxptime>r&&(r=o.maxptime)}),r>0&&(s+="a=maxptime:"+r+`\r
`),n.headerExtensions&&n.headerExtensions.forEach(o=>{s+=t.writeExtmap(o)}),s},t.parseRtpEncodingParameters=function(e){const n=[],s=t.parseRtpParameters(e),r=s.fecMechanisms.indexOf("RED")!==-1,o=s.fecMechanisms.indexOf("ULPFEC")!==-1,a=t.matchPrefix(e,"a=ssrc:").map(d=>t.parseSsrcMedia(d)).filter(d=>d.attribute==="cname"),c=a.length>0&&a[0].ssrc;let l;const h=t.matchPrefix(e,"a=ssrc-group:FID").map(d=>d.substring(17).split(" ").map(g=>parseInt(g,10)));h.length>0&&h[0].length>1&&h[0][0]===c&&(l=h[0][1]),s.codecs.forEach(d=>{if(d.name.toUpperCase()==="RTX"&&d.parameters.apt){let f={ssrc:c,codecPayloadType:parseInt(d.parameters.apt,10)};c&&l&&(f.rtx={ssrc:l}),n.push(f),r&&(f=JSON.parse(JSON.stringify(f)),f.fec={ssrc:c,mechanism:o?"red+ulpfec":"red"},n.push(f))}}),n.length===0&&c&&n.push({ssrc:c});let u=t.matchPrefix(e,"b=");return u.length&&(u[0].indexOf("b=TIAS:")===0?u=parseInt(u[0].substring(7),10):u[0].indexOf("b=AS:")===0?u=parseInt(u[0].substring(5),10)*1e3*.95-2e3*8:u=void 0,n.forEach(d=>{d.maxBitrate=u})),n},t.parseRtcpParameters=function(e){const n={},s=t.matchPrefix(e,"a=ssrc:").map(a=>t.parseSsrcMedia(a)).filter(a=>a.attribute==="cname")[0];s&&(n.cname=s.value,n.ssrc=s.ssrc);const r=t.matchPrefix(e,"a=rtcp-rsize");n.reducedSize=r.length>0,n.compound=r.length===0;const o=t.matchPrefix(e,"a=rtcp-mux");return n.mux=o.length>0,n},t.writeRtcpParameters=function(e){let n="";return e.reducedSize&&(n+=`a=rtcp-rsize\r
`),e.mux&&(n+=`a=rtcp-mux\r
`),e.ssrc!==void 0&&e.cname&&(n+="a=ssrc:"+e.ssrc+" cname:"+e.cname+`\r
`),n},t.parseMsid=function(e){let n;const s=t.matchPrefix(e,"a=msid:");if(s.length===1)return n=s[0].substring(7).split(" "),{stream:n[0],track:n[1]};const r=t.matchPrefix(e,"a=ssrc:").map(o=>t.parseSsrcMedia(o)).filter(o=>o.attribute==="msid");if(r.length>0)return n=r[0].value.split(" "),{stream:n[0],track:n[1]}},t.parseSctpDescription=function(e){const n=t.parseMLine(e),s=t.matchPrefix(e,"a=max-message-size:");let r;s.length>0&&(r=parseInt(s[0].substring(19),10)),isNaN(r)&&(r=65536);const o=t.matchPrefix(e,"a=sctp-port:");if(o.length>0)return{port:parseInt(o[0].substring(12),10),protocol:n.fmt,maxMessageSize:r};const a=t.matchPrefix(e,"a=sctpmap:");if(a.length>0){const c=a[0].substring(10).split(" ");return{port:parseInt(c[0],10),protocol:c[1],maxMessageSize:r}}},t.writeSctpDescription=function(e,n){let s=[];return e.protocol!=="DTLS/SCTP"?s=["m="+e.kind+" 9 "+e.protocol+" "+n.protocol+`\r
`,`c=IN IP4 0.0.0.0\r
`,"a=sctp-port:"+n.port+`\r
`]:s=["m="+e.kind+" 9 "+e.protocol+" "+n.port+`\r
`,`c=IN IP4 0.0.0.0\r
`,"a=sctpmap:"+n.port+" "+n.protocol+` 65535\r
`],n.maxMessageSize!==void 0&&s.push("a=max-message-size:"+n.maxMessageSize+`\r
`),s.join("")},t.generateSessionId=function(){return Math.random().toString().substr(2,22)},t.writeSessionBoilerplate=function(e,n,s){let r;const o=n!==void 0?n:2;return e?r=e:r=t.generateSessionId(),`v=0\r
o=`+(s||"thisisadapterortc")+" "+r+" "+o+` IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
`},t.getDirection=function(e,n){const s=t.splitLines(e);for(let r=0;r<s.length;r++)switch(s[r]){case"a=sendrecv":case"a=sendonly":case"a=recvonly":case"a=inactive":return s[r].substring(2)}return n?t.getDirection(n):"sendrecv"},t.getKind=function(e){return t.splitLines(e)[0].split(" ")[0].substring(2)},t.isRejected=function(e){return e.split(" ",2)[1]==="0"},t.parseMLine=function(e){const s=t.splitLines(e)[0].substring(2).split(" ");return{kind:s[0],port:parseInt(s[1],10),protocol:s[2],fmt:s.slice(3).join(" ")}},t.parseOLine=function(e){const s=t.matchPrefix(e,"o=")[0].substring(2).split(" ");return{username:s[0],sessionId:s[1],sessionVersion:parseInt(s[2],10),netType:s[3],addressType:s[4],address:s[5]}},t.isValidSDP=function(e){if(typeof e!="string"||e.length===0)return!1;const n=t.splitLines(e);for(let s=0;s<n.length;s++)if(n[s].length<2||n[s].charAt(1)!=="=")return!1;return!0},i.exports=t})(sc)),sc.exports}var zp=yb();const Rs=xb(zp),Sb=Em({__proto__:null,default:Rs},[zp]);function To(i){if(!i.RTCIceCandidate||i.RTCIceCandidate&&"foundation"in i.RTCIceCandidate.prototype)return;const t=i.RTCIceCandidate;i.RTCIceCandidate=function(n){if(typeof n=="object"&&n.candidate&&n.candidate.indexOf("a=")===0&&(n=JSON.parse(JSON.stringify(n)),n.candidate=n.candidate.substring(2)),n.candidate&&n.candidate.length){const s=new t(n),r=Rs.parseCandidate(n.candidate);for(const o in r)o in s||Object.defineProperty(s,o,{value:r[o]});return s.toJSON=function(){return{candidate:s.candidate,sdpMid:s.sdpMid,sdpMLineIndex:s.sdpMLineIndex,usernameFragment:s.usernameFragment}},s}return new t(n)},i.RTCIceCandidate.prototype=t.prototype,qi(i,"icecandidate",e=>(e.candidate&&Object.defineProperty(e,"candidate",{value:new i.RTCIceCandidate(e.candidate),writable:"false"}),e))}function pl(i){!i.RTCIceCandidate||i.RTCIceCandidate&&"relayProtocol"in i.RTCIceCandidate.prototype||qi(i,"icecandidate",t=>{if(t.candidate){const e=Rs.parseCandidate(t.candidate.candidate);e.type==="relay"&&(t.candidate.relayProtocol={0:"tls",1:"tcp",2:"udp"}[e.priority>>24])}return t})}function Co(i,t){if(!i.RTCPeerConnection||t.browser==="chrome"&&t.version>102||t.browser==="firefox"&&t.version>=113)return;"sctp"in i.RTCPeerConnection.prototype||Object.defineProperty(i.RTCPeerConnection.prototype,"sctp",{get(){return typeof this._sctp>"u"?null:this._sctp}});const e=function(a){if(!a||!a.sdp)return!1;const c=Rs.splitSections(a.sdp);return c.shift(),c.some(l=>{const h=Rs.parseMLine(l);return h&&h.kind==="application"&&h.protocol.indexOf("SCTP")!==-1})},n=function(a){const c=a.sdp.match(/mozilla...THIS_IS_SDPARTA-(\d+)/);if(c===null||c.length<2)return-1;const l=parseInt(c[1],10);return l!==l?-1:l},s=function(a){let c=65536;return t.browser==="firefox"&&(t.version<57?a===-1?c=16384:c=2147483637:t.version<60?c=t.version===57?65535:65536:c=2147483637),c},r=function(a,c){let l=65536;t.browser==="firefox"&&t.version===57&&(l=65535);const h=Rs.matchPrefix(a.sdp,"a=max-message-size:");return h.length>0?l=parseInt(h[0].substring(19),10):t.browser==="firefox"&&c!==-1&&(l=2147483637),l},o=i.RTCPeerConnection.prototype.setRemoteDescription;i.RTCPeerConnection.prototype.setRemoteDescription=function(){if(this._sctp=null,t.browser==="chrome"&&t.version>=76){const{sdpSemantics:c}=this.getConfiguration();c==="plan-b"&&Object.defineProperty(this,"sctp",{get(){return typeof this._sctp>"u"?null:this._sctp},enumerable:!0,configurable:!0})}if(e(arguments[0])){const c=n(arguments[0]),l=s(c),h=r(arguments[0],c);let u;l===0&&h===0?u=Number.POSITIVE_INFINITY:l===0||h===0?u=Math.max(l,h):u=Math.min(l,h);const d={};Object.defineProperty(d,"maxMessageSize",{get(){return u}}),this._sctp=d}return o.apply(this,arguments)}}function Ao(i,t){if(!(i.RTCPeerConnection&&"createDataChannel"in i.RTCPeerConnection.prototype)||t.browser==="chrome"&&t.version>=149||t.browser==="firefox"&&t.version>60)return;function e(s,r){const o=s.send;s.send=function(){const c=arguments[0],l=c.length||c.size||c.byteLength;if(s.readyState==="open"&&r.sctp&&l>r.sctp.maxMessageSize)throw new TypeError("Message too large (can send a maximum of "+r.sctp.maxMessageSize+" bytes)");return o.apply(s,arguments)}}const n=i.RTCPeerConnection.prototype.createDataChannel;i.RTCPeerConnection.prototype.createDataChannel=function(){const r=n.apply(this,arguments);return e(r,this),r},qi(i,"datachannel",s=>(e(s.channel,s.target),s))}function ml(i){if(!i.RTCPeerConnection||"connectionState"in i.RTCPeerConnection.prototype)return;const t=i.RTCPeerConnection.prototype;Object.defineProperty(t,"connectionState",{get(){return{completed:"connected",checking:"connecting"}[this.iceConnectionState]||this.iceConnectionState},enumerable:!0,configurable:!0}),Object.defineProperty(t,"onconnectionstatechange",{get(){return this._onconnectionstatechange||null},set(e){this._onconnectionstatechange&&(this.removeEventListener("connectionstatechange",this._onconnectionstatechange),delete this._onconnectionstatechange),e&&this.addEventListener("connectionstatechange",this._onconnectionstatechange=e)},enumerable:!0,configurable:!0}),["setLocalDescription","setRemoteDescription"].forEach(e=>{const n=t[e];t[e]=function(){return this._connectionstatechangepoly||(this._connectionstatechangepoly=s=>{const r=s.target;if(r._lastConnectionState!==r.connectionState){r._lastConnectionState=r.connectionState;const o=new Event("connectionstatechange",s);r.dispatchEvent(o)}return s},this.addEventListener("iceconnectionstatechange",this._connectionstatechangepoly)),n.apply(this,arguments)}})}function gl(i,t){if(!i.RTCPeerConnection||t.browser==="chrome"&&t.version>=71||t.browser==="safari"&&t._safariVersion>=13.1)return;const e=i.RTCPeerConnection.prototype.setRemoteDescription;i.RTCPeerConnection.prototype.setRemoteDescription=function(s){if(s&&s.sdp&&s.sdp.indexOf(`
a=extmap-allow-mixed`)!==-1){const r=s.sdp.split(`
`).filter(o=>o.trim()!=="a=extmap-allow-mixed").join(`
`);i.RTCSessionDescription&&s instanceof i.RTCSessionDescription?arguments[0]=new i.RTCSessionDescription({type:s.type,sdp:r}):s.sdp=r}return e.apply(this,arguments)}}function wo(i,t){if(!(i.RTCPeerConnection&&i.RTCPeerConnection.prototype))return;const e=i.RTCPeerConnection.prototype.addIceCandidate;!e||e.length===0||(i.RTCPeerConnection.prototype.addIceCandidate=function(){return arguments[0]?(t.browser==="chrome"&&t.version<78||t.browser==="firefox"&&t.version<68||t.browser==="safari")&&arguments[0]&&arguments[0].candidate===""?Promise.resolve():e.apply(this,arguments):(arguments[1]&&arguments[1].apply(null),Promise.resolve())})}function Ro(i,t){if(!(i.RTCPeerConnection&&i.RTCPeerConnection.prototype))return;const e=i.RTCPeerConnection.prototype.setLocalDescription;!e||e.length===0||(i.RTCPeerConnection.prototype.setLocalDescription=function(){let s=arguments[0]||{};if(typeof s!="object"||s.type&&s.sdp)return e.apply(this,arguments);if(s={type:s.type,sdp:s.sdp},!s.type)switch(this.signalingState){case"stable":case"have-local-offer":case"have-remote-pranswer":s.type="offer";break;default:s.type="answer";break}return s.sdp||s.type!=="offer"&&s.type!=="answer"?e.apply(this,[s]):(s.type==="offer"?this.createOffer:this.createAnswer).apply(this).then(o=>e.apply(this,[o]))})}const Mb=Object.freeze(Object.defineProperty({__proto__:null,removeExtmapAllowMixed:gl,shimAddIceCandidateNullOrEmpty:wo,shimConnectionState:ml,shimMaxMessageSize:Co,shimParameterlessSetLocalDescription:Ro,shimRTCIceCandidate:To,shimRTCIceCandidateRelayProtocol:pl,shimSendThrowTypeError:Ao},Symbol.toStringTag,{value:"Module"}));function bb({window:i}={},t={shimChrome:!0,shimFirefox:!0,shimSafari:!0}){const e=dh,n=_b(i),s={browserDetails:n,commonShim:Mb,extractVersion:ar,disableLog:mb,disableWarnings:gb,sdp:Sb};switch(n.browser){case"chrome":if(!Cd||!dl||!t.shimChrome)return e("Chrome shim is not included in this adapter release."),s;if(n.version===null)return e("Chrome shim can not determine version, not shimming."),s;e("adapter.js shimming chrome."),s.browserShim=Cd,wo(i,n),Ro(i),hp(i,n),up(i),dl(i,n),dp(i,n),gp(i,n),fp(i),pp(i,n),_p(i,n),To(i),pl(i),ml(i),Co(i,n),Ao(i,n),gl(i,n);break;case"firefox":if(!Ad||!fl||!t.shimFirefox)return e("Firefox shim is not included in this adapter release."),s;e("adapter.js shimming firefox."),s.browserShim=Ad,wo(i,n),Ro(i),vp(i,n),fl(i,n),yp(i,n),xp(i),bp(i),Sp(i),Mp(i),Ep(i),Tp(i,n),Cp(i,n),Ap(i,n),wp(i,n),To(i),ml(i),Co(i,n),Ao(i,n);break;case"safari":if(!wd||!t.shimSafari)return e("Safari shim is not included in this adapter release."),s;e("adapter.js shimming safari."),s.browserShim=wd,wo(i,n),Ro(i),Up(i),Op(i),Lp(i),Rp(i),Pp(i),Np(i),Ip(i),kp(i),To(i),pl(i),Co(i,n),Ao(i,n),gl(i,n);break;default:e("Unsupported browser!");break}return s}const Pd=bb({window:typeof window>"u"?void 0:window});function ji(i,t,e,n){Object.defineProperty(i,t,{get:e,set:n,enumerable:!0,configurable:!0})}class Fp{constructor(){this.chunkedMTU=16300,this._dataCount=1,this.chunk=t=>{const e=[],n=t.byteLength,s=Math.ceil(n/this.chunkedMTU);let r=0,o=0;for(;o<n;){const a=Math.min(n,o+this.chunkedMTU),c=t.slice(o,a),l={__peerData:this._dataCount,n:r,data:c,total:s};e.push(l),o=a,r++}return this._dataCount++,e}}}function Eb(i){let t=0;for(const s of i)t+=s.byteLength;const e=new Uint8Array(t);let n=0;for(const s of i)e.set(s,n),n+=s.byteLength;return e}const rc=Pd.default||Pd,ir=new class{isWebRTCSupported(){return typeof RTCPeerConnection<"u"}isBrowserSupported(){const i=this.getBrowser(),t=this.getVersion();return this.supportedBrowsers.includes(i)?i==="chrome"?t>=this.minChromeVersion:i==="firefox"?t>=this.minFirefoxVersion:i==="safari"?!this.isIOS&&t>=this.minSafariVersion:!1:!1}getBrowser(){return rc.browserDetails.browser}getVersion(){return rc.browserDetails.version||0}isUnifiedPlanSupported(){const i=this.getBrowser(),t=rc.browserDetails.version||0;if(i==="chrome"&&t<this.minChromeVersion)return!1;if(i==="firefox"&&t>=this.minFirefoxVersion)return!0;if(!window.RTCRtpTransceiver||!("currentDirection"in RTCRtpTransceiver.prototype))return!1;let e,n=!1;try{e=new RTCPeerConnection,e.addTransceiver("audio"),n=!0}catch{}finally{e&&e.close()}return n}toString(){return`Supports:
    browser:${this.getBrowser()}
    version:${this.getVersion()}
    isIOS:${this.isIOS}
    isWebRTCSupported:${this.isWebRTCSupported()}
    isBrowserSupported:${this.isBrowserSupported()}
    isUnifiedPlanSupported:${this.isUnifiedPlanSupported()}`}constructor(){this.isIOS=typeof navigator<"u"?["iPad","iPhone","iPod"].includes(navigator.platform):!1,this.supportedBrowsers=["firefox","chrome","safari"],this.minFirefoxVersion=59,this.minChromeVersion=72,this.minSafariVersion=605}},Tb=i=>!i||/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(i),Bp=()=>Math.random().toString(36).slice(2),Ld={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:["turn:eu-0.turn.peerjs.com:3478","turn:us-0.turn.peerjs.com:3478"],username:"peerjs",credential:"peerjsp"}],sdpSemantics:"unified-plan"};class Cb extends Fp{noop(){}blobToArrayBuffer(t,e){const n=new FileReader;return n.onload=function(s){s.target&&e(s.target.result)},n.readAsArrayBuffer(t),n}binaryStringToArrayBuffer(t){const e=new Uint8Array(t.length);for(let n=0;n<t.length;n++)e[n]=t.charCodeAt(n)&255;return e.buffer}isSecure(){return location.protocol==="https:"}constructor(...t){super(...t),this.CLOUD_HOST="0.peerjs.com",this.CLOUD_PORT=443,this.chunkedBrowsers={Chrome:1,chrome:1},this.defaultConfig=Ld,this.browser=ir.getBrowser(),this.browserVersion=ir.getVersion(),this.pack=op,this.unpack=rp,this.supports=(function(){const e={browser:ir.isBrowserSupported(),webRTC:ir.isWebRTCSupported(),audioVideo:!1,data:!1,binaryBlob:!1,reliable:!1};if(!e.webRTC)return e;let n;try{n=new RTCPeerConnection(Ld),e.audioVideo=!0;let s;try{s=n.createDataChannel("_PEERJSTEST",{ordered:!0}),e.data=!0,e.reliable=!!s.ordered;try{s.binaryType="blob",e.binaryBlob=!ir.isIOS}catch{}}catch{}finally{s&&s.close()}}catch{}finally{n&&n.close()}return e})(),this.validateId=Tb,this.randomToken=Bp}}const Ye=new Cb,Ab="PeerJS: ";class wb{get logLevel(){return this._logLevel}set logLevel(t){this._logLevel=t}log(...t){this._logLevel>=3&&this._print(3,...t)}warn(...t){this._logLevel>=2&&this._print(2,...t)}error(...t){this._logLevel>=1&&this._print(1,...t)}setLogFunction(t){this._print=t}_print(t,...e){const n=[Ab,...e];for(const s in n)n[s]instanceof Error&&(n[s]="("+n[s].name+") "+n[s].message);t>=3?console.log(...n):t>=2?console.warn("WARNING",...n):t>=1&&console.error("ERROR",...n)}constructor(){this._logLevel=0}}var gt=new wb,ph={},Rb=Object.prototype.hasOwnProperty,Xe="~";function br(){}Object.create&&(br.prototype=Object.create(null),new br().__proto__||(Xe=!1));function Pb(i,t,e){this.fn=i,this.context=t,this.once=e||!1}function Hp(i,t,e,n,s){if(typeof e!="function")throw new TypeError("The listener must be a function");var r=new Pb(e,n||i,s),o=Xe?Xe+t:t;return i._events[o]?i._events[o].fn?i._events[o]=[i._events[o],r]:i._events[o].push(r):(i._events[o]=r,i._eventsCount++),i}function Po(i,t){--i._eventsCount===0?i._events=new br:delete i._events[t]}function Fe(){this._events=new br,this._eventsCount=0}Fe.prototype.eventNames=function(){var t=[],e,n;if(this._eventsCount===0)return t;for(n in e=this._events)Rb.call(e,n)&&t.push(Xe?n.slice(1):n);return Object.getOwnPropertySymbols?t.concat(Object.getOwnPropertySymbols(e)):t};Fe.prototype.listeners=function(t){var e=Xe?Xe+t:t,n=this._events[e];if(!n)return[];if(n.fn)return[n.fn];for(var s=0,r=n.length,o=new Array(r);s<r;s++)o[s]=n[s].fn;return o};Fe.prototype.listenerCount=function(t){var e=Xe?Xe+t:t,n=this._events[e];return n?n.fn?1:n.length:0};Fe.prototype.emit=function(t,e,n,s,r,o){var a=Xe?Xe+t:t;if(!this._events[a])return!1;var c=this._events[a],l=arguments.length,h,u;if(c.fn){switch(c.once&&this.removeListener(t,c.fn,void 0,!0),l){case 1:return c.fn.call(c.context),!0;case 2:return c.fn.call(c.context,e),!0;case 3:return c.fn.call(c.context,e,n),!0;case 4:return c.fn.call(c.context,e,n,s),!0;case 5:return c.fn.call(c.context,e,n,s,r),!0;case 6:return c.fn.call(c.context,e,n,s,r,o),!0}for(u=1,h=new Array(l-1);u<l;u++)h[u-1]=arguments[u];c.fn.apply(c.context,h)}else{var d=c.length,f;for(u=0;u<d;u++)switch(c[u].once&&this.removeListener(t,c[u].fn,void 0,!0),l){case 1:c[u].fn.call(c[u].context);break;case 2:c[u].fn.call(c[u].context,e);break;case 3:c[u].fn.call(c[u].context,e,n);break;case 4:c[u].fn.call(c[u].context,e,n,s);break;default:if(!h)for(f=1,h=new Array(l-1);f<l;f++)h[f-1]=arguments[f];c[u].fn.apply(c[u].context,h)}}return!0};Fe.prototype.on=function(t,e,n){return Hp(this,t,e,n,!1)};Fe.prototype.once=function(t,e,n){return Hp(this,t,e,n,!0)};Fe.prototype.removeListener=function(t,e,n,s){var r=Xe?Xe+t:t;if(!this._events[r])return this;if(!e)return Po(this,r),this;var o=this._events[r];if(o.fn)o.fn===e&&(!s||o.once)&&(!n||o.context===n)&&Po(this,r);else{for(var a=0,c=[],l=o.length;a<l;a++)(o[a].fn!==e||s&&!o[a].once||n&&o[a].context!==n)&&c.push(o[a]);c.length?this._events[r]=c.length===1?c[0]:c:Po(this,r)}return this};Fe.prototype.removeAllListeners=function(t){var e;return t?(e=Xe?Xe+t:t,this._events[e]&&Po(this,e)):(this._events=new br,this._eventsCount=0),this};Fe.prototype.off=Fe.prototype.removeListener;Fe.prototype.addListener=Fe.prototype.on;Fe.prefixed=Xe;Fe.EventEmitter=Fe;ph=Fe;var Ki={};ji(Ki,"ConnectionType",()=>gi);ji(Ki,"PeerErrorType",()=>xe);ji(Ki,"BaseConnectionErrorType",()=>_l);ji(Ki,"DataConnectionErrorType",()=>mh);ji(Ki,"SerializationType",()=>ia);ji(Ki,"SocketEventType",()=>ui);ji(Ki,"ServerMessageType",()=>ke);var gi=(function(i){return i.Data="data",i.Media="media",i})({}),xe=(function(i){return i.BrowserIncompatible="browser-incompatible",i.Disconnected="disconnected",i.InvalidID="invalid-id",i.InvalidKey="invalid-key",i.Network="network",i.PeerUnavailable="peer-unavailable",i.SslUnavailable="ssl-unavailable",i.ServerError="server-error",i.SocketError="socket-error",i.SocketClosed="socket-closed",i.UnavailableID="unavailable-id",i.WebRTC="webrtc",i})({}),_l=(function(i){return i.NegotiationFailed="negotiation-failed",i.ConnectionClosed="connection-closed",i})({}),mh=(function(i){return i.NotOpenYet="not-open-yet",i.MessageToBig="message-too-big",i})({}),ia=(function(i){return i.Binary="binary",i.BinaryUTF8="binary-utf8",i.JSON="json",i.None="raw",i})({}),ui=(function(i){return i.Message="message",i.Disconnected="disconnected",i.Error="error",i.Close="close",i})({}),ke=(function(i){return i.Heartbeat="HEARTBEAT",i.Candidate="CANDIDATE",i.Offer="OFFER",i.Answer="ANSWER",i.Open="OPEN",i.Error="ERROR",i.IdTaken="ID-TAKEN",i.InvalidKey="INVALID-KEY",i.Leave="LEAVE",i.Expire="EXPIRE",i})({});const Vp="1.5.5";class Lb extends ph.EventEmitter{constructor(t,e,n,s,r,o=5e3){super(),this.pingInterval=o,this._disconnected=!0,this._messagesQueue=[];const a=t?"wss://":"ws://";this._baseUrl=a+e+":"+n+s+"peerjs?key="+r}start(t,e){this._id=t;const n=`${this._baseUrl}&id=${t}&token=${e}`;this._socket||!this._disconnected||(this._socket=new WebSocket(n+"&version="+Vp),this._disconnected=!1,this._socket.onmessage=s=>{let r;try{r=JSON.parse(s.data),gt.log("Server message received:",r)}catch{gt.log("Invalid server message",s.data);return}this.emit(ui.Message,r)},this._socket.onclose=s=>{this._disconnected||(gt.log("Socket closed.",s),this._cleanup(),this._disconnected=!0,this.emit(ui.Disconnected))},this._socket.onopen=()=>{this._disconnected||(this._sendQueuedMessages(),gt.log("Socket open"),this._scheduleHeartbeat())})}_scheduleHeartbeat(){this._wsPingTimer=setTimeout(()=>{this._sendHeartbeat()},this.pingInterval)}_sendHeartbeat(){if(!this._wsOpen()){gt.log("Cannot send heartbeat, because socket closed");return}const t=JSON.stringify({type:ke.Heartbeat});this._socket.send(t),this._scheduleHeartbeat()}_wsOpen(){return!!this._socket&&this._socket.readyState===1}_sendQueuedMessages(){const t=[...this._messagesQueue];this._messagesQueue=[];for(const e of t)this.send(e)}send(t){if(this._disconnected)return;if(!this._id){this._messagesQueue.push(t);return}if(!t.type){this.emit(ui.Error,"Invalid message");return}if(!this._wsOpen())return;const e=JSON.stringify(t);this._socket.send(e)}close(){this._disconnected||(this._cleanup(),this._disconnected=!0)}_cleanup(){this._socket&&(this._socket.onopen=this._socket.onmessage=this._socket.onclose=null,this._socket.close(),this._socket=void 0),clearTimeout(this._wsPingTimer)}}class Gp{constructor(t){this.connection=t}startConnection(t){const e=this._startPeerConnection();if(this.connection.peerConnection=e,this.connection.type===gi.Media&&t._stream&&this._addTracksToConnection(t._stream,e),t.originator){const n=this.connection,s={ordered:!!t.reliable},r=e.createDataChannel(n.label,s);n._initializeDataChannel(r),this._makeOffer()}else this.handleSDP("OFFER",t.sdp)}_startPeerConnection(){gt.log("Creating RTCPeerConnection.");const t=new RTCPeerConnection(this.connection.provider.options.config);return this._setupListeners(t),t}_setupListeners(t){const e=this.connection.peer,n=this.connection.connectionId,s=this.connection.type,r=this.connection.provider;gt.log("Listening for ICE candidates."),t.onicecandidate=o=>{!o.candidate||!o.candidate.candidate||(gt.log(`Received ICE candidates for ${e}:`,o.candidate),r.socket.send({type:ke.Candidate,payload:{candidate:o.candidate,type:s,connectionId:n},dst:e}))},t.oniceconnectionstatechange=()=>{switch(t.iceConnectionState){case"failed":gt.log("iceConnectionState is failed, closing connections to "+e),this.connection.emitError(_l.NegotiationFailed,"Negotiation of connection to "+e+" failed."),this.connection.close();break;case"closed":gt.log("iceConnectionState is closed, closing connections to "+e),this.connection.emitError(_l.ConnectionClosed,"Connection to "+e+" closed."),this.connection.close();break;case"disconnected":gt.log("iceConnectionState changed to disconnected on the connection with "+e);break;case"completed":t.onicecandidate=()=>{};break}this.connection.emit("iceStateChanged",t.iceConnectionState)},gt.log("Listening for data channel"),t.ondatachannel=o=>{gt.log("Received data channel");const a=o.channel;r.getConnection(e,n)._initializeDataChannel(a)},gt.log("Listening for remote stream"),t.ontrack=o=>{gt.log("Received remote stream");const a=o.streams[0],c=r.getConnection(e,n);if(c.type===gi.Media){const l=c;this._addStreamToMediaConnection(a,l)}}}cleanup(){gt.log("Cleaning up PeerConnection to "+this.connection.peer);const t=this.connection.peerConnection;if(!t)return;this.connection.peerConnection=null,t.onicecandidate=t.oniceconnectionstatechange=t.ondatachannel=t.ontrack=()=>{};const e=t.signalingState!=="closed";let n=!1;const s=this.connection.dataChannel;s&&(n=!!s.readyState&&s.readyState!=="closed"),(e||n)&&t.close()}async _makeOffer(){const t=this.connection.peerConnection,e=this.connection.provider;try{const n=await t.createOffer(this.connection.options.constraints);gt.log("Created offer."),this.connection.options.sdpTransform&&typeof this.connection.options.sdpTransform=="function"&&(n.sdp=this.connection.options.sdpTransform(n.sdp)||n.sdp);try{await t.setLocalDescription(n),gt.log("Set localDescription:",n,`for:${this.connection.peer}`);let s={sdp:n,type:this.connection.type,connectionId:this.connection.connectionId,metadata:this.connection.metadata};if(this.connection.type===gi.Data){const r=this.connection;s={...s,label:r.label,reliable:r.reliable,serialization:r.serialization}}e.socket.send({type:ke.Offer,payload:s,dst:this.connection.peer})}catch(s){s!="OperationError: Failed to set local offer sdp: Called in wrong state: kHaveRemoteOffer"&&(e.emitError(xe.WebRTC,s),gt.log("Failed to setLocalDescription, ",s))}}catch(n){e.emitError(xe.WebRTC,n),gt.log("Failed to createOffer, ",n)}}async _makeAnswer(){const t=this.connection.peerConnection,e=this.connection.provider;try{const n=await t.createAnswer();gt.log("Created answer."),this.connection.options.sdpTransform&&typeof this.connection.options.sdpTransform=="function"&&(n.sdp=this.connection.options.sdpTransform(n.sdp)||n.sdp);try{await t.setLocalDescription(n),gt.log("Set localDescription:",n,`for:${this.connection.peer}`),e.socket.send({type:ke.Answer,payload:{sdp:n,type:this.connection.type,connectionId:this.connection.connectionId},dst:this.connection.peer})}catch(s){e.emitError(xe.WebRTC,s),gt.log("Failed to setLocalDescription, ",s)}}catch(n){e.emitError(xe.WebRTC,n),gt.log("Failed to create answer, ",n)}}async handleSDP(t,e){e=new RTCSessionDescription(e);const n=this.connection.peerConnection,s=this.connection.provider;gt.log("Setting remote description",e);const r=this;try{await n.setRemoteDescription(e),gt.log(`Set remoteDescription:${t} for:${this.connection.peer}`),t==="OFFER"&&await r._makeAnswer()}catch(o){s.emitError(xe.WebRTC,o),gt.log("Failed to setRemoteDescription, ",o)}}async handleCandidate(t){gt.log("handleCandidate:",t);try{await this.connection.peerConnection.addIceCandidate(t),gt.log(`Added ICE candidate for:${this.connection.peer}`)}catch(e){this.connection.provider.emitError(xe.WebRTC,e),gt.log("Failed to handleCandidate, ",e)}}_addTracksToConnection(t,e){if(gt.log(`add tracks from stream ${t.id} to peer connection`),!e.addTrack)return gt.error("Your browser does't support RTCPeerConnection#addTrack. Ignored.");t.getTracks().forEach(n=>{e.addTrack(n,t)})}_addStreamToMediaConnection(t,e){gt.log(`add stream ${t.id} to media connection ${e.connectionId}`),e.addStream(t)}}class Wp extends ph.EventEmitter{emitError(t,e){gt.error("Error:",e),this.emit("error",new Ib(`${t}`,e))}}class Ib extends Error{constructor(t,e){typeof e=="string"?super(e):(super(),Object.assign(this,e)),this.type=t}}class Xp extends Wp{get open(){return this._open}constructor(t,e,n){super(),this.peer=t,this.provider=e,this.options=n,this._open=!1,this.metadata=n.metadata}}var kl;const xr=class xr extends Xp{get type(){return gi.Media}get localStream(){return this._localStream}get remoteStream(){return this._remoteStream}constructor(t,e,n){super(t,e,n),this._localStream=this.options._stream,this.connectionId=this.options.connectionId||xr.ID_PREFIX+Ye.randomToken(),this._negotiator=new Gp(this),this._localStream&&this._negotiator.startConnection({_stream:this._localStream,originator:!0})}_initializeDataChannel(t){this.dataChannel=t,this.dataChannel.onopen=()=>{gt.log(`DC#${this.connectionId} dc connection success`),this.emit("willCloseOnRemote")},this.dataChannel.onclose=()=>{gt.log(`DC#${this.connectionId} dc closed for:`,this.peer),this.close()}}addStream(t){gt.log("Receiving stream",t),this._remoteStream=t,super.emit("stream",t)}handleMessage(t){const e=t.type,n=t.payload;switch(t.type){case ke.Answer:this._negotiator.handleSDP(e,n.sdp),this._open=!0;break;case ke.Candidate:this._negotiator.handleCandidate(n.candidate);break;default:gt.warn(`Unrecognized message type:${e} from peer:${this.peer}`);break}}answer(t,e={}){if(this._localStream){gt.warn("Local stream already exists on this MediaConnection. Are you answering a call twice?");return}this._localStream=t,e&&e.sdpTransform&&(this.options.sdpTransform=e.sdpTransform),this._negotiator.startConnection({...this.options._payload,_stream:t});const n=this.provider._getMessages(this.connectionId);for(const s of n)this.handleMessage(s);this._open=!0}close(){this._negotiator&&(this._negotiator.cleanup(),this._negotiator=null),this._localStream=null,this._remoteStream=null,this.provider&&(this.provider._removeConnection(this),this.provider=null),this.options&&this.options._stream&&(this.options._stream=null),this.open&&(this._open=!1,super.emit("close"))}};kl=new WeakMap,Be(xr,kl,xr.ID_PREFIX="mc_");let Vo=xr;class Db{constructor(t){this._options=t}_buildRequest(t){const e=this._options.secure?"https":"http",{host:n,port:s,path:r,key:o}=this._options,a=new URL(`${e}://${n}:${s}${r}${o}/${t}`);return a.searchParams.set("ts",`${Date.now()}${Math.random()}`),a.searchParams.set("version",Vp),fetch(a.href,{referrerPolicy:this._options.referrerPolicy})}async retrieveId(){try{const t=await this._buildRequest("id");if(t.status!==200)throw new Error(`Error. Status:${t.status}`);return t.text()}catch(t){gt.error("Error retrieving ID",t);let e="";throw this._options.path==="/"&&this._options.host!==Ye.CLOUD_HOST&&(e=" If you passed in a `path` to your self-hosted PeerServer, you'll also need to pass in that same path when creating a new Peer."),new Error("Could not get an ID from the server."+e)}}async listAllPeers(){try{const t=await this._buildRequest("peers");if(t.status!==200){if(t.status===401){let e="";throw this._options.host===Ye.CLOUD_HOST?e="It looks like you're using the cloud server. You can email team@peerjs.com to enable peer listing for your API key.":e="You need to enable `allow_discovery` on your self-hosted PeerServer to use this feature.",new Error("It doesn't look like you have permission to list peers IDs. "+e)}throw new Error(`Error. Status:${t.status}`)}return t.json()}catch(t){throw gt.error("Error retrieving list peers",t),new Error("Could not get list peers from the server."+t)}}}var zl,Fl;const ki=class ki extends Xp{get type(){return gi.Data}constructor(t,e,n){super(t,e,n),this.connectionId=this.options.connectionId||ki.ID_PREFIX+Bp(),this.label=this.options.label||this.connectionId,this.reliable=!!this.options.reliable,this._negotiator=new Gp(this),this._negotiator.startConnection(this.options._payload||{originator:!0,reliable:this.reliable})}_initializeDataChannel(t){this.dataChannel=t,this.dataChannel.onopen=()=>{gt.log(`DC#${this.connectionId} dc connection success`),this._open=!0,this.emit("open")},this.dataChannel.onmessage=e=>{gt.log(`DC#${this.connectionId} dc onmessage:`,e.data)},this.dataChannel.onclose=()=>{gt.log(`DC#${this.connectionId} dc closed for:`,this.peer),this.close()}}close(t){if(t!=null&&t.flush){this.send({__peerData:{type:"close"}});return}this._negotiator&&(this._negotiator.cleanup(),this._negotiator=null),this.provider&&(this.provider._removeConnection(this),this.provider=null),this.dataChannel&&(this.dataChannel.onopen=null,this.dataChannel.onmessage=null,this.dataChannel.onclose=null,this.dataChannel=null),this.open&&(this._open=!1,super.emit("close"))}send(t,e=!1){if(!this.open){this.emitError(mh.NotOpenYet,"Connection is not open. You should listen for the `open` event before sending messages.");return}return this._send(t,e)}async handleMessage(t){const e=t.payload;switch(t.type){case ke.Answer:await this._negotiator.handleSDP(t.type,e.sdp);break;case ke.Candidate:await this._negotiator.handleCandidate(e.candidate);break;default:gt.warn("Unrecognized message type:",t.type,"from peer:",this.peer);break}}};zl=new WeakMap,Fl=new WeakMap,Be(ki,zl,ki.ID_PREFIX="dc_"),Be(ki,Fl,ki.MAX_BUFFERED_AMOUNT=8388608);let Go=ki;class gh extends Go{get bufferSize(){return this._bufferSize}_initializeDataChannel(t){super._initializeDataChannel(t),this.dataChannel.binaryType="arraybuffer",this.dataChannel.addEventListener("message",e=>this._handleDataMessage(e))}_bufferedSend(t){(this._buffering||!this._trySend(t))&&(this._buffer.push(t),this._bufferSize=this._buffer.length)}_trySend(t){if(!this.open)return!1;if(this.dataChannel.bufferedAmount>Go.MAX_BUFFERED_AMOUNT)return this._buffering=!0,setTimeout(()=>{this._buffering=!1,this._tryBuffer()},50),!1;try{this.dataChannel.send(t)}catch(e){return gt.error(`DC#:${this.connectionId} Error when sending:`,e),this._buffering=!0,this.close(),!1}return!0}_tryBuffer(){if(!this.open||this._buffer.length===0)return;const t=this._buffer[0];this._trySend(t)&&(this._buffer.shift(),this._bufferSize=this._buffer.length,this._tryBuffer())}close(t){if(t!=null&&t.flush){this.send({__peerData:{type:"close"}});return}this._buffer=[],this._bufferSize=0,super.close()}constructor(...t){super(...t),this._buffer=[],this._bufferSize=0,this._buffering=!1}}class oc extends gh{close(t){super.close(t),this._chunkedData={}}constructor(t,e,n){super(t,e,n),this.chunker=new Fp,this.serialization=ia.Binary,this._chunkedData={}}_handleDataMessage({data:t}){const e=rp(t),n=e.__peerData;if(n){if(n.type==="close"){this.close();return}this._handleChunk(e);return}this.emit("data",e)}_handleChunk(t){const e=t.__peerData,n=this._chunkedData[e]||{data:[],count:0,total:t.total};if(n.data[t.n]=new Uint8Array(t.data),n.count++,this._chunkedData[e]=n,n.total===n.count){delete this._chunkedData[e];const s=Eb(n.data);this._handleDataMessage({data:s})}}_send(t,e){const n=op(t);if(n instanceof Promise)return this._send_blob(n);if(!e&&n.byteLength>this.chunker.chunkedMTU){this._sendChunks(n);return}this._bufferedSend(n)}async _send_blob(t){const e=await t;if(e.byteLength>this.chunker.chunkedMTU){this._sendChunks(e);return}this._bufferedSend(e)}_sendChunks(t){const e=this.chunker.chunk(t);gt.log(`DC#${this.connectionId} Try to send ${e.length} chunks...`);for(const n of e)this.send(n,!0)}}class Ub extends gh{_handleDataMessage({data:t}){super.emit("data",t)}_send(t,e){this._bufferedSend(t)}constructor(...t){super(...t),this.serialization=ia.None}}class Nb extends gh{_handleDataMessage({data:t}){const e=this.parse(this.decoder.decode(t)),n=e.__peerData;if(n&&n.type==="close"){this.close();return}this.emit("data",e)}_send(t,e){const n=this.encoder.encode(this.stringify(t));if(n.byteLength>=Ye.chunkedMTU){this.emitError(mh.MessageToBig,"Message too big for JSON channel");return}this._bufferedSend(n)}constructor(...t){super(...t),this.serialization=ia.JSON,this.encoder=new TextEncoder,this.decoder=new TextDecoder,this.stringify=JSON.stringify,this.parse=JSON.parse}}var Bl;const yr=class yr extends Wp{get id(){return this._id}get options(){return this._options}get open(){return this._open}get socket(){return this._socket}get connections(){const t=Object.create(null);for(const[e,n]of this._connections)t[e]=n;return t}get destroyed(){return this._destroyed}get disconnected(){return this._disconnected}constructor(t,e){super(),this._serializers={raw:Ub,json:Nb,binary:oc,"binary-utf8":oc,default:oc},this._id=null,this._lastServerId=null,this._destroyed=!1,this._disconnected=!1,this._open=!1,this._connections=new Map,this._lostMessages=new Map;let n;if(t&&t.constructor==Object?e=t:t&&(n=t.toString()),e={debug:0,host:Ye.CLOUD_HOST,port:Ye.CLOUD_PORT,path:"/",key:yr.DEFAULT_KEY,token:Ye.randomToken(),config:Ye.defaultConfig,referrerPolicy:"strict-origin-when-cross-origin",serializers:{},...e},this._options=e,this._serializers={...this._serializers,...this.options.serializers},this._options.host==="/"&&(this._options.host=window.location.hostname),this._options.path&&(this._options.path[0]!=="/"&&(this._options.path="/"+this._options.path),this._options.path[this._options.path.length-1]!=="/"&&(this._options.path+="/")),this._options.secure===void 0&&this._options.host!==Ye.CLOUD_HOST?this._options.secure=Ye.isSecure():this._options.host==Ye.CLOUD_HOST&&(this._options.secure=!0),this._options.logFunction&&gt.setLogFunction(this._options.logFunction),gt.logLevel=this._options.debug||0,this._api=new Db(e),this._socket=this._createServerConnection(),!Ye.supports.audioVideo&&!Ye.supports.data){this._delayedAbort(xe.BrowserIncompatible,"The current browser does not support WebRTC");return}if(n&&!Ye.validateId(n)){this._delayedAbort(xe.InvalidID,`ID "${n}" is invalid`);return}n?this._initialize(n):this._api.retrieveId().then(s=>this._initialize(s)).catch(s=>this._abort(xe.ServerError,s))}_createServerConnection(){const t=new Lb(this._options.secure,this._options.host,this._options.port,this._options.path,this._options.key,this._options.pingInterval);return t.on(ui.Message,e=>{this._handleMessage(e)}),t.on(ui.Error,e=>{this._abort(xe.SocketError,e)}),t.on(ui.Disconnected,()=>{this.disconnected||(this.emitError(xe.Network,"Lost connection to server."),this.disconnect())}),t.on(ui.Close,()=>{this.disconnected||this._abort(xe.SocketClosed,"Underlying socket is already closed.")}),t}_initialize(t){this._id=t,this.socket.start(t,this._options.token)}_handleMessage(t){const e=t.type,n=t.payload,s=t.src;switch(e){case ke.Open:this._lastServerId=this.id,this._open=!0,this.emit("open",this.id);break;case ke.Error:this._abort(xe.ServerError,n.msg);break;case ke.IdTaken:this._abort(xe.UnavailableID,`ID "${this.id}" is taken`);break;case ke.InvalidKey:this._abort(xe.InvalidKey,`API KEY "${this._options.key}" is invalid`);break;case ke.Leave:gt.log(`Received leave message from ${s}`),this._cleanupPeer(s),this._connections.delete(s);break;case ke.Expire:this.emitError(xe.PeerUnavailable,`Could not connect to peer ${s}`);break;case ke.Offer:{const r=n.connectionId;let o=this.getConnection(s,r);if(o&&(o.close(),gt.warn(`Offer received for existing Connection ID:${r}`)),n.type===gi.Media){const c=new Vo(s,this,{connectionId:r,_payload:n,metadata:n.metadata});o=c,this._addConnection(s,o),this.emit("call",c)}else if(n.type===gi.Data){const c=new this._serializers[n.serialization](s,this,{connectionId:r,_payload:n,metadata:n.metadata,label:n.label,serialization:n.serialization,reliable:n.reliable});o=c,this._addConnection(s,o),this.emit("connection",c)}else{gt.warn(`Received malformed connection type:${n.type}`);return}const a=this._getMessages(r);for(const c of a)o.handleMessage(c);break}default:{if(!n){gt.warn(`You received a malformed message from ${s} of type ${e}`);return}const r=n.connectionId,o=this.getConnection(s,r);o&&o.peerConnection?o.handleMessage(t):r?this._storeMessage(r,t):gt.warn("You received an unrecognized message:",t);break}}}_storeMessage(t,e){this._lostMessages.has(t)||this._lostMessages.set(t,[]),this._lostMessages.get(t).push(e)}_getMessages(t){const e=this._lostMessages.get(t);return e?(this._lostMessages.delete(t),e):[]}connect(t,e={}){if(e={serialization:"default",...e},this.disconnected){gt.warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect, or call reconnect on this peer if you believe its ID to still be available."),this.emitError(xe.Disconnected,"Cannot connect to new Peer after disconnecting from server.");return}const n=new this._serializers[e.serialization](t,this,e);return this._addConnection(t,n),n}call(t,e,n={}){if(this.disconnected){gt.warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect."),this.emitError(xe.Disconnected,"Cannot connect to new Peer after disconnecting from server.");return}if(!e){gt.error("To call a peer, you must provide a stream from your browser's `getUserMedia`.");return}const s=new Vo(t,this,{...n,_stream:e});return this._addConnection(t,s),s}_addConnection(t,e){gt.log(`add connection ${e.type}:${e.connectionId} to peerId:${t}`),this._connections.has(t)||this._connections.set(t,[]),this._connections.get(t).push(e)}_removeConnection(t){const e=this._connections.get(t.peer);if(e){const n=e.indexOf(t);n!==-1&&e.splice(n,1)}this._lostMessages.delete(t.connectionId)}getConnection(t,e){const n=this._connections.get(t);if(!n)return null;for(const s of n)if(s.connectionId===e)return s;return null}_delayedAbort(t,e){setTimeout(()=>{this._abort(t,e)},0)}_abort(t,e){gt.error("Aborting!"),this.emitError(t,e),this._lastServerId?this.disconnect():this.destroy()}destroy(){this.destroyed||(gt.log(`Destroy peer with ID:${this.id}`),this.disconnect(),this._cleanup(),this._destroyed=!0,this.emit("close"))}_cleanup(){for(const t of this._connections.keys())this._cleanupPeer(t),this._connections.delete(t);this.socket.removeAllListeners()}_cleanupPeer(t){const e=this._connections.get(t);if(e)for(const n of e)n.close()}disconnect(){if(this.disconnected)return;const t=this.id;gt.log(`Disconnect peer with ID:${t}`),this._disconnected=!0,this._open=!1,this.socket.close(),this._lastServerId=t,this._id=null,this.emit("disconnected",t)}reconnect(){if(this.disconnected&&!this.destroyed)gt.log(`Attempting reconnection to server with ID ${this._lastServerId}`),this._disconnected=!1,this._initialize(this._lastServerId);else{if(this.destroyed)throw new Error("This peer cannot reconnect to the server. It has already been destroyed.");if(!this.disconnected&&!this.open)gt.error("In a hurry? We're still trying to make the initial connection!");else throw new Error(`Peer ${this.id} cannot reconnect because it is not disconnected from the server!`)}}listAllPeers(t=e=>{}){this._api.listAllPeers().then(e=>t(e)).catch(e=>this._abort(xe.ServerError,e))}};Bl=new WeakMap,Be(yr,Bl,yr.DEFAULT_KEY="peerjs");let vl=yr;var Id=vl;const Nt=Object.freeze({HELLO:"hello",TEAM:"team",READY:"ready",INPUT:"input",CHAT:"chat",LOBBY:"lobby",START:"start",SNAP:"snap",KICKED:"kicked",END:"end"}),Ob=Object.freeze(["kickoff","play","goal","end"]),kb=Object.freeze(["kick","ban"]),ac=Object.freeze({matchTime:Object.freeze([60,180,300]),goalLimit:Object.freeze([3,5,10,0]),goalScale:Object.freeze([.8,1,1.3])}),zb=Object.freeze(["field","keeper"]),Wo=Object.freeze([Object.freeze([14826299,16742973,15910205,14039984,9190175,14833551]),Object.freeze([3894754,3127494,4179050,7027682,2834283,10465496])]),Pr=Object.freeze([Wo[0][0],Wo[1][0]]),Xo=6,Fb=20,Bb=64,xl=16,Hb=xl+2,yl=120,Vb=32,Gb=8,Dd="Oyuncu",Ud="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",Zi=i=>typeof i=="object"&&i!==null&&!Array.isArray(i),_h=i=>typeof i=="number"&&Number.isFinite(i),$o=i=>_h(i)&&Number.isInteger(i),_i=i=>typeof i=="boolean",vh=(i,t)=>typeof i=="string"&&i.length>0&&i.length<=t,Nd=(i,t,e)=>i<t?t:i>e?e:i;class Wb extends Error{}const le=i=>{if(!i)throw new Wb},Ge=i=>(le(_h(i)),i),on=(i,t=0)=>i===void 0?t:Ge(i),sa=i=>(le(i===0||i===1),i),ra=i=>(le(vh(i,Bb)),i),Ps=(i,t)=>(le(t.includes(i)),i),$p=/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;function Pn(i){return typeof i!="string"?Dd:i.replace($p," ").replace(/\s+/g," ").trim().slice(0,Fb).trim()||Dd}function Er(i){return typeof i!="string"?"":i.replace($p," ").replace(/[<>]/g,"").replace(/\s+/g," ").trim().slice(0,yl).trim()}function Xb(i){return typeof i!="string"?"":i.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,Xo)}function $b(){var n;const i=Ud.length;let t="";const e=(n=globalThis.crypto)!=null&&n.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(Xo)):null;for(let s=0;s<Xo;s++){const r=e?e[s]/4294967296:Math.random();t+=Ud[Math.min(i-1,Math.floor(r*i))]}return t}function Yb(i){return i===void 0?[...Pr]:(le(Array.isArray(i)&&i.length===2),[0,1].map(t=>(le($o(i[t])&&Wo[t].includes(i[t])),i[t])))}function Od(i){return le(Zi(i)),le(_i(i.keepers)),{matchTime:Ps(i.matchTime,ac.matchTime),goalLimit:Ps(i.goalLimit,ac.goalLimit),goalScale:Ps(i.goalScale,ac.goalScale),keepers:i.keepers,teamColors:Yb(i.teamColors)}}function qb(i){return le(Zi(i)&&_i(i.isHost)),le(i.ready===void 0||_i(i.ready)),le(i.spectator===void 0||_i(i.spectator)),{id:ra(i.id),name:Pn(i.name),team:sa(i.team),isHost:i.isHost,ready:i.ready===!0,spectator:i.spectator===!0}}function jb(i){return le(Zi(i)),{id:ra(i.id),team:sa(i.team),role:i.role===void 0?"field":Ps(i.role,zb),name:Pn(i.name)}}function Kb(i){return le(Zi(i)),i.role!==void 0&&le(vh(i.role,16)),{id:ra(i.id),x:Ge(i.x),z:Ge(i.z),vx:on(i.vx),vz:on(i.vz),facing:on(i.facing),down:on(i.down),charge:on(i.charge),kickAnim:on(i.kickAnim),headerAnim:on(i.headerAnim),dive:on(i.dive),diveRecover:on(i.diveRecover),diveYaw:on(i.diveYaw),diveKind:on(i.diveKind),jumpY:on(i.jumpY),team:sa(i.team),role:i.role===void 0?"field":i.role}}function Zb(i){return le(Zi(i)),{x:Ge(i.x),y:Ge(i.y),z:Ge(i.z),vx:Ge(i.vx),vy:Ge(i.vy),vz:Ge(i.vz),wx:Ge(i.wx),wy:Ge(i.wy),wz:Ge(i.wz)}}function kd(i){le(Array.isArray(i)&&i.length===2);const t=i.map(e=>(le($o(e)&&e>=0&&e<1e6),e));return[t[0],t[1]]}function Jb(i){le(Zi(i)&&vh(i.type,24));const t={type:i.type};let e=0;for(const n of Object.keys(i)){if(n==="type"||n.length>16)continue;if(e>=Gb)break;const s=i[n];(_h(s)||_i(s)||typeof s=="string"&&s.length<=32)&&(t[n]=s,e++)}return t}function go(i,t,e,n=!1){return i===void 0&&n?[]:(le(Array.isArray(i)&&i.length<=t),i.map(e))}const Qb={[Nt.HELLO]:i=>(le(typeof i.name=="string"),le(i.spectate===void 0||_i(i.spectate)),{t:Nt.HELLO,name:Pn(i.name),spectate:i.spectate===!0}),[Nt.TEAM]:i=>({t:Nt.TEAM,team:sa(i.team)}),[Nt.READY]:i=>(le(_i(i.ready)),{t:Nt.READY,ready:i.ready}),[Nt.CHAT]:i=>{const t=Er(i.text);le(t.length>0);const e={t:Nt.CHAT,text:t};return i.from!==void 0&&(e.from=Pn(i.from)),e},[Nt.INPUT]:i=>(le($o(i.seq)&&i.seq>=0&&i.seq<=Number.MAX_SAFE_INTEGER),le(_i(i.kick)),{t:Nt.INPUT,seq:i.seq,x:Nd(Ge(i.x),-1,1),z:Nd(Ge(i.z),-1,1),kick:i.kick,slide:i.slide===!0}),[Nt.LOBBY]:i=>({t:Nt.LOBBY,you:ra(i.you),players:go(i.players,xl,qb),settings:Od(i.settings)}),[Nt.START]:i=>({t:Nt.START,settings:Od(i.settings),roster:go(i.roster,Hb,jb,!0)}),[Nt.SNAP]:i=>(le($o(i.tick)&&i.tick>=0),{t:Nt.SNAP,tick:i.tick,state:Ps(i.state,Ob),timeLeft:Math.max(0,Ge(i.timeLeft)),score:kd(i.score),ball:Zb(i.ball),players:go(i.players,xl,Kb),events:go(i.events,Vb,Jb,!0)}),[Nt.KICKED]:i=>({t:Nt.KICKED,reason:Ps(i.reason,kb)}),[Nt.END]:i=>({t:Nt.END,score:kd(i.score)})};function cc(i){if(!Zi(i)||typeof i.t!="string")return null;const t=Qb[i.t];if(!t)return null;try{return t(i)}catch{return null}}const zd="goalnet-",tE=3,eE=150,nE=12e3,Le=Object.freeze({ROOM_NOT_FOUND:"room-not-found",INVALID_CODE:"invalid-code",ID_TAKEN:"id-taken",BROWSER:"browser-unsupported",NETWORK:"network",CONNECTION:"connection",INVALID_MESSAGE:"invalid-message",PEER:"peer"}),iE={"peer-unavailable":Le.ROOM_NOT_FOUND,"invalid-code":Le.INVALID_CODE,"invalid-message":Le.INVALID_MESSAGE,"unavailable-id":Le.ID_TAKEN,"browser-incompatible":Le.BROWSER,network:Le.NETWORK,"server-error":Le.NETWORK,"socket-error":Le.NETWORK,"socket-closed":Le.NETWORK,"ssl-unavailable":Le.NETWORK,webrtc:Le.CONNECTION,disconnected:Le.NETWORK},ys=()=>{};class Fd{constructor(t={}){const e=t||{};this.cb={onOpen:e.onOpen||ys,onPeerJoin:e.onPeerJoin||ys,onPeerLeave:e.onPeerLeave||ys,onMessage:e.onMessage||ys,onError:e.onError||ys,onClosed:e.onClosed||ys},this.peer=null,this.isHost=!1,this.code=null,this.hostId=null,this.name="",this.conns=new Map,this.banned=new Set,this.stats={sent:0,received:0,dropped:0,rejected:0,invalidOut:0},this._leftReported=new Set,this._timers=new Map,this._hostTries=0,this._destroyed=!1}host(){this.isHost=!0,this._hostTries=0,this._openHost()}_openHost(){this._hostTries++;const t=$b();this.code=t;const e=new Id(zd+t);this.peer=e,e.on("open",()=>{this._destroyed||this.cb.onOpen(t)}),e.on("connection",n=>this._acceptConnection(n)),e.on("disconnected",()=>this._reconnect(e)),e.on("close",()=>{this._destroyed||this.cb.onClosed("peer-closed")}),e.on("error",n=>{if((n==null?void 0:n.type)==="unavailable-id"&&this._hostTries<tE){try{e.destroy()}catch{}this._openHost();return}this._emitError(n)})}_acceptConnection(t){const e=t.peer;if(this.banned.has(e)){this.stats.rejected++;try{t.close()}catch{}return}this._leftReported.delete(e),this.conns.set(e,t),this._wire(t)}join(t,e=""){this.isHost=!1,this.name=Pn(e);const n=Xb(t);if(n.length!==Xo){this._emitError({type:"invalid-code",message:`bad room code: ${String(t)}`});return}this.code=n;const s=zd+n;this.hostId=s;const r=new Id;this.peer=r,r.on("open",()=>{if(this._destroyed)return;const o=r.connect(s,{reliable:!0,metadata:{name:this.name}});if(!o){this._emitError({type:"peer-unavailable",message:"connect() returned nothing"});return}this.conns.set(s,o),this._wire(o),this._timers.set(s,setTimeout(()=>{!o.open&&!this._destroyed&&(this._emitError({type:"peer-unavailable",message:"join timed out"}),this._dropPeer(s))},nE))}),r.on("disconnected",()=>this._reconnect(r)),r.on("close",()=>{this._destroyed||this.cb.onClosed("peer-closed")}),r.on("error",o=>this._emitError(o))}send(t,e){const n=cc(e);if(!n)return this.stats.invalidOut++,this._emitError({type:"invalid-message",message:`refusing to send ${e==null?void 0:e.t}`}),!1;const s=this.conns.get(t);if(!s||!s.open)return!1;try{return s.send(n),this.stats.sent++,!0}catch(r){return this._emitError(r),!1}}broadcast(t){const e=cc(t);if(!e)return this.stats.invalidOut++,this._emitError({type:"invalid-message",message:`refusing to broadcast ${t==null?void 0:t.t}`}),0;let n=0;for(const s of this.conns.values())if(s.open)try{s.send(e),this.stats.sent++,n++}catch{}return n}kick(t){this._disconnect(t,"kick")}ban(t){this.banned.add(t),this._disconnect(t,"ban")}_disconnect(t,e){const n=this.conns.get(t);if(!n)return;if(n.open)try{n.send({t:Nt.KICKED,reason:e}),this.stats.sent++}catch{}const s=setTimeout(()=>{try{n.close()}catch{}this._dropPeer(t)},eE);this._timers.set(`${t}:close`,s)}close(t="local"){if(!this._destroyed){this._destroyed=!0;for(const e of this._timers.values())clearTimeout(e);this._timers.clear();for(const e of this.conns.values())try{e.close()}catch{}if(this.conns.clear(),this.peer)try{this.peer.destroy()}catch{}this.peer=null,this.cb.onClosed(t)}}peers(){return[...this.conns.entries()].filter(([,t])=>t.open).map(([t])=>t)}_wire(t){const e=t.peer;t.on("open",()=>{if(this._destroyed)return;const n=this._timers.get(e);n&&(clearTimeout(n),this._timers.delete(e)),this.cb.onPeerJoin(e)}),t.on("data",n=>this._handleData(e,n)),t.on("close",()=>this._dropPeer(e)),t.on("error",n=>{this._emitError(n,Le.CONNECTION),this._dropPeer(e)})}_handleData(t,e){let n=e;if(typeof e=="string")try{n=JSON.parse(e)}catch{n=null}const s=cc(n);if(!s){this.stats.dropped++;return}this.stats.received++,this.cb.onMessage(t,s)}_dropPeer(t){const e=this._timers.get(t);e&&(clearTimeout(e),this._timers.delete(t)),this.conns.delete(t),!this._leftReported.has(t)&&(this._leftReported.add(t),this._destroyed||this.cb.onPeerLeave(t))}_reconnect(t){if(!(this._destroyed||t.destroyed))try{t.reconnect()}catch(e){this._emitError(e,Le.NETWORK)}}_emitError(t,e=Le.PEER){const n=t==null?void 0:t.type,s=iE[n]||e;this.cb.onError({code:s,type:n||"unknown",message:(t==null?void 0:t.message)||String(t??"unknown error"),cause:t})}}const sE=6e4,rE=700,oE=5,aE=5e3,Tn="host",Ls=i=>typeof i=="string"&&i.startsWith("bot"),Is=i=>Pn(i).toLocaleLowerCase("tr"),vi=i=>i.filter(t=>!t.spectator),Yp=i=>i.filter(t=>t.spectator);function cE(i){const t=vi(i),e=t.filter(s=>s.team===0).length;return t.filter(s=>s.team===1).length<e?1:0}function Lo(i){return i?i.isHost||i.id===Tn||Ls(i.id)||i.spectator?!0:i.ready===!0:!1}const lE=i=>i.every(Lo);function qp(i){return Array.isArray(i)?vi(i).length>=2&&lE(i):!1}function hE(i,t,e){return i.map(n=>n.id===t&&!n.isHost&&!Ls(n.id)&&!n.spectator?{...n,ready:e===!0}:n)}const uE=i=>i.map(t=>t.ready?{...t,ready:!1}:t);function dE(i,t={}){const e=vi(i).map(n=>({id:n.id,team:n.team,role:"field",name:n.name??""}));return t.keepers&&e.push({id:"kr",team:0,role:"keeper",name:""},{id:"kb",team:1,role:"keeper",name:""}),e}function fE(i,t,e){return!t||Ls(t.id)||i.set(Is(t.name),{id:t.id,name:t.name,team:t.team,spectator:t.spectator===!0,at:e}),i}function Sl(i,t){for(const[e,n]of i)t-n.at>sE&&i.delete(e);return i}function pE(i,t,e){Sl(i,e);const n=Is(t),s=i.get(n);return s?(i.delete(n),s):null}function mE(i,t){return i.delete(Is(t)),i}function gE(i,t,e){const n=i.get(t)??{last:-1/0,stamps:[]};if(e-n.last<rE)return!1;const s=n.stamps.filter(r=>e-r<aE);return s.length>=oE?(i.set(t,{last:n.last,stamps:s}),!1):(s.push(e),i.set(t,{last:e,stamps:s}),!0)}const jp="goalnet-name",Bd=6,_E=5e3,vE=1600,Hd="------",Yo={matchTime:180,goalLimit:5,goalScale:1,keepers:!0,teamColors:[...Pr]},an=()=>{},lc=i=>`#${i.toString(16).padStart(6,"0")}`;function Vd(i,t){return i==="keepers"?t==="true":Number(t)}function xE(){try{return localStorage.getItem(jp)||""}catch{return""}}function yE(i){try{localStorage.setItem(jp,i)}catch{}}var Et,Kp,Zp,Jp,Ml,bl,Io,El,Qp,tm,em,Tl,Do,nm,Uo,im,sm,Cl,rm,Al;class xh{constructor(t={}){Be(this,Et);this.cb={onCreate:an,onJoin:an,onTeamSwitch:an,onSettingsChange:an,onStart:an,onKick:an,onBan:an,onLeave:an,onAddBot:an,onReady:an,onSpectate:an,onColor:an,...t};const e=n=>document.getElementById(n);this.el={menu:e("menu"),btnMp:e("btnMp"),entry:e("mpEntry"),connecting:e("mpConnecting"),connectingMsg:e("mpConnectingMsg"),lobby:e("mpLobby"),error:e("mpError"),name:e("mpName"),code:e("mpCode"),create:e("mpCreate"),join:e("mpJoin"),back:e("mpBack"),cancel:e("mpCancel"),roomCode:e("mpRoomCode"),copy:e("mpCopy"),teamRed:e("mpTeamRed"),teamBlue:e("mpTeamBlue"),swap:e("mpSwitch"),settings:e("mpSettings"),settingsHint:e("mpSettingsHint"),start:e("mpStart"),leave:e("mpLeave"),addBotRed:e("mpAddBotRed"),addBotBlue:e("mpAddBotBlue")},this.overlays=[this.el.entry,this.el.connecting,this.el.lobby].filter(Boolean),this.state={players:[],isHost:!1,you:null},this.settings={...Yo},this.roomCode="",this.swapTarget=1,this.rows=new Map,this.specRows=new Map,this.errorTimer=null,this.copyTimer=null,this.iAmReady=!1,this.ready=!!(this.el.entry&&this.el.lobby),this.ready&&(J(this,Et,Kp).call(this),J(this,Et,Jp).call(this),this.el.name&&(this.el.name.value=xE()),J(this,Et,Uo).call(this))}showMenu(){this.clearError(),J(this,Et,Tl).call(this),this.el.menu&&this.el.menu.classList.remove("hidden")}showEntry(){this.clearError(),J(this,Et,Do).call(this,this.el.entry),this.el.name&&this.el.name.focus()}showConnecting(t="Bağlanılıyor…"){this.clearError(),this.el.connectingMsg&&(this.el.connectingMsg.textContent=t),J(this,Et,Do).call(this,this.el.connecting)}showLobby(t={}){this.ready&&(this.state={you:t.you??null,isHost:!!t.isHost,players:Array.isArray(t.players)?t.players:[],settings:t.settings},t.settings&&(this.settings={...Yo,...t.settings}),t.code&&this.setRoomCode(t.code),J(this,Et,Do).call(this,this.el.lobby),J(this,Et,im).call(this),J(this,Et,Uo).call(this),J(this,Et,rm).call(this))}setRoomCode(t){this.roomCode=String(t||"").toUpperCase(),this.el.roomCode&&(this.el.roomCode.textContent=this.roomCode||Hd)}showError(t){var s;const e=this.el.error;if(!e)return;const n=(s=J(this,Et,nm).call(this))==null?void 0:s.querySelector(".mp-error-slot");n&&e.parentElement!==n&&n.appendChild(e),e.textContent=t,e.classList.add("show"),clearTimeout(this.errorTimer),this.errorTimer=setTimeout(()=>this.clearError(),_E)}clearError(){clearTimeout(this.errorTimer),this.el.error&&(this.el.error.classList.remove("show"),this.el.error.textContent="")}hide(){this.clearError(),J(this,Et,Tl).call(this)}attachChat(t){if(!t||!this.el.lobby)return;const e=this.el.lobby.querySelector(".mp-actions");e?this.el.lobby.insertBefore(t,e):this.el.lobby.appendChild(t)}}Et=new WeakSet,Kp=function(){var n,s,r;const t=this.el;if(J(this,Et,Zp).call(this),(n=t.join)!=null&&n.parentElement){const o=document.createElement("button");o.id="mpSpectate",o.className="mp-ghost mp-small",o.textContent="İzleyici olarak katıl",o.title="Takıma girmeden maçı izle",t.join.parentElement.insertBefore(o,t.join.nextSibling),t.spectate=o}const e=(s=t.lobby)==null?void 0:s.querySelector(".mp-teams");if(e){const o=document.createElement("div");o.className="mp-team mp-team-spec",o.id="mpSpectatorBox";const a=document.createElement("h3");a.textContent="İZLEYİCİLER";const c=document.createElement("ul");c.className="mp-playerlist",c.id="mpSpectators",o.append(a,c),e.appendChild(o),t.spectators=c,t.spectatorBox=o}if(t.settings&&(t.colorSegs=[0,1].map(o=>{const a=document.createElement("span");a.className="mp-setlabel",a.textContent=o===0?"Kırmızı forma":"Mavi forma";const c=document.createElement("span");c.className="mp-seg mp-colors",c.id=o===0?"mpColorsRed":"mpColorsBlue";for(const l of Wo[o]){const h=document.createElement("button");h.className="mp-swatch",h.dataset.side=String(o),h.dataset.color=String(l),h.style.background=lc(l),h.title=lc(l),h.setAttribute("aria-label",`${o===0?"Kırmızı":"Mavi"} ${lc(l)}`),h.addEventListener("click",()=>this.cb.onColor(o,l)),c.appendChild(h)}return t.settings.append(a,c),c})),(r=t.start)!=null&&r.parentElement){const o=document.createElement("button");o.id="mpReady",o.className="mp-ghost",o.textContent="Hazır",t.start.parentElement.insertBefore(o,t.start),t.readyBtn=o}},Zp=function(){if(document.getElementById("mp-social-style"))return;const t=document.createElement("style");t.id="mp-social-style",t.textContent=`
      .mp-team-spec { border-top-color: #7f8ec0; min-width: 190px; }
      .mp-ready { color: #4ad07a; font-weight: 700; font-size: 14px; }
      .mp-ready.waiting { color: #7f8ec0; }
      .mp-player.is-absent { opacity: .55; }
      .overlay .mp-seg.mp-colors button.mp-swatch { width: 26px; height: 26px; padding: 0;
        border-radius: 50%; border: 2px solid rgba(255, 255, 255, .25); }
      .overlay .mp-seg.mp-colors button.mp-swatch.on { border-color: #fff;
        box-shadow: 0 0 0 2px rgba(36, 86, 230, .9); }
      .overlay .mp-seg.mp-colors button.mp-swatch:disabled { cursor: default; }
      #mpReady.on { background: #1f8a4c; color: #fff; }
    `,document.head.appendChild(t)},Jp=function(){const t=this.el;t.btnMp&&t.btnMp.addEventListener("click",()=>this.showEntry()),t.name&&(t.name.addEventListener("input",()=>yE(t.name.value)),t.name.addEventListener("keydown",e=>{e.key==="Enter"&&J(this,Et,bl).call(this)})),t.code&&(t.code.addEventListener("input",()=>J(this,Et,Qp).call(this)),t.code.addEventListener("keydown",e=>{e.key==="Enter"&&J(this,Et,Io).call(this)})),t.create&&t.create.addEventListener("click",()=>J(this,Et,bl).call(this)),t.join&&t.join.addEventListener("click",()=>J(this,Et,Io).call(this)),t.spectate&&t.spectate.addEventListener("click",()=>J(this,Et,Io).call(this,!0)),t.readyBtn&&t.readyBtn.addEventListener("click",()=>{this.iAmReady=!this.iAmReady,J(this,Et,Al).call(this),this.cb.onReady(this.iAmReady)}),t.back&&t.back.addEventListener("click",()=>this.showMenu()),t.cancel&&t.cancel.addEventListener("click",()=>J(this,Et,El).call(this)),t.copy&&t.copy.addEventListener("click",()=>J(this,Et,tm).call(this)),t.swap&&t.swap.addEventListener("click",()=>this.cb.onTeamSwitch(this.swapTarget)),t.start&&t.start.addEventListener("click",()=>this.cb.onStart()),t.addBotRed&&t.addBotRed.addEventListener("click",()=>this.cb.onAddBot(0)),t.addBotBlue&&t.addBotBlue.addEventListener("click",()=>this.cb.onAddBot(1)),t.leave&&t.leave.addEventListener("click",()=>J(this,Et,El).call(this)),t.settings&&t.settings.addEventListener("click",e=>J(this,Et,em).call(this,e))},Ml=function(){var t;return(((t=this.el.name)==null?void 0:t.value)||"").trim().slice(0,20)},bl=function(){const t=J(this,Et,Ml).call(this);if(!t){this.showError("Önce bir oyuncu adı gir.");return}this.cb.onCreate(t)},Io=function(t=!1){var s;const e=J(this,Et,Ml).call(this);if(!e){this.showError("Önce bir oyuncu adı gir.");return}const n=(((s=this.el.code)==null?void 0:s.value)||"").trim().toUpperCase();if(n.length!==Bd){this.showError("Oda kodu 6 karakter olmalı.");return}t?this.cb.onSpectate(n,e):this.cb.onJoin(n,e)},El=function(){this.cb.onLeave(),this.showMenu()},Qp=function(){const t=this.el.code,e=t.selectionStart,n=t.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,Bd);if(n===t.value)return;const s=t.value.length-n.length;t.value=n;const r=Math.max(0,(e??n.length)-s);try{t.setSelectionRange(r,r)}catch{}},tm=function(){var s,r;const t=this.roomCode||(((s=this.el.roomCode)==null?void 0:s.textContent)||"").trim();if(!t||t===Hd)return;const e=()=>{this.el.copy.textContent="Kopyalandı ✓",clearTimeout(this.copyTimer),this.copyTimer=setTimeout(()=>{this.el.copy.textContent="Kopyala"},vE)},n=()=>this.showError("Kopyalanamadı, kodu elle seç.");(r=navigator.clipboard)!=null&&r.writeText?navigator.clipboard.writeText(t).then(e,n):n()},em=function(t){const e=t.target.closest("button[data-setting]");if(!e||e.disabled)return;const n=e.dataset.setting,s=Vd(n,e.dataset.value);this.settings[n]!==s&&(this.settings={...this.settings,[n]:s},J(this,Et,Uo).call(this),this.cb.onSettingsChange({...this.settings}))},Tl=function(){for(const t of this.overlays)t.classList.add("hidden")},Do=function(t){if(t){this.el.menu&&this.el.menu.classList.add("hidden");for(const e of this.overlays)e.classList.toggle("hidden",e!==t)}},nm=function(){return this.overlays.find(t=>!t.classList.contains("hidden"))||null},Uo=function(){const t=this.el.settings;if(!t)return;const e=!!this.state.isHost;for(const s of t.querySelectorAll("button[data-setting]")){const r=s.dataset.setting,o=this.settings[r]===Vd(r,s.dataset.value);s.classList.toggle("on",o),s.disabled=!e}const n=this.settings.teamColors??Pr;for(const s of t.querySelectorAll("button.mp-swatch")){const r=Number(s.dataset.side);s.classList.toggle("on",n[r]===Number(s.dataset.color)),s.disabled=!e}t.classList.toggle("readonly",!e),this.el.settingsHint&&(this.el.settingsHint.textContent=e?"Ayarları sen belirliyorsun.":"Ayarları oda sahibi belirler.")},im=function(){const{players:t,you:e,isHost:n}=this.state,s=[this.el.teamRed,this.el.teamBlue],r=new Set,o=vi(t);s.forEach((c,l)=>{if(!c)return;o.filter(u=>(Number(u.team)||0)===l).forEach((u,d)=>{const f=J(this,Et,Cl).call(this,u,e,n);r.add(String(u.id)),c.children[d]!==f&&c.insertBefore(f,c.children[d]||null)});for(const u of[...c.children])(!r.has(u.dataset.id)||u.dataset.id==="")&&u.remove();if(!c.children.length){const u=document.createElement("li");u.className="mp-empty",u.dataset.id="",u.textContent="Boş",c.appendChild(u)}});for(const[c,l]of this.rows)r.has(c)||(l.remove(),this.rows.delete(c));J(this,Et,sm).call(this);const a=t.find(c=>String(c.id)===String(e));this.swapTarget=a&&(Number(a.team)||0)===1?0:1,this.el.swap&&(this.el.swap.disabled=!a||a.spectator===!0)},sm=function(){const t=this.el.spectators;if(!t)return;const{players:e,you:n,isHost:s}=this.state,r=Yp(e);this.el.spectatorBox&&(this.el.spectatorBox.hidden=r.length===0);const o=new Set(r.map(a=>String(a.id)));r.forEach((a,c)=>{const l=J(this,Et,Cl).call(this,a,n,s,this.specRows);t.children[c]!==l&&t.insertBefore(l,t.children[c]||null)});for(const[a,c]of this.specRows)o.has(a)||(c.remove(),this.specRows.delete(a))},Cl=function(t,e,n,s=this.rows){const r=String(t.id);let o=s.get(r);if(!o){o=document.createElement("li"),o.className="mp-player",o.dataset.id=r,o.__pid=t.id;const m=document.createElement("span");m.className="mp-pname";const p=document.createElement("span");p.className="mp-ready";const x=document.createElement("span");x.className="mp-tag";const M=document.createElement("button");M.textContent="At",M.title="Odadan at",M.addEventListener("click",()=>this.cb.onKick(o.__pid));const v=document.createElement("button");v.textContent="Banla",v.title="Odadan at ve tekrar girmesini engelle",v.addEventListener("click",()=>this.cb.onBan(o.__pid)),o.append(m,p,x,M,v),o.__parts={name:m,ready:p,tag:x,kick:M,ban:v},s.set(r,o)}o.__pid=t.id;const a=String(e)===r,{name:c,ready:l,tag:h,kick:u,ban:d}=o.__parts;c.textContent=t.name||"Oyuncu";const f=[];t.isHost&&f.push("👑"),t.spectator&&f.push("izleyici"),a&&f.push("sen"),h.textContent=f.join(" ");const g=!t.isHost&&!t.spectator&&!String(t.id).startsWith("bot");l.textContent=g?Lo(t)?"✓":"…":"",l.classList.toggle("waiting",g&&!Lo(t)),l.title=g?Lo(t)?"Hazır":"Bekleniyor":"",o.classList.toggle("is-you",a),o.classList.toggle("is-absent",t.absent===!0);const _=n&&!a;return u.hidden=!_,d.hidden=!_,o},rm=function(){const{players:t,isHost:e,you:n}=this.state;if(this.el.start){const r=vi(t).length>=2,o=qp(t);this.el.start.hidden=!e,this.el.start.disabled=!o,this.el.start.title=r?o?"":"Tüm oyuncular hazır olmalı":"En az 2 oyuncu gerekli"}for(const r of[this.el.addBotRed,this.el.addBotBlue])r&&(r.hidden=!e);const s=t.find(r=>String(r.id)===String(n));this.el.readyBtn&&(this.el.readyBtn.hidden=e||!s||s.spectator===!0,this.iAmReady=(s==null?void 0:s.ready)===!0,J(this,Et,Al).call(this))},Al=function(){const t=this.el.readyBtn;t&&(t.classList.toggle("on",this.iAmReady),t.textContent=this.iAmReady?"Hazır ✓":"Hazır")};if(typeof location<"u"&&location.search.includes("lobbydemo")){const i=e=>(...n)=>console.log("[lobbydemo]",e,...n),t=()=>{const e=new xh({onCreate:i("onCreate"),onJoin:i("onJoin"),onTeamSwitch:i("onTeamSwitch"),onSettingsChange:i("onSettingsChange"),onStart:i("onStart"),onKick:i("onKick"),onBan:i("onBan"),onLeave:i("onLeave"),onReady:i("onReady"),onSpectate:i("onSpectate"),onColor:i("onColor")}),n={code:"K7P2QX",you:"p1",isHost:!0,players:[{id:"p1",name:"Ege",team:0,isHost:!0},{id:"p2",name:"Mert",team:0,isHost:!1,ready:!0},{id:"p3",name:"Zeynep",team:1,isHost:!1,ready:!1},{id:"p4",name:"Can",team:1,isHost:!1,ready:!0},{id:"p5",name:"Deniz",team:0,isHost:!1,spectator:!0}],settings:{matchTime:180,goalLimit:5,goalScale:1,keepers:!0,teamColors:[...Pr]}};window.__lobbyDemo={ui:e,mock:n,guest:{...n,you:"p3",isHost:!1}},e.showMenu(),setTimeout(()=>e.showConnecting("Oda kuruluyor…"),900),setTimeout(()=>e.showLobby(n),2e3)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()}const SE=Object.freeze(Object.defineProperty({__proto__:null,DEFAULT_SETTINGS:Yo,LobbyUI:xh},Symbol.toStringTag,{value:"Module"})),ME=Object.freeze(["İyi gol!","Şanslıydı!","Pas ver!","Savunma!"]),bE=4,EE=6e3,Gd=60,Wd="mp-chat-style",TE=`
.mp-chat { display: flex; flex-direction: column; gap: 6px; margin: 14px auto 0;
  width: min(520px, 92%); text-align: left; }
.mp-chat-log { list-style: none; margin: 0; padding: 8px 10px; height: 132px;
  overflow-y: auto; border-radius: 12px; background: rgba(4, 8, 20, .5);
  border: 1px solid rgba(120, 150, 220, .28); display: flex; flex-direction: column; gap: 4px; }
.mp-chat-line { font-size: 14px; line-height: 1.35; color: #dce6ff; word-break: break-word; }
.mp-chat-line .mp-chat-from { color: #9fb0d8; font-weight: 700; margin-right: 6px; }
.mp-chat-line.is-own .mp-chat-from { color: #7fa6ff; }
.mp-chat-line.is-sys { color: #9fb0d8; font-style: italic; }
.mp-chat-row { display: flex; gap: 6px; }
.mp-chat-row input { flex: 1; }
.overlay .mp-chat-row button { margin: 0; padding: 8px 16px; font-size: 14px; border-radius: 10px; }
.mp-chat-empty { color: #7f8ec0; font-size: 13px; font-style: italic; }

#mpChatOverlay { position: fixed; left: 16px; bottom: 90px; z-index: 40;
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  pointer-events: none; font-family: inherit; max-width: min(420px, 60vw); }
#mpChatOverlay.hidden { display: none; }
#mpChatOverlay .mp-chat-line { background: rgba(4, 8, 20, .62); padding: 4px 10px;
  border-radius: 9px; font-size: 14px; transition: opacity .5s ease; }
#mpChatOverlay .mp-chat-line.fade { opacity: 0; }
#mpChatEntry { pointer-events: auto; display: flex; gap: 6px; align-items: center;
  background: rgba(4, 8, 20, .78); padding: 6px 8px; border-radius: 10px;
  border: 1px solid rgba(120, 150, 220, .4); }
#mpChatEntry.hidden { display: none; }
#mpChatEntry .mp-chat-caret { color: #9fb0d8; font-size: 13px; font-weight: 700; }
#mpChatEntry input { width: 260px; border: 0; outline: none; background: transparent;
  color: #eef3ff; font: inherit; font-size: 14px; }
#mpChatHint { color: #9fb0d8; font-size: 12px; background: rgba(4, 8, 20, .55);
  padding: 3px 8px; border-radius: 8px; }
#mpChatHint.hidden { display: none; }
`;function CE(){if(typeof document>"u"||document.getElementById(Wd))return;const i=document.createElement("style");i.id=Wd,i.textContent=TE,document.head.appendChild(i)}function AE(){const i=document.activeElement;if(!i)return!1;const t=i.tagName;return t==="INPUT"||t==="TEXTAREA"||i.isContentEditable===!0}var _e,om,am,cm,No,wl,Rl,lm,hm;class wE{constructor(t={}){Be(this,_e);this.cb={onSend:()=>{},isInMatch:()=>!1,canChat:()=>!1,...t},this.lines=[],this.overlayTimers=new Set,this.mounted=!1,!(typeof document>"u")&&(CE(),J(this,_e,om).call(this),J(this,_e,am).call(this),J(this,_e,cm).call(this),this.mounted=!0)}push(t){const e=Er(t==null?void 0:t.text);if(!e)return;const n={from:t.from??"",text:e,own:!!t.own,sys:!!t.sys};this.lines.push(n),this.lines.length>Gd&&this.lines.shift(),this.mounted&&(J(this,_e,lm).call(this,n),J(this,_e,hm).call(this,n))}system(t){this.push({text:t,sys:!0})}mountLobby(t){!this.mounted||!t||this.panel.parentElement===t||t.appendChild(this.panel)}setInMatch(t){this.mounted&&(this.overlay.classList.toggle("hidden",!t),t||this.closeEntry())}clear(){this.lines.length=0,this.mounted&&(this.log.textContent="",this.overlay.textContent="",this.overlay.append(this.entry,this.hint),J(this,_e,wl).call(this),this.closeEntry())}closeEntry(){this.mounted&&(this.entry.classList.add("hidden"),this.hint.classList.add("hidden"),this.entryInput.value="",document.activeElement===this.entryInput&&this.entryInput.blur())}get isTyping(){return this.mounted&&!this.entry.classList.contains("hidden")}openEntry(){!this.mounted||!this.cb.isInMatch()||(this.entry.classList.remove("hidden"),this.hint.classList.remove("hidden"),this.entryInput.value="",this.entryInput.focus())}}_e=new WeakSet,om=function(){const t=document.createElement("div");t.className="mp-chat",t.id="mpChat";const e=document.createElement("span");e.className="mp-label",e.textContent="Sohbet";const n=document.createElement("ul");n.className="mp-chat-log",n.id="mpChatLog";const s=document.createElement("div");s.className="mp-chat-row";const r=document.createElement("input");r.id="mpChatInput",r.className="mp-input",r.type="text",r.maxLength=yl,r.placeholder="Mesaj yaz…",r.autocomplete="off";const o=document.createElement("button");o.id="mpChatSend",o.className="mp-small",o.textContent="Gönder",r.addEventListener("keydown",a=>{a.stopPropagation(),a.key==="Enter"&&(a.preventDefault(),J(this,_e,No).call(this,r))},!0),r.addEventListener("keyup",a=>a.stopPropagation(),!0),o.addEventListener("click",()=>J(this,_e,No).call(this,r)),s.append(r,o),t.append(e,n,s),this.panel=t,this.log=n,this.lobbyInput=r,J(this,_e,wl).call(this)},am=function(){const t=document.createElement("div");t.id="mpChatOverlay",t.className="hidden";const e=document.createElement("div");e.id="mpChatEntry",e.className="hidden";const n=document.createElement("span");n.className="mp-chat-caret",n.textContent="Mesaj:";const s=document.createElement("input");s.type="text",s.maxLength=yl,s.autocomplete="off",s.spellcheck=!1,s.addEventListener("keydown",o=>{o.stopPropagation(),o.key==="Enter"?(o.preventDefault(),J(this,_e,No).call(this,s),this.closeEntry()):o.key==="Escape"&&(o.preventDefault(),this.closeEntry())},!0),s.addEventListener("keyup",o=>o.stopPropagation(),!0),s.addEventListener("keypress",o=>o.stopPropagation(),!0),e.append(n,s);const r=document.createElement("div");r.id="mpChatHint",r.className="hidden",r.textContent="Enter gönderir · Esc kapatır",t.append(e,r),document.body.appendChild(t),this.overlay=t,this.entry=e,this.entryInput=s,this.hint=r},cm=function(){addEventListener("keydown",t=>{if(!this.cb.canChat()||this.isTyping||AE()||t.ctrlKey||t.altKey||t.metaKey)return;if(t.code==="KeyT"){t.preventDefault(),this.openEntry();return}if(!this.cb.isInMatch())return;const e=["Digit1","Digit2","Digit3","Digit4"].indexOf(t.code);e>=0&&(t.preventDefault(),this.cb.onSend(ME[e]))})},No=function(t){const e=Er(t.value);t.value="",e&&this.cb.onSend(e)},wl=function(){if(this.log.children.length)return;const t=document.createElement("li");t.className="mp-chat-empty",t.dataset.empty="1",t.textContent="Henüz mesaj yok.",this.log.appendChild(t)},Rl=function(t){const e=document.createElement("li");if(e.className="mp-chat-line",t.own&&e.classList.add("is-own"),t.sys&&e.classList.add("is-sys"),t.from&&!t.sys){const n=document.createElement("span");n.className="mp-chat-from",n.textContent=`${t.from}:`,e.appendChild(n)}return e.appendChild(document.createTextNode(t.text)),e},lm=function(t){const e=this.log.querySelector("[data-empty]");for(e&&e.remove(),this.log.appendChild(J(this,_e,Rl).call(this,t));this.log.children.length>Gd;)this.log.firstElementChild.remove();this.log.scrollTop=this.log.scrollHeight},hm=function(t){const e=J(this,_e,Rl).call(this,t);this.overlay.insertBefore(e,this.entry);const n=[...this.overlay.querySelectorAll(".mp-chat-line")];for(const r of n.slice(0,Math.max(0,n.length-bE)))r.remove();const s=setTimeout(()=>{e.classList.add("fade");const r=setTimeout(()=>{e.remove(),this.overlayTimers.delete(r)},600);this.overlayTimers.add(r),this.overlayTimers.delete(s)},EE);this.overlayTimers.add(s)};const RE=1/20,PE=1/30,LE=1e4,IE=4e3,hc=6,DE=8,_o=3,UE=2e3,NE=4e3,uc=(()=>{try{return localStorage.getItem("goalnet-rooms-url")||""}catch{return""}})()||`${location.protocol}//${location.hostname}:5200`;class Xd{constructor(){this.last={x:0,z:0,kick:!1,slide:!1}}set(t){this.last={x:t.x,z:t.z,kick:t.kick,slide:!!t.slide}}update(){return this.last}}class OE{constructor(t,e,n,s){this.world=t,this.camera=e,this.dom=n,this.myId=s,this.state="kickoff",this.timeScale=1,this.score=[0,0],this.timeLeft=t.config.matchTime,this.mode="mp-guest",this.rig=new sp(e),this.msgTimer=null,this.byId=new Map,this.slowUntil=0,this.playerRed=null,this.playerBlue=null,n.menu.classList.add("hidden"),n.end.classList.add("hidden")}registerPlayers(){this.byId.clear();for(const t of this.world.players)this.byId.set(t.mpId,t)}isHuman(t){return(t==null?void 0:t.mpId)===this.myId}showMessage(t,e,n=1600){const s=this.dom.msg;s.textContent=t,s.className=`hud show ${e}`,clearTimeout(this.msgTimer),this.msgTimer=setTimeout(()=>{s.className="hud"},n)}applySnap(t,e){var r,o,a,c,l,h,u,d,f,g,_,m;const n=this.state;this.state=t.state,this.timeLeft=t.timeLeft,this.score=t.score;const s=this.world.ball;s.pos.x=t.ball.x,s.pos.y=t.ball.y,s.pos.z=t.ball.z,s.vel.x=t.ball.vx,s.vel.y=t.ball.vy,s.vel.z=t.ball.vz,s.omega.x=t.ball.wx,s.omega.y=t.ball.wy,s.omega.z=t.ball.wz,s.prev.x=s.pos.x,s.prev.y=s.pos.y,s.prev.z=s.pos.z;for(const p of t.players){const x=this.byId.get(p.id);x&&(x.pos.x=p.x,x.pos.z=p.z,x.vel.x=p.vx,x.vel.z=p.vz,x.facing=p.facing,x.down=p.down,p.down>0&&x.downTotal<=0&&(x.downTotal=1.5),x.charge=p.charge,x.kickAnim=p.kickAnim,x.headerAnim=p.headerAnim,x.dive=p.dive,x.diveRecover=p.diveRecover,x.diveKind=p.diveKind===1?"slide":"dive",x.diveDir={x:Math.sin(p.diveYaw),z:Math.cos(p.diveYaw)},x.jumpY=p.jumpY,x.input.x=0,x.input.z=0)}for(const p of t.events||[])p.type==="goal"?(this.showMessage("GOOOL!","gol",2600),this.timeScale=.3,this.slowUntil=e+2.2,(r=this.onSnapEvent)==null||r.call(this,p)):p.type==="post"?(this.showMessage("Direk!","direk",900),(o=this.onSnapEvent)==null||o.call(this,p)):p.type==="crossbar"?(this.showMessage("Üst direk!","direk",900),(a=this.onSnapEvent)==null||a.call(this,p)):p.type==="throwin"?(this.showMessage("Taç!","kacti",1e3),(c=this.onSnapEvent)==null||c.call(this,p)):p.type==="goalkick"?(this.showMessage("Kale vuruşu!","kacti",1e3),(l=this.onSnapEvent)==null||l.call(this,p)):p.type==="corner"?(this.showMessage("Korner!","direk",1e3),(h=this.onSnapEvent)==null||h.call(this,p)):p.type==="foul"?(this.showMessage("Faul!","kacti",1200),(u=this.onSnapEvent)==null||u.call(this,p)):p.type==="penalty"?(this.showMessage("Penaltı!","direk",1600),(d=this.onSnapEvent)==null||d.call(this,p)):p.type==="freekick"?(this.showMessage("Serbest vuruş!","kacti",1200),(f=this.onSnapEvent)==null||f.call(this,p)):p.type==="half"?(this.showMessage("Devre Arası","hazir",1800),this.world.sideSwap=!this.world.sideSwap,(g=this.onSnapEvent)==null||g.call(this,p)):p.type==="golden"?(this.showMessage("Altın Gol!","gol",2e3),(_=this.onSnapEvent)==null||_.call(this,p)):(p.type==="kick"||p.type==="ragdoll")&&((m=this.onSnapEvent)==null||m.call(this,p));n!=="kickoff"&&t.state==="kickoff"&&this.showMessage("Hazır…","hazir",1e3),n!=="end"&&t.state==="end"&&this.showEnd(),this.updateScoreboard()}showEnd(){const[t,e]=this.score;this.dom.endTitle.textContent=t===e?"Berabere!":`${t>e?"KIRMIZI":"MAVİ"} kazandı!`,this.dom.endScore.textContent=`${t} — ${e}`,this.dom.end.classList.remove("hidden")}updateScoreboard(){this.dom.scoreRed.textContent=this.score[0],this.dom.scoreBlue.textContent=this.score[1];const t=Math.max(0,Math.ceil(this.timeLeft));this.dom.timer.textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}update(t,e){this.world.drainEvents(),this.state==="play"&&(this.timeLeft=Math.max(0,this.timeLeft-t),this.updateScoreboard()),this.timeScale<1&&e>this.slowUntil&&(this.timeScale=1),this.rig.update(t,{ball:this.world.ball.pos,state:this.state,me:this.byId.get(this.myId)??null})}}var Xn,um,cr;class kE{constructor(t,e){Be(this,Xn);this.hooks=t,this.dom=e,this.active=!1,this.role=null,this.net=null,this.myName="",this.players=[],this.settings={...Yo},this.code="",this.remotes=new Map,this.inMatch=!1,this.pendingEvents=[],this.snapAcc=0,this.inputAcc=0,this.inputSeq=0,this.tick=0,this.guestKeyboard=null,this.lastLobby=null,this.announceTimer=null,this.roomsTimer=null,this.slotOf=new Map,this.connOf=new Map,this.departed=new Map,this.bannedNames=new Set,this.chatBuckets=new Map,this.startRoster=null,this.spectating=!1,this.retry=0,this.resuming=!1,this.hadMatch=!1,this.reconnectTimer=null,this.resumeTimer=null,this.ui=new xh({onCreate:n=>this.hostRoom(n),onJoin:(n,s)=>this.joinRoom(n,s),onSpectate:(n,s)=>this.joinRoom(n,s,{spectate:!0}),onTeamSwitch:n=>this.requestTeam(n),onSettingsChange:n=>this.changeSettings(n),onColor:(n,s)=>this.changeColor(n,s),onStart:()=>this.hostStartMatch(),onKick:n=>this.removePeer(n,"kick"),onBan:n=>this.removePeer(n,"ban"),onLeave:()=>this.leave(),onAddBot:n=>this.addBot(n),onReady:n=>this.setOwnReady(n)}),this.chat=new wE({onSend:n=>this.sendChat(n),isInMatch:()=>this.active&&this.inMatch,canChat:()=>this.active}),this.ui.attachChat(this.chat.panel),this.botCounter=0,this.roomsEl=document.getElementById("mpRooms"),this.startRoomsPolling()}get me(){const t=this.role==="host"?Tn:this.myId;return this.players.find(e=>e.id===t)??null}sendTo(t,e){if(!this.net)return!1;const n=this.connOf.get(t)??t;return this.net.send(n,e)}hostRoom(t){this.teardownNet(),this.myName=Pn(t),this.role="host",this.ui.showConnecting("Oda kuruluyor…"),this.net=new Fd({onOpen:e=>{this.code=e,this.active=!0,this.players=[{id:Tn,name:this.myName,team:0,isHost:!0,ready:!0,spectator:!1}],this.ui.setRoomCode(e),this.broadcastLobby(),this.announce(),this.announceTimer=setInterval(()=>{this.pruneAbsent(),this.announce()},LE)},onPeerJoin:()=>{},onPeerLeave:e=>this.onGuestLeft(e),onMessage:(e,n)=>this.onHostMessage(e,n),onError:e=>this.onNetError(e),onClosed:()=>{}}),this.net.host()}onHostMessage(t,e){var s;if(e.t===Nt.HELLO){this.onHello(t,e);return}const n=this.slotOf.get(t)??t;if(e.t===Nt.TEAM){const r=this.players.find(o=>o.id===n);r&&!r.spectator&&!this.inMatch&&(r.team=e.team,this.broadcastLobby())}else if(e.t===Nt.READY){if(this.inMatch)return;const r=this.players;this.players=hE(this.players,n,e.ready),this.players!==r&&this.broadcastLobby()}else e.t===Nt.CHAT?this.relayChat(n,e.text):e.t===Nt.INPUT&&((s=this.remotes.get(n))==null||s.set(e))}onHello(t,e){if(this.slotOf.has(t)||this.players.some(o=>o.id===t))return;const n=Date.now();Sl(this.departed,n);const s=Pn(e.name);if(this.bannedNames.has(Is(s))){this.net.ban(t);return}const r=pE(this.departed,s,n);if(r){this.restoreGuest(t,r,s);return}if(e.spectate){if(Yp(this.players).length>=DE){this.net.kick(t);return}this.players.push({id:t,name:s,team:0,isHost:!1,ready:!0,spectator:!0})}else{if(vi(this.players).length>=hc){this.net.kick(t);return}this.players.push({id:t,name:s,team:cE(this.players),isHost:!1,ready:!1,spectator:!1})}this.chat.system(`${s} katıldı`),this.broadcastLobby(),this.announce()}restoreGuest(t,e,n){this.slotOf.set(t,e.id),this.connOf.set(e.id,t);const s=this.players.find(r=>r.id===e.id);s?(s.absent=!1,s.name=n):this.players.push({id:e.id,name:n,team:e.team,isHost:!1,ready:!1,spectator:e.spectator}),this.chat.system(`${n} yeniden bağlandı`),this.broadcastLobby(),this.announce(),this.inMatch&&this.resumeGuest(e.id,n)}pruneAbsent(t=Date.now()){if(this.role!=="host")return;Sl(this.departed,t);const e=this.players.length;this.players=this.players.filter(n=>!n.absent||this.departed.has(Is(n.name))),this.players.length!==e&&this.broadcastLobby()}resumeGuest(t,e){var s,r,o,a,c;if(!this.startRoster)return;const n=this.players.find(l=>l.id===t);if(n&&!n.spectator&&!this.remotes.has(t)){const l=(s=this.app)==null?void 0:s.game.byId.get(t);if(l){const h=new Xd;this.remotes.set(t,h),(r=this.app.game.controllers)==null||r.set(l,h)}}this.sendTo(t,{t:Nt.START,settings:this.settings,roster:this.startRoster}),(c=(o=this.app)==null?void 0:(a=o.game).showMessage)==null||c.call(a,`${e} döndü`,"hazir",1400)}relayChat(t,e){var o;const n=Er(e);if(!n||!gE(this.chatBuckets,t,Date.now()))return;const s=((o=this.players.find(a=>a.id===t))==null?void 0:o.name)??Pn(""),r={t:Nt.CHAT,from:s,text:n};this.net.broadcast(r),this.chat.push({from:s,text:n,own:t===Tn})}sendChat(t){var n;const e=Er(t);!e||!this.active||(this.role==="host"?this.relayChat(Tn,e):(n=this.net)==null||n.send(this.hostPeerId,{t:Nt.CHAT,text:e}))}setOwnReady(t){var e;this.role!=="host"&&((e=this.net)==null||e.send(this.hostPeerId,{t:Nt.READY,ready:!!t}))}onGuestLeft(t){var s,r,o;const e=this.slotOf.get(t)??t,n=this.players.find(a=>a.id===e);if(this.slotOf.delete(t),this.connOf.delete(e),!!n){if(fE(this.departed,n,Date.now()),this.inMatch&&!n.spectator){n.absent=!0,n.ready=!1;const a=(s=this.app)==null?void 0:s.game.byId.get(e);a&&(a.input.x=0,a.input.z=0),(r=this.remotes.get(e))==null||r.set({x:0,z:0,kick:!1,slide:!1}),(o=this.app)==null||o.game.showMessage(`${n.name} bağlantısı koptu`,"kacti",1400)}else this.players=this.players.filter(a=>a.id!==e),this.chat.system(`${n.name} ayrıldı`);this.broadcastLobby(),this.announce()}}addBot(t){if(!(this.role!=="host"||this.inMatch)){if(vi(this.players).length>=hc){this.ui.showError("Oda dolu.");return}this.botCounter++,this.players.push({id:`bot${this.botCounter}`,name:`Bot ${this.botCounter}`,team:t,isHost:!1,ready:!0,spectator:!1}),this.broadcastLobby(),this.announce()}}removePeer(t,e){var r;if(this.role!=="host"||t===Tn)return;const n=this.players.find(o=>o.id===t);if(Ls(t)){this.players=this.players.filter(o=>o.id!==t),this.broadcastLobby();return}const s=this.connOf.get(t)??t;if(n&&mE(this.departed,n.name),e==="ban"?(n&&this.bannedNames.add(Is(n.name)),this.net.ban(s)):this.net.kick(s),this.slotOf.delete(s),this.connOf.delete(t),this.players=this.players.filter(o=>o.id!==t),this.remotes.delete(t),this.inMatch){const o=(r=this.app)==null?void 0:r.game.byId.get(t);o&&(o.input.x=0,o.input.z=0)}this.broadcastLobby(),this.announce()}requestTeam(t){var e;if(this.role==="host"){const n=this.players.find(s=>s.id===Tn);n&&!this.inMatch&&(n.team=t,this.broadcastLobby())}else(e=this.net)==null||e.send(this.hostPeerId,{t:Nt.TEAM,team:t})}changeSettings(t){this.role==="host"&&(this.settings={...this.settings,...t},this.broadcastLobby())}changeColor(t,e){if(this.role!=="host"||t!==0&&t!==1)return;const n=[...this.settings.teamColors??Pr];n[t]=e,this.settings={...this.settings,teamColors:n},this.broadcastLobby()}broadcastLobby(){const t={t:Nt.LOBBY,you:"",players:this.players,settings:this.settings};for(const e of this.players)e.id===Tn||Ls(e.id)||e.absent||this.sendTo(e.id,{...t,you:e.id});this.showOwnLobby()}showOwnLobby(){this.ui.showLobby({code:this.code,you:this.role==="host"?Tn:this.myId,isHost:this.role==="host",players:this.players,settings:this.settings})}rosterFromLobby(){return dE(this.players,this.settings)}hostStartMatch(){if(this.role!=="host"||!qp(this.players))return;const t=Ln(this.settings),e=this.rosterFromLobby();this.startRoster=e,this.net.broadcast({t:Nt.START,settings:this.settings,roster:e}),this.app=this.hooks.buildMatch(t,e,{mp:"host"});const{game:n,world:s}=this.app,r=new Map;this.remotes.clear();for(const c of this.players){if(c.spectator)continue;const l=n.byId.get(c.id);if(l)if(c.id===Tn)r.set(l,new vr([Xi,ll]));else if(Ls(c.id))r.set(l,new np(s,l));else{const h=new Xd;this.remotes.set(c.id,h),r.set(l,h)}}for(const c of n.keepers)r.set(c,new ip(s,c));const o=n.onWorldEvent,a=new Set(["post","crossbar","throwin","goalkick","corner","kick","ragdoll","foul","freekick","half","golden"]);n.onWorldEvent=(c,l)=>{o==null||o(c,l),l&&(c.type==="goal"?this.pendingEvents.push({type:"goal",scorer:c.scorer}):c.type==="penalty"?this.pendingEvents.push({type:"penalty",team:c.team}):a.has(c.type)&&this.pendingEvents.push({type:c.type}))},n.onMatchEnd=()=>{this.net.broadcast({t:Nt.END,score:[...n.score]}),this.dom.btnAgain.textContent="Lobiye Dön"},n.beginMatch(r,"mp-host"),this.inMatch=!0,this.hadMatch=!0,this.chat.setInMatch(!0),this.ui.hide()}joinRoom(t,e,n={}){const s=n.resume===!0;this.teardownNet({keepReconnect:s}),this.myName=Pn(e),this.role="guest",this.spectating=n.spectate===!0,s||(this.retry=0,this.resuming=!1),this.ui.showConnecting(s?"Yeniden bağlanılıyor…":"Odaya bağlanılıyor…"),this.net=new Fd({onOpen:()=>{},onPeerJoin:r=>{this.hostPeerId=r,this.active=!0,this.net.send(r,{t:Nt.HELLO,name:this.myName,spectate:this.spectating})},onPeerLeave:()=>this.onHostGone(),onMessage:(r,o)=>this.onGuestMessage(o),onError:r=>this.onNetError(r),onClosed:()=>this.onHostGone()}),this.net.join(t,e),this.code=t}onGuestMessage(t){var e,n,s;if(t.t===Nt.LOBBY)this.myId=t.you,this.players=t.players,this.settings=t.settings,this.spectating=((e=this.me)==null?void 0:e.spectator)===!0,this.retry=0,this.ui.setRoomCode(this.code),!this.inMatch&&!this.resuming?this.showOwnLobby():this.resuming&&J(this,Xn,um).call(this);else if(t.t===Nt.START){J(this,Xn,cr).call(this),this.settings=t.settings;const r=(n=t.roster)!=null&&n.length?t.roster:this.rosterFromLobby();this.spectating=!r.some(a=>a.id===this.myId);const o=Ln(this.settings);this.app=this.hooks.buildMatch(o,r,{mp:"guest",myId:this.myId}),this.guestKeyboard=this.spectating?null:new vr([Xi,ll]),this.dom.btnAgain.textContent="Lobiye Dön",this.inMatch=!0,this.hadMatch=!0,this.chat.setInMatch(!0),this.ui.hide()}else t.t===Nt.SNAP?this.inMatch&&((s=this.app)!=null&&s.game.applySnap)&&this.app.game.applySnap(t,performance.now()/1e3):t.t===Nt.CHAT?this.chat.push({from:t.from,text:t.text,own:t.from===this.myName}):t.t===Nt.KICKED?(this.retry=_o,this.exitToMenu(t.reason==="ban"?"Odadan banlandın.":"Odadan atıldın.")):(t.t,Nt.END)}onHostGone(){if(!this.active)return;const t=this.resuming;if(this.role==="guest"&&(this.inMatch||t)&&this.retry<_o){this.scheduleReconnect();return}this.exitToMenu(t?"Bağlantı yeniden kurulamadı.":"Oda sahibi ayrıldı, oda kapandı.")}scheduleReconnect(){const t=this.code,e=this.myName,n=this.spectating;this.retry++,this.resuming=!0,clearTimeout(this.reconnectTimer),this.ui.showConnecting(`Yeniden bağlanılıyor… (${this.retry}/${_o})`),this.reconnectTimer=setTimeout(()=>{this.joinRoom(t,e,{spectate:n,resume:!0})},UE)}onNetError(t){if(this.resuming&&this.retry<_o){this.scheduleReconnect();return}(t==null?void 0:t.code)===Le.ROOM_NOT_FOUND?this.ui.showError("Oda bulunamadı. Kodu kontrol et."):(t==null?void 0:t.code)===Le.INVALID_CODE?this.ui.showError("Geçersiz oda kodu."):this.ui.showError("Bağlantı hatası. Tekrar dene."),this.active||this.ui.showEntry()}exitToMenu(t){const e=this.inMatch||this.hadMatch;J(this,Xn,cr).call(this),this.teardownNet(),e&&this.hooks.backToLocal(),this.inMatch=!1,this.ui.showMenu(),t&&(this.ui.showEntry(),this.ui.showError(t))}leave(){this.role==="host"&&this.unannounce(),J(this,Xn,cr).call(this);const t=this.inMatch||this.hadMatch;this.teardownNet(),t&&(this.hooks.backToLocal(),this.inMatch=!1)}backToLobbyAfterMatch(){this.inMatch=!1,this.hadMatch=!1,this.chat.setInMatch(!1),this.dom.btnAgain.textContent="Tekrar Oyna",this.dom.end.classList.add("hidden"),this.pendingEvents.length=0,this.startRoster=null,this.role==="host"?(this.players=uE(this.players.filter(t=>!t.absent)),this.broadcastLobby()):this.showOwnLobby()}teardownNet({keepReconnect:t=!1}={}){var e;clearInterval(this.announceTimer),this.announceTimer=null,t||(J(this,Xn,cr).call(this),this.hadMatch=!1,this.chat.clear()),this.chat.setInMatch(!1),this.role==="host"&&this.unannounce(),(e=this.net)==null||e.close(),this.net=null,this.active=!1,this.role=null,this.inMatch=!1,this.players=[],this.remotes.clear(),this.slotOf.clear(),this.connOf.clear(),this.chatBuckets.clear(),this.pendingEvents.length=0,this.startRoster=null,t||(this.departed.clear(),this.bannedNames.clear(),this.spectating=!1,this.code="")}frameHook(t){if(!(!this.active||!this.inMatch||!this.app)){if(this.role==="host")this.snapAcc+=t,this.snapAcc>=RE&&(this.snapAcc=0,this.net.broadcast(this.makeSnap()));else if(!this.spectating&&(this.inputAcc+=t,this.inputAcc>=PE&&this.guestKeyboard)){this.inputAcc=0;const e=this.guestKeyboard.update();this.net.send(this.hostPeerId,{t:Nt.INPUT,seq:this.inputSeq++,x:e.x,z:e.z,kick:e.kick,slide:e.slide})}}}makeSnap(){const{game:t,world:e}=this.app,n=["kickoff","play","goal","end"].includes(t.state)?t.state:"kickoff",s=e.ball;return{t:Nt.SNAP,tick:this.tick++,state:n,timeLeft:Math.max(0,t.timeLeft),score:[...t.score],ball:{x:s.pos.x,y:s.pos.y,z:s.pos.z,vx:s.vel.x,vy:s.vel.y,vz:s.vel.z,wx:s.omega.x,wy:s.omega.y,wz:s.omega.z},players:e.players.map(r=>({id:r.mpId,x:r.pos.x,z:r.pos.z,vx:r.vel.x,vz:r.vel.z,facing:r.facing,down:r.down,charge:r.charge,kickAnim:r.kickAnim,headerAnim:r.headerAnim,dive:r.dive,diveRecover:r.diveRecover,diveYaw:Math.atan2(r.diveDir.x,r.diveDir.z),diveKind:r.diveKind==="slide"?1:0,jumpY:r.jumpY,team:r.team,role:r.role})),events:this.pendingEvents.splice(0)}}async announce(){if(!(this.role!=="host"||!this.code))try{await fetch(`${uc}/announce`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:this.code,name:`${this.myName} odası`,players:vi(this.players).length,maxPlayers:hc})})}catch{}}async unannounce(){if(this.code)try{await fetch(`${uc}/remove`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:this.code})})}catch{}}startRoomsPolling(){var e;if(!this.roomsEl)return;const t=async()=>{var s;if(!((s=document.getElementById("mpEntry"))!=null&&s.classList.contains("hidden")))try{const o=await(await fetch(`${uc}/rooms`)).json();this.renderRooms(o)}catch{this.renderRooms(null)}};this.roomsTimer=setInterval(t,IE),(e=document.getElementById("btnMp"))==null||e.addEventListener("click",()=>setTimeout(t,60)),t()}renderRooms(t){const e=this.roomsEl;e.textContent="";const n=document.createElement("li");if(n.className="mp-empty",t===null){n.textContent="Oda listesi sunucusuna ulaşılamıyor (kodla katılabilirsin).",e.appendChild(n);return}if(!t.length){n.textContent="Şu an açık oda yok.",e.appendChild(n);return}for(const s of t){const r=document.createElement("li");r.className="mp-room";const o=document.createElement("span");o.className="mp-pname",o.textContent=`${s.name} · ${s.players}/${s.maxPlayers}`;const a=document.createElement("span");a.className="mp-tag",a.textContent=s.code;const c=document.createElement("button");c.textContent="Katıl",c.addEventListener("click",()=>{var h;const l=(((h=document.getElementById("mpName"))==null?void 0:h.value)||"").trim();if(!l){this.ui.showError("Önce bir oyuncu adı gir.");return}this.joinRoom(s.code,l)}),r.append(o,a,c),e.appendChild(r)}}}Xn=new WeakSet,um=function(){clearTimeout(this.resumeTimer),this.resumeTimer=setTimeout(()=>{this.resuming=!1,this.inMatch||this.showOwnLobby()},NE)},cr=function(){clearTimeout(this.resumeTimer),clearTimeout(this.reconnectTimer),this.resumeTimer=null,this.reconnectTimer=null,this.resuming=!1,this.retry=0};const $d="goalnet-vol",dc=.17,zE=11,Yd=.55;var Kt,dm,lr,hr,Pl,Ms,oi;class FE{constructor(){Be(this,Kt);let t=.7;try{const e=localStorage.getItem($d);e!==null&&(t=+e)}catch{}if(this.volume=Number.isFinite(t)?Math.max(0,Math.min(1,t)):.7,this.ctx=null,this.noiseBuf=null,this.ambTarget=0,this.bed=null,typeof addEventListener=="function"){const e=()=>this.ensure();addEventListener("pointerdown",e,{once:!0}),addEventListener("keydown",e,{once:!0})}}ensure(){if(!this.ctx){const t=window.AudioContext||window.webkitAudioContext;if(!t)return!1;this.ctx=new t,this.master=this.ctx.createGain(),this.master.gain.value=this.volume,this.master.connect(this.ctx.destination);const e=this.ctx.sampleRate*2;this.noiseBuf=this.ctx.createBuffer(1,e,this.ctx.sampleRate);const n=this.noiseBuf.getChannelData(0);for(let s=0;s<e;s++)n[s]=Math.random()*2-1}return this.ctx.state==="suspended"&&this.ctx.resume(),this.bed||J(this,Kt,dm).call(this),!0}setAmbiance(t){const e=Math.max(0,Math.min(1,Number.isFinite(t)?t:0));if(Math.abs(e-this.ambTarget)<.01)return;this.ambTarget=e;const n=!!this.bed;this.ensure()&&n&&J(this,Kt,lr).call(this,dc*e,Yd)}notify(t,e=null){const n=typeof t=="string"?t:t==null?void 0:t.type;if(n)switch(n){case"goal":J(this,Kt,hr).call(this,.62,2.4,.15);break;case"post":case"crossbar":J(this,Kt,hr).call(this,.36,.9,.05);break;case"kick":{const s=Number.isFinite(t==null?void 0:t.z)?t.z:e==null?void 0:e.z;Number.isFinite(s)&&Math.abs(s)>zE&&J(this,Kt,hr).call(this,.27,.5,.04);break}case"ragdoll":J(this,Kt,hr).call(this,.22,.45,.06);break}}setVolume(t){this.volume=Math.max(0,Math.min(1,t)),this.master&&(this.master.gain.value=this.volume);try{localStorage.setItem($d,String(this.volume))}catch{}}play(t){if(!this.ensure()||this.volume<=0)return;const e=this.ctx.currentTime+.01;switch(t){case"kick":J(this,Kt,oi).call(this,e,.09,95,"sine",.5,55),J(this,Kt,Ms).call(this,e,.06,900,.8,.25);break;case"post":J(this,Kt,oi).call(this,e,.4,2100,"triangle",.3,1900),J(this,Kt,oi).call(this,e,.25,3150,"sine",.12);break;case"goal":J(this,Kt,Ms).call(this,e,1.9,750,.35,.5,.18),J(this,Kt,Ms).call(this,e,1.4,320,.5,.35,.12),J(this,Kt,oi).call(this,e+.05,.5,2600,"square",.06);break;case"whistle":J(this,Kt,oi).call(this,e,.35,2500,"square",.09),J(this,Kt,oi).call(this,e+.02,.3,2520,"square",.05);break;case"thud":J(this,Kt,oi).call(this,e,.12,70,"sine",.4,45),J(this,Kt,Ms).call(this,e,.1,300,.6,.2);break;case"ooh":J(this,Kt,Ms).call(this,e,.6,600,.4,.22,.06);break}}}Kt=new WeakSet,dm=function(){const t=this.ctx,e=t.createBufferSource();e.buffer=this.noiseBuf,e.loop=!0;const n=t.createBiquadFilter();n.type="highpass",n.frequency.value=140;const s=t.createBiquadFilter();s.type="lowpass",s.frequency.value=640,s.Q.value=.5;const r=t.createGain();r.gain.value=1;const o=t.createGain();o.gain.value=0,e.connect(n),n.connect(s),s.connect(r),r.connect(o),o.connect(this.master);const a=[];for(const[c,l,h]of[[.055,.34,0],[.13,.17,1.9]]){const u=t.createOscillator();u.type="sine",u.frequency.value=c;const d=t.createGain();d.gain.value=l,u.connect(d),d.connect(r.gain),u.start(t.currentTime+h*.01),a.push(u)}e.start(),this.bed={src:e,level:o,wander:r,lfos:a},this.ambTarget>0&&J(this,Kt,lr).call(this,dc*this.ambTarget,Yd)},lr=function(t,e,n=null){const s=this.bed.level.gain,r=n??this.ctx.currentTime;n===null&&(s.cancelScheduledValues(r),s.setValueAtTime(s.value,r)),s.setTargetAtTime(t,r,Math.max(.02,e))},hr=function(t,e,n){if(this.ambTarget<=0||this.volume<=0||!this.ensure())return;const s=dc*this.ambTarget,r=Math.max(s,t*this.ambTarget),o=this.ctx.currentTime;J(this,Kt,lr).call(this,r,n),J(this,Kt,lr).call(this,s,e*.45,o+e)},Pl=function(t,e,n,s,r){const o=this.ctx.createGain();return o.gain.setValueAtTime(0,e),o.gain.linearRampToValueAtTime(s,e+n),o.gain.exponentialRampToValueAtTime(.001,e+n+r),t.connect(o),o.connect(this.master),o},Ms=function(t,e,n,s,r,o=.005){const a=this.ctx.createBufferSource();a.buffer=this.noiseBuf;const c=this.ctx.createBiquadFilter();c.type="bandpass",c.frequency.value=n,c.Q.value=s,a.connect(c),J(this,Kt,Pl).call(this,c,t,o,r,e),a.start(t),a.stop(t+o+e+.05)},oi=function(t,e,n,s,r,o=null){const a=this.ctx.createOscillator();a.type=s,a.frequency.setValueAtTime(n,t),o&&a.frequency.exponentialRampToValueAtTime(o,t+e),J(this,Kt,Pl).call(this,a,t,.004,r,e),a.start(t),a.stop(t+e+.1)};const fm="goalnet-weather",Ll=[{id:"acik",label:"Açık"},{id:"yagmur",label:"Yağmur"}];function BE(){let i=null;try{i=localStorage.getItem(fm)}catch{}return Ll.some(t=>t.id===i)?i:"acik"}const HE=[["Yukarı","up"],["Aşağı","down"],["Sol","left"],["Sağ","right"],["Şut","kick"],["Kayma","slide"]];function VE(i){return String(i||"?").replace("Key","").replace("Arrow","").replace("ShiftLeft","Sol Shift").replace("ShiftRight","Sağ Shift").replace("Up","↑").replace("Down","↓").replace("Left","←").replace("Right","→")}var Te,pm,Il,mm,Dl,gm,Ul,_m;class GE{constructor(t){Be(this,Te);this.hooks=t,this.active=!1,this.capture=null,this.weather=BE();const e=n=>document.getElementById(n);this.el={root:e("pause"),hint:e("pauseHint"),cam:e("pauseCam"),vol:e("pauseVol"),volVal:e("pauseVolVal"),keys:e("pauseKeys"),resume:e("pauseResume"),exit:e("pauseExit"),settings:e("pauseSettings")},this.el.resume.addEventListener("click",()=>this.hide()),this.el.exit.addEventListener("click",()=>{this.hide(),t.onExit()}),this.el.vol.addEventListener("input",()=>{t.sfx.setVolume(this.el.vol.value/100),this.el.volVal.textContent=`${this.el.vol.value}%`}),J(this,Te,pm).call(this),J(this,Te,mm).call(this),J(this,Te,gm).call(this),addEventListener("keydown",n=>J(this,Te,_m).call(this,n),!0)}toggle(){this.active?this.hide():this.show()}show(){this.active=!0,this.el.root.classList.remove("hidden"),this.el.hint.textContent=this.hooks.isMp()?"Çok oyunculuda oyun durmaz — ESC ile kapat":"ESC ile devam",this.el.vol.value=Math.round(this.hooks.sfx.volume*100),this.el.volVal.textContent=`${this.el.vol.value}%`,J(this,Te,Il).call(this),J(this,Te,Dl).call(this),J(this,Te,Ul).call(this)}hide(){this.active=!1,this.capture=null,this.el.root.classList.add("hidden")}setWeather(t){var n,s;const e=Ll.some(r=>r.id===t)?t:"acik";this.weather=e;try{localStorage.setItem(fm,e)}catch{}return J(this,Te,Dl).call(this),(s=(n=this.hooks).onWeather)==null||s.call(n,e),e}}Te=new WeakSet,pm=function(){for(const t of or){const e=document.createElement("button");e.textContent=t.label.replace("Kamera: ",""),e.dataset.mode=t.id,e.addEventListener("click",()=>{const n=this.hooks.getRig();for(;n.mode!==t.id;)n.cycle();J(this,Te,Il).call(this)}),this.el.cam.appendChild(e)}},Il=function(){var e;const t=(e=this.hooks.getRig())==null?void 0:e.mode;for(const n of this.el.cam.children)n.classList.toggle("on",n.dataset.mode===t)},mm=function(){const t=this.el.settings;if(!t)return;const e=document.createElement("span");e.className="mp-setlabel",e.textContent="Hava";const n=document.createElement("span");n.className="mp-seg",this.weatherButtons=[];for(const s of Ll){const r=document.createElement("button");r.textContent=s.label,r.dataset.weather=s.id,r.addEventListener("click",()=>this.setWeather(s.id)),n.appendChild(r),this.weatherButtons.push(r)}t.append(e,n),this.el.weather=n},Dl=function(){for(const t of this.weatherButtons??[])t.classList.toggle("on",t.dataset.weather===this.weather)},gm=function(){const t=this.el.keys,e=n=>{const s=document.createElement("span");s.className="mp-setlabel",s.textContent=n,t.appendChild(s)};e(""),e("Kırmızı (P1)"),e(""),e("Mavi (P2)"),this.keyButtons=[];for(const[n,s]of HE)for(const r of[Xi,Rr]){const o=document.createElement("span");o.className="mp-setlabel",o.textContent=n;const a=document.createElement("button");a.className="mp-small mp-ghost",a.addEventListener("click",()=>{this.capture={map:r,key:s,btn:a},a.textContent="…tuşa bas"}),this.keyButtons.push({map:r,key:s,btn:a}),t.append(o,a)}},Ul=function(){for(const{map:t,key:e,btn:n}of this.keyButtons)n.textContent=VE(t[e])},_m=function(t){this.capture&&(t.preventDefault(),t.stopPropagation(),t.code!=="Escape"&&(this.capture.map[this.capture.key]=t.code,HM()),this.capture=null,J(this,Te,Ul).call(this))};const vm=30,WE=1/vm,XE=5,$E=Math.round(XE*vm)+2,qo=10,_n=18,YE=13,qE=2.2,jE=.55,qd=4,me=(i,t,e)=>i+(t-i)*e;function KE(i,t,e){let n=t-i;return n>Math.PI?n-=2*Math.PI:n<-Math.PI&&(n+=2*Math.PI),i+n*e}function ZE(i,t,e){const{pos:n,vel:s,omega:r}=e;i[t]=n.x,i[t+1]=n.y,i[t+2]=n.z,i[t+3]=s.x,i[t+4]=s.y,i[t+5]=s.z,i[t+6]=r.x,i[t+7]=r.y,i[t+8]=r.z,i[t+9]=e.grounded?1:0}function xm(i,t,e){i[t]=e.pos.x,i[t+1]=e.pos.z,i[t+2]=e.vel.x,i[t+3]=e.vel.z,i[t+4]=e.facing,i[t+5]=e.down,i[t+6]=e.downTotal,i[t+7]=e.dive,i[t+8]=e.diveTotal,i[t+9]=e.diveKind==="slide"?1:0,i[t+10]=e.diveRecover,i[t+11]=e.diveDir.x,i[t+12]=e.diveDir.z,i[t+13]=e.jumpY,i[t+14]=e.kickAnim,i[t+15]=e.headerAnim,i[t+16]=e.charge,i[t+17]=e.tumbleSpin||0}class JE{constructor(t={}){this.cap=t.cap??$E,this.interval=t.interval??WE,this.times=new Float64Array(this.cap),this.ball=new Float32Array(this.cap*qo),this.players=new Float32Array(0),this.slots=0,this.head=0,this.count=0,this.lastT=0}reset(t=null){this.head=0,this.count=0,this.lastT=0;const e=t?t.players.length:this.slots;(e!==this.slots||this.players.length!==this.cap*e*_n)&&(this.slots=e,this.players=new Float32Array(this.cap*e*_n))}get frames(){return this.count}get seconds(){return this.count<2?0:this.times[this.index(this.count-1)]-this.times[this.index(0)]}index(t){return(this.head-this.count+t+this.cap*2)%this.cap}record(t){if(!t||t.puppet)return!1;t.players.length!==this.slots&&this.reset(t);const e=t.time;if(this.count>0){const r=e-this.lastT;if(r<0)this.reset(t);else if(r<this.interval-1e-4)return!1}const n=this.head;this.times[n]=e,ZE(this.ball,n*qo,t.ball);const s=n*this.slots*_n;for(let r=0;r<this.slots;r++)xm(this.players,s+r*_n,t.players[r]);return this.head=(n+1)%this.cap,this.count<this.cap&&this.count++,this.lastT=e,!0}makeReplay(t={}){if(this.count<qd)return null;const e=t.clip??qE,n=this.count-1,s=this.times[this.index(n)];let r=0;for(let o=n;o>=0;o--){if(s-this.times[this.index(o)]>e){r=o+1;break}r=o}return n-r+1<qd?null:new QE(this,r,n,t)}startReplay(t,e=null,n={}){const s=this.makeReplay(n);return s?(s.start(t,e),s):null}}class QE{constructor(t,e,n,s={}){this.rec=t,this.first=e,this.last=n,this.rate=s.rate??jE,this.label=s.label??"TEKRAR",this.camera=null,this.active=!1,this.t=0,this.cursor=e,this.t0=t.times[t.index(e)],this.duration=t.times[t.index(n)]-this.t0,this.wallDuration=this.rate>0?this.duration/this.rate:0,this.savedBall=new Float32Array(YE),this.savedPlayers=new Float32Array(t.slots*_n),this.chip=null,this.cam={x:-16,y:3.4,z:0,lx:0,ly:0,lz:0},this.follow={x:0,y:0,z:0}}start(t,e=null){if(this.active)return this;this.camera=e??null,this.saveLive(t),t.puppet=!0,this.active=!0,this.t=0,this.cursor=this.first,this.apply(t,0);const n=t.ball;return n.prev.x=n.pos.x,n.prev.y=n.pos.y,n.prev.z=n.pos.z,this.follow.x=n.pos.x,this.follow.y=n.pos.y,this.follow.z=n.pos.z,this.aimCamera(0,!0),this.chip=eT(this.label),this}update(t,e=this.world){if(!this.active)return!1;const n=e??this.world;this.t+=t*this.rate;const s=this.t>=this.duration;return this.apply(n,Math.min(this.t,this.duration)),this.aimCamera(this.duration>0?Math.min(this.t/this.duration,1):1,!1),!s}stop(t=this.world){if(!this.active)return;const e=t??this.world;this.active=!1,e.puppet=!1,this.restoreLive(e),this.chip&&(this.chip.remove(),this.chip=null)}saveLive(t){this.world=t;const e=t.ball,n=this.savedBall;n[0]=e.pos.x,n[1]=e.pos.y,n[2]=e.pos.z,n[3]=e.prev.x,n[4]=e.prev.y,n[5]=e.prev.z,n[6]=e.vel.x,n[7]=e.vel.y,n[8]=e.vel.z,n[9]=e.omega.x,n[10]=e.omega.y,n[11]=e.omega.z,n[12]=e.grounded?1:0;const s=Math.min(this.rec.slots,t.players.length);for(let r=0;r<s;r++)xm(this.savedPlayers,r*_n,t.players[r])}restoreLive(t){const e=t.ball,n=this.savedBall;e.pos.x=n[0],e.pos.y=n[1],e.pos.z=n[2],e.prev.x=n[3],e.prev.y=n[4],e.prev.z=n[5],e.vel.x=n[6],e.vel.y=n[7],e.vel.z=n[8],e.omega.x=n[9],e.omega.y=n[10],e.omega.z=n[11],e.grounded=n[12]>.5,e.contacts.length=0;const s=Math.min(this.rec.slots,t.players.length);for(let r=0;r<s;r++)this.writeBackPlayer(t.players[r],this.savedPlayers,r*_n)}writeBackPlayer(t,e,n){t.pos.x=e[n],t.pos.z=e[n+1],t.vel.x=e[n+2],t.vel.z=e[n+3],t.facing=e[n+4],t.down=e[n+5],t.downTotal=e[n+6]||t.downTotal,t.dive=e[n+7],t.diveTotal=e[n+8]||t.diveTotal,t.diveKind=e[n+9]>.5?"slide":"dive",t.diveRecover=e[n+10],t.diveDir.x=e[n+11],t.diveDir.z=e[n+12],t.jumpY=e[n+13],t.kickAnim=e[n+14],t.headerAnim=e[n+15],t.charge=e[n+16],t.tumbleSpin=e[n+17]}apply(t,e){const n=this.rec;let s=this.cursor;for(s<this.first&&(s=this.first);s<this.last&&n.times[n.index(s+1)]-this.t0<=e;)s++;this.cursor=s;const r=Math.min(s+1,this.last),o=n.times[n.index(s)]-this.t0,a=n.times[n.index(r)]-this.t0;let c=a>o?(e-o)/(a-o):0;c<0?c=0:c>1&&(c=1);const l=n.ball,h=n.index(s)*qo,u=n.index(r)*qo,d=t.ball;d.prev.x=d.pos.x,d.prev.y=d.pos.y,d.prev.z=d.pos.z,d.pos.x=me(l[h],l[u],c),d.pos.y=me(l[h+1],l[u+1],c),d.pos.z=me(l[h+2],l[u+2],c),d.vel.x=me(l[h+3],l[u+3],c)*this.rate,d.vel.y=me(l[h+4],l[u+4],c)*this.rate,d.vel.z=me(l[h+5],l[u+5],c)*this.rate,d.omega.x=me(l[h+6],l[u+6],c)*this.rate,d.omega.y=me(l[h+7],l[u+7],c)*this.rate,d.omega.z=me(l[h+8],l[u+8],c)*this.rate,d.grounded=(c<.5?l[h+9]:l[u+9])>.5;const f=n.players,g=n.slots,_=n.index(s)*g*_n,m=n.index(r)*g*_n,p=Math.min(g,t.players.length);for(let x=0;x<p;x++){const M=t.players[x],v=_+x*_n,L=m+x*_n;M.pos.x=me(f[v],f[L],c),M.pos.z=me(f[v+1],f[L+1],c),M.vel.x=me(f[v+2],f[L+2],c)*this.rate,M.vel.z=me(f[v+3],f[L+3],c)*this.rate,M.facing=KE(f[v+4],f[L+4],c),M.down=me(f[v+5],f[L+5],c),M.downTotal=f[v+6]||M.downTotal,M.dive=me(f[v+7],f[L+7],c),M.diveTotal=f[v+8]||M.diveTotal,M.diveKind=(c<.5?f[v+9]:f[L+9])>.5?"slide":"dive",M.diveRecover=me(f[v+10],f[L+10],c),M.diveDir.x=me(f[v+11],f[L+11],c),M.diveDir.z=me(f[v+12],f[L+12],c),M.jumpY=me(f[v+13],f[L+13],c),M.kickAnim=me(f[v+14],f[L+14],c),M.headerAnim=me(f[v+15],f[L+15],c),M.charge=me(f[v+16],f[L+16],c),M.tumbleSpin=me(f[v+17],f[L+17],c),M.input.x=0,M.input.z=0}}aimCamera(t,e){const n=this.cam,s=this.world?this.world.ball.pos:null;if(s){const u=e?1:.12;this.follow.x+=(s.x-this.follow.x)*u,this.follow.y+=(s.y-this.follow.y)*u,this.follow.z+=(s.z-this.follow.z)*u}const r=this.follow,o=Math.sign(r.z)||1,a=-(14.5-4.5*t)+r.x*.3,c=3.5-1.4*t,l=r.z*.55+o*(8.5-3.5*t),h=e?1:.09;n.x+=(a-n.x)*h,n.y+=(c-n.y)*h,n.z+=(l-n.z)*h,n.lx+=(r.x-n.lx)*(e?1:.18),n.ly+=(r.y+.25-n.ly)*(e?1:.18),n.lz+=(r.z-n.lz)*(e?1:.18),this.camera&&(this.camera.position.set(n.x,n.y,n.z),this.camera.lookAt(n.lx,n.ly,n.lz))}}const jd="replay-chip-style",tT=`
#replayChip { position: fixed; z-index: 12; left: 22px; bottom: 20px;
  display: flex; align-items: center; gap: 9px; pointer-events: none;
  background: rgba(8, 14, 30, .62); backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 210, 87, .35); border-radius: 999px;
  padding: 8px 18px 8px 14px; color: #ffd257;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 15px; font-weight: 800; letter-spacing: 2px; }
#replayChip i { width: 9px; height: 9px; border-radius: 50%; background: #ff5468;
  box-shadow: 0 0 10px #ff5468; animation: replayBlink 1s steps(1) infinite; }
@keyframes replayBlink { 50% { opacity: .15; } }`;function eT(i){if(typeof document>"u"||!document.body)return null;if(!document.getElementById(jd)){const n=document.createElement("style");n.id=jd,n.textContent=tT,document.head.appendChild(n)}const t=document.createElement("div");t.id="replayChip";const e=document.createElement("i");return t.appendChild(e),t.appendChild(document.createTextNode(i)),document.body.appendChild(t),t}const{renderer:nT,scene:li,camera:jo}=qS(document.getElementById("app")),Nl=new MM(li),oa=new OM(li),Qe={scoreRed:document.getElementById("scoreRed"),scoreBlue:document.getElementById("scoreBlue"),timer:document.getElementById("timer"),msg:document.getElementById("msg"),menu:document.getElementById("menu"),end:document.getElementById("end"),endTitle:document.getElementById("endTitle"),endScore:document.getElementById("endScore"),btn1p:document.getElementById("btn1p"),btn2p:document.getElementById("btn2p"),btnAgain:document.getElementById("btnAgain")},dt={};function iT(){var i,t,e;(i=dt.goalFrames)==null||i.dispose(),(t=dt.netView)==null||t.dispose(),(e=dt.ballView)==null||e.dispose();for(const n of dt.playerViews??[])n.dispose();for(const n of dt.aimViews??[])n.dispose()}function $i(i,t=null,e={}){if(iT(),dt.config=i,dt.goalFrames=$S(li,i),dt.world=new ig(i),e.mp==="guest"){dt.game=new OE(dt.world,jo,Qe,e.myId);for(const s of t){const r=dt.world.addPlayer(s.team,s.role??"field");r.mpId=s.id,r.mpName=s.name??""}dt.game.registerPlayers()}else dt.game=new hb(dt.world,jo,Qe,t);const n=s=>{var r,o,a;Vn.notify(s,dt.world.ball.pos),s.type==="goal"?(Nl.onGoal(s.scorer),Vn.play("goal"),oa.onGoal(s.scorer,Math.sign(dt.world.ball.pos.z)||(s.scorer===0?1:-1)),(r=dt.game.rig)==null||r.shake(.5)):s.type==="post"||s.type==="crossbar"?(Nl.onNearMiss(),Vn.play("post"),Vn.play("ooh"),(o=dt.game.rig)==null||o.shake(.25)):s.type==="kick"?Vn.play("kick"):s.type==="ragdoll"?(Vn.play("thud"),(a=dt.game.rig)==null||a.shake(.15)):(s.type==="throwin"||s.type==="goalkick"||s.type==="corner")&&Vn.play("whistle")};return dt.game.onWorldEvent=(s,r)=>{r&&n(s)},e.mp==="guest"&&(dt.game.onSnapEvent=n),dt.netView=new JS(dt.world.nets,li),dt.ballView=new tM(dt.world.ball,li),dt.playerViews=dt.world.players.map(s=>new oM(s,li,i.teamColors)),dt.aimViews=dt.world.players.filter(s=>s.role==="field").map(s=>new aM(s,dt.world,li)),Ol.reset(dt.world),window.__game={...dt,session:We},dt}const We=new kE({buildMatch:$i,backToLocal:()=>{$i(Ln()),Qe.btnAgain.textContent="Tekrar Oyna",Qe.end.classList.add("hidden"),Qe.menu.classList.remove("hidden")}},Qe),Ol=new JE;let ai=null,fc=!1;$i(Ln());Qe.btn1p.addEventListener("click",()=>{We.inMatch||($i(Ln()),dt.game.startMatch("1p"))});Qe.btn2p.addEventListener("click",()=>{We.inMatch||($i(Ln()),dt.game.startMatch("2p"))});document.getElementById("btnTrain").addEventListener("click",()=>{We.inMatch||($i(Ln(),[{id:"p1",team:0,role:"field"},{id:"kr",team:0,role:"keeper"},{id:"kb",team:1,role:"keeper"}]),dt.game.startMatch("train"))});Qe.btnAgain.addEventListener("click",()=>{We.active&&We.inMatch?We.backToLobbyAfterMatch():dt.game.startMatch(dt.game.mode??"1p")});addEventListener("keydown",i=>{var e;if(i.code!=="KeyV")return;const t=(e=dt.game.rig)==null?void 0:e.cycle();t&&dt.game.showMessage(t,"hazir",900)});const Vn=new FE,Tr=new GE({getRig:()=>dt.game.rig,sfx:Vn,isMp:()=>We.inMatch,onWeather:i=>oa.setWeather(i),onExit:()=>{We.active&&We.leave(),$i(Ln()),Qe.end.classList.add("hidden"),Qe.menu.classList.remove("hidden")}});oa.setWeather(Tr.weather);addEventListener("keydown",i=>{i.code!=="Escape"||!Qe.menu.classList.contains("hidden")&&!Tr.active||Tr.toggle()});let Ko=performance.now()/1e3,Ds=0;function ym(i){requestAnimationFrame(ym);const t=i/1e3,e=Math.min(t-Ko,.05);Ko=t;const n=Tr.active&&!We.inMatch;Ds+=e;let s=0;for(;Ds>=di&&s<4;)n||dt.world.step(di*dt.game.timeScale),Ds-=di,s++;if(!n){if(dt.game.state==="play"&&!We.inMatch&&Ol.record(dt.world),dt.game.state==="goal"&&!ai&&!fc&&t>dt.game.goalResetAt-.2){const o=dt.world.lastShot,a=Math.sign(dt.world.ball.pos.z)*18;(o?Math.hypot(o.x,a-o.z):0)>9.5&&(ai=Ol.startReplay(dt.world,jo)),fc=!0}ai?ai.update(e)||(ai.stop(dt.world),ai=null,dt.game.goalResetAt=t):(dt.game.update(e,t),We.frameHook(e)),dt.game.state!=="goal"&&(fc=!1)}Vn.setAmbiance(n||!Qe.menu.classList.contains("hidden")?0:1),dt.netView.update(),dt.ballView.update(e*dt.game.timeScale);for(const o of dt.playerViews)o.update(e);Nl.update(e,t),oa.update(e);const r=dt.game.state==="play"||dt.game.state==="kickoff";for(const o of dt.aimViews)o.update(r&&dt.game.isHuman(o.player)&&!ai);nT.render(li,jo)}requestAnimationFrame(ym);const sT=new Worker(URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 50);"],{type:"text/javascript"})));sT.onmessage=()=>{if(!document.hidden||Tr.active&&!We.inMatch||ai)return;const i=performance.now()/1e3,t=Math.min(i-Ko,.1);Ko=i,Ds+=t;let e=0;for(;Ds>=di&&e<4;)dt.world.step(di*dt.game.timeScale),Ds-=di,e++;dt.game.update(t,i),We.frameHook(t)};const rT="modulepreload",oT=function(i){return"/goal-net/"+i},Kd={},aT=function(t,e,n){let s=Promise.resolve();if(e&&e.length>0){let o=function(l){return Promise.all(l.map(h=>Promise.resolve(h).then(u=>({status:"fulfilled",value:u}),u=>({status:"rejected",reason:u}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),c=(a==null?void 0:a.nonce)||(a==null?void 0:a.getAttribute("nonce"));s=o(e.map(l=>{if(l=oT(l),l in Kd)return;Kd[l]=!0;const h=l.endsWith(".css"),u=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${u}`))return;const d=document.createElement("link");if(d.rel=h?"stylesheet":rT,h||(d.as="script"),d.crossOrigin="",d.href=l,c&&d.setAttribute("nonce",c),document.head.appendChild(d),h)return new Promise((f,g)=>{d.addEventListener("load",f),d.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(o){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=o,window.dispatchEvent(a),!a.defaultPrevented)throw o}return s.then(o=>{for(const a of o||[])a.status==="rejected"&&r(a.reason);return t().catch(r)})};location.search.includes("lobbydemo")&&aT(()=>Promise.resolve().then(()=>SE),void 0);
