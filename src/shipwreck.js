import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Authored age-of-sail wreck: curved strakes, exposed frames, raised stern,
// broken spars and slack rigging. Geometry is batched by material, not per plank.
export function createShipwreck(material) {
  const group = new THREE.Group();
  group.name = "wooden-galleon-wreck";
  const batches = { wood: [], iron: [], rope: [], canvas: [] };
  let seed = 7303;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const add = (geometry, kind = "wood") => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute("uv");
    const value = kind === "wood" ? .65 + random() * .35 : 1;
    const colors = new Float32Array(g.attributes.position.count * 3).fill(value);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    batches[kind].push(g);
  };
  const box = (size, at, rotation = [0, 0, 0], kind = "wood") => {
    const g = new THREE.BoxGeometry(...size);
    g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.rotateZ(rotation[2]);
    g.translate(...at); add(g, kind);
  };
  const beam = (a, b, radius, kind = "wood", top = radius * .8) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(top, radius, delta.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray());
    add(g, kind);
  };
  const rope = (points, radius = .035) => add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 18, radius, 4, false), "rope");
  const breadth = x => 3.1 * Math.pow(Math.max(.001, Math.sin(Math.PI * ((x+11.5)/22) * .83)), .62);
  const sheer = x => .12 + Math.pow(Math.abs(x) / 11.5, 3) * 1.15;
  const hull = (x, angle, side) => [x, sheer(x) + 3.5 * (1-Math.cos(angle)), side * breadth(x) * Math.sin(angle)];
  const strip = (points) => {
    const vertices = [];
    for(let i=0;i<points.length-1;i++) {
      const [a,b]=points[i], [c,d]=points[i+1];
      vertices.push(...a,...b,...c,...b,...d,...c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    g.computeVertexNormals(); add(g);
  };

  // Separate planks leave fine seams. A large irregular breach opens the near side.
  for(const side of [-1,1]) for(let course=0;course<12;course++) {
    const a=.10+course*.123, b=a+.112;
    let points=[];
    for(let step=0;step<=88;step++) {
      const x=-11.5+step*.25;
      const breach=side===1 && course>3 && x>-4.5+(course%3)*.3 && x<.5+(course%4)*.4;
      const gunport=course>=9 && course<=10 && x>2 && x<8 && ((x-2)%2)<.72;
      const missingEnd=course>9 && x<-8.5 && step%7<2;
      if(breach || gunport || missingEnd) {
        if(points.length>1) strip(points);
        points=[]; continue;
      }
      points.push([hull(x,a,side),hull(x,b,side)]);
    }
    if(points.length>1) strip(points);
  }
  // Keel and ribs continue through the breach, showing the vessel's construction.
  beam([-11.3,.25,0],[10.3,.65,0],.23);
  for(let x=-10;x<=10;x+=1.3) for(const side of [-1,1]) {
    const length=(side===1 && x>-4.5 && x<2) ? 1.05+random()*.5 : 1.57;
    const points=Array.from({length:12},(_,i)=>hull(x,.10+i/11*length,side));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,.105,5,false));
  }
  // Broken deck boards; the missing centre exposes the hold rather than a solid lid.
  for(let z=-2.65;z<2.7;z+=.30) for(let x=-9;x<10;x+=2) {
    if(Math.abs(z)>breadth(x)*.88 || (x>-4 && x<2 && z>.1) || random()<.13) continue;
    box([1.96,.12,.27],[x+.8,3.42+sheer(x),z],[0,(random()-.5)*.015,0]);
  }
  for(let x=-8;x<9;x+=2.4) box([.16,.22,breadth(x)*1.8],[x,3.2+sheer(x),0]);
  // Quarterdeck and weathered transom give the distinctive high-stern silhouette.
  for(let j=0;j<6;j++) box([3.5,.29,4.25],[8.5,4.15+j*.30,-.05]);
  for(let z=-2.1;z<2.2;z+=.28) box([4.15,.14,.25],[8.05,6.0,z]);
  for(const side of [-1,1]) {
    beam([6,6.7,side*2.2],[10.2,6.7,side*2.2],.07);
    for(let x=6.2;x<10.3;x+=.5) beam([x,6,side*2.2],[x,6.7,side*2.2],.045);
    for(let x=3;x<9;x+=2) beam([x,3.5,side*1.7],[x,3.5,side*3.1],.15,"iron",.19);
  }
  for(let z=-1.7;z<1.8;z+=.83) {
    box([.06,.67,.52],[10.29,5.0,z],[0,0,0],"iron");
    box([.09,.055,.56],[10.34,5.0,z]);
    box([.09,.71,.045],[10.34,5.0,z]);
  }
  beam([-9.2,4,0],[-15.1,6.5,0],.18);
  rope([[-14.6,6.3,0],[-12,3.6,0],[-10,.8,0]]);

  // The main mast still stands, the foremast is snapped and the mizzen leans aft.
  const masts=[{base:[-6.5,1.4,0],tip:[-7.5,8.5,-.7],yard:6.8,width:3},
    {base:[1.4,1,0],tip:[.6,13.6,-.6],yard:10.4,width:4.3},
    {base:[7.4,3.6,0],tip:[9,10.6,.5],yard:8.9,width:2.6}];
  for(const m of masts) {
    beam(m.base,m.tip,.24,"wood",.095);
    const x=m.tip[0];
    beam([x-.6,m.yard,-m.width],[x+.6,m.yard-.45,m.width],.12,"wood",.075);
    for(const side of [-1,1]) {
      rope([m.tip,[x+1,m.yard*.6,side*1.2],[m.base[0]+2.3,3.6,side*2.6]]);
      rope([[x,m.yard,side*m.width],[x-1,m.yard-1.9,side*2],[m.base[0]-2,3.5,side*2.4]],.025);
    }
    // Rotted canvas hangs in narrow ragged sections from the surviving yards.
    const vertices=[];
    for(let i=0;i<16;i++) {
      if(i>5&&i<11) continue;
      const z0=-m.width+i*m.width/8, z1=z0+m.width/8;
      const length=.6+random()*1.8;
      const point=(z,y)=>[x+z*.14+Math.sin((m.yard-y)*1.2)*.30,y,z];
      const a=point(z0,m.yard-.1),b=point(z1,m.yard-.1),c=point(z0,m.yard-length),d=point(z1,m.yard-length*.7);
      vertices.push(...a,...b,...c,...b,...d,...c);
    }
    const cloth=new THREE.BufferGeometry();
    cloth.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));cloth.computeVertexNormals();add(cloth,"canvas");
  }
  rope([masts[0].tip,[-2,9,-.3],masts[1].tip]);
  rope([masts[1].tip,[5,10.5,.2],masts[2].tip]);
  // Fallen spar and scattered timbers settle into the sand around the hull.
  beam([-6,.4,3.8],[3,.3,6.5],.18);
  for(let i=0;i<18;i++) {
    const x=-7+random()*18,z=3+random()*3;
    box([1+random()*2.6,.1,.20],[x,.12,z],[0,random()*2,random()*.06]);
  }
  const palette={wood:"#766355",iron:"#273a38",rope:"#627468",canvas:"#9d9d88"};
  for(const [kind,pieces] of Object.entries(batches)) {
    const geometry=mergeGeometries(pieces); pieces.forEach(g=>g.dispose());
    const surface=material(palette[kind],0,0,kind==="wood"?1:0);
    surface.vertexColors=true;
    const mesh=new THREE.Mesh(geometry,surface); mesh.name=`wreck-${kind}`;
    group.add(mesh);
  }
  return group;
}
