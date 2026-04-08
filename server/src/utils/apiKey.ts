import { randomBytes } from 'node:crypto';

export function generateApiKey(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `sk-${timestamp}-${random}`;
}

export function isValidApiKey(key: string): boolean {
  return key.startsWith('sk-') && key.length > 10;
}
