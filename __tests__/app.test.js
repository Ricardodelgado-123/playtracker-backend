const request = require('supertest');
const app = require('../src/app');

describe('Pruebas del Módulo de Autenticación PlayTracker', () => {
    let coachToken = '';
    let jugadorToken = '';

    test('1. Login exitoso de Head Coach', async () => {
        const res = await request(app).post('/api/login').send({ username: 'coach', password: '123' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.role).toBe('Head Coach');
        coachToken = res.body.token; // Guardamos el token para la siguiente prueba
    });

    test('2. Login exitoso de Jugador', async () => {
        const res = await request(app).post('/api/login').send({ username: 'atleta', password: '123' });
        expect(res.statusCode).toBe(200);
        jugadorToken = res.body.token;
    });

    test('3. Login fallido con credenciales incorrectas', async () => {
        const res = await request(app).post('/api/login').send({ username: 'coach', password: 'mal' });
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Credenciales invalidas');
    });

    test('4. Acceso permitido al Playbook con rol Head Coach', async () => {
        const res = await request(app).get('/api/playbook').set('Authorization', `Bearer ${coachToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain('Playbook');
    });

    test('5. Acceso DENEGADO al Playbook si es Jugador (RBAC funcionando)', async () => {
        const res = await request(app).get('/api/playbook').set('Authorization', `Bearer ${jugadorToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('Acceso denegado: Rol insuficiente');
    });

    test('6. Acceso DENEGADO sin token', async () => {
        const res = await request(app).get('/api/playbook');
        expect(res.statusCode).toBe(403);
    });
});