<?php
// Simple front controller to route to endpoints like /webhook
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalize trailing slash
$uri = rtrim($uri, '/');

if ($uri === '' || $uri === '/') {
    echo "RetellCalDashboard backend. Available endpoints: /webhook\n";
    exit;
}

if ($uri === '/webhook') {
    // Include the webhook handler; it will output JSON and exit
    require __DIR__ . '/webhook.php';
    exit;
}

http_response_code(404);
header('Content-Type: text/plain');
echo "Not found\n";
exit;
