import * as ivm from 'isolated-vm';
import { ScriptContextData } from '../../../shared/types';
import { logger } from '../utils/logger';

const SCRIPT_TIMEOUT_MS = 5000;
const MEMORY_LIMIT_MB = 50;

/**
 * Strip `export` keywords from user script code so it can run in eval() context.
 * Supports: `export const`, `export function`, `export default`, `export {`.
 */
function preprocessScript(code: string): string {
  return code.replace(/\bexport\s+(default\s+)?/g, '');
}

/**
 * A compiled user script running in an isolated-vm isolate.
 * The isolate stays alive between hook calls and must be explicitly disposed.
 */
export class CompiledScript {
  private constructor(
    private isolate: ivm.Isolate,
    private ctx: ivm.Context,
    private onRequestRef: ivm.Reference<Function> | null,
    private onResponseRef: ivm.Reference<Function> | null,
  ) {}

  get hasOnRequest(): boolean {
    return this.onRequestRef !== null;
  }

  get hasOnResponse(): boolean {
    return this.onResponseRef !== null;
  }

  /**
   * Compile user script code in a new isolate.
   * Detects onRequest / onResponse hooks and stores References to them.
   */
  static async compile(code: string): Promise<CompiledScript> {
    const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
    const ctx = await isolate.createContext();
    const jail = ctx.global;

    // Provide console via Reference callbacks (only primitives can cross applySync boundary)
    const logFns = {
      _logLog: new ivm.Reference((...args: string[]) => logger.log(`[script] ${args.join(' ')}`)),
      _logDebug: new ivm.Reference((...args: string[]) => logger.debug(`[script] ${args.join(' ')}`)),
      _logInfo: new ivm.Reference((...args: string[]) => logger.info(`[script] ${args.join(' ')}`)),
      _logWarn: new ivm.Reference((...args: string[]) => logger.warn(`[script] ${args.join(' ')}`)),
      _logError: new ivm.Reference((...args: string[]) => logger.error(`[script] ${args.join(' ')}`)),
    };
    for (const [name, ref] of Object.entries(logFns)) {
      await jail.set(name, ref);
    }
    await ctx.eval(`
      globalThis.console = {
        log:   (...a) => _logLog.applySync(undefined, a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v))),
        debug: (...a) => _logDebug.applySync(undefined, a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v))),
        info:  (...a) => _logInfo.applySync(undefined, a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v))),
        warn:  (...a) => _logWarn.applySync(undefined, a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v))),
        error: (...a) => _logError.applySync(undefined, a.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v))),
      };
    `, { timeout: SCRIPT_TIMEOUT_MS });

    // Evaluate user script (with export keywords stripped)
    const processedCode = preprocessScript(code);
    await ctx.eval(processedCode, { timeout: SCRIPT_TIMEOUT_MS });

    // Check which hooks exist, then grab References only for defined ones
    const hasOnRequest = await ctx.eval(
      'typeof onRequest === "function"',
      { timeout: SCRIPT_TIMEOUT_MS },
    ) as boolean;
    const hasOnResponse = await ctx.eval(
      'typeof onResponse === "function"',
      { timeout: SCRIPT_TIMEOUT_MS },
    ) as boolean;

    const onRequestRef = hasOnRequest
      ? await ctx.eval('onRequest', { timeout: SCRIPT_TIMEOUT_MS, reference: true }) as ivm.Reference<Function>
      : null;
    const onResponseRef = hasOnResponse
      ? await ctx.eval('onResponse', { timeout: SCRIPT_TIMEOUT_MS, reference: true }) as ivm.Reference<Function>
      : null;

    return new CompiledScript(isolate, ctx, onRequestRef, onResponseRef);
  }

  /**
   * Call the script's onRequest hook with the given context data.
   * Data is transferred via structured clone ({ copy: true }) — no JSON overhead.
   */
  async callOnRequest(data: ScriptContextData): Promise<ScriptContextData> {
    if (!this.onRequestRef) {
      return data;
    }
    const result = await this.onRequestRef.apply(undefined, [data], {
      arguments: { copy: true },
      result: { promise: true, copy: true },
      timeout: SCRIPT_TIMEOUT_MS,
    });
    return (result ?? data) as ScriptContextData;
  }

  /**
   * Call the script's onResponse hook with the given context data.
   */
  async callOnResponse(data: ScriptContextData): Promise<ScriptContextData> {
    if (!this.onResponseRef) {
      return data;
    }
    const result = await this.onResponseRef.apply(undefined, [data], {
      arguments: { copy: true },
      result: { promise: true, copy: true },
      timeout: SCRIPT_TIMEOUT_MS,
    });
    return (result ?? data) as ScriptContextData;
  }

  dispose(): void {
    try { this.ctx.release(); } catch {}
    try { this.isolate.dispose(); } catch {}
  }
}
