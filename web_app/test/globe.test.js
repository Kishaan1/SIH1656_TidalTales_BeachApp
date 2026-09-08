// Test Globe.gl and Three.js exports
import * as THREE from 'three';

console.log('Testing Three.js in web_app context...');
const scene = new THREE.Scene();
const geometry = new THREE.SphereGeometry(100, 32, 32);
const material = new THREE.MeshBasicMaterial({ color: 0xEADBC8 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

console.log('Scene children count:', scene.children.length);
if (scene.children.length === 1) {
  console.log('✔ Three.js 3D sphere created successfully!');
} else {
  console.error('FAIL: Three.js sphere creation failed');
  process.exit(1);
}
