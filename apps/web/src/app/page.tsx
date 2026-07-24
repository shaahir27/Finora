"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Zap, BarChart3, Users, CheckCircle2 } from "lucide-react";

// ─── 3D Components ────────────────────────────────────────────────────────────

function TransactionNetwork() {
  const group = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);

  // Create a spherical distribution of particles
  const [positions] = useState(() => {
    const count = 300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 2;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  });

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.05;
      group.current.rotation.z += delta * 0.02;
    }
    if (particles.current) {
       const material = particles.current.material as THREE.PointsMaterial;
       material.size = 0.05 + Math.sin(state.clock.elapsedTime * 2) * 0.01;
    }
  });

  return (
    <group ref={group}>
      <points ref={particles}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color="#3F9AA3"
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Central Core */}
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <mesh scale={1.5}>
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color="#14555C"
            emissive="#14555C"
            emissiveIntensity={0.5}
            transmission={0.9}
            opacity={1}
            metalness={0.5}
            roughness={0.1}
            ior={1.5}
            thickness={2}
          />
        </mesh>
      </Float>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#6BBF82" />
      <spotLight position={[-10, -10, -10]} angle={0.15} penumbra={1} intensity={2} color="#3F9AA3" />
      
      <PresentationControls
        global
        config={{ mass: 2, tension: 500 }}
        snap={{ mass: 4, tension: 1500 }}
        rotation={[0, 0.3, 0]}
        polar={[-Math.PI / 3, Math.PI / 3]}
        azimuth={[-Math.PI / 1.4, Math.PI / 2]}
      >
        <TransactionNetwork />
      </PresentationControls>

      <Environment preset="city" />
      <ContactShadows position={[0, -3.5, 0]} opacity={0.4} scale={20} blur={2} far={4} color="#000000" />
    </>
  );
}

// ─── UI Components ────────────────────────────────────────────────────────────

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
};

function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-surface/50 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white bg-gradient-to-br from-accent-teal to-accent-core shadow-lg shadow-accent-teal/20">
          ₹
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Finora</span>
      </div>
      <div className="flex items-center gap-6">
        <Link 
          href="/parent/login" 
          className="text-sm font-medium text-white/70 hover:text-white transition-colors"
        >
          Parent Portal
        </Link>
        <Link 
          href="/admin/login" 
          className="text-sm font-semibold px-5 py-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all backdrop-blur-sm flex items-center gap-2 group"
        >
          Admin Login
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-6 min-h-screen flex items-center overflow-hidden">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Copy */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="z-10 text-center lg:text-left"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-sm font-medium mb-8 backdrop-blur-md">
            <Zap className="w-4 h-4 text-accent-teal" />
            Next-Gen Fintech for Education
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            The Smart <br className="hidden lg:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-teal via-accent-emerald to-accent-teal bg-300% animate-gradient">
              School Finance
            </span><br className="hidden lg:block" />
            Engine.
          </motion.h1>
          
          <motion.p variants={fadeUp} className="text-lg text-white/60 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Zero-lag reconciliation, AI-powered insights, and a seamless parent payment experience. Ditch the spreadsheets and modernize your ledger.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link 
              href="#ecosystem" 
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-accent-teal to-accent-core text-white font-semibold hover:shadow-lg hover:shadow-accent-teal/25 transition-all flex items-center justify-center gap-2 group"
            >
              See How It Works
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="https://github.com/shaahir27/Finora" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-transparent border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors text-center"
            >
              View on GitHub
            </a>
          </motion.div>
        </motion.div>

        {/* 3D Canvas */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="relative h-[500px] lg:h-[700px] w-full z-0 cursor-grab active:cursor-grabbing"
        >
          <Canvas camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 2]}>
            <Scene />
          </Canvas>
          {/* Subtle glow behind canvas */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-teal/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        </motion.div>
      </div>
    </section>
  );
}

function Ecosystem() {
  return (
    <section id="ecosystem" className="py-32 px-6 relative border-t border-white/5 bg-base">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-bold text-white mb-6">A connected ecosystem.</motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-white/50 max-w-2xl mx-auto">From the moment a parent pays to the moment it hits your ledger, everything is instant, verified, and reconciled.</motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Parent Pays", desc: "1-click UPI payments via a beautiful, localized mobile interface.", icon: Users, color: "text-accent-teal", bg: "bg-accent-teal/10" },
            { title: "AI Engine Verifies", desc: "Smart-routing ensures the payment matches the exact student ledger.", icon: Bot, color: "text-accent-emerald", bg: "bg-[#6BBF82]/10" },
            { title: "Admin Reconciles", desc: "Real-time dashboard updates instantly. No manual Tally entry required.", icon: BarChart3, color: "text-accent-gold", bg: "bg-[#F2C94C]/10" }
          ].map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.2, type: "spring", stiffness: 100 }}
              className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
            >
              <div className={`w-14 h-14 rounded-2xl ${step.bg} ${step.color} flex items-center justify-center mb-6`}>
                <step.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-white/60 leading-relaxed">{step.desc}</p>
              
              {/* Connector Line (Desktop) */}
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-[2px] bg-gradient-to-r from-white/20 to-transparent z-10"></div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AICopilotDemo() {
  const [query, setQuery] = useState("");
  const fullQuery = "Show me pending tuition fees for Grade 10 A";
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullQuery.length) {
        setQuery(fullQuery.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent-core/10 pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="order-2 lg:order-1"
        >
          <div className="p-6 rounded-3xl bg-base border border-white/10 shadow-2xl shadow-black/50">
            {/* Mock Chat UI */}
            <div className="flex items-center gap-4 border-b border-white/10 pb-4 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              <span className="text-xs text-white/30 font-mono ml-2">Finora AI Copilot</span>
            </div>
            
            <div className="space-y-6">
              {/* User Message */}
              <div className="flex gap-4 items-start justify-end">
                <div className="bg-accent-core text-white p-4 rounded-2xl rounded-tr-sm text-sm font-medium max-w-[80%]">
                  {query}
                  <span className="inline-block w-1.5 h-4 ml-1 bg-white/70 animate-pulse align-middle"></span>
                </div>
              </div>
              
              {/* AI Response (Fades in after typing) */}
              {query === fullQuery && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex gap-4 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-accent-teal/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-accent-teal" />
                  </div>
                  <div className="bg-white/5 border border-white/10 text-white/80 p-4 rounded-2xl rounded-tl-sm text-sm max-w-[90%]">
                    <p className="mb-3">Here is the pending fee report for Grade 10 A:</p>
                    <div className="space-y-2 font-mono text-xs text-white/60 bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between"><span>Rahul Sharma</span> <span className="text-red-400">₹4,500</span></div>
                      <div className="flex justify-between"><span>Priya Patel</span> <span className="text-red-400">₹4,500</span></div>
                      <div className="flex justify-between pt-2 border-t border-white/10 text-white font-bold"><span>Total Pending</span> <span>₹9,000</span></div>
                    </div>
                    <button className="mt-4 text-xs font-semibold text-accent-teal hover:text-accent-emerald transition-colors flex items-center gap-1">
                      Send Payment Reminders <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="order-1 lg:order-2 text-center lg:text-left"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-teal/20 text-accent-teal flex items-center justify-center mb-6 mx-auto lg:mx-0">
            <Bot className="w-6 h-6" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-6">Talk to your ledger.</h2>
          <p className="text-lg text-white/60 mb-8">Stop writing complex SQL queries or exporting CSVs. Finora's AI Copilot understands natural language, giving you instant answers to your most complex financial questions.</p>
          <ul className="space-y-4 text-white/70">
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent-teal" /> Instant reporting and analytics</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent-teal" /> Automated parent communication</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent-teal" /> Fraud & anomaly detection</li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-white/10 bg-base relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white bg-gradient-to-br from-accent-teal to-accent-core">₹</div>
          <span className="text-lg font-bold text-white">Finora</span>
        </div>
        <p className="text-white/40 text-sm">© 2026 Finora Technologies. All rights reserved.</p>
        <div className="flex space-x-6 text-sm text-white/40">
          <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          <Link href="#" className="hover:text-white transition-colors">Security</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-surface text-white font-sans selection:bg-accent-teal/30">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-accent-core/10 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent-teal/10 rounded-full blur-[150px]"></div>
      </div>

      <Navbar />
      
      <main className="relative z-10">
        <Hero />
        <Ecosystem />
        <AICopilotDemo />
      </main>

      <Footer />
    </div>
  );
}
