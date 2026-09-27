const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Librería de cifrado
const db = require('./db'); 

const SECRET_KEY = 'playtracker_secreto_para_profe';

// [LEER] Iniciar Sesión (Compara la contraseña cifrada)
const login = async (username, password) => {
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE username = ?', [username]);
    if (rows.length === 0) throw new Error('Credenciales inválidas');
    
    const user = rows[0]; 
    
    // Verificamos si la contraseña ingresada coincide con el hash de la BD
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error('Credenciales inválidas');
    
    const token = jwt.sign({ id: user.id, role: user.role, equipo_id: user.equipo_id, nombre: user.nombre }, SECRET_KEY, { expiresIn: '2h' });
    return { token, role: user.role, nombre: user.nombre };
};

// [CREAR] Registrar Usuario (Cifra la contraseña antes de guardarla)
const registrarUsuario = async (username, password, role, nombre, equipo_id) => {
    // Genera un "Hash" (cifrado) de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await db.execute(
        'INSERT INTO usuarios (username, password, role, nombre, equipo_id) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, role, nombre, equipo_id]
    );
    return { message: 'Usuario registrado exitosamente y cifrado' };
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

module.exports = { login, registrarUsuario, authMiddleware, SECRET_KEY };