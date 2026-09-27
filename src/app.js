const express = require('express');
const path = require('path');
const db = require('./db');
const { login, registrarUsuario, authMiddleware } = require('./auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* =========================================
   1. SEGURIDAD Y AUTENTICACIÓN
========================================= */
app.post('/api/login', async (req, res) => {
    try {
        const result = await login(req.body.username, req.body.password);
        res.status(200).json(result);
    } catch (error) { res.status(401).json({ error: error.message }); }
});

app.post('/api/registrar-coach', async (req, res) => {
    try {
        const { username, password, nombre, nombreEquipo } = req.body;
        const [resultEq] = await db.execute('INSERT INTO equipos (nombre) VALUES (?)', [nombreEquipo]);
        const equipoId = resultEq.insertId;
        await db.execute('INSERT INTO posiciones (equipo) VALUES (?)', [nombreEquipo]);
        await registrarUsuario(username, password, 'Head Coach', nombre, equipoId);
        res.status(201).json({ message: 'Coach y Equipo registrados.' });
    } catch (error) { res.status(500).json({ error: 'El usuario o el equipo ya existen.' }); }
});

/* =========================================
   2. GESTIÓN DE ROSTER (CRUD COMPLETO)
========================================= */
app.post('/api/jugador', authMiddleware('Head Coach'), async (req, res) => {
    try {
        await registrarUsuario(req.body.username, req.body.password, 'Jugador', req.body.nombre, req.user.equipo_id);
        res.status(201).json({ message: 'Atleta dado de alta.' });
    } catch (error) { res.status(500).json({ error: 'El usuario ya existe.' }); }
});

app.get('/api/roster', authMiddleware('Head Coach'), async (req, res) => {
    try {
        const [roster] = await db.execute('SELECT id, nombre, username FROM usuarios WHERE equipo_id = ? AND role = "Jugador"', [req.user.equipo_id]);
        res.status(200).json(roster);
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/jugador/:id', authMiddleware('Head Coach'), async (req, res) => {
    try {
        await db.execute('UPDATE usuarios SET nombre = ? WHERE id = ?', [req.body.nombre, req.params.id]);
        res.status(200).json({ message: 'Actualizado.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/jugador/:id', authMiddleware('Head Coach'), async (req, res) => {
    try {
        await db.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Eliminado.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

/* =========================================
   3. RUTAS EXCLUSIVAS DEL ADMINISTRADOR (ZONA DE PELIGRO)
========================================= */
// Ver todos los equipos y sus Coaches
app.get('/api/admin/equipos', authMiddleware('Admin'), async (req, res) => {
    try {
        const query = `
            SELECT eq.id, eq.nombre as equipo, IFNULL(u.nombre, 'Sin Asignar') as coach 
            FROM equipos eq 
            LEFT JOIN usuarios u ON eq.id = u.equipo_id AND u.role = 'Head Coach' 
            WHERE eq.id != 1
        `;
        const [equipos] = await db.execute(query);
        res.status(200).json(equipos);
    } catch (error) { res.status(500).json({ error: 'Error al obtener equipos' }); }
});

// Eliminar UN SOLO equipo (Expulsión / Baja)
app.delete('/api/admin/equipo/:id', authMiddleware('Admin'), async (req, res) => {
    try {
        await db.execute('DELETE FROM equipos WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Equipo expulsado de la liga exitosamente.' });
    } catch (error) { res.status(500).json({ error: 'Error al eliminar el equipo' }); }
});

// Eliminar TODOS los equipos (Fin de Temporada)
app.delete('/api/admin/equipos-todos', authMiddleware('Admin'), async (req, res) => {
    try {
        await db.execute('DELETE FROM equipos WHERE id != 1'); // Respeta al Admin
        res.status(200).json({ message: 'Todos los equipos eliminados. Sistema limpio.' });
    } catch (error) { res.status(500).json({ error: 'Error crítico al limpiar el sistema' }); }
});

// Reiniciar Puntos a Cero (Nueva Temporada, mismos equipos)
app.put('/api/admin/reset-posiciones', authMiddleware('Admin'), async (req, res) => {
    try {
        await db.execute('UPDATE posiciones SET jj=0, jg=0, jp=0, pf=0, pc=0, dif=0, pt=0');
        await db.execute('DELETE FROM historial_resultados'); // Limpiamos los partidos viejos
        res.status(200).json({ message: 'Tabla de posiciones reiniciada a cero.' });
    } catch (error) { res.status(500).json({ error: 'Error al reiniciar posiciones' }); }
});
/* =========================================
   4. INTELIGENCIA DE NEGOCIO (PREDICCIONES DE VICTORIA)
========================================= */
// Algoritmo Heurístico para predecir al Campeón
app.get('/api/predicciones', authMiddleware('Cualquier'), async (req, res) => {
    try {
        const [posiciones] = await db.execute('SELECT equipo, jj, jg, dif FROM posiciones');
        const predicciones = posiciones.map(p => {
            // Si no han jugado, la probabilidad es del 5% base
            if (p.jj === 0) return { equipo: p.equipo, probabilidad: 5.0 };
            
            // Win Rate (Porcentaje de juegos ganados)
            let winRate = (p.jg / p.jj) * 100;
            // Bonus por diferencia de puntos (Goleadas a favor suman, en contra restan)
            let difBonus = p.dif * 0.5; 
            
            // Probabilidad final (La topeamos entre 5% y 98% para que sea realista)
            let prob = Math.min(Math.max(winRate + difBonus, 5), 98);
            
            return { equipo: p.equipo, probabilidad: parseFloat(prob.toFixed(1)) };
        });
        
        // Ordenamos de mayor a menor probabilidad
        predicciones.sort((a, b) => b.probabilidad - a.probabilidad);
        res.status(200).json(predicciones);
    } catch (error) { res.status(500).json({ error: 'Error al calcular predicciones' }); }
});

/* =========================================
   5. TABLA DE POSICIONES Y RESULTADOS
========================================= */
app.get('/api/posiciones', authMiddleware('Cualquier'), async (req, res) => {
    try {
        const [tabla] = await db.execute('SELECT * FROM posiciones ORDER BY pt DESC, dif DESC, pf DESC');
        res.status(200).json(tabla);
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/resultados', authMiddleware('Admin'), async (req, res) => {
    try {
        const [historial] = await db.execute('SELECT * FROM historial_resultados ORDER BY id DESC LIMIT 10');
        res.status(200).json(historial);
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/resultados', authMiddleware('Admin'), async (req, res) => {
    const { eqLocal, ptsLocal, eqVisita, ptsVisita } = req.body;
    try {
        const [localData] = await db.execute('SELECT * FROM posiciones WHERE equipo=?', [eqLocal]);
        const [visitaData] = await db.execute('SELECT * FROM posiciones WHERE equipo=?', [eqVisita]);
        if (localData.length===0 || visitaData.length===0) return res.status(404).json({ error: 'Equipos no encontrados' });

        const local = localData[0]; const visita = visitaData[0];

        const localGana = ptsLocal > ptsVisita ? 1 : 0; const localPierde = ptsLocal < ptsVisita ? 1 : 0;
        const localPts = localGana ? 3 : (ptsLocal === ptsVisita ? 1 : 0); const difLocal = ptsLocal - ptsVisita;
        await db.execute('UPDATE posiciones SET jj=?, jg=?, jp=?, pf=?, pc=?, dif=?, pt=? WHERE equipo=?',
            [local.jj + 1, local.jg + localGana, local.jp + localPierde, local.pf + ptsLocal, local.pc + ptsVisita, local.dif + difLocal, local.pt + localPts, eqLocal]);

        const visGana = ptsVisita > ptsLocal ? 1 : 0; const visPierde = ptsVisita < ptsLocal ? 1 : 0;
        const visPts = visGana ? 3 : (ptsVisita === ptsLocal ? 1 : 0); const difVis = ptsVisita - ptsLocal;
        await db.execute('UPDATE posiciones SET jj=?, jg=?, jp=?, pf=?, pc=?, dif=?, pt=? WHERE equipo=?',
            [visita.jj + 1, visita.jg + visGana, visita.jp + visPierde, visita.pf + ptsVisita, visita.pc + ptsLocal, visita.dif + difVis, visita.pt + visPts, eqVisita]);

        await db.execute('INSERT INTO historial_resultados (eq_local, pts_local, eq_visita, pts_visita) VALUES (?, ?, ?, ?)', [eqLocal, ptsLocal, eqVisita, ptsVisita]);
        res.status(200).json({ message: 'Resultado procesado.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/resultados/:id', authMiddleware('Admin'), async (req, res) => {
    try {
        const [partido] = await db.execute('SELECT * FROM historial_resultados WHERE id = ?', [req.params.id]);
        if (partido.length === 0) return res.status(404).json({ error: 'No encontrado' });
        const { eq_local, pts_local, eq_visita, pts_visita } = partido[0];
        
        const [localData] = await db.execute('SELECT * FROM posiciones WHERE equipo=?', [eq_local]);
        const [visitaData] = await db.execute('SELECT * FROM posiciones WHERE equipo=?', [eq_visita]);
        const local = localData[0]; const visita = visitaData[0];

        const localGana = pts_local > pts_visita ? 1 : 0; const localPierde = pts_local < pts_visita ? 1 : 0;
        const localPts = localGana ? 3 : (pts_local === pts_visita ? 1 : 0); const difLocal = pts_local - pts_visita;
        await db.execute('UPDATE posiciones SET jj=?, jg=?, jp=?, pf=?, pc=?, dif=?, pt=? WHERE equipo=?',
            [local.jj - 1, local.jg - localGana, local.jp - localPierde, local.pf - pts_local, local.pc - pts_visita, local.dif - difLocal, local.pt - localPts, eq_local]);

        const visGana = pts_visita > pts_local ? 1 : 0; const visPierde = pts_visita < pts_local ? 1 : 0;
        const visPts = visGana ? 3 : (pts_visita === pts_local ? 1 : 0); const difVis = pts_visita - pts_local;
        await db.execute('UPDATE posiciones SET jj=?, jg=?, jp=?, pf=?, pc=?, dif=?, pt=? WHERE equipo=?',
            [visita.jj - 1, visita.jg - visGana, visita.jp - visPierde, visita.pf - pts_visita, visita.pc - pts_local, visita.dif - difVis, visita.pt - visPts, eq_visita]);

        await db.execute('DELETE FROM historial_resultados WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Revertido exitosamente.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

/* =========================================
   6. EVENTOS Y CALENDARIO
========================================= */
app.get('/api/eventos', authMiddleware('Cualquier'), async (req, res) => {
    try {
        let eventos = []; let equipoNombre = "Liga";
        if (req.user.role === 'Admin') {
            [eventos] = await db.execute('SELECT e.*, eq.nombre AS equipoLocal FROM eventos e JOIN equipos eq ON e.equipo_id = eq.id WHERE e.tipo = "Partido"');
        } else {
            const [equipos] = await db.execute('SELECT nombre FROM equipos WHERE id = ?', [req.user.equipo_id]);
            equipoNombre = equipos[0].nombre;
            [eventos] = await db.execute('SELECT * FROM eventos WHERE equipo_id = ?', [req.user.equipo_id]);
        }
        
        const eventosConStats = await Promise.all(eventos.map(async (ev) => {
            let stats = null;
            if (req.user.role === 'Head Coach' || req.user.role === 'Admin') {
                const [asisten] = await db.execute('SELECT COUNT(*) as count FROM asistencias WHERE evento_id = ? AND asiste = 1', [ev.id]);
                const [faltan] = await db.execute('SELECT COUNT(*) as count FROM asistencias WHERE evento_id = ? AND asiste = 0', [ev.id]);
                stats = { asisten: asisten[0].count, faltan: faltan[0].count };
            }
            return { ...ev, equipoLocal: req.user.role === 'Admin' ? ev.equipoLocal : equipoNombre, stats };
        }));
        res.status(200).json(eventosConStats);
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/eventos', authMiddleware('Cualquier'), async (req, res) => {
    try {
        const { equipo_local_nombre, rival, tipo, fecha, lugar, linkMapa } = req.body;
        if (req.user.role === 'Jugador') return res.status(403).json({ error: 'No autorizado.' });
        if (req.user.role === 'Head Coach' && tipo === 'Partido') return res.status(403).json({ error: 'Solo Admin.' });
        if (req.user.role === 'Admin' && tipo === 'Entrenamiento') return res.status(403).json({ error: 'Solo Coach.' });
        
        let equipoDestino;
        if (req.user.role === 'Admin') {
            const [eqs] = await db.execute('SELECT id FROM equipos WHERE nombre = ?', [equipo_local_nombre]);
            equipoDestino = eqs[0].id;
        } else {
            equipoDestino = req.user.equipo_id;
        }
        
        const [empalmes] = await db.execute('SELECT id, tipo FROM eventos WHERE equipo_id = ? AND fecha = ?', [equipoDestino, fecha]);
        if (empalmes.length > 0) return res.status(400).json({ error: `Ya existe un ${empalmes[0].tipo} a esa hora.` });

        await db.execute('INSERT INTO eventos (equipo_id, rival, tipo, fecha, lugar, linkMapa) VALUES (?, ?, ?, ?, ?, ?)',
            [equipoDestino, rival, tipo, fecha, lugar, linkMapa]);
        res.status(201).json({ message: 'Agendado.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/eventos/:id', authMiddleware('Head Coach'), async (req, res) => {
    try {
        const { fecha, lugar, linkMapa } = req.body;
        await db.execute('UPDATE eventos SET fecha = ?, lugar = ?, linkMapa = ? WHERE id = ? AND equipo_id = ?',
            [fecha, lugar, linkMapa, req.params.id, req.user.equipo_id]);
        res.status(200).json({ message: 'Actualizado.' });
    } catch (error) { res.status(500).json({ error: 'Error al actualizar.' }); }
});

app.post('/api/asistencia', authMiddleware('Jugador'), async (req, res) => {
    try {
        await db.execute(`INSERT INTO asistencias (evento_id, usuario_id, asiste, fatiga) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE asiste = VALUES(asiste), fatiga = VALUES(fatiga)`,
            [req.body.evento_id, req.user.id, req.body.asiste, req.body.fatiga]);
        res.status(200).json({ message: 'Guardado.' });
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

module.exports = app;