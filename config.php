<?php
// config.php

// --- Clave de API de OpenAI ---
// ¡¡¡ USA TU NUEVA CLAVE REAL Y MANTENLA SEGURA !!!
// ¡¡¡ NO SUBAS ESTA CLAVE A UN REPOSITORIO PÚBLICO DE GITHUB !!!
define('OPENAI_API_KEY', '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'); // ★★★ REEMPLAZA ESTO ★★★

// --- Configuración de la Base de Datos AWS RDS ---
define('DB_SERVER', 'db-iot.c7cqsswu67fm.us-east-1.rds.amazonaws.com'); // ★★★ REEMPLAZA con tu Endpoint de RDS ★★★
define('DB_USERNAME', 'admin');      // Tu nombre de usuario maestro de RDS
define('DB_PASSWORD', 'Admin12345#!');  // Tu contraseña maestra de RDS (¡cámbiala si es esta!)
define('DB_DATABASE', 'db-iot');    // Nombre de tu base de datos
define('DB_PORT', '3306');          // Puerto MySQL, usualmente 3306

?>