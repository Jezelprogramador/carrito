// script.js
// Versión v5_full_features (o como la llames)

console.log("SCRIPT.JS (GitHub Pages) CARGÁNDOSE - v5_full_features");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM CARGADO COMPLETAMENTE - v5_full_features");

    const commandButtons = document.querySelectorAll('.control-button');
    const btnStartListen = document.getElementById('btnStartListen');
    const statusDisplay = document.getElementById('status');
    const detectedTextDisplay = document.getElementById('detected_text');
    const systemResponseDisplay = document.getElementById('system_response');

    if (!btnStartListen) {
        console.error("CRÍTICO: Botón #btnStartListen NO ENCONTRADO. - v5_full_features");
        if(statusDisplay) statusDisplay.textContent = "Error: Falta botón de escucha.";
    }
    if (!statusDisplay) console.warn("Elemento #status no encontrado. - v5_full_features");
    if (!detectedTextDisplay) console.warn("Elemento #detected_text no encontrado. - v5_full_features");
    if (!systemResponseDisplay) console.warn("Elemento #system_response no encontrado. - v5_full_features");

    let recognition;
    let isListening = false;
    let wakeWordDetected = false;
    const WAKE_WORD = "alexa";

    commandButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-command');
            console.log(`Botón presionado: ${command} - v5_full_features`);
            if(systemResponseDisplay) systemResponseDisplay.textContent = '---';
            if(detectedTextDisplay) detectedTextDisplay.textContent = '---';
            sendCommandToBackend(command, 'button');
        });
    });

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.warn("API SpeechRecognition NO SOPORTADA. - v5_full_features");
        if(btnStartListen) btnStartListen.disabled = true;
        if(statusDisplay) statusDisplay.textContent = "Reconocimiento de voz no soportado.";
        return;
    }
    console.log("API SpeechRecognition SOPORTADA. Inicializando... - v5_full_features");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
        recognition = new SpeechRecognition();
        console.log("Objeto SpeechRecognition CREADO. - v5_full_features");
    } catch (e) {
        console.error("CRÍTICO: Error al CREAR SpeechRecognition:", e.message, e, "- v5_full_features");
        if(statusDisplay) statusDisplay.textContent = "Error crítico al inicializar voz: " + e.message;
        if(btnStartListen) btnStartListen.disabled = true;
        return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX';

    recognition.onstart = () => {
        console.log("recognition.onstart: Escucha INICIADA. - v5_full_features");
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
        console.log("recognition.onresult: Resultado de voz. - v5_full_features");
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
            console.log(`Segmento final: "${fullCommand}" - wakeWord: ${wakeWordDetected} - v5_full_features`);
            if (!wakeWordDetected && fullCommand.startsWith(WAKE_WORD)) {
                if(statusDisplay) statusDisplay.textContent = `"${WAKE_WORD}" detectado. Esperando comando...`;
                const commandPart = fullCommand.substring(WAKE_WORD.length).trim();
                if (commandPart) {
                    console.log(`Comando post-Alexa: "${commandPart}". Enviando: "${fullCommand}" - v5_full_features`);
                    wakeWordDetected = true; 
                    if(statusDisplay) statusDisplay.textContent = `Procesando: "${commandPart}"...`;
                    if(detectedTextDisplay) detectedTextDisplay.textContent = `Comando: ${commandPart}`;
                    sendCommandToBackend(fullCommand, 'voice_alexa'); 
                } else {
                     console.log(`Solo '${WAKE_WORD}' detectado. - v5_full_features`);
                }
            } else if (wakeWordDetected) { 
                 console.log("wakeWord era true, pero este segmento no se procesa. Esperando reseteo. - v5_full_features");
            } else if (!fullCommand.startsWith(WAKE_WORD) && isListening) { 
                if(statusDisplay) statusDisplay.textContent = `Di "${WAKE_WORD}" primero. Escuchado: "${fullCommand.substring(0,30)}..."`;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('recognition.onerror:', event.error, event.message, "- v5_full_features");
        let msg = 'Error de reconocimiento: ' + event.error;
        if (event.error === 'no-speech') msg = 'No se detectó voz.';
        if (event.error === 'audio-capture') msg = 'Error de micrófono.';
        if (event.error === 'not-allowed') msg = 'PERMISO DE MICRÓFONO DENEGADO.';
        if(statusDisplay) statusDisplay.textContent = msg;
    };

    recognition.onend = () => {
        console.log("recognition.onend: Reconocimiento TERMINADO. - v5_full_features");
        isListening = false;
        if(btnStartListen) {
            btnStartListen.textContent = '🎤 Empezar a Escuchar';
            btnStartListen.disabled = false;
            btnStartListen.style.backgroundColor = '#2ecc71';
        }
        console.log("UI de botón y escucha reseteados en onend. - v5_full_features");
    };

    if(btnStartListen) {
        btnStartListen.addEventListener('click', () => {
            console.log("Botón 'btnStartListen' CLICKEADO. isListening:", isListening, "- v5_full_features");
            if (!recognition) { return; }
            if (isListening) {
                recognition.stop();
            } else {
                try {
                    wakeWordDetected = false; 
                    recognition.start();
                } catch (e) { 
                    console.error("ERROR al llamar recognition.start():", e.message, e, "- v5_full_features");
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
    }

    async function sendCommandToBackend(dataValue, type) {
        // ★★★ URL DEL BACKEND ACTUALIZADA CON TU IP PÚBLICA DE EC2 ★★★
        const backendUrl = 'https://13.218.249.244/carrito1/command.php'; 
        
        const formData = new FormData();
        let consoleIdent = "- v5_full_features";

        if (type === 'button') {
            formData.append('command', dataValue);
            console.log(`Enviando BOTÓN: ${dataValue} a ${backendUrl} ${consoleIdent}`);
        } else if (type === 'voice_alexa') {
            formData.append('text_from_voice', dataValue);
            console.log(`Enviando VOZ: "${dataValue}" a ${backendUrl} ${consoleIdent}`);
        } else {
            console.error('Tipo de comando no reconocido:', type, consoleIdent);
            if(systemResponseDisplay) systemResponseDisplay.textContent = 'Error interno.';
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
                    systemResponseDisplay.textContent = `Error PHP: ${result.error}`;
                } else {
                    systemResponseDisplay.textContent = result.message || 'Respuesta indefinida.';
                }
            }

            if (result.interpreted_action_key === 'salir') {
                console.log(`Comando 'salir' procesado. Deteniendo escucha. ${consoleIdent}`);
                if (isListening && recognition) { recognition.stop(); }
                if (statusDisplay) { statusDisplay.textContent = result.message || "Pausado."; }
            }

            if (type === 'voice_alexa') {
                wakeWordDetected = false; 
                console.log(`wakeWordDetected reseteado. ${consoleIdent}`);
                if (isListening && statusDisplay && result.interpreted_action_key !== 'salir') {
                    statusDisplay.textContent = 'Di "Alexa" seguido de tu comando...';
                }
            }
        } catch (error) {
            console.error(`Error en sendCommandToBackend: ${error.message} ${consoleIdent}`, error);
            if(systemResponseDisplay) systemResponseDisplay.textContent = `Error conexión/resp backend: ${error.message}`;
            if (type === 'voice_alexa') {
                wakeWordDetected = false;
            }
        }
    }
});