// assets/js/script.js
console.log("SCRIPT.JS (Opción B - Continua) CARGÁNDOSE - v4_continuous");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM CARGADO COMPLETAMENTE - v4_continuous");

    const commandButtons = document.querySelectorAll('.control-button');
    const btnStartListen = document.getElementById('btnStartListen');
    const statusDisplay = document.getElementById('status');
    const detectedTextDisplay = document.getElementById('detected_text');
    const systemResponseDisplay = document.getElementById('system_response');

    if (!btnStartListen) console.error("CRÍTICO: Botón #btnStartListen NO ENCONTRADO. - v4_continuous");
    if (!statusDisplay) console.warn("Elemento #status no encontrado. - v4_continuous");
    if (!detectedTextDisplay) console.warn("Elemento #detected_text no encontrado. - v4_continuous");
    if (!systemResponseDisplay) console.warn("Elemento #system_response no encontrado. - v4_continuous");

    let recognition;
    let isListening = false;
    let wakeWordDetected = false;
    const WAKE_WORD = "alexa";
    const deviceNameForLog = "ControlVozContinuo_v4"; // Se envía a command.php, pero command.php ahora usa el texto del usuario para 'name_to_log'

    commandButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            console.log(`Botón de comando directo presionado: ${command} - v4_continuous`);
            if(systemResponseDisplay) systemResponseDisplay.textContent = '---';
            if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
            sendCommandToBackend(command, 'button');
        });
    });

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.warn("API SpeechRecognition NO SOPORTADA. - v4_continuous");
        if(btnStartListen) btnStartListen.disabled = true;
        if(statusDisplay) statusDisplay.textContent = "Reconocimiento de voz no soportado.";
        return;
    }
    console.log("API SpeechRecognition SOPORTADA. Inicializando... - v4_continuous");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
        recognition = new SpeechRecognition();
        console.log("Objeto SpeechRecognition CREADO. - v4_continuous");
    } catch (e) {
        console.error("CRÍTICO: Error al CREAR SpeechRecognition:", e.message, e, "- v4_continuous");
        if(statusDisplay) statusDisplay.textContent = "Error crítico al inicializar voz: " + e.message;
        if(btnStartListen) btnStartListen.disabled = true;
        return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX';

    recognition.onstart = () => {
        console.log("recognition.onstart: Escucha INICIADA por la API. - v4_continuous");
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
        console.log("recognition.onresult: Resultado de voz recibido. - v4_continuous");
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
            console.log(`Segmento final procesando: "${fullCommand}" - wakeWordDetected: ${wakeWordDetected} - v4_continuous`);

            // El texto completo reconocido (ej. "alexa avanza") se envía a command.php
            // command.php se encarga de extraer "alexa" y el comando.
            // Aquí solo necesitamos detectar "alexa" para saber CUÁNDO enviar.
            if (!wakeWordDetected && fullCommand.toLowerCase().startsWith(WAKE_WORD)) {
                 // Si se detecta "alexa", incluso si no hay comando después, actualizamos estado.
                if(statusDisplay) statusDisplay.textContent = `"${WAKE_WORD}" detectado. Esperando comando completo...`;
                
                // Comprobamos si hay algo después de "Alexa" para procesar inmediatamente
                const commandPart = fullCommand.substring(WAKE_WORD.length).trim();
                if (commandPart) {
                    console.log(`PALABRA CLAVE '${WAKE_WORD}' y comando '${commandPart}' detectados. Enviando texto completo: "${fullCommand}" - v4_continuous`);
                    wakeWordDetected = true; // Marcar que estamos procesando un comando post-Alexa
                    if(statusDisplay) statusDisplay.textContent = `Procesando: "${commandPart}"...`;
                    if(detectedTextDisplay) detectedTextDisplay.textContent = `Comando: ${commandPart}`;
                    sendCommandToBackend(fullCommand, 'voice_alexa'); // Enviar el texto completo ("alexa comando")
                } else {
                    // Solo se dijo "Alexa", no hacemos nada más que esperar el siguiente segmento o finalización
                    console.log(`PALABRA CLAVE '${WAKE_WORD}' detectada, pero sin comando inmediato. - v4_continuous`);
                }
            } else if (wakeWordDetected) {
                console.log("wakeWordDetected era true, pero este segmento no se procesa como nuevo comando. Esperando reseteo. - v4_continuous");
            } else if (!fullCommand.toLowerCase().startsWith(WAKE_WORD) && isListening) { // Solo si no empieza con Alexa y estamos escuchando
                console.log(`No se detectó '${WAKE_WORD}' al inicio. Escuchado: "${fullCommand}". Esperando "${WAKE_WORD}"... - v4_continuous`);
                if(statusDisplay) statusDisplay.textContent = `Di "${WAKE_WORD}" primero. Escuchado: "${fullCommand.substring(0,30)}..."`;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('recognition.onerror:', event.error, event.message, "- v4_continuous");
        let msg = 'Error de reconocimiento: ' + event.error;
        if (event.error === 'no-speech') msg = 'No se detectó voz. La escucha podría detenerse.';
        if (event.error === 'audio-capture') msg = 'Error de micrófono. Verifica que funcione y tenga permisos.';
        if (event.error === 'not-allowed') msg = 'PERMISO DE MICRÓFONO DENEGADO. Habilítalo para este sitio.';
        
        if(statusDisplay) statusDisplay.textContent = msg;
        // onend se llamará y reseteará el botón y estados
    };

    recognition.onend = () => {
        console.log("recognition.onend: Reconocimiento TERMINADO por la API. - v4_continuous");
        isListening = false;
        // No reseteamos wakeWordDetected aquí directamente si queremos que persista entre reinicios de 'start()'
        // Pero para el flujo actual donde 'salir' o el botón detienen, y el botón start reinicia, está bien resetearlo.
        // O mejor, resetearlo solo si no fue un 'salir' que ya lo manejó.
        // La lógica actual es: `wakeWordDetected` se resetea en `sendCommandToBackend` después de un comando de voz exitoso
        // o si `btnStartListen` se usa para iniciar una nueva sesión.

        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Empezar a Escuchar';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#2ecc71';
        }
        // No necesariamente cambiar el statusDisplay aquí, podría haber un mensaje de error o de "pausa".
        console.log("Estado de isListening y botón actualizados en onend. - v4_continuous");
    };

    if(btnStartListen) {
        btnStartListen.addEventListener('click', () => {
            console.log("Botón 'btnStartListen' CLICKEADO. Estado actual de isListening:", isListening, "- v4_continuous");
            if (!recognition) { /* ... (error) ... */ return; }

            if (isListening) {
                console.log("Intentando DETENER la escucha (recognition.stop())... - v4_continuous");
                recognition.stop();
            } else {
                console.log("Intentando INICIAR la escucha (recognition.start())... - v4_continuous");
                try {
                    wakeWordDetected = false; // Resetear al iniciar escucha manualmente
                    recognition.start();
                } catch (e) { /* ... (error y resetear UI del botón) ... */ }
            }
        });
        console.log("Evento click asignado a 'btnStartListen'. - v4_continuous");
    }

    async function sendCommandToBackend(dataValue, type) {
        let text_to_send_for_voice = ""; // Variable para el texto que se enviará para voz
        const formData = new FormData();

        if (type === 'button') {
            formData.append('command', dataValue);
            console.log(`Enviando comando de BOTÓN: ${dataValue} - v4_continuous`);
        } else if (type === 'voice_alexa') {
            // dataValue aquí es el texto COMPLETO reconocido que COMENZÓ con "alexa"
            text_to_send_for_voice = dataValue;
            formData.append('text_from_voice', text_to_send_for_voice);
            console.log(`Enviando comando de VOZ (texto completo): "${text_to_send_for_voice}" - v4_continuous`);
        } else {
            console.error('Tipo de comando no reconocido en sendCommandToBackend:', type, "- v4_continuous");
            if(systemResponseDisplay) systemResponseDisplay.textContent = 'Error interno: tipo de comando desconocido.';
            return;
        }

        if(systemResponseDisplay) systemResponseDisplay.textContent = 'Procesando...';

        try {
            const response = await fetch('command.php', {
                method: 'POST',
                body: formData
            });

            console.log("Respuesta del fetch a command.php, status:", response.status, "- v4_continuous");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error del servidor: ${response.status}. ${errorText}`);
            }

            const result = await response.json();
            console.log("Datos JSON de command.php:", result, "- v4_continuous");

            if(systemResponseDisplay) {
                if (result.error) {
                    systemResponseDisplay.textContent = `Error desde PHP: ${result.error}`;
                } else {
                    systemResponseDisplay.textContent = result.message || 'Respuesta no definida.';
                }
            }

            if (result.interpreted_action_key === 'salir') {
                console.log("Comando 'salir' procesado. Deteniendo escucha si está activa. - v4_continuous");
                if (isListening && recognition) {
                    recognition.stop(); // Esto llamará a onend
                }
                if (statusDisplay) { // Actualizar status para reflejar la pausa
                    statusDisplay.textContent = result.message || "Pausado. Haz clic para reactivar.";
                }
            }

            if (type === 'voice_alexa') {
                wakeWordDetected = false; // Crucial para requerir "Alexa" para el siguiente comando de voz
                console.log("wakeWordDetected reseteado después de procesar comando de voz. - v4_continuous");
                // Si la escucha sigue activa y no fue 'salir', resetear mensaje de status
                if (isListening && statusDisplay && result.interpreted_action_key !== 'salir') {
                    statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
                }
            }

        } catch (error) {
            console.error('Error en sendCommandToBackend (fetch o parseo JSON):', error, "- v4_continuous");
            if(systemResponseDisplay) systemResponseDisplay.textContent = `Error de conexión/respuesta: ${error.message}`;
            if (type === 'voice_alexa') {
                wakeWordDetected = false;
            }
        }
    }
});