import * as THREE from "three";

const noise = /* glsl */ `
  float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float noise3(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);
  }
  float fbm(vec3 p) { return noise3(p)*.58+noise3(p*2.03)*.28+noise3(p*4.07)*.14; }
`;
const vertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

export class OceanAtmosphere {
  constructor() {
    this.group = new THREE.Group();
    this.time = { value: 0 };
    this.clouds = [];
    [
      [-65, 28, -135, 52, 18],
      [-8, 40, -165, 57, 24],
      [65, 31, -155, 62, 20],
      [-94, 52, -190, 48, 23],
      [35, 57, -210, 72, 25],
      [11, 15, -180, 34, 10],
    ].forEach(([x, y, z, w, h], i) => {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { time: this.time, seed: { value: i * 7.31 + 1.7 } },
          vertexShader: vertex,
          fragmentShader: /* glsl */ `
          uniform float time; uniform float seed; varying vec2 vUv;
          ${noise}
          float density(vec3 p) {
            float shape=-10.;
            for(int i=0;i<5;i++) {
              float n=float(i), r=hash(vec3(n,seed,1.));
              vec3 c=vec3(-.58+n*.29,-.18+r*.27,(r-.5)*.35);
              vec3 q=(p-c)/vec3(.28+r*.10,.27+r*.31,.5+r*.18);
              shape=max(shape,1.-length(q));
            }
            float detail=fbm(p*5.+vec3(seed,time*.013,0.));
            return smoothstep(-.12,.19,shape+(detail-.5)*.22);
          }
          void main() {
            vec3 p=vec3((vUv-.5)*2.,-1.); vec3 light=normalize(vec3(-.6,.8,-.4));
            vec3 color=vec3(0.); float alpha=0.;
            for(int i=0;i<12;i++) {
              p.z=-1.+float(i)*.17;
              float d=density(p);
              float illumination=clamp(.62+(d-density(p+light*.22))*1.5,0.,1.);
              vec3 lit=mix(vec3(.56,.70,.78),vec3(1.7,1.65,1.47),illumination);
              float a=d*.28;
              color+=(1.-alpha)*a*lit; alpha+=(1.-alpha)*a;
            }
            if(alpha<.008) discard;
            gl_FragColor=vec4(color/max(alpha,.001),alpha*.94);
          }
        `,
        }),
      );
      cloud.position.set(x, y, z);
      cloud.userData.baseX = x;
      cloud.userData.phase = i;
      this.clouds.push(cloud);
      this.group.add(cloud);
    });
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 150),
      new THREE.ShaderMaterial({
        uniforms: { time: this.time },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: vertex,
        fragmentShader: /* glsl */ `
        uniform float time; varying vec2 vUv; ${noise}
        void main(){
          vec2 p=vUv-.5;
          float bank=fbm(vec3(vUv*vec2(9.,5.)+vec2(time*.009,0.),time*.015));
          float edge=smoothstep(0.,.18,vUv.x)*(1.-smoothstep(.8,1.,vUv.x))*sin(vUv.y*3.14159);
          float alpha=smoothstep(.28,.76,bank)*edge*.19;
          gl_FragColor=vec4(.78,.88,.88,alpha);
        }
      `,
      }),
    );
    fog.rotation.x = -Math.PI / 2;
    fog.position.set(0, 0.5, -75);
    this.group.add(fog);
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(9 + i * 3, 52),
        new THREE.ShaderMaterial({
          uniforms: { time: this.time, phase: { value: i * 2.4 } },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          vertexShader: vertex,
          fragmentShader: /* glsl */ `
          uniform float time; uniform float phase; varying vec2 vUv;
          void main(){
            float x=(vUv.x-.5)/(.25+.75*(1.-vUv.y));
            float shaft=exp(-x*x*12.)*sin(vUv.y*3.14159);
            float shimmer=.72+.28*sin(vUv.y*9.-time*.3+phase);
            gl_FragColor=vec4(1.,.89,.65,shaft*shimmer*.16);
          }
        `,
        }),
      );
      beam.position.set(-21 + i * 7, 19, -77 - i * 7);
      beam.rotation.z = -0.37 + i * 0.06;
      this.group.add(beam);
    }
    this.gulls = [];
    const white = new THREE.MeshStandardMaterial({
      color: "#faf9ef",
      roughness: 0.85,
    });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0, 0.6, 0.08, 0, 1.1, -0.06, 0.04, 0, 0, 0, 1.1, -0.06, 0.04,
          0.38, -0.11, 0.17,
        ],
        3,
      ),
    );
    wingGeo.computeVertexNormals();
    const wingMat = new THREE.MeshStandardMaterial({
      color: "#f9fcf6",
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0.78, 0.015, 0.025, 1.1, -0.06, 0.04, 0.79, -0.06, 0.075],
        3,
      ),
    );
    tipGeo.computeVertexNormals();
    const tipMat = new THREE.MeshStandardMaterial({
      color: "#465664",
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    for (let i = 0; i < 3; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), white);
      body.scale.set(0.1, 0.12, 0.35);
      bird.add(body);
      const wings = [];
      for (const sign of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.add(new THREE.Mesh(tipGeo, tipMat));
        wing.scale.x = sign;
        wings.push(wing);
        bird.add(wing);
      }
      bird.userData.wings = wings;
      bird.scale.setScalar(0.62 + i * 0.1);
      this.group.add(bird);
      this.gulls.push(bird);
    }
  }
  update(time, motion) {
    this.time.value = time;
    this.clouds.forEach((cloud, i) => {
      cloud.position.x =
        cloud.userData.baseX + Math.sin(time * 0.016 + i * 1.7) * 5 * motion;
    });
    this.gulls.forEach((bird, i) => {
      const t = time * 0.075 + i * 0.62;
      bird.position.set(
        Math.sin(t) * 21,
        16 + i * 1.25 + Math.sin(time * 0.24 + i) * 0.65,
        -60 - Math.cos(t) * 10 - i * 5,
      );
      bird.rotation.y = -t + 0.8;
      bird.userData.wings.forEach((wing, j) => {
        wing.rotation.z =
          (j ? 1 : -1) * (0.1 + Math.sin(time * 2.2 + i * 1.7) * 0.36 * motion);
      });
    });
  }
}
