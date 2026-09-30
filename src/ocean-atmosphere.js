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
  constructor(day) {
    this.group = new THREE.Group();
    this.time = { value: 0 };
    // Detailed cloud formations come from the licensed panoramic sky dome.
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 150),
      new THREE.ShaderMaterial({
        uniforms: { time: this.time, fogColor: day.uniforms.fog },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: vertex,
        fragmentShader: /* glsl */ `
        uniform float time; uniform vec3 fogColor; varying vec2 vUv; ${noise}
        void main(){
          vec2 p=vUv-.5;
          float bank=fbm(vec3(vUv*vec2(9.,5.)+vec2(time*.009,0.),time*.015));
          float edge=smoothstep(0.,.18,vUv.x)*(1.-smoothstep(.8,1.,vUv.x))*sin(vUv.y*3.14159);
          float alpha=smoothstep(.28,.76,bank)*edge*.19;
          gl_FragColor=vec4(fogColor,alpha);
        }
      `,
      }),
    );
    fog.rotation.x = -Math.PI / 2;
    fog.position.set(0, 0.5, -75);
    this.group.add(fog);
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
    for (let i = 0; i < 6; i++) {
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
      bird.scale.setScalar(0.58 + (i % 3) * 0.12);
      this.group.add(bird);
      this.gulls.push(bird);
    }
  }
  update(time, motion) {
    this.time.value = time;
    this.gulls.forEach((bird, i) => {
      const t = time * (0.055 + i * 0.007) + i * 1.17;
      bird.position.set(
        Math.sin(t) * 21,
        13 + (i % 3) * 2.4 + Math.sin(time * 0.24 + i) * 1.1,
        -49 - Math.cos(t) * 10 - i * 3,
      );
      bird.rotation.y = -t + 0.8;
      bird.userData.wings.forEach((wing, j) => {
        wing.rotation.z =
          (j ? 1 : -1) * (0.1 + Math.sin(time * 2.2 + i * 1.7) * 0.36 * motion);
      });
    });
  }
}
