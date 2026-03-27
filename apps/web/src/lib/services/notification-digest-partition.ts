import { getDeploymentEnvironment } from '@babylon/api';

/**
 * Whether this environment should process a given user during digest cron.
 * When fan-out is active, each environment processes a deterministic subset from user ID hash.
 */
export function shouldProcessUser(userId: string, isFanOut: boolean): boolean {
  if (!isFanOut) {
    return true;
  }
  const isProduction = getDeploymentEnvironment() === 'production';
  const hash = userId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isEvenHash = hash % 2 === 0;
  return isProduction ? isEvenHash : !isEvenHash;
}
