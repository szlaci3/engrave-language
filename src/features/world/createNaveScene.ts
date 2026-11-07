import { createParquetFloor } from './parquetFloor';
import * as THREE from 'three';
import type { Flashcard } from './flashcards';
import { BOOK_SPACING, BOOK_THICKNESS, VISIBLE_BOOK_COUNT, REPEAT_PREVIEW_REMAINING, PASSED_BOOK_CACHE_COUNT, advanceBookDrop, WALK_SPEED, deckIndex, currentBookIndex, isMovementTarget, adjacentStone } from './navigation';

export function createNaveScene(host: HTMLElement, onCurrent: (index: number) => void, onError: () => void, onComplete: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#dceaf4');
  renderer.domElement.setAttribute('aria-label', 'One row of Chinese and Dutch stone flashcards. Use Up to walk forward, Down to walk backward.');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#dceaf4', .018);
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 180);
  camera.position.set(0, 3.3, 0);
  camera.lookAt(0, 3.3, -100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#56748b', 1.4));
  const light = new THREE.DirectionalLight('#ffffff', 1.5);
  light.position.set(-3, 10, 8); scene.add(light);
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T => { resources.add(resource); return resource; };
  const stone = keep(new THREE.MeshLambertMaterial({ color: '#477fa6' }));
  const trim = keep(new THREE.MeshLambertMaterial({ color: '#6698ba' }));
  const wall = keep(new THREE.MeshBasicMaterial({ color: '#dceaf4', side: THREE.DoubleSide }));
  // Keep the previous wallpaper width and scale its height by the change in
  // image aspect ratio. Anchor the cropped artwork at the vault spring line.
  const wallHeight = 11;
  const wallpaperScale = 0.90;
  const wallpaperHeight = 16 * wallpaperScale * (1280 / 1239) / (1280 / 960);
  function fitWallpaper(texture: THREE.Texture) {
    texture.repeat.set(1 / wallpaperScale, wallHeight / wallpaperHeight);
    texture.offset.set((1 - texture.repeat.x) / 2, 1 - texture.repeat.y);
  }
  const parquet = createParquetFloor();
  const floor = parquet.mesh;
  scene.add(floor);
  const nave = new THREE.Group(); scene.add(nave);
  const matrix = new THREE.Matrix4();
  function repeated(geometry: THREE.BufferGeometry, material: THREE.Material, positions: [number, number, number][]) {
    const mesh = new THREE.InstancedMesh(keep(geometry), material, positions.length);
    positions.forEach(([x, y, z], i) => mesh.setMatrixAt(i, matrix.makeTranslation(x, y, z)));
    nave.add(mesh); return mesh;
  }
  const segments = 16;
  const pillars: [number, number, number][] = [];
  const bases: [number, number, number][] = [];
  for (let i = 0; i < segments; i++) for (const side of [-1, 1]) {
    pillars.push([side * 10, 5.5, -i * 10]); bases.push([side * 10, .4, -i * 10]);

  }
  const panels = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(10, wallHeight)), wall, segments * 2);
  for (let i = 0; i < segments * 2; i++) {
    matrix.makeRotationY(Math.PI / 2);
    matrix.setPosition((i % 2 ? 1 : -1) * 10.5, wallHeight / 2, -Math.floor(i / 2) * 10 - 5);
    panels.setMatrixAt(i, matrix);
  }
  nave.add(panels);
  repeated(new THREE.CylinderGeometry(.55, .65, 11, 12), stone, pillars);
  for (const offset of [-.48, .48]) {
    repeated(new THREE.CylinderGeometry(.18, .23, 11, 8), trim, pillars.map(([x,y,z]) => [x + offset,y,z + .35]));
    repeated(new THREE.CylinderGeometry(.18, .23, 11, 8), trim, pillars.map(([x,y,z]) => [x,y,z + offset]));
  }
  for (const [radius,height,y] of [[1,.35,.18],[.85,.25,.48],[.72,.2,.7],[.78,.3,10.8],[.95,.22,11.05]]) {
    repeated(new THREE.CylinderGeometry(radius, radius + .08, height, 12), trim, bases.map(([x,,z]) => [x,y,z]));
  }
  const archTrim = keep(new THREE.MeshBasicMaterial({ color: '#b6d1e6' }));
  const arch = new THREE.CurvePath<THREE.Vector3>();
  arch.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-10, 11, 0), new THREE.Vector3(-9, 17, 0), new THREE.Vector3(0, 20, 0)));
  arch.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 20, 0), new THREE.Vector3(9, 17, 0), new THREE.Vector3(10, 11, 0)));
  const stations: [number, number, number][] = Array.from({length: segments}, (_, i) => [0,0,-i*10]);
  for (const offset of [-.24, 0, .24]) repeated(new THREE.TubeGeometry(arch, 48, offset ? .11 : .19, 8, false), archTrim, stations.map(([x,y,z]) => [x,y,z+offset]));
  // A continuous pointed vault, built once per bay and instanced into the distance.
  const points = arch.getPoints(48);
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  points.forEach((point, i) => {
    for (const z of [0,-10]) { vertices.push(point.x, point.y + .12,z); uvs.push(i/48,z/-10); }
    if (i < points.length-1) { const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
  });
  const vault = new THREE.BufferGeometry();
  vault.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  vault.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); vault.setIndex(indices); vault.computeVertexNormals();
  const vaultMaterial = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false }));
  repeated(vault,vaultMaterial,stations);
  // Diagonal ribs join each pair of columns to the crown of its bay.
  for (const side of [-1,1]) for (const end of [0,-10]) {
    const rib = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side*10,11,end),new THREE.Vector3(side*8,17,-5),new THREE.Vector3(0,20,-5));
    repeated(new THREE.TubeGeometry(rib,24,.12,6,false),archTrim,stations);
  }
  const blueStone = keep(new THREE.MeshLambertMaterial({ color: '#424f58' }));
  const whiteStone = keep(new THREE.MeshLambertMaterial({ color: '#a9a394' }));
  const stoneHeight = 1.65;
  const stoneCenterY = 2.5 - stoneHeight / 2;
  const reflectionGap = .2;
  const bookGeometry = keep(new THREE.BoxGeometry(5.3, stoneHeight, BOOK_THICKNESS));
  const frontGeometry = keep(new THREE.PlaneGeometry(5.3, stoneHeight));
  const bookMeshes = new Map<number, THREE.Group>();
  const bookDrops = new Map<number, number>();
  const reflectedStones = new THREE.Scene();
  reflectedStones.fog = scene.fog;
  for (const child of scene.children) if (child instanceof THREE.Light) reflectedStones.add(child.clone());
  const reflectionMeshes = new Map<number, THREE.Group>();
  // Architecture uses the floor's usual clipped pass. Stones need a separate
  // unclipped pass because raising their reflection crosses the physical floor.
  const reflectScene = floor.onBeforeRender;
  floor.onBeforeRender = (...args) => {
    const [activeRenderer, , activeCamera] = args;
    const reflectionLift = 2 * (stoneCenterY - stoneHeight / 2) - reflectionGap;
    const visibility = [...bookMeshes.values()].map(group => [group, group.visible] as const);
    for (const [id, group] of bookMeshes) {
      const reflected = reflectionMeshes.get(id)!;
      reflected.position.copy(group.position);
      reflected.position.y -= reflectionLift;
      reflected.visible = group.visible;
      group.visible = false;
    }
    try {
      reflectScene.apply(floor, args);
      const reflectionCamera = floor.getReflectionCamera(activeCamera);
      const clippedProjection = reflectionCamera.projectionMatrix.clone();
      const previousTarget = activeRenderer.getRenderTarget();
      const previousAutoClear = activeRenderer.autoClear;
      try {
        // Preserve the mirrored camera but remove its floor clipping plane.
        reflectionCamera.projectionMatrix.copy(activeCamera.projectionMatrix);
        reflectionCamera.projectionMatrix.elements[8] *= -1;
        reflectionCamera.projectionMatrix.elements[12] *= -1;
        activeRenderer.setRenderTarget(floor.getRenderTarget());
        activeRenderer.autoClear = false;
        // The unclipped projection has a different depth mapping.
        activeRenderer.clearDepth();
        activeRenderer.render(reflectedStones, reflectionCamera);
      } finally {
        reflectionCamera.projectionMatrix.copy(clippedProjection);
        activeRenderer.autoClear = previousAutoClear;
        activeRenderer.setRenderTarget(previousTarget);
      }
    } finally {
      for (const [group, visible] of visibility) group.visible = visible;
    }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let nearDistance = 6, speed = 1, target: number | null = null;
  let books: Flashcard[] = [], position = 0, current = Number.NaN, direction = 0, frame = 0, previousTime = 0, disposed = false;
  const heldKeys = new Set<string>();
  const stoneBackgrounds = new Map<Flashcard['language'], HTMLCanvasElement>();
  const covers = new Map<string, { title: string; language: Flashcard['language']; material: THREE.MeshBasicMaterial }>();
  const placeholder = (book: Flashcard) => {
    // Match the face aspect ratio so glyphs retain their natural proportions.
    const canvas = document.createElement('canvas');
    const width = 1024, height = Math.round(width * stoneHeight / 5.3);
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const chinese = book.language === 'zh';
    let background = stoneBackgrounds.get(book.language);
    if (background) ctx.drawImage(background, 0, 0);
    else {
      // Fine-grained limestone with subtle sediment bands and calcite flecks.
      let seed = 53;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const pixels = ctx.createImageData(width, height);
      const base = chinese ? [72, 88, 100] : [192, 185, 166];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const band = Math.sin(y * .075 + Math.sin(x * .009) * 1.8) * 2.5;
        const mineral = Math.sin(x * .019 + y * .025) * Math.sin(y * .031 - x * .011) * 4;
        const grit = (random() - .5) * 18;
        const i = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = base[channel] + band + mineral + grit;
        pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      for (let i = 0; i < 1600; i++) {
        const x = random() * width, y = random() * height;
        ctx.fillStyle = random() > .6 ? '#e8e5d638' : '#18232b24';
        ctx.beginPath(); ctx.ellipse(x, y, .4 + random() * 1.5, .3 + random() * .7, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
      // Slightly worn edges retain the appearance of a solid cut slab.
      ctx.strokeStyle = '#15212c30'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, width, height);
      // Preserve the inset border with a shallow engraved highlight.
      ctx.strokeStyle = chinese ? '#c0c7c080' : '#575e5880';
      ctx.lineWidth = 2; ctx.strokeRect(30, 22, width - 60, height - 44);
      ctx.strokeStyle = '#f0e8d52b'; ctx.lineWidth = 1;
      ctx.strokeRect(32, 24, width - 64, height - 48);
      background = document.createElement('canvas');
      background.width = width; background.height = height;
      background.getContext('2d')!.drawImage(canvas, 0, 0);
      stoneBackgrounds.set(book.language, background);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = chinese ? '#f7f3e8' : '#273238';
    ctx.font = '22px sans-serif'; ctx.fillText(chinese ? '中文' : 'NEDERLANDS', width / 2, 65);
    let fontSize = chinese ? 138 : 110;
    const font = () => `${fontSize}px "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.font = font();
    while (fontSize > 28 && ctx.measureText(book.title).width > width - 150) { fontSize -= 4; ctx.font = font(); }
    const lines: string[] = []; let line = '';
    for (const character of book.title) {
      if (ctx.measureText(line + character).width > width - 150 && line) { lines.push(line); line = ''; }
      line += character;
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 5);
    if (lines.length > 5) shown[4] = shown[4].slice(0, -1) + '…';
    shown.forEach((text, i) => ctx.fillText(text, width / 2, height * .61 + (i - (shown.length - 1) / 2) * fontSize * 1.15));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  };
  function coverMaterial(book: Flashcard) {
    const cached = covers.get(book.id);
    if (cached && cached.title === book.title && cached.language === book.language) {
      // Refresh insertion order for the bounded least-recently-used cache.
      covers.delete(book.id); covers.set(book.id, cached);
      return cached.material;
    }
    const material = new THREE.MeshBasicMaterial({ map: placeholder(book) });
    covers.set(book.id, { title: book.title, language: book.language, material });
    return material;
  }
  function removeBook(id: number, group: THREE.Group) {
    scene.remove(group);
    reflectedStones.remove(reflectionMeshes.get(id)!); reflectionMeshes.delete(id);
    bookMeshes.delete(id); bookDrops.delete(id);
  }
  function clearBooks() {
    for (const [id, mesh] of bookMeshes) removeBook(id, mesh);
    for (const { material } of covers.values()) { material.map?.dispose(); material.dispose(); }
    covers.clear();
  }
  function trimCovers() {
    if (covers.size <= VISIBLE_BOOK_COUNT * 3) return;
    const used = new Set([...bookMeshes.values()].map(group => (group.children[1] as THREE.Mesh).material));
    for (const [id, { material }] of covers) {
      if (covers.size <= VISIBLE_BOOK_COUNT * 3) break;
      if (!used.has(material)) { material.map?.dispose(); material.dispose(); covers.delete(id); }
    }
  }
  function render(delta: number) {
    if (disposed) return false;
    let animating = false;
    nave.position.z = ((position % 10) + 10) % 10;
    floor.position.z = -80 + ((position % 4) + 4) % 4;
    if (!books.length) { renderer.render(scene, camera); return false; }
    const index = currentBookIndex(position);
    if (index !== current) {
      if (Number.isFinite(current) && Math.floor(index / books.length) > Math.floor(current / books.length)) onComplete();
      current = index; onCurrent(deckIndex(index, books.length));
    }
    // A bounded GPU window over an infinite, reversible row. Repeated cards use
    // distinct occurrence indices while sharing the same cover texture.
    const start = index - PASSED_BOOK_CACHE_COUNT;
    const roundEnd = (Math.floor(index / books.length) + 1) * books.length;
    const previewNextRound = roundEnd - 1 - index <= REPEAT_PREVIEW_REMAINING;
    const end = previewNextRound ? index + VISIBLE_BOOK_COUNT : Math.min(roundEnd, index + VISIBLE_BOOK_COUNT);
    const upcoming = Array.from({ length: end - index }, (_, offset) => books[deckIndex(index + offset, books.length)].title);
    renderer.domElement.setAttribute('aria-description', upcoming.join(' → '));
    for (const [id, mesh] of bookMeshes) if (id < start || id >= end) removeBook(id, mesh);
    for (let bookIndex = start; bookIndex < end; bookIndex++) {
      const book = books[deckIndex(bookIndex, books.length)];
      let group = bookMeshes.get(bookIndex);
      if (!group) {
        group = new THREE.Group();
        bookDrops.set(bookIndex, bookIndex < index ? 1 : 0);
        group.add(new THREE.Mesh(bookGeometry, book.language === 'zh' ? blueStone : whiteStone));
        const cover = new THREE.Mesh(frontGeometry, coverMaterial(book)); cover.position.z = BOOK_THICKNESS / 2 + .005; group.add(cover);
        bookMeshes.set(bookIndex, group); scene.add(group);
        const reflected = group.clone();
        reflectionMeshes.set(bookIndex, reflected); reflectedStones.add(reflected);
      }
      const passed = bookIndex < index;
      const drop = advanceBookDrop(bookDrops.get(bookIndex) ?? 0, passed, delta, reducedMotion.matches);
      bookDrops.set(bookIndex, drop);
      animating ||= drop !== (passed ? 1 : 0);
      const easedDrop = drop * drop * (3 - 2 * drop);
      // Keep departing books clear of the camera and move fully below even a portrait frustum.
      const depth = Math.max(nearDistance, nearDistance + bookIndex * BOOK_SPACING - position);
      const dropDistance = Math.max(14, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth + 4);
      group.position.set(0, stoneCenterY - easedDrop * dropDistance, -depth);
      // Cached books require no draw calls once the exit completes.
      group.visible = drop < 1;
    }
    trimCovers();
    renderer.render(scene, camera);
    return animating;
  }
  function tick(time: number) {
    frame = 0;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, .15) : 0;
    previousTime = time;
    const keyboardDirection = Number(heldKeys.has('arrowup')) - Number(heldKeys.has('arrowdown'));
    const movement = direction || keyboardDirection;
    if (target !== null) {
      const step = WALK_SPEED * 2 * delta;
      const remaining = target - position;
      position = Math.abs(remaining) <= step ? target : position + Math.sign(remaining) * step;
      if (position === target) target = null;
    } else if (books.length) position += movement * WALK_SPEED * speed * delta;
    host.dataset.position = position.toFixed(4);
    const animating = render(delta);
    // Finish the downward exit even after the user releases the walking control.
    const canContinue = movement !== 0 && books.length > 0;
    if (canContinue || animating || target !== null) frame = requestAnimationFrame(tick); else previousTime = 0;
  }
  function invalidate() { if (!disposed && !frame) frame = requestAnimationFrame(tick); }
  const keydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (event.altKey || event.ctrlKey || event.metaKey || isMovementTarget(event.target) || !['arrowup', 'arrowdown'].includes(key)) return;
    event.preventDefault(); target = null; heldKeys.add(key); invalidate();
  };
  const keyup = (event: KeyboardEvent) => { heldKeys.delete(event.key.toLowerCase()); };
  const stop = () => { heldKeys.clear(); direction = 0; target = null; };
  const visibility = () => { if (document.hidden) stop(); };
  const contextLost = (event: Event) => { event.preventDefault(); stop(); onError(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', visibility); renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const observer = new ResizeObserver(() => {
    camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
    // Preserve the full aisle on narrow screens instead of cropping both covers.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(58 / 2)) * Math.max(1, 1.25 / camera.aspect)));
    // Keep the whole nearest slab in frame, including at the final stop.
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    nearDistance = Math.max(3.5, 2.85 / (halfFov * camera.aspect), 3 / halfFov) + BOOK_THICKNESS / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    parquet.resize(Math.min(960, host.clientWidth * renderer.getPixelRatio()), Math.min(960, host.clientHeight * renderer.getPixelRatio())); invalidate();
  });
  // One shared image texture for every repeated wall bay.
  const wallpaper = keep(new THREE.TextureLoader().load('/textures/nave-wall-water.jpg', texture => {
    if (disposed) { texture.dispose(); return; }
    wall.map = texture;
    wall.color.set('#ffffff');
    wall.needsUpdate = true;
    invalidate();
  }));
  wallpaper.colorSpace = THREE.SRGBColorSpace;
  fitWallpaper(wallpaper);
  wallpaper.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  observer.observe(host); invalidate();
  return {
    update(next: Flashcard[], reset: boolean) {
      clearBooks(); books = next;
      if (reset) { position = 0; current = Number.NaN; stop(); }
      invalidate();
    },
    move(value: number) { target = null; direction = value; invalidate(); },
    step(value: number) {
      stop();
      if (books.length) target = adjacentStone(position, value);
      invalidate();
    },
    setSpeed(value: number) { speed = Math.max(.25, Math.min(3, value)); },
    stop,

    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      clearBooks(); stoneBackgrounds.clear();
      parquet.dispose();
      resources.forEach(resource => resource.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
