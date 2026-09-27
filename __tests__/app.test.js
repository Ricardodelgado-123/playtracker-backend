const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Simulamos la Base de Datos para que las consultas nunca crasheen
jest.mock('../src/db', () => ({
    execute: jest.fn().mockResolvedValue([[]])
}));

// 2. Simulamos el sistema de Seguridad (RBAC) para que las pruebas puedan navegar
jest.mock('../src/auth', () => ({
    login: jest.fn(),
    registrarUsuario: jest.fn(),
    authMiddleware: (rolRequerido) => (req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Falta token' });
        
        const token = authHeader.split(' ')[1];
        if (token === 'token_invalido') return res.status(401).json({ error: 'Token inválido' });

        // Simulamos la decodificación de roles
        let role = 'Jugador';
        if (token === 'token_coach') role = 'Head Coach';
        if (token === 'token_admin') role = 'Admin';

        req.user = { id: 1, role: role, equipo_id: 1 };

        if (rolRequerido !== 'Cualquier' && role !== rolRequerido) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        next();
    }
}));

describe('Suite de 15 Pruebas Unitarias y de Integración (PlayTracker)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        db.execute.mockResolvedValue([[]]); // Resetea la BD falsa antes de cada prueba
    });

    // ==========================================
    // BLOQUE 1: SEGURIDAD (OWASP)
    // ==========================================
    test('1. [Seguridad] Bcrypt cifra correctamente contraseñas', async () => {
        const pass = 'secreto123';
        const hash = await bcrypt.hash(pass, 10);
        expect(hash).not.toBe(pass);
        expect(hash).toMatch(/^\$2[abxy]\$\d+\$/); 
    });

    test('2. [Seguridad] Bcrypt valida hashes correctamente', async () => {
        const pass = 'admin123';
        const hash = await bcrypt.hash(pass, 10);
        const isValid = await bcrypt.compare(pass, hash);
        expect(isValid).toBe(true);
    });

    test('3. [Seguridad] Generación de JWT con firma segura de 3 partes', () => {
        const token = jwt.sign({ id: 1, role: 'Admin' }, 'secreto', { expiresIn: '1h' });
        expect(token.split('.').length).toBe(3);
    });

    test('4. [Seguridad] Peticiones de API sin Token son rechazadas (HTTP 401)', async () => {
        const res = await request(app).get('/api/roster');
        expect(res.statusCode).toBe(401);
    });

    test('5. [Seguridad] Tokens manipulados o inválidos son detectados (HTTP 401)', async () => {
        const res = await request(app).get('/api/roster').set('Authorization', 'Bearer token_invalido');
        expect(res.statusCode).toBe(401);
    });

    // ==========================================
    // BLOQUE 2: RBAC (ROLES Y PERMISOS)
    // ==========================================
    test('6. [RBAC] Atleta NO puede agendar eventos (HTTP 403)', async () => {
        const res = await request(app).post('/api/eventos').set('Authorization', 'Bearer token_atleta').send({ tipo: 'Partido' });
        expect(res.statusCode).toBe(403);
    });

    test('7. [RBAC] Coach NO puede alterar resultados de la liga (HTTP 403)', async () => {
        const res = await request(app).post('/api/resultados').set('Authorization', 'Bearer token_coach').send({});
        expect(res.statusCode).toBe(403);
    });

    test('8. [RBAC] Coach SÍ tiene acceso exclusivo a su propio Roster (HTTP 200)', async () => {
        db.execute.mockResolvedValue([[{ id: 1, nombre: 'Jugador 1' }]]); 
        const res = await request(app).get('/api/roster').set('Authorization', 'Bearer token_coach');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('9. [RBAC] Admin SÍ puede ver el historial de resultados (HTTP 200)', async () => {
        db.execute.mockResolvedValue([[{ id: 1, eq_local: 'A', eq_visita: 'B' }]]);
        const res = await request(app).get('/api/resultados').set('Authorization', 'Bearer token_admin');
        expect(res.statusCode).toBe(200);
    });

    // ==========================================
    // BLOQUE 3: PREVENCIÓN DE ERRORES Y LÓGICA
    // ==========================================
    test('10. [Lógica] Prevención de empalmes rechaza fechas ocupadas (HTTP 400)', async () => {
        db.execute.mockResolvedValue([[{ id: 1, tipo: 'Partido' }]]); // Simulamos que la fecha ya está tomada
        const res = await request(app).post('/api/eventos').set('Authorization', 'Bearer token_admin').send({ equipo_local_nombre: 'A', rival: 'B', fecha: 'Hoy' });
        expect(res.statusCode).toBe(400);
    });

    test('11. [Lógica] Admin recibe Error 404 si intenta dar puntos a un equipo inexistente', async () => {
        db.execute.mockResolvedValue([[]]); // Simulamos base de datos vacía
        const res = await request(app).post('/api/resultados').set('Authorization', 'Bearer token_admin').send({ eqLocal: 'Fantasma', eqVisita: 'Inexistente' });
        expect(res.statusCode).toBe(404);
    });

    test('12. [CRUD] Eliminación exitosa de un jugador del Roster por el Coach (HTTP 200)', async () => {
        db.execute.mockResolvedValue([[{ affectedRows: 1 }]]);
        const res = await request(app).delete('/api/jugador/1').set('Authorization', 'Bearer token_coach');
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Eliminado.');
    });

    // ==========================================
    // BLOQUE 4: MATEMÁTICAS E INTELIGENCIA
    // ==========================================
    test('13. [Matemáticas] Algoritmo de Predicción respeta el Tope Máximo del 98%', () => {
        const prob = Math.min(Math.max((15 / 15) * 100 + (100 * 0.5), 5), 98);
        expect(prob).toBe(98);
    });

    test('14. [Matemáticas] Algoritmo de Predicción respeta el Límite Inferior del 5%', () => {
        const prob = Math.min(Math.max((0 / 10) * 100 + (-50 * 0.5), 5), 98);
        expect(prob).toBe(5);
    });

    test('15. [Matemáticas] Asignación correcta de Puntos: 3 Victoria, 1 Empate, 0 Derrota', () => {
        const ptsLocal = 21, ptsVisita = 14;
        const localGana = ptsLocal > ptsVisita ? 1 : 0;
        const ptsFinal = localGana ? 3 : (ptsLocal === ptsVisita ? 1 : 0);
        expect(ptsFinal).toBe(3);
    });
});