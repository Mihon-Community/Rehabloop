export function SafetyBanner() {
  return (
    <div className="safety-banner" role="note">
      <strong>Prototype, not a medical device.</strong> RehabLoop measures estimated movement from
      one camera view. It does not diagnose, treat or advise. Angles are projected estimates, not
      clinical measurements. A clinician owns the exercise protocol and interprets the results.
    </div>
  );
}
