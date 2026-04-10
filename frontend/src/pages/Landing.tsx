import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Zap,
  Shield,
  BarChart3,
  Bell,
  Truck,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Globe2,
  Package,
  Clock,
  TrendingUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

interface PricingTier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted: boolean
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: 'Real-Time Tracking',
    description:
      'Monitor every shipment across the East African corridor with live GPS checkpoints and automated status updates.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Delay Risk Intelligence',
    description:
      'Machine-learning models trained on regional route data surface delay risk scores before problems escalate.',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    title: 'Proactive Alerts',
    description:
      'Configurable alert rules push critical, high, and medium severity notifications the moment thresholds are breached.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Role-Based Access',
    description:
      'Clients see their cargo, carriers log events, logistics managers control everything — all in one authenticated workspace.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Instant Event Logging',
    description:
      'Carriers record departures, customs entries, arrivals, and delays from mobile or web with a single tap.',
  },
  {
    icon: <Globe2 className="w-6 h-6" />,
    title: 'Multi-Corridor Coverage',
    description:
      'Routes spanning Kenya, Uganda, Tanzania, Rwanda, and beyond — from Mombasa Port to inland distribution hubs.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Create a Shipment',
    description:
      'Logistics managers register a shipment with route, carrier, cargo weight, and scheduled dates.',
  },
  {
    number: '02',
    title: 'Carriers Log Events',
    description:
      'At each checkpoint, carriers record departure, customs status, delays, or arrival directly from the field.',
  },
  {
    number: '03',
    title: 'Risk Engine Scores',
    description:
      'CargoTrack\'s ML pipeline analyses route history and current events to produce a live delay risk score.',
  },
  {
    number: '04',
    title: 'Teams Stay Informed',
    description:
      'Stakeholders receive role-appropriate alerts and can drill into the full tracking timeline at any time.',
  },
]

const PRICING: PricingTier[] = [
  {
    name: 'Starter',
    price: '$299',
    period: '/month',
    description: 'For freight forwarders managing a focused fleet.',
    features: [
      'Up to 100 active shipments',
      'Real-time tracking',
      'Basic alert rules',
      '3 user accounts',
      'Email support',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$799',
    period: '/month',
    description: 'For logistics operators scaling across borders.',
    features: [
      'Unlimited shipments',
      'Delay risk scoring',
      'Advanced alert configurations',
      '15 user accounts',
      'Mobile app access',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For regional 3PLs with complex multi-carrier operations.',
    features: [
      'Unlimited everything',
      'Custom ML model tuning',
      'SSO & audit logs',
      'Unlimited user accounts',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
]

// ─── Animated route map ───────────────────────────────────────────────────────

function RouteMap() {
  const nodes = [
    { id: 'mombasa',  label: 'Mombasa',  x: 72,  y: 68 },
    { id: 'nairobi',  label: 'Nairobi',  x: 44,  y: 44 },
    { id: 'kampala',  label: 'Kampala',  x: 20,  y: 36 },
    { id: 'kigali',   label: 'Kigali',   x: 12,  y: 58 },
    { id: 'dares',    label: 'Dar es Salaam', x: 60, y: 80 },
  ]

  const edges = [
    { from: 'mombasa', to: 'nairobi' },
    { from: 'nairobi', to: 'kampala' },
    { from: 'kampala', to: 'kigali' },
    { from: 'mombasa', to: 'dares' },
    { from: 'nairobi', to: 'dares' },
  ]

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))

  return (
    <div className="relative w-full h-full select-none" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Route lines */}
        {edges.map((e) => {
          const f = nodeMap[e.from]
          const t = nodeMap[e.to]
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={f.x} y1={f.y}
              x2={t.x} y2={t.y}
              stroke="rgba(93,169,221,0.35)"
              strokeWidth="0.6"
              strokeDasharray="2 1.5"
            />
          )
        })}

        {/* Node circles */}
        {nodes.map((n) => (
          <g key={n.id}>
            {/* Outer pulse ring */}
            <circle cx={n.x} cy={n.y} r="3.5" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.4">
              <animate attributeName="r" values="3.5;5.5;3.5" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
            </circle>
            {/* Core dot */}
            <circle cx={n.x} cy={n.y} r="2" fill="#60a5fa" />
            {/* Label */}
            <text
              x={n.x + (n.id === 'mombasa' ? 3 : n.id === 'kigali' ? -3 : 3)}
              y={n.y - 3}
              fontSize="3.5"
              fill="rgba(147,180,216,0.9)"
              textAnchor={n.id === 'kigali' ? 'end' : 'start'}
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Animated truck dot on Mombasa→Nairobi */}
        <circle r="1.8" fill="#f5801e">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path={`M ${nodeMap.mombasa.x} ${nodeMap.mombasa.y} L ${nodeMap.nairobi.x} ${nodeMap.nairobi.y} L ${nodeMap.kampala.x} ${nodeMap.kampala.y}`}
          />
        </circle>
      </svg>
    </div>
  )
}

// ─── Stat counter ─────────────────────────────────────────────────────────────

function StatCounter({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-blue-300 text-sm mt-1">{label}</div>
    </div>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Sticky navbar ─────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f2d5e] flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className={`font-bold text-lg tracking-tight ${scrolled ? 'text-[#0f2d5e]' : 'text-white'}`}>
              CargoTrack
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7">
            {[
              { label: 'Features', id: 'features' },
              { label: 'How It Works', id: 'how-it-works' },
              { label: 'Pricing', id: 'pricing' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-gray-600 hover:text-[#0f2d5e]' : 'text-blue-200 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-600 hover:text-[#0f2d5e]' : 'text-blue-200 hover:text-white'
              }`}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#f5801e] text-white hover:bg-[#e06f12] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen bg-[#0f2d5e] flex flex-col justify-center overflow-hidden"
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-white/15">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f5801e] animate-pulse" />
              East Africa Freight Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black text-white leading-[1.1] tracking-tight">
              Every shipment.
              <br />
              <span className="text-[#f5801e]">Every checkpoint.</span>
              <br />
              Full visibility.
            </h1>

            <p className="mt-6 text-blue-200 text-lg leading-relaxed max-w-lg">
              CargoTrack connects freight forwarders, carriers, and clients across
              Kenya, Uganda, Tanzania, and Rwanda — with real-time tracking,
              ML-powered delay alerts, and complete audit trails.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#f5801e] text-white font-bold text-sm hover:bg-[#e06f12] transition-colors shadow-lg shadow-orange-900/30"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                See how it works
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Trust line */}
            <p className="mt-6 text-blue-400 text-xs">
              No credit card required · 14-day free trial · Cancel anytime
            </p>
          </div>

          {/* Right: animated route map */}
          <div className="hidden lg:flex items-center justify-center">
            <div
              className="relative w-[380px] h-[320px] rounded-2xl overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse at 60% 50%, rgba(59,130,246,0.18) 0%, rgba(15,45,94,0.5) 100%)',
                border: '1px solid rgba(93,169,221,0.25)',
              }}
            >
              <RouteMap />

              {/* Live shipments badge */}
              <div className="absolute top-4 right-4 bg-[#0f2d5e]/80 border border-blue-500/30 rounded-xl px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-300 text-xs font-semibold">Live tracking</span>
                </div>
              </div>

              {/* Alert chip */}
              <div className="absolute bottom-4 left-4 bg-[#f5801e]/90 rounded-xl px-3 py-2 backdrop-blur-sm shadow-lg">
                <div className="flex items-center gap-1.5">
                  <Bell className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-bold">3 alerts · Nairobi corridor</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <StatCounter value="12,400+" label="Shipments tracked" />
            <StatCounter value="98.2%"   label="On-time visibility" />
            <StatCounter value="6"       label="Countries covered" />
            <StatCounter value="340ms"   label="Avg. alert latency" />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[#f5801e] font-semibold text-sm uppercase tracking-widest mb-3">
              Platform capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] leading-tight">
              Built for East African logistics
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">
              Every feature is designed around the realities of cross-border freight
              in the region — not adapted from Western logistics software.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0f2d5e] flex items-center justify-center mb-4 group-hover:bg-[#0f2d5e] group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[#f5801e] font-semibold text-sm uppercase tracking-widest mb-3">
              Workflow
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] leading-tight">
              Operational in minutes
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">
              Four steps take a shipment from creation to full stakeholder visibility.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Connector line — desktop only */}
            <div className="hidden lg:block absolute top-10 left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] h-0.5 bg-gray-100" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((step) => (
                <div key={step.number} className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                  {/* Number bubble */}
                  <div className="relative w-12 h-12 rounded-full bg-[#0f2d5e] text-white font-black text-sm flex items-center justify-center mb-5 shrink-0 z-10">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            {[
              { icon: <Package className="w-7 h-7 text-[#f5801e]" />, stat: '2.4M tonnes', sub: 'Cargo managed annually' },
              { icon: <Clock className="w-7 h-7 text-[#f5801e]" />,   stat: '34%',         sub: 'Reduction in delay escalations' },
              { icon: <TrendingUp className="w-7 h-7 text-[#f5801e]" />, stat: '4.8 / 5',  sub: 'Customer satisfaction score' },
            ].map((s) => (
              <div
                key={s.stat}
                className="bg-white rounded-2xl p-7 border border-gray-100 flex items-center gap-5"
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-black text-[#0f2d5e]">{s.stat}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="bg-[#0f2d5e] rounded-2xl px-8 py-10 lg:px-12 flex flex-col lg:flex-row items-start lg:items-center gap-8">
            <div className="flex-1">
              <p className="text-white text-lg leading-relaxed font-medium">
                "CargoTrack gave our operations team complete visibility across the
                Northern Corridor for the first time. Delay alerts hit our phones before
                drivers even call dispatch — it's changed how we manage risk."
              </p>
              <div className="mt-5">
                <div className="text-white font-bold text-sm">Grace Muthoni</div>
                <div className="text-blue-300 text-sm">Head of Logistics · Meridian Freight, Nairobi</div>
              </div>
            </div>
            <div className="hidden lg:block w-px self-stretch bg-white/15" />
            <div className="lg:w-48 shrink-0 flex flex-col items-center text-center">
              <div className="text-4xl font-black text-[#f5801e]">99.1%</div>
              <div className="text-blue-200 text-sm mt-1">Uptime SLA</div>
              <div className="text-blue-300 text-xs mt-0.5">last 12 months</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-[#0f2d5e]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[#f5801e] font-semibold text-sm uppercase tracking-widest mb-3">
              Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-blue-300 max-w-xl mx-auto text-lg">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 items-start">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  tier.highlighted
                    ? 'bg-white'
                    : 'bg-white/8 border border-white/15'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#f5801e] text-white text-xs font-bold whitespace-nowrap">
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <div className={`font-bold text-sm mb-1 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-300'}`}>
                    {tier.name}
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-4xl font-black ${tier.highlighted ? 'text-[#0f2d5e]' : 'text-white'}`}>
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className={`text-sm mb-1.5 ${tier.highlighted ? 'text-gray-400' : 'text-blue-400'}`}>
                        {tier.period}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm leading-relaxed ${tier.highlighted ? 'text-gray-500' : 'text-blue-300'}`}>
                    {tier.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-400'}`}
                      />
                      <span className={tier.highlighted ? 'text-gray-700' : 'text-blue-200'}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={tier.name === 'Enterprise' ? '/register' : '/register'}
                  className={`text-center text-sm font-bold py-3 px-5 rounded-xl transition-colors ${
                    tier.highlighted
                      ? 'bg-[#0f2d5e] text-white hover:bg-[#0a2047]'
                      : 'bg-white/15 text-white hover:bg-white/25 border border-white/25'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#0f2d5e] flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg">CargoTrack</span>
            </div>
            <p className="text-sm leading-relaxed">
              Freight intelligence for the East African corridor. Track every
              shipment. Predict every delay.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              {['Features', 'Pricing', 'Security', 'Integrations'].map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-white transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              {['About', 'Blog', 'Careers', 'Contact'].map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-white transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-white transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800">
          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>© 2026 CargoTrack. All rights reserved.</span>
            <span className="text-gray-600">Built for East African logistics.</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
