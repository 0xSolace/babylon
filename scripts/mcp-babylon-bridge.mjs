#!/usr/bin/env node
/**
 * Babylon MCP Bridge - converts stdio MCP to HTTP JSON-RPC
 * Used by Claude Code to talk to Babylon's HTTP-based MCP endpoint.
 */
import { createInterface } from 'readline';

const MCP_URL = process.env.BABYLON_MCP_URL || 'https://play.babylon.market/mcp';
const API_KEY = process.env.BABYLON_API_KEY;

if (!API_KEY) {
  process.stderr.write('BABYLON_API_KEY environment variable required\n');
  process.exit(1);
}

// Cache tools list
let toolsCache = null;

async function fetchTools() {
  if (toolsCache) return toolsCache;
  const res = await fetch(MCP_URL, {
    headers: { 'x-babylon-api-key': API_KEY },
  });
  const data = await res.json();
  toolsCache = data.tools || [];
  return toolsCache;
}

async function callTool(name, args) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-babylon-api-key': API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args || {} },
      id: Date.now(),
    }),
  });
  return await res.json();
}

function send(msg) {
  const json = JSON.stringify(msg);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

// Handle JSON-RPC over stdio
const rl = createInterface({ input: process.stdin });
let buffer = '';
let contentLength = -1;

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();

  while (true) {
    if (contentLength === -1) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }
      contentLength = parseInt(match[1], 10);
      buffer = buffer.substring(headerEnd + 4);
    }

    if (buffer.length < contentLength) break;

    const body = buffer.substring(0, contentLength);
    buffer = buffer.substring(contentLength);
    contentLength = -1;

    handleMessage(JSON.parse(body));
  }
});

async function handleMessage(msg) {
  const { method, id, params } = msg;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'babylon-mcp', version: '1.0.0' },
      },
    });
  } else if (method === 'notifications/initialized') {
    // No response needed for notifications
  } else if (method === 'tools/list') {
    const tools = await fetchTools();
    send({ jsonrpc: '2.0', id, result: { tools } });
  } else if (method === 'tools/call') {
    try {
      const result = await callTool(params.name, params.arguments);
      if (result.error) {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${result.error.message}` }],
            isError: true,
          },
        });
      } else {
        const text = typeof result.result === 'string'
          ? result.result
          : JSON.stringify(result.result, null, 2);
        send({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
        });
      }
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        },
      });
    }
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
  } else {
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

process.stderr.write('Babylon MCP bridge started\n');
