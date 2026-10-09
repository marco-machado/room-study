import * as THREE from 'three/webgpu';
import { createMaterials, type Materials } from './materials';

export const ROOM = { width: 3.8, length: 6.5, height: 2.85, x: 1.9, front: -3.25, back: 3.25 };
export const walkAreas = [
  [-1.7, 1.7, -3.02, 3.05],
  [1.55, 3.1, -2.62, -1.4],
  [1.55, 4.55, -0.33, 2.25],
  [0.55, 1.6, 2.9, 5.3],
  [-1.12, 1.6, 3.95, 5.3],
];

type Mat = THREE.Material;
export function buildRoom(scene: THREE.Scene) {
  const m = createMaterials();
  const architecture = new THREE.Group();
  architecture.name = 'Procedural architectural shell';
  scene.add(architecture);
  const overhead = new THREE.Group();
  overhead.name = 'Ceilings and crown molding';
  architecture.add(overhead);

  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: Mat, parent: THREE.Object3D = architecture) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function slab(x0: number, x1: number, z0: number, z1: number, mat: Mat = m.tile) {
    return box(x1-x0, 0.12, z1-z0, (x0+x1)/2, -0.062, (z0+z1)/2, mat);
  }
  function wallZ(x0: number, x1: number, z: number, y0=0, y1=ROOM.height, material: Mat=m.plaster) {
    return box(x1-x0, y1-y0, 0.16, (x0+x1)/2, (y0+y1)/2, z, material);
  }
  function wallX(z0: number, z1: number, x: number, y0=0, y1=ROOM.height, material: Mat=m.plaster) {
    return box(0.16, y1-y0, z1-z0, x, (y0+y1)/2, (z0+z1)/2, material);
  }
  function baseZ(x0: number, x1: number, z: number) {
    box(x1-x0, 0.085, 0.028, (x0+x1)/2, 0.042, z, m.darkWood);
    box(x1-x0, 0.012, 0.034, (x0+x1)/2, 0.081, z, m.wood);
  }
  function baseX(z0: number, z1: number, x: number) {
    box(0.028, 0.085, z1-z0, x, 0.042, (z0+z1)/2, m.darkWood);
    box(0.034, 0.012, z1-z0, x, 0.081, (z0+z1)/2, m.wood);
  }
  // A stepped plaster cornice is modeled, including its curved lower bead.
  function crown(x0: number, x1: number, z0: number, z1: number) {
    const profiles = [{h:0.017,d:0.086,y:2.823},{h:0.022,d:0.070,y:2.805},{h:0.019,d:0.052,y:2.784},{h:0.020,d:0.040,y:2.765},{h:0.012,d:0.028,y:2.748}];
    for (const p of profiles) {
      box(x1-x0, p.h, p.d, (x0+x1)/2,p.y,z0+p.d/2,m.trim,overhead).castShadow=false;
      box(x1-x0, p.h, p.d, (x0+x1)/2,p.y,z1-p.d/2,m.trim,overhead).castShadow=false;
      box(p.d,p.h,z1-z0,x0+p.d/2,p.y,(z0+z1)/2,m.trim,overhead).castShadow=false;
      box(p.d,p.h,z1-z0,x1-p.d/2,p.y,(z0+z1)/2,m.trim,overhead).castShadow=false;
    }
  }
  function extrusion(shape: THREE.Shape, depth: number, z: number, material: Mat) {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 42 }), material);
    mesh.position.z=z;
    mesh.castShadow=true; mesh.receiveShadow=true;
    architecture.add(mesh);
    return mesh;
  }
  function archPath(cx: number, width: number, bottom: number, spring: number, rise: number, shape: THREE.Path = new THREE.Shape()) {
    shape.moveTo(cx-width/2,bottom);
    shape.lineTo(cx+width/2,bottom);
    shape.lineTo(cx+width/2,spring);
    shape.quadraticCurveTo(cx,spring+rise*2,cx-width/2,spring);
    shape.closePath();
    return shape;
  }
  function archFrame(cx: number, width: number, bottom: number, spring: number, rise: number, thick: number, depth: number, z: number, material: Mat) {
    const s = archPath(cx,width,bottom,spring,rise) as THREE.Shape;
    s.holes.push(archPath(cx,width-thick*2,bottom+thick,spring-thick*0.6,rise-thick*0.25,new THREE.Path()));
    return extrusion(s,depth,z,material);
  }

  slab(-1.98,1.98,-3.33,3.33);
  wallX(-3.33,3.33,-1.98);
  baseX(-3.25,3.25,-1.88);
  wallZ(1.65,1.98,3.33);
  wallZ(-1.98,1.65,3.33,2.4);
  wallZ(-1.98,0.52,3.33,0,1.02);
  baseZ(-1.9,0.52,3.235);
  box(2.61,0.058,0.50,-0.72,1.046,3.31,m.stone);
  // Front wall has an actual curved opening, not a dark rectangle on the wall.
  const front = new THREE.Shape();
  front.moveTo(-1.98,0); front.lineTo(0.68,0); front.lineTo(0.68,ROOM.height); front.lineTo(-1.98,ROOM.height); front.closePath();
  front.holes.push(archPath(-0.7,1.94,0.86,2.08,0.30,new THREE.Path()));
  extrusion(front,0.18,-3.43,m.plaster);
  wallZ(0.68,1.98,-3.34,2.26);
  wallZ(1.73,1.98,-3.34);
  baseZ(-1.9,0.69,-3.235);
  baseZ(1.73,1.9,-3.235);

  // Arched dark timber window, sliding panels, grille, and shallow glass transom.
  archFrame(-0.7,2.02,0.82,2.10,0.32,0.063,0.08,-3.285,m.darkWood);
  archFrame(-0.7,1.91,0.88,2.075,0.285,0.023,0.045,-3.225,m.metal);
  const pane = archPath(-0.7,1.855,0.925,2.065,0.262) as THREE.Shape;
  const glazing = new THREE.Mesh(new THREE.ShapeGeometry(pane,40),m.glass);
  glazing.position.z=-3.275; architecture.add(glazing);
  box(1.9,0.045,0.058,-0.7,2.07,-3.225,m.darkWood);
  box(1.9,0.044,0.096,-0.7,0.906,-3.19,m.darkWood);
  for (const x of [-1.61,-0.73,0.20]) box(0.038,1.16,0.051,x,1.48,-3.185,m.darkWood);
  for(let i=0;i<14;i++) box(0.013,1.12,0.018,-1.57+i*0.134,1.491,-3.12,m.metal);
  for(const y of [0.966,1.39,1.987,2.04]) box(1.83,0.014,0.021,-0.7,y,-3.115,m.metal);
  for(const x of [-1.21,-0.19]) {
    box(0.017,0.34,0.019,x,1.75,-3.12,m.metal);
    box(0.24,0.013,0.019,x,1.58,-3.12,m.metal);
  }
  const centerMullion=box(0.037,0.267,0.04,-0.7,2.225,-3.22,m.darkWood);
  centerMullion.name='Arched transom center';
  for(const sign of [-1,1]) {
    const mullion=box(0.028,0.20,0.042,-0.7+sign*0.50,2.16,-3.22,m.darkWood);
    mullion.rotation.z=sign*-0.35;
  }
  for(const x of [-0.77,-0.65])box(0.015,0.08,0.025,x,1.36,-3.14,m.brass);

  // Door frame and six recessed wooden panels, hinged inward as in the photos.
  for(const x of [0.7,1.72])box(0.065,2.29,0.135,x,1.145,-3.23,m.darkWood);
  box(1.085,0.075,0.135,1.21,2.275,-3.23,m.darkWood);
  box(1.0,0.036,0.20,1.21,0.012,-3.3,m.stone);
  const door=new THREE.Group(); door.position.set(1.688,0,-3.22); architecture.add(door);
  door.name='Six-panel entrance door';
  const dw=0.936,dh=2.22;
  box(dw,dh,0.046,-dw/2,dh/2,0,m.wood,door);
  for(const row of [{y:0.41,h:0.61},{y:1.12,h:0.61},{y:1.86,h:0.64}]) {
    for(const x of [-0.245,-0.693]) {
      for(const side of [-1,1]) {
        box(0.334,row.h,0.012,x,row.y,side*0.025,m.darkWood,door);
        box(0.316,row.h-0.021,0.016,x,row.y,side*0.033,m.wood,door);
        box(0.251,row.h-0.086,0.013,x,row.y,side*0.045,m.wood,door);
        for(const dx of [-0.16,0.16])box(0.020,row.h,0.026,x+dx,row.y,side*0.043,m.wood,door);
        for(const dy of [-row.h/2,row.h/2])box(0.34,0.021,0.026,x,row.y+dy,side*0.043,m.wood,door);
      }
    }
  }
  for(const y of [0.25,1.15,2.02]) {
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.10,12),m.brass);
    hinge.position.set(-0.007,y,0.024);door.add(hinge);
  }
  for(const sign of [-1,1]) {
    box(0.034,0.17,0.012,-0.852,1.01,sign*0.032,m.brass,door);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(0.028,16,12),m.brass);
    knob.position.set(-0.852,1.055,sign*0.065); door.add(knob);
    box(0.052,0.11,0.008,-0.852,1.04,sign*0.028,m.brass,door);
  }
  door.rotation.y=Math.PI*0.29;

  // The right side has a narrow hall and a broad, untrimmed living-room opening.
  wallX(-3.33,-2.70,1.98);
  wallX(-1.32,-0.48,1.98);
  wallX(2.42,3.33,1.98);
  wallX(-2.7,-1.32,1.98,2.3);
  wallX(-0.48,2.42,1.98,2.32);
  baseX(-3.25,-2.7,1.88); baseX(-1.32,-0.48,1.88);baseX(2.42,3.25,1.88);
  // Hall recess and its two dark timber-lined side doorways.
  slab(1.9,3.35,-2.79,-1.24);
  wallZ(1.98,3.35,-2.79);wallZ(1.98,3.35,-1.24);
  wallX(-2.79,-1.24,3.35);
  baseX(-2.79,-1.24,3.25);
  baseZ(1.98,3.25,-2.695);baseZ(1.98,3.25,-1.335);
  for(const z of [-2.695,-1.335]) {
    box(0.70,2.12,0.014,2.68,1.06,z,m.dark);
    for(const x of [2.31,3.055])box(0.055,2.15,0.05,x,1.075,z,m.darkWood);
    box(0.80,0.055,0.05,2.68,2.15,z,m.darkWood);
  }
  box(0.025,0.36,0.25,3.247,1.56,-2.02,m.socket);
  for(let j=0;j<3;j++)box(0.028,0.079,0.19,3.226,1.455+j*0.098,-2.02,m.trim);

  // The living-room shell remains entirely empty.
  slab(1.9,4.8,-0.56,2.50);
  wallZ(1.98,4.8,-0.56);wallZ(1.98,4.8,2.50);wallX(-0.56,2.50,4.8);
  baseZ(1.98,4.7,-0.46);baseZ(1.98,4.7,2.40);baseX(-0.46,2.40,4.7);
  box(2.82,0.12,2.98,3.39,2.91,0.97,m.ceiling,overhead);
  crown(1.98,4.72,-0.48,2.42);

  // Fixed kitchen half-wall, pale ceramic walls and back arched window.
  slab(-1.98,1.98,3.25,5.60);
  wallX(3.33,5.6,-1.98,0,ROOM.height,m.kitchenTile);
  wallX(3.33,5.6,1.98,0,ROOM.height,m.kitchenTile);
  wallZ(-1.98,1.98,5.6,0,ROOM.height,m.kitchenTile);
  extrusion(archPath(-0.1,1.3,1.26,1.96,0.18) as THREE.Shape,0.025,5.49,m.darkWood);
  archFrame(-0.1,1.3,1.26,1.96,0.18,0.045,0.07,5.42,m.darkWood);
  const kitchenGlazing=new THREE.Mesh(new THREE.ShapeGeometry(archPath(-0.1,1.20,1.31,1.94,0.16) as THREE.Shape,32),m.glass);
  kitchenGlazing.position.z=5.405;architecture.add(kitchenGlazing);
  for(let i=0;i<9;i++)box(0.014,0.70,0.023,-0.63+i*0.134,1.67,5.40,m.metal);
  box(0.57,0.90,1.75,-1.62,0.45,4.68,m.trim);
  box(0.64,0.055,1.8,-1.6,0.918,4.68,m.stone);
  for(let i=0;i<3;i++)box(0.016,0.78,0.012,-1.325,0.45,4.1+i*0.55,m.socket);
  box(3.8,0.12,2.35,0,2.91,4.42,m.ceiling,overhead);
  crown(-1.9,1.9,3.33,5.52);
  // Warm, enclosed passage outside the front entrance.
  slab(-1.98,1.98,-4.90,-3.33);
  wallZ(-1.98,1.98,-4.9,0,2.85,m.porch);
  wallX(-4.9,-3.33,-1.98,0,2.85,m.porch);
  wallX(-4.9,-3.33,1.98,0,2.85,m.porch);
  box(3.95,0.12,1.58,0,2.91,-4.12,m.ceiling,overhead);
  // A recessed brighter area beyond the glazing gives the enclosed porch depth.
  box(1.5,1.75,0.018,-0.72,1.14,-4.807,m.porch);

  box(3.8,0.12,6.5,0,2.91,0,m.ceiling,overhead);
  box(1.37,0.12,1.55,2.65,2.91,-2.015,m.ceiling,overhead);
  crown(-1.9,1.9,-3.25,3.25);

  function outlet(x: number,y: number,z: number,rotation=0,type='outlet') {
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;architecture.add(group);
    box(0.081,0.125,0.010,0,0,0,m.socket,group);
    box(0.066,0.104,0.013,0,0,0.005,m.trim,group);
    if(type==='switch')box(0.029,0.05,0.013,0,0,0.015,m.socket,group);
    else for(const oy of [-0.024,0.024])for(const ox of [-0.013,0.013])box(0.006,0.009,0.001,ox,oy,0.013,m.dark,group);
    return group;
  }
  outlet(0.46,1.23,-3.237,0,'switch');outlet(0.46,1.05,-3.237);
  outlet(0.49,2.10,-3.237,0,'switch');
  outlet(1.885,0.24,-0.77,-Math.PI/2);outlet(-1.884,0.25,1.55,Math.PI/2);
  outlet(1.885,0.24,2.74,-Math.PI/2);
  // Simple bare ceiling fitting visible in the supplied room.
  const lightFitting=new THREE.Group();overhead.add(lightFitting);
  const rose=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.078,0.035,32),m.trim);
  rose.position.set(0.1,2.82,0.45);lightFitting.add(rose);
  const holder=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.033,0.075,24),m.socket);
  holder.position.set(0.1,2.765,0.45);lightFitting.add(holder);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.036,24,16),m.bulb);
  bulb.scale.set(0.85,1.55,0.85);bulb.position.set(0.1,2.69,0.45);lightFitting.add(bulb);

  return { architecture, overhead, door, materials:m, setDoor(open:boolean){ door.userData.target = open ? Math.PI*0.29 : 0; } };
}
