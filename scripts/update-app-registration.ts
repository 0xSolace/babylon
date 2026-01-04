import staticFiles from '../apps/web/dist/static-files.json'

// Add the core files that were uploaded separately
const allFiles: Record<string, string> = {
  "index.html": "QmWE8VpYXocNyNAGmSnzif11xZ5wix2rsXV9FrRRaan9S4",
  "assets/favicon-C5w8suFO.svg": "QmVtnADT1vrg8CvfyMBCSSwKcJGgHGBPVgVyWHMeakKJkn",
  "assets/logos/logo.svg": "QmVtnADT1vrg8CvfyMBCSSwKcJGgHGBPVgVyWHMeakKJkn",
  ...staticFiles,
}

const body = {
  name: "babylon",
  jnsName: "babylon.jeju",
  frontendCid: null,
  staticFiles: allFiles,
  backendWorkerId: null,
  backendEndpoint: "https://babylon-api.testnet.jejunetwork.org",
  apiPaths: ["/api", "/http", "/trpc", "/webhooks", "/.well-known"],
  spa: true,
  enabled: true
}

const response = await fetch("https://dws.testnet.jejunetwork.org/apps/deployed", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-jeju-address": "0x0000000000000000000000000000000000000000"
  },
  body: JSON.stringify(body)
})

const text = await response.text()
console.log("Updated app registration with", Object.keys(allFiles).length, "static files")
console.log("Status:", response.status)
console.log("Response:", text.slice(0, 500))
