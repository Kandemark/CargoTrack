import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MapPin, Zap, Shield, BarChart3, Bell, Truck,
  ArrowRight, CheckCircle, ChevronRight, Globe2,
  Package, Clock, TrendingUp, Star, Users, Route,
} from 'lucide-react'
import LiveCounter from '@/components/landing/LiveCounter'
import MiniLiveMap from '@/components/landing/MiniLiveMap'
import type { PublicLandingStats } from '@/types'

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

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    icon: <MapPin className="w-5 h-5" />,
    title: 'Real-Time Tracking',
    description: 'Monitor every shipment across the East African corridor with live GPS checkpoints and automated status updates.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Delay Risk Intelligence',
    description: 'ML models trained on regional route data surface delay risk scores before problems escalate.',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: 'Proactive Alerts',
    description: 'Configurable alert rules push critical notifications the moment thresholds are breached.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Role-Based Access',
    description: '9 roles — clients, carriers, dispatchers, customs brokers — each with exactly the right permissions.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Instant Event Logging',
    description: 'Record departures, customs entries, arrivals, and delays from mobile or web with one tap.',
  },
  {
    icon: <Globe2 className="w-5 h-5" />,
    title: 'Multi-Corridor Coverage',
    description: 'Routes spanning Kenya, Uganda, Tanzania, Rwanda — from Mombasa Port to inland hubs.',
  },
]

const STEPS = [
  { number: '01', title: 'Create a Shipment', description: 'Register a shipment with route, carrier, cargo weight, and scheduled dates.' },
  { number: '02', title: 'Carriers Log Events', description: 'At each checkpoint, carriers record departure, customs, delays, or arrival from the field.' },
  { number: '03', title: 'Risk Engine Scores', description: 'CargoTrack\'s ML pipeline analyses route history and events to produce a live delay risk score.' },
  { number: '04', title: 'Teams Stay Informed', description: 'Stakeholders receive role-appropriate alerts and can drill into the full tracking timeline.' },
]

const PRICING: PricingTier[] = [
  {
    name: 'Starter', price: '$299', period: '/month',
    description: 'For freight forwarders managing a focused fleet.',
    features: ['Up to 100 active shipments', 'Real-time tracking', 'Basic alert rules', '3 user accounts', 'Email support'],
    cta: 'Start free trial', highlighted: false,
  },
  {
    name: 'Professional', price: '$799', period: '/month',
    description: 'For logistics operators scaling across borders.',
    features: ['Unlimited shipments', 'Delay risk scoring', 'Advanced alert configs', '15 user accounts', 'Mobile app access', 'Priority support'],
    cta: 'Start free trial', highlighted: true,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    description: 'For regional 3PLs with complex multi-carrier operations.',
    features: ['Unlimited everything', 'Custom ML model tuning', 'SSO & audit logs', 'Unlimited user accounts', 'Dedicated account manager', 'SLA guarantee'],
    cta: 'Contact sales', highlighted: false,
  },
]

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' } }),
}

// ─── Particle field for hero ─────────────────────────────────────────────────

function HeroParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ opacity: [0, 0.5, 0], scale: [1, 2, 1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ─── Landing ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [landingStats, setLandingStats] = useState<PublicLandingStats | null>(null)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 40) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#f5801e] flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className={`font-black text-lg tracking-tight ${scrolled ? 'text-[#0f2d5e]' : 'text-white'}`}>CargoTrack</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'How It Works', 'Pricing'].map((label) => (
              <button key={label} onClick={() => scrollTo(label.toLowerCase().replace(/ /g, '-'))}
                className={`text-sm font-semibold transition-colors ${scrolled ? 'text-gray-600 hover:text-[#0f2d5e]' : 'text-blue-200 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className={`text-sm font-semibold transition-colors ${scrolled ? 'text-gray-600 hover:text-[#0f2d5e]' : 'text-blue-200 hover:text-white'}`}>
              Sign in
            </Link>
            <Link to="/register" className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[#f5801e] text-white hover:bg-[#e06f12] transition-all shadow-lg shadow-orange-500/20">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-[#0f2d5e] flex flex-col justify-center overflow-hidden">
        <HeroParticles />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-20 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 text-blue-200 text-xs font-bold px-3.5 py-1.5 rounded-full mb-7 border border-white/15 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#f5801e] animate-pulse" />
              East Africa Freight Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.08] tracking-tight">
              Every shipment.
              <br />
              <span className="text-[#f5801e]">Every checkpoint.</span>
              <br />
              Full visibility.
            </h1>

            <p className="mt-6 text-blue-200/90 text-lg leading-relaxed max-w-lg">
              CargoTrack connects freight forwarders, carriers, and clients across Kenya,
              Uganda, Tanzania, and Rwanda — with real-time tracking, ML-powered delay alerts,
              and complete audit trails.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-[#f5801e] text-white font-bold text-sm hover:bg-[#e06f12] transition-all shadow-xl shadow-orange-600/25">
                Start free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => scrollTo('how-it-works')}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-all">
                See how it works <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-6 text-blue-400/70 text-xs font-medium">No credit card required · 14-day free trial · Cancel anytime</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:flex items-center justify-center">
            <div className="w-[400px] rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10">
              <MiniLiveMap />
            </div>
          </motion.div>
        </div>

        {/* Live stats bar */}
        <div className="relative border-t border-white/10">
          <LiveCounter onStats={setLandingStats} />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div className="text-center mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeInUp} custom={0}>
            <p className="text-[#f5801e] font-bold text-sm uppercase tracking-widest mb-4">Platform Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] leading-tight">Built for East African logistics</h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">
              Every feature designed around cross-border freight realities — not adapted from Western logistics software.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={i}
                className="bg-white rounded-2xl p-7 border border-gray-100 hover:border-[#f5801e]/20 hover:shadow-lg hover:shadow-orange-50 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-[#0f2d5e]/5 text-[#0f2d5e] flex items-center justify-center mb-5 group-hover:bg-[#0f2d5e] group-hover:text-white transition-all duration-300">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2.5">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div className="text-center mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={0}>
            <p className="text-[#f5801e] font-bold text-sm uppercase tracking-widest mb-4">Workflow</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] leading-tight">Operational in minutes</h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">Four steps from shipment creation to full stakeholder visibility.</p>
          </motion.div>

          <div className="relative">
            <div className="hidden lg:block absolute top-12 left-[calc(12.5%+32px)] right-[calc(12.5%+32px)] h-0.5 bg-gray-100" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((step, i) => (
                <motion.div key={step.number}
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={i}
                  className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div className="relative w-14 h-14 rounded-2xl bg-[#0f2d5e] text-white font-black text-sm flex items-center justify-center mb-5 shrink-0 z-10 shadow-lg shadow-[#0f2d5e]/20">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof ────────────────────────────────────────────────── */}
      <section className="py-28 bg-gray-50/70">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div className="grid lg:grid-cols-3 gap-5 mb-10"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={0}>
            {[
              { icon: <Package className="w-6 h-6" />, stat: landingStats ? `${(landingStats.total_tonnes / 1000).toFixed(1)}M` : '—', label: 'Tonnes managed' },
              { icon: <Route className="w-6 h-6" />, stat: landingStats ? `${landingStats.on_time_rate}%` : '—', label: 'On-time delivery rate' },
              { icon: <Star className="w-6 h-6" />, stat: landingStats ? `${landingStats.avg_driver_rating}/5` : '—', label: 'Avg driver rating' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-7 border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                  <div className="text-[#f5801e]">{s.icon}</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#0f2d5e]">{s.stat}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div className="bg-[#0f2d5e] rounded-3xl px-8 py-12 lg:px-14 flex flex-col lg:flex-row items-start lg:items-center gap-10"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={1}>
            <div className="flex-1">
              <Users className="w-6 h-6 text-[#f5801e] mb-3" />
              <p className="text-white text-lg leading-relaxed font-medium">
                "CargoTrack gave our operations team complete visibility across the Northern Corridor
                for the first time. Delay alerts hit our phones before drivers even call dispatch — it's
                changed how we manage risk."
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f5801e] flex items-center justify-center text-white font-bold text-sm">GM</div>
                <div>
                  <div className="text-white font-bold text-sm">Grace Muthoni</div>
                  <div className="text-blue-300 text-sm">Head of Logistics · Meridian Freight, Nairobi</div>
                </div>
              </div>
            </div>
            <div className="hidden lg:block w-px self-stretch bg-white/15" />
            <div className="lg:w-52 shrink-0 text-center">
              <div className="text-5xl font-black text-[#f5801e]">{landingStats ? `${landingStats.on_time_rate}%` : '—'}</div>
              <div className="text-blue-200 text-sm mt-1 font-semibold">On-Time Rate</div>
              <div className="text-blue-300/70 text-xs mt-1">{landingStats ? `${landingStats.total_deliveries} deliveries` : 'from live data'}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 bg-[#0f2d5e]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div className="text-center mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={0}>
            <p className="text-[#f5801e] font-bold text-sm uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">Simple, transparent pricing</h2>
            <p className="mt-4 text-blue-300/80 max-w-xl mx-auto text-lg">All plans include a 14-day free trial. No credit card required.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-start max-w-4xl mx-auto">
            {PRICING.map((tier, i) => (
              <motion.div key={tier.name}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={i}
                className={`relative rounded-2xl p-7 flex flex-col ${tier.highlighted ? 'bg-white shadow-2xl shadow-black/30' : 'bg-white/8 border border-white/15'}`}>
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#f5801e] text-white text-xs font-bold whitespace-nowrap shadow-lg shadow-orange-500/30">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <div className={`font-bold text-sm mb-1 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-300'}`}>{tier.name}</div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-4xl font-black ${tier.highlighted ? 'text-[#0f2d5e]' : 'text-white'}`}>{tier.price}</span>
                    {tier.period && <span className={`text-sm mb-1.5 ${tier.highlighted ? 'text-gray-400' : 'text-blue-400'}`}>{tier.period}</span>}
                  </div>
                  <p className={`text-sm ${tier.highlighted ? 'text-gray-500' : 'text-blue-300'}`}>{tier.description}</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-400'}`} />
                      <span className={tier.highlighted ? 'text-gray-700' : 'text-blue-200'}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`text-center text-sm font-bold py-3.5 px-5 rounded-xl transition-all ${
                    tier.highlighted
                      ? 'bg-[#0f2d5e] text-white hover:bg-[#0a2047] shadow-lg shadow-[#0f2d5e]/20'
                      : 'bg-white/15 text-white hover:bg-white/25 border border-white/25'
                  }`}>
                  {tier.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] leading-tight mb-4">
              Ready to transform your logistics operations?
            </h2>
            <p className="text-gray-500 text-lg mb-8 max-w-lg mx-auto">
              Join freight forwarders across East Africa who trust CargoTrack for real-time visibility.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/register"
                className="px-8 py-4 rounded-xl bg-[#f5801e] text-white font-bold text-sm hover:bg-[#e06f12] transition-all shadow-xl shadow-orange-500/25 inline-flex items-center gap-2">
                Start your free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login"
                className="px-8 py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:border-[#0f2d5e] hover:text-[#0f2d5e] transition-all">
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#f5801e] flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-black text-lg">CargoTrack</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Freight intelligence for the East African corridor. Track every shipment. Predict every delay.
            </p>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Integrations'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-bold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-3 text-sm">
                {col.links.map((l) => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>&copy; {new Date().getFullYear()} CargoTrack Ltd. All rights reserved.</span>
            <span className="text-gray-600">Built for East African logistics.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
