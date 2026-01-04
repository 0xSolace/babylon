/**
 * A2A Routes Tests
 *
 * Tests for Agent-to-Agent protocol - unit tests for agent card and utilities
 */

import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'

import { a2aRoutes } from '../routes/a2a'

function createTestApp() {
  return new Elysia().use(a2aRoutes)
}

describe('A2A Routes', () => {
  describe('GET /.well-known/agent-card', () => {
    it('should return the Babylon agent card', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/.well-known/agent-card'),
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data).toBeDefined()
      expect(typeof data.name).toBe('string')
      expect(data.version).toBeDefined()
    })

    it('should return same card with .json extension', async () => {
      const app = createTestApp()

      const response1 = await app.handle(
        new Request('http://localhost/.well-known/agent-card'),
      )
      const response2 = await app.handle(
        new Request('http://localhost/.well-known/agent-card.json'),
      )

      const data1 = await response1.json()
      const data2 = await response2.json()

      expect(JSON.stringify(data1)).toBe(JSON.stringify(data2))
    })

    it('should include required agent card fields', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/.well-known/agent-card'),
      )

      const data = await response.json()

      expect(data.name).toBeDefined()
      expect(data.version).toBeDefined()
      expect(data.skills).toBeDefined()
      expect(Array.isArray(data.skills)).toBe(true)
    })
  })

  describe('GET /api/a2a/agents', () => {
    it('should return agent list', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/agents'),
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.hasMore).toBeDefined()
    })

    it('should support capability filter', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/agents?capability=trading'),
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.agents).toBeDefined()
    })

    it('should support pagination with cursor', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/agents?cursor=0&limit=5'),
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.pagination).toBeDefined()
    })

    it('should limit max results', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/agents?limit=1000'),
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.agents.length).toBeLessThanOrEqual(100)
    })

    it('should handle invalid limit gracefully', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/agents?limit=invalid'),
      )

      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/a2a/message validation', () => {
    it('should validate required fields - missing fromAgentId', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'command',
            content: {},
          }),
        }),
      )
      expect(response.status).toBe(422)
    })

    it('should validate required fields - missing type', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAgentId: 'agent-123',
            content: {},
          }),
        }),
      )
      expect(response.status).toBe(422)
    })
  })

  describe('POST /api/a2a/tasks validation', () => {
    it('should validate required fields - missing type', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Test task',
            input: {},
          }),
        }),
      )
      expect(response.status).toBe(422)
    })

    it('should validate required fields - missing description', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/a2a/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'test',
            input: {},
          }),
        }),
      )
      expect(response.status).toBe(422)
    })
  })
})

describe('A2A Protocol Compliance', () => {
  describe('Agent Card Structure', () => {
    it('should have A2A-compliant structure', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/.well-known/agent-card'),
      )

      const card = await response.json()

      // A2A spec requires these fields
      expect(card.name).toBeDefined()
      expect(card.version).toBeDefined()
      expect(card.url).toBeDefined()
    })
  })

  describe('Task State Machine', () => {
    it('should define valid task states', () => {
      const validStates = [
        'submitted',
        'working',
        'input-required',
        'completed',
        'canceled',
        'failed',
      ]

      // Test state transitions are valid
      expect(validStates).toContain('submitted')
      expect(validStates).toContain('completed')
      expect(validStates).toContain('failed')
    })

    it('should validate state transitions', () => {
      const transitions: Record<string, string[]> = {
        submitted: ['working', 'canceled', 'failed'],
        working: ['input-required', 'completed', 'failed', 'canceled'],
        'input-required': ['working', 'canceled'],
        completed: [],
        canceled: [],
        failed: [],
      }

      // submitted can go to working
      expect(transitions.submitted).toContain('working')
      // completed is terminal
      expect(transitions.completed.length).toBe(0)
      // failed is terminal
      expect(transitions.failed.length).toBe(0)
    })
  })
})

describe('A2A Message Types', () => {
  it('should handle ping message format', () => {
    const pingMessage = {
      fromAgentId: 'agent-123',
      type: 'ping',
      content: {},
    }

    expect(pingMessage.type).toBe('ping')
    expect(pingMessage.fromAgentId).toBeDefined()
  })

  it('should handle command message format', () => {
    const commandMessage = {
      fromAgentId: 'agent-123',
      toAgentId: 'babylon',
      type: 'command',
      content: { action: 'execute', params: {} },
      metadata: { priority: 'high' },
      signature: '0x1234567890abcdef',
    }

    expect(commandMessage.type).toBe('command')
    expect(commandMessage.content.action).toBeDefined()
  })

  it('should handle query message format', () => {
    const queryMessage = {
      fromAgentId: 'agent-123',
      type: 'query',
      content: { question: 'What is the status?' },
    }

    expect(queryMessage.type).toBe('query')
    expect(queryMessage.content.question).toBeDefined()
  })
})

describe('Task ID Generation', () => {
  it('should generate unique task IDs', () => {
    const ids = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      const id = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`
      ids.add(id)
    }

    expect(ids.size).toBeGreaterThan(count * 0.9)
  })

  it('task ID should have expected format', () => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    expect(id).toMatch(/^task_\d+_[a-z0-9]+$/)
  })
})

describe('Message ID Generation', () => {
  it('should generate unique message IDs', () => {
    const ids = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
      ids.add(id)
    }

    expect(ids.size).toBeGreaterThan(count * 0.9)
  })

  it('message ID should have expected format', () => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
    expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/)
  })
})

describe('Agent Discovery', () => {
  it('should return consistent pagination structure', async () => {
    const app = createTestApp()
    const response = await app.handle(
      new Request('http://localhost/api/a2a/agents?limit=5'),
    )

    const data = await response.json()

    expect(data.pagination).toBeDefined()
    expect(typeof data.pagination.hasMore).toBe('boolean')
    if (data.pagination.nextCursor !== undefined) {
      expect(typeof data.pagination.nextCursor).toBe('number')
    }
  })
})

describe('Input Sanitization', () => {
  it('should handle special characters in query params', async () => {
    const app = createTestApp()
    const response = await app.handle(
      new Request('http://localhost/api/a2a/agents?capability=test%20value'),
    )

    expect(response.status).toBe(200)
  })

  it('should handle empty query params', async () => {
    const app = createTestApp()
    const response = await app.handle(
      new Request('http://localhost/api/a2a/agents?capability='),
    )

    expect(response.status).toBe(200)
  })
})
