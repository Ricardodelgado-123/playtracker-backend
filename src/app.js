const express = require('express');
const { login, authMiddleware } = require('./auth');

const app = express();
app.use(express.json()); // Para poder recibir JSON

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

// Ruta 2: Ruta protegida (Solo Head Coach)
app.get('/api/playbook', authMiddleware('Head Coach'), (req, res) => {
    res.status(200).json({ message: 'Bienvenido Coach. Aqui esta el Playbook.' });
});

// Ruta 3: Ruta protegida (Solo Jugadores)
app.post('/api/asistencia', authMiddleware('Jugador'), (req, res) => {
    res.status(200).json({ message: 'Asistencia registrada con exito.' });
});

module.exports = app;