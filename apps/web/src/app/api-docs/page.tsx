import Script from 'next/script';

export default function ApiDocsPage() {
  return (
    <div className="min-h-dvh bg-background md:min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-bold text-4xl">Babylon API Documentation</h1>
          <p className="mb-4 text-lg text-muted-foreground">
            Complete interactive API reference for the Babylon social conspiracy
            game
          </p>
          <div className="flex gap-4 text-muted-foreground text-sm">
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              View JSON Spec
            </a>
            <span>•</span>
            <span>Automatically generated from route documentation</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
          <link rel="stylesheet" href="/api-docs/assets/swagger-ui.css" />
          <div id="swagger-ui" className="min-h-[70vh]" />
          <Script
            src="/api-docs/assets/swagger-ui-bundle.js"
            strategy="afterInteractive"
          />
          <Script
            src="/api-docs/swagger-ui-bootstrap.js"
            strategy="afterInteractive"
          />
        </div>
      </div>
    </div>
  );
}
