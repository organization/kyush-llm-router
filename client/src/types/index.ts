// Re-export every shared domain type so existing client code can keep
// importing from `../types`. The shared package is the single source of
// truth for the schemas and types that travel across the wire.
export * from '@kyush/shared';
