import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  FileCode,
  Zap,
  Lock,
  BarChart3,
  Activity,
  ArrowRight,
  CheckCircle2,
  Github,
  Terminal,
  Bug,
  ShieldCheck,
} from "lucide-react";
import {
  motion,
  animate,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PentestAI — AI-Powered Penetration Testing for GitHub" },
      {
        name: "description",
        content:
          "Automated LLM-powered penetration testing for GitHub repos. Sandbox-verified vulnerabilities with step-by-step remediation.",
      },
      { property: "og:title", content: "PentestAI — AI-Powered Penetration Testing" },
      {
        property: "og:description",
        content:
          "Connect your GitHub repositories. Get sandbox-verified vulnerability reports powered by Large Language Models.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/* ---------- content ---------- */

const features = [
  {
    icon: FileCode,
    title: "GitHub Integration",
    desc: "Link repositories and automatically scan code on push events. Seamless integration with your existing workflow.",
  },
  {
    icon: Zap,
    title: "AI-Powered Analysis",
    desc: "Advanced vulnerability detection using LLMs. Identifies security risks and suggests targeted penetration tests.",
  },
  {
    icon: Lock,
    title: "Sandboxed Verification",
    desc: "Deploy attack simulations in an isolated container. Verify vulnerabilities with real-world testing.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    desc: "Secure authentication with customizable roles for Admins, Penetration Testers, and Developers.",
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    desc: "Comprehensive vulnerability reports with severity levels and step-by-step remediation guidance.",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    desc: "Track security status across all repositories with a centralized dashboard and instant alerts.",
  },
];

const steps = [
  { n: 1, title: "Connect GitHub", desc: "Sign in and authorize read-only repository access." },
  { n: 2, title: "Select Repositories", desc: "Pick which repos to scan and how often." },
  {
    n: 3,
    title: "AI Scans in Sandbox",
    desc: "LLM agents analyze code and verify exploits in isolation.",
  },
  {
    n: 4,
    title: "Get Verified Findings",
    desc: "Actionable reports with remediation and code fixes.",
  },
];

const stats = [
  { value: 128, suffix: "k+", label: "Files analyzed" },
  { value: 47, suffix: "s", label: "Median scan time" },
  { value: 312, suffix: "", label: "Detection rules" },
  { value: 99, suffix: "%", label: "Sandbox isolation" },
];

const coverage = [
  "CWE-798 Hardcoded Credentials",
  "CWE-89 SQL Injection",
  "CWE-79 Cross-Site Scripting",
  "CWE-22 Path Traversal",
  "CWE-352 CSRF",
  "CWE-502 Insecure Deserialization",
  "CWE-287 Broken Authentication",
  "CWE-918 SSRF",
];

const logLines = [
  { t: "boot", text: "pentestai runner :: container spawned (isolated)" },
  { t: "info", text: "cloning repo → /workspace (read-only mount)" },
  { t: "info", text: "indexed 412 files · 38 secrets-prone paths" },
  { t: "crit", text: "CRITICAL  .env:4  AWS_SECRET_ACCESS_KEY exposed  CWE-798" },
  { t: "high", text: "HIGH      api/users.ts:88  raw SQL interpolation  CWE-89" },
  { t: "info", text: "exploit simulation queued in sandbox…" },
  { t: "ok", text: "VERIFIED  2 findings reproducible · report generated" },
];

const trust = [
  "Read-only access",
  "Sandboxed execution",
  "Your code is never modified",
  "Findings encrypted at rest",
];

/* ---------- motion primitives ----------
   Everything here is scroll-*driven*: it either fires once as a section
   enters, or it is tied directly to scroll position. Nothing loops
   ambiently — that was what made the old page read as generic. Every
   primitive returns plain markup under prefers-reduced-motion, so reduced-
   motion users get the finished layout rather than a hidden one.          */

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: "-70px" } as const;

/** Fade-up on scroll, once. Collapses to a no-op under reduced motion. */
function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Parent that cascades its Stagger children as the group enters view. */
function Stagger({
  children,
  className,
  gap = 0.075,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: "div" | "ul" | "ol" | "dl";
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{children}</Tag>;
  const M = motion[as];
  return (
    <M
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </M>
  );
}

const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE } },
};

/** A single cascading child. Must sit inside <Stagger>. */
function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{children}</Tag>;
  const M = motion[as];
  return (
    <M className={className} variants={staggerItem}>
      {children}
    </M>
  );
}

/**
 * Headline that reveals word-by-word from behind a mask. Words — not
 * characters: per-character motion on a 40+ character headline is the tell of
 * an auto-generated page, and it wrecks screen-reader output. The real text
 * stays in an aria-label so assistive tech reads one clean string.
 */
function MaskedWords({
  text,
  className,
  as = "h1",
  delay = 0,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2";
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((word, i) => (
        // Descenders (p, g, y) would be clipped by the mask, so the wrapper
        // is padded and the padding pulled back off with a negative margin.
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="mr-[0.26em] -mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom"
        >
          <motion.span
            className="inline-block"
            initial={{ y: "108%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.8, delay: delay + i * 0.055, ease: EASE }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Scroll-linked parallax offset for an element, in pixels. */
function useParallax(ref: React.RefObject<HTMLElement | null>, distance: number) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return useTransform(scrollYProgress, [0, 1], [distance, -distance]);
}

/** Count-up. Under reduced motion the final value renders immediately. */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) {
      setVal(to);
      return;
    }
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {val}
      {suffix}
    </span>
  );
}

/** Reading-progress hairline pinned to the top of the viewport. */
function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.25 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-landing-primary via-landing-accent to-low"
    />
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
  id,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <Stagger className="max-w-2xl" gap={0.08}>
      <StaggerItem>
        <p className="font-mono flex items-center gap-2 text-xs tracking-[0.18em] text-landing-accent uppercase">
          <span aria-hidden className="h-px w-6 bg-landing-accent/60" />
          {eyebrow}
        </p>
      </StaggerItem>
      <StaggerItem>
        {/* The mask reveal needs its own in-view trigger, so it runs on the
            heading itself rather than inheriting the stagger variant. */}
        {reduce ? (
          <h2
            id={id}
            className="font-display mt-3 text-3xl leading-[1.15] font-semibold tracking-[-0.02em] text-landing-fg sm:text-4xl md:text-[2.75rem]"
          >
            {title}
          </h2>
        ) : (
          <motion.h2
            id={id}
            aria-label={title}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="font-display mt-3 text-3xl leading-[1.15] font-semibold tracking-[-0.02em] text-landing-fg sm:text-4xl md:text-[2.75rem]"
          >
            {title.split(" ").map((word, i) => (
              <span
                key={`${word}-${i}`}
                aria-hidden
                className="mr-[0.26em] -mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom"
              >
                <motion.span
                  className="inline-block"
                  variants={{
                    hidden: { y: "108%" },
                    show: { y: "0%", transition: { duration: 0.72, delay: i * 0.045, ease: EASE } },
                  }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.h2>
        )}
      </StaggerItem>
      {sub && (
        <StaggerItem>
          <p className="mt-4 text-base leading-relaxed text-landing-fg-secondary">{sub}</p>
        </StaggerItem>
      )}
    </Stagger>
  );
}

/* ---------- hero console ---------- */

function ScanConsole() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? logLines.length : 0);

  // Types the log out once on mount and then leaves it complete. The previous
  // version looped forever, which meant the panel sat mostly empty for most of
  // the cycle and added a permanent animation to the hero — both at odds with
  // the "one entrance per view" motion policy.
  useEffect(() => {
    if (reduce) {
      setVisible(logLines.length);
      return;
    }
    const id = window.setInterval(() => {
      setVisible((v) => {
        if (v >= logLines.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 420);
    return () => window.clearInterval(id);
  }, [reduce]);

  const tone: Record<string, string> = {
    boot: "text-landing-fg-muted",
    info: "text-landing-fg-muted",
    crit: "text-critical",
    high: "text-high",
    ok: "text-low",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-landing-border bg-landing-surface shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-landing-border bg-landing-surface-2 px-4 py-3">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-critical/60" />
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-medium/60" />
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-low/60" />
        <span className="font-mono ml-3 flex items-center gap-2 text-xs text-landing-fg-muted">
          <Terminal aria-hidden className="h-3.5 w-3.5" />
          sandbox · runner-01
        </span>
        <span className="font-mono ml-auto flex items-center gap-1.5 text-[11px] text-low">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-low" />
          live
        </span>
      </div>

      <div className="font-mono relative overflow-hidden p-4 text-[12.5px] leading-[1.9] sm:p-5">
        {/* A single scan sweep as the log finishes writing — on-theme for a
            scanner, and it runs exactly once rather than on a loop. */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-landing-accent/14 to-transparent"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: ["-100%", "420%"], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, delay: 0.5, ease: "easeInOut", times: [0, 0.1, 0.85, 1] }}
          />
        )}
        <ul className="relative space-y-0.5">
          {logLines.map((l, i) => (
            <li
              key={l.text}
              className={`flex items-start gap-2 transition-opacity duration-300 ${tone[l.t]} ${
                i < visible ? "opacity-100" : "opacity-0"
              }`}
            >
              <span aria-hidden className="shrink-0 select-none text-landing-border-strong">
                ›
              </span>
              <span className="min-w-0 break-words">{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- product surface: a real finding ---------- */

function FindingCard() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-90px" });
  // The report visibly assembles itself — header, then each block — which is
  // the one place on the page where motion carries actual meaning: it mirrors
  // what the scanner does.
  const show = reduce || inView;

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-xl border border-landing-border bg-landing-surface"
    >
      <motion.div
        className="flex flex-wrap items-center gap-2 border-b border-landing-border bg-landing-surface-2 px-5 py-4"
        initial={false}
        animate={show ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <span className="rounded border border-critical/30 bg-critical/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-critical uppercase">
          Critical
        </span>
        <span className="font-mono text-xs text-landing-fg-muted">CWE-798</span>
        <span className="font-mono text-xs text-landing-fg-muted">CVSS 9.1</span>
        <motion.span
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-low"
          initial={false}
          animate={show && !reduce ? { scale: [0.85, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, delay: 0.85, ease: EASE }}
        >
          <ShieldCheck aria-hidden className="h-4 w-4" />
          Sandbox verified
        </motion.span>
      </motion.div>

      <Stagger className="space-y-5 p-5 sm:p-6" gap={0.12} delay={0.15}>
        <StaggerItem>
          <h3 className="font-display text-lg font-semibold text-landing-fg">
            Hardcoded credential: AWS Access Key ID
          </h3>
          <p className="font-mono mt-2 rounded-md border border-landing-border bg-landing-bg px-3 py-2 text-xs break-all text-landing-fg-secondary">
            .env:4
          </p>
        </StaggerItem>

        <StaggerItem>
          <p className="font-mono text-[11px] tracking-[0.14em] text-landing-fg-muted uppercase">
            Evidence
          </p>
          <p className="mt-2 text-sm leading-relaxed text-landing-fg-secondary">
            CodeQL security-extended analysis: 1 finding — matched the flagged file and the relevant
            CWE. Secret confirmed present at HEAD.
          </p>
        </StaggerItem>

        <StaggerItem>
          <p className="font-mono text-[11px] tracking-[0.14em] text-landing-fg-muted uppercase">
            Remediation
          </p>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-landing-fg-secondary">
            <li className="flex gap-2.5">
              <span className="font-mono text-landing-accent">1</span>
              Rotate the exposed credential at the issuing provider.
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-landing-accent">2</span>
              Load it from a secret manager instead of committing it.
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-landing-accent">3</span>
              Purge the value from git history, then invalidate caches.
            </li>
          </ol>
        </StaggerItem>
      </Stagger>
    </div>
  );
}

/* ---------- page ---------- */

function Landing() {
  const reduce = useReducedMotion();
  const heroIn = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  // Hero depth: copy, console and backdrop drift at different rates as the
  // hero scrolls away, so the section has parallax depth instead of moving as
  // one flat plane.
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const copyY = useTransform(heroP, [0, 1], [0, 90]);
  const copyFade = useTransform(heroP, [0, 0.75], [1, 0]);
  const consoleY = useTransform(heroP, [0, 1], [0, 150]);
  const gridY = useTransform(heroP, [0, 1], [0, 60]);
  const glowY = useTransform(heroP, [0, 1], [0, -40]);

  // The step connector draws itself as the section scrolls into place.
  const stepsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: stepsP } = useScroll({
    target: stepsRef,
    offset: ["start 0.9", "start 0.35"],
  });
  const lineScale = useSpring(stepsP, { stiffness: 90, damping: 26, mass: 0.3 });

  return (
    <div className="font-body min-h-screen bg-landing-bg text-landing-fg">
      <ScrollProgress />
      <a
        href="#main"
        className="focus-ring sr-only cursor-pointer focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-landing-primary focus:px-4 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-landing-border bg-landing-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-6">
          <Link
            to="/"
            className="focus-ring flex min-h-11 cursor-pointer items-center gap-2 rounded-sm"
            aria-label="PentestAI home"
          >
            <Shield aria-hidden className="h-6 w-6 text-landing-accent" strokeWidth={2.25} />
            <span className="font-display text-lg font-semibold tracking-[-0.01em]">PentestAI</span>
          </Link>

          {/* Link list and the secondary CTA only appear at lg. At 768 there
              isn't room for logo + 3 links + 2 buttons, and everything wraps
              to two lines. */}
          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm lg:flex">
            {[
              { href: "#features", label: "Features" },
              { href: "#how", label: "How It Works" },
              { href: "#coverage", label: "Coverage" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="focus-ring cursor-pointer rounded-sm whitespace-nowrap text-landing-fg-secondary transition-colors duration-200 hover:text-landing-fg"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="focus-ring hidden min-h-11 cursor-pointer items-center rounded-md border border-landing-border px-4 text-sm font-medium whitespace-nowrap text-landing-fg transition-colors duration-200 hover:border-landing-border-strong hover:bg-landing-surface lg:inline-flex"
            >
              Live demo
            </Link>
            <Link
              to="/auth"
              className="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-landing-primary px-4 text-sm font-medium whitespace-nowrap text-white transition-colors duration-200 hover:bg-landing-primary-hover"
            >
              <Github aria-hidden className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in with GitHub</span>
              <span className="sm:hidden">Sign in</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section ref={heroRef} className="relative overflow-hidden border-b border-landing-border">
          <motion.div
            aria-hidden
            style={reduce ? undefined : { y: gridY }}
            className="grid-bg absolute inset-0 opacity-70"
          />
          {/* The bloom sits low in the section and drifts slightly slower than
              the content, so it behaves like a light source behind the page
              rather than a texture stuck to it. */}
          <motion.div
            aria-hidden
            style={reduce ? undefined : { y: glowY }}
            className="landing-glow pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden
            className="glow-seam pointer-events-none absolute inset-x-0 bottom-0 h-px"
          />

          <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 py-20 md:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-32">
            <motion.div style={reduce ? undefined : { y: copyY, opacity: copyFade }}>
              <motion.p
                {...heroIn(0)}
                className="font-mono flex items-center gap-2 text-xs tracking-[0.18em] text-landing-accent uppercase"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-landing-accent" />
                Powered by Large Language Models
              </motion.p>

              <MaskedWords
                text="AI-powered penetration testing for GitHub."
                delay={0.12}
                className="font-display mt-5 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.75rem]"
              />

              <motion.p
                {...heroIn(0.16)}
                className="mt-6 max-w-xl text-lg leading-[1.65] text-landing-fg-secondary"
              >
                Secure your GitHub repositories with automated penetration testing powered by Large
                Language Models. Get actionable vulnerability reports and remediation steps.
              </motion.p>

              <motion.div {...heroIn(0.24)} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-landing-primary px-6 py-3.5 font-medium text-white transition-colors duration-200 hover:bg-landing-primary-hover"
                >
                  <Github aria-hidden className="h-5 w-5" />
                  Start Scanning
                </Link>
                <Link
                  to="/dashboard"
                  className="focus-ring group inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-landing-border bg-landing-surface px-6 py-3.5 font-medium text-landing-fg transition-colors duration-200 hover:border-landing-border-strong hover:bg-landing-surface-2"
                >
                  View Live Demo
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
              </motion.div>

              <motion.p
                {...heroIn(0.32)}
                /* fg-secondary rather than fg-muted: this line sits over the
                   lit part of the hero, where muted grey measured 3.1:1. */
                className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-landing-fg-secondary"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 aria-hidden className="h-4 w-4 text-low" />
                  Read-only GitHub access
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 aria-hidden className="h-4 w-4 text-low" />
                  Your code is never modified
                </span>
              </motion.p>
            </motion.div>

            <motion.div
              style={reduce ? undefined : { y: consoleY }}
              initial={reduce ? undefined : { opacity: 0, x: 28 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.75, delay: 0.28, ease: EASE }}
            >
              <ScanConsole />
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section aria-label="Product metrics" className="border-b border-landing-border">
          {/* Padding lives on the wrapper, not the grid: a padded grid with
              gap-px + a background paints the gutters in border colour and
              leaves visible slabs down both edges. */}
          <div className="mx-auto max-w-[1200px] px-6">
            <Stagger
              as="dl"
              gap={0.09}
              className="grid grid-cols-2 gap-px overflow-hidden bg-landing-border md:grid-cols-4"
            >
              {stats.map((s) => (
                <StaggerItem
                  key={s.label}
                  className="bg-landing-bg px-2 py-10 text-center md:py-12"
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <div className="font-display text-3xl font-semibold tracking-[-0.02em] text-landing-fg md:text-4xl">
                      <Counter to={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-1.5 text-sm text-landing-fg-muted">{s.label}</div>
                  </dd>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Product surface */}
        <section className="border-b border-landing-border">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="What you get back"
                title="Every finding arrives with proof attached."
                sub="PentestAI doesn't just flag a pattern and hope. Each high or critical finding is re-run inside an isolated container with CodeQL's taint analysis, so you see whether the vulnerability is actually reachable — with the evidence that proved it and the steps to close it."
              />
              <Stagger
                delay={0.28}
                gap={0.09}
                className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-landing-fg-muted"
              >
                <StaggerItem className="inline-flex items-center gap-2">
                  <Bug aria-hidden className="h-4 w-4 text-landing-accent" />
                  Dataflow-verified, not pattern-matched
                </StaggerItem>
                <StaggerItem className="inline-flex items-center gap-2">
                  <Lock aria-hidden className="h-4 w-4 text-landing-accent" />
                  Runs with no network access
                </StaggerItem>
              </Stagger>
            </div>

            <Reveal delay={0.1} y={26}>
              <FindingCard />
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-landing-border">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
            <SectionHeading
              eyebrow="Capabilities"
              title="Key features"
              sub="Everything you need for automated, verifiable security testing."
            />

            <Stagger
              gap={0.07}
              className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((f) => (
                <StaggerItem key={f.title} className="h-full">
                  <motion.div
                    whileHover={reduce ? undefined : { y: -5 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className="group h-full rounded-xl border border-landing-border bg-landing-surface p-6 transition-colors duration-200 hover:border-landing-border-strong hover:bg-landing-surface-2"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-landing-border-strong/60 bg-landing-primary/10 text-landing-accent transition-transform duration-200 group-hover:scale-110">
                      <f.icon aria-hidden className="h-5 w-5" />
                    </div>
                    <h3 className="font-display mt-5 text-lg font-semibold text-landing-fg">
                      {f.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-landing-fg-secondary">
                      {f.desc}
                    </p>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-landing-border">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
            <SectionHeading
              eyebrow="Process"
              title="How it works"
              sub="Four steps from connection to remediation."
            />

            <div ref={stepsRef} className="mt-14">
              {/* Connector that draws itself left-to-right as the section
                  arrives — scroll-linked, so it tracks the user rather than
                  playing on a timer. */}
              {!reduce && (
                <motion.div
                  aria-hidden
                  style={{ scaleX: lineScale }}
                  className="mb-6 hidden h-px origin-left bg-gradient-to-r from-landing-accent via-landing-primary to-transparent sm:block"
                />
              )}
              <Stagger
                as="ol"
                gap={0.09}
                className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-landing-border bg-landing-border sm:grid-cols-2 lg:grid-cols-4"
              >
                {steps.map((s) => (
                  <StaggerItem as="li" key={s.n} className="bg-landing-surface p-6">
                    <span className="font-mono inline-flex h-8 w-8 items-center justify-center rounded-md border border-landing-border-strong/60 bg-landing-primary/10 text-sm font-medium text-landing-accent">
                      {s.n}
                    </span>
                    <h3 className="font-display mt-4 font-semibold text-landing-fg">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-landing-fg-secondary">
                      {s.desc}
                    </p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section id="coverage" className="border-b border-landing-border">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
            <SectionHeading
              eyebrow="Coverage"
              title="Weakness classes we hunt for."
              sub="Mapped to CWE and OWASP, scored with CVSS 3.1, and verified in the sandbox before they reach your report."
            />

            <Stagger
              as="ul"
              gap={0.045}
              delay={0.1}
              className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {coverage.map((c) => {
                const [id, ...rest] = c.split(" ");
                return (
                  <StaggerItem
                    as="li"
                    key={c}
                    className="rounded-lg border border-landing-border bg-landing-surface px-4 py-3.5 transition-colors duration-200 hover:border-landing-border-strong"
                  >
                    <span className="font-mono block text-xs text-landing-accent">{id}</span>
                    <span className="mt-1 block text-sm text-landing-fg-secondary">
                      {rest.join(" ")}
                    </span>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* CTA */}
        <section className="border-b border-landing-border">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-28">
            <Reveal y={26}>
              <div className="relative overflow-hidden rounded-2xl border border-landing-border bg-landing-surface px-6 py-16 text-center sm:px-12">
                <div aria-hidden className="landing-glow pointer-events-none absolute inset-0" />
                <div className="relative mx-auto max-w-2xl">
                  <h2 className="font-display text-3xl leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-landing-fg md:text-[2.5rem]">
                    Find the exploit before someone else does.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-landing-fg-secondary">
                    Connect a repository and get your first sandbox-verified report in under a
                    minute.
                  </p>
                  <Link
                    to="/auth"
                    className="focus-ring mt-9 inline-flex cursor-pointer items-center gap-2 rounded-md bg-landing-primary px-6 py-3.5 font-medium text-white transition-colors duration-200 hover:bg-landing-primary-hover"
                  >
                    <Github aria-hidden className="h-5 w-5" />
                    Start Scanning
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Trust */}
        <section aria-label="Security guarantees" className="border-b border-landing-border">
          <Stagger
            gap={0.08}
            className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-10 text-sm text-landing-fg-muted"
          >
            {trust.map((item) => (
              <StaggerItem key={item} className="flex items-center gap-2">
                <CheckCircle2 aria-hidden className="h-4 w-4 text-low" />
                {item}
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-landing-bg">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-5 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2">
            <Shield aria-hidden className="h-5 w-5 text-landing-accent" />
            <span className="font-display font-semibold text-landing-fg">PentestAI</span>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"
          >
            {["Privacy", "Terms", "Security", "Contact"].map((l) => (
              <a
                key={l}
                href="#"
                className="focus-ring cursor-pointer rounded-sm text-landing-fg-muted transition-colors duration-200 hover:text-landing-fg"
              >
                {l}
              </a>
            ))}
          </nav>
        </div>
        <div className="px-6 pb-10 text-center text-xs text-landing-fg-muted">
          Only scan repositories you own or are authorized to test.
        </div>
      </footer>
    </div>
  );
}
