<?php
// get_car_action.php
require_once 'config.php';
header('Content-Type: text/plain');

$conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);
if ($conn->connect_error) {
    error_log("get_car_action.php - DB Connection Error: " . $conn->connect_error);
    echo "detener";
    exit;
}
if (!$conn->set_charset("utf8mb4")) {
    error_log("get_car_action.php - Error charset: " . $conn->error);
}

$car_executable_commands = [
    'avanzar', 'detener', 'retroceder', 
    'girarizquierda', 'girarderecha',
    'girar_derecha_90', 'girar_izquierda_90',
    'girar_derecha_360', 'girar_izquierda_360',
    'avanzar_derecha', 'avanzar_izquierda',
    'retroceder_derecha', 'retroceder_izquierda'
];
$car_executable_commands_sql_in = "'" . implode("','", $car_executable_commands) . "'";
$sql = "SELECT name FROM iot_devices 
        WHERE name IN ($car_executable_commands_sql_in)
        ORDER BY date DESC 
        LIMIT 1";
$last_action_for_car = "detener";

if ($result = $conn->query($sql)) {
    if ($row = $result->fetch_assoc()) {
        $last_action_for_car = $row['name'];
    }
    $result->free();
} else {
    error_log("get_car_action.php - DB Query Error: " . $conn->error);
}

if ($conn) $conn->close();
echo trim(strtolower($last_action_for_car));
?>