import * as THREE from "three";
import { FACE_FRAG, FACE_VERT, RECORD } from "./shaders";

export type VinylController = {
  setPlaying: (playing: boolean) => void;
  dispose: () => void;
};

const TAU = Math.PI * 2;
const IDLE = TAU / 20; // one revolution every 20 s
const PLAY = TAU * (33.333 / 60); // 33⅓ rpm
const REDUCED_PLAY = TAU / 24; // reduced motion: slow turn only while audio plays
const SPIN_UP = 1.4; // damping rates (1/s)
const SPIN_DOWN = 0.9;
const LEAN = 3.2;
const MAX_LEAN_X = 0.07; // radians; small enough that the disc can never flip
const MAX_LEAN_Y = 0.09;
const BASE_PITCH = -0.16; // resting pose shows a sliver of the record's edge
const BASE_YAW = 0.2;
const FOV = 22;
const FRAME = RECORD.radius * 1.25; // half-size of the square view; leaves room for lean + shadow

// Light directions (camera space == world space; the camera never moves).
const KEY = new THREE.Vector3(-0.62, 0.48, 0.62).normalize();
const FILL = new THREE.Vector3(0.78, -0.08, 0.62).normalize();
const TOP = new THREE.Vector3(0.05, 0.85, 0.52).normalize();

// Purple paper label with the approved JazzHQ wordmark knocked out in white.
function makeLabel(maxAnisotropy: number, onUpdate: () => void) {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  const mid = size / 2;
  let logo: HTMLCanvasElement | null = null;

  const draw = () => {
    g.clearRect(0, 0, size, size);
    const grad = g.createRadialGradient(mid * 0.86, mid * 0.8, 0, mid, mid, mid);
    grad.addColorStop(0, "#5d56f2");
    grad.addColorStop(1, "#4f47e6");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    // Printed hairline rings.
    g.strokeStyle = "rgba(255,255,255,.22)";
    g.lineWidth = 2;
    for (const k of [0.94, 0.9]) { g.beginPath(); g.arc(mid, mid, mid * k, 0, TAU); g.stroke(); }
    g.strokeStyle = "rgba(255,255,255,.16)";
    g.beginPath(); g.arc(mid, mid, mid * 0.17, 0, TAU); g.stroke();

    if (logo) {
      const w = size * 0.5;
      const h = (w * logo.height) / logo.width;
      g.globalAlpha = 0.95;
      g.drawImage(logo, mid - w / 2, size * 0.3 - h / 2, w, h);
      g.globalAlpha = 1;
    }
    tex.needsUpdate = true;
    onUpdate();
  };

  draw();
  const img = new Image();
  img.onload = () => {
    const w = 1200;
    const h = Math.round(w * (61.25 / 380.67));
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const tg = t.getContext("2d")!;
    tg.drawImage(img, 0, 0, w, h);
    tg.globalCompositeOperation = "source-in";
    tg.fillStyle = "#fff";
    tg.fillRect(0, 0, w, h);
    logo = t;
    draw();
  };
  img.src = "/branding/jazzhq-logo.svg";
  return tex;
}

function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.72, "rgba(0,0,0,.85)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createVinyl(canvas: HTMLCanvasElement, host: HTMLElement, onFail: () => void): VinylController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let reduced = reducedQuery.matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 100, 4000);
  camera.position.set(0, 0, FRAME / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.6));
  for (const [dir, k] of [[KEY, 2.2], [FILL, 0.9], [TOP, 0.6]] as const) {
    const l = new THREE.DirectionalLight(0xffffff, k);
    l.position.copy(dir).multiplyScalar(1000);
    scene.add(l);
  }

  let needsRender = true;
  const label = makeLabel(renderer.capabilities.getMaxAnisotropy(), () => { needsRender = true; });

  // Soft contact shadow on the "page", offset away from the key light.
  const shadowTex = makeShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x1b1a16, transparent: true, opacity: 0.26, depthWrite: false }),
  );
  shadow.scale.setScalar(RECORD.radius * 2.06);
  shadow.position.set(7, -11, -36);
  scene.add(shadow);

  const pose = new THREE.Group(); // pitch / yaw + pointer lean
  const spinner = new THREE.Group(); // rotation about the spindle
  pose.add(spinner);
  scene.add(pose);

  const { radius: R, hole, thickness: T } = RECORD;
  const bead = 1.6; // raised outer edge bead

  const faceMat = new THREE.ShaderMaterial({
    vertexShader: FACE_VERT,
    fragmentShader: FACE_FRAG,
    uniforms: {
      uLabel: { value: label },
      uKey: { value: KEY },
      uFill: { value: FILL },
      uTop: { value: TOP },
      uGaps: { value: new THREE.Vector4(...RECORD.gaps) },
    },
  });
  const face = new THREE.Mesh(new THREE.RingGeometry(hole, R - bead, 256, 1), faceMat);
  face.position.z = T / 2;
  spinner.add(face);

  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x141415, roughness: 0.34, metalness: 0 });
  const profile = [
    [R - bead, -T / 2], [R - bead * 0.55, -T / 2 - 0.35], [R - 0.25, -T / 2 + 0.1],
    [R, 0], [R - 0.25, T / 2 - 0.1], [R - bead * 0.55, T / 2 + 0.35], [R - bead, T / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const edge = new THREE.Mesh(new THREE.LatheGeometry(profile, 256).rotateX(Math.PI / 2), edgeMat);
  spinner.add(edge);

  const back = new THREE.Mesh(new THREE.RingGeometry(hole, R - bead, 128, 1).rotateY(Math.PI), edgeMat);
  back.position.z = -T / 2;
  spinner.add(back);

  const holeWall = new THREE.Mesh(
    new THREE.CylinderGeometry(hole, hole, T, 32, 1, true).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6, side: THREE.BackSide }),
  );
  spinner.add(holeWall);

  // ── State ──
  let playing = false;
  let speed = reduced ? 0 : IDLE;
  const pointer = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };
  let visible = !document.hidden;

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onLeave = () => { pointer.x = 0; pointer.y = 0; };
  const onVisibility = () => { visible = !document.hidden; };
  const onReduced = () => { reduced = reducedQuery.matches; needsRender = true; };
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  reducedQuery.addEventListener("change", onReduced);

  const onLost = (e: Event) => { e.preventDefault(); onFail(); };
  canvas.addEventListener("webglcontextlost", onLost);

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    // Keep the drawing buffer bounded on very large or very dense screens.
    const ratio = Math.min(window.devicePixelRatio || 1, 2, 2200 / w);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, w, false);
    needsRender = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Dev-only probe so the play → spin sync can be checked from devtools; stripped from production builds.
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __vinyl?: object }).__vinyl = { get speed() { return speed; }, IDLE, PLAY };
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible) return;

    const target = reduced ? (playing ? REDUCED_PLAY : 0) : playing ? PLAY : IDLE;
    speed += (target - speed) * (1 - Math.exp(-dt * (target > speed ? SPIN_UP : SPIN_DOWN)));
    if (Math.abs(target - speed) < 1e-4) speed = target;
    spinner.rotation.z -= speed * dt; // clockwise, as on a turntable

    const tilt = !reduced && finePointer.matches;
    const ax = tilt ? pointer.y * MAX_LEAN_X : 0;
    const ay = tilt ? pointer.x * MAX_LEAN_Y : 0;
    const k = 1 - Math.exp(-dt * LEAN);
    lean.x += (ax - lean.x) * k;
    lean.y += (ay - lean.y) * k;
    pose.rotation.set(BASE_PITCH + lean.x, BASE_YAW + lean.y, 0);
    pose.position.set(lean.y * 30, -lean.x * 30, 0); // a few mm of parallax

    const settled = Math.abs(ax - lean.x) < 1e-5 && Math.abs(ay - lean.y) < 1e-5;
    if (speed === 0 && settled && !needsRender) return; // nothing moving: skip the frame
    needsRender = false;
    renderer.render(scene, camera);
  });

  return {
    setPlaying(next) { playing = next; needsRender = true; },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReduced);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      label.dispose();
      shadowTex.dispose();
      renderer.dispose();
    },
  };
}
