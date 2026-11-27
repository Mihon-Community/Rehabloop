import { Link } from 'react-router-dom';
import { ArrowRight, Camera, ClipboardList, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Step {
  number: string;
  title: string;
  description: string;
  to: string;
  action: string;
  icon: typeof ClipboardList;
}

/** Guided next steps for the patient overview. No completion is claimed. */
export function StepCards({
  protocolId,
  cameraMode,
}: {
  protocolId: string;
  cameraMode: 'review' | 'camera';
}) {
  const steps: Step[] = [
    {
      number: '01',
      title: 'Review the protocol',
      description: 'Read the prescribed exercise and stop instructions before anything starts.',
      to: `/protocols/${protocolId}`,
      action: 'Open protocol',
      icon: ClipboardList,
    },
    {
      number: '02',
      title: 'Set up the camera',
      description: 'Check consent, framing and lighting. Camera access is optional.',
      to: '/setup',
      action: cameraMode === 'camera' ? 'Continue setup' : 'View setup',
      icon: Camera,
    },
    {
      number: '03',
      title: 'See the result',
      description: 'Review recorded measurements and what to take to your next visit.',
      to: '/sessions/session-demo-1/result',
      action: 'View saved report',
      icon: FileText,
    },
  ];

  return (
    <section aria-labelledby="steps-heading">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="steps-heading" className="mt-0">
          Your three steps
        </h2>
        <Badge variant="outline">Guided overview</Badge>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3 motion-stagger">
        {steps.map((step) => (
          <li key={step.number} className="card card-interactive flex h-full flex-col">
            <div className="mb-3 flex items-center justify-between">
              <span className="icon-chip">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-widest text-[var(--muted-foreground)]">
                {step.number}
              </span>
            </div>
            <h3 className="mt-0 text-base font-semibold">{step.title}</h3>
            <p className="mb-4 flex-1 text-sm text-[var(--muted-foreground)]">{step.description}</p>
            <Link
              to={step.to}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              {step.action} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
