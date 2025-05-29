// script.js
// Versión v4_continuous_public_ip_updated (o como la llames)

console.log("SCRIPT.JS (GitHub Pages) CARGÁNDOSE - v4_continuous_public_ip_updated");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM CARGADO COMPLETAMENTE - v4_continuous_public_ip_updated");

    const commandButtons = document.querySelectorAll('.control-button');
    const btnStartListen = document.getElementById('btnStartListen');
    const statusDisplay = document.getElementById('status');
    const detectedTextDisplay = document.getElementById('detected_text');
    const systemResponseDisplay = document.getElementById('system_response');

    if (!btnStartListen) {
        console.error("CRÍTICO: Botón #btnStartListen NO ENCONTRADO. - v4_continuous_public_ip_updated");
        if(statusDisplay) statusDisplay.textContent = "Error: Falta botón de escucha.";
    }
    if (!statusDisplay) console.warn("Elemento #status no encontrado. - v4_continuous_public_ip_updated");
    if (!detectedTextDisplay) console.warn("Elemento #detected_text no encontrado. - v4_continuous_public_ip_updated");
    if (!systemResponseDisplay) console.warn("Elemento #system_response no encontrado. - v4_continuous_public_ip_updated");

    let recognition;
    let isListening = false;
    let wakeWordDetected = false;
    const WAKE_WORD = "alexa";

    commandButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            console.log(`Botón de comando directo presionado: ${command} - v4_continuous_public_ip_updated`);
            if(systemResponseDisplay) systemResponseDisplay.textContent = '---';
            if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
            sendCommandToBackend(command, 'button');
        });
    });

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.warn("API SpeechRecognition NO SOPORTADA. - v4_continuous_public_ip_updated");
        if(btnStartListen) btnStartListen.disabled = true;
        if(statusDisplay) statusDisplay.textContent = "Reconocimiento de voz no soportado.";
        return;
    }
    console.log("API SpeechRecognition SOPORTADA. Inicializando... - v4_continuous_public_ip_updated");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
        recognition = new SpeechRecognition();
        console.log("Objeto SpeechRecognition CREADO. - v4_continuous_public_ip_updated");
    } catch (e) {
        console.error("CRÍTICO: Error al CREAR SpeechRecognition:", e.message, e, "- v4_continuous_public_ip_updated");
        if(statusDisplay) statusDisplay.textContent = "Error crítico al inicializar voz: " + e.message;
        if(btnStartListen) btnStartListen.disabled = true;
        return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX';

    recognition.onstart = () => {
        console.log("recognition.onstart: Escucha INICIADA por la API. - v4_continuous_public_ip_updated");
        isListening = true;
        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Detener Escucha';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#e74c3c';
        }
        if(statusDisplay) statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
        if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
        if(systemResponseDisplay) systemResponseDisplay.textContent = '---';
    };

    recognition.onresult = (event) => {
        console.log("recognition.onresult: Resultado de voz recibido. - v4_continuous_public_ip_updated");
        let interim_transcript = '';
        let final_transcript_segment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript_segment += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }

        if(detectedTextDisplay) detectedTextDisplay.textContent = interim_transcript || final_transcript_segment || "Escuchando...";

        if (final_transcript_segment) {
            const fullCommand = final_transcript_segment.toLowerCase().trim();
            console.log(`Segmento final procesando: "${fullCommand}" - wakeWordDetected: ${wakeWordDetected} - v4_continuous_public_ip_updated`);

            if (!wakeWordDetected && fullCommand.toLowerCase().startsWith(WAKE_WORD)) {
                if(statusDisplay) statusDisplay.textContent = `"${WAKE_WORD}" detectado. Esperando comando completo...`;
                const commandPart = fullCommand.substring(WAKE_WORD.length).trim();
                if (commandPart) {
                    console.log(`PALABRA CLAVE '${WAKE_WORD}' y comando '${commandPart}' detectados. Enviando texto completo: "${fullCommand}" - v4_continuous_public_ip_updated`);
                    wakeWordDetected = true; 
                    if(statusDisplay) statusDisplay.textContent = `Procesando: "${commandPart}"...`;
                    if(detectedTextDisplay) detectedTextDisplay.textContent = `Comando: ${commandPart}`;
                    sendCommandToBackend(fullCommand, 'voice_alexa'); 
                } else {
                    console.log(`PALABRA CLAVE '${WAKE_WORD}' detectada, pero sin comando inmediato. - v4_continuous_public_ip_updated`);
                }
            } else if (wakeWordDetected) {
                 console.log("wakeWordDetected era true, pero este segmento no se procesa como nuevo comando. Esperando reseteo. - v4_continuous_public_ip_updated");
            } else if (!fullCommand.toLowerCase().startsWith(WAKE_WORD) && isListening) { 
                console.log(`No se detectó '${WAKE_WORD}' al inicio. Escuchado: "${fullCommand}". Esperando "${WAKE_WORD}"... - v4_continuous_public_ip_updated`);
                if(statusDisplay) statusDisplay.textContent = `Di "${WAKE_WORD}" primero. Escuchado: "${fullCommand.substring(0,30)}..."`;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('recognition.onerror:', event.error, event.message, "- v4_continuous_public_ip_updated");
        let msg = 'Error de reconocimiento: ' + event.error;
        if (event.error === 'no-speech') msg = 'No se detectó voz. La escucha podría detenerse.';
        if (event.error === 'audio-capture') msg = 'Error de micrófono. Verifica que funcione y tenga permisos.';
        if (event.error === 'not-allowed') msg = 'PERMISO DE MICRÓFONO DENEGADO. Habilítalo para este sitio.';
        
        if(statusDisplay) statusDisplay.textContent = msg;
    };

    recognition.onend = () => {
        console.log("recognition.onend: Reconocimiento TERMINADO por la API. - v4_continuous_public_ip_updated");
        isListening = false;
        
        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Empezar a Escuchar';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#2ecc71';
        }
        console.log("Estado de isListening y botón actualizados en onend. - v4_continuous_public_ip_updated");
    };

    if(btnStartListen) {
        btnStartListen.addEventListener('click', () => {
            console.log("Botón 'btnStartListen' CLICKEADO. Estado actual de isListening:", isListening, "- v4_continuous_public_ip_updated");
            if (!recognition) { 
                console.error("CRÍTICO en onclick: Objeto 'recognition' no inicializado. - v4_continuous_public_ip_updated");
                if(statusDisplay) statusDisplay.textContent = "Error: Servicio de voz no disponible.";
                return;
            }

            if (isListening) {
                console.log("Intentando DETENER la escucha (recognition.stop())... - v4_continuous_public_ip_updated");
                recognition.stop();
            } else {
                console.log("Intentando INICIAR la escucha (recognition.start())... - v4_continuous_public_ip_updated");
                try {
                    wakeWordDetected = false; 
                    recognition.start();
                } catch (e) { 
                    console.error("ERROR ATRAPADO al llamar a recognition.start():", e.message, e, "- v4_continuous_public_ip_updated");
                    if(statusDisplay) statusDisplay.textContent = 'Error CRÍTICO al iniciar escucha: ' + e.message;
                    isListening = false; 
                    if(btnStartListen) { 
                         btnStartListen.textContent = '🎤 Empezar a Escuchar';
                         btnStartListen.disabled = false;
                         btnStartListen.style.backgroundColor = '#2ecc71';
                    }
                }
            }
        });
        console.log("Evento click asignado a 'btnStartListen'. - v4_continuous_public_ip_updated");
    }

    async function sendCommandToBackend(dataValue, type) {
        // ★★★ URL DEL BACKEND ACTUALIZADA CON TU IP PÚBLICA DE EC2 ★★★
        const backendUrl = 'https://54.91.160.193/carrito1/command.php'; 
        
        const formData = new FormData();
        let consoleIdent = "- v4_continuous_public_ip_updated";

        if (type === 'button') {
            formData.append('command', dataValue);
            console.log(`Enviando comando de BOTÓN: ${dataValue} a ${backendUrl} ${consoleIdent}`);
        } else if (type === 'voice_alexa') {
            formData.append('text_from_voice', dataValue);
            console.log(`Enviando comando de VOZ (texto completo): "${dataValue}" a ${backendUrl} ${consoleIdent}`);
        } else {
            console.error('Tipo de comando no reconocido en sendCommandToBackend:', type, consoleIdent);
            if(systemResponseDisplay) systemResponseDisplay.textContent = 'Error interno: tipo de comando desconocido.';
            return;
        }

        if(systemResponseDisplay) systemResponseDisplay.textContent = 'Procesando...';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData
            });

            console.log(`Respuesta del fetch a ${backendUrl}, status: ${response.status} ${consoleIdent}`);
            if (!response.ok) {
                const errorText = await response.text(); 
                console.error(`Error del servidor en fetch: ${response.status}. Respuesta: ${errorText} ${consoleIdent}`);
                throw new Error(`Error del servidor: ${response.status}.`);
            }

            const result = await response.json();
            console.log(`Datos JSON de ${backendUrl}:`, result, consoleIdent);

            if(systemResponseDisplay) {
                if (result.error) {
                    systemResponseDisplay.textContent = `Error desde PHP: ${result.error}`;
                } else {
                    systemResponseDisplay.textContent = result.message || 'Respuesta no definida.';
                }
            }

            if (result.interpreted_action_key === 'salir') {
                console.log(`Comando 'salir' procesado. Deteniendo escucha si está activa. ${consoleIdent}`);
                if (isListening && recognition) {
                    recognition.stop(); 
                }
                if (statusDisplay) { 
                    statusDisplay.textContent = result.message || "Pausado. Haz clic para reactivar.";
                }
            }

            if (type === 'voice_alexa') {
                wakeWordDetected = false; 
                console.log(`wakeWordDetected reseteado. ${consoleIdent}`);
                if (isListening && statusDisplay && result.interpreted_action_key !== 'salir') {
                    statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
                }
            }

        } catch (error) {
            console.error(`Error en sendCommandToBackend (fetch o parseo JSON): ${error.message} ${consoleIdent}`, error);
            if(systemResponseDisplay) systemResponseDisplay.textContent = `Error de conexión/respuesta al backend: ${error.message}`;
            if (type === 'voice_alexa') {
                wakeWordDetected = false;
            }
        }
    }
});