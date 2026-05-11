import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  MapPin, Shield, BarChart3, Bell, Truck,
  ArrowRight, CheckCircle, ChevronRight, Globe2,
  Package, TrendingUp, Star, Route,
  FileText, CreditCard, ThermometerSnowflake, Warehouse,
  Menu, X, Activity, Users,
} from 'lucide-react'
import _CountUp from 'react-countup'
const CountUp = (_CountUp as Record<string, unknown>).default as React.ComponentType<{
  end: number; duration?: number; separator?: string; suffix?: string
  prefix?: string; formattingFn?: (v: number) => string
  enableScrollSpy?: boolean; scrollSpyOnce?: boolean
}>
import LiveCounter from '@/components/landing/LiveCounter'
import MiniLiveMap from '@/components/landing/MiniLiveMap'
import { formatLocalCurrency, getLocalCurrency, convertFromUSD } from '@/lib/currency'
import type { PublicLandingStats } from '@/types'

const ALL_FEATURES = [
  {
    icon: MapPin, title: 'Real-Time GPS Tracking',
    description: 'Live location updates across the Northern and Central Corridors with geofence-triggered status changes at every border, port, and checkpoint.',
    gradient: 'from-blue-500 to-cyan-400', color: '#3b82f6',
  },
  {
    icon: BarChart3, title: 'ML Delay Prediction',
    description: 'Models trained on 5+ years of East African route data predict delays before they cascade — factoring in weather, border queues, and road conditions.',
    gradient: 'from-amber-500 to-orange-400', color: '#f59e0b',
  },
  {
    icon: Bell, title: 'Multi-Channel Alerts',
    description: 'SMS, email, push, and WhatsApp notifications fire the moment a shipment deviates — configurable per role, per event type, per corridor.',
    gradient: 'from-red-500 to-rose-400', color: '#ef4444',
  },
  {
    icon: FileText, title: 'Customs Documentation',
    description: 'EDIFACT CUSDEC/CUSCAR generation for ASYCUDA, TradeNet, and TANCIS. Auto-populate declarations from shipment data — lodge in one click.',
    gradient: 'from-emerald-500 to-teal-400', color: '#10b981',
  },
  {
    icon: CreditCard, title: 'Freight Payments',
    description: 'Mobile money (M-Pesa, Airtel Money), bank transfer, and card payments with automated invoicing, escrow, and carrier settlement workflows.',
    gradient: 'from-violet-500 to-purple-400', color: '#8b5cf6',
  },
  {
    icon: ThermometerSnowflake, title: 'Cold Chain Monitoring',
    description: 'IoT sensor integration for reefer containers — temperature, humidity, and shock alerts with compliance reports for pharma and perishables.',
    gradient: 'from-cyan-500 to-blue-500', color: '#06b6d4',
  },
  {
    icon: Warehouse, title: 'Port & Warehouse Ops',
    description: 'Container gate-in/gate-out tracking, storage days calculation, demurrage alerts, and customs release monitoring at Mombasa and Dar es Salaam.',
    gradient: 'from-orange-500 to-red-400', color: '#f5801e',
  },
  {
    icon: Route, title: 'Fleet Optimization',
    description: 'Route planning, fuel optimization, and driver management for carrier fleets — reduce empty miles and improve turnaround times.',
    gradient: 'from-indigo-500 to-blue-400', color: '#6366f1',
  },
  {
    icon: Shield, title: 'Role-Based Access Control',
    description: '9 specialized roles — clients, carriers, dispatchers, customs brokers, port agents, finance, compliance — each with precisely scoped permissions.',
    gradient: 'from-teal-500 to-emerald-400', color: '#14b8a6',
  },
]

const STEPS = [
  { number: '01', title: 'Register Shipment', description: 'Enter cargo details, route, carrier, and dates. Auto-populate customs fields from your saved templates — done in under 60 seconds.' },
  { number: '02', title: 'Live Event Logging', description: 'Carriers, brokers, and agents record departures, customs entries, delays, and arrivals from mobile or web at every checkpoint.' },
  { number: '03', title: 'Risk Engine Scores', description: 'CargoTrack\'s ML pipeline analyzes historical patterns and live events to produce dynamic delay risk scores for every active shipment.' },
  { number: '04', title: 'Stakeholders Notified', description: 'Role-appropriate alerts reach every party — shippers, consignees, brokers, dispatchers — in real time via their preferred channel.' },
]

const PRICING = [
  {
    name: 'Starter', price: '$299', period: '/month',
    description: 'For freight forwarders managing a focused fleet across the EAC.',
    features: ['Up to 100 active shipments', 'Real-time GPS tracking', 'Basic alert rules', '3 user accounts', 'Email support'],
    cta: 'Start free trial', highlighted: false,
  },
  {
    name: 'Professional', price: '$799', period: '/month',
    description: 'For logistics operators scaling across multiple borders.',
    features: ['Unlimited shipments', 'ML delay risk scoring', 'Customs document generation', '15 user accounts', 'Mobile app access', 'Priority support'],
    cta: 'Start free trial', highlighted: true,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    description: 'For regional 3PLs with complex multi-carrier, multi-country operations.',
    features: ['Unlimited everything', 'Custom ML model tuning', 'SSO & audit logs', 'Unlimited users', 'Dedicated account manager', '99.9% SLA'],
    cta: 'Contact sales', highlighted: false,
  },
]

function SectionBadge({ children, color = 'orange' }: { children: React.ReactNode; color?: 'orange' | 'blue' }) {
  const colors = {
    orange: 'bg-[#f5801e]/10 text-[#f5801e]',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-5 ${colors[color]}`}>
      {children}
    </span>
  )
}

function FeatureCard({ feature, index }: { feature: typeof ALL_FEATURES[0]; index: number }) {
  const Icon = feature.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-150px' }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: 'easeOut' }}
      className="group relative bg-white rounded-2xl border border-gray-100 p-6 flex flex-col
        hover:shadow-xl hover:shadow-gray-100/80 hover:border-gray-200 hover:-translate-y-0.5
        transition-all duration-300"
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4
        shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-base font-bold text-[#0f2d5e] mb-2 tracking-tight">{feature.title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed flex-1">{feature.description}</p>
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-[0.025] transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${feature.gradient}`} />
    </motion.div>
  )
}

function PricingCard({ tier, idx }: { tier: typeof PRICING[0]; idx: number }) {
  const currency = getLocalCurrency()
  const isCustom = tier.price === 'Custom'
  const usdAmount = isCustom ? 0 : parseInt(tier.price.replace(/[^0-9]/g, ''), 10)
  const localPrice = isCustom ? 'Custom' : formatLocalCurrency(usdAmount)
  const localCompact = isCustom ? '' : formatLocalCurrency(usdAmount, true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: idx * 0.04, duration: 0.35 }}
      className={`relative rounded-2xl p-7 flex flex-col ${
        tier.highlighted
          ? 'bg-white shadow-2xl shadow-black/25 ring-1 ring-white/10'
          : 'bg-white/5 border border-white/10 backdrop-blur-sm'
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#f5801e] to-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/30">
          Most popular
        </div>
      )}
      <div className="mb-6">
        <div className={`font-bold text-sm mb-1 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-300'}`}>{tier.name}</div>
        <div className="flex items-end gap-1 mb-2">
          <span className={`text-4xl font-black tracking-tight ${tier.highlighted ? 'text-[#0f2d5e]' : 'text-white'}`}>
            {isCustom ? 'Custom' : localCompact}
          </span>
          {tier.period && <span className={`text-sm mb-1.5 ${tier.highlighted ? 'text-gray-400' : 'text-blue-400'}`}>{tier.period}</span>}
        </div>
        {!isCustom && currency.code !== 'USD' && (
          <p className={`text-xs ${tier.highlighted ? 'text-gray-400' : 'text-blue-400/50'}`}>
            ≈ {tier.price} USD
          </p>
        )}
        <p className={`text-sm mt-1 ${tier.highlighted ? 'text-gray-500' : 'text-blue-300/70'}`}>{tier.description}</p>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${tier.highlighted ? 'text-[#f5801e]' : 'text-blue-400'}`} />
            <span className={tier.highlighted ? 'text-gray-700' : 'text-blue-200'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link to="/register"
        className={`text-center text-sm font-bold py-3.5 px-5 rounded-xl transition-all ${
          tier.highlighted
            ? 'bg-[#0f2d5e] text-white hover:bg-[#0a2047] shadow-lg shadow-[#0f2d5e]/20 hover:shadow-xl'
            : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
        }`}>
        {tier.cta}
      </Link>
    </motion.div>
  )
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [landingStats, setLandingStats] = useState<PublicLandingStats | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { mobileMenu ? document.body.classList.add('overflow-hidden') : document.body.classList.remove('overflow-hidden') }, [mobileMenu])

  function scrollTo(id: string) {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinkClass = scrolled
    ? 'text-gray-600 hover:text-[#0f2d5e] hover:bg-gray-50'
    : 'text-blue-200/80 hover:text-white hover:bg-white/10'

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ═══ Navbar ═══ */}
      <motion.header
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5801e] to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className={`font-black text-lg tracking-tight transition-colors ${scrolled ? 'text-[#0f2d5e]' : 'text-white'}`}>
              CargoTrack
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {['Features', 'How It Works', 'Pricing'].map((l) => (
              <button key={l} onClick={() => scrollTo(l.toLowerCase().replace(/ /g, '-'))}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${navLinkClass}`}>{l}</button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className={`text-sm font-semibold transition-colors ${scrolled ? 'text-gray-600 hover:text-[#0f2d5e]' : 'text-blue-200 hover:text-white'}`}>Sign in</Link>
            <Link to="/register"
              className="text-sm font-bold px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f5801e] to-orange-500 text-white hover:from-[#e06f12] hover:to-orange-600 transition-all shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 hover:-translate-y-px">
              Get started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2">
            {mobileMenu ? <X className={`w-5 h-5 ${scrolled ? 'text-gray-900' : 'text-white'}`} /> : <Menu className={`w-5 h-5 ${scrolled ? 'text-gray-900' : 'text-white'}`} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 shadow-lg">
            <div className="px-5 py-4 flex flex-col gap-2">
              {['Features', 'How It Works', 'Pricing'].map((l) => (
                <button key={l} onClick={() => scrollTo(l.toLowerCase().replace(/ /g, '-'))}
                  className="text-left px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">{l}</button>
              ))}
              <hr className="my-1" />
              <Link to="/login" onClick={() => setMobileMenu(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-[#0f2d5e]">Sign in</Link>
              <Link to="/register" onClick={() => setMobileMenu(false)}
                className="text-center text-sm font-bold px-5 py-3 rounded-xl bg-gradient-to-r from-[#f5801e] to-orange-500 text-white">Get started</Link>
            </div>
          </motion.div>
        )}
      </motion.header>

      {/* ═══ Hero ═══ */}
      <section ref={heroRef} className="relative min-h-screen bg-[#0a1929] flex flex-col justify-end overflow-hidden">
        <motion.div
          style={{ y: useTransform(scrollY, [0, 600], [0, 80]) }}
          className="absolute inset-0"
        >
          <MiniLiveMap stats={landingStats} />
        </motion.div>

        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              linear-gradient(180deg, rgba(10,25,41,0.65) 0%, rgba(10,25,41,0.15) 40%, rgba(10,25,41,0.0) 60%, rgba(10,25,41,0.7) 85%, rgba(10,25,41,0.95) 100%),
              linear-gradient(90deg, rgba(10,25,41,0.85) 0%, rgba(10,25,41,0.35) 45%, rgba(10,25,41,0.05) 100%)
            `,
          }}
        />

        <motion.div style={{ opacity: heroOpacity }}
          className="relative max-w-7xl mx-auto px-5 pt-28 pb-12 w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
            <div className="inline-flex items-center gap-2 bg-white/10 text-blue-200 text-xs font-bold px-4 py-2 rounded-full mb-8 border border-white/15 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Live East Africa Freight Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.02] tracking-tight max-w-3xl">
              Shipments across{' '}
              <span className="bg-gradient-to-r from-[#f5801e] via-orange-400 to-amber-300 bg-clip-text text-transparent">East Africa</span>
              {' '}tracked in real time.
            </h1>

            <p className="mt-6 text-blue-200/80 text-lg leading-relaxed max-w-xl">
              Complete visibility across the Northern, Central, and LAPSSET corridors — live GPS tracking,
              ML-powered delay predictions, customs integration, and multi-channel alerts for every stakeholder.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white tabular-nums">
                  <CountUp end={landingStats?.active_shipments ?? 0} duration={2} separator="," />
                </span>
                <span className="text-sm text-blue-300/70">active shipments</span>
              </div>
              <div className="w-px h-8 bg-white/15 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emerald-400 tabular-nums">
                  <CountUp end={landingStats?.on_time_rate ?? 97} duration={2} suffix="%" />
                </span>
                <span className="text-sm text-blue-300/70">on-time rate</span>
              </div>
              <div className="w-px h-8 bg-white/15 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-blue-400 tabular-nums">
                  <CountUp end={landingStats?.active_carriers ?? 0} duration={2} separator="," />
                </span>
                <span className="text-sm text-blue-300/70">active carriers</span>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/register"
                className="group inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-[#f5801e] to-orange-500
                  text-white font-bold text-sm hover:from-[#e06f12] hover:to-orange-600 transition-all
                  shadow-xl shadow-orange-600/25 hover:shadow-2xl hover:shadow-orange-600/30 hover:-translate-y-px">
                Start free trial <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <button onClick={() => scrollTo('how-it-works')}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border border-white/20 text-white
                  font-semibold text-sm hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-sm">
                How it works <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-5 text-blue-400/40 text-xs font-medium">No credit card required · 14-day free trial · Cancel anytime</p>
          </motion.div>
        </motion.div>

        <div className="relative border-t border-white/8 bg-[#0a1929]/80 backdrop-blur-sm">
          <LiveCounter onStats={setLandingStats} />
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.3 }}
            className="text-center mb-16"
          >
            <SectionBadge color="orange">Platform Capabilities</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] tracking-tight mb-4">
              Everything you need to run East African logistics
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed">
              From customs declarations to cold chain monitoring — purpose-built for regional realities, not adapted from Western software.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ALL_FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section id="how-it-works" className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.3 }}
            className="text-center mb-20"
          >
            <SectionBadge color="blue">Workflow</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] tracking-tight mb-4">Operational in minutes</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">Four steps from shipment creation to complete stakeholder visibility.</p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            <div className="hidden lg:block absolute top-12 left-[calc(12.5%+32px)] right-[calc(12.5%+32px)] h-0.5">
              <div className="h-full bg-gradient-to-r from-[#0f2d5e] via-[#f5801e] to-[#0f2d5e] opacity-20" />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="relative flex flex-col items-center text-center lg:items-start lg:text-left"
                >
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0f2d5e] to-[#1e3a5f] text-white font-black text-sm flex items-center justify-center mb-5 shrink-0 z-10 shadow-lg shadow-[#0f2d5e]/20">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Social Proof ═══ */}
      <section className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid sm:grid-cols-3 gap-5 mb-16"
          >
            {[
              { icon: Package, label: 'Tonnes Managed', value: landingStats?.total_tonnes ?? 284000, fmt: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(), sub: 'cargo across corridors' },
              { icon: Route, label: 'On-Time Rate', value: landingStats?.on_time_rate ?? 97, fmt: (v: number) => `${v}%`, sub: 'delivery performance' },
              { icon: Star, label: 'Driver Rating', value: landingStats?.avg_driver_rating ?? 4.8, fmt: (v: number) => `${v.toFixed(1)}/5`, sub: 'average across fleet' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 flex items-center gap-5 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center shrink-0">
                  <s.icon className="w-6 h-6 text-[#f5801e]" />
                </div>
                <div>
                  <div className="text-2xl font-black text-[#0f2d5e] tracking-tight tabular-nums">
                    <CountUp end={s.value} duration={2} formattingFn={s.fmt} />
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Live Platform Stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative bg-[#0f2d5e] rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #f5801e 0%, transparent 50%), radial-gradient(circle at 70% 20%, #3b82f6 0%, transparent 40%)' }} />
            <div className="relative px-8 py-12 lg:px-16">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 border border-white/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  Live Platform Data
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">Trusted across East Africa</h2>
                <p className="text-blue-300/60 max-w-lg mx-auto text-sm">
                  Real-time metrics from active shipments on the CargoTrack platform — updated every 30 seconds.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { icon: Package, label: 'Active Shipments', value: landingStats?.active_shipments ?? 0, color: '#3b82f6' },
                  { icon: Activity, label: 'On-Time Rate', value: landingStats?.on_time_rate ?? 97, suffix: '%', color: '#22c55e' },
                  { icon: Users, label: 'Active Carriers', value: landingStats?.active_carriers ?? 0, color: '#f5801e' },
                  { icon: Truck, label: 'Active Trucks', value: landingStats?.active_trucks ?? 0, color: '#8b5cf6' },
                ].map((m, i) => (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    className="bg-white/5 border border-white/8 rounded-2xl p-5 backdrop-blur-sm hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}20` }}>
                        <m.icon className="w-4 h-4" style={{ color: m.color }} />
                      </div>
                      <span className="text-xs text-white/50 font-medium">{m.label}</span>
                    </div>
                    <div className="text-3xl font-black text-white tracking-tight tabular-nums">
                      <CountUp end={m.value} duration={2.5} separator="," suffix={m.suffix} enableScrollSpy scrollSpyOnce />
                    </div>
                    <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min((m.value / (m.label.includes('Rate') ? 100 : 5000)) * 100, 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: m.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="text-center mt-10">
                <Link to="/ops/live-map"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-white transition-colors">
                  View live operations map <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" className="py-28 bg-[#0f2d5e] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[120px]"
          style={{ background: 'radial-gradient(circle, #f5801e 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[100px]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

        <div className="relative max-w-7xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.3 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 text-[#f5801e] text-xs font-bold uppercase tracking-wider mb-5 border border-white/10">
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-blue-300/70 max-w-xl mx-auto text-lg">All plans include a 14-day free trial. No credit card required. Upgrade or cancel anytime.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-start max-w-4xl mx-auto">
            {PRICING.map((tier, i) => <PricingCard key={tier.name} tier={tier} idx={i} />)}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-28 bg-white">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.3 }}>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f2d5e] tracking-tight mb-4">Ready to transform your logistics operations?</h2>
            <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              Join freight forwarders, carriers, and customs brokers across East Africa who trust CargoTrack for real-time visibility and predictive intelligence.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/register"
                className="group px-8 py-4 rounded-xl bg-gradient-to-r from-[#f5801e] to-orange-500 text-white font-bold text-sm
                  hover:from-[#e06f12] hover:to-orange-600 transition-all shadow-xl shadow-orange-500/25
                  hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-px inline-flex items-center gap-2">
                Start your free trial <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link to="/login"
                className="px-8 py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:border-[#0f2d5e] hover:text-[#0f2d5e] hover:bg-gray-50 transition-all">
                Sign in
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-14 pt-10 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-6">Serving East African corridors</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {[
                  { name: 'Northern Corridor', color: '#f5801e' },
                  { name: 'Central Corridor', color: '#3b82f6' },
                  { name: 'LAPSSET Corridor', color: '#10b981' },
                  { name: 'Lake Victoria Ring', color: '#8b5cf6' },
                  { name: 'Mombasa Port', color: '#f59e0b' },
                  { name: 'Dar es Salaam Port', color: '#06b6d4' },
                  { name: 'EAC Customs Union', color: '#6366f1' },
                  { name: 'COMESA Region', color: '#ec4899' },
                ].map((b) => (
                  <span key={b.name}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-gray-100"
                    style={{ borderColor: `${b.color}25`, color: b.color, background: `${b.color}08` }}>
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <motion.footer
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-5 py-16 grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f5801e] to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-tight">CargoTrack</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">Freight intelligence for the East African corridor. Track every shipment. Predict every delay. Clear every border.</p>
            <div className="flex items-center gap-3 mt-5">
              {[Globe2, Shield, TrendingUp].map((Icon, i) => (
                <div key={i} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                  <Icon className="w-3.5 h-3.5 text-gray-500" />
                </div>
              ))}
            </div>
          </div>
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Integrations', 'API Docs'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact', 'Partners'] },
            { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'DPA'] },
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
          <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>&copy; {new Date().getFullYear()} CargoTrack Ltd. All rights reserved.</span>
            <span className="text-gray-600">Built for East African logistics.</span>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}
