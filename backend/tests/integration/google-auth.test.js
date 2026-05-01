import request from 'supertest';
import app from '../../src/app.js';

describe('Google Auth API', () => {
  it('POST /api/auth/google - refuse sans credential', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Credential Google requis');
  });

  it('POST /api/auth/google - refuse credential invalide', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'invalid_token' });
    expect([400, 500]).toContain(res.statusCode);
  }, 15000);
});
