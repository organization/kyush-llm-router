import { describe, expect, it } from 'vitest';
import { resolveIsolatedVmModule } from '../../src/services/ScriptExecutor';

describe('resolveIsolatedVmModule', () => {
  it('accepts a direct isolated-vm export object', () => {
    const fakeModule = { Isolate: class FakeIsolate {} };

    expect(resolveIsolatedVmModule(fakeModule)).toBe(fakeModule);
  });

  it('accepts a default-wrapped isolated-vm export object', () => {
    const fakeModule = { Isolate: class FakeIsolate {} };
    const wrappedModule = { default: fakeModule };

    expect(resolveIsolatedVmModule(wrappedModule)).toBe(fakeModule);
  });

  it('throws when Isolate is unavailable', () => {
    expect(() => resolveIsolatedVmModule({})).toThrow(
      'isolated-vm module did not expose an Isolate constructor',
    );
  });
});
