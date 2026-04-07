import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  CreateScriptInputSchema,
  ScriptTestInputSchema,
  UpdateScriptInputSchema,
} from '@kyush/shared';

import { ScriptModel } from '../models/Script.js';
import { CompiledScript } from '../services/ScriptExecutor.js';

import type { ScriptContextData } from '../../../shared/types.js';
import type { AppEnv } from '../types/hono.js';

const router = new Hono<AppEnv>();

router.get('/', (c) => c.json(ScriptModel.findAll()));
router.get('/active', (c) => c.json(ScriptModel.findActive()));

router.get('/type/:type', (c) => {
  const scriptType = c.req.param('type');
  return c.json(ScriptModel.findByScriptType(scriptType));
});

router.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) return c.json({ error: 'Script not found' }, 404);
  return c.json(script);
});

router.post('/', zValidator('json', CreateScriptInputSchema), (c) => {
  const data = c.req.valid('json');
  try {
    const script = ScriptModel.create({
      name: data.name,
      script_type: data.script_type,
      target_user_id: data.target_user_id ?? null,
      target_backend_id: data.target_backend_id ?? null,
      script_code: data.script_code,
      is_active: data.is_active ?? true,
    });
    return c.json(script, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return c.json({ error: error.message }, 409);
    }
    console.error('Unexpected error creating script:', error);
    return c.json({ error: 'Failed to create script' }, 500);
  }
});

router.put('/:id', zValidator('json', UpdateScriptInputSchema), (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) return c.json({ error: 'Script not found' }, 404);

  const data = c.req.valid('json');

  // When script_type changes, the target fields must satisfy the discriminated
  // shape. The shared CreateScriptInputSchema enforces this on creation; the
  // update path mirrors the same checks because UpdateScriptInputSchema accepts
  // any combination by design.
  if (data.script_type === 'per-user-backend') {
    if (!data.target_user_id || !data.target_backend_id) {
      return c.json(
        {
          error:
            'target_user_id and target_backend_id are required for per-user-backend scripts',
        },
        400,
      );
    }
  } else if (data.script_type === 'per-backend' && !data.target_backend_id) {
    return c.json(
      { error: 'target_backend_id is required for per-backend scripts' },
      400,
    );
  } else if (data.script_type === 'per-user' && !data.target_user_id) {
    return c.json(
      { error: 'target_user_id is required for per-user scripts' },
      400,
    );
  }

  const updatedScript = ScriptModel.update(id, data);
  return c.json(updatedScript);
});

router.delete('/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!ScriptModel.delete(id)) {
    return c.json({ error: 'Script not found' }, 404);
  }
  return c.body(null, 204);
});

router.post('/:id/activate', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) return c.json({ error: 'Script not found' }, 404);
  if (!ScriptModel.activate(id)) {
    return c.json({ error: 'Failed to activate script' }, 500);
  }
  return c.json({ ...script, is_active: true });
});

router.post('/:id/deactivate', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) return c.json({ error: 'Script not found' }, 404);
  if (!ScriptModel.deactivate(id)) {
    return c.json({ error: 'Failed to deactivate script' }, 500);
  }
  return c.json({ ...script, is_active: false });
});

router.post(
  '/:id/test',
  zValidator('json', ScriptTestInputSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    const script = ScriptModel.findById(id);
    if (!script) return c.json({ error: 'Script not found' }, 404);

    const body = c.req.valid('json');
    const testContext: ScriptContextData = {
      user: body.user ?? null,
      backend: body.backend ?? null,
      request: body.request,
    };

    let compiled: CompiledScript | null = null;
    try {
      const startTime = Date.now();
      compiled = await CompiledScript.compile(script.script_code);

      if (compiled.hasOnRequest) await compiled.callOnRequest(testContext);
      if (compiled.hasOnResponse) await compiled.callOnResponse(testContext);

      return c.json({
        success: true,
        executionTime: Date.now() - startTime,
        hasOnRequest: compiled.hasOnRequest,
        hasOnResponse: compiled.hasOnResponse,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    } finally {
      compiled?.dispose();
    }
  },
);

export default router;
