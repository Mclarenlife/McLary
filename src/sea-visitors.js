import * as THREE from "three";

function fin(points, material) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(...p)));
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
}
function ellipsoid(parent, material, scale, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function visitor(kind) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: kind === "turtle" ? "#315454" : "#163b4a",
    roughness: 0.76,
    metalness: 0.05,
    side: THREE.DoubleSide,
    fog: false,
  });
  const pale = new THREE.MeshStandardMaterial({
    color: "#4c7279",
    roughness: 0.85,
    fog: false,
  });
  const moving = [];
  if (kind === "turtle") {
    ellipsoid(group, material, [1.1, 0.4, 0.72]);
    ellipsoid(group, pale, [0.31, 0.21, 0.25], [1.15, -0.02, 0]);
    for (const side of [-1, 1]) {
      const flipper = ellipsoid(
        group,
        material,
        [0.62, 0.08, 0.19],
        [0.38, -0.1, side * 0.83],
      );
      flipper.rotation.y = side * 0.72;
      moving.push(flipper);
      const rear = ellipsoid(
        group,
        material,
        [0.38, 0.07, 0.14],
        [-0.82, -0.12, side * 0.6],
      );
      rear.rotation.y = -side * 0.65;
    }
    // The carapace has a domed rim and a restrained scute pattern.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.028, 6, 48), pale);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.05, 0.69, 1);
    group.add(rim);
  } else {
    const whale = kind === "whale";
    ellipsoid(group, material, whale ? [2.7, 0.83, 0.76] : [2.1, 0.46, 0.39]);
    ellipsoid(group, pale, whale ? [1.95, 0.2, 0.58] : [1.5, 0.13, 0.3], [
      0.28,
      -(whale ? 0.62 : 0.3),
      0,
    ]);
    const nose = ellipsoid(
      group,
      material,
      whale ? [0.85, 0.72, 0.69] : [0.7, 0.24, 0.23],
      [whale ? 2.05 : 1.9, 0.02, 0],
    );
    const tail = new THREE.Group();
    tail.position.x = whale ? -2.4 : -1.8;
    group.add(tail);
    moving.push(tail);
    const tailFin = fin(
      [
        [0, 0.16],
        [-0.8, whale ? 1.1 : 1.15],
        [-0.6, 0.1],
        [-0.9, -0.7],
        [0, -0.1],
      ],
      material,
    );
    if (whale) tailFin.rotation.x = Math.PI / 2;
    tail.add(tailFin);
    const dorsal = fin(
      [
        [0.25, 0],
        [-0.48, whale ? 0.6 : 0.94],
        [-0.82, 0],
      ],
      material,
    );
    dorsal.position.y = whale ? 0.59 : 0.35;
    group.add(dorsal);
    for (const side of [-1, 1]) {
      const pectoral = fin(
        [
          [0.65, 0],
          [-0.66, whale ? 1.45 : 1.05],
          [-0.17, 0],
        ],
        material,
      );
      pectoral.rotation.x = (side * Math.PI) / 2;
      pectoral.position.set(0.25, -0.2, side * 0.26);
      group.add(pectoral);
    }
    ellipsoid(
      group,
      new THREE.MeshBasicMaterial({ color: "#092732" }),
      [0.045, 0.045, 0.045],
      [whale ? 2.2 : 2, 0.13, 0.36],
    );
  }
  group.userData = { kind, moving };
  return group;
}

export class SeaVisitors {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.creatures = ["whale", "shark", "turtle"].map((kind) => visitor(kind));
    this.creatures.forEach((creature) => {
      creature.visible = false;
      this.group.add(creature);
    });
  }
  update(delta) {
    this.time += delta;
    const cycle = this.time % 86;
    this.creatures.forEach((creature, i) => {
      const start = [4, 32, 57][i],
        duration = [23, 19, 23][i];
      const progress = (cycle - start) / duration;
      creature.visible = progress >= 0 && progress <= 1;
      if (!creature.visible) return;
      const direction = i === 1 ? -1 : 1;
      creature.position.set(
        (-37 + progress * 74) * direction,
        [15.6, 12.6, 11.6][i] + Math.sin(progress * Math.PI * 2) * 1.3,
        [-29, -17, -13][i],
      );
      creature.rotation.set(
        i === 2 ? 0.35 : 0.02,
        direction === 1 ? -0.16 : Math.PI + 0.16,
        Math.cos(progress * Math.PI * 2) * 0.05,
      );
      creature.scale.setScalar([1.45, 1.05, 1.15][i]);
      creature.userData.moving.forEach((part, j) => {
        if (i === 0) part.rotation.y = Math.sin(this.time * 1.1) * 0.16;
        else if (i === 1) part.rotation.y = Math.sin(this.time * 1.7) * 0.24;
        else part.rotation.x = Math.sin(this.time * 1.5 + j * Math.PI) * 0.4;
      });
    });
  }
}
