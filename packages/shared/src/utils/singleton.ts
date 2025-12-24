/**
 * Singleton Utility
 *
 * Provides a reusable singleton pattern for server instances.
 * Prevents double initialization and handles cleanup.
 */

import { mapGet, toNull } from './nullable'

/**
 * Type for the global object used for singleton storage.
 * Uses index signature for dynamic property access.
 */
interface GlobalSingletonStorage {
  [key: string]: unknown
}

/**
 * Type assertion for the global object.
 * Node.js global object supports dynamic property assignment.
 */
declare const global: GlobalSingletonStorage

/**
 * Helper to get typed global object for singleton storage.
 */
function getGlobalStorage(): GlobalSingletonStorage {
  return global
}

/**
 * Singleton accessor interface
 */
export interface SingletonAccessor<T> {
  getInstance: () => T | null
  setInstance: (instance: T) => void
  clearInstance: () => void
}

/**
 * Port-aware singleton accessor interface
 */
export interface PortSingletonAccessor<T> {
  getInstance: (port?: number) => T | null
  setInstance: (instance: T, port?: number) => void
  clearInstance: () => void
}

/**
 * Creates a singleton getter/setter pattern for a type T
 */
export function createSingleton<T>(): SingletonAccessor<T> {
  let instance: T | null = null

  return {
    getInstance: () => instance,
    setInstance: (inst: T) => {
      instance = inst
    },
    clearInstance: () => {
      instance = null
    },
  }
}

/**
 * Creates a global singleton that survives hot module reloads
 */
export function createGlobalSingleton<T>(
  globalKey: string,
): SingletonAccessor<T> {
  const globalObj = getGlobalStorage()

  return {
    getInstance: () => {
      const value = globalObj[globalKey]
      return toNull(value as T | undefined)
    },
    setInstance: (instance: T) => {
      globalObj[globalKey] = instance
    },
    clearInstance: () => {
      globalObj[globalKey] = undefined
    },
  }
}

/**
 * Creates a port-aware singleton for server instances
 */
export function createPortSingleton<T>(
  globalKeyPrefix: string,
): PortSingletonAccessor<T> {
  const instances = new Map<number, T>()
  const globalObj = getGlobalStorage()

  return {
    getInstance: (port?: number) => {
      if (port !== undefined) {
        return mapGet(instances, port)
      }
      // Return first instance if no port specified
      const firstResult = instances.values().next()
      return firstResult.done ? null : firstResult.value
    },
    setInstance: (instance: T, port?: number) => {
      const key = port ?? 0
      instances.set(key, instance)
      globalObj[`${globalKeyPrefix}_${key}`] = instance
    },
    clearInstance: () => {
      for (const port of instances.keys()) {
        delete globalObj[`${globalKeyPrefix}_${port}`]
      }
      instances.clear()
    },
  }
}
