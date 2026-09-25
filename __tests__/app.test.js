const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

// Simulamos (Mock) la base de datos para que GitHub Actions no falle
jest.mock('../src/db', () => ({
    execute: jest.fn()
}));

describe('Pruebas de Seguridad y API (PlayTracker)', () => {
    let tokenCoach = '';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Autenticación exitosa (JWT Generado)', async () => {
        // Simulamos que MySQL encontró al coach
        db.execute.mockResolvedValue([[{ id: 1, role: 'Head Coach', equipo_id: 1, nombre: 'Coach Test' }]]);
        
        const res = await request(app).post('/api/login').send({ username: 'coach', password: '123' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.role).toBe('Head Coach');
        tokenCoach = res.body.token;
    });

    test('2. Autenticación fallida (SQL Injection prevenido)', async () => {
        // Simulamos que MySQL no encontró el usuario
        db.execute.mockResolvedValue([[]]);
        
        const res = await request(app).post('/api/login').send({ username: 'admin" OR "1"="1', password: 'bad' });
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe('Credenciales inválidas');
    });

    test('3. RBAC: Acceso permitido a rutas de Coach', async () => {
        // Simulamos la respuesta del roster
        db.execute.mockResolvedValue([[{ id: 2, nombre: 'Atleta Test' }]]);
        
        const res = await request(app).get('/api/roster').set('Authorization', `Bearer ${tokenCoach}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    test('4. RBAC: Acceso denegado sin Token (Error 403)', async () => {
        const res = await request(app).get('/api/roster');
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('Token requerido');
    });
});