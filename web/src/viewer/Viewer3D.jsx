/**
 * Viewer3D.jsx — Khung xem 3D của nhân vật (three.js), nhúng vào React.
 *
 * Nhận `threeD` (tham số từ Character Engine) và dựng lại nhân vật mỗi khi tham số đổi.
 * Nếu có `modelUrl` (GLB do Blender dựng) thì ưu tiên hiển thị model đó.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildCharacter } from './figure.js';

const BG_TOP = '#101827';

export default function Viewer3D({
  threeD,
  animate = true,
  wireframe = false,
  modelUrl = null,
  onApi,
  className = '',
}) {
  const hostRef = useRef(null);
  const stateRef = useRef(null);
  const threeDRef = useRef(threeD);
  const animateRef = useRef(animate);
  const wireframeRef = useRef(wireframe);

  threeDRef.current = threeD;
  animateRef.current = animate;
  wireframeRef.current = wireframe;

  // ── Khởi tạo scene một lần ────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_TOP);
    scene.fog = new THREE.Fog(BG_TOP, 6, 16);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    camera.position.set(0, 1.05, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.92, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.9;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.update();

    // Đèn: môi trường + đèn chính có bóng + đèn viền + đèn phụ
    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a2f3d, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.2, 3.4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2.6;
    key.shadow.camera.right = 2.6;
    key.shadow.camera.top = 3.2;
    key.shadow.camera.bottom = -0.4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb6ff, 1.0);
    rim.position.set(-2.4, 1.8, -2.2);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe7cf, 0.55);
    fill.position.set(-1.2, 1.2, 2.4);
    scene.add(fill);

    // Sàn + lưới toạ độ
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x232c42, roughness: 0.95, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(9, 36, 0x3b4a6b, 0x2b3550);
    grid.position.y = 0.002;
    scene.add(grid);

    const state = {
      renderer, scene, camera, controls, figure: null, loaded: null,
      clock: new THREE.Clock(), raf: 0, host,
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const loop = () => {
      state.raf = requestAnimationFrame(loop);
      const t = state.clock.getElapsedTime();
      if (state.figure) state.figure.update(t, animateRef.current);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    // ── API điều khiển từ ngoài (React) ─────────────────────
    const api = {
      /** Chụp ảnh khung hình hiện tại -> dataURL PNG. */
      snapshot() {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
      /** Xuất GLB (glTF nhị phân) để dùng cho game/engine khác. */
      exportGLB(filename = 'nhan-vat.glb') {
        return new Promise((resolve) => {
          const target = state.loaded ?? state.figure?.group;
          if (!target) return resolve(null);
          new GLTFExporter().parse(
            target,
            (result) => {
              const blob = new Blob([result], { type: 'model/gltf-binary' });
              downloadBlob(blob, filename);
              return resolve(blob);
            },
            () => resolve(null),
            { binary: true },
          );
        });
      },
      exportJSON(spec, filename = 'nhan-vat.json') {
        downloadBlob(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }), filename);
      },
      resetView() {
        const H = threeDRef.current?.heightM ?? 1.7;
        camera.position.set(0, H * 0.62, H * 1.95);
        controls.target.set(0, H * 0.55, 0);
        controls.update();
      },
      setWireframe(on) {
        const root = state.loaded ?? state.figure?.group;
        root?.traverse((o) => { if (o.isMesh) o.material.wireframe = on; });
      },
      get scene() { return scene; },
    };

    stateRef.current = state;
    onApi?.(api);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      controls.dispose();
      state.figure?.dispose();
      if (state.loaded) disposeObject(state.loaded);
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dựng lại nhân vật khi tham số 3D đổi ──────────────────
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !threeD) return;
    if (state.figure) {
      state.scene.remove(state.figure.group);
      state.figure.dispose();
    }
    const figure = buildCharacter(threeD);
    state.figure = figure;
    state.scene.add(figure.group);
    state.camera.position.set(0, threeD.heightM * 0.62, threeD.heightM * 1.95);
    state.controls.target.set(0, threeD.heightM * 0.55, 0);
    state.controls.update();
  }, [threeD]);

  // ── Chuyển đổi chế độ lưới (wireframe) ───────────────────
  useEffect(() => {
    stateRef.current?.figure?.group.traverse((o) => { if (o.isMesh) o.material.wireframe = wireframe; });
  }, [wireframe, threeD]);

  // ── Tải model GLB (do Blender dựng) nếu có ────────────────
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !modelUrl) return undefined;
    let alive = true;
    new GLTFLoader().load(modelUrl, (gltf) => {
      if (!alive) return;
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      state.scene.add(gltf.scene);
      state.loaded = gltf.scene;
      if (state.figure) state.figure.group.visible = false;
    }, undefined, () => { /* tải lỗi -> giữ nhân vật procedural */ });
    return () => {
      alive = false;
      const s = stateRef.current;
      if (s?.loaded) {
        s.scene.remove(s.loaded);
        disposeObject(s.loaded);
        s.loaded = null;
      }
      if (s?.figure) s.figure.group.visible = true;
    };
  }, [modelUrl]);

  return <div ref={hostRef} className={`viewer3d ${className}`} />;
}

/** Tải file về máy người dùng. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose();
    }
  });
}
