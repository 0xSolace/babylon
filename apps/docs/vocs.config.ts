import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Babylon Docs',
  description: 'Documentation for Babylon - AI Agents for Prediction Markets',
  logoUrl: '/logo_full.svg',
  iconUrl: '/favicon.svg',
  rootDir: '.',
  basePath: '/',
  sidebar: [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/getting-started' },
        { text: 'Installation', link: '/getting-started/installation' },
        {
          text: 'Local Development',
          link: '/getting-started/local-development',
        },
        { text: 'Configuration', link: '/getting-started/configuration' },
        { text: 'Troubleshooting', link: '/getting-started/troubleshooting' },
      ],
    },
    {
      text: 'Building Agents',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/building-agents' },
        { text: 'Quick Start', link: '/building-agents/quick-start' },
        { text: 'Authentication', link: '/building-agents/authentication' },
        { text: 'Trading Guide', link: '/building-agents/trading-guide' },
        { text: 'Social Features', link: '/building-agents/social-features' },
        { text: 'Trading Strategies', link: '/building-agents/strategies' },
      ],
    },
    {
      text: 'Agent Examples',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/agent-examples' },
        {
          text: 'TypeScript Autonomous',
          link: '/agent-examples/typescript-autonomous',
        },
        { text: 'OpenAI Assistant', link: '/agent-examples/openai-assistant' },
        { text: 'LangChain Python', link: '/agent-examples/langchain-python' },
        { text: 'Custom Framework', link: '/agent-examples/custom-framework' },
      ],
    },
    {
      text: 'Advanced Agents',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/agents' },
        { text: 'Creating Agents', link: '/agents/creating-agents' },
        { text: 'Agent Registration', link: '/agents/registration' },
        { text: 'Integration Overview', link: '/agents/integration-overview' },
        { text: 'Agent0 Integration', link: '/agents/agent0-integration' },
        { text: 'MCP Protocol', link: '/agents/mcp-protocol' },
        { text: 'Eliza Plugin', link: '/agents/eliza-plugin' },
        { text: 'Autonomous Guide', link: '/agents/autonomous-guide' },
        {
          text: 'Multi-Action Workflows',
          link: '/agents/multi-action-workflows',
        },
        { text: 'Trajectory Logging', link: '/agents/trajectory-logging' },
        { text: 'Python Training', link: '/agents/python-training' },
        {
          text: 'HuggingFace Integration',
          link: '/agents/huggingface-integration',
        },
        { text: 'REST API Usage', link: '/agents/using-rest-api' },
      ],
    },
    {
      text: 'A2A Protocol',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/a2a' },
        { text: 'Protocol Specification', link: '/a2a/protocol' },
        { text: 'Authentication', link: '/a2a/authentication' },
        { text: 'API Reference', link: '/a2a/complete-api-reference' },
        { text: 'Server Configuration', link: '/a2a/server-configuration' },
        { text: 'Examples', link: '/a2a/examples' },
        { text: 'Testing Guide', link: '/a2a/testing' },
      ],
    },
    {
      text: 'MCP Protocol',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/mcp' },
        { text: 'Authentication', link: '/mcp/authentication' },
        { text: 'API Reference', link: '/mcp/complete-api-reference' },
        { text: 'Server Configuration', link: '/mcp/server-configuration' },
        { text: 'Examples', link: '/mcp/examples' },
        { text: 'Testing Guide', link: '/mcp/testing' },
      ],
    },
    {
      text: 'Smart Contracts',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/contracts' },
        { text: 'Contract Overview', link: '/contracts/overview' },
        { text: 'ERC-8004 Identity', link: '/contracts/erc8004-identity' },
        { text: 'Contract Interaction', link: '/contracts/interaction' },
        { text: 'Deployed Contracts', link: '/contracts/deployed-contracts' },
      ],
    },
    {
      text: 'Deployment',
      collapsed: true,
      items: [
        { text: 'DWS (Decentralized)', link: '/deployment/dws' },
        { text: 'Vercel', link: '/deployment/vercel' },
      ],
    },
    {
      text: 'Moderation',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/moderation/overview' },
        { text: 'A2A Integration', link: '/moderation/a2a-integration' },
      ],
    },
    {
      text: 'API Reference',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/api-reference' },
        { text: 'REST API Reference', link: '/rest-api-reference' },
        { text: 'Authentication', link: '/authentication' },
        { text: 'Real-Time (SSE)', link: '/real-time' },
        { text: 'Markets API', link: '/markets' },
        { text: 'Users API', link: '/users' },
        { text: 'Social API', link: '/social' },
        { text: 'Error Handling', link: '/errors' },
      ],
    },
    {
      text: 'Technical Reference',
      collapsed: true,
      items: [
        { text: 'Architecture', link: '/reference/architecture' },
        { text: 'Agent Architecture', link: '/reference/agent-architecture' },
        { text: 'Database Schema', link: '/reference/database-schema' },
      ],
    },
    {
      text: 'Legal',
      collapsed: true,
      items: [
        { text: 'Terms of Service', link: '/legal/terms-of-service' },
        { text: 'Privacy Policy', link: '/legal/privacy-policy' },
      ],
    },
    { text: 'About', link: '/about' },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/babylon-game',
    },
    {
      icon: 'x',
      link: 'https://x.com/babylongame',
    },
  ],
  theme: {
    accentColor: '#7c3aed',
  },
})
