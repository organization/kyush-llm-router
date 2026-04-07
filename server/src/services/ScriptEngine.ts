import { CompiledScript } from './ScriptExecutor.js';

import { ScriptModel } from '../models/Script.js';
import { logger } from '../utils/logger.js';

import type { ScriptContextData } from '../../../shared/types.js';

export interface ScriptChainResult {
  success: boolean;
  context: ScriptContextData;
  errors: string[];
  executionTimes: number[];
}

export class ScriptEngine {
  static async applyOnRequestScripts(
    context: ScriptContextData,
    userId: number,
    backendId: number,
  ): Promise<{
    context: ScriptContextData;
    errors: string[];
    executionTimes: number[];
  }> {
    const scripts = ScriptModel.getMatchingScripts(userId, backendId);
    const errors: string[] = [];
    const executionTimes: number[] = [];
    let current = context;

    for (const script of scripts) {
      const startTime = Date.now();
      let compiled: CompiledScript | null = null;
      try {
        compiled = await CompiledScript.compile(script.script_code);
        if (compiled.hasOnRequest) {
          current = await compiled.callOnRequest(current);
          logger.info(
            `Script "${script.name}" onRequest executed in ${Date.now() - startTime}ms`,
          );
        }
      } catch (error) {
        const msg = `Script "${script.name}" onRequest failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
        logger.error(msg);
      } finally {
        compiled?.dispose();
        executionTimes.push(Date.now() - startTime);
      }
    }

    return { context: current, errors, executionTimes };
  }

  static async applyOnResponseScripts(
    context: ScriptContextData,
    response: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
      isStream: boolean;
    },
    userId: number,
    backendId: number,
  ): Promise<{
    context: ScriptContextData;
    errors: string[];
    executionTimes: number[];
  }> {
    const scripts = ScriptModel.getMatchingScripts(userId, backendId);
    const errors: string[] = [];
    const executionTimes: number[] = [];
    let current: ScriptContextData = { ...context, response };

    for (const script of scripts) {
      const startTime = Date.now();
      let compiled: CompiledScript | null = null;
      try {
        compiled = await CompiledScript.compile(script.script_code);
        if (compiled.hasOnResponse) {
          current = await compiled.callOnResponse(current);
          logger.info(
            `Script "${script.name}" onResponse executed in ${Date.now() - startTime}ms`,
          );
        }
      } catch (error) {
        const msg = `Script "${script.name}" onResponse failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
        logger.error(msg);
      } finally {
        compiled?.dispose();
        executionTimes.push(Date.now() - startTime);
      }
    }

    return { context: current, errors, executionTimes };
  }

  static async executeScriptChain(
    userId: number,
    backendId: number,
    phase: 'onRequest' | 'onResponse',
    context: ScriptContextData,
    response?: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
      isStream: boolean;
    },
  ): Promise<ScriptChainResult> {
    if (phase === 'onRequest') {
      const result = await this.applyOnRequestScripts(
        context,
        userId,
        backendId,
      );
      return { success: result.errors.length === 0, ...result };
    }
    if (phase === 'onResponse' && response) {
      const result = await this.applyOnResponseScripts(
        context,
        response,
        userId,
        backendId,
      );
      return { success: result.errors.length === 0, ...result };
    }
    return { success: true, context, errors: [], executionTimes: [] };
  }
}
