import { Router, Request, Response } from 'express';
import { ScriptModel } from '../models/Script';
import { UserModel } from '../models/User';
import { BackendModel } from '../models/Backend';
import { CompiledScript } from '../services/ScriptExecutor';
import { CreateScriptData, UpdateScriptData, ScriptContextData } from '../../../shared/types';

const router: Router = Router();

// ============ Script Management ============

router.get('/', (req: Request, res: Response) => {
  const scripts = ScriptModel.findAll();
  res.json(scripts);
});

router.get('/active', (req: Request, res: Response) => {
  const scripts = ScriptModel.findActive();
  res.json(scripts);
});

router.get('/type/:type', (req: Request, res: Response) => {
  const scriptType = String(req.params.type);
  const scripts = ScriptModel.findByScriptType(scriptType);
  res.json(scripts);
});

router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const script = ScriptModel.findById(id);

  if (!script) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  res.json(script);
});

router.post('/', (req: Request, res: Response) => {
  const { name, script_type, target_user_id, target_backend_id, script_code, is_active } = req.body as CreateScriptData;

  if (!name || !script_type || !script_code) {
    res.status(400).json({ error: 'name, script_type, and script_code are required' });
    return;
  }

  if (script_type === 'per-user-backend') {
    if (!target_user_id || !target_backend_id) {
      res.status(400).json({ error: 'target_user_id and target_backend_id are required for per-user-backend scripts' });
      return;
    }
  } else if (script_type === 'per-backend') {
    if (!target_backend_id) {
      res.status(400).json({ error: 'target_backend_id is required for per-backend scripts' });
      return;
    }
  } else if (script_type === 'per-user') {
    if (!target_user_id) {
      res.status(400).json({ error: 'target_user_id is required for per-user scripts' });
      return;
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
    res.status(201).json(script);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    } else {
      console.error('Unexpected error creating script:', error);
      res.status(500).json({ error: 'Failed to create script' });
    }
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const script = ScriptModel.findById(id);

  if (!script) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  const { name, script_type, target_user_id, target_backend_id, script_code, is_active } = req.body as UpdateScriptData;

  if (script_type) {
    if (script_type === 'per-user-backend') {
      if (!target_user_id || !target_backend_id) {
        res.status(400).json({ error: 'target_user_id and target_backend_id are required for per-user-backend scripts' });
        return;
      }
    } else if (script_type === 'per-backend') {
      if (!target_backend_id) {
        res.status(400).json({ error: 'target_backend_id is required for per-backend scripts' });
        return;
      }
    } else if (script_type === 'per-user') {
      if (!target_user_id) {
        res.status(400).json({ error: 'target_user_id is required for per-user scripts' });
        return;
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

  res.json(updatedScript);
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const success = ScriptModel.delete(id);

  if (!success) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  res.status(204).send();
});

router.post('/:id/activate', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const script = ScriptModel.findById(id);

  if (!script) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  const success = ScriptModel.activate(id);
  if (!success) {
    res.status(500).json({ error: 'Failed to activate script' });
    return;
  }

  res.json({ ...script, is_active: true });
});

router.post('/:id/deactivate', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const script = ScriptModel.findById(id);

  if (!script) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  const success = ScriptModel.deactivate(id);
  if (!success) {
    res.status(500).json({ error: 'Failed to deactivate script' });
    return;
  }

  res.json({ ...script, is_active: false });
});

// ============ Script Testing ============

router.post('/:id/test', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const script = ScriptModel.findById(id);

  if (!script) {
    res.status(404).json({ error: 'Script not found' });
    return;
  }

  const { user, backend, request } = req.body as {
    user?: { id: number; name: string; email?: string };
    backend?: { id: number; name: string; base_url: string };
    request: { method: string; path: string; headers: Record<string, string>; body: unknown; isStream: boolean };
  };

  if (!request) {
    res.status(400).json({ error: 'request is required' });
    return;
  }

  const testContext: ScriptContextData = {
    user: user ?? null,
    backend: backend ?? null,
    request,
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

    res.json({
      success: true,
      executionTime: Date.now() - startTime,
      hasOnRequest: compiled.hasOnRequest,
      hasOnResponse: compiled.hasOnResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    compiled?.dispose();
  }
});

export default router;
