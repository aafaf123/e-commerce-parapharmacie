import request from 'supertest';
import app from '../../src/app.js';

describe('Categories API', () => {
  it('GET /api/categories - retourne la liste', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);
  });
});
