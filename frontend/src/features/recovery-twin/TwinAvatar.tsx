import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import {
  Box3,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  type PerspectiveCamera,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useTheme } from '@/app/themeStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { kneeRotationRadians, REST_POSE_ANGLE_DEG } from './angleMapping';
import { RotateCcw, ZoomIn, ZoomOut } from '@/components/icon';

const RIG_URL = '/models/twin-rig.glb';
useGLTF.preload(RIG_URL);

/** Three.js cannot parse CSS var(), so resolve tokens to concrete colours here. */
function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

interface TwinPalette {
  primary: string;
  compare: string;
  neutral: string;
  frame: string;
  /** Hemisphere light poles, so the ambient fill follows the active theme. */
  sky: string;
  ground: string;
}

/* The two avatars sit side by side, so this is the app's only real two-series
   comparison: it takes series slots 1 and 2, the pair validated for
   colour-blind separation in src/index.css. (It used slot 3, which measured
   dE 2.2 from slot 2 under deuteranopia.) */
function makePalette(): TwinPalette {
  return {
    primary: cssColor('--chart-1', '#129086'),
    compare: cssColor('--chart-2', '#c17f11'),
    neutral: cssColor('--muted-foreground', '#94a3b8'),
    frame: cssColor('--foreground', '#475569'),
    sky: cssColor('--card', '#ffffff'),
    ground: cssColor('--muted-bg', '#eef3f6'),
  };
}

class AvatarErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      /* `.twin-fallback` carries no rules in index.css, so the panel's own
         centring and padding are set here — without them the message sat
         flush in the corner of the canvas box. */
      <p
        className="twin-fallback grid h-full place-content-center p-4 text-center text-sm text-[var(--muted-foreground)]"
        role="status"
      >
        Interactive 3D view is unavailable in this browser. The measured values are still shown
        beside it.
      </p>
    ) : (
      this.props.children
    );
  }
}

function SvgAvatar({
  angle,
  variant,
  palette,
  kind,
}: {
  angle: number | null;
  variant: 'primary' | 'compare';
  palette: TwinPalette;
  kind: 'measured' | 'target';
}) {
  const color = variant === 'primary' ? palette.primary : palette.compare;
  const missing = angle === null;
  const kneeX = 70 + ((angle ?? 72) / 100) * 60;
  const kneeY = 165 - ((angle ?? 72) / 100) * 55;
  return (
    /* Sized here for the same reason as `.twin-fallback` above: the class has
       no rules, and the default preserveAspectRatio keeps the schematic
       centred and undistorted inside the canvas box. */
    <svg className="twin-fallback-svg h-full w-full" viewBox="0 0 200 200" role="presentation">
      <rect x="15" y="175" width="170" height="10" fill={palette.neutral} />
      <line
        x1="60"
        y1="40"
        x2="65"
        y2="100"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <line
        x1="65"
        y1="100"
        x2="115"
        y2="100"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />
      {!missing ? (
        <line
          x1="115"
          y1="100"
          x2={kneeX}
          y2={kneeY}
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
        />
      ) : null}
      <text x="10" y="195" fontSize="9" fill={palette.frame}>
        {kind === 'target'
          ? 'schematic 2D fallback — configured target, not a measurement'
          : 'schematic 2D fallback — measured plane only'}
      </text>
    </svg>
  );
}

/**
 * Loads the Blender-sculpted rig (10 named nodes, 3 named materials — see
 * frontend/public/models/twin-rig.glb and the Blender build that produced it)
 * and clones it per instance: useGLTF caches one shared scene per URL, but this
 * screen mounts two avatars (primary + an earlier-session comparison) at once,
 * each needing its own colour and its own independently-rotating knee.
 *
 * Materials are matched by the exact names authored in Blender — TwinLimb,
 * TwinJoint, TwinNeutral — and replaced with fresh MeshStandardMaterial
 * instances built from the live theme palette, so the model stays as
 * theme-aware as the primitive rig it replaced; nothing from Blender's own
 * baked colours ships to the page.
 *
 * The lower leg (Shin, AnkleJoint, Foot) is re-parented at runtime under a new
 * group positioned at the KneePivot empty's world position, using
 * Object3D.attach() — which recomputes local transforms from current world
 * transforms, so the knee hinge is correct regardless of how Blender's own
 * axis conventions mapped onto three.js's, rather than by trusting an angle
 * guess. Everything in the source mesh was authored with zero depth (Blender's
 * Y axis), so after the glTF up-axis conversion the whole rig lies flat in the
 * camera's view plane and rotating the hinge group's world Z bends the leg
 * within that plane — the same axis the previous primitive rig animated.
 */
function useTwinRigScene() {
  const { scene } = useGLTF(RIG_URL);
  return useMemo(() => {
    const cloned = scene.clone(true);
    const lowerLeg = new Group();
    lowerLeg.name = 'LowerLeg';
    const kneePivot = cloned.getObjectByName('KneePivot');
    if (kneePivot) {
      kneePivot.getWorldPosition(lowerLeg.position);
    }
    cloned.add(lowerLeg);
    for (const name of ['Shin', 'AnkleJoint', 'Foot']) {
      const node = cloned.getObjectByName(name);
      if (node) lowerLeg.attach(node);
    }
    /* Measured, never hardcoded: the asset's own units are its business, not
       this component's. The rig is authored off-origin (its bounds run x
       -0.75..1.68), so without recentring it orbits around a point outside
       itself and sits well right of frame. Shifting it so its bounding-box
       centre is the origin makes the orbit target, the camera fit and
       OrbitControls' reset all agree on where the subject is. */
    const box = new Box3().setFromObject(cloned);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    cloned.position.sub(center);
    return { cloned, lowerLeg, size };
  }, [scene]);
}

/**
 * Everything that has to be sized from the rig's measured bounds: the camera
 * fit and the shadow-casting key light. Both read the same measurement the rig
 * does, so neither hardcodes the asset's units.
 */
function RigStage({ shadowMapSize }: { shadowMapSize: number }) {
  const { size } = useTwinRigScene();
  // Half-diagonal plus a little, so the ortho frustum covers the rig at any
  // knee angle without wasting map on empty space.
  const shadowExtent = Math.hypot(size.x, size.y, size.z) * 0.62;

  return (
    <>
      <FitView size={size} />
      <directionalLight
        position={[2.5, 3.5, 3]}
        /* Key dropped from 1.05 and fill raised, taking the ratio from roughly
           3:1 to 2:1 — enough modelling to read the bend, not the hard raking
           light of a product shot. */
        intensity={0.6}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.02}
        shadow-radius={3}
        /* The shadow camera defaults to a +/-5 unit box. Over a subject 2.4
           units wide that spent most of the map on empty space, so the limb's
           shadow on the bench was too mushy to read and the two never looked
           related. Fitted to the rig it resolves far finer for the same map. */
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.1}
        shadow-camera-far={shadowExtent * 12}
      />
    </>
  );
}

/** Unit direction of the default three-quarter view, preserved across fits. */
const VIEW_DIR = new Vector3(1.15, 0.45, 3.15).normalize();

/**
 * Frames the rig to whatever shape the canvas actually is. The viewer is a
 * 1078x280 strip on a wide desktop card, a ~360x200 block on a phone and a
 * 140px-tall sliver on the landing page; a single hardcoded camera distance
 * left the subject filling a quarter of the frame in the first case and
 * overflowing in the last. Distance is solved from the measured bounds against
 * the live vertical AND horizontal field of view, so the rig reads the same
 * size in all three.
 *
 * Zoom limits are derived from that fit rather than fixed, and the fitted view
 * is saved as the control's rest state so "Reset view" returns here instead of
 * to the pre-fit camera OrbitControls captured when it was constructed.
 */
function FitView({ size }: { size: Vector3 }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const aspect = useThree((state) => state.viewport.aspect);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!controls) return;
    const vFov = camera.fov * MathUtils.DEG2RAD;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // Half-width uses the x/z diagonal so the fit still holds at the extremes
    // of the permitted azimuth, and a margin leaves air as the knee bends.
    const halfHeight = size.y / 2;
    const halfWidth = Math.hypot(size.x, size.z) / 2;
    const distance =
      Math.max(halfHeight / Math.tan(vFov / 2), halfWidth / Math.tan(hFov / 2)) * 1.16;

    controls.target.set(0, 0, 0);
    camera.position.copy(VIEW_DIR).multiplyScalar(distance);
    camera.near = Math.max(distance / 100, 0.01);
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 2.1;
    controls.update();
    controls.saveState();
    invalidate();
  }, [camera, controls, aspect, size, invalidate]);

  return null;
}

/**
 * Eases the lower leg toward the measured angle instead of snapping between
 * frames. This is a readability aid on a value that is already recorded — the
 * rig never invents motion of its own, so it still shows only measured angles
 * (there is deliberately no idle "breathing" loop, which would imply movement
 * that was never measured). When the angle is unavailable the rig holds its
 * last pose rather than easing toward a fabricated default.
 */
function TwinRig({
  angle,
  color,
  palette,
  missing,
  reducedMotion,
}: {
  angle: number | null;
  color: string;
  palette: TwinPalette;
  missing: boolean;
  reducedMotion: boolean;
}) {
  const { cloned, lowerLeg } = useTwinRigScene();
  /* Reduced motion runs the canvas with frameloop="demand", where nothing is
     drawn unless something asks for a frame. Mutating three objects from an
     effect is invisible to the reconciler, so each effect below asks: without
     this, a reduced-motion viewer froze on the first frame of the replay while
     the printed values beside it kept advancing. */
  const invalidate = useThree((state) => state.invalidate);
  /* See angleMapping.ts: the rig's rest pose is a straight leg, which the
     backend reports as 180 degrees. This was `(angle - 90)`, which put rest at
     a right angle — so every measurement rendered 90 degrees straighter than
     it was, and anything above 90 appeared hyperextended above straight. */
  const targetRotation = kneeRotationRadians(angle ?? REST_POSE_ANGLE_DEG);

  // Materials are matched by Blender-authored name, not node name, since one
  // material (TwinJoint) covers hip/knee/ankle and the foot.
  useEffect(() => {
    /* `name` is carried onto the replacement deliberately: this effect re-runs
       on every theme change and on every missing-frame flip, and it re-matches
       on the name it finds. An unnamed replacement matched nothing on the
       second pass, which silently froze the rig at its first colour — theme
       changes and the missing-frame fade both stopped applying.
       Everything installed here is this instance's own and is disposed when the
       effect re-runs or unmounts; the glTF's materials belong to useGLTF's
       shared cache and must never be disposed from here. */
    const installed: MeshStandardMaterial[] = [];
    const install = (child: Mesh, material: MeshStandardMaterial) => {
      child.material = material;
      installed.push(material);
    };
    cloned.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const sourceName = child.material instanceof MeshStandardMaterial ? child.material.name : '';
      if (sourceName === 'TwinLimb') {
        install(
          child,
          new MeshStandardMaterial({
            name: sourceName,
            color,
            /* Fully non-metallic and rougher than the asset's own 0.42: the
               limb is a matte moulded surface, and the tighter highlight the
               asset shipped read as a shiny toy. */
            roughness: 0.62,
            metalness: 0,
            transparent: missing,
            opacity: missing ? 0.25 : 1,
          }),
        );
        child.castShadow = true;
      } else if (sourceName === 'TwinJoint') {
        install(
          child,
          new MeshStandardMaterial({
            name: sourceName,
            /* A darker tone of the limb's own hue rather than near-black ink.
               As --foreground the joints became the highest-contrast thing on
               screen — five black beads that read as a toy armature and pulled
               the eye off the angle the view exists to show. */
            color: new Color(color).lerp(new Color(palette.frame), 0.55),
            roughness: 0.55,
            metalness: 0,
            transparent: missing,
            opacity: missing ? 0.3 : 1,
          }),
        );
        child.castShadow = true;
      } else if (sourceName === 'TwinNeutral') {
        install(
          child,
          new MeshStandardMaterial({
            name: sourceName,
            /* The bench is context, not subject: mixed most of the way to the
               canvas backdrop so it recedes behind the measured limb. */
            color: new Color(palette.neutral).lerp(new Color(palette.ground), 0.6),
            roughness: 0.92,
            metalness: 0,
          }),
        );
        child.receiveShadow = true;
      }
    });
    invalidate();
    return () => {
      for (const material of installed) material.dispose();
    };
  }, [cloned, color, palette, missing, invalidate]);

  // No measurement this frame → nothing to show below the knee, same as the
  // primitive rig simply never rendering the lower leg in that case.
  useEffect(() => {
    lowerLeg.visible = !missing;
    invalidate();
  }, [lowerLeg, missing, invalidate]);

  /* Reduced motion gets the measured pose immediately, with no easing.
     A missing frame is deliberately NOT written: the lower leg is hidden for
     those frames, and posing it from a stand-in angle would leave a fabricated
     pose behind for the next frame to ease away from. It holds its last
     measured pose instead, which is what the component promises. */
  useEffect(() => {
    if (reducedMotion && !missing) {
      lowerLeg.rotation.z = targetRotation;
      invalidate();
    }
  }, [lowerLeg, reducedMotion, missing, targetRotation, invalidate]);

  useFrame((_, delta) => {
    if (reducedMotion || missing) return;
    // damp is frame-rate independent, so the ease looks the same at 60 and 144Hz.
    lowerLeg.rotation.z = MathUtils.damp(
      lowerLeg.rotation.z,
      targetRotation,
      6,
      Math.min(delta, 0.1),
    );
  });

  /* No ContactShadows plane here on purpose. The bend happens in the XY plane,
     so the camera has to stay near that plane for the angle to read truthfully
     — and at that shallow elevation a horizontal shadow catcher is edge-on. The
     only height it could sit at is the bench surface, which the opaque slab
     occludes, and the limb hovers 0.9 units above it in the asset. It rendered
     a depth pass every frame and produced nothing visible. Grounding comes from
     the key light's shadow and the canvas backdrop instead. */
  return (
    <group>
      <primitive object={cloned} />
    </group>
  );
}

/** What the on-screen and keyboard controls can do to the camera. */
interface ViewerApi {
  zoomBy: (factor: number) => void;
  orbitBy: (azimuthDeg: number, polarDeg: number) => void;
  reset: () => void;
}

/**
 * Lives inside the Canvas so it can reach the camera, and publishes the camera
 * operations to the surrounding DOM through a ref. That is what lets the
 * buttons and key handlers outside the canvas drive the view — the whole point
 * of this viewer not being mouse-only.
 */
function ViewerBridge({
  apiRef,
  controlsRef,
}: {
  apiRef: React.MutableRefObject<ViewerApi | null>;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const offset = new Vector3();
    apiRef.current = {
      zoomBy(factor) {
        const controls = controlsRef.current;
        if (!controls) return;
        offset.copy(camera.position).sub(controls.target);
        const distance = MathUtils.clamp(
          offset.length() * factor,
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
        invalidate();
      },
      orbitBy(azimuthDeg, polarDeg) {
        const controls = controlsRef.current;
        if (!controls) return;
        controls.setAzimuthalAngle(controls.getAzimuthalAngle() + azimuthDeg * MathUtils.DEG2RAD);
        controls.setPolarAngle(
          MathUtils.clamp(
            controls.getPolarAngle() + polarDeg * MathUtils.DEG2RAD,
            controls.minPolarAngle,
            controls.maxPolarAngle,
          ),
        );
        controls.update();
        invalidate();
      },
      reset() {
        controlsRef.current?.reset();
        invalidate();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [camera, invalidate, apiRef, controlsRef]);

  return null;
}

/**
 * Neutral, non-identifiable schematic avatar. It visualises the SAME projected
 * angle trace shown in metrics; it is not a true 3D biomechanical reconstruction
 * and has no patient-identifying features.
 *
 * `kind` controls only the wording of the aria-label and SVG-fallback caption,
 * never the geometry or material: 'measured' (default) describes a value that
 * was actually recorded by the app; 'target' describes a clinician-configured
 * goal angle that has not been measured yet (e.g. a protocol's target range).
 * Conflating the two wordings would let this component claim a measurement
 * that never happened, so every caller must say which one it is passing.
 */
export default function TwinAvatar({
  angle,
  variant,
  kind = 'measured',
  interactive = false,
  context,
}: {
  angle: number | null;
  variant: 'primary' | 'compare';
  kind?: 'measured' | 'target';
  /**
   * Adds zoom, the on-screen control bar and keyboard orbiting. Off by default
   * so the small inline previews (protocol target, session result, landing)
   * stay decorative and uncluttered — rotation by drag works in all of them.
   */
  interactive?: boolean;
  /**
   * Which reading this instance is showing ('this session', 'earlier
   * session'), appended to the accessible name. Optional, because a lone
   * preview needs no disambiguation; the comparison view mounts two avatars
   * whose labels are otherwise word-for-word identical, which left a screen
   * reader unable to tell them apart. Never changes what is drawn.
   */
  context?: string;
}) {
  const { themeId } = useTheme();
  const reducedMotion = useReducedMotion();
  const narrow = useMediaQuery('(max-width: 640px)');
  const apiRef = useRef<ViewerApi | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  /* Wheel zoom is armed only while the viewer has focus or is being used, so
     scrolling the page past the canvas never zooms it by accident. Pinch zoom
     is not gated: it takes two fingers, which is never a page scroll. */
  const [armed, setArmed] = useState(false);
  const hintId = useId();
  const shadowMapSize = narrow ? 512 : 1024;
  const [palette, setPalette] = useState<TwinPalette>(makePalette);

  useEffect(() => {
    setPalette(makePalette());
  }, [themeId]);
  const kneeAngle = angle ?? 90;
  const color = variant === 'primary' ? palette.primary : palette.compare;
  const missing = angle === null;
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      setWebgl(Boolean(probe.getContext('webgl2') || probe.getContext('webgl')));
    } catch {
      setWebgl(false);
    }
  }, []);

  /* Arrow keys orbit, +/- zoom, 0 restores the default view. preventDefault
     keeps the arrows from scrolling the page while the viewer holds focus. */
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const api = apiRef.current;
    if (!api) return;
    const step = 12;
    switch (event.key) {
      case 'ArrowLeft':
        api.orbitBy(-step, 0);
        break;
      case 'ArrowRight':
        api.orbitBy(step, 0);
        break;
      case 'ArrowUp':
        api.orbitBy(0, -step);
        break;
      case 'ArrowDown':
        api.orbitBy(0, step);
        break;
      case '+':
      case '=':
        api.zoomBy(1 / 1.2);
        break;
      case '-':
      case '_':
        api.zoomBy(1.2);
        break;
      case '0':
        api.reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  }, []);

  const suffix = context ? ` (${context})` : '';
  const label =
    (kind === 'target'
      ? `Schematic preview of a configured target knee angle of ${Math.round(kneeAngle)} degrees — not a measurement`
      : missing
        ? 'Schematic avatar: measurement unavailable for this frame; no motion is shown'
        : `Schematic avatar with lower leg at a projected knee angle estimate of ${Math.round(kneeAngle)} degrees`) +
    suffix;

  const scene = (
    <>
      {/* webgl === null is "not probed yet", one tick after mount. Rendering
          nothing for it keeps the box empty for that tick instead of flashing
          the 2D fallback schematic and replacing it. */}
      {webgl === null ? null : webgl ? (
        <AvatarErrorBoundary>
          {/* A three-quarter camera rather than dead-on elevation: the bend at
              the knee is the subject, and it reads as a bend only when the
              limb has some depth across the frame.
              Phones get half the device-pixel ceiling and a quarter of the
              shadow resolution — this canvas is decorative, and every value it
              shows is also printed beside it as text. */}
          <Canvas
            camera={{ position: [1.15, 0.45, 3.15], fov: 42 }}
            dpr={narrow ? [1, 1.5] : [1, 2]}
            shadows="soft"
            /* `flat` = NoToneMapping. R3F defaults to ACES filmic, which is a
               film-camera response curve: it desaturates and darkens the limb
               away from --chart-1, and that hue is validated series identity
               here, not decoration. Rendering flat keeps what is on screen
               equal to the token. */
            flat
            frameloop={reducedMotion ? 'demand' : 'always'}
          >
            {/* Hemisphere light for the soft top-down fill a treatment room
                has, then a three-point rig over it: key casts, fill lifts the
                shade side, rim separates the figure from the card. */}
            <hemisphereLight args={[palette.sky, palette.ground, 0.78]} />
            <ambientLight intensity={0.34} />
            <directionalLight position={[-3, 1.5, 2]} intensity={0.3} />
            {/* A quiet separation light, not a rim: at 0.45 it drew a bright
                edge that made the schematic look lit for effect. */}
            <directionalLight position={[-1, 2, -3]} intensity={0.16} />
            {/* useGLTF suspends on first fetch of the rig asset; fallback is
                empty rather than a placeholder mesh, since the skeleton/empty
                canvas already communicates "loading" via the surrounding UI. */}
            <Suspense fallback={null}>
              <TwinRig
                angle={angle}
                color={color}
                palette={palette}
                missing={missing}
                reducedMotion={reducedMotion}
              />
            </Suspense>
            <Suspense fallback={null}>
              <RigStage shadowMapSize={shadowMapSize} />
            </Suspense>
            {interactive ? <ViewerBridge apiRef={apiRef} controlsRef={controlsRef} /> : null}
            {/* Panning stays off: the subject is always centred, so dragging
                it out of frame has no use and only loses people. Zoom is
                clamped to a range that keeps the figure framed, and every
                value the view shows is also printed as text beside it, so
                orbiting is never the only way to read this screen. */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enablePan={false}
              enableZoom={interactive && armed}
              enableDamping={!reducedMotion}
              dampingFactor={0.08}
              rotateSpeed={0.55}
              zoomSpeed={0.7}
              minDistance={1.8}
              maxDistance={5.5}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={(Math.PI * 3) / 4}
              minAzimuthAngle={-Math.PI / 3}
              maxAzimuthAngle={Math.PI / 3}
            />
          </Canvas>
        </AvatarErrorBoundary>
      ) : (
        <SvgAvatar angle={angle} variant={variant} palette={palette} kind={kind} />
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className="twin-canvas" role="img" aria-label={label}>
        {scene}
      </div>
    );
  }

  return (
    <div className="twin-viewer">
      <div
        className="twin-canvas"
        role="img"
        aria-label={label}
        aria-describedby={hintId}
        /* Doubles as the styling hook for the "scrolling here will zoom"
           affordance, so the armed state is visible rather than a surprise. */
        data-armed={armed || undefined}
        /* Focusable so the view can be orbited from the keyboard, not just by
           dragging with a mouse. */
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setArmed(true)}
        onBlur={() => setArmed(false)}
        onPointerDown={() => setArmed(true)}
        onPointerLeave={() => setArmed(false)}
        /* Arming wheel zoom is not enough on its own: OrbitControls listens on
           the canvas and calls preventDefault, so a disarmed wheel event has
           to be stopped before it ever reaches the canvas. Capturing here on
           the ancestor does that, and leaves the page free to scroll. */
        onWheelCapture={(event) => {
          if (!armed) event.stopPropagation();
        }}
      >
        {scene}
      </div>

      <div className="twin-viewer-bar">
        {/* States every key the viewer already answers to: the zoom and reset
            shortcuts were otherwise discoverable only by trying them. */}
        <p id={hintId} className="twin-viewer-hint">
          Drag or use the arrow keys to rotate. Pinch, or focus the view and scroll, to zoom; the +
          and − keys zoom and 0 restores this view. Changing the view never changes a measurement.
        </p>
        <div className="twin-viewer-actions">
          <button
            type="button"
            onClick={() => apiRef.current?.zoomBy(1 / 1.2)}
            className="icon-btn icon-btn-flush twin-viewer-button"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.zoomBy(1.2)}
            className="icon-btn icon-btn-flush twin-viewer-button"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.reset()}
            className="icon-btn twin-viewer-button twin-viewer-button-wide"
          >
            <RotateCcw className="size-4" />
            Reset view
          </button>
        </div>
      </div>
    </div>
  );
}
