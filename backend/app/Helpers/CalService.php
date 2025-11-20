<?php
class CalService
{
    private $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }

    /**
     * Create a booking on Cal.com
     *
     * @param array $payload JSON-serializable payload expected by Cal.com
     * @return array ['http_code'=>int, 'body'=>array|string]
     */
    public function createBooking(array $payload): array
    {
        $url = 'https://api.cal.com/v1/bookings';

        $ch = curl_init($url);
        $json = json_encode($payload);

        // Collect response headers
        $responseHeaders = [];
        curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($curl, $header) use (&$responseHeaders) {
            $len = strlen($header);
            $header = trim($header);
            if ($header === '') return $len;
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) {
                $responseHeaders[trim($parts[0])] = trim($parts[1]);
            }
            return $len;
        });

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
        ]);

        // capture verbose output (useful if you enable it locally)
        $verboseStream = fopen('php://temp', 'w+');
        curl_setopt($ch, CURLOPT_VERBOSE, true);
        curl_setopt($ch, CURLOPT_STDERR, $verboseStream);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrNo = curl_errno($ch);
        $curlErr = curl_error($ch);
        rewind($verboseStream);
        $verboseLog = stream_get_contents($verboseStream);
        fclose($verboseStream);

        curl_close($ch);

        $decoded = null;
        if (is_string($body)) {
            $decoded = json_decode($body, true);
        }

        return [
            'http_code' => $httpCode,
            'request' => [
                'url' => $url,
                'body' => $payload,
                'json' => $json,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer [REDACTED]'
                ]
            ],
            'response' => [
                'headers' => $responseHeaders,
                'body' => $decoded ?? $body
            ],
            'curl' => [
                'errno' => $curlErrNo,
                'error' => $curlErr,
                'verbose' => $verboseLog
            ]
        ];
    }
}

return true;
