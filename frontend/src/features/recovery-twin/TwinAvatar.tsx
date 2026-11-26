import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Group, MathUtils, Mesh, MeshStandardMaterial } from 'three';
import { useTheme } from '@/app/themeStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
}

function makePalette(): TwinPalette {
  return {
    primary: cssColor('--chart-1', '#0f766e'),
    compare: cssColor('--chart-3', '#7c3aed'),
    neutral: cssColor('--muted-foreground', '#94a3b8'),
    frame: cssColor('--foreground', '#475569'),
  };
}

class AvatarErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="twin-fallback" role="status">
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
    <svg className="twin-fallback-svg" viewBox="0 0 200 200" role="presentation">
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
    return { cloned, lowerLeg };
  }, [scene]);
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
  const targetRotation = (((angle ?? 90) - 90) * Math.PI) / 180;

  // Materials are matched by Blender-authored name, not node name, since one
  // material (TwinJoint) covers hip/knee/ankle and the foot.
  useEffect(() => {
    cloned.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const sourceName = child.material instanceof MeshStandardMaterial ? child.material.name : '';
      if (sourceName === 'TwinLimb') {
        child.material = new MeshStandardMaterial({
          color,
          roughness: 0.42,
          metalness: 0.04,
          transparent: missing,
          opacity: missing ? 0.25 : 1,
        });
        child.castShadow = true;
      } else if (sourceName === 'TwinJoint') {
        child.material = new MeshStandardMaterial({
          color: palette.frame,
          roughness: 0.3,
          metalness: 0.12,
          transparent: missing,
          opacity: missing ? 0.3 : 1,
        });
        child.castShadow = true;
      } else if (sourceName === 'TwinNeutral') {
        child.material = new MeshStandardMaterial({ color: palette.neutral, roughness: 0.8 });
        child.receiveShadow = true;
      }
    });
  }, [cloned, color, palette, missing]);

  // No measurement this frame → nothing to show below the knee, same as the
  // primitive rig simply never rendering the lower leg in that case.
  useEffect(() => {
    lowerLeg.visible = !missing;
  }, [lowerLeg, missing]);

  // Reduced motion (or a missing measurement) gets the final pose immediately.
  useEffect(() => {
    if (reducedMotion || missing) {
      lowerLeg.rotation.z = targetRotation;
    }
  }, [lowerLeg, reducedMotion, missing, targetRotation]);

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

  return <primitive object={cloned} position={[0, -0.2, 0]} />;
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
}: {
  angle: number | null;
  variant: 'primary' | 'compare';
  kind?: 'measured' | 'target';
}) {
  const { themeId } = useTheme();
  const reducedMotion = useReducedMotion();
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

  return (
    <div
      className="twin-canvas"
      role="img"
      aria-label={
        kind === 'target'
          ? `Schematic preview of a configured target knee angle of ${Math.round(kneeAngle)} degrees — not a measurement`
          : missing
            ? 'Schematic avatar: measurement unavailable for this frame; no motion is shown'
            : `Schematic avatar with lower leg at a projected knee angle estimate of ${Math.round(kneeAngle)} degrees`
      }
    >
      {webgl ? (
        <AvatarErrorBoundary>
          <Canvas camera={{ position: [0, 0.35, 3.4], fov: 45 }} dpr={[1, 2]} shadows>
            {/* Three-point setup: key light casts, fill lifts the shade side,
                rim separates the figure from the card background. */}
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[2.5, 3.5, 3]}
              intensity={1.15}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0015}
            />
            <directionalLight position={[-3, 1.5, 2]} intensity={0.35} />
            <directionalLight position={[-1, 2, -3]} intensity={0.5} />
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
            {/* Pan and zoom stay off so the view never hijacks page scroll.
                Orbit is decorative: every value here is also rendered as text
                beside the canvas for keyboard and screen-reader users. */}
            <OrbitControls
              makeDefault
              enablePan={false}
              enableZoom={false}
              enableDamping={!reducedMotion}
              dampingFactor={0.08}
              rotateSpeed={0.55}
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
    </div>
  );
}
