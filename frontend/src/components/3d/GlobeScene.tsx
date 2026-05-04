import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function arcPoints(a: THREE.Vector3, b: THREE.Vector3, n = 64): THREE.Vector3[] {
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(a.length() + 0.5)
  return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(n)
}

const HUBS: [number, number][] = [
  [-1.28, 36.82],   // Nairobi (primary)
  [-33.92, 18.42],  // Cape Town
  [6.45, 3.47],     // Lagos
  [25.20, 55.27],   // Dubai
  [1.29, 103.85],   // Singapore
  [51.50, -0.09],   // London
  [-15.42, 28.28],  // Lusaka
  [11.56, 43.15],   // Djibouti
  [-4.32, 15.32],   // Kinshasa
  [5.56, -0.20],    // Accra
  [-6.79, 39.28],   // Dar es Salaam
  [0.35, 32.58],    // Kampala
]

const ROUTES = [[0,1],[0,2],[0,3],[0,4],[3,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[1,2]]

function PulseRing({ position }: { position: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = (clock.getElapsedTime() % 2) / 2
    meshRef.current.scale.setScalar(1 + t * 2.5)
    meshRef.current.material instanceof THREE.MeshBasicMaterial &&
      (meshRef.current.material.opacity = 0.6 * (1 - t))
  })
  return (
    <mesh ref={meshRef} position={position}>
      <ringGeometry args={[0.06, 0.09, 32]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  )
}

function GlobeObject() {
  const group = useRef<THREE.Group>(null)
  const R = 2

  const hubVecs = useMemo(() => HUBS.map(([lat, lon]) => latLonToVec3(lat, lon, R + 0.04)), [])

  const arcs = useMemo(
    () => ROUTES.map(([a, b]) => arcPoints(hubVecs[a], hubVecs[b]).map(v => v.toArray() as [number, number, number])),
    [hubVecs],
  )

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.09
  })

  return (
    <group ref={group}>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[R, 80, 80]} />
        <meshStandardMaterial color="#071428" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Lat/lon grid */}
      <mesh>
        <sphereGeometry args={[R + 0.005, 20, 20]} />
        <meshBasicMaterial color="#1e3a5f" wireframe transparent opacity={0.20} />
      </mesh>

      {/* Outer glow shell */}
      <mesh>
        <sphereGeometry args={[R + 0.12, 32, 32]} />
        <meshBasicMaterial color="#0f2d5e" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>

      {/* Hub markers */}
      {hubVecs.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[i === 0 ? 0.065 : 0.038, 14, 14]} />
          <meshStandardMaterial
            color={i === 0 ? '#f97316' : '#22c55e'}
            emissive={i === 0 ? '#f97316' : '#22c55e'}
            emissiveIntensity={i === 0 ? 4 : 1.8}
          />
        </mesh>
      ))}

      {/* Pulse ring on primary hub */}
      <PulseRing position={hubVecs[0]} />

      {/* Route arcs */}
      {arcs.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#f97316"
          lineWidth={i < 4 ? 1.2 : 0.7}
          transparent
          opacity={i < 4 ? 0.55 : 0.30}
        />
      ))}
    </group>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[8, 8, 8]} intensity={1.5} color="#f97316" />
      <pointLight position={[-10, -5, -8]} intensity={0.6} color="#3b82f6" />
      <pointLight position={[0, 10, 0]} intensity={0.4} color="#ffffff" />
      <GlobeObject />
    </>
  )
}

export default function GlobeScene({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0.5, 5.8], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
