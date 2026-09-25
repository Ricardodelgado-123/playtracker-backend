const express = require('express');
const path = require('path');
const db = require('./db');
const { login, authMiddleware } = require('./auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login
app.post('/api/login', async (req, res) => {
    try {
        const result = await login(req.body.username, req.body.password);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Obtener Calendario
app.get('/api/eventos', authMiddleware('Cualquier'), async (req, res) => {
    try {
        const [equipos] = await db.execute('SELECT nombre FROM equipos WHERE id = ?', [req.user.equipo_id]);
        const nombreEquipo = equipos[0].nombre;

        const [eventos] = await db.execute('SELECT * FROM eventos WHERE equipo_id = ?', [req.user.equipo_id]);
        
        const eventosConStats = await Promise.all(eventos.map(async (ev) => {
            let stats = null;
            if (req.user.role === 'Head Coach') {
                const [asisten] = await db.execute('SELECT COUNT(*) as count FROM asistencias WHERE evento_id = ? AND asiste = 1', [ev.id]);
                const [faltan] = await db.execute('SELECT COUNT(*) as count FROM asistencias WHERE evento_id = ? AND asiste = 0', [ev.id]);
                stats = { asisten: asisten[0].count, faltan: faltan[0].count };
            }
            return { ...ev, equipoLocal: nombreEquipo, stats };
        }));

        res.status(200).json(eventosConStats);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar eventos' });
    }
});

// Guardar Asistencia (Atleta)
app.post('/api/asistencia', authMiddleware('Jugador'), async (req, res) => {
    try {
        const { evento_id, asiste, fatiga } = req.body;
        
        await db.execute(
            `INSERT INTO asistencias (evento_id, usuario_id, asiste, fatiga) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE asiste = VALUES(asiste), fatiga = VALUES(fatiga)`,
            [evento_id, req.user.id, asiste, fatiga]
        );

        res.status(200).json({ message: 'Respuesta guardada en la Base de Datos.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar asistencia' });
    }
});

// Obtener Jugadores (Coach)
app.get('/api/roster', authMiddleware('Head Coach'), async (req, res) => {
    try {
        const [roster] = await db.execute('SELECT id, nombre FROM usuarios WHERE equipo_id = ? AND role = "Jugador"', [req.user.equipo_id]);
        res.status(200).json(roster);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roster' });
    }
});

module.exports = app;