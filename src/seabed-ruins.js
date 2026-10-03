import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Three material batches keep a densely dressed, hand-composed ruin inexpensive.
export function createSeabedRuins(material, height) {
  const group = new THREE.Group();
  group.name = "sunken-colonnade";
  const batches = { stone: [], reef: [], coral: [] };
  let seed=4197;
  const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const place=(g, at, rotation=[0,0,0], scale=[1,1,1], kind="stone", hue) => {
    g.scale(...scale); g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.rotateZ(rotation[2]); g.translate(...at);
    const flat=g.index?g.toNonIndexed():g;
    if(flat!==g) g.dispose();
    flat.deleteAttribute("uv");
    const color=new THREE.Color(hue || (kind==="stone"?"#7caaa9":kind==="reef"?"#335f66":"#b37b82"));
    const positions=flat.attributes.position, colors=[];
    const variation=.75+rand()*.25;
    for(let i=0;i<positions.count;i++) {
      const relief=.86+.14*Math.sin(positions.getX(i)*1.7+positions.getY(i)*2.3+positions.getZ(i)*.8);
      colors.push(color.r*variation*relief,color.g*variation*relief,color.b*variation*relief);
    }
    flat.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    batches[kind].push(flat);
  };
  const block=(at,size,rot=[0,0,0])=>place(new THREE.BoxGeometry(...size),at,rot);
  const column=(x,z,h,r=1.25,lean=0) => {
    const y=height(x,z)-.2;
    block([x,y+.35,z],[r*3.2,.7,r*3.2]);
    block([x,y+.9,z],[r*2.65,.4,r*2.65]);
    const shaft=new THREE.CylinderGeometry(r*.82,r,h,40,Math.ceil(h*4));
    const p=shaft.attributes.position;
    for(let i=0;i<p.count;i++) {
      const angle=Math.atan2(p.getZ(i),p.getX(i));
      const course=(p.getY(i)+h*.5)/2.4;
      const seam=Math.exp(-Math.pow(Math.sin(course*Math.PI)*15,2))*.010;
      const scar=Math.max(0,Math.sin(angle*4+p.getY(i)*.9)*Math.cos(p.getY(i)*1.7-angle*2)-.52)*.035;
      const wear=1-.042*(.5+.5*Math.cos(angle*16))-.006*Math.sin(p.getY(i)*3+angle*5)-seam-scar;
      p.setX(i,p.getX(i)*wear); p.setZ(i,p.getZ(i)*wear);
      if(p.getY(i)>h*.49) p.setY(i,p.getY(i)-rand()*.45);
    }
    shaft.computeVertexNormals();
    place(shaft,[x,y+1+h/2,z],[0,0,lean]);
    for(const [dy,rr,thick] of [[1,r*1.1,.25],[h+.8,r*1.1,.36],[h+1.1,r*1.32,.3]])
      place(new THREE.CylinderGeometry(rr,rr,thick,24),[x-lean*h*.5,y+dy,z]);
    block([x-lean*h*.5,y+h+1.55,z],[r*2.9,.5,r*2.9],[0,.04,lean]);
  };
  // Cropped foreground columns, offset middle ranks, then distant monumental ruins.
  for(const args of [[-11,-7,21,1.65,.055],[12,-13,13,1.5,-.09],[-19,-28,25,1.5,-.025],
    [20,-32,28,1.65,.02],[-28,-55,32,1.85,.04],[8,-80,37,2,.02],[-15,-87,30,1.6,-.06],
    [34,-77,35,2.1,.035],[-39,-98,40,2.3,.03]]) column(...args);

  // A broken temple on the right bank: stepped podium, open colonnade and lintels.
  const tx=27,tz=-58,base=height(tx,tz);
  for(let i=0;i<5;i++) block([tx,base+i*.55,tz+i*.42],[20-i*.7,.6,14-i*.5]);
  for(const x of [20,27,34]) for(const z of [-62,-54]) column(x,z,18+(x===34?2:0),1.45,.018);
  for(let i=0;i<3;i++) block([tx,base+21+i*.48,tz],[21+i*.75,.45,14+i*.6],[0,0,-.012]);
  // Weathered triangular pediment made from individually displaced masonry.
  for(let row=0;row<4;row++) for(let i=0;i<7-row*2;i++)
    block([tx+(i-(6-row*2)/2)*2.7,base+23+row*.85,tz+7],[2.55,.8,1.2],[0,(rand()-.5)*.06,(rand()-.5)*.045]);
  // An incomplete arch frames the sandy approach on the opposite side.
  const ax=-29,az=-49,ay=height(ax,az);
  for(const dx of [-5,5]) column(ax+dx,az,12,1.25,dx<0?.04:-.035);
  for(let i=0;i<12;i++) {
    if(i===3||i===4) continue;
    const a=i/11*Math.PI;
    block([ax+5*Math.cos(a),ay+13+5*Math.sin(a),az],[1.5,2.1,2.8],[0,0,a-Math.PI/2]);
  }
  // Fallen shafts and scattered blocks sit into the banks, not across the clear path.
  for(let i=0;i<145;i++) {
    const side=rand()<.5?-1:1, z=5-rand()*90;
    const x=side*(7+rand()*34), y=height(x,z);
    const s=.35+rand()**2*1.65;
    block([x,y+s*.25,z],[s*1.6,s*.8,s],[rand()*.6,rand()*6.28,rand()*.35]);
  }
  for(const [x,z,a] of [[-10,-18,.8],[15,-27,-.5],[-22,-48,1.6]])
    place(new THREE.CylinderGeometry(.9,1.1,8,20,5),[x,height(x,z)+.8,z],[Math.PI/2,0,a]);

  // Coarse crags carry many small plate corals: large geology, small living detail.
  for(let i=0;i<68;i++) {
    const side=i%2?1:-1, z=8-rand()*80;
    const x=side*(8+rand()*25), y=height(x,z);
    const s=1+rand()*2.5;
    const g=new THREE.SphereGeometry(1,20,14);
    const p=g.attributes.position;
    for(let j=0;j<p.count;j++) {
      const k=1+.14*Math.sin(p.getX(j)*5+p.getZ(j)*4)*Math.cos(p.getY(j)*4-p.getX(j)*2)
        +.06*Math.sin(p.getZ(j)*9+p.getY(j)*6);
      p.setXYZ(j,p.getX(j)*k,p.getY(j)*k,p.getZ(j)*k);
    }
    g.computeVertexNormals();
    place(g,[x,y+s*.12,z],[rand()*.3,rand()*6.28,rand()*.2],[s,s*.65,s*1.25],"reef");
    for(let j=0;j<5;j++) {
      const a=rand()*6.28, rr=s*(.4+rand()*.4), h=.2+j*.18;
      const plate=new THREE.SphereGeometry(1,14,6,0,Math.PI*2,0,Math.PI*.6);
      const size=.23+rand()*.55;
      place(plate,[x+Math.cos(a)*rr,y+s*.5+h,z+Math.sin(a)*rr],[.1,rand()*6.28,(rand()-.5)*.4],
        [size,.07,size*.8],"coral",["#c69c86","#ac7989","#648d94","#d1b391"][j%4]);
    }
  }
  // Fine branching sea fans, intentionally small relative to the ancient columns.
  for(let colony=0;colony<36;colony++) {
    const side=colony%2?1:-1, x=side*(6+rand()*24),z=3-rand()*62,y=height(x,z);
    const size=.6+rand()*.8, angle=rand()*Math.PI;
    for(let branch=0;branch<9;branch++) {
      const a=-1.15+branch*.287;
      const pts=[[0,0,0],[Math.sin(a)*.3,.4,0],[Math.sin(a)*size,.6+Math.cos(a)*size,.07]];
      const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
      place(new THREE.TubeGeometry(curve,7,.028,4,false),[x,y,z],[0,angle,0],[1,1,1],"coral","#b67f92");
      for(let t=1;t<4;t++) {
        const start=curve.getPoint(t/4),end=start.clone().add(new THREE.Vector3((branch%2?1:-1)*.24,.28,0));
        place(new THREE.TubeGeometry(new THREE.LineCurve3(start,end),1,.014,3,false),[x,y,z],[0,angle,0],[1,1,1],"coral","#b67f92");
      }
    }
  }
  for(const [kind,parts] of Object.entries(batches)) {
    const geometry=mergeGeometries(parts); parts.forEach(g=>g.dispose());
    const m=material("#ffffff"); m.vertexColors=true;
    const mesh=new THREE.Mesh(geometry,m); mesh.name=`ruin-${kind}`; group.add(mesh);
  }
  return group;
}

export function createSeabedShafts(day,time,reveal) {
  const geometries=[];
  for(const [x,z,w,tilt] of [[-17,-29,8,-.25],[4,-54,13,-.25],[25,-72,16,-.23],[-31,-86,11,-.3]]) {
    const g=new THREE.PlaneGeometry(w,74); g.rotateZ(tilt);g.translate(x,8,z);geometries.push(g);
  }
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{time,reveal,daylight:day.uniforms.daylight},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time,reveal,daylight;varying vec2 vUv;
      void main(){float x=vUv.x-.5+sin(vUv.y*5.+time*.24)*.025;
      float core=exp(-x*x*34.);float strands=.65+.35*sin(x*36.+sin(vUv.y*7.+time*.4));
      float ends=smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.8,1.,vUv.y));
      gl_FragColor=vec4(.24,.65,.76,core*strands*ends*.11*reveal*daylight);}`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name="seabed-light-shafts";mesh.renderOrder=5;return mesh;
}
