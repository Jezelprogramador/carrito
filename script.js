// script.js
// Versión final para GitHub Pages con IP pública del backend

console.log("SCRIPT.JS (GitHub Pages) CARGÁNDOSE - v_FINAL");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM CARGADO COMPLETAMENTE - v_FINAL");

    const commandButtons = document.querySelectorAll('.control-button');
    const btnStartListen = document.getElementById('btnStartListen');
    const statusDisplay = document.getElementById('status');
    const detectedTextDisplay = document.getElementById('detected_text');
    const systemResponseDisplay = document.getElementById('system_response');

    if (!btnStartListen) { console.error("CRÍTICO: Botón #btnStartListen NO ENCONTRADO. - v_FINAL"); }
    // ... (otras verificaciones de elementos si las necesitas) ...

    let recognition;
    let isListening = false;
    let wakeWordDetected = false;
    const WAKE_WORD = "alexa";

    commandButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            console.log(`Botón presionado: ${command} - v_FINAL`);
            if(systemResponseDisplay) systemResponseDisplay.textContent = '---';
            if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
            sendCommandToBackend(command, 'button');
        });
    });

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.warn("API SpeechRecognition NO SOPORTADA. - v_FINAL");
        if(btnStartListen) btnStartListen.disabled = true;
        if(statusDisplay) statusDisplay.textContent = "Reconocimiento de voz no soportado.";
        return;
    }
    console.log("API SpeechRecognition SOPORTADA. Inicializando... - v_FINAL");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
        recognition = new SpeechRecognition();
        console.log("Objeto SpeechRecognition CREADO. - v_FINAL");
    } catch (e) {
        console.error("CRÍTICO: Error al CREAR SpeechRecognition:", e.message, e, "- v_FINAL");
        if(statusDisplay) statusDisplay.textContent = "Error crítico al inicializar voz: " + e.message;
        if(btnStartListen) btnStartListen.disabled = true;
        return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX'; // O tu preferencia de idioma

    recognition.onstart = () => {
        console.log("recognition.onstart: Escucha INICIADA. - v_FINAL");
        isListening = true;
        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Detener Escucha';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#e74c3c'; // Rojo cuando escucha
        }
        if(statusDisplay) statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
        if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
        if(systemResponseDisplay) systemResponseDisplay.textContent = '---'; // Limpiar respuesta anterior
    };

    recognition.onresult = (event) => {
        console.log("recognition.onresult: Resultado de voz. - v_FINAL");
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
            console.log(`Segmento final: "${fullCommand}" - wakeWord: ${wakeWordDetected} - v_FINAL`);
            if (!wakeWordDetected && fullCommand.startsWith(WAKE_WORD)) {
                if(statusDisplay) statusDisplay.textContent = `"${WAKE_WORD}" detectado. Esperando comando...`;
                const commandPart = fullCommand.substring(WAKE_WORD.length).trim();
                if (commandPart) {
                    console.log(`Comando post-Alexa: "${commandPart}". Enviando texto completo: "${fullCommand}" - v_FINAL`);
                    wakeWordDetected = true; 
                    if(statusDisplay) statusDisplay.textContent = `Procesando: "${commandPart}"...`;
                    if(detectedTextDisplay) detectedTextDisplay.textContent = `Comando: ${commandPart}`;
                    sendCommandToBackend(fullCommand, 'voice_alexa'); 
                } else {
                     console.log(`Solo '${WAKE_WORD}' detectado, sin comando. - v_FINAL`);
                }
            } else if (wakeWordDetected) { 
                 console.log("wakeWord era true, nuevo segmento no se procesa. Esperando reseteo. - v_FINAL");
            } else if (!fullCommand.startsWith(WAKE_WORD) && isListening) { 
                if(statusDisplay) statusDisplay.textContent = `Di "${WAKE_WORD}" primero. Escuchado: "${fullCommand.substring(0,30)}..."`;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('recognition.onerror:', event.error, event.message, "- v_FINAL");
        let msg = 'Error de reconocimiento: ' + event.error;
        if (event.error === 'no-speech') msg = 'No se detectó voz. Intenta de nuevo.';
        if (event.error === 'audio-capture') msg = 'Error de micrófono. Verifica permisos y hardware.';
        if (event.error === 'not-allowed') msg = 'PERMISO DE MICRÓFONO DENEGADO. Habilítalo para este sitio.';
        if (event.error === 'network') msg = 'Error de red en reconocimiento de voz. Verifica tu conexión a internet.';
        
        if(statusDisplay) statusDisplay.textContent = msg;
        // El onend se encargará de resetear el botón
    };

    recognition.onend = () => {
        console.log("recognition.onend: Reconocimiento TERMINADO. - v_FINAL");
        isListening = false;
        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Empezar a Escuchar';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#2ecc71'; // Verde original
        }
        // No resetear wakeWordDetected aquí si queremos que la lógica de sendCommandToBackend lo haga
        // para permitir una secuencia de comandos si la escucha sigue activa.
        // Pero para el flujo actual, es mejor resetearlo en sendCommandToBackend o cuando se inicia una nueva escucha.
        console.log("UI de botón y escucha reseteados en onend. - v_FINAL");
    };

    if(btnStartListen) {
        btnStartListen.addEventListener('click', () => {
            console.log("Botón 'btnStartListen' CLICKEADO. isListening:", isListening, "- v_FINAL");
            if (!recognition) { 
                console.error("CRÍTICO en onclick: Objeto 'recognition' no inicializado. - v_FINAL");
                if(statusDisplay) statusDisplay.textContent = "Error: Servicio de voz no disponible.";
                return;
            }
            if (isListening) {
                console.log("Intentando DETENER la escucha... - v_FINAL");
                recognition.stop();
            } else {
                console.log("Intentando INICIAR la escucha... - v_FINAL");
                try {
                    wakeWordDetected = false; // Siempre se necesita "Alexa" al iniciar una nueva sesión manualmente
                    recognition.start();
                } catch (e) { 
                    console.error("ERROR al llamar recognition.start():", e.message, e, "- v_FINAL");
                    if(statusDisplay) statusDisplay.textContent = 'Error CRÍTICO al iniciar: ' + e.message;
                    isListening = false; 
                    if(btnStartListen) {
                         btnStartListen.textContent = '🎤 Empezar a Escuchar';
                         btnStartListen.disabled = false;
                         btnStartListen.style.backgroundColor = '#2ecc71';
                    }
                }
            }
        });
        console.log("Evento click asignado a 'btnStartListen'. - v_FINAL");
    }

    async function sendCommandToBackend(dataValue, type) {
        // ★★★ URL DEL BACKEND CON TU IP PÚBLICA DE EC2 ★★★
        const backendUrl = 'https://54.227.33.244/carrito1/command.php'; 
        
        const formData = new FormData();
        let consoleIdent = "- v_FINAL";

        if (type === 'button') {
            formData.append('command', dataValue); // dataValue es ej. "v_ade_der"
            console.log(`Enviando BOTÓN: ${dataValue} a ${backendUrl} ${consoleIdent}`);
        } else if (type === 'voice_alexa') {
            // dataValue es el texto COMPLETO reconocido que COMENZÓ con "alexa" (ej. "alexa avanza a la derecha")
            formData.append('text_from_voice', dataValue);
            console.log(`Enviando VOZ: "${dataValue}" a ${backendUrl} ${consoleIdent}`);
        } else {
            console.error('Tipo de comando no reconocido:', type, consoleIdent);
            if(systemResponseDisplay) systemResponseDisplay.textContent = 'Error interno del script.';
            return;
        }

        if(systemResponseDisplay) systemResponseDisplay.textContent = 'Procesando...';

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData
            });

            console.log(`Respuesta fetch a ${backendUrl}, status: ${response.status} ${consoleIdent}`);
            if (!response.ok) {
                const errorText = await response.text(); 
                console.error(`Error servidor fetch: ${response.status}. Resp: ${errorText} ${consoleIdent}`);
                throw new Error(`Error del servidor: ${response.status}.`);
            }

            const result = await response.json();
            console.log(`Datos JSON de ${backendUrl}:`, result, consoleIdent);

            if(systemResponseDisplay) {
                if (result.error) {
                    systemResponseDisplay.textContent = `Error desde Backend: ${result.error} (${result.message || ''})`;
                } else {
                    systemResponseDisplay.textContent = result.message || 'Respuesta no definida.';
                }
            }

            // Manejo del comando "salir" para la UI
            if (result.interpreted_action_key === 'salir') {
                console.log(`Comando 'salir' procesado. Deteniendo escucha si está activa. ${consoleIdent}`);
                if (isListening && recognition) {
                    recognition.stop(); // Esto llamará a onend, que actualiza el botón
                }
                // El mensaje de "Aplicación en pausa" ya lo puso systemResponseDisplay
                if (statusDisplay) { 
                    statusDisplay.textContent = result.message || "Pausado. Haz clic para reactivar.";
                }
            }

            // Resetear wakeWordDetected después de procesar un comando de voz_alexa exitoso o no
            // para que el siguiente comando de voz requiera "Alexa" de nuevo.
            if (type === 'voice_alexa') {
                wakeWordDetected = false; 
                console.log(`wakeWordDetected reseteado. ${consoleIdent}`);
                // Si la escucha sigue activa y no fue 'salir', preparamos para el siguiente "Alexa"
                if (isListening && statusDisplay && result.interpreted_action_key !== 'salir') {
                    statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
                }
            }

        } catch (error) {
            console.error(`Error en sendCommandToBackend: ${error.message} ${consoleIdent}`, error);
            if(systemResponseDisplay) systemResponseDisplay.textContent = `Error de conexión/respuesta al backend: ${error.message}`;
            if (type === 'voice_alexa') { // También resetear en caso de error para voz
                wakeWordDetected = false;
            }
        }
    }
});