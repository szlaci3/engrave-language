import * as THREE from 'three';

// Deterministic, shared painted surfaces: detail costs texture memory, not meshes.
export function architectureTexture(fresco = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  let seed = 71;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = '#89745c'; c.fillRect(0, 0, 512, 1024);
  for (let y = 0; y < 1024; y += 64) for (let x = -128; x < 512; x += 128) {
    const left = x + (y % 128 ? 64 : 0);
    const value = 100 + Math.floor(random() * 30);
    c.fillStyle = `rgb(${value + 30},${value + 10},${value - 15})`;
    c.fillRect(left + 2, y + 2, 125, 61);
    c.strokeStyle = '#c4aa8066'; c.strokeRect(left + 3, y + 3, 123, 59);
  }
  for (let i = 0; i < 65000; i++) {
    c.fillStyle = random() > .5 ? '#e4cba815' : '#23191018';
    c.fillRect(random() * 512, random() * 1024, random() * 3 + 1, random() * 3 + 1);
  }
  if (fresco) {
    c.beginPath(); c.moveTo(65, 870); c.lineTo(65, 300);
    c.quadraticCurveTo(65, 170, 256, 90); c.quadraticCurveTo(447, 170, 447, 300);
    c.lineTo(447, 870); c.closePath();
    c.fillStyle = '#34413c'; c.fill(); c.strokeStyle = '#c29b60'; c.lineWidth = 10; c.stroke();
    c.save(); c.clip();
    for (const side of [-1, 1]) {
      c.strokeStyle = '#bd975b'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(256, 860); c.bezierCurveTo(256 + side * 120, 640, 256 - side * 80, 360, 256, 170); c.stroke();
      for (let i = 0; i < 15; i++) {
        const y = 220 + i * 42, x = 256 + side * (35 + Math.sin(i * .8) * 22);
        c.beginPath(); c.moveTo(256, y + 35); c.quadraticCurveTo(x, y + 10, x + side * 55, y); c.stroke();
        for (let j = 0; j < 3; j++) {
          c.save(); c.translate(x + side * j * 16, y + 12 - j * 7); c.rotate(side * .7);
          c.fillStyle = j % 2 ? '#987443' : '#c5a269'; c.beginPath(); c.ellipse(0, 0, 7, 18, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
      }
    }
    c.restore();
    c.fillStyle = '#283b4b'; c.fillRect(224, 260, 64, 480);
    c.strokeStyle = '#b79558'; c.lineWidth = 2; c.strokeRect(230, 266, 52, 468);
    for (let y = 300; y < 720; y += 65) {
      c.fillStyle = '#b79558'; c.beginPath(); c.moveTo(256,y-15); c.lineTo(267,y); c.lineTo(256,y+20); c.lineTo(245,y); c.closePath(); c.fill();
    }
    const glow = c.createRadialGradient(256, 900, 20, 256, 820, 850);
    glow.addColorStop(0, '#ffd69050'); glow.addColorStop(.5, '#a9782510'); glow.addColorStop(1, '#080705bb');
    c.fillStyle = glow; c.fillRect(0,0,512,1024);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
