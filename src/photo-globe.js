import * as THREE from "three";
import gsap from "gsap";
import { places, photographs } from "./photography.js";

export const EARTH_RADIUS = 2.7;
export function geoPoint(lat, lon, radius = EARTH_RADIUS) {
  const a = THREE.MathUtils.degToRad(lat),
    b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(a) * Math.cos(b) * radius,
    Math.sin(a) * radius,
    -Math.cos(a) * Math.sin(b) * radius,
  );
}
export function globeOrientation(lat, lon) {
  return new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(lat))
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(-90 - lon),
      ),
    );
}
const ringsOf = (geometry) =>
  geometry.type === "MultiPolygon"
    ? geometry.coordinates
    : [geometry.coordinates];

export class PhotoGlobe {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.earthGroup = new THREE.Group();
    this.earthGroup.position.y = 3.5;
    this.group.add(this.earthGroup);
    this.earthGroup.quaternion.copy(globeOrientation(35, 105));
    this.selected = "all";
    this.zoom = { value: 0 };
    this.photoCards = [];
    this.regions = new Map();
    this.ready = false;
    this.material = new THREE.MeshStandardMaterial({
      color: "#a9c4c4",
      roughness: 0.84,
      metalness: 0.02,
      fog: false,
    });
    this.baseTone = new THREE.Color("#a9c4c4");
    this.detailTone = new THREE.Color("#293f48");
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 384, 192),
      this.material,
    );
    this.earthGroup.add(this.earth);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 64, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }`,
        fragmentShader: `varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.); gl_FragColor=vec4(.2,.6,1.,rim*.3); }`,
      }),
    );
    this.halo = halo;
    this.earthGroup.add(halo);
    this.fillLight = new THREE.DirectionalLight("#bfdcff", 2);
    this.fillLight.position.set(3, 5, 8);
    this.group.add(this.fillLight);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
  }
  async prepare(renderer) {
    const loader = new THREE.TextureLoader();
    const [map, data, ...photos] = await Promise.all([
      loader.loadAsync("/earth/blue-marble.png"),
      fetch("/earth/regions.json").then((r) => {
        if (!r.ok) throw Error("Region data unavailable");
        return r.json();
      }),
      ...photographs.map((p) =>
        p.image ? loader.loadAsync(p.image) : Promise.resolve(null),
      ),
    ]);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    this.material.map = map;
    this.material.needsUpdate = true;
    renderer.initTexture(map);
    for (const feature of data.features) this.addRegion(feature);
    photos.forEach((texture, i) => {
      if (!texture) {
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 640;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#132d35";
        ctx.fillRect(0, 0, 960, 640);
        ctx.strokeStyle = "#48646a";
        ctx.lineWidth = 2;
        ctx.strokeRect(35, 35, 890, 570);
        ctx.fillStyle = "#e5ded0";
        ctx.textAlign = "center";
        ctx.font = '400 64px "Microsoft YaHei",sans-serif';
        ctx.fillText(photographs[i].title, 480, 300);
        ctx.fillStyle = "#90a5a8";
        ctx.font = '400 25px "Microsoft YaHei",sans-serif';
        ctx.fillText("照片待添加", 480, 365);
        texture = new THREE.CanvasTexture(canvas);
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      renderer.initTexture(texture);
      const aspect = texture.image.width / texture.image.height,
        width = 2.8,
        height = width / aspect;
      const card = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.12, height + 0.23, 0.035),
        new THREE.MeshBasicMaterial({ color: "#f4f0e7", fog: false }),
      );
      const image = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          map: texture,
          fog: false,
          toneMapped: false,
        }),
      );
      image.position.set(0, 0.045, 0.025);
      card.add(frame, image);
      card.userData = { photo: photographs[i], visibility: 1 };
      image.userData.photo = photographs[i].id;
      frame.userData.photo = photographs[i].id;
      this.group.add(card);
      this.photoCards.push(card);
    });
    this.ready = true;
  }
  addRegion(feature) {
    const id = feature.properties.id;
    const group = new THREE.Group();
    group.visible = false;
    const lineMat = new THREE.LineBasicMaterial({
      color: "#ffda7c",
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const fillMat = new THREE.MeshBasicMaterial({
      color: "#ffd57d",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const allPoints = [];
    for (const polygon of ringsOf(feature.geometry)) {
      const contour = polygon[0].map(
        ([lon, lat]) => new THREE.Vector2(lon, lat),
      );
      const holes = polygon
        .slice(1)
        .map((r) => r.map(([lon, lat]) => new THREE.Vector2(lon, lat)));
      const flat = [...contour, ...holes.flat()];
      const triangles = THREE.ShapeUtils.triangulateShape(contour, holes);
      const coords = [];
      for (const face of triangles)
        for (const i of face)
          coords.push(
            ...geoPoint(flat[i].y, flat[i].x, EARTH_RADIUS + 0.00001).toArray(),
          );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(coords, 3),
      );
      const fill = new THREE.Mesh(geometry, fillMat);
      fill.renderOrder = 2;
      group.add(fill);
      for (const ring of polygon) {
        allPoints.push(...ring);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            ring.map(([lon, lat]) =>
              geoPoint(lat, lon, EARTH_RADIUS + 0.00002),
            ),
          ),
          lineMat,
        );
        line.renderOrder = 3;
        group.add(line);
      }
    }
    const minLon = Math.min(...allPoints.map((p) => p[0])),
      maxLon = Math.max(...allPoints.map((p) => p[0]));
    const minLat = Math.min(...allPoints.map((p) => p[1])),
      maxLat = Math.max(...allPoints.map((p) => p[1]));
    const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
    const extent = Math.max(
      maxLat - minLat,
      (maxLon - minLon) * Math.cos((center.lat * Math.PI) / 180),
    );
    this.regions.set(id, { group, lineMat, fillMat, ...center, extent });
    this.earthGroup.add(group);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#ffe0a2" }),
    );
    const place = places.find((p) => p.id === id);
    pin.position.copy(geoPoint(place.lat, place.lon, EARTH_RADIUS + 0.025));
    this.earthGroup.add(pin);
    group.userData.pin = pin;
  }
  view(placeId, mobile) {
    const region = this.regions.get(placeId);
    const aspect = innerWidth / innerHeight;
    const distance = region
      ? Math.max(
          0.014,
          (((THREE.MathUtils.degToRad(region.extent) * EARTH_RADIUS) /
            (2 * Math.tan((23 * Math.PI) / 180))) *
            1.45) /
            Math.min(1, aspect),
        )
      : mobile
        ? 21.5
        : 13;
    this.distance = distance;
    return region
      ? {
          x: 0,
          y: 3.5,
          z: EARTH_RADIUS + distance,
          tx: 0,
          ty: 3.5,
          tz: EARTH_RADIUS,
        }
      : { x: 0, y: 3.5, z: distance, tx: 0, ty: 3.5, tz: 0 };
  }
  select(placeId, reduced = false) {
    const place = places.find((p) => p.id === placeId) || places[0];
    const region = this.regions.get(place.id);
    this.selected = place.id;
    const duration = reduced ? 0 : 2.4;
    const from = this.earthGroup.quaternion.clone();
    const to = globeOrientation(
      region?.lat ?? place.lat,
      region?.lon ?? place.lon,
    );
    this.orientationTween?.kill();
    const progress = { value: 0 };
    this.orientationTween = gsap.to(progress, {
      value: 1,
      duration,
      ease: "power3.inOut",
      onUpdate: () =>
        this.earthGroup.quaternion.slerpQuaternions(from, to, progress.value),
    });
    gsap.to(this.zoom, {
      value: place.id === "all" ? 0 : 1,
      duration,
      ease: "power3.inOut",
      overwrite: true,
    });
    this.regions.forEach((r, id) => {
      r.group.visible = id === place.id;
      r.group.userData.pin.visible = place.id === "all";
      gsap.to(r.lineMat, {
        opacity: id === place.id ? 1 : 0,
        duration: reduced ? 0 : 1,
        delay: reduced ? 0 : 0.7,
        overwrite: true,
      });
      gsap.to(r.fillMat, {
        opacity: id === place.id ? 0.15 : 0,
        duration: reduced ? 0 : 1,
        delay: reduced ? 0 : 0.7,
        overwrite: true,
      });
    });
    this.photoCards.forEach((card) =>
      gsap.to(card.userData, {
        visibility:
          place.id === "all" || card.userData.photo.place === place.id ? 1 : 0,
        duration: reduced ? 0 : 0.5,
        overwrite: true,
      }),
    );
  }
  update(time, camera, motion, dragOffset = 0) {
    this.halo.visible = this.zoom.value < 0.8;
    this.material.color.lerpColors(
      this.baseTone,
      this.detailTone,
      this.zoom.value,
    );
    if (this.selected === "all" && !this.orientationTween?.isActive())
      this.earthGroup.quaternion.copy(
        globeOrientation(35, 105 + dragOffset * 12),
      );
    const mobile = innerWidth < 650;
    const d = Math.max(0.014, camera.position.z - EARTH_RADIUS);
    this.photoCards.forEach((card, i) => {
      const phase =
        time * 0.1 * motion + (i * Math.PI * 2) / this.photoCards.length + 0.15;
      const all = new THREE.Vector3(
        Math.cos(phase) * (mobile ? 3.1 : 3.8),
        3.5 - Math.sin(phase) * 1.35,
        Math.sin(phase) * 3.7,
      );
      const local = new THREE.Vector3(
        (mobile ? 0.07 : 0.19) * d +
          Math.sin(time * 0.17 * motion) * d * (mobile ? 0.006 : 0.02),
        3.5 - d * (mobile ? 0.1 : 0.14),
        EARTH_RADIUS + d * 0.22,
      );
      card.position.copy(all.lerp(local, this.zoom.value));
      const scale =
        THREE.MathUtils.lerp(
          mobile ? 0.78 : 1,
          d * (mobile ? 0.022 : 0.055),
          this.zoom.value,
        ) * card.userData.visibility;
      card.visible = scale > 0.00001;
      card.scale.setScalar(scale);
      card.lookAt(camera.position);
      card.rotateZ(Math.sin(time * 0.25 * motion + i) * 0.035);
    });
  }
  pick(x, y, camera) {
    this.ndc.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2);
    this.raycaster.setFromCamera(this.ndc, camera);
    // Include the globe so photographs behind it cannot be selected through it.
    const hits = this.raycaster.intersectObjects(
      [
        this.earth,
        ...this.photoCards.filter(
          (c) => c.visible && c.userData.visibility > 0.9,
        ),
      ],
      true,
    );
    return hits[0]?.object.userData.photo;
  }
}
