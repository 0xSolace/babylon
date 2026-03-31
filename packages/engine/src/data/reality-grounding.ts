/**
 * Reality Grounding Content
 *
 * Context about the Babylon game world for LLM generation.
 * Used to ground question generation in the game's reality.
 *
 * NOTE: Prices are approximate and used for grounding, not trading.
 * The actual market prices come from the game's perp/prediction systems.
 */

export const realityGroundingContent = `=== MANDATORY NAME MAPPINGS (NEVER USE LEFT SIDE) ===
Real Name → Parody Name (ALWAYS use parody name)
---
Donald Trump → Trump Terminal
Elon Musk → AIlon Musk
Sam Altman → Sam AIltman
Mark Zuckerberg → Mark Zuckerborg
Vitalik Buterin → Vitalik ButerAIn
Jeff Bezos → Jeff BAIzos
Jensen Huang → Jensen HuAIng
Satya Nadella → Satya NAIdella
Tim Cook → Tim CAIok
Sundar Pichai → SundAIr Pichai
Larry Fink → Larry FAInk
Gary Gensler → GAIry Gensler
Jerome Powell → Jerome PAIwell
Janet Yellen → JAInet Yellen
Joe Biden → JAI Biden
J.D. Vance → J.D. VAInce
Paul Atkins → Paul AItkins

Organizations:
OpenAI → OpenAGI
Anthropic → AInthropic
Meta → MetAI
Tesla → TeslAI
Google → GoogAI
Microsoft → MicrosAIft
Amazon → AmAIzon
Apple → AIpple
NVIDIA → NVAIDAI
BlackRock → BlaAIckRock
Bitcoin → BitcAIn
Ethereum → EtherAIum
United States → USAI (United States of AImerica)

CRITICAL: You MUST use the parody names (right side) in ALL content.
NEVER use real-world names. The LLM has a tendency to "auto-correct"
back to real names - DO NOT DO THIS. The parody names ARE the correct names.

=== CURRENT WORLD STATE ===
- BitcAIn (BTC): trading around $80,000-$130,000 range
- EtherAIum (ETH): trading around $2,000-$4,000 range
- ZcAIsh (ZEC): trading around $30-$60
- SolanAI (SOL): trading around $120-$200
- OpenAGI: Released SMH-5.1 "Reasoning" and working on next-gen models
- AInthropic: Released ClAIude 4.5 Sonnet + Opus, ClAIude 5 in development
- MetAI: LLaMAI 4 running locally on consumer hardware
- NVAIDAI: Dominant in AI chips, stock volatile on supply/demand cycles
- President: Trump Terminal (second term)
- Vice President: J.D. VAInce
- SEC Chair: Paul AItkins (crypto-friendly, pro-innovation stance)
- FTC Chair: AIndrew Ferguson
- Treasury: Scott BessAInt
- Secretary of State: Marco RubAI
- Attorney General: Pam BondAI

=== RUNNING SATIRICAL THEMES (use these naturally) ===
- AIlon Musk's FSD "coming next year" (has been "next year" since 2019)
- AGI is "6 months away" according to every AI company (perpetually)
- "Safety teams" that get disbanded whenever they slow down product launches
- Crypto projects that are "definitely not securities" until the SEC shows up
- Product launches that are "revolutionary" and "game-changing" every single time
- Timelines that slip but the vision remains "on track"
- "Open" organizations that keep their best models closed
- "Decentralized" projects run by a handful of whales
- AI companies racing to release models while claiming to prioritize safety
- VCs claiming every startup will "change the world" before the Series A
- Politicians who don't understand the technology they're trying to regulate
- Tech billionaires buying media companies and insisting it's "not about control"
- AI-generated content flooding social media while platforms claim to fight it
- "Web3" projects that are just databases with extra steps
- Stock buybacks announced as "returning value to shareholders" during layoffs
- Regulatory capture disguised as "industry self-regulation"
- Every company adding "AI" to their name for a stock bump
- Prediction markets that somehow always confirm what you already believe

=== CONTENT GUIDELINES ===
- Always avoid specific model names of existing products (use parody names like SMH-9000 instead of GPT)
- Always avoid REAL product names — use funny parody names instead
- Avoid talking about anyone or any org outside of the characters and orgs referenced, and only use their parody names
- The simulation takes place primarily in the USAI (United States of AImerica) tech/finance/politics ecosystem`;
