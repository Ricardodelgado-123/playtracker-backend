const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'playtracker_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000 // Da más tiempo para conectar con DBs externas como Railway
});

async function initDB() {
    try {
        const dbName = process.env.DB_NAME || 'playtracker_db';
        
        // Evitamos el CREATE DATABASE en producción (Render/Railway ya te dan la base creada)
        if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
             await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        }
        await pool.query(`USE \`${dbName}\``);

        // 1. EQUIPOS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. USUARIOS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                role ENUM('Admin', 'Head Coach', 'Jugador') NOT NULL,
                equipo_id INT NULL,
                FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
            )
        `);

        // 3. POSICIONES
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posiciones (
                equipo VARCHAR(100) PRIMARY KEY,
                jj INT DEFAULT 0,
                jg INT DEFAULT 0,
                jp INT DEFAULT 0,
                pf INT DEFAULT 0,
                pc INT DEFAULT 0,
                dif INT DEFAULT 0,
                pt INT DEFAULT 0,
                FOREIGN KEY (equipo) REFERENCES equipos(nombre) ON DELETE CASCADE
            )
        `);

        // 4. HISTORIAL DE RESULTADOS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS historial_resultados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                eq_local VARCHAR(100) NOT NULL,
                pts_local INT NOT NULL,
                eq_visita VARCHAR(100) NOT NULL,
                pts_visita INT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. EVENTOS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS eventos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                equipo_id INT NOT NULL,
                rival VARCHAR(150) NOT NULL,
                tipo ENUM('Partido', 'Entrenamiento') NOT NULL,
                fecha VARCHAR(100) NOT NULL,
                lugar VARCHAR(150),
                linkMapa VARCHAR(500),
                FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
            )
        `);

        // 6. ASISTENCIAS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS asistencias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                asiste BOOLEAN NOT NULL,
                fatiga INT DEFAULT 1,
                UNIQUE KEY unico_evento_usuario (evento_id, usuario_id),
                FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);

        // 7. Equipo "Liga" reservado en id=1
        const [equiposExistentes] = await pool.query('SELECT * FROM equipos WHERE id = 1');
        if (equiposExistentes.length === 0) {
            await pool.query('INSERT INTO equipos (id, nombre) VALUES (1, "Liga (Sistema)")');
        }

        // 8. Usuario Admin por defecto
        const [admins] = await pool.query('SELECT * FROM usuarios WHERE role = "Admin"');
        if (admins.length === 0) {
            const hash = await bcrypt.hash('admin123', 10);
            await pool.query(`
                INSERT INTO usuarios (username, password, nombre, role, equipo_id)
                VALUES ('admin', ?, 'Administrador Liga', 'Admin', NULL)
            `, [hash]);
            console.log("🛠️ Usuario Admin creado con éxito (admin / admin123).");
        }

        console.log("✅ Base de datos estructurada y conectada con éxito.");
    } catch (err) {
        console.error("❌ Error conectando a MySQL:", err.message);
    }
}

initDB();

module.exports = pool;