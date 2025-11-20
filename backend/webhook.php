<?php
// Simple webhook endpoint for Retell AI -> Cal.com booking
// Loads DB from `config.php` (returns PDO).

header('Content-Type: application/json');

// Simple logger utility (append-only)
function log_webhook(string $level, $message)
{
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $file = $dir . '/webhook.log';
    $entry = [
        'time' => date('c'),
        'level' => $level,
        'message' => $message
    ];
    @file_put_contents($file, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// Load DB
$pdo = require __DIR__ . '/config.php';

// Read JSON input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    log_webhook('error', 'Invalid JSON payload');
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

log_webhook('info', ['incoming' => $data]);

// Verify HMAC signature if configured
$secret = $_ENV['WEBHOOK_SECRET'] ?? null;
$sigHeader = $_SERVER['HTTP_X_RETELL_SIGNATURE'] ?? $_SERVER['HTTP_X_HUB_SIGNATURE'] ?? null;
if ($secret) {
    $expected = hash_hmac('sha256', $input, $secret);
    if (!hash_equals($expected, $sigHeader ?? '')) {
        log_webhook('warning', 'Invalid signature');
        http_response_code(401);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
    log_webhook('info', 'Signature verified');
} else {
    log_webhook('warning', 'WEBHOOK_SECRET not set; skipping signature verification');
}

// Extract agent id
$agentId = $data['agentId'] ?? $data['agent_id'] ?? $data['agent'] ?? null;
if (!$agentId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing agentId']);
    exit;
}

// Lookup customer, cal settings by retell agent id
$sql = "SELECT c.id AS customer_id, c.customer_name, cs.cal_api_key, cs.timezone
        FROM agent_mappings am
        JOIN customers c ON am.customer_id = c.id
        JOIN cal_settings cs ON c.id = cs.customer_id
        WHERE am.retell_agent_id = :agentId
        LIMIT 1";
$stmt = $pdo->prepare($sql);
$stmt->execute(['agentId' => $agentId]);
$customer = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$customer) {
    log_webhook('error', 'Agent mapping not found for ' . $agentId);
    http_response_code(404);
    echo json_encode(['error' => 'Agent mapping not found']);
    exit;
}

// Determine event type id (from payload or customer_event_types table)
$eventTypeId = $data['event_type_id'] ?? $data['eventTypeId'] ?? $data['eventType'] ?? null;

if (!$eventTypeId) {
    // Try to find by provided code / name
    $possibleCode = $data['event_code'] ?? $data['eventCode'] ?? $data['event'] ?? null;
    if ($possibleCode) {
        // Try to find matching customer_event_types entry
        $sql2 = "SELECT event_type_id, id FROM customer_event_types WHERE customer_id = :cid AND (event_code = :code OR name = :code OR event_type_id = :code) LIMIT 1";
        $stmt2 = $pdo->prepare($sql2);
        $stmt2->execute(['cid' => $customer['customer_id'], 'code' => $possibleCode]);
        $evt = $stmt2->fetch(PDO::FETCH_ASSOC);
        if ($evt) {
            $eventTypeId = $evt['event_type_id'] ?? $evt['id'];
        }
    }
}

if (!$eventTypeId) {
    log_webhook('error', 'Missing or unknown event type id for agent ' . $agentId);
    http_response_code(400);
    echo json_encode(['error' => 'Missing or unknown event type id']);
    exit;
}

// Build booking payload for Cal.com
// If the caller provided a `booking` object, pass it through and attach event type.
$booking = $data['booking'] ?? $data;

// Ensure event type is included in commonly-named keys so Cal.com receives it.
if (is_array($booking)) {
    $booking['event_type_id'] = $eventTypeId;
    $booking['eventTypeId'] = $eventTypeId;
    $booking['eventType'] = $eventTypeId;
}

// Load CalService helper
require_once __DIR__ . '/app/Helpers/CalService.php';
// Avoid logging secrets
log_webhook('info', 'Found customer ' . $customer['customer_name'] . ' (id=' . $customer['customer_id'] . ')');
$cal = new CalService($customer['cal_api_key']);

// Optionally set timezone if provided in cal_settings
if (!empty($customer['timezone'])) {
    if (is_array($booking)) {
        $booking['timezone'] = $customer['timezone'];
    }
}

log_webhook('info', 'Sending booking to Cal.com',);
$result = $cal->createBooking(is_array($booking) ? $booking : ['data' => $booking]);
log_webhook('info', ['cal_result' => $result]);

// Pass through Cal.com response
if ($result['http_code'] >= 200 && $result['http_code'] < 300) {
    http_response_code(201);
    echo json_encode(['success' => true, 'cal_response' => $result['body']]);
    exit;
}

// Error
http_response_code(500);
echo json_encode(['error' => 'Cal.com booking failed', 'details' => $result]);
exit;
