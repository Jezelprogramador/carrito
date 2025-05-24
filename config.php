<?php
// config.php

// --- Clave de API de OpenAI ---
// ¡¡¡ ASEGÚRATE DE USAR TU NUEVA CLAVE REAL Y MANTENERLA SEGURA !!!
define('OPENAI_API_KEY', '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');

// --- Configuración de la Base de Datos AWS RDS ---
define('DB_SERVER', 'db-iot.c7cqsswu67fm.us-east-1.rds.amazonaws.com'); // ★ REEMPLAZA con tu Endpoint de RDS ★
define('DB_USERNAME', 'admin');      // Tu nombre de usuario maestro de RDS
define('DB_PASSWORD', 'Admin12345#!');  // Tu contraseña maestra de RDS
define('DB_DATABASE', 'db-iot');    // Nombre de tu base de datos (con backticks por el guion)
define('DB_PORT', '3306');          // Puerto MySQL, usualmente 3306

?>