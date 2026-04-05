import { ReactNode, useMemo } from 'react'

// ─── Animated background particles ───────────────────────────────────────────
function Particles() {
  // Generate particles once and memoize them to prevent animation resets
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      animationDelay: Math.random() * 6,
      animationDuration: 6 + Math.random() * 8,
      width: 2 + Math.random() * 3,
      height: 2 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.3,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animationDelay: `${particle.animationDelay}s`,
            animationDuration: `${particle.animationDuration}s`,
            width: `${particle.width}px`,
            height: `${particle.height}px`,
            opacity: particle.opacity,
          }}
        />
      ))}
    </div>
  )
}

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&display=swap');

        .auth-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #080b12;
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
        }

        /* ── Left panel ── */
        .auth-left {
          flex: 1;
          display: none;
          position: relative;
          overflow: hidden;
          background: #0a0e1a;
        }
        @media (min-width: 1024px) { .auth-left { display: flex; flex-direction: column; justify-content: space-between; padding: 3rem; } }

        .auth-left-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(99,102,241,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 80%, rgba(139,92,246,0.12) 0%, transparent 70%),
            linear-gradient(135deg, #0a0e1a 0%, #0d1120 100%);
        }

        .auth-left-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .auth-left-content { position: relative; z-index: 1; }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 3.5rem;
        }
        .brand-icon {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px rgba(99,102,241,0.4);
        }
        .brand-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0;
        }

        .left-heading {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(2.75rem, 5vw, 3.75rem);
          font-weight: 700;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 1.25rem;
        }
        .left-heading span { 
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .left-sub {
          color: rgba(255,255,255,0.65);
          font-size: 1.0625rem;
          line-height: 1.8;
          max-width: 360px;
          margin-bottom: 2.5rem;
          font-weight: 400;
        }

        /* feature cards */
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          position: relative; z-index: 1;
        }
        .feature-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 16px;
          padding: 1.5rem;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(129,143,248,0.1) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .feature-card:hover {
          border-color: rgba(99,102,241,0.5);
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08));
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.15);
        }
        .feature-card:hover::before {
          opacity: 1;
        }
        .feature-icon { 
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          margin-bottom: 1rem;
          background: rgba(129,143,248,0.12);
          border: 1px solid rgba(129,143,248,0.2);
          transition: all 0.3s ease;
        }
        .feature-card:hover .feature-icon {
          background: rgba(129,143,248,0.2);
          transform: scale(1.08);
        }
        .feature-icon svg { 
          color: #818cf8;
        }
        .feature-label { 
          font-size: 0.9375rem;
          font-weight: 500;
          color: rgba(255,255,255,0.8);
          letter-spacing: -0.01em;
        }

        /* ── Right / form panel ── */
        .auth-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          position: relative;
          overflow-y: auto;
        }
        .auth-right-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        /* particles */
        .particle {
          position: absolute;
          border-radius: 50%;
          background: #818cf8;
          animation: float linear infinite;
        }
        @keyframes float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
        }

        /* slide transition for mode changes */
        .fields-enter {
          animation: slideIn 0.3s ease forwards;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="auth-root">
        {/* ── Left Panel (Static) ─────────────────────────────– */}
        <div className="auth-left">
          <div className="auth-left-bg" />
          <div className="auth-left-grid" />
          <Particles />

          <div className="auth-left-content">
            <div className="brand-logo">
              <div className="brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <span className="brand-name">Vyapaar</span>
            </div>

            <h1 className="left-heading">
              The smarter way<br />to run your <span>business</span>
            </h1>
            <p className="left-sub">
              Complete point-of-sale, inventory tracking, invoicing and analytics — built for modern retailers.
            </p>
          </div>

          <div className="feature-grid">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M9 7h6"/><path d="M9 12h6"/><path d="M9 17h3"/>
                  </svg>
                ),
                label: 'Inventory Tracking'
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                  </svg>
                ),
                label: 'Invoice Generation'
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                ),
                label: 'Analytics Dashboard'
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                ),
                label: 'Profit Reports'
              },
            ].map((f) => (
              <div key={f.label} className="feature-card">
                <div className="feature-icon" style={{ color: '#818cf8' }}>{f.icon}</div>
                <div className="feature-label">{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel (Dynamic Content) ──────────────────– */}
        <div className="auth-right">
          <div className="auth-right-bg" />
          {children}
        </div>
      </div>
    </>
  )
}
