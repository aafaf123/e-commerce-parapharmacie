import request from 'supertest';
import app from '../../src/app.js';

describe('Products API', () => {
  it('GET /api/products - retourne la liste', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
  });
});
