export function generateApiKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `sk-${timestamp}-${random}`;
}

export function isValidApiKey(key: string): boolean {
  return key.startsWith('sk-') && key.length > 10;
}
