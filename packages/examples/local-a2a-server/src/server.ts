/**
 * Local A2A Server - Standalone implementation for agent development
 *
 * This server provides a complete A2A protocol implementation that works
 * with local anvil and doesn't require the full Babylon infrastructure.
 */

import { Database } from 'bun:sqlite';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { createPublicClient, http } from 'viem';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { agentCard } from './agent-card';
import { setupDatabase } from './database/setup';
import { A2AHandler } from './handlers/a2a-handler';
import { MarketHandler } from './handlers/market-handler';
import { PortfolioHandler } from './handlers/portfolio-handler';
import { SocialHandler } from './handlers/social-handler';
import { AgentRegistry } from './services/agent-registry';
import { LocalBlockchain } from './services/local-blockchain';

// JSON-RPC 2.0 Request Schema
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  id: z.union([z.string(), z.number()]).optional(),
});

// Agent Headers Schema (optional fields)
const AgentHeadersSchema = z.object({
  agentId: z.string().optional(),
  agentAddress: z.string().optional(),
  tokenId: z.string().optional(),
});

dotenv.config();

const PORT = process.env.A2A_PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const CHAIN_ID = process.env.CHAIN_ID || '31337';

// Initialize database using Bun's native SQLite
const db = new Database('./data/a2a.db', { create: true });
setupDatabase(db);

// Initialize services
const publicClient = createPublicClient({
  transport: http(RPC_URL),
});
const blockchain = new LocalBlockchain(publicClient);
const agentRegistry = new AgentRegistry(db, blockchain);

// Initialize handlers
const marketHandler = new MarketHandler(db);
const socialHandler = new SocialHandler(db);
const portfolioHandler = new PortfolioHandler(db, blockchain);
const a2aHandler = new A2AHandler(
  agentRegistry,
  marketHandler,
  socialHandler,
  portfolioHandler
);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Agent card endpoint
app.get('/.well-known/agent-card', (_req: Request, res: Response) => {
  res.json(agentCard);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    agents: agentRegistry.getAgentCount(),
  });
});

// JSON-RPC 2.0 endpoint
app.post('/api/a2a', async (req: Request, res: Response) => {
  // Validate request body
  const bodyResult = JsonRpcRequestSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: bodyResult.error.format(),
      },
      id: req.body?.id ?? null,
    });
  }

  const { method, params, id } = bodyResult.data;

  // Validate and extract agent headers
  const headersResult = AgentHeadersSchema.safeParse({
    agentId: req.headers['x-agent-id'],
    agentAddress: req.headers['x-agent-address'],
    tokenId: req.headers['x-agent-token-id'],
  });

  const headers = headersResult.success ? headersResult.data : {};

  // Handle method
  const result = await a2aHandler.handleMethod(method, params, {
    agentId: headers.agentId,
    address: headers.agentAddress,
    tokenId: parseInt(headers.tokenId ?? '0'),
  });

  res.json({
    jsonrpc: '2.0',
    result,
    id,
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket message schema (includes agent context)
const WsMessageSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  id: z.union([z.string(), z.number()]).optional(),
  agentId: z.string().optional(),
  address: z.string().optional(),
  tokenId: z.number().optional(),
});

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', async (data) => {
    const parsed = JSON.parse(data.toString()) as unknown;
    const result = WsMessageSchema.safeParse(parsed);

    if (!result.success) {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: result.error.format(),
          },
          id: null,
        })
      );
      return;
    }

    const message = result.data;

    // Handle WebSocket A2A methods
    const response = await a2aHandler.handleMethod(
      message.method,
      message.params,
      {
        agentId: message.agentId,
        address: message.address,
        tokenId: message.tokenId,
      }
    );

    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        result: response,
        id: message.id,
      })
    );
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 Local A2A Server Running
============================
HTTP:      http://localhost:${PORT}
WebSocket: ws://localhost:${PORT}/ws
Health:    http://localhost:${PORT}/health
Agent Card: http://localhost:${PORT}/.well-known/agent-card
Chain ID:  ${CHAIN_ID}
RPC URL:   ${RPC_URL}
============================
  `);
});
