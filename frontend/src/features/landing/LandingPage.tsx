import { Suspense, lazy, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemePicker } from '@/components/layout/ThemePicker';
import { Reveal } from '@/components/Reveal';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusPill } from '@/components/StatusPill';
import {
  Activity,
  ArrowRight,
  Box,
  Camera,
  ChartNoAxesCombined,
  ClipboardList,
  HeartPulse,
  Info,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Video,
  type IconComponent,
} from '@/components/icon';
import { Button, Card } from '@/components/base';

const TwinAvatar = lazy(() => import('@/features/recovery-twin/TwinAvatar'));

interface Panel {
  title: string;
  /** Short label that sits under the title, the way a chart section is filed. */
  meta?: string;
  description: string;
  icon: IconComponent;
}

const audiences: Panel[] = [
  {
    title: 'For patients',
    description:
      'See the protocol, review the stop instructions and understand which measurements were recorded — without a diagnosis or treatment recommendation.',
    icon: Activity,
  },
  {
    title: 'For physiotherapists',
    description:
      'Review repetitions, projected angle ranges and data-quality flags alongside the protocol version the patient followed.',
    icon: Stethoscope,
  },
];

const steps: Panel[] = [
  {
    title: 'Clinician sets a protocol',
    meta: 'Step 01',
    description:
      'A physiotherapist configures the exercise, target range and stop instructions for the individual patient.',
    icon: ClipboardList,
  },
  {
    title: 'Patient completes a guided session',
    meta: 'Step 02',
    description:
      'With consent, a single camera samples frames while setup checks and plain-language guidance keep the session focused.',
    icon: Video,
  },
  {
    title: 'Clinician reviews recorded metrics',
    meta: 'Step 03',
    description:
      'Repetitions, projected angles and measurement-quality flags are saved together for review at the next visit.',
    icon: ChartNoAxesCombined,
  },
];

const differences: Panel[] = [
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

/* Every card on this page is a filed panel rather than a marketing tile: the
   shared chart-head (icon chip, title block, optional trailing slot) gives all
   of them the same hairline rule and the same chip alignment. None of them is
   clickable, so none of them wears `card-interactive` — a hover lift on static
   prose is the one thing that makes a clinical page read as an advert. */
function PanelCard({ panel }: { panel: Panel }) {
  return (
    <Card>
      <div className="card-chart-head">
        <span className="icon-chip" aria-hidden="true">
          <panel.icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="card-chart-title">{panel.title}</h3>
          {panel.meta ? <p className="card-chart-meta">{panel.meta}</p> : null}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{panel.description}</p>
    </Card>
  );
}

/** Consistent section header: kicker, h2, and an optional standfirst. */
function SectionHeading({
  kicker,
  title,
  children,
  badge,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <>
      <p className="section-kicker">{kicker}</p>
      {badge ? (
        <div className="screen-title-row">
          <h2 className="mt-0 mb-0 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {title}
          </h2>
          {badge}
        </div>
      ) : (
        <h2 className="mt-0 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h2>
      )}
      {children}
    </>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Same frosted bar and primary-tinted hairline as the signed-in topbar,
          so the public page and the app read as one product. The mark uses the
          app's tinted icon chip rather than a filled primary block: on this
          page the primary colour is reserved for the kicker, the one accented
          word in the h1 and the call to action. */}
      <header className="app-topbar sticky top-0 z-40">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6"
        >
          {/* Below sm the wordmark gives way to the mark alone — four controls
              plus the full name do not fit a 375px bar. The link keeps its
              accessible name either way. */}
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="RehabLoop home">
            <span className="icon-chip" aria-hidden="true">
              <HeartPulse className="size-[18px]" />
            </span>
            <span
              className="hidden text-base font-bold tracking-tight text-[var(--foreground)] sm:inline"
              aria-hidden="true"
            >
              RehabLoop
            </span>
          </Link>
          <div className="ml-2 hidden items-center gap-5 text-sm font-medium sm:flex">
            <a href="#how-it-works" className="text-[var(--muted-foreground)] hover:text-primary">
              How it works
            </a>
            <a href="#safety" className="text-[var(--muted-foreground)] hover:text-primary">
              Safety
            </a>
          </div>
          {/* The signed-in topbar's clinical signature, kept to a hairline and
              only from xl up, where there is width left after the actions. */}
          <svg
            className="ecg-rule mx-2 hidden h-3 w-24 shrink-0 xl:block"
            viewBox="0 0 120 10"
            aria-hidden="true"
          >
            <path d="M0 5h34l4-4 4 8 4-8 4 4h18l4-3 4 6 4-6 3 3h34" />
          </svg>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemePicker />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/sign-up">
                Get started <ArrowRight className="hidden sm:block" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="medical-bg medical-bg-wave">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14 lg:py-24">
            <Reveal>
              <p className="section-kicker">Movement intelligence between appointments</p>
              <h1 className="mb-4 text-[2rem] leading-[1.1] font-bold tracking-tight text-balance sm:mb-5 sm:text-[2.75rem] lg:text-[3.25rem]">
                See how a prescribed movement was{' '}
                <span className="text-[var(--primary)]">performed.</span>
              </h1>
              <p className="screen-intro text-base sm:text-lg">
                RehabLoop helps a physiotherapist review clinician-prescribed exercise sessions
                between visits. One camera, projected 2D estimates and recorded measurements — not a
                diagnosis and not medical advice.
              </p>
              {/* button-row stacks to full-width targets below 30rem, so the
                  two calls to action stay tappable at 320px. */}
              <div className="button-row">
                <Button size="lg" asChild>
                  <Link to="/sign-up">
                    Get started <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="meta flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Prototype, not a medical device. No account is created in this demo build.
                </span>
              </p>
            </Reveal>

            {/* The hero's one visual claim is a measurement panel, so it is
                built from the measurement vocabulary: ECG-paper surface, chart
                head, SIMULATED chip in the trailing slot, vitals strip for the
                readings. Headings are deliberately <p> here — the only h1 on
                the page is the one above it. */}
            <Reveal>
              <Card
                surface="paper"
                role="group"
                aria-label="Illustrative session measurement preview"
                className="lg:ml-auto lg:max-w-[30rem]"
              >
                {/* flex-wrap so the SIMULATED chip drops below the title on a
                    phone instead of squeezing it into a four-line column. */}
                <div className="card-chart-head flex-wrap">
                  <span className="icon-chip" aria-hidden="true">
                    <Activity className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="card-chart-title">Projected knee angle estimate</p>
                    <p className="card-chart-meta">Session preview</p>
                  </div>
                  <SimulatedBadge source="simulated" />
                </div>
                <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  72° – 118°
                </p>
                <svg
                  viewBox="0 0 420 150"
                  className="mt-3 w-full"
                  role="img"
                  aria-label="Illustrative projected angle trace over time"
                >
                  <path d="M0 120 H420" stroke="var(--border)" strokeWidth="1" />
                  <path
                    d="M0 110 C35 110 40 40 75 40 S115 110 150 110 S190 35 225 40 S270 110 305 110 S350 45 385 45 S410 105 420 105"
                    fill="none"
                    stroke="var(--chart-1)"
                    strokeWidth="3"
                  />
                  <circle className="hero-pulse" cx="225" cy="40" r="6" fill="var(--chart-1)" />
                </svg>
                <dl className="vitals-strip mt-4">
                  <div>
                    <dt className="vitals-label">Repetitions</dt>
                    <dd className="vitals-value">6 / 8</dd>
                  </div>
                  <div>
                    <dt className="vitals-label">Usable frames</dt>
                    <dd className="vitals-value">89%</dd>
                  </div>
                  <div>
                    <dt className="vitals-label">Estimate</dt>
                    <dd className="vitals-value">2D projected</dd>
                  </div>
                </dl>
                <p className="meta">
                  Illustrative values, not clinical thresholds or real inference.
                </p>
              </Card>
            </Reveal>
          </div>
        </section>

        <section
          id="problem"
          className="landing-section border-y border-[var(--border)] bg-[var(--muted-bg)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <Reveal>
              <SectionHeading kicker="The gap" title="Visibility between appointments">
                <p className="screen-intro">
                  Outside the clinic, a physiotherapist may have little objective information about
                  how a prescribed exercise was performed. Patients may be unsure whether they
                  followed the intended movement pattern. RehabLoop records structured, reviewable
                  measurements for the clinician to interpret.
                </p>
              </SectionHeading>
            </Reveal>
            <Reveal className="mt-6 sm:mt-8">
              <div className="motion-stagger grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                {audiences.map((panel) => (
                  <PanelCard key={panel.title} panel={panel} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <Reveal>
              <SectionHeading kicker="How it works" title="Three clear steps">
                <p className="screen-intro">
                  One prescribed exercise, one recorded session, one review. Nothing in the loop
                  decides anything on the clinician&rsquo;s behalf.
                </p>
              </SectionHeading>
            </Reveal>
            <Reveal className="mt-6 sm:mt-8">
              <ol className="motion-stagger grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
                {steps.map((step) => (
                  <li key={step.title} className="card">
                    <div className="card-chart-head">
                      <span className="icon-chip" aria-hidden="true">
                        <step.icon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="card-chart-title">{step.title}</h3>
                        <p className="card-chart-meta">{step.meta}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <section className="landing-section border-y border-[var(--border)] bg-[var(--muted-bg)]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <Reveal>
              <SectionHeading
                kicker="Interface previews"
                title="Purpose-built views"
                badge={<SimulatedBadge source="simulated" />}
              >
                <p className="screen-intro">
                  Each view explains one part of the journey. All figures below are simulated
                  illustrations.
                </p>
              </SectionHeading>
            </Reveal>
            {/* minmax(0,1fr) on the single-column track: these cards hold an
                SVG and a WebGL canvas, and an implicit auto track would take
                the widest child's min-content width and push the page
                sideways on a phone. Every preview frame is the same 140px
                tall so the three titles sit on one line. */}
            <Reveal className="mt-6 sm:mt-8">
              <div className="motion-stagger grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
                <Card>
                  <div className="card-chart-head">
                    <span className="icon-chip" aria-hidden="true">
                      <Camera className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="card-chart-title">Guided camera setup</h3>
                      <p className="card-chart-meta">Patient session</p>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 240 140"
                    className="h-[140px] w-full rounded-xl bg-[var(--camera-surface)]"
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
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    Framing checklist and live quality status before measurement begins.
                  </p>
                </Card>

                <Card>
                  <div className="card-chart-head">
                    <span className="icon-chip" aria-hidden="true">
                      <ChartNoAxesCombined className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="card-chart-title">Session history</h3>
                      <p className="card-chart-meta">Clinician review</p>
                    </div>
                  </div>
                  <div
                    className="flex h-[140px] items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted-bg)] p-4"
                    role="img"
                    aria-label="Illustrative bar preview of repetitions across three sessions"
                  >
                    {[6, 8, 5].map((value, index) => (
                      <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-[var(--chart-1)]"
                          style={{ height: `${value * 10}px` }}
                        />
                        <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
                          {value} reps
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    Comparable sessions with quality flags and protocol versions.
                  </p>
                </Card>

                <Card>
                  <div className="card-chart-head">
                    <span className="icon-chip" aria-hidden="true">
                      <Box className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="card-chart-title">Measured movement replay</h3>
                      <p className="card-chart-meta">Recovery Twin</p>
                    </div>
                  </div>
                  <div className="landing-twin h-[140px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]">
                    <Suspense
                      fallback={
                        <p className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                          Loading preview…
                        </p>
                      }
                    >
                      <TwinAvatar angle={84} variant="primary" />
                    </Suspense>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    A schematic replay of the projected angle trace. Interactive when WebGL is
                    available, with a labelled 2D fallback otherwise.
                  </p>
                </Card>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="different" className="landing-section medical-bg medical-bg-grid">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <Reveal>
              <SectionHeading kicker="Why it is different" title="Designed as evidence, not advice">
                <p className="screen-intro">
                  These are deliberate design choices for a prototype — not a claim of clinical
                  superiority over other tools.
                </p>
              </SectionHeading>
            </Reveal>
            <Reveal className="mt-6 sm:mt-8">
              <div className="motion-stagger grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                {differences.map((panel) => (
                  <PanelCard key={panel.title} panel={panel} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* The scope statement is a notice, not a feature: it gets the caution
            spine a patient file uses for a flagged record, a spelled-out status
            beside it so the level never rests on colour, and the statement set
            as printed text rather than a tinted callout. */}
        <section
          id="safety"
          className="landing-section border-y border-[var(--border)] bg-[var(--muted-bg)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <Reveal>
              <SectionHeading kicker="Safety and privacy" title="Clear boundaries" />
            </Reveal>
            <Reveal className="mt-6 sm:mt-8">
              <Card triage="caution" role="note" aria-labelledby="safety-notice-title">
                <div className="card-chart-head flex-wrap">
                  <span className="icon-chip" aria-hidden="true">
                    <ShieldAlert className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p id="safety-notice-title" className="card-chart-title">
                      Prototype, not a medical device.
                    </p>
                    <p className="card-chart-meta">Scope of this build</p>
                  </div>
                  <StatusPill tone="warn">Prototype</StatusPill>
                </div>
                <p className="max-w-[78ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
                  RehabLoop does not diagnose, treat, prescribe or give medical advice. It does not
                  decide whether an exercise is safe or change a care plan. All angles are projected
                  2D estimates from one camera view, not validated anatomical measurements. Raw
                  video is not stored by default. A clinician sets the protocol and interprets the
                  results.
                </p>
                <p className="meta flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Fixture and demo data are always labelled simulated, never presented as real
                    inference.
                  </span>
                </p>
              </Card>
            </Reveal>
          </div>
        </section>

        <section className="medical-bg medical-bg-grid">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 max-w-[48ch]">
              <h2 className="mt-0 text-2xl font-bold tracking-tight">Ready to explore?</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Use demo access, or sign in if a Supabase project is configured.
              </p>
            </div>
            <div className="button-row md:shrink-0">
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

      <footer className="border-t border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* Same single ECG complex the sidebar footer carries, as a quiet
              rule above the legal line rather than another border. */}
          <svg
            className="ecg-rule mb-6 block h-2.5 w-full"
            viewBox="0 0 240 10"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 5h88l5-4 4 8 5-8 4 4h130" />
          </svg>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-[62ch]">
              <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <HeartPulse className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                RehabLoop · prototype
              </p>
              <p className="meta">
                Not a medical device. Projected 2D estimates only. Raw video is not stored by
                default. A clinician owns the protocol and interprets the results.
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap items-center gap-x-6 text-sm font-medium sm:shrink-0"
            >
              <a href="#how-it-works" className="inline-flex min-h-11 items-center">
                How it works
              </a>
              <a href="#safety" className="inline-flex min-h-11 items-center">
                Safety
              </a>
              <Link to="/sign-in" className="inline-flex min-h-11 items-center">
                Sign in
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
