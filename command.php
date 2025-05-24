<?php
// command.php
header('Content-Type: application/json');
require_once 'config.php'; // Contiene OPENAI_API_KEY y credenciales de DB

// --- Conexión a la Base de Datos ---
$conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);

if ($conn->connect_error) {
    error_log("Error de conexión a BD: " . $conn->connect_error);
    echo json_encode([
        'error' => 'Error interno del servidor (conexión BD).',
        'message' => 'Error: No se pudo conectar a la base de datos.'
    ]);
    exit;
}
if (!$conn->set_charset("utf8mb4")) {
    error_log("Error al establecer el charset utf8mb4: " . $conn->error);
}
// --- Fin Conexión a la Base de Datos ---

// --- Definición de Respuestas Simples para el Usuario y el Status en BD ---
$simple_status_responses = [
    "avanzar"         => "Avanzando...",
    "detener"         => "Detenido.",
    "retroceder"      => "Retrocediendo...",
    "girarizquierda"  => "Girando a la izquierda...",
    "girarderecha"    => "Girando a la derecha...",
    "salir"           => "Aplicación en pausa. Presiona 'Empezar a Escuchar' para reactivar.", // NUEVA RESPUESTA
    "keyword_missing" => "Por favor, di 'Alexa' primero.",
    "unknown_command" => "Comando no reconocido por el sistema.",
    "chatgpt_error"   => "Error al procesar el comando con IA. Intenta de nuevo.",
    "none"            => "No se identificó un comando claro.",
    "internal_error"  => "Error interno del servidor."
];
// --- Fin Definición de Respuestas Simples ---

$action_key_for_response = "internal_error";
$name_to_log = "N/A";
$received_input_type = "N/A";
$raw_input_for_debug = "N/A";
$chatgpt_raw_response_for_debug = null;
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

// --- Función para interpretar comando con ChatGPT ---
function interpret_command_with_chatgpt($text_to_interpret) {
    global $chatgpt_raw_response_for_debug;

    if (empty(OPENAI_API_KEY) || OPENAI_API_KEY === 'sk-TU_NUEVA_API_KEY_DE_OPENAI_AQUI' || strpos(OPENAI_API_KEY, 'sk-xxxxxxxxxx') === 0 || strlen(OPENAI_API_KEY) < 20) {
        error_log("OpenAI API Key no configurada o es placeholder en config.php. Por favor, verifica.");
        return "chatgpt_error";
    }

    $api_key = OPENAI_API_KEY;
    $url = 'https://api.openai.com/v1/chat/completions';
    
    $prompt_message = "Analiza la siguiente frase del usuario y determina cuál de estos comandos específicos quiere ejecutar: avanzar, detener, retroceder, girarIzquierda, girarDerecha, salir. Responde ÚNICAMENTE con una sola palabra del comando identificado (ej. 'avanzar', 'detener', 'salir', etc.) tal cual está escrito. Si la intención no es clara o no corresponde a ninguno de los comandos, responde exactamente con la palabra 'None'. Frase del usuario: \"$text_to_interpret\"";

    $data = [
        'model' => 'gpt-3.5-turbo',
        'messages' => [
            ['role' => 'system', 'content' => 'Eres un asistente que extrae uno de los siguientes comandos específicos: avanzar, detener, retroceder, girarIzquierda, girarDerecha, salir, o la palabra None, del texto proporcionado por el usuario. Responde solo con la palabra clave exacta.'],
            ['role' => 'user', 'content' => $prompt_message]
        ],
        'temperature' => 0.1,
        'max_tokens' => 15
    ];

    $options = [
        'http' => [
            'header' => "Content-Type: application/json\r\n" .
                        "Authorization: Bearer $api_key\r\n",
            'method' => 'POST',
            'content' => json_encode($data),
            'ignore_errors' => true
        ]
    ];

    $context = stream_context_create($options);
    $response_body = @file_get_contents($url, false, $context);

    if ($response_body === false) {
        $last_error = error_get_last();
        error_log("Error en file_get_contents al llamar a OpenAI: " . ($last_error['message'] ?? "Error desconocido"));
        return "chatgpt_error";
    }
    
    $chatgpt_raw_response_for_debug = $response_body;
    $response_data_from_api = json_decode($response_body, true);

    if (isset($response_data_from_api['error'])) {
        error_log("ChatGPT API Error: " . ($response_data_from_api['error']['message'] ?? json_encode($response_data_from_api['error'])));
        return "chatgpt_error";
    }
    
    if (isset($response_data_from_api['choices'][0]['message']['content'])) {
        $extracted_command_raw = trim($response_data_from_api['choices'][0]['message']['content']);
        $extracted_command = strtolower($extracted_command_raw);
        // Limpieza más específica para asegurar que no queden puntos o caracteres extraños
        $extracted_command = preg_replace('/[^a-z0-9]/i', '', $extracted_command); // Deja solo letras y números (por si acaso)

        $valid_chatgpt_responses = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir", "none"];
        if (in_array($extracted_command, $valid_chatgpt_responses, true)) {
            return $extracted_command;
        }
        error_log("ChatGPT devolvió un comando inesperado después de limpiar: '" . $extracted_command . "'. Respuesta cruda: " . $response_body);
        return "unknown_command";
    }
    
    error_log("ChatGPT API: No se pudo extraer contenido del mensaje. Respuesta cruda: " . $response_body);
    return "chatgpt_error";
}
// --- Fin de la función ---


// --- Lógica Principal para Manejar Comandos ---
if (isset($_POST['command'])) { // Comando de Botón
    $posted_command = strtolower(trim($_POST['command']));
    $action_key_from_button = str_replace(' ', '', $posted_command); 
    
    $received_input_type = "button";
    $raw_input_for_debug = $posted_command;
    $name_to_log = $posted_command;

    if (array_key_exists($action_key_from_button, $simple_status_responses)) {
        $action_key_for_response = $action_key_from_button;
    } else {
        $action_key_for_response = "unknown";
    }

} elseif (isset($_POST['text_from_voice'])) { // Comando de Voz
    $voice_text_full = trim($_POST['text_from_voice']);
    $received_input_type = "voice";
    $raw_input_for_debug = $voice_text_full;

    if (stripos($voice_text_full, "alexa") === 0) {
        $command_part_after_alexa = trim(substr($voice_text_full, strlen("alexa")));
        $name_to_log = $command_part_after_alexa; 

        if (empty($command_part_after_alexa)) {
            $action_key_for_response = "unknown_command";
            $name_to_log = "alexa (sin comando)";
        } else {
            $interpreted_action = interpret_command_with_chatgpt($command_part_after_alexa);
            $action_key_for_response = $interpreted_action;
        }
    } else {
        $action_key_for_response = "keyword_missing";
        $name_to_log = $voice_text_full;
    }
} else {
    if ($conn) $conn->close(); // Cerrar conexión si la petición es inválida
    echo json_encode(['error' => 'Petición inválida.', 'message' => 'No se recibió información de comando.']);
    exit;
}
// --- Fin Lógica Principal ---

$status_message_for_db_and_user = $simple_status_responses[$action_key_for_response] ?? $simple_status_responses['internal_error'];

// --- Guardar en Base de Datos (CONDICIONAL) ---
$valid_executable_actions = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir"];

if (in_array($action_key_for_response, $valid_executable_actions, true)) {
    $stmt = $conn->prepare("CALL AddDeviceStatus(?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("sss", $name_to_log, $client_ip_address, $status_message_for_db_and_user);
        if (!$stmt->execute()) {
            error_log("Error al ejecutar Stored Procedure AddDeviceStatus: " . $stmt->error);
        }
        $stmt->close();
    } else {
        error_log("Error al preparar Stored Procedure AddDeviceStatus: " . $conn->error);
    }
} else {
    error_log("Comando NO guardado en BD. Clave de acción: '" . $action_key_for_response . "'. Input: '" . $raw_input_for_debug . "'");
}
// --- Fin Guardar en Base de Datos ---

if ($conn) $conn->close(); // Cerrar la conexión a la base de datos en todos los casos antes de enviar la respuesta.

// --- Preparar y Enviar Respuesta JSON ---
$response_data_to_send = [
    'message' => $status_message_for_db_and_user,
    'received_input_type' => $received_input_type,
    'raw_input_for_debug' => $raw_input_for_debug,
    'interpreted_action_key' => $action_key_for_response,
    'logged_name' => (in_array($action_key_for_response, $valid_executable_actions, true)) ? $name_to_log : "N/A (no guardado)",
    'client_ip_logged' => $client_ip_address,
    'chatgpt_raw_response' => json_decode($chatgpt_raw_response_for_debug)
];

echo json_encode($response_data_to_send);
?>