import * as THREE from 'three/webgpu';
import { abs, bumpMap, color, float, floor, fract, max, min, mix, positionWorld, sin, smoothstep, vec2, vec3, type ShaderNodeObject } from 'three/tsl';

// A compact, continuous analytic grain keeps shader compilation and rendering fast.
const surfaceNoise = (p: ShaderNodeObject<THREE.Node>) => sin(p.x.add(sin(p.z.mul(1.17))).mul(1.19))
  .mul(sin(p.y.mul(1.41).add(p.z))).mul(0.75)
  .add(sin(p.z.mul(2.18).add(p.x.mul(0.7))).mul(0.25));

/** All surface detail is evaluated procedurally in WGSL via Three Shader Language. */
export function createMaterials() {
  const p = positionWorld;
  const plaster = new THREE.MeshStandardNodeMaterial({ roughness: 0.94 });
  const fine = surfaceNoise(p.mul(155));
  const broad = surfaceNoise(p.mul(2.8));
  const edgeShade = smoothstep(0, 0.22, p.y).mul(0.065).add(0.935);
  plaster.colorNode = color('#e8e4cf').mul(fine.mul(0.026).add(0.99)).mul(broad.mul(0.018).add(1)).mul(edgeShade);
  plaster.normalNode = bumpMap(fine, float(0.009));

  const ceiling = new THREE.MeshStandardNodeMaterial({ color: '#dcd7ca', roughness: 1 });
  ceiling.colorNode = color('#dcd7ca').mul(surfaceNoise(p.mul(100)).mul(0.018).add(1));
  const trim = new THREE.MeshStandardNodeMaterial({ color: '#f3f1e7', roughness: 0.62 });

  const tile = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.035 });
  const uv = vec2(p.x.add(p.z), p.z.sub(p.x)).mul(Math.SQRT1_2 / 0.46);
  const cell = floor(uv);
  const edges = min(fract(uv), fract(uv).oneMinus());
  const distance = min(edges.x, edges.y);
  const grout = smoothstep(0.0018, 0.0075, distance);
  const variation = fract(sin(cell.dot(vec2(127.1, 311.7))).mul(43758.5453));
  const grain = surfaceNoise(p.mul(180));
  const cloud = surfaceNoise(p.mul(11)).mul(0.012);
  const tileColor = color('#e0dcd1').mul(variation.mul(0.035).add(0.97)).add(grain.mul(0.015)).add(cloud);
  tile.colorNode = mix(color('#999080'), tileColor, grout);
  tile.roughnessNode = mix(0.94, grain.mul(0.055).add(0.33), grout);
  tile.normalNode = bumpMap(grout.mul(0.032).add(grain.mul(0.003)), float(0.08));

  const wood = new THREE.MeshStandardNodeMaterial({ roughness: 0.4, color: '#704025' });
  const woodGrain = surfaceNoise(p.mul(vec3(53, 1.9, 37)));
  const growth = sin(p.x.mul(110).add(woodGrain.mul(5))).mul(0.5).add(0.5);
  wood.colorNode = mix(color('#462419'), color('#875332'), woodGrain.mul(0.5).add(0.5)).mul(growth.mul(0.07).add(0.94));
  wood.normalNode = bumpMap(woodGrain, float(0.014));
  const darkWood = new THREE.MeshStandardNodeMaterial({ roughness: 0.43, color: '#382a24' });
  darkWood.colorNode = color('#382a24').mul(woodGrain.mul(0.1).add(1));
  const metal = new THREE.MeshStandardNodeMaterial({ color: '#302c28', metalness: 0.65, roughness: 0.32 });
  const brass = new THREE.MeshStandardNodeMaterial({ color: '#a18a58', metalness: 0.75, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalNodeMaterial({ color: '#697b78', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.27, side: THREE.DoubleSide, depthWrite: false });
  const porch = new THREE.MeshStandardNodeMaterial({ color: '#e0b083', roughness: 0.92 });
  porch.normalNode = bumpMap(fine, float(0.006));
  const socket = new THREE.MeshStandardNodeMaterial({ color: '#ecece5', roughness: 0.48 });
  const stone = new THREE.MeshStandardNodeMaterial({ color: '#b9a18a', roughness: 0.33 });
  stone.colorNode = mix(color('#ad9680'), color('#cbbba5'), max(0, surfaceNoise(p.mul(120)).add(0.45)));
  const dark = new THREE.MeshStandardNodeMaterial({ color: '#24231f', roughness: 0.8 });
  const bulb = new THREE.MeshStandardNodeMaterial({ color: '#ffffff', emissive: '#fff1d0', emissiveIntensity: 0.7, roughness: 0.2 });
  const kitchenTile = new THREE.MeshStandardNodeMaterial({ color: '#e2e4dc', roughness: 0.3 });
  const ku = fract(p.mul(3.4));
  const kEdge = min(min(ku.x, ku.x.oneMinus()), min(ku.y, ku.y.oneMinus()));
  kitchenTile.colorNode = mix(color('#bdbeb3'), color('#e5e7dd'), smoothstep(0.003, 0.008, abs(kEdge)));
  return { plaster, ceiling, trim, tile, wood, darkWood, metal, brass, glass, porch, socket, stone, dark, bulb, kitchenTile };
}
export type Materials = ReturnType<typeof createMaterials>;
