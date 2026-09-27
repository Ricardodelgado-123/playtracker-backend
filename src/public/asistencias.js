// ==========================================
// MÓDULO DE ASISTENCIA Y ESTADO FÍSICO (V3 - Radar Dinámico)
// ==========================================

// 1. Funciones Globales
window.verDetalleAsistencia = async function(eventoId) {
    try {
        const res = await fetch(`/api/asistencias/evento/${eventoId}`);
        const data = await res.json();
        if (data.success) {
            mostrarModalCoach(data.asistencias);
        } else {
            alert('Aún no hay reportes para este evento.');
        }
    } catch(error) {
        console.error("Error de conexión:", error);
    }
};

window.registrarAsistencia = async function(eventoId, asiste, usuarioId) {
    let nivelFatiga = 1;
    const selectFisico = document.querySelector('select'); // Busca tu desplegable
    if(selectFisico && selectFisico.value.includes('Nivel')) {
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
        if(data.success) alert(asiste ? `✅ Asistencia y Nivel ${nivelFatiga} enviados al Coach.` : '❌ Falta notificada al Coach.');
    } catch(error) {
        console.error("Error:", error);
    }
};

// 2. El Modal Visual
function mostrarModalCoach(listaAsistencias) {
    const previo = document.getElementById('modal-coach-dinamico');
    if(previo) previo.remove();

    const van = listaAsistencias.filter(a => a.asiste);
    const noVan = listaAsistencias.filter(a => !a.asiste);

    const modalHtml = `
        <div id="modal-coach-dinamico" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:15px;">
            <div style="background:#131b2e; color:white; padding:20px; border-radius:12px; width:100%; max-width:400px; border:1px solid #7c3aed;">
                <h3 style="color:#7c3aed; margin-top:0;">📊 Reporte de Plantilla</h3>
                
                <h4 style="color:#10b981; margin-bottom:5px;">✅ Asistirán (${van.length})</h4>
                <ul style="padding-left:0; list-style:none; font-size:0.9rem;">
                    ${van.length > 0 ? van.map(a => `<li style="border-bottom:1px solid #1e293b; padding:5px 0;"><b>${a.nombre_jugador}</b> <br><span style="color:#f59e0b; font-size:0.8rem;">⚠️ Fatiga: Nivel ${a.fatiga}</span></li>`).join('') : '<li style="color:#94a3b8;">Nadie ha confirmado</li>'}
                </ul>

                <h4 style="color:#ef4444; margin-bottom:5px; margin-top:15px;">❌ Faltarán (${noVan.length})</h4>
                <ul style="padding-left:0; list-style:none; font-size:0.9rem; margin-bottom:20px;">
                    ${noVan.length > 0 ? noVan.map(a => `<li style="border-bottom:1px solid #1e293b; padding:5px 0;"><b>${a.nombre_jugador}</b> <br><span style="color:#94a3b8; font-size:0.8rem;">Motivo/Estado: Nivel ${a.fatiga}</span></li>`).join('') : '<li style="color:#94a3b8;">Sin faltas</li>'}
                </ul>

                <button onclick="document.getElementById('modal-coach-dinamico').remove()" style="width:100%; padding:10px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Cerrar Panel</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 3. EL RADAR VIGILANTE (Corre cada 1.5s buscando eventos en pantalla)
setInterval(() => {
    // Detectar si el usuario logueado es Coach mirando el texto de la pantalla
    const esCoach = document.body.innerText.includes('Head Coach') || document.body.innerText.includes('Admin');
    
    if (esCoach) {
        // En tu diseño, cada evento tiene un botón de "Editar Info". Lo usamos como ancla.
        const botonesEditar = document.querySelectorAll('button');
        botonesEditar.forEach(btn => {
            if (btn.innerText.includes('Editar Info')) {
                const contenedor = btn.parentElement;
                
                // Si el contenedor aún NO tiene nuestro botón morado, se lo inyectamos
                if (!contenedor.querySelector('.btn-ver-reporte')) {
                    // Extraemos el ID del evento (del onclick del botón Editar Info)
                    const match = btn.getAttribute('onclick')?.match(/\d+/);
                    const eventoId = match ? match[0] : 1;

                    const btnReporte = document.createElement('button');
                    btnReporte.className = 'btn-ver-reporte';
                    btnReporte.innerHTML = '📊 Ver Reporte Asistencia';
                    btnReporte.style.cssText = 'margin-top: 8px; width: 100%; padding: 6px; background: transparent; color: #a78bfa; border: 1px solid #8b5cf6; border-radius: 6px; cursor: pointer; transition: 0.3s;';
                    
                    btnReporte.onmouseover = () => btnReporte.style.background = 'rgba(139, 92, 246, 0.2)';
                    btnReporte.onmouseout = () => btnReporte.style.background = 'transparent';
                    
                    // Al hacer clic, lanza el modal
                    btnReporte.onclick = () => window.verDetalleAsistencia(eventoId);
                    
                    // Lo agregamos abajito del botón "Editar Info"
                    contenedor.appendChild(btnReporte);
                }
            }
        });
    }
}, 1500);