import { Hono } from 'hono';

import { ScriptModel } from '../models/Script.js';
import { CompiledScript } from '../services/ScriptExecutor.js';

import type {
  CreateScriptData,
  UpdateScriptData,
  ScriptContextData,
} from '../../../shared/types.js';
import type { AppEnv } from '../types/hono.js';

const router = new Hono<AppEnv>();

// ============ Script Management ============

router.get('/', (c) => {
  return c.json(ScriptModel.findAll());
});

router.get('/active', (c) => {
  return c.json(ScriptModel.findActive());
});

router.get('/type/:type', (c) => {
  const scriptType = String(c.req.param('type'));
  return c.json(ScriptModel.findByScriptType(scriptType));
});

router.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) {
    return c.json({ error: 'Script not found' }, 404);
  }
  return c.json(script);
});

router.post('/', async (c) => {
  const body = await c.req.json();
  const {
    name,
    script_type,
    target_user_id,
    target_backend_id,
    script_code,
    is_active,
  } = body;

  if (!name || !script_type || !script_code) {
    return c.json(
      { error: 'name, script_type, and script_code are required' },
      400,
    );
  }

  if (script_type === 'per-user-backend') {
    if (!target_user_id || !target_backend_id) {
      return c.json(
        {
          error:
            'target_user_id and target_backend_id are required for per-user-backend scripts',
        },
        400,
      );
    }
  } else if (script_type === 'per-backend') {
    if (!target_backend_id) {
      return c.json(
        { error: 'target_backend_id is required for per-backend scripts' },
        400,
      );
    }
  } else if (script_type === 'per-user') {
    if (!target_user_id) {
      return c.json(
        { error: 'target_user_id is required for per-user scripts' },
        400,
      );
    }
  }

  try {
    const script = ScriptModel.create({
      name,
      script_type,
      target_user_id: target_user_id ?? null,
      target_backend_id: target_backend_id ?? null,
      script_code,
      is_active: is_active ?? true,
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

router.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);

  if (!script) {
    return c.json({ error: 'Script not found' }, 404);
  }

  const body = await c.req.json();
  const {
    name,
    script_type,
    target_user_id,
    target_backend_id,
    script_code,
    is_active,
  } = body;

  if (script_type) {
    if (script_type === 'per-user-backend') {
      if (!target_user_id || !target_backend_id) {
        return c.json(
          {
            error:
              'target_user_id and target_backend_id are required for per-user-backend scripts',
          },
          400,
        );
      }
    } else if (script_type === 'per-backend') {
      if (!target_backend_id) {
        return c.json(
          { error: 'target_backend_id is required for per-backend scripts' },
          400,
        );
      }
    } else if (script_type === 'per-user') {
      if (!target_user_id) {
        return c.json(
          { error: 'target_user_id is required for per-user scripts' },
          400,
        );
      }
    }
  }

  const updatedScript = ScriptModel.update(id, {
    name,
    script_type,
    target_user_id,
    target_backend_id,
    script_code,
    is_active,
  });

  return c.json(updatedScript);
});

router.delete('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const success = ScriptModel.delete(id);
  if (!success) {
    return c.json({ error: 'Script not found' }, 404);
  }
  return c.body(null, 204);
});

router.post('/:id/activate', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) {
    return c.json({ error: 'Script not found' }, 404);
  }

  const success = ScriptModel.activate(id);
  if (!success) {
    return c.json({ error: 'Failed to activate script' }, 500);
  }

  return c.json({ ...script, is_active: true });
});

router.post('/:id/deactivate', (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) {
    return c.json({ error: 'Script not found' }, 404);
  }

  const success = ScriptModel.deactivate(id);
  if (!success) {
    return c.json({ error: 'Failed to deactivate script' }, 500);
  }

  return c.json({ ...script, is_active: false });
});

// ============ Script Testing ============

router.post('/:id/test', async (c) => {
  const id = Number(c.req.param('id'));
  const script = ScriptModel.findById(id);
  if (!script) {
    return c.json({ error: 'Script not found' }, 404);
  }

  const body = await c.req.json();

  if (!body.request) {
    return c.json({ error: 'request is required' }, 400);
  }

  const testContext: ScriptContextData = {
    user: body.user ?? null,
    backend: body.backend ?? null,
    request: body.request,
  };

  let compiled: CompiledScript | null = null;
  try {
    const startTime = Date.now();
    compiled = await CompiledScript.compile(script.script_code);

    if (compiled.hasOnRequest) {
      await compiled.callOnRequest(testContext);
    }
    if (compiled.hasOnResponse) {
      await compiled.callOnResponse(testContext);
    }

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
});

export default router;
