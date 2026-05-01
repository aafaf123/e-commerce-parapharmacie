import request from 'supertest';
import app from '../../src/app.js';

const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: `test_${Date.now()}@test.com`,
  password: 'Test1234!',
  phone: '0600000000'
};

let authToken;

describe('Auth API', () => {
  it('POST /api/auth/signup - crée un utilisateur', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    authToken = res.body.token;
  });

  it('POST /api/auth/login - connexion valide', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/login - mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });
});
