import * as THREE from "three";

const metal = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.45,
    fog: false,
  });
const ivory = metal("#bac0c3"),
  graphite = metal("#3b4247");
const panel = new THREE.MeshBasicMaterial({ color: "#253139", fog: false });
function box(parent, size, position, material = ivory) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function solarPanel(parent, x, z, width, height) {
  box(parent, [width + 0.035, 0.018, height + 0.035], [x, 0, z], ivory);
  box(parent, [width, 0.024, height], [x, 0.012, z], panel);
  for (let i = 1; i < 6; i++)
    box(
      parent,
      [0.008, 0.027, height],
      [x - width / 2 + (width * i) / 6, 0.016, z],
      graphite,
    );
  for (let i = 1; i < 3; i++)
    box(
      parent,
      [width, 0.028, 0.008],
      [x, 0.016, z - height / 2 + (height * i) / 3],
      graphite,
    );
}
function cylinder(parent, radius, length, position) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12),
    ivory,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

export class SpaceDecor {
  constructor() {
    this.group = new THREE.Group();
    const positions = [],
      sizes = [],
      phases = [];
    for (let i = 0; i < 680; i++) {
      const random = (n) =>
        THREE.MathUtils.euclideanModulo(
          Math.sin(i * 17.43 + n * 47.12) * 43758.5453,
          1,
        );
      positions.push(
        (random(1) - 0.5) * 48,
        (random(2) - 0.5) * 34 + 3.5,
        -12 - random(3) * 26,
      );
      sizes.push(0.75 + random(4) * 1.7);
      phases.push(random(5) * Math.PI * 2);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    stars.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    stars.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
    this.time = { value: 0 };
    const starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { time: this.time },
      vertexShader: `attribute float size; attribute float phase; varying float alpha; uniform float time; void main(){ alpha=.4+.25*sin(phase+time*.35); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=size; }`,
      fragmentShader: `varying float alpha; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(.78,.82,.86,alpha*(1.-smoothstep(.12,.5,d))); }`,
    });
    this.stars = new THREE.Points(stars, starMaterial);
    this.group.add(this.stars);

    this.planets = [];
    [0.34, 0.52, 0.22].forEach((radius, i) => {
      const planet = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 20),
        new THREE.ShaderMaterial({
          uniforms: {
            tone: {
              value: new THREE.Color(["#8b9399", "#858078", "#59676c"][i]),
            },
          },
          vertexShader: `varying vec3 n; varying vec3 p; void main(){ n=normalize(normalMatrix*normal); p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
          fragmentShader: `uniform vec3 tone; varying vec3 n; varying vec3 p; void main(){ float bands=.9+.1*sin(p.y*50.+sin(p.x*21.)*.6); float light=.12+.8*pow(max(0.,dot(normalize(n),normalize(vec3(-.6,.7,.8)))),.8); gl_FragColor=vec4(tone*light*bands,1.); }`,
        }),
      );
      planet.add(sphere);
      if (i === 1) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.45, radius * 2.1, 96),
          new THREE.MeshBasicMaterial({
            color: "#77756f",
            transparent: true,
            opacity: 0.48,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
          }),
        );
        ring.rotation.x = 0.96;
        ring.rotation.y = 0.2;
        planet.add(ring);
      }
      this.group.add(planet);
      this.planets.push(planet);
    });
    this.satellite = new THREE.Group();
    box(this.satellite, [0.24, 0.22, 0.28], [0, 0, 0]);
    box(this.satellite, [1.25, 0.025, 0.025], [0, 0, 0], graphite);
    solarPanel(this.satellite, -0.47, 0, 0.53, 0.43);
    solarPanel(this.satellite, 0.47, 0, 0.53, 0.43);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.35),
      new THREE.MeshStandardMaterial({
        color: "#c4cacd",
        side: THREE.DoubleSide,
        roughness: 0.65,
        fog: false,
      }),
    );
    dish.position.y = 0.19;
    dish.rotation.z = -0.4;
    this.satellite.add(dish);
    box(this.satellite, [0.012, 0.25, 0.012], [0, 0.23, 0], graphite);
    this.group.add(this.satellite);

    this.station = new THREE.Group();
    box(this.station, [2.1, 0.045, 0.055], [0, 0, 0], graphite);
    cylinder(this.station, 0.095, 0.75, [0, 0, 0]);
    cylinder(this.station, 0.07, 0.42, [0.18, 0, 0.11]);
    cylinder(this.station, 0.065, 0.38, [-0.18, 0, -0.08]);
    for (const x of [-0.85, -0.46, 0.46, 0.85]) {
      solarPanel(this.station, x, -0.34, 0.28, 0.52);
      solarPanel(this.station, x, 0.34, 0.28, 0.52);
    }
    this.station.scale.setScalar(0.55);
    this.group.add(this.station);
    this.update(0, 1);
  }
  update(time, motion) {
    if (motion || this.frozenTime === undefined) this.frozenTime = time;
    const t = this.frozenTime;
    this.time.value = t;
    this.stars.rotation.y = Math.sin(t * 0.008) * 0.025;
    this.planets.forEach((p, i) => {
      const a = t * (0.016 + i * 0.007) + [2.3, 0.4, 4.2][i];
      p.position.set(
        Math.cos(a) * (7 + i),
        3.5 + Math.sin(a) * (4.8 - i * 0.6),
        -5 - Math.sin(a) * 3,
      );
      p.rotation.y = t * 0.025;
    });
    const a = t * 0.055 + 1.2;
    this.satellite.position.set(
      Math.cos(a) * 5.1,
      3.5 + Math.sin(a) * 2.9,
      Math.sin(a) * 2.5 - 1.2,
    );
    this.satellite.rotation.set(0.55 + Math.sin(a) * 0.2, -a, 0.2);
    const b = t * 0.029 + 3.7;
    this.station.position.set(
      Math.cos(b) * 5.8,
      3.5 + Math.sin(b) * 3.9,
      Math.sin(b) * 3 - 2,
    );
    this.station.rotation.set(0.5, b, -0.3);
  }
}
