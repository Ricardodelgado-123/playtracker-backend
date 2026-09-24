const express = require('express');
const path = require('path');
const { login, authMiddleware } = require('./auth');

const app = express();
app.use(express.json());

// NUEVO: Le decimos a Express que muestre la carpeta "public" en el navegador
app.use(express.static(path.join(__dirname, 'public')));

// Ruta 1: Iniciar sesión y obtener JWT
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const result = login(username, password);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Ruta protegida (Solo Head Coach)
app.get('/api/playbook', authMiddleware('Head Coach'), (req, res) => {
    res.status(200).json({ message: 'Playbook Táctico Cargado. Listo para diseñar jugadas.' });
});

// Ruta protegida (Solo Jugadores)
app.post('/api/asistencia', authMiddleware('Jugador'), (req, res) => {
    res.status(200).json({ message: 'Asistencia y estado de fatiga registrados con éxito.' });
});

module.exports = app;