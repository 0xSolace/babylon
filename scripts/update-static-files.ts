/**
 * Update Babylon app with all static files
 */

const DWS_URL = 'https://dws.testnet.jejunetwork.org'

const staticFiles: Record<string, string> = {
  // Core files (rebuilt with relative API paths)
  "index.html": "QmY1sS2e8vhtcQv3rR67tQWsooRRmxdyW6sDkSxZPx2Wt6",
  "assets/index-PvpbkUKf.js": "QmP49SfcuBz9Wze8ogRb4sLbavfZhDNh18w9Mjs6ecdS1t",
  "assets/index-CcXVtVH8.css": "QmZfuspQDDuawoYY6FetvNgZivCzFbqFFUXSuS88H7vSAe",
  "assets/favicon-C5w8suFO.svg": "QmVtnADT1vrg8CvfyMBCSSwKcJGgHGBPVgVyWHMeakKJkn",
  
  // Logos
  "assets/logos/logo.svg": "QmVtnADT1vrg8CvfyMBCSSwKcJGgHGBPVgVyWHMeakKJkn",
  "assets/logos/logo_full.svg": "QmX6iYRo19pV41xZr7JdMdKxh6ZV39GUZms3ydt9KYZnyd",
  
  // KaTeX fonts - WOFF
  "assets/KaTeX_AMS-Regular-DMm9YOAa.woff": "QmRePbZYbnNJvDdieKJwiZe2PdH2JDRBNF6aRbFnQ7bcQe",
  "assets/KaTeX_Caligraphic-Bold-BEiXGLvX.woff": "QmPmW2JN77NmJwQuqC9JvqVuFXQydPnPji1J6Er6bHxYtG",
  "assets/KaTeX_Caligraphic-Regular-CTRA-rTL.woff": "QmPCJCrmSfr84hSvPmZyJ3vYRkDJ3hWKj49ALrgV5CMP9k",
  "assets/KaTeX_Fraktur-Bold-BsDP51OF.woff": "Qmby814QwWghMz6vP4L1b3t9UeUpEMhYmG35ua4Ncur1hY",
  "assets/KaTeX_Fraktur-Regular-Dxdc4cR9.woff": "Qmam8V8bgDGebVWM5jYVUehaqrtHdeWi5NcDEkHPdFGcaK",
  "assets/KaTeX_Main-Bold-Jm3AIy58.woff": "Qmakv8k14vPWJNhtenfqjzAymjcbArMZfS3AJeS7zWjWNT",
  "assets/KaTeX_Main-BoldItalic-SpSLRI95.woff": "QmPjtoMoNMbrYeBYgBWWe1iwhCqvYZLXfyFZQA6PZ7sW8e",
  "assets/KaTeX_Main-Italic-BMLOBm91.woff": "QmZQ2qR1UjHxNwquanhUiWaEkUXrLTxBvYx3cPapreA7u9",
  "assets/KaTeX_Main-Regular-Dr94JaBh.woff": "QmVV1q8rnYdEVytTkHB536s4SPxUCJJs1uocMvgP3cPHdq",
  "assets/KaTeX_Math-BoldItalic-iY-2wyZ7.woff": "QmXAtUSnSgiEcTzWPTgZz5aviEiPAc2x3qnnmTwjkM7SAb",
  "assets/KaTeX_Math-Italic-DA0__PXp.woff": "QmYFWmrZ1DKTYJ2U3JysvieaX5ESMxHj2GM1Zd7gJNmCRC",
  "assets/KaTeX_SansSerif-Bold-DbIhKOiC.woff": "QmNNXZowwVcpRUx27BCeu76KeQ5mWtVjem4XoMKiMckY3D",
  "assets/KaTeX_SansSerif-Italic-DN2j7dab.woff": "QmT4kGKUrP6TuLTdXfonjVjatnk7ghihBWirihYAL7XkxP",
  "assets/KaTeX_SansSerif-Regular-CS6fqUqJ.woff": "QmYSpiqBQMw8pYCpb42aUHwTdQjTyNVbZFHygMPY7ihf4m",
  "assets/KaTeX_Script-Regular-D5yQViql.woff": "QmTo7dcUqcs62hpDTD7r8rQi37uCmfHKgGq4m4wrcp6ncH",
  "assets/KaTeX_Size1-Regular-C195tn64.woff": "QmWnShqyb2TMrxgBUte9WH6eiWH2JtdPWu4WDK1mNXNVcw",
  "assets/KaTeX_Size2-Regular-oD1tc_U0.woff": "QmZymZqZPAycMWgjCqAe2NVju7GNPfp6ewtVi7sF1EgyZy",
  "assets/KaTeX_Size3-Regular-CTq5MqoE.woff": "QmZxETQWjiNWa2pFTBqXWHjkiAm3umAa3geM8gBc1XKUZT",
  "assets/KaTeX_Size4-Regular-BF-4gkZK.woff": "QmagazrGrCecez7LUy3Mn9KQKz9E4zTMFRRyuSTPC2DU3H",
  "assets/KaTeX_Typewriter-Regular-C0xS9mPB.woff": "QmX5wQMWoXkxyV4qiWwBGF8NBGkJLqXVUuWgQPKhxzDiAq",

  // KaTeX fonts - WOFF2
  "assets/KaTeX_AMS-Regular-BQhdFMY1.woff2": "Qmaan16rTAcmYbVPjaGMuGi8eVkAfkjSB7A2zECarQdJkW",
  "assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2": "QmaR3HPT2wM1vqdKUYF5ksopWqaVRQ38uU9PdcSCx8HWTG",
  "assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2": "QmR7kaEPL6Xs4F3u4V8NbFKfSCE9uyCUN2JXSEK1Dq2E4t",
  "assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2": "QmWpXkVnn9NV2k6uukCJk9YW7RbknbGY1dXsiHznVzAEeE",
  "assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2": "QmNn3bSvKw8Cp4ggGEiMHJhNhHY6amoH7h8sx4b3WbRpp1",
  "assets/KaTeX_Main-Bold-Cx986IdX.woff2": "QmcMw4qoekqbNAcD8d4bZCWNifmhmzFdpXgGq1H7FTQnE1",
  "assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2": "Qmc35Dc3XyNxkwXNdimWA4zDRFkQMrzu9NASemATuVxwrS",
  "assets/KaTeX_Main-Italic-NWA7e6Wa.woff2": "QmQEsMNehDaycB6gwkS9dMz6gBeJ1wN8heDAViJmuK5eE1",
  "assets/KaTeX_Main-Regular-B22Nviop.woff2": "QmTSXETGJt2pQiYQFdDeBvt7mDgw6rKkUVeXz6f5kmeA7c",
  "assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2": "QmW6n8TfYQGwzbcDZPDMpopEZaw3szVcHV3p9ZdUWUwqUN",
  "assets/KaTeX_Math-Italic-t53AETM-.woff2": "QmVTJ5ptjAnshpyN63iHiKJYRCXuh4PEmRacZDHGJmaDER",
  "assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2": "QmccsZqbHbdiwyTPHaceZNqzP13i9h7gkK5MAYnerAJQEG",
  "assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2": "QmXu3cPcyqPeZW1XSiuqHFhopREFxbFVuNdNpm4qcHj8DU",
  "assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2": "QmVRuTUCExPC6DiD8mAU9GGYBbMBz2FDtpd3WwyE158gvA",
  "assets/KaTeX_Script-Regular-D3wIWfF6.woff2": "QmWSxyiVKwjKFumU7CqFso7HDumT8qE5BxFEW8znfw7fYe",
  "assets/KaTeX_Size1-Regular-mCD8mA8B.woff2": "QmR4kP2xtxnGyqbSL1nT4qYPTf6H4wmBrRxkHRBiBrboXC",
  "assets/KaTeX_Size2-Regular-Dy4dx90m.woff2": "QmcBw5mqXjZzbggSHeXkA5ceEToe8qhCgcHQCq8QkNz18k",
  "assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2": "Qmf78EKpBmmQx1ue8Pr8pEmHxUurYm2aCgRc3H13JtLqww",
  "assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2": "QmXgF8BLwB12pT1bXvXR4rddoud6TYbaWymiZtGWzhxTaS",
}

async function main() {
  const body = {
    name: "babylon",
    jnsName: "babylon.jeju",
    frontendCid: null,
    staticFiles,
    backendWorkerId: null,
    // Minimal working backend - full backend (QmSGJ4qS...) isn't starting - need to investigate
    backendEndpoint: "https://dws.testnet.jejunetwork.org/workers/QmVkd4ZW5FHL1L2sADqAi9btr4G3QxJCh6ogKaLyjMBndD/http",
    apiPaths: ["/api", "/http", "/trpc", "/webhooks", "/.well-known", "/health"],
    spa: true,
    enabled: true,
  }

  console.log(`Updating babylon with ${Object.keys(staticFiles).length} static files...`)

  const response = await fetch(`${DWS_URL}/apps/deployed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jeju-address": "0x0000000000000000000000000000000000000000",
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  console.log("Status:", response.status)
  console.log("Response:", text.slice(0, 500))
}

main().catch(console.error)
