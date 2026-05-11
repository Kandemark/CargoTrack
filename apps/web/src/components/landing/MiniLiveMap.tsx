/**
 * Hero3DScene — Procedural 3D logistics terminal visualization.
 *
 * Renders a stylized container yard using Three.js primitives:
 * floating shipping containers, sparkle particles, soft atmospheric
 * lighting, and a subtle ground grid. No maps, no Leaflet.
 */
import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Float,
  Sparkles,
  ContactShadows,
  Environment,
  Edges,
} from '@react-three/drei'
import * as THREE from 'three'
import type { PublicLandingStats } from '@/types'

// ── Container component ────────────────────────────────────────────────────

function Container({
  position,
  rotation,
  scale,
  color,
  floatSpeed = 1,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color: string
  floatSpeed?: number
}) {
  return (
    <Float speed={floatSpeed} rotationIntensity={0.15} floatIntensity={0.4}>
      <group position={position} rotation={rotation}>
        {/* Main box */}
        <mesh scale={scale ?? [2.2, 0.85, 0.85]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={color}
            roughness={0.35}
            metalness={0.25}
          />
        </mesh>
        {/* Corrugation ridges — horizontal grooves on side faces */}
        {[-0.25, 0, 0.25].map((offset) => (
          <mesh
            key={offset}
            position={[0, offset, (scale?.[2] ?? 0.85) / 2 + 0.01]}
            scale={[(scale?.[0] ?? 2.2), 0.04, 0.02]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={color}
              roughness={0.3}
              metalness={0.35}
            />
          </mesh>
        ))}
        {/* Edge highlight for industrial definition */}
        <Edges color={color} threshold={15} scale={scale} />
      </group>
    </Float>
  )
}

// ── Ground grid plane ──────────────────────────────────────────────────────

function GroundGrid() {
  return (
    <group position={[0, -2.2, 0]}>
      {/* Dark reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#0a1628"
          roughness={0.55}
          metalness={0.4}
        />
      </mesh>
      {/* Grid lines — thin strips */}
      {Array.from({ length: 21 }).map((_, i) => {
        const pos = (i - 10) * 1.2
        return (
          <mesh
            key={`h${i}`}
            position={[pos, 0.005, 0]}
            scale={[0.015, 0.002, 30]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#1e3a5f" transparent opacity={0.25} />
          </mesh>
        )
      })}
      {Array.from({ length: 21 }).map((_, i) => {
        const pos = (i - 10) * 1.2
        return (
          <mesh
            key={`v${i}`}
            position={[0, 0.005, pos]}
            scale={[30, 0.002, 0.015]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#1e3a5f" transparent opacity={0.25} />
          </mesh>
        )
      })}
    </group>
  )
}

// ── Slow camera orbit ──────────────────────────────────────────────────────

function CameraRig() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    state.camera.position.x = Math.sin(t * 0.12) * 7
    state.camera.position.z = Math.cos(t * 0.12) * 7
    state.camera.position.y = 3.2 + Math.sin(t * 0.2) * 0.4
    state.camera.lookAt(0, -0.4, 0)
  })
  return null
}

// ── Scene content ──────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <pointLight
        position={[6, 5, 4]}
        intensity={2.5}
        color="#f97316"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        position={[-6, 3, -4]}
        intensity={1.8}
        color="#3b82f6"
      />
      <spotLight
        position={[0, 8, 0]}
        intensity={0.6}
        angle={0.6}
        penumbra={0.8}
        color="#ffffff"
        castShadow
      />

      {/* Ground */}
      <GroundGrid />

      {/* Container stacks */}
      {/* Left cluster */}
      <Container position={[-1.8, -1.0, -1.0]} color="#f97316" floatSpeed={1.1} />
      <Container position={[-1.8, -0.15, -1.0]} color="#e0680f" floatSpeed={1.2} scale={[2.8, 0.85, 0.85]} />
      <Container position={[-1.6, 0.7, -0.8]} rotation={[0, 0.15, 0]} color="#0f2d5e" floatSpeed={0.95} scale={[1.8, 0.75, 0.75]} />

      {/* Center cluster */}
      <Container position={[0.8, -1.0, -0.3]} color="#0f2d5e" floatSpeed={1.05} />
      <Container position={[1.0, -0.15, -0.3]} rotation={[0, -0.1, 0]} color="#1e3a5f" floatSpeed={1.15} scale={[3.2, 0.85, 0.85]} />
      <Container position={[0.6, 0.7, -0.2]} color="#f97316" floatSpeed={0.9} />

      {/* Right cluster */}
      <Container position={[3.2, -1.0, 1.2]} rotation={[0, 0.3, 0]} color="#1e3a5f" floatSpeed={1.0} />
      <Container position={[3.4, -0.15, 1.4]} color="#f97316" floatSpeed={1.08} scale={[2.4, 0.85, 0.85]} />

      {/* Far back containers */}
      <Container position={[-3.5, -1.0, 2.5]} rotation={[0, -0.2, 0]} color="#0f2d5e" floatSpeed={0.85} scale={[3.0, 0.85, 0.85]} />
      <Container position={[-3.3, -0.15, 2.7]} color="#1e3a5f" floatSpeed={0.9} />
      <Container position={[4.0, -1.0, -2.0]} rotation={[0, -0.25, 0]} color="#0f2d5e" floatSpeed={0.88} scale={[2.6, 0.85, 0.85]} />

      {/* Particle effects */}
      <Sparkles
        count={60}
        scale={16}
        size={2.5}
        speed={0.25}
        color="#f97316"
        opacity={0.3}
      />
      <Sparkles
        count={40}
        scale={14}
        size={1.8}
        speed={0.35}
        color="#3b82f6"
        opacity={0.2}
      />

      {/* Contact shadows for grounding */}
      <ContactShadows
        position={[0, -2.15, 0]}
        opacity={0.35}
        scale={18}
        blur={2.5}
        far={6}
      />

      {/* Procedural environment for reflections */}
      <Environment preset="night" environmentIntensity={0.3} />

      {/* Slow camera rotation */}
      <CameraRig />
    </>
  )
}

// ── Loading fallback ───────────────────────────────────────────────────────

function Fallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a1628]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-[#f97316]/30 border-t-[#f97316] animate-spin" />
        <span className="text-xs text-white/20 font-medium tracking-wider">
          Loading terminal view...
        </span>
      </div>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────

interface Props {
  stats: PublicLandingStats | null
}

export default function Hero3DScene({ stats: _stats }: Props) {
  return (
    <div className="absolute inset-0 bg-[#0a1628]">
      <Suspense fallback={<Fallback />}>
        <Canvas
          camera={{ position: [0, 3, 8], fov: 48 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          shadows
        >
          <Scene />
        </Canvas>
      </Suspense>

      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 45%, rgba(10,22,40,0.5) 75%, rgba(10,22,40,0.82) 100%)',
        }}
      />

      {/* Version tag */}
      <div className="absolute bottom-3 right-3 text-[9px] text-white/10 font-mono tracking-wider pointer-events-none">
        CT-TERMINAL v1
      </div>
    </div>
  )
}
