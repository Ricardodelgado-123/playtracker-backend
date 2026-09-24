const jwt = require('jsonwebtoken');

const SECRET_KEY = 'playtracker_secreto_para_profe';

// Base de datos simulada en memoria (para no fallar en la entrega)
const users = [
    { id: 1, username: 'coach', password: '123', role: 'Head Coach' },
    { id: 2, username: 'atleta', password: '123', role: 'Jugador' }
];

const login = (username, password) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) throw new Error('Credenciales invalidas');
    
    // Generar Token JWT con el rol incluido
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    return { token, role: user.role };
};

// Middleware para verificar roles
const authMiddleware = (requiredRole) => {
    return (req, res, next) => {
        const token = req.headers['authorization'];
        if (!token) return res.status(403).json({ error: 'Token requerido' });

        try {
            const decoded = jwt.verify(token.split(" ")[1], SECRET_KEY); // Espera "Bearer <token>"
            if (decoded.role !== requiredRole) {
                return res.status(403).json({ error: 'Acceso denegado: Rol insuficiente' });
            }
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Token invalido o expirado' });
        }
    };
};

module.exports = { login, authMiddleware, SECRET_KEY };