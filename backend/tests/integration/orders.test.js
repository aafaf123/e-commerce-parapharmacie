import request from 'supertest';
import app from '../../src/app.js';

describe('Orders API', () => {
  it('GET /api/orders/my-orders - retourne 401 sans token', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.statusCode).toBe(401);
  });
});
