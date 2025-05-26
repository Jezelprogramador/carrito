<?php
// command.php
// Versión completa final con CORS, depuración exhaustiva y toda la lógica.

// --- INICIO DE CONFIGURACIÓN CORS ---
// Origen para tu página de GitHub Pages
// Reemplaza 'Jezelprogramador' si tu nombre de usuario de GitHub es diferente.
$github_pages_origin = 'https://Jezelprogramador.github.io'; 

header('Access-Control-Allow-Origin: ' . $github_pages_origin);
header('Access-Control-Allow-Methods: POST, OPTIONS'); // Métodos permitidos
header('Access-Control-Allow-Headers: Content-Type');    // Cabeceras permitidas en la petición

// Manejar petición OPTIONS (pre-vuelo CORS)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200); // Responde OK a la petición OPTIONS
    exit(0);
}
// --- FIN DE CONFIGURACIÓN CORS ---

header('Content-Type: application/json'); // Tu cabecera de contenido normal
require_once 'config.php'; // Contiene OPENAI_API_KEY y credenciales de DB

// --- Definición de Acciones Válidas para el Carro y la App ---
// Estas son las acciones que, si son interpretadas, se considerarán válidas para ejecutar y LOGUEAR con su nombre clave.
$valid_executable_actions = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir"];

// --- Definición de Respuestas Simples para el Usuario y el Status en BD ---
$simple_status_responses = [
    "avanzar"         => "Avanzando...",
    "detener"         => "Detenido.",
    "retroceder"      => "Retrocediendo...",
    "girarizquierda"  => "Girando a la izquierda...",
    "girarderecha"    => "Girando a la derecha...",
    "salir"           => "Aplicación en pausa. Presiona 'Empezar a Escuchar' para reactivar.",
    "keyword_missing" => "Por favor, di 'Alexa' primero.",
    "unknown_command" => "Comando no reconocido por el sistema.",
    "chatgpt_error"   => "Error al procesar el comando con IA. Intenta de nuevo.",
    "none"            => "No se identificó un comando claro.", // Cuando ChatGPT devuelve "None"
    "internal_error"  => "Error interno del servidor."
];
// --- Fin Definición de Respuestas ---

// --- Conexión a la Base de Datos ---
$conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);

if ($conn->connect_error) {
    error_log("Error de conexión a BD: " . $conn->connect_error);
    echo json_encode([
        'error' => 'Error interno del servidor (conexión BD).',
        'message' => $simple_status_responses['internal_error']
    ]);
    exit;
}
if (!$conn->set_charset("utf8mb4")) {
    error_log("Error al establecer el charset utf8mb4: " . $conn->error);
}
// --- Fin Conexión a la Base de Datos ---

$action_key_for_response = "internal_error"; // Clave para buscar en $simple_status_responses
$name_to_log = "N/A"; // Lo que se guardará en el campo 'name' de la BD
$received_input_type = "N/A";
$raw_input_for_debug = "N/A"; // El input original para depuración
$chatgpt_raw_response_for_debug = null; // Asegurar que esté inicializada
$client_ip_address = "N/A";

// --- Obtener IP del Cliente Web ---
if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
    $client_ip_address = $_SERVER['HTTP_CLIENT_IP'];
} elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    $client_ip_address = trim($ips[0]);
} elseif (!empty($_SERVER['REMOTE_ADDR'])) {
    $client_ip_address = $_SERVER['REMOTE_ADDR'];
}
// --- Fin Obtener IP del Cliente Web ---

// --- Función para interpretar comando con ChatGPT (CON DEPURACIÓN EXTENSIVA) ---
function interpret_command_with_chatgpt($text_to_interpret) {
    global $chatgpt_raw_response_for_debug; // Para almacenar la respuesta cruda para el JSON final

    error_log("DEBUG_CHATGPT: Iniciando interpret_command_with_chatgpt con texto: '" . $text_to_interpret . "'");

    // Verificar API Key (más robusto)
    if (empty(OPENAI_API_KEY) || OPENAI_API_KEY === 'sk-TU_NUEVA_API_KEY_DE_OPENAI_AQUI' || strpos(OPENAI_API_KEY, 'sk-xxxxxxxxxx') === 0 || strlen(OPENAI_API_KEY) < 30) { // Ajusta la longitud mínima si es necesario
        error_log("DEBUG_CHATGPT: OpenAI API Key no configurada, es un placeholder, o es demasiado corta en config.php. Verifica la configuración. Longitud actual: " . strlen(OPENAI_API_KEY));
        return "chatgpt_error";
    }
    error_log("DEBUG_CHATGPT: API Key parece estar configurada y con longitud adecuada.");

    $api_key = OPENAI_API_KEY;
    $url = 'https://api.openai.com/v1/chat/completions';
    
    $prompt_message = "Analiza la siguiente frase del usuario y determina cuál de estos comandos específicos quiere ejecutar: avanzar, detener, retroceder, girarIzquierda, girarDerecha, salir. Responde ÚNICAMENTE con una sola palabra del comando identificado (ej. 'avanzar', 'detener', 'salir', 'girarIzquierda') tal cual está escrito y en minúsculas. Si la intención no es clara o no corresponde a ninguno de los comandos, responde exactamente con la palabra 'None'. Frase del usuario: \"$text_to_interpret\"";

    $data = [
        'model' => 'gpt-3.5-turbo',
        'messages' => [
            ['role' => 'system', 'content' => 'Eres un asistente que extrae uno de los siguientes comandos específicos: avanzar, detener, retroceder, girarIzquierda, girarDerecha, salir, o la palabra None, del texto proporcionado por el usuario. Responde solo con la palabra clave exacta en minúsculas.'],
            ['role' => 'user', 'content' => $prompt_message]
        ],
        'temperature' => 0.1,
        'max_tokens' => 20 
    ];

    $options = [
        'http' => [
            'header' => "Content-Type: application/json\r\n" .
                        "Authorization: Bearer $api_key\r\n",
            'method' => 'POST',
            'content' => json_encode($data),
            'ignore_errors' => true, 
            'timeout' => 20 
        ]
    ];

    $context = stream_context_create($options);
    error_log("DEBUG_CHATGPT: Contexto HTTP creado. Intentando file_get_contents a: " . $url);

    $response_body = @file_get_contents($url, false, $context); 
    $chatgpt_raw_response_for_debug = $response_body; 

    if ($response_body === false) {
        $last_error = error_get_last(); 
        error_log("DEBUG_CHATGPT: file_get_contents falló al intentar contactar OpenAI. Error: " . ($last_error['message'] ?? "Error desconocido o suprimido por @. Verifica conectividad del servidor, firewall, configuración SSL de PHP."));
        return "chatgpt_error";
    }
    
    error_log("DEBUG_CHATGPT: file_get_contents tuvo éxito. Longitud de respuesta cruda: " . strlen($response_body) . " bytes. Respuesta cruda (primeros 500 chars): " . substr($response_body, 0, 500));
    
    $response_data_from_api = json_decode($response_body, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("DEBUG_CHATGPT: Error al decodificar JSON de la respuesta de OpenAI. Error JSON: " . json_last_error_msg() . ". Respuesta cruda recibida: " . $response_body);
        return "chatgpt_error";
    }
    error_log("DEBUG_CHATGPT: JSON decodificado exitosamente.");
    
    if (isset($response_data_from_api['error'])) {
        error_log("DEBUG_CHATGPT: OpenAI API devolvió un error explícito. Mensaje: " . ($response_data_from_api['error']['message'] ?? json_encode($response_data_from_api['error'])));
        return "chatgpt_error";
    }
    
    if (isset($response_data_from_api['choices'][0]['message']['content'])) {
        $extracted_command_raw = trim($response_data_from_api['choices'][0]['message']['content']);
        $extracted_command = strtolower($extracted_command_raw);
        $extracted_command = preg_replace('/[^a-z]/i', '', $extracted_command); // Deja solo letras (para girarizquierda, etc.)

        error_log("DEBUG_CHATGPT: Comando extraído de 'choices' (crudo): '" . $extracted_command_raw . "'. Limpiado: '" . $extracted_command . "'");
        
        $valid_chatgpt_keywords = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir", "none"];
        if (in_array($extracted_command, $valid_chatgpt_keywords, true)) {
            error_log("DEBUG_CHATGPT: Comando extraído es válido y reconocido por ChatGPT: '" . $extracted_command . "'");
            return $extracted_command; 
        }
        error_log("DEBUG_CHATGPT: Comando extraído de ChatGPT ('" . $extracted_command . "') NO está en la lista de keywords esperadas. Respuesta cruda OpenAI: " . $response_body);
        return "unknown_command";
    }
    
    error_log("DEBUG_CHATGPT: No se encontró 'choices[0][message][content]' en la respuesta de OpenAI. Estructura inesperada. Respuesta cruda OpenAI: " . $response_body);
    return "chatgpt_error";
}
// --- Fin de la función ---


// --- Lógica Principal para Manejar Comandos ---
if (isset($_POST['command'])) { // Comando de Botón
    $posted_command = strtolower(trim($_POST['command']));
    // Normalizar el comando del botón (ej. "girarIzquierda" a "girarizquierda")
    $action_key_from_button = str_replace(' ', '', $posted_command); 
    $action_key_from_button = preg_replace('/[^a-z]/i', '', $action_key_from_button); // Solo letras
    
    $received_input_type = "button";
    $raw_input_for_debug = $posted_command; // El comando original del botón
    
    // Para botones, el nombre a loguear es la acción misma si es válida
    if (in_array($action_key_from_button, $valid_executable_actions, true)) {
        $name_to_log = $action_key_from_button;
        $action_key_for_response = $action_key_from_button;
    } else {
        $name_to_log = $posted_command; // Loguear lo que vino si no es ejecutable
        $action_key_for_response = "unknown";
    }

} elseif (isset($_POST['text_from_voice'])) { // Comando de Voz
    $voice_text_full = trim($_POST['text_from_voice']);
    $received_input_type = "voice";
    $raw_input_for_debug = $voice_text_full; // Input original para depuración

    error_log("PHP_LOG: Recibido por voz (raw_input_for_debug): '" . $raw_input_for_debug . "'");

    if (stripos($voice_text_full, "alexa") === 0) {
        $command_part_after_alexa_raw = trim(substr($voice_text_full, strlen("alexa")));
        
        // Limpiar el texto del usuario antes de enviarlo a ChatGPT y usarlo como log inicial
        $cleaned_command_text_from_user = strtolower($command_part_after_alexa_raw);
        $cleaned_command_text_from_user = rtrim($cleaned_command_text_from_user, ".?!,;:"); // Quita puntuación final
        $cleaned_command_text_from_user = trim($cleaned_command_text_from_user); // Quita espacios de nuevo
        error_log("PHP_LOG: Texto limpiado para ChatGPT: '" . $cleaned_command_text_from_user . "'");

        if (empty($cleaned_command_text_from_user)) {
            $action_key_for_response = "unknown_command";
            $name_to_log = "alexa (sin comando)"; 
        } else {
            // Usar $cleaned_command_text_from_user para enviar a ChatGPT
            $interpreted_action = interpret_command_with_chatgpt($cleaned_command_text_from_user); 
            $action_key_for_response = $interpreted_action; // Esto será "avanzar", "none", "chatgpt_error", etc.
            error_log("PHP_LOG: Acción interpretada por ChatGPT: '" . $interpreted_action . "'");

            // Si ChatGPT interpreta una acción ejecutable, ese será el 'name_to_log'.
            // Si no, se loguea lo que el usuario dijo (limpio), pero no se guardará en BD si no es ejecutable.
            if (in_array($interpreted_action, $valid_executable_actions, true)) {
                $name_to_log = $interpreted_action;
            } else {
                $name_to_log = $cleaned_command_text_from_user; // Lo que el usuario dijo (limpio)
            }
        }
    } else { // "alexa" keyword was missing
        $action_key_for_response = "keyword_missing";
        $name_to_log = $voice_text_full; // Loguear el texto completo
        error_log("PHP_LOG: Palabra clave 'alexa' no encontrada en: '" . $voice_text_full . "'");
    }
} else {
    if ($conn) $conn->close();
    echo json_encode(['error' => 'Petición inválida.', 'message' => $simple_status_responses['internal_error']]);
    exit;
}
// --- Fin Lógica Principal ---

$status_message_for_db_and_user = $simple_status_responses[$action_key_for_response] ?? $simple_status_responses['internal_error'];
error_log("PHP_LOG: Clave de acción final: '" . $action_key_for_response . "'. Mensaje para usuario/DB: '" . $status_message_for_db_and_user . "'. Nombre para log: '" . $name_to_log . "'");

// --- Guardar en Base de Datos (CONDICIONAL) ---
// $valid_executable_actions ya está definido arriba
if (in_array($action_key_for_response, $valid_executable_actions, true)) {
    error_log("PHP_LOG: Comando VALIDADO para guardar en BD. Name: '" . $name_to_log . "', IP: '" . $client_ip_address . "', Status: '" . $status_message_for_db_and_user . "'");
    $stmt = $conn->prepare("CALL AddDeviceStatus(?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("sss", $name_to_log, $client_ip_address, $status_message_for_db_and_user);
        if (!$stmt->execute()) {
            error_log("PHP_LOG: Error al ejecutar Stored Procedure AddDeviceStatus: " . $stmt->error);
        } else {
            error_log("PHP_LOG: Comando guardado en BD exitosamente.");
        }
        $stmt->close();
    } else {
        error_log("PHP_LOG: Error al preparar Stored Procedure AddDeviceStatus: " . $conn->error);
    }
} else {
    error_log("PHP_LOG: Comando NO guardado en BD. Clave de acción: '" . $action_key_for_response . "'. Input original: '" . $raw_input_for_debug . "'.");
}
// --- Fin Guardar en Base de Datos ---

if ($conn) $conn->close(); // Cerrar la conexión a la base de datos en todos los casos antes de enviar la respuesta.

// --- Preparar y Enviar Respuesta JSON ---
$response_data_to_send = [
    'message' => $status_message_for_db_and_user,
    'received_input_type' => $received_input_type,
    'raw_input_for_debug' => $raw_input_for_debug,
    'interpreted_action_key' => $action_key_for_response, // La clave final interpretada
    'logged_name' => (in_array($action_key_for_response, $valid_executable_actions, true)) ? $name_to_log : $name_to_log . " (no guardado)",
    'client_ip_logged' => $client_ip_address,
    'chatgpt_raw_response' => json_decode($chatgpt_raw_response_for_debug) // Decodificar si es un string JSON
];

echo json_encode($response_data_to_send);
?>