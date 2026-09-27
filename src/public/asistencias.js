// ==========================================
// MÓDULO DE ASISTENCIA Y ESTADO FÍSICO (V2)
// Inyección dinámica sin alterar HTML
// ==========================================

// 1. Iniciar la inyección cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    // Esperamos un momento a que el contenido dinámico (como los eventos) se renderice
    setTimeout(configurarBotonesAsistencia, 1500); 
});

// 2. Configurar los botones dinámicamente
function configurarBotonesAsistencia() {
    const rolUsuario = localStorage.getItem('userRole') || 'Jugador'; // Simulamos obtener el rol, ajusta según tu lógica de login
    const idUsuario = localStorage.getItem('userId') || 1; // Ajusta según tu lógica

    // Seleccionamos todos los contenedores de eventos en el Calendario
    const contenedoresEventos = document.querySelectorAll('.evento-item, .calendario-item, [class*="evento"]'); 

    contenedoresEventos.forEach(contenedor => {
        // Asumimos que el ID del evento está en algún lado (ej. un atributo data-id) o extraemos algo identificativo
        // Por simplicidad en este módulo inyectado, usaremos un ID simulado si no lo encontramos
        const eventoId = contenedor.getAttribute('data-id') || contenedor.dataset.eventoId || Math.floor(Math.random() * 1000);

        if (rolUsuario === 'Head Coach' || rolUsuario === 'Admin') {
            // Es Coach/Admin: Inyectar botón para ver reporte
            inyectarBotonCoach(contenedor, eventoId);
        } else {
            // Es Atleta: Capturar clics en Asisto/Faltaré
            capturarBotonesAtleta(contenedor, eventoId, idUsuario);
        }
    });
}

// 3. Inyectar Botón del Coach
function inyectarBotonCoach(contenedor, eventoId) {
    // Evitar duplicados
    if (contenedor.querySelector('.btn-ver-reporte')) return;

    const btnReporte = document.createElement('button');
    btnReporte.className = 'btn-ver-reporte';
    btnReporte.innerHTML = '<i class="fa-solid fa-clipboard-user"></i> Ver Reporte Asistencia';
    btnReporte.style.cssText = 'margin-top: 10px; width: 100%; padding: 8px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;';
    
    btnReporte.onclick = (e) => {
        e.preventDefault(); // Evitar que recargue la página si está en un form
        verDetalleAsistencia(eventoId);
    };

    contenedor.appendChild(btnReporte);
}

// 4. Capturar clics de Atletas
function capturarBotonesAtleta(contenedor, eventoId, idUsuario) {
    const btnAsisto = contenedor.querySelector('button:contains("Asisto"), .btn-asisto, [onclick*="Asisto"]');
    const btnFaltare = contenedor.querySelector('button:contains("Faltaré"), .btn-faltare, [onclick*="Faltar"]');

    if (btnAsisto) {
        // Sobrescribimos el onclick original o agregamos un listener
        btnAsisto.addEventListener('click', (e) => {
            e.preventDefault();
            registrarAsistencia(eventoId, true, idUsuario);
        });
    }

    if (btnFaltare) {
        btnFaltare.addEventListener('click', (e) => {
             e.preventDefault();
             registrarAsistencia(eventoId, false, idUsuario);
        });
    }
}

// ==========================================
// FUNCIONES DE RED (Fetch) - IGUAL QUE ANTES
// ==========================================

async function registrarAsistencia(eventoId, asiste, usuarioId) {
    const selectFisico = document.querySelector('select[id*="estado-fisico"]') || document.querySelector('select[id*="fisico"]');
    let nivelFatiga = 1; 
    if (selectFisico && selectFisico.value) {
        const match = selectFisico.value.match(/\d+/);
        nivelFatiga = match ? parseInt(match[0]) : 1;
    }

    try {
        const res = await fetch('/api/asistencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evento_id: eventoId, usuario_id: usuarioId, asiste: asiste, fatiga: nivelFatiga })
        });
        const data = await res.json();
        if(data.success) {
            alert(asiste ? `✅ Asistencia confirmada (Estado: Nivel ${nivelFatiga})` : '❌ Se ha notificado tu falta al Coach.');
        } else {
            alert('Hubo un error al registrar tu estado.');
        }
    } catch(error) {
        console.error("Error conectando con la base de datos:", error);
    }
}

async function verDetalleAsistencia(eventoId) {
    try {
        const res = await fetch(`/api/asistencias/evento/${eventoId}`);
        const data = await res.json();
        if (data.success) {
            mostrarModalCoach(data.asistencias);
        } else {
            alert('Error: ' + data.message);
        }
    } catch(error) {
        console.error("Error obteniendo detalles:", error);
        alert('Error de conexión al obtener el reporte.');
    }
}

function mostrarModalCoach(listaAsistencias) {
    const previo = document.getElementById('modal-coach-dinamico');
    if(previo) previo.remove();

    const van = listaAsistencias.filter(a => a.asiste);
    const noVan = listaAsistencias.filter(a => !a.asiste);
    const etiquetas = ["", "Al 100%", "Cansancio general", "Molestia muscular leve", "Dolor agudo (Riesgo)", "LESIÓN GRAVE"];

    const modalHtml = `
        <div id="modal-coach-dinamico" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
            <div style="background:#131b2e; color:white; padding:20px; border-radius:12px; width:100%; max-width:400px; max-height:85vh; overflow-y:auto; border:1px solid #7c3aed; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif;">
                <h3 style="margin-top:0; border-bottom:1px solid #1e293b; padding-bottom:10px; color:#7c3aed;">
                    <i class="fa-solid fa-clipboard-user"></i> Reporte de Plantilla
                </h3>
                <h4 style="color:#10b981; margin-bottom:5px;">✅ Asistirán (${van.length})</h4>
                <ul style="list-style:none; padding:0; margin:0 0 20px 0; font-size:0.9rem;">
                    ${van.length > 0 ? van.map(a => `
                        <li style="padding:8px 0; border-bottom:1px solid #1e293b;">
                            <strong>${a.nombre_jugador}</strong><br>
                            <span style="color:${a.fatiga >= 4 ? '#ef4444' : '#f59e0b'}; font-size:0.8rem;">
                                ⚠️ Estado: Nivel ${a.fatiga} -${etiquetas[a.fatiga] || 'Desconocido'}
                            </span>
                        </li>`).join('') : '<li style="color:#94a3b8;">Nadie ha confirmado aún.</li>'}
                </ul>
                <h4 style="color:#ef4444; margin-bottom:5px;">❌ Faltarán (${noVan.length})</h4>
                <ul style="list-style:none; padding:0; margin:0 0 20px 0; font-size:0.9rem;">
                    ${noVan.length > 0 ? noVan.map(a => `
                        <li style="padding:8px 0; border-bottom:1px solid #1e293b;">
                            <strong>${a.nombre_jugador}</strong><br>
                            <span style="color:#94a3b8; font-size:0.8rem;">Motivo/Estado: Nivel ${a.fatiga}</span>
                        </li>`).join('') : '<li style="color:#94a3b8;">No hay faltas reportadas.</li>'}
                </ul>
                <button onclick="document.getElementById('modal-coach-dinamico').remove()" style="width:100%; padding:12px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Cerrar Panel</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}