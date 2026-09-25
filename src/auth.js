const jwt = require('jsonwebtoken');
const db = require('./db'); 

const SECRET_KEY = 'playtracker_secreto_para_profe';

const login = async (username, password) => {
    // Busca al usuario en MySQL
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password]);
    
    if (rows.length === 0) throw new Error('Credenciales inválidas');
    const user = rows[0]; 
    
    // Genera el token con los datos reales
    const token = jwt.sign({ id: user.id, role: user.role, equipo_id: user.equipo_id, nombre: user.nombre }, SECRET_KEY, { expiresIn: '2h' });
    return { token, role: user.role, nombre: user.nombre };
};

const authMiddleware = (requiredRole) => {
    return (req, res, next) => {
        const token = req.headers['authorization'];
        if (!token) return res.status(403).json({ error: 'Token requerido' });

        try {
            const decoded = jwt.verify(token.split(" ")[1], SECRET_KEY);
            if (requiredRole !== 'Cualquier' && decoded.role !== requiredRole) {
                return res.status(403).json({ error: 'Acceso denegado: Rol insuficiente' });
            }
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
    };
};

module.exports = { login, authMiddleware, SECRET_KEY };