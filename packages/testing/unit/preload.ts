/**
 * Preload file for pure unit tests
 *
 * This file is only loaded when running unit tests that DON'T need database.
 * Most tests use the integration preload which initializes real SQLit.
 *
 * Usage:
 *   bun test --preload ./packages/testing/unit/preload.ts packages/testing/unit/some-pure-test.ts
 */

import { mock } from 'bun:test'

// Set test environment
;(process.env as Record<string, string>).NODE_ENV = 'test'
process.env.BUN_ENV = 'test'

// Mock Redis/ioredis - prevents connection attempts in pure unit tests
mock.module('ioredis', () => {
  return {
    default: class MockRedis {
      on() {
        return this
      }
      once() {
        return this
      }
      removeListener() {
        return this
      }
      removeAllListeners() {
        return this
      }
      connect() {
        return Promise.resolve()
      }
      disconnect() {
        return Promise.resolve()
      }
      quit() {
        return Promise.resolve('OK')
      }
      get() {
        return Promise.resolve(null)
      }
      set() {
        return Promise.resolve('OK')
      }
      setex() {
        return Promise.resolve('OK')
      }
      del() {
        return Promise.resolve(1)
      }
      exists() {
        return Promise.resolve(0)
      }
      expire() {
        return Promise.resolve(1)
      }
      ttl() {
        return Promise.resolve(-1)
      }
      keys() {
        return Promise.resolve([])
      }
      flushall() {
        return Promise.resolve('OK')
      }
      hget() {
        return Promise.resolve(null)
      }
      hset() {
        return Promise.resolve(1)
      }
      hdel() {
        return Promise.resolve(1)
      }
      hgetall() {
        return Promise.resolve({})
      }
      sadd() {
        return Promise.resolve(1)
      }
      srem() {
        return Promise.resolve(1)
      }
      smembers() {
        return Promise.resolve([])
      }
      sismember() {
        return Promise.resolve(0)
      }
      zadd() {
        return Promise.resolve(1)
      }
      zrem() {
        return Promise.resolve(1)
      }
      zrange() {
        return Promise.resolve([])
      }
      zrevrange() {
        return Promise.resolve([])
      }
      pipeline() {
        const pipeline = {
          commands: [] as unknown[],
          get(key: string) {
            this.commands.push(['get', key])
            return this
          },
          set(key: string, value: unknown) {
            this.commands.push(['set', key, value])
            return this
          },
          del(key: string) {
            this.commands.push(['del', key])
            return this
          },
          exec() {
            return Promise.resolve(this.commands.map(() => [null, 'OK']))
          },
        }
        return pipeline
      }
    },
  }
})

console.log(
  '[Unit Test Preload] Pure unit test environment (Redis mocked, no DB)',
)
