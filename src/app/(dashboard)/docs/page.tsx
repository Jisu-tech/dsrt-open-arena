export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <h1 className="text-xl font-semibold text-foreground tracking-tight">Documentation</h1>
      <p className="text-sm text-secondary leading-relaxed">
        DSRT AI Open Arena — Work Mode runs the conditional amplification pipeline on your
        BYOK keys. War Mode compares raw vs amplified on the same provider and model with
        honest metrics. API keys are encrypted server-side (AES-256-GCM) and never returned
        to the browser after save.
      </p>
      <ul className="text-sm text-foreground list-disc pl-5 space-y-1">
        <li>Work Mode — continuous amplified workspace</li>
        <li>War Mode — raw vs amplified fair-play comparison</li>
        <li>API Keys — Top bar → API Keys (workspace BYOK vault)</li>
      </ul>
    </div>
  );
}