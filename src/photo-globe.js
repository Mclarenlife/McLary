import * as THREE from "three";
import gsap from "gsap";
import { places, photographs } from "./photography.js";
import {
  countryTexture,
  contextTexture,
  createGlobeMaterial,
  regionInfo,
  regionTexture,
} from "./globe-surface.js";
import { SpaceDecor } from "./space-decor.js";

export const EARTH_RADIUS = 2.7;
export const ORBIT_RADIUS = 3.65;
export const PHOTO_WIDTH = 1.3;
const center = new THREE.Vector3(0, 3.5, 0);
const orbitUp = new THREE.Vector3(0, 1, 0.24).normalize();
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
export function orbitPose(angle) {
  const offset = new THREE.Vector3(
    Math.cos(angle),
    -Math.sin(angle) * 0.24,
    Math.sin(angle),
  )
    .normalize()
    .multiplyScalar(ORBIT_RADIUS);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(offset, new THREE.Vector3(), orbitUp),
  );
  return { position: offset.add(center), quaternion };
}
export function regionMagnification(region) {
  // Fit the full region inside the fixed sphere, including very small coastlines.
  return Math.max(0.00015, THREE.MathUtils.degToRad(region.extent) / 1.55);
}

export class PhotoGlobe {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.earthGroup = new THREE.Group();
    this.earthGroup.position.copy(center);
    this.group.add(this.earthGroup);
    this.earthGroup.quaternion.copy(globeOrientation(35, 105));
    this.selected = "all";
    this.zoom = { value: 0 };
    this.photoCards = [];
    this.regions = new Map();
    this.ready = false;
    this.material = createGlobeMaterial();
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 192, 96),
      this.material,
    );
    this.earth.renderOrder = 1;
    this.earthGroup.add(this.earth);
    this.decor = new SpaceDecor();
    this.group.add(this.decor.group);
    this.fillLight = new THREE.DirectionalLight("#d9e0e7", 1.1);
    this.fillLight.position.set(-3, 5, 8);
    this.group.add(this.fillLight);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointer = null;
    this.hovered = null;
    this.focused = null;
    this.orbitAngle = 0.8;
    this.interactionEnabled = false;
  }
  async prepare(renderer) {
    const loader = new THREE.TextureLoader();
    const loadJSON = async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw Error(`Gallery data unavailable: ${url}`);
      return response.json();
    };
    const [world, data, ...photos] = await Promise.all([
      loadJSON("/earth/countries.json"),
      loadJSON("/earth/regions.json"),
      ...photographs.map((p) =>
        p.image ? loader.loadAsync(p.image) : Promise.resolve(null),
      ),
    ]);
    const map = countryTexture(world.countries);
    renderer.initTexture(map);
    this.material.uniforms.worldMap.value = map;
    for (const feature of data.features) {
      const region = this.addRegion(feature);
      region.texture = regionTexture(feature, region.bounds);
      renderer.initTexture(region.texture);
      const context = world.contexts.find(
        (c) => c.id === feature.properties.id,
      );
      region.contextTexture = contextTexture(context);
      region.contextBounds = new THREE.Vector4(...context.bounds);
      renderer.initTexture(region.contextTexture);
    }
    this.material.uniforms.regionMap.value = this.regions
      .values()
      .next().value.texture;
    this.material.uniforms.contextMap.value = this.regions
      .values()
      .next().value.contextTexture;
    photos.forEach((texture, i) =>
      this.addPhoto(texture, photographs[i], renderer),
    );
    this.ready = true;
    this.select(this.selected, true);
  }
  addPhoto(texture, photo, renderer) {
    if (!texture) {
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#16181b";
      ctx.fillRect(0, 0, 960, 640);
      ctx.strokeStyle = "#383d42";
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, 890, 570);
      ctx.fillStyle = "#e2e4e5";
      ctx.textAlign = "center";
      ctx.font = '400 64px "Microsoft YaHei",sans-serif';
      ctx.fillText(photo.title, 480, 338);
      texture = new THREE.CanvasTexture(canvas);
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    renderer.initTexture(texture);
    const width = PHOTO_WIDTH,
      height = width / (texture.image.width / texture.image.height);
    const card = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.065, height + 0.095, 0.035),
      new THREE.MeshBasicMaterial({ color: "#c7cbcd", fog: false }),
    );
    const image = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        fog: false,
        toneMapped: false,
      }),
    );
    image.position.set(0, 0.012, 0.022);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: "#22272b", fog: false }),
    );
    back.position.z = -0.022;
    back.rotation.y = Math.PI;
    card.add(frame, image, back);
    card.userData = { photo, visibility: 1, hover: 0, width, height };
    for (const child of card.children) child.userData.photo = photo.id;
    this.group.add(card);
    this.photoCards.push(card);
  }
  addRegion(feature) {
    const region = { ...regionInfo(feature), feature, texture: null };
    this.regions.set(feature.properties.id, region);
    return region;
  }
  view(_placeId, mobile) {
    // Country selection changes only the map lens, never camera distance or globe size.
    return { x: 0, y: 3.5, z: mobile ? 21.5 : 13, tx: 0, ty: 3.5, tz: 0 };
  }
  select(placeId, reduced = false) {
    const place = places.find((p) => p.id === placeId) || places[0];
    const region = this.regions.get(place.id);
    this.selected = place.id;
    this.setHover(null);
    this.focused = null;
    this.selectionTween?.kill();
    const uniforms = this.material.uniforms;
    const from = this.earthGroup.quaternion.clone();
    const to = globeOrientation(
      region?.lat ?? place.lat,
      region?.lon ?? place.lon,
    );
    const direction = geoPoint(
      region?.lat ?? place.lat,
      region?.lon ?? place.lon,
      1,
    );
    const setRegion = () => {
      uniforms.focus.value.copy(direction);
      if (region?.texture) {
        uniforms.regionMap.value = region.texture;
        uniforms.regionBounds.value.copy(region.bounds);
        uniforms.contextMap.value = region.contextTexture;
        uniforms.contextBounds.value.copy(region.contextBounds);
      }
    };
    const targetScale = region ? regionMagnification(region) : 1;
    const progress = { value: 0 };
    if (reduced) {
      setRegion();
      this.earthGroup.quaternion.copy(to);
      uniforms.magnification.value = targetScale;
      uniforms.highlight.value = region ? 1 : 0;
      uniforms.detail.value = region ? 1 : 0;
      this.zoom.value = region ? 1 : 0;
    } else {
      // First release the internal lens, so rapid location changes cannot snap textures.
      const release = uniforms.magnification.value < 0.99 ? 0.7 : 0;
      this.selectionTween = gsap
        .timeline()
        .to(uniforms.highlight, { value: 0, duration: release || 0.15 }, 0)
        .to(
          uniforms.magnification,
          { value: 1, duration: release, ease: "power2.inOut" },
          0,
        )
        .call(setRegion, [], release)
        .to(
          progress,
          {
            value: 1,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () =>
              this.earthGroup.quaternion.slerpQuaternions(
                from,
                to,
                progress.value,
              ),
          },
          release,
        )
        .to(
          uniforms.magnification,
          { value: targetScale, duration: 2.1, ease: "power3.inOut" },
          release + 0.6,
        )
        .to(
          uniforms.detail,
          { value: region ? 1 : 0, duration: 1.8, ease: "power2.inOut" },
          release + 0.6,
        )
        .to(
          uniforms.highlight,
          { value: region ? 1 : 0, duration: 1.1 },
          release + 1.5,
        )
        .to(this.zoom, { value: region ? 1 : 0, duration: 2.1 }, release + 0.6);
    }
    this.photoCards.forEach((card) =>
      gsap.to(card.userData, {
        visibility:
          place.id === "all" || card.userData.photo.place === place.id ? 1 : 0,
        duration: reduced ? 0 : 0.5,
        overwrite: true,
      }),
    );
  }
  setPointer(x, y) {
    this.pointer = { x, y };
  }
  clearPointer() {
    this.pointer = null;
    if (!this.focused) this.setHover(null);
  }
  focusPhoto(id) {
    this.focused = id;
    this.setHover(id);
  }
  setHover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.hoverAnchor = null;
  }
  update(time, camera, motion, dragOffset = 0, delta = 1 / 60) {
    this.decor.update(time, motion);
    if (!this.ready) return;
    if (this.selected === "all" && !this.selectionTween?.isActive())
      this.earthGroup.quaternion.copy(
        globeOrientation(35, 105 + dragOffset * 12),
      );
    if (!this.interactionEnabled) {
      this.setHover(null);
      this.focused = null;
    }
    if (this.pointer && this.interactionEnabled && !this.focused) {
      const hit = this.pick(this.pointer.x, this.pointer.y, camera);
      const a = this.hoverAnchor;
      const insideAnchor =
        a &&
        this.pointer.x >= a.x0 &&
        this.pointer.x <= a.x1 &&
        this.pointer.y >= a.y0 &&
        this.pointer.y <= a.y1;
      if (hit) this.setHover(hit);
      else if (!insideAnchor) this.setHover(null);
    }
    if (!this.hovered) this.orbitAngle += delta * 0.115 * motion;
    const response = motion ? 1 - Math.exp(-7 * delta) : 1;
    this.photoCards.forEach((card, i) => {
      const pose = orbitPose(
        this.orbitAngle + (i * Math.PI * 2) / this.photoCards.length,
      );
      const targetHover = card.userData.photo.id === this.hovered ? 1 : 0;
      if (targetHover && !this.hoverAnchor)
        this.hoverAnchor = this.projectCard(card, camera);
      card.userData.hover = THREE.MathUtils.lerp(
        card.userData.hover,
        targetHover,
        response,
      );
      const h = card.userData.hover;
      const approach = camera.position.clone().sub(pose.position).normalize();
      card.position.copy(pose.position).addScaledVector(approach, h * 1.65);
      const front = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(camera.position, card.position, camera.up),
      );
      card.quaternion.copy(pose.quaternion).slerp(front, h);
      const scale = card.userData.visibility * (1 + h * 0.85);
      card.scale.setScalar(scale);
      card.visible = scale > 0.001;
    });
    this.group.updateMatrixWorld(true);
  }
  projectCard(card, camera) {
    const box = new THREE.Box3().setFromObject(card);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const point = new THREE.Vector3(x, y, z).project(camera);
          const px = ((point.x + 1) * innerWidth) / 2,
            py = ((1 - point.y) * innerHeight) / 2;
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
    return { x0: x0 - 8, y0: y0 - 8, x1: x1 + 8, y1: y1 + 8 };
  }
  pick(x, y, camera) {
    this.ndc.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2);
    camera.updateMatrixWorld();
    this.group.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.ndc, camera);
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
