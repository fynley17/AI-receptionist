<?php
require __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Get environment variables
$host = $_ENV['DB_HOST'];
$name = $_ENV['DB_NAME'];
$user = $_ENV['DB_USER'];
$password = $_ENV['DB_PASS'];

try {
    $dsn = "mysql:host=$host;dbname=$name";
    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Log successful connection (remove echo statements)
    error_log("Connection successful");
} catch (PDOException $e) {
    // Log connection failure (remove echo statements)
    error_log("Connection failed: " . $e->getMessage());
}

// Return the PDO instance (no output before header)
return $pdo;
