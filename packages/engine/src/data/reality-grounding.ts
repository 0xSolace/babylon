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

=== CURRENT WORLD STATE (prices as of April 2026) ===
- BitcAIn (BTC): ~$74,000 (crashed from $120k highs — bear market vibes)
- EtherAIum (ETH): ~$1,500 (down from $4k — brutal correction)
- ZcAIsh (ZEC): ~$30 (privacy coins hammered)
- SolanAI (SOL): ~$105 (down from $200+ — memecoins deflating)
- Crypto market in full correction mode after tariff shocks and macro uncertainty
- OpenAGI: Released SMH-5.1 "Reasoning" and working on next-gen models
- AInthropic: Released ClAIude 4.5 Sonnet + Opus, ClAIude 5 in development
- MetAI: LLaMAI 4 running locally on consumer hardware
- NVAIDAI: Dominant in AI chips, stock volatile on supply/demand cycles
- Global trade tensions rising — tariff escalation shaking markets
- President: Trump Terminal (second term)
- Vice President: J.D. VAInce
- SEC Chair: Paul AItkins (crypto-friendly, pro-innovation stance)
- FTC Chair: AIndrew Ferguson
- Treasury: Scott BessAInt
- Secretary of State: Marco RubAI
- Attorney General: Pam BondAI

=== RUNNING SATIRICAL THEMES (use these naturally — rotate, don't fixate on one) ===
- AGI is "6 months away" according to every AI company (perpetually)
- "Safety teams" that get disbanded whenever they slow down product launches
- Product launches that are "revolutionary" and "game-changing" every single time
- Timelines that slip but the vision remains "on track"
- "Open" organizations that keep their best models closed
- Tariff wars that nobody understands but everyone has strong opinions about
- Politicians who hate AI until it helps their portfolio
- Science breakthroughs that get zero coverage because a CEO tweeted something dumb
- Every company pivoting to "AI-first" while their core product breaks
- Regulatory agencies that move at dial-up speed in a fiber-optic world
- VCs claiming every startup will "change the world" before the Series A
- Stock buybacks announced as "returning value to shareholders" during layoffs
- Prediction markets that somehow always confirm what you already believe

=== CONTENT GUIDELINES ===
- Always avoid specific model names of existing products (use parody names like SMH-9000 instead of GPT)
- Always avoid REAL product names — use funny parody names instead
- Avoid talking about anyone or any org outside of the characters and orgs referenced, and only use their parody names
- The simulation takes place primarily in the USAI (United States of AImerica) tech/finance/politics ecosystem

=== TOPIC DIVERSITY (CRITICAL) ===
- Do NOT let any single character or company dominate generated content
- Spread attention across ALL characters and organizations, not just tech founders
- Cover a MIX of themes: AI/tech, politics/regulation, science/space, culture, finance/markets
- If recent content has been tech-heavy, shift toward politics, science, or culture
- Crypto should be ONE topic among many, not the default topic`;
