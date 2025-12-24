# 📚 Babylon Documentation

Documentation for Babylon prediction market platform, built with [Vocs](https://vocs.dev) and served via [Elysia](https://elysiajs.com).

---

## 🚀 Quick Start

```bash
# Navigate to docs
cd apps/docs

# Install dependencies
bun install

# Start development server
bun run dev
```

Visit `http://localhost:5008` to view the documentation.

---

## 📖 Available Scripts

```bash
# Development
bun run dev              # Start Vocs dev server (port 5008)
bun run dev:worker       # Start Elysia worker (hot reload)

# Building
bun run build            # Build static files + worker
bun run build:static     # Build static files only
bun run build:worker     # Build worker only
bun run preview          # Preview Vocs build

# Production
bun run start            # Run production worker
bun run deploy           # Deploy to DWS

# Documentation Generation
bun run generate:all               # Generate all docs
bun run generate:api-docs          # API documentation
bun run generate:tsdoc             # TypeDoc from TSDoc
bun run generate:deployment-docs   # Contract addresses
bun run generate:contract-abis     # Contract ABIs

# Utilities
bun run lint             # Run Biome linter
bun run typecheck        # Type checking
```

---

## 📂 Project Structure

```
apps/docs/
├── pages/                 # Documentation pages (MDX)
│   ├── index.mdx         # Home page
│   ├── getting-started/  # Getting started section
│   ├── building-agents/  # Agent development
│   ├── deployment/       # Deployment guides (DWS, Vercel)
│   └── ...               # Other sections
├── public/               # Static assets
│   ├── favicon.svg
│   ├── logo_full.svg
│   └── openapi.json
├── scripts/              # Generation & deployment scripts
│   └── deploy-dws.ts     # DWS deployment script
├── dist/                 # Build output
│   ├── *.html            # Static pages
│   └── worker/           # Compiled Elysia worker
├── worker.ts             # Elysia static file server
├── wrangler.toml         # Workerd/DWS configuration
├── vocs.config.ts        # Vocs configuration
└── package.json
```

---

## 🌐 DWS Deployment

Deploy to DWS (Decentralized Web Services) for fully decentralized hosting:

```bash
# Build and deploy
bun run build
bun run deploy

# Or manually
bun run scripts/deploy-dws.ts
```

This will:
1. Upload static files to IPFS via Jeju Storage
2. Register with JNS (Jeju Name Service)
3. Deploy Elysia worker to Jeju Compute

See [DWS Deployment Guide](/deployment/dws) for details.

---

## 🔧 Worker Architecture

The Elysia worker provides:
- Static file serving from `dist/`
- SPA routing fallback
- Health checks (`/health`, `/ready`)
- Optimized caching headers
- Security headers

```typescript
// Health check
curl http://localhost:5008/health
// {"status":"healthy","service":"babylon-docs","timestamp":"..."}
```

---

## 🎨 Configuration

### Vocs (`vocs.config.ts`)
- Sidebar navigation
- Theme colors
- Social links
- Logo and branding

### Worker (`wrangler.toml`)
- Environment variables
- DWS deployment settings
- Cache rules

---

## 🛠️ Adding New Pages

1. Create a new `.mdx` file in `pages/`
2. Add to sidebar in `vocs.config.ts`
3. Commit and push

```bash
# Example: Add new page
echo "# New Page\n\nContent here..." > pages/new-page.mdx

# Update vocs.config.ts sidebar
```

---

**Built with [Vocs](https://vocs.dev) + [Elysia](https://elysiajs.com) for DWS deployment**
