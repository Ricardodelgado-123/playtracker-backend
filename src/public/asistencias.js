// ==========================================
// MÓDULO DE ASISTENCIA Y ESTADO FÍSICO
// Funciona para Desktop y Móvil unificado
// ==========================================

// 1. Función para el Atleta: Enviar Asistencia + Nivel de Fatiga
async function registrarAsistencia(eventoId, asiste, usuarioId) {
    // Busca el selector de estado físico (sea en la PC o en el móvil)
    const selectFisico = document.querySelector('select[id*="estado-fisico"]') || document.querySelector('select[id*="fisico"]');
    
    // Si no seleccionó nada, asume Nivel 1 (Al 100%)
    let nivelFatiga = 1; 
    if (selectFisico && selectFisico.value) {
        // Extrae el número del nivel (ej. "Nivel 3" -> 3)
        const match = selectFisico.value.match(/\d+/);
        nivelFatiga = match ? parseInt(match[0]) : 1;
    }

    try {
        const res = await fetch('/api/asistencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                evento_id: eventoId, 
                usuario_id: usuarioId, // Asignar el ID del atleta logueado
                asiste: asiste, 
                fatiga: nivelFatiga 
            })
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

// 2. Función para el Coach: Ver la lista detallada de jugadores
async function verDetalleAsistencia(eventoId) {
    try {
        const res = await fetch(`/api/asistencias/evento/${eventoId}`);
        const data = await res.json();

        if (data.success) {
            mostrarModalCoach(data.asistencias);
        }
    } catch(error) {
        console.error("Error obteniendo detalles:", error);
    }
}

// 3. Generador de Interfaz (Pop-up dinámico sin tocar tu HTML)
function mostrarModalCoach(listaAsistencias) {
    // Si ya hay un modal abierto, lo cerramos
    const previo = document.getElementById('modal-coach-dinamico');
    if(previo) previo.remove();

    // Filtramos quiénes van y quiénes no
    const van = listaAsistencias.filter(a => a.asiste);
    const noVan = listaAsistencias.filter(a => !a.asiste);

    // Traductor de niveles para que el coach lo lea claro
    const etiquetas = ["", "Al 100%", "Cansancio general", "Molestia muscular leve", "Dolor agudo (Riesgo)", "LESIÓN GRAVE"];

    const modalHtml = `
        <div id="modal-coach-dinamico" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
            <div style="background:#131b2e; color:white; padding:20px; border-radius:12px; width:100%; max-width:400px; max-height:85vh; overflow-y:auto; border:1px solid #7c3aed; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif;">
                
                <h3 style="margin-top:0; border-bottom:1px solid #1e293b; padding-bottom:10px; color:#7c3aed;">
                    <i class="fa-solid fa-clipboard-user"></i> Reporte de Plantilla
                </h3>
                
                <!-- Lista de los que ASISTEN -->
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

                <!-- Lista de los que FALTAN -->
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
    
    // Inyecta el panel visual sobre la pantalla actual
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}