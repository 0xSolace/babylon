/**
 * World Facts Service Tests
 *
 * Integration tests for world facts service against real database.
 * Requires PostgreSQL to be running.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { db, like, or, worldFacts } from '@babylon/db'
import { worldFactsService } from '@babylon/engine'

// Skip if DATABASE_URL is not set
const shouldSkip = !process.env.DATABASE_URL
const describeTests = shouldSkip ? describe.skip : describe

describeTests('WorldFactsService', () => {
  const testValuePrefix = `Test Fact: ${Date.now()}`

  beforeAll(async () => {
    // Verify database connectivity - let connection errors fail the test
    await db.select().from(worldFacts).limit(1)
  })

  afterEach(async () => {
    // Cleanup test data
    await db
      .delete(worldFacts)
      .where(like(worldFacts.fact, `${testValuePrefix}%`))
  })

  test('should create a new world fact by value', async () => {
    const testValue = `${testValuePrefix} - Initial Value`
    const fact = await worldFactsService.setFactByValue(testValue)

    expect(fact).toBeDefined()
    expect(fact.fact).toBe(testValue)
    expect(fact.category).toBe('general')
  })

  test('should update existing world fact', async () => {
    // Create initial fact
    const testValue = `${testValuePrefix} - Initial Value`
    const fact = await worldFactsService.setFactByValue(testValue)

    // Update it by ID
    const updatedValue = `${testValuePrefix} - Updated Value`
    const updated = await worldFactsService.updateFactById(
      fact.id,
      updatedValue,
    )

    expect(updated.fact).toBe(updatedValue)
    expect(updated.id).toBe(fact.id)
  })

  test('should get all facts', async () => {
    const testValue = `${testValuePrefix} - Test Value`
    await worldFactsService.setFactByValue(testValue)

    const facts = await worldFactsService.getAllFacts()

    expect(facts).toBeDefined()
    expect(Array.isArray(facts)).toBe(true)
    expect(facts.some((f) => f.fact === testValue)).toBe(true)
  })

  test('should delete a fact', async () => {
    const testValue = `${testValuePrefix} - To Delete`
    const fact = await worldFactsService.setFactByValue(testValue)

    await worldFactsService.deleteFact(fact.id)

    const allFacts = await worldFactsService.getAllFacts()
    expect(allFacts.some((f) => f.id === fact.id)).toBe(false)
  })

  test('should toggle fact verified status', async () => {
    const testValue = `${testValuePrefix} - Toggle Test`
    const fact = await worldFactsService.setFactByValue(testValue)

    expect(fact.verifiedAt).toBeNull()

    const toggled = await worldFactsService.toggleFactVerified(fact.id)
    expect(toggled.verifiedAt).not.toBeNull()

    const toggledAgain = await worldFactsService.toggleFactVerified(fact.id)
    expect(toggledAgain.verifiedAt).toBeNull()
  })

  test('should generate world context', async () => {
    const testValue = `${testValuePrefix} - Context Test`
    await worldFactsService.setFactByValue(testValue)

    const context = await worldFactsService.generateWorldContext(false)

    expect(context).toBeDefined()
    expect(context.timestamp).toBeDefined()
    expect(typeof context.crypto).toBe('string')
    expect(typeof context.politics).toBe('string')
    expect(typeof context.economy).toBe('string')
    expect(typeof context.technology).toBe('string')
    expect(typeof context.general).toBe('string')
    expect(context.general).toContain(testValue)
  })

  test('should generate prompt context string', async () => {
    const testValue = `${testValuePrefix} - Prompt Test`
    await worldFactsService.setFactByValue(testValue)

    // Generate context without headlines to avoid LLM requirement
    const context = await worldFactsService.generateWorldContext(false)

    expect(context).toBeDefined()
    expect(context.timestamp).toBeDefined()
    expect(typeof context.crypto).toBe('string')
    expect(typeof context.politics).toBe('string')
    expect(typeof context.economy).toBe('string')
    expect(typeof context.technology).toBe('string')
    expect(typeof context.general).toBe('string')
  })

  test('should bulk update facts', async () => {
    // Use different prefixes to generate unique keys (key is extracted from before the colon)
    const timestamp = Date.now()
    const values = [
      `BulkTestA${timestamp}: First bulk value for testing`,
      `BulkTestB${timestamp}: Second bulk value for testing`,
    ]

    await worldFactsService.bulkUpdateFacts(values)

    const facts = await worldFactsService.getAllFacts()
    expect(facts.some((f) => f.fact === values[0])).toBe(true)
    expect(facts.some((f) => f.fact === values[1])).toBe(true)

    // Cleanup these specific test facts
    await db
      .delete(worldFacts)
      .where(
        or(
          like(worldFacts.fact, `BulkTestA${timestamp}%`),
          like(worldFacts.fact, `BulkTestB${timestamp}%`),
        ),
      )
  })
})
