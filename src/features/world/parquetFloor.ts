import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** One full-render-resolution scene reflection (manual quality trial), shared by all books and architecture. */
export function createParquetFloor(gallery = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // Alternating blocks of narrow wood strips form a seamless basketweave parquet.
  let seed = 17;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    ctx.save(); ctx.translate(col * 128 + 64, row * 128 + 64);
    if ((row + col) % 2) ctx.rotate(Math.PI / 2);
    for (let strip = 0; strip < 4; strip++) {
      const y = -64 + strip * 32;
      const shade = Math.floor(random() * 14);
      ctx.fillStyle = `rgb(${43 + shade}, ${82 + shade}, ${114 + shade})`;
      ctx.fillRect(-64, y, 128, 32);
      for (let grain = 0; grain < 22; grain++) {
        const gy = y + random() * 32;
        ctx.strokeStyle = random() > .5 ? '#b2d8f018' : '#102b4530';
        ctx.lineWidth = .5 + random();
        ctx.beginPath(); ctx.moveTo(-64, gy);
        ctx.bezierCurveTo(-20, gy - 2, 20, gy + 2, 64, gy); ctx.stroke();
      }
      ctx.strokeStyle = '#233f56'; ctx.lineWidth = 1;
      ctx.strokeRect(-64, y, 128, 32);
    }
    ctx.restore();
  }
  if (gallery) {
    // Large honed limestone tiles, rather than the review aisle's blue parquet.
    ctx.fillStyle = '#d6cdb6'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#b5aa90'; ctx.lineWidth = 3;
    ctx.strokeRect(0,0,512,512);
    ctx.strokeRect(12,12,488,488);
    ctx.fillStyle = '#63817d';
    for (const [x,y] of [[0,0],[512,0],[0,512],[512,512]]) {
      ctx.beginPath(); ctx.moveTo(x-30,y); ctx.lineTo(x,y-30); ctx.lineTo(x+30,y); ctx.lineTo(x,y+30); ctx.fill();
    }
  }
  const wood = new THREE.CanvasTexture(canvas);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  const geometry = new THREE.PlaneGeometry(23, 180);
  const floor = new Reflector(geometry, {
    textureWidth: 400, textureHeight: 250, multisample: 0, clipBias: .003,
    shader: {
      uniforms: {
        color: { value: new THREE.Color() },
        tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() },
        wood: { value: wood },
      },
      vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 reflectionUv;
        varying vec2 woodUv;
        varying float viewDepth;
        void main() {
          reflectionUv = textureMatrix * vec4(position, 1.0);
          woodUv = uv * vec2(5.75, 45.0);
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          viewDepth = -viewPosition.z;
          gl_Position = projectionMatrix * viewPosition;
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D wood;
        varying vec4 reflectionUv;
        varying vec2 woodUv;
        varying float viewDepth;
        void main() {
          vec2 projected = reflectionUv.xy / reflectionUv.w;
          // One sharp sample; blend with wood for a partial reflection.
          vec3 reflection = texture2D(tDiffuse, projected).rgb;
          vec3 timber = texture2D(wood, woodUv).rgb;
          float reflectionOpacity = mix(.24, .45, smoothstep(3.0, 35.0, viewDepth));
          vec3 surface = mix(timber, reflection * vec3(.78, .90, 1.0), reflectionOpacity);
          float fog = 1.0 - exp(-.018 * .018 * viewDepth * viewDepth);
          gl_FragColor = vec4(mix(surface, vec3(.71569, .82279, .90466), fog), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -80;
  const material = floor.material as THREE.ShaderMaterial;
  // Reflector clones shader uniforms; use the owned texture for explicit cleanup.
  material.uniforms.wood.value = wood;
  return {
    mesh: floor,
    resize(width: number, height: number) {
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      floor.getRenderTarget().setSize(w, h);
    },
    dispose() { floor.dispose(); geometry.dispose(); wood.dispose(); },
  };
}
