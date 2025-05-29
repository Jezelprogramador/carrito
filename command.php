<?php
// command.php (Versión completa final)

// --- INICIO DE CONFIGURACIÓN CORS ---
$allowed_origin = 'https://jezelprogramador.github.io';
header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(204);
    exit(0);
}
// --- FIN DE CONFIGURACIÓN CORS ---

header('Content-Type: application/json');
require_once 'config.php';

$valid_executable_actions = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir", "girar_derecha_90", "girar_izquierda_90", "girar_derecha_360", "girar_izquierda_360"];
$simple_status_responses = [
    "avanzar" => "Avanzando...", "detener" => "Detenido.", "retroceder" => "Retrocediendo...",
    "girarizquierda" => "Girando a la izquierda (continuo)...", "girarderecha" => "Girando a la derecha (continuo)...",
    "salir" => "Aplicación en pausa.", "girar_derecha_90" => "Girando 90° derecha...", "girar_izquierda_90" => "Girando 90° izquierda...",
    "girar_derecha_360" => "Girando 360° derecha...", "girar_izquierda_360" => "Girando 360° izquierda...",
    "keyword_missing" => "Di 'Alexa' primero.", "unknown_command" => "Comando no reconocido.",
    "chatgpt_error" => "Error con IA.", "none" => "No se identificó comando.", "internal_error" => "Error interno."
];

$conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);
if ($conn->connect_error) { error_log("BD Error: " . $conn->connect_error); echo json_encode(['error' => 'Error BD.', 'message' => $simple_status_responses['internal_error']]); exit; }
if (!$conn->set_charset("utf8mb4")) { error_log("Charset Error: " . $conn->error); }

$action_key_for_response = "internal_error"; $name_to_log = "N/A"; $received_input_type = "N/A";
$raw_input_for_debug = "N/A"; $chatgpt_raw_response_for_debug = null; $client_ip_address = "N/A";

if (!empty($_SERVER['HTTP_CLIENT_IP'])) { $client_ip_address = $_SERVER['HTTP_CLIENT_IP']; }
elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) { $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']); $client_ip_address = trim($ips[0]); }
elseif (!empty($_SERVER['REMOTE_ADDR'])) { $client_ip_address = $_SERVER['REMOTE_ADDR']; }

function interpret_command_with_chatgpt($text_to_interpret) {
    global $chatgpt_raw_response_for_debug;
    error_log("DEBUG_CHATGPT: Texto: '" . $text_to_interpret . "'");
    if (empty(OPENAI_API_KEY) || strpos(OPENAI_API_KEY, 'sk-TU_API_KEY') === 0 || strlen(OPENAI_API_KEY) < 30) { error_log("DEBUG_CHATGPT: API Key Inválida/Placeholder"); return "chatgpt_error"; }
    error_log("DEBUG_CHATGPT: API Key OK.");
    $api_key = OPENAI_API_KEY; $url = 'https://api.openai.com/v1/chat/completions';
    $prompt_message = "Comandos: avanzar, detener, retroceder, girarIzquierda, girarDerecha, salir, girar_derecha_90, girar_izquierda_90, girar_derecha_360, girar_izquierda_360. Extrae SOLO UNO de estos o 'None'. Frase: \"$text_to_interpret\"";
    $data = ['model' => 'gpt-3.5-turbo', 'messages' => [['role' => 'system', 'content' => "Extraes una palabra clave de comando o 'None'. Formato: palabra_clave_o_None."], ['role' => 'user', 'content' => $prompt_message]], 'temperature' => 0.1, 'max_tokens' => 30];
    $options = ['http' => ['header' => "Content-Type: application/json\r\nAuthorization: Bearer $api_key\r\n", 'method' => 'POST', 'content' => json_encode($data), 'ignore_errors' => true, 'timeout' => 20]];
    $context = stream_context_create($options);
    error_log("DEBUG_CHATGPT: Intentando file_get_contents a: " . $url);
    $response_body = @file_get_contents($url, false, $context);
    $chatgpt_raw_response_for_debug = $response_body;
    if ($response_body === false) { $last_error = error_get_last(); error_log("DEBUG_CHATGPT: file_get_contents falló. Error: " . ($last_error['message'] ?? "Error desconocido.")); return "chatgpt_error"; }
    error_log("DEBUG_CHATGPT: file_get_contents OK. Raw(500): " . substr($response_body, 0, 500));
    $response_data_from_api = json_decode($response_body, true);
    if (json_last_error() !== JSON_ERROR_NONE) { error_log("DEBUG_CHATGPT: Error JSON: ".json_last_error_msg().". Raw: ".$response_body); return "chatgpt_error"; }
    error_log("DEBUG_CHATGPT: JSON decodificado.");
    if (isset($response_data_from_api['error'])) { error_log("DEBUG_CHATGPT: OpenAI API Error: ".($response_data_from_api['error']['message'] ?? json_encode($response_data_from_api['error']))); return "chatgpt_error"; }
    if (isset($response_data_from_api['choices'][0]['message']['content'])) {
        $extracted_command_raw = trim($response_data_from_api['choices'][0]['message']['content']);
        $extracted_command = strtolower($extracted_command_raw);
        $extracted_command = preg_replace('/[^a-z0-9_]/i', '', $extracted_command); // Permite guiones bajos
        error_log("DEBUG_CHATGPT: Extraído(crudo): '" . $extracted_command_raw . "'. Limpio: '" . $extracted_command . "'");
        $valid_chatgpt_keywords = ["avanzar", "detener", "retroceder", "girarizquierda", "girarderecha", "salir", "girar_derecha_90", "girar_izquierda_90", "girar_derecha_360", "girar_izquierda_360", "none"];
        if (in_array($extracted_command, $valid_chatgpt_keywords, true)) { error_log("DEBUG_CHATGPT: Extraído válido: '" . $extracted_command . "'"); return $extracted_command; }
        error_log("DEBUG_CHATGPT: Extraído ('" . $extracted_command . "') NO es keyword. OpenAI Raw: " . $response_body); return "unknown_command";
    }
    error_log("DEBUG_CHATGPT: No 'choices[0][message][content]'. OpenAI Raw: " . $response_body); return "chatgpt_error";
}

if (isset($_POST['command'])) {
    $posted_command = strtolower(trim($_POST['command']));
    $action_key_from_button = str_replace(' ', '', $posted_command);
    $action_key_from_button = preg_replace('/[^a-z0-9_]/i', '', $action_key_from_button);
    $received_input_type = "button"; $raw_input_for_debug = $posted_command;
    if (in_array($action_key_from_button, $valid_executable_actions, true)) { $name_to_log = $action_key_from_button; $action_key_for_response = $action_key_from_button; }
    else { $name_to_log = $posted_command; $action_key_for_response = "unknown"; }
} elseif (isset($_POST['text_from_voice'])) {
    $voice_text_full = trim($_POST['text_from_voice']);
    $received_input_type = "voice"; $raw_input_for_debug = $voice_text_full;
    error_log("PHP_LOG: Recibido por voz: '" . $raw_input_for_debug . "'");
    if (stripos($voice_text_full, "alexa") === 0) {
        $command_part_after_alexa_raw = trim(substr($voice_text_full, strlen("alexa")));
        $cleaned_command_text_from_user = strtolower($command_part_after_alexa_raw);
        $cleaned_command_text_from_user = rtrim($cleaned_command_text_from_user, ".?!,;:");
        $cleaned_command_text_from_user = trim($cleaned_command_text_from_user);
        error_log("PHP_LOG: Texto para ChatGPT: '" . $cleaned_command_text_from_user . "'");
        if (empty($cleaned_command_text_from_user)) { $action_key_for_response = "unknown_command"; $name_to_log = "alexa (sin comando)"; }
        else {
            $interpreted_action = interpret_command_with_chatgpt($cleaned_command_text_from_user);
            $action_key_for_response = $interpreted_action;
            error_log("PHP_LOG: Interpretado por ChatGPT: '" . $interpreted_action . "'");
            if (in_array($interpreted_action, $valid_executable_actions, true)) { $name_to_log = $interpreted_action; }
            else { $name_to_log = $cleaned_command_text_from_user; }
        }
    } else { $action_key_for_response = "keyword_missing"; $name_to_log = $voice_text_full; error_log("PHP_LOG: 'alexa' no encontrada en: '" . $voice_text_full . "'"); }
} else {
    if ($conn) $conn->close();
    echo json_encode(['error' => 'Petición inválida.', 'message' => $simple_status_responses['internal_error']]); exit;
}

$status_message_for_db_and_user = $simple_status_responses[$action_key_for_response] ?? $simple_status_responses['internal_error'];
error_log("PHP_LOG: Acción final: '" . $action_key_for_response . "'. Mensaje: '" . $status_message_for_db_and_user . "'. Name log: '" . $name_to_log . "'");

if (in_array($action_key_for_response, $valid_executable_actions, true)) {
    error_log("PHP_LOG: Guardando en BD. Name: '" . $name_to_log . "'");
    $stmt = $conn->prepare("CALL AddDeviceStatus(?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("sss", $name_to_log, $client_ip_address, $status_message_for_db_and_user);
        if (!$stmt->execute()) { error_log("PHP_LOG: Error SP: " . $stmt->error); }
        else { error_log("PHP_LOG: Guardado en BD OK."); }
        $stmt->close();
    } else { error_log("PHP_LOG: Error preparando SP: " . $conn->error); }
} else { error_log("PHP_LOG: NO guardado. Acción: '" . $action_key_for_response . "'"); }

if ($conn) $conn->close();

$response_data_to_send = [
    'message' => $status_message_for_db_and_user,
    'received_input_type' => $received_input_type,
    'raw_input_for_debug' => $raw_input_for_debug,
    'interpreted_action_key' => $action_key_for_response,
    'logged_name' => (in_array($action_key_for_response, $valid_executable_actions, true)) ? $name_to_log : $name_to_log . " (no guardado)",
    'client_ip_logged' => $client_ip_address,
    'chatgpt_raw_response' => json_decode($chatgpt_raw_response_for_debug)
];
echo json_encode($response_data_to_send);
?>