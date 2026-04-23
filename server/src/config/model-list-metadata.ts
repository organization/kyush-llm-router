export function shouldIncludeModelListRoutingMetadata(): boolean {
  const value = process.env.MODEL_LIST_INCLUDE_ROUTING_METADATA?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}
