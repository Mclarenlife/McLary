import * as THREE from "three";
import { OceanAtmosphere } from "./ocean-atmosphere.js";

export const BOAT_SCALE = 0.68;
export const boatPosition = (mobile) => ({ x: mobile ? 2.1 : 6.1, z: -4 });
export function oceanView(contact, mobile) {
  const boat = boatPosition(mobile);
  return contact
    ? {
        x: boat.x + 0.15 * BOAT_SCALE,
        y: 0.16 + (2.8 - 0.16) * BOAT_SCALE,
        z: boat.z + ((mobile ? 10.7 : 4.7) - boat.z) * BOAT_SCALE,
        tx: boat.x + 0.1 * BOAT_SCALE,
        ty: 0.16 + (2.35 - 0.16) * BOAT_SCALE,
        tz: boat.z,
      }
    : { x: 0, y: 8.4, z: 22, tx: 0, ty: 4.5, tz: -32 };
}

const canvasTexture = (canvas) => {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
};

// A single cloth surface keeps the ink attached to the sail as it breathes.
function sailPoint(u, v, time = 0) {
  return new THREE.Vector3(
    -0.7 + u * (1 - v) * 2.95,
    0.94 + v * 3.7,
    Math.sin(u * Math.PI) *
      Math.sin(v * Math.PI) *
      (0.2 + Math.sin(time * 1.3 + v * 3) * 0.045),
  );
}

export class OceanScene {
  constructor(email) {
    this.group = new THREE.Group();
    this.group.name = "Open ocean — sun, clouds and sailboat";
    this.reveal = { value: 0 };
    this.email = email;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#80bfdc") },
          horizon: { value: new THREE.Color("#f6eada") },
        },
        vertexShader: `varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 direction; void main(){ float y=normalize(direction).y; vec3 color=mix(horizon,top,smoothstep(-.02,.48,y)); gl_FragColor=vec4(color,1.); }`,
      }),
    );
    this.group.add(sky);
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 40, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.2, 2.7, 1.9),
        toneMapped: false,
        fog: false,
      }),
    );
    sun.position.set(-42, 29, -120);
    this.sun = sun;
    sun.material.dispose();
    sun.material = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }`,
      fragmentShader: `varying vec3 n; varying vec3 v; void main(){ float limb=pow(max(0.,dot(normalize(n),normalize(v))),.45); gl_FragColor=vec4(mix(vec3(1.8,1.1,.40),vec3(5.,4.2,2.8),limb),1.); }`,
    });
    this.group.add(sun);
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const glowCtx = glowCanvas.getContext("2d");
    const glow = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, "rgba(255,244,211,.78)");
    glow.addColorStop(0.12, "rgba(255,239,192,.60)");
    glow.addColorStop(0.36, "rgba(255,229,173,.23)");
    glow.addColorStop(1, "rgba(255,235,185,0)");
    glowCtx.fillStyle = glow;
    glowCtx.fillRect(0, 0, 128, 128);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTexture(glowCanvas),
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    halo.position.copy(sun.position);
    halo.scale.set(55, 55, 1);
    this.halo = halo;
    this.group.add(halo);

    this.atmosphere = new OceanAtmosphere();
    this.group.add(this.atmosphere.group);

    this.boat = new THREE.Group();
    this.boat.scale.setScalar(BOAT_SCALE);
    this.boat.name = "McLary sailboat";
    this.group.add(this.boat);
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-2.05, 0.43);
    hullShape.quadraticCurveTo(-1.8, -0.24, -1.2, -0.28);
    hullShape.lineTo(1.18, -0.28);
    hullShape.quadraticCurveTo(1.75, -0.1, 2.18, 0.43);
    hullShape.closePath();
    const hull = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hullShape, {
        depth: 0.85,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.09,
        bevelThickness: 0.09,
        steps: 1,
        curveSegments: 24,
      }),
      new THREE.MeshStandardMaterial({
        color: "#426c77",
        roughness: 0.47,
        metalness: 0.1,
      }),
    );
    hull.position.z = -0.425;
    hull.castShadow = hull.receiveShadow = true;
    this.boat.add(hull);
    const timber = new THREE.MeshStandardMaterial({
      color: "#b58d65",
      roughness: 0.74,
    });
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.65, 0.07, 0.87),
      timber,
    );
    deck.position.y = 0.43;
    this.boat.add(deck);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.045, 4.5, 12),
      timber,
    );
    mast.position.set(-0.72, 2.67, 0);
    this.boat.add(mast);
    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 2.99, 10),
      timber,
    );
    boom.rotation.z = Math.PI / 2;
    boom.position.set(0.73, 0.94, 0);
    this.boat.add(boom);

    this.clothCanvas = document.createElement("canvas");
    this.inkCanvas = document.createElement("canvas");
    for (const canvas of [this.clothCanvas, this.inkCanvas]) {
      canvas.width = 1536;
      canvas.height = 1536;
    }
    this.clothMap = canvasTexture(this.clothCanvas);
    this.inkMap = canvasTexture(this.inkCanvas);
    const sailMaterial = new THREE.MeshStandardMaterial({
      color: "#fff8e7",
      map: this.clothMap,
      side: THREE.DoubleSide,
      roughness: 0.88,
    });
    sailMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.contactInk = { value: this.inkMap };
      shader.uniforms.contactReveal = this.reveal;
      shader.fragmentShader =
        "uniform sampler2D contactInk; uniform float contactReveal;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\nvec4 ink = texture2D(contactInk, vMapUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a * contactReveal);",
        );
    };
    sailMaterial.customProgramCacheKey = () => "mclary-sail-ink-v1";
    this.sail = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 30, 40),
      sailMaterial,
    );
    const sailUV = this.sail.geometry.attributes.uv;
    this.sailCoordinates = sailUV.clone();
    for (let i = 0; i < sailUV.count; i++) {
      sailUV.setX(i, sailUV.getX(i) * (1 - sailUV.getY(i)));
    }
    this.sail.castShadow = true;
    this.boat.add(this.sail);
    const jibGeo = new THREE.BufferGeometry();
    jibGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-0.8, 4.32, -0.015, -2.1, 0.95, 0.02, -0.85, 0.95, 0.19],
        3,
      ),
    );
    jibGeo.computeVertexNormals();
    this.boat.add(
      new THREE.Mesh(
        jibGeo,
        new THREE.MeshStandardMaterial({
          color: "#ede6d7",
          roughness: 0.9,
          side: THREE.DoubleSide,
        }),
      ),
    );
    const ropes = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.05, 0.5, 0),
      new THREE.Vector3(-0.72, 4.92, 0),
      new THREE.Vector3(2.0, 0.5, 0),
    ]);
    this.boat.add(
      new THREE.Line(ropes, new THREE.LineBasicMaterial({ color: "#ded0b5" })),
    );
    this.setLayout(innerWidth < 650);
    this.update(0, 0);
  }

  setLayout(mobile) {
    const p = boatPosition(mobile);
    this.boat.position.x = p.x;
    this.boat.position.z = p.z;
    this.sun.position.x = mobile ? -14 : -42;
    this.halo.position.copy(this.sun.position);
  }

  prepare(renderer) {
    const ctx = this.clothCanvas.getContext("2d");
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, 1536, 1536);
    ctx.strokeStyle = "rgba(165,149,123,.22)";
    ctx.lineWidth = 2;
    for (let y = 60; y < 1536; y += 180) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1536, y);
      ctx.stroke();
    }
    ctx.strokeRect(14, 14, 1508, 1508);
    ctx.fillStyle = "#7c8179";
    ctx.font = 'italic 330px "Cormorant Garamond"';
    ctx.textAlign = "center";
    ctx.fillText("M.", 300, 670);
    const ink = this.inkCanvas.getContext("2d");
    ink.clearRect(0, 0, 1536, 1536);
    ink.fillStyle = "#283f49";
    ink.textAlign = "center";
    ink.font = '500 46px "DM Sans"';
    ink.fillText("LET’S MAKE SOMETHING GOOD", 580, 1105, 940);
    ink.fillStyle = "#081b23";
    ink.font = '500 88px "DM Sans"';
    ink.fillText(this.email || "Contact details coming soon", 600, 1245, 1050);
    this.clothMap.needsUpdate = this.inkMap.needsUpdate = true;
    renderer.initTexture(this.clothMap);
    renderer.initTexture(this.inkMap);
  }

  update(time, motion) {
    this.boat.position.y = 0.16 + Math.sin(time * 0.7) * 0.035 * motion;
    this.boat.rotation.set(
      Math.sin(time * 0.55) * 0.012 * motion,
      -0.16 + Math.sin(time * 0.3) * 0.015 * motion,
      Math.sin(time * 0.8) * 0.014 * motion,
    );
    const positions = this.sail.geometry.attributes.position,
      uv = this.sailCoordinates;
    for (let i = 0; i < positions.count; i++) {
      const p = sailPoint(uv.getX(i), uv.getY(i), time * motion);
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    positions.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();
    this.atmosphere.update(time, motion);
    this.halo.material.opacity = 0.92 + Math.sin(time * 0.19) * 0.035 * motion;
  }

  emailBounds(camera, width, height) {
    this.boat.updateWorldMatrix(true, true);
    const points = [
      [0.03, 0.14],
      [0.97, 0.14],
      [0.03, 0.29],
      [0.97, 0.29],
    ].map(([u, v]) => this.sail.localToWorld(sailPoint(u, v)).project(camera));
    const xs = points.map((p) => ((p.x + 1) * width) / 2),
      ys = points.map((p) => ((1 - p.y) * height) / 2);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }
}
