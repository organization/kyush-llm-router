import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createJsonBodyParser, requestBodyErrorHandler } from '../../src/utils/requestBody';
import { logger } from '../../src/utils/logger';

describe('request body parser errors', () => {
  it('should log payload size details when JSON body exceeds the configured limit', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const app = express();

    app.use(createJsonBodyParser('1kb'));
    app.use(requestBodyErrorHandler);
    app.post('/v1/chat/completions', (_req, res) => res.json({ ok: true }));

    const response = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'vision-test-model', data: 'x'.repeat(2048) });

    expect(response.status).toBe(413);
    expect(response.body.error).toBe('Request body too large');
    expect(response.body.payload_size_bytes).toBeGreaterThan(1024);
    expect(response.body.limit_bytes).toBe(1024);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Request body too large');
    expect(warnSpy.mock.calls[0][0]).toContain('payload=');
    expect(warnSpy.mock.calls[0][0]).toContain('limit=1.00 KB (1024 B)');
    expect(warnSpy.mock.calls[0][1]).toMatchObject({
      payload_size_bytes: expect.any(Number),
      parser_limit_bytes: 1024,
      parser_error_type: 'entity.too.large',
    });

    warnSpy.mockRestore();
  });
});
