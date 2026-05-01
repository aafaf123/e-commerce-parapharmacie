import request from 'supertest';
import app from '../../src/app.js';

describe('Suppliers API', () => {
  it('GET /api/admin/suppliers - retourne 401 sans token', async () => {
    const res = await request(app).get('/api/admin/suppliers');
    expect(res.statusCode).toBe(401);
  });
});
