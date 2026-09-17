import * as THREE from 'three';
import { groundHeight, roadOffset, laneZ, WATER_Y, ROAD_HALF_LEN, START } from './terrain';

// Ambient forest animals: deer, foxes, hares and a grouse flock. Purely visual —
// they graze, wander and flee from the moose, but never cause crashes or score.
// (The moose is the only source of chaos.)

type Kind = 'deer' | 'fox' | 'hare';

const FLEE_RADIUS: Record<Kind, number> = { deer: 15, fox: 12, hare: 9 };
const WALK: Record<Kind, number> = { deer: 1.6, fox: 2.2, hare: 2.6 };
const FLEE_SPEED: Record<Kind, number> = { deer: 7, fox: 8, hare: 6 };

const mat = (r: number, g: number, b: number) => new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b) });

interface Critter {
  kind: Kind;
  home: boolean;
  group: THREE.Group;
  yaw: number;
  speed: number;
  target: THREE.Vector3;
  idle: number;
  flee: number;
  phase: number;
  legs: THREE.Mesh[];
  head: THREE.Object3D | null;
}

interface Bird {
  mesh: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
}

function scatterSpot(avoid: THREE.Vector3): THREE.Vector3 {
  for (let tries = 0; tries < 40; tries++) {
    const x = (Math.random() - 0.5) * (ROAD_HALF_LEN * 2 - 40);
    const z = laneZ(x, (10 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1));
    if (Math.abs(roadOffset(x, z)) < 8) continue;
    if (groundHeight(x, z) < WATER_Y + 0.6) continue;
    if (Math.hypot(x - avoid.x, z - avoid.z) < 12) continue;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  }
  const x = 60 + Math.random() * 40;
  const z = laneZ(x, 20);
  return new THREE.Vector3(x, groundHeight(x, z), z);
}

// a clearing near the moose spawn so animals are on screen from the first second:
// forest side, clear of the road, no fence out here (x > ESKER_X0)
function nearStartSpot(): THREE.Vector3 {
  for (let tries = 0; tries < 40; tries++) {
    const x = START.x - 25 + Math.random() * 50;
    const z = laneZ(x, 12 + Math.random() * 13);
    if (groundHeight(x, z) < WATER_Y + 0.6) continue;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  }
  return scatterSpot(new THREE.Vector3(START.x, 0, laneZ(START.x, 15)));
}

function leg(w: number, h: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.7, w * 0.5, h, 5).translate(0, -h / 2, 0), m);
  mesh.castShadow = true;
  return mesh;
}

function buildDeer(): { group: THREE.Group; legs: THREE.Mesh[]; head: THREE.Object3D } {
  const group = new THREE.Group();
  const coat = mat(0.45, 0.3, 0.17);
  const pale = mat(0.75, 0.68, 0.55);
  const dark = mat(0.2, 0.14, 0.09);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8).scale(1.5, 1, 0.9), coat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  // neck + head pivot so grazing can dip it
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0.55, 1.2, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.7, 6).translate(0, 0.35, 0), coat);
  neck.rotation.z = -0.5;
  neck.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.2), coat);
  head.position.set(0.42, 0.62, 0);
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), dark);
  nose.position.set(0.66, 0.58, 0);
  neckPivot.add(neck, head, nose);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), coat);
    ear.position.set(0.3, 0.78, s * 0.12);
    ear.rotation.x = s * 0.5;
    neckPivot.add(ear);
  }
  group.add(neckPivot);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5).rotateZ(Math.PI * 0.7), pale);
  tail.position.set(-0.68, 1.12, 0);
  group.add(tail);
  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [[0.45, 0.22], [0.45, -0.22], [-0.45, 0.22], [-0.45, -0.22]]) {
    const l = leg(0.055, 1.0, coat);
    l.position.set(lx, 0.85, lz);
    legs.push(l);
    group.add(l);
  }
  return { group, legs, head: neckPivot };
}

function buildFox(): { group: THREE.Group; legs: THREE.Mesh[]; head: THREE.Object3D } {
  const group = new THREE.Group();
  const rust = mat(0.72, 0.32, 0.1);
  const cream = mat(0.85, 0.78, 0.66);
  const dark = mat(0.12, 0.09, 0.07);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8).scale(1.7, 1, 0.85), rust);
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), cream);
  chest.position.set(0.3, 0.36, 0);
  group.add(chest);
  const headPivot = new THREE.Group();
  headPivot.position.set(0.44, 0.62, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6).scale(1.1, 0.9, 0.8), rust);
  skull.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 6).rotateZ(-Math.PI / 2), cream);
  snout.position.set(0.2, -0.03, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), dark);
  tip.position.set(0.32, -0.03, 0);
  headPivot.add(skull, snout, tip);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), rust);
    ear.position.set(-0.02, 0.16, s * 0.09);
    headPivot.add(ear);
  }
  group.add(headPivot);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.55, 6).rotateZ(Math.PI / 2 - 0.35), rust);
  tail.position.set(-0.6, 0.5, 0);
  tail.castShadow = true;
  const brush = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), cream);
  brush.position.set(-0.86, 0.38, 0);
  group.add(tail, brush);
  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [[0.3, 0.13], [0.3, -0.13], [-0.3, 0.13], [-0.3, -0.13]]) {
    const l = leg(0.04, 0.42, dark);
    l.position.set(lx, 0.4, lz);
    legs.push(l);
    group.add(l);
  }
  return { group, legs, head: headPivot };
}

function buildHare(): { group: THREE.Group; legs: THREE.Mesh[]; head: THREE.Object3D } {
  const group = new THREE.Group();
  const grey = mat(0.55, 0.52, 0.45);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6).scale(1.4, 1, 0.9), grey);
  body.position.y = 0.28;
  body.castShadow = true;
  group.add(body);
  const headPivot = new THREE.Group();
  headPivot.position.set(0.24, 0.42, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), grey);
  headPivot.add(skull);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.28, 5).translate(0, 0.14, 0), grey);
    ear.position.set(-0.02, 0.08, s * 0.05);
    ear.rotation.z = -0.25;
    ear.rotation.x = s * 0.15;
    headPivot.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(0.9, 0.88, 0.82));
  tail.position.set(-0.26, 0.32, 0);
  group.add(headPivot, tail);
  const legs: THREE.Mesh[] = [];
  for (const [lx, lz] of [[0.12, 0.09], [0.12, -0.09], [-0.12, 0.09], [-0.12, -0.09]]) {
    const l = leg(0.035, 0.24, grey);
    l.position.set(lx, 0.22, lz);
    legs.push(l);
    group.add(l);
  }
  return { group, legs, head: headPivot };
}

const BUILDERS: Record<Kind, () => { group: THREE.Group; legs: THREE.Mesh[]; head: THREE.Object3D }> = {
  deer: buildDeer,
  fox: buildFox,
  hare: buildHare,
};

export class Animals {
  private critters: Critter[] = [];
  private birds: Bird[] = [];
  private birdCentre = new THREE.Vector3(120, 0, 60);
  private time = 0;

  constructor(scene: THREE.Scene) {
    const counts: [Kind, number][] = [['deer', 6], ['fox', 4], ['hare', 8]];
    const anchor = new THREE.Vector3(138, 0, 0);
    for (const [kind, n] of counts) {
      for (let i = 0; i < n; i++) {
        const { group, legs, head } = BUILDERS[kind]();
        // the first of each kind starts near the moose spawn, impossible to miss
        const nearStart = (kind === 'deer' && i < 2) || (kind === 'fox' && i < 1) || (kind === 'hare' && i < 2);
        const spot = nearStart ? nearStartSpot() : scatterSpot(anchor);
        group.position.copy(spot);
        const yaw = Math.random() * Math.PI * 2;
        group.rotation.y = yaw;
        scene.add(group);
        this.critters.push({
          kind, home: nearStart, group, yaw, speed: 0,
          target: scatterSpot(spot), idle: Math.random() * 4, flee: 0, phase: Math.random() * 6,
          legs, head,
        });
      }
    }
    // a grouse flock circling high over the ridge
    const birdMat = mat(0.16, 0.13, 0.1);
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Group();
      const bodyGeo = new THREE.SphereGeometry(0.12, 6, 5).scale(1.6, 0.8, 0.8);
      const bodyMesh = new THREE.Mesh(bodyGeo, birdMat);
      const wingGeo = new THREE.PlaneGeometry(0.55, 0.25).translate(0.3, 0, 0);
      const wingMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.2, 0.16, 0.12), side: THREE.DoubleSide });
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.rotation.y = Math.PI;
      mesh.add(bodyMesh, wingL, wingR);
      scene.add(mesh);
      this.birds.push({
        mesh, wingL, wingR,
        angle: Math.random() * Math.PI * 2,
        radius: 14 + Math.random() * 14,
        height: 18 + Math.random() * 12,
        speed: 0.25 + Math.random() * 0.2,
        phase: Math.random() * 6,
      });
    }
  }

  reset() {
    const anchor = new THREE.Vector3(138, 0, 0);
    for (const c of this.critters) {
      const spot = c.home ? nearStartSpot() : scatterSpot(anchor);
      c.group.position.copy(spot);
      c.target = scatterSpot(spot);
      c.idle = Math.random() * 4;
      c.flee = 0;
      c.speed = 0;
    }
    this.birdCentre.set(120, 0, 60);
  }

  update(dt: number, moosePos: THREE.Vector3) {
    this.time += dt;
    if (dt <= 0) return;
    for (const c of this.critters) {
      const p = c.group.position;
      const toMoose = Math.hypot(p.x - moosePos.x, p.z - moosePos.z);
      if (toMoose < FLEE_RADIUS[c.kind]) {
        c.flee = 1.4;
        const away = Math.atan2(-(p.z - moosePos.z), p.x - moosePos.x);
        c.yaw = away + (Math.random() - 0.5) * 0.4;
        c.idle = 0;
      } else {
        c.flee = Math.max(0, c.flee - dt);
      }
      const off = roadOffset(p.x, p.z);
      let want = 0;
      let targetYaw = c.yaw;
      if (c.flee > 0) {
        want = FLEE_SPEED[c.kind];
      } else if (Math.abs(off) < 8) {
        // shy of the asphalt: veer back into the forest
        targetYaw = c.yaw + Math.PI * 0.5 * Math.sign(off || 1);
        want = WALK[c.kind] * 1.5;
        c.idle = 0;
      } else if (c.idle > 0) {
        c.idle -= dt;
        want = 0;
      } else {
        const dx = c.target.x - p.x, dz = c.target.z - p.z;
        if (Math.hypot(dx, dz) < 2) {
          c.idle = 2 + Math.random() * 5;
          c.target = scatterSpot(p);
          want = 0;
        } else {
          targetYaw = Math.atan2(-dz, dx);
          want = WALK[c.kind];
        }
      }
      let d = targetYaw - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * (1 - Math.exp(-4 * dt));
      c.speed = THREE.MathUtils.lerp(c.speed, want, 1 - Math.exp(-5 * dt));
      p.x += Math.cos(c.yaw) * c.speed * dt;
      p.z += -Math.sin(c.yaw) * c.speed * dt;
      // stay on dry land inside the world
      p.x = THREE.MathUtils.clamp(p.x, -300, 300);
      p.z = THREE.MathUtils.clamp(p.z, -300, 300);
      const g = groundHeight(p.x, p.z);
      if (g < WATER_Y + 0.4) {
        p.x -= Math.cos(c.yaw) * c.speed * dt * 2;
        p.z += Math.sin(c.yaw) * c.speed * dt * 2;
        c.target = scatterSpot(p);
      }
      let hop = 0;
      if (c.kind === 'hare' && c.speed > 0.5) {
        c.phase += dt * c.speed * 2.2;
        hop = Math.max(0, Math.sin(c.phase * Math.PI)) * 0.25 * Math.min(1, c.speed / 3);
      } else {
        c.phase += dt * (2 + c.speed * 1.8);
      }
      p.y = groundHeight(p.x, p.z) + hop;
      c.group.rotation.y = c.yaw;
      const swing = Math.min(1, c.speed / 2) * 0.55;
      c.legs.forEach((l, i) => {
        l.rotation.z = Math.sin(c.phase * 2 + (i % 2 === 0 ? 0 : Math.PI)) * swing;
      });
      if (c.head) {
        if (c.kind === 'deer' && c.speed < 0.2 && c.flee <= 0) {
          // grazing: head dips down and bobs
          c.head.rotation.z = THREE.MathUtils.lerp(c.head.rotation.z, -0.85 + Math.sin(this.time * 1.3) * 0.08, 1 - Math.exp(-3 * dt));
        } else {
          c.head.rotation.z = THREE.MathUtils.lerp(c.head.rotation.z, 0, 1 - Math.exp(-4 * dt));
        }
      }
    }
    // grouse flock: loose circling formation drifting over the ridge
    this.birdCentre.x += Math.sin(this.time * 0.05) * dt * 2;
    this.birdCentre.z += Math.cos(this.time * 0.04) * dt * 2;
    for (const b of this.birds) {
      b.angle += dt * b.speed;
      b.phase += dt * 9;
      const bGround = Math.max(groundHeight(this.birdCentre.x, this.birdCentre.z), WATER_Y);
      const x = this.birdCentre.x + Math.cos(b.angle) * b.radius;
      const z = this.birdCentre.z + Math.sin(b.angle) * b.radius;
      b.mesh.position.set(x, bGround + b.height + Math.sin(this.time * 0.8 + b.phase) * 0.8, z);
      b.mesh.rotation.y = Math.atan2(-(Math.cos(b.angle)), -Math.sin(b.angle)) + Math.PI / 2;
      const flap = Math.sin(b.phase) * 0.7;
      b.wingL.rotation.x = flap;
      b.wingR.rotation.x = -flap;
    }
  }
}
