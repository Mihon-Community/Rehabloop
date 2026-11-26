import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ChartNoAxesCombined,
  ClipboardList,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Video,
} from 'lucide-react';
import { ThemePicker } from '@/components/layout/ThemePicker';
import { Reveal } from '@/components/Reveal';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TwinAvatar = lazy(() => import('@/features/recovery-twin/TwinAvatar'));

const steps = [
  {
    number: '01',
    title: 'Clinician sets a protocol',
    description:
      'A physiotherapist configures the exercise, target range and stop instructions for the individual patient.',
    icon: ClipboardList,
  },
  {
    number: '02',
    title: 'Patient completes a guided session',
    description:
      'With consent, a single camera samples frames while setup checks and plain-language guidance keep the session focused.',
    icon: Video,
  },
  {
    number: '03',
    title: 'Clinician reviews recorded metrics',
    description:
      'Repetitions, projected angles and measurement-quality flags are saved together for review at the next visit.',
    icon: ChartNoAxesCombined,
  },
];

const differences = [
  {
    title: 'Measurement, not a chat',
    description:
      'The app records repetitions, projected angle estimates and quality flags. It is not an open-ended health assistant.',
    icon: ChartNoAxesCombined,
  },
  {
    title: 'The clinician stays in control',
    description:
      'A physiotherapist configures the protocol and interprets the record. RehabLoop never prescribes, decides safety or changes a care plan.',
    icon: ClipboardList,
  },
  {
    title: 'Configured counting, not guesses',
    description:
      'Repetitions come from a state machine with clinician-set ranges and confidence gates, not from a generative model.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Honest about uncertainty',
    description:
      'Angles are labelled projected 2D estimates, fixture data is labelled SIMULATED, and raw video is not stored by default.',
    icon: ShieldCheck,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6"
        >
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-bold"
            aria-label="RehabLoop home"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            RehabLoop
          </Link>
          <div className="ml-4 hidden items-center gap-5 text-sm font-medium sm:flex">
            <a href="#how-it-works" className="hover:text-[var(--primary)]">
              How it works
            </a>
            <a href="#safety" className="hover:text-[var(--primary)]">
              Safety
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/sign-up">
                Get started <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="medical-bg medical-bg-wave mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <Reveal>
            <p className="section-kicker">Movement intelligence between appointments</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              See how a prescribed movement was{' '}
              <span className="text-[var(--primary)]">performed.</span>
            </h1>
            <p className="screen-intro mt-5 text-base sm:text-lg">
              RehabLoop helps a physiotherapist review clinician-prescribed exercise sessions
              between visits. One camera, projected 2D estimates and recorded measurements — not a
              diagnosis and not medical advice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  Get started <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <p className="meta mt-5">
              <ShieldCheck className="mr-1 inline size-4" aria-hidden="true" />
              Prototype, not a medical device. No account is created in this demo build.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div
              className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
              aria-label="Illustrative session measurement preview"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline">Session preview</Badge>
                <SimulatedBadge source="simulated" />
              </div>
              <p className="text-sm font-semibold">Projected knee angle estimate</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">72° – 118°</p>
              <svg
                viewBox="0 0 420 150"
                className="mt-3 w-full"
                role="img"
                aria-label="Illustrative projected angle trace over time"
              >
                <path d="M0 120 H420" stroke="var(--border)" strokeWidth="1" />
                <path
                  className="hero-trace"
                  d="M0 110 C35 110 40 40 75 40 S115 110 150 110 S190 35 225 40 S270 110 305 110 S350 45 385 45 S410 105 420 105"
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="3"
                />
                <circle className="hero-pulse" cx="225" cy="40" r="6" fill="var(--chart-1)" />
              </svg>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-[var(--muted-bg)] p-2">
                  <strong className="block text-base">6 / 8</strong> repetitions
                </div>
                <div className="rounded-lg bg-[var(--muted-bg)] p-2">
                  <strong className="block text-base">89%</strong> usable frames
                </div>
                <div className="rounded-lg bg-[var(--muted-bg)] p-2">
                  <strong className="block text-base">2D</strong> projected estimate
                </div>
              </div>
              <p className="meta mt-3">
                Illustrative values, not clinical thresholds or real inference.
              </p>
            </div>
          </Reveal>
        </section>

        <section
          id="problem"
          className="landing-section border-y border-[var(--border)] bg-[var(--card)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="section-kicker">The gap</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Visibility between appointments
              </h2>
              <p className="screen-intro">
                Outside the clinic, a physiotherapist may have little objective information about
                how a prescribed exercise was performed. Patients may be unsure whether they
                followed the intended movement pattern. RehabLoop records structured, reviewable
                measurements for the clinician to interpret.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <Activity className="size-6 text-[var(--primary)]" aria-hidden="true" />
                  <h3 className="text-base">For patients</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    See the protocol, review the stop instructions and understand which measurements
                    were recorded — without a diagnosis or treatment recommendation.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <ClipboardList className="size-6 text-[var(--primary)]" aria-hidden="true" />
                  <h3 className="text-base">For physiotherapists</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Review repetitions, projected angle ranges and data-quality flags alongside the
                    protocol version the patient followed.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="section-kicker">How it works</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three clear steps</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={index * 100}>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--primary)]">
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold tracking-widest text-[var(--muted-foreground)]">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="landing-section border-y border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <p className="section-kicker">Interface previews</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Purpose-built views</h2>
              <p className="screen-intro">
                Each view explains one part of the journey. All figures below are simulated
                illustrations.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              <Reveal>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <Badge variant="outline">Patient session</Badge>
                  <svg
                    viewBox="0 0 240 140"
                    className="mt-4 w-full rounded-lg bg-[var(--camera-surface)]"
                    role="img"
                    aria-label="Illustrative camera framing preview with hip, knee and ankle points"
                  >
                    <circle cx="95" cy="45" r="8" fill="var(--camera-point)" />
                    <line
                      x1="95"
                      y1="53"
                      x2="105"
                      y2="90"
                      stroke="var(--camera-point)"
                      strokeWidth="4"
                    />
                    <circle cx="105" cy="90" r="7" fill="var(--camera-point)" />
                    <line
                      x1="105"
                      y1="90"
                      x2="160"
                      y2="95"
                      stroke="var(--camera-point)"
                      strokeWidth="4"
                    />
                    <circle cx="160" cy="95" r="7" fill="var(--camera-point)" />
                    <text x="12" y="130" fill="var(--camera-text)" fontSize="10">
                      side view · full leg visible
                    </text>
                  </svg>
                  <p className="mt-3 text-sm font-semibold">Guided camera setup</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Framing checklist and live quality status before measurement begins.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <Badge variant="outline">Clinician review</Badge>
                  <div
                    className="mt-4 flex h-[140px] items-end gap-3 rounded-lg bg-[var(--card)] p-4"
                    role="img"
                    aria-label="Illustrative bar preview of repetitions across three sessions"
                  >
                    {[6, 8, 5].map((value, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-[var(--chart-1)]"
                          style={{ height: `${value * 13}px` }}
                        />
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {value} reps
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-semibold">Session history</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Comparable sessions with quality flags and protocol versions.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <Badge variant="outline">Recovery Twin</Badge>
                  <div className="landing-twin mt-4 h-[140px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted-bg)]">
                    <Suspense
                      fallback={
                        <p className="p-4 text-xs text-[var(--muted-foreground)]">
                          Loading preview…
                        </p>
                      }
                    >
                      <TwinAvatar angle={84} variant="primary" />
                    </Suspense>
                  </div>
                  <p className="mt-3 text-sm font-semibold">Measured movement replay</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    A schematic replay of the projected angle trace. Interactive when WebGL is
                    available, with a labelled 2D fallback otherwise.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          id="different"
          className="landing-section medical-bg medical-bg-grid mx-auto max-w-6xl px-4 py-16 sm:px-6"
        >
          <Reveal>
            <p className="section-kicker">Why it is different</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Designed as evidence, not advice
            </h2>
            <p className="screen-intro">
              These are deliberate design choices for a prototype — not a claim of clinical
              superiority over other tools.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {differences.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <div className="card card-interactive h-full">
                  <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--primary)]">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-0 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="safety" className="landing-section mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="section-kicker">Safety and privacy</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Clear boundaries</h2>
          </Reveal>
          <Reveal delay={100}>
            <Alert variant="info" icon={<ShieldCheck className="size-5" />} className="mt-6">
              <AlertTitle>Prototype, not a medical device.</AlertTitle>
              <AlertDescription>
                RehabLoop does not diagnose, treat, prescribe or give medical advice. It does not
                decide whether an exercise is safe or change a care plan. All angles are projected
                2D estimates from one camera view, not validated anatomical measurements. Raw video
                is not stored by default. A clinician sets the protocol and interprets the results.
              </AlertDescription>
            </Alert>
          </Reveal>
          <Reveal delay={150}>
            <p className="meta mt-4 flex items-center gap-2">
              <LockKeyhole className="size-4" aria-hidden="true" />
              Fixture and demo data are always labelled simulated, never presented as real
              inference.
            </p>
          </Reveal>
        </section>

        <section className="medical-bg medical-bg-grid border-t border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Ready to explore?</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Use demo access, or sign in if a Supabase project is configured.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  Get started <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--muted-foreground)] sm:px-6">
          <p className="font-semibold text-[var(--foreground)]">RehabLoop · prototype</p>
          <p className="mt-1">
            Not a medical device. Projected 2D estimates only. Raw video is not stored by default. A
            clinician owns the protocol and interprets the results.
          </p>
          <div className="mt-3 flex gap-4">
            <a href="#how-it-works">How it works</a>
            <a href="#safety">Safety</a>
            <Link to="/sign-in">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
