import { ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Visible on every screen — copy is deliberately unchanged. */
export function SafetyBanner() {
  return (
    <Alert variant="info" icon={<ShieldCheck className="size-5" />} className="safety-banner">
      <AlertTitle className="text-sm">Prototype, not a medical device.</AlertTitle>
      <AlertDescription>
        RehabLoop measures estimated movement from one camera view. It does not diagnose, treat or
        advise. Angles are projected estimates, not clinical measurements. A clinician owns the
        exercise protocol and interprets the results. Raw video is not stored by default.
      </AlertDescription>
    </Alert>
  );
}
