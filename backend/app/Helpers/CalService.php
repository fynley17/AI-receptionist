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

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
        ]);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['http_code' => 0, 'body' => $err];
        }

        $decoded = json_decode($body, true);
        return ['http_code' => $httpCode, 'body' => $decoded ?? $body];
    }
}

return true;
