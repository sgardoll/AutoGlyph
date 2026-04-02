<?php
declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

function loadEnvFile(array $candidatePaths): ?string
{
    foreach ($candidatePaths as $envPath) {
        if (!is_string($envPath) || $envPath === '' || !is_file($envPath)) {
            continue;
        }

        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            continue;
        }

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
                continue;
            }

            [$name, $value] = explode('=', $trimmed, 2);
            $name = trim($name);
            $value = trim($value);
            $value = trim($value, "\"'");

            if ($name !== '') {
                $_ENV[$name] = $value;
                putenv($name . '=' . $value);
            }
        }

        return $envPath;
    }

    return null;
}

$documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
$scriptDir = __DIR__;
$loadedEnvPath = loadEnvFile([
    dirname($documentRoot) . '/.env.local',
    $documentRoot . '/.env.local',
    $scriptDir . '/.env.local',
    dirname($scriptDir) . '/.env.local',
    dirname(__DIR__, 2) . '/.env.local',
]);

$apiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '';
if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Missing GEMINI_API_KEY on the server.']);
    exit;
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Failed to read request body.']);
    exit;
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload.']);
    exit;
}

$imageDataUrl = $payload['imageDataUrl'] ?? null;
$mimeType = $payload['mimeType'] ?? null;

if (!is_string($imageDataUrl) || !is_string($mimeType)) {
    http_response_code(400);
    echo json_encode(['error' => 'imageDataUrl and mimeType are required.']);
    exit;
}

$parts = explode(',', $imageDataUrl, 2);
if (count($parts) !== 2 || $parts[1] === '') {
    http_response_code(400);
    echo json_encode(['error' => 'imageDataUrl must be a valid data URL.']);
    exit;
}

$requestBody = [
    'contents' => [[
        'parts' => [
            [
                'inline_data' => [
                    'mime_type' => $mimeType,
                    'data' => $parts[1],
                ],
            ],
            [
                'text' => "Analyze this image containing handwritten or printed characters.\nIdentify the bounding box for each character present.\n\nCRITICAL INSTRUCTIONS FOR BOUNDING BOXES:\n1. The bounding boxes MUST be extremely tight around the visible ink of each individual character.\n2. DO NOT include any extra whitespace around the character.\n3. EXTREMELY IMPORTANT: DO NOT include EVEN A SINGLE PIXEL of adjacent characters. If characters are close or touching, you must carefully isolate the target character. Including stray pixels from a taller adjacent character will completely ruin the font generation process.\n4. For characters with ascenders (like 'h', 'l', 't', 'i', 'j') or descenders (like 'g', 'p', 'y', 'j', 'q'), ensure the box accurately captures the full vertical extent of the ink, including dots and descenders.\n5. For characters like 'i' and 'j', the bounding box MUST include the dot.\n\nInclude uppercase and lowercase letters (A-Z, a-z), numerals (0-9), and common punctuation marks (!?. ,).\nReturn a JSON object with a 'letters' array.\nEach element should have:\n- 'char': the character (e.g., 'A', 'a', '0', '!', '.')\n- 'box': [ymin, xmin, ymax, xmax] where values are normalized between 0 and 1000.\nEnsure you find as many characters as possible, and that their bounding boxes are perfectly tight to avoid wonky alignment when converted to a font.",
            ],
        ],
    ]],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'responseSchema' => [
            'type' => 'OBJECT',
            'properties' => [
                'letters' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'char' => ['type' => 'STRING'],
                            'box' => [
                                'type' => 'ARRAY',
                                'items' => ['type' => 'NUMBER'],
                            ],
                        ],
                        'required' => ['char', 'box'],
                    ],
                ],
            ],
            'required' => ['letters'],
        ],
    ],
];

$endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . rawurlencode($apiKey);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($requestBody, JSON_UNESCAPED_SLASHES),
    CURLOPT_TIMEOUT => 120,
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini request failed: ' . $curlError]);
    exit;
}

$decoded = json_decode($response, true);
if (!is_array($decoded)) {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini returned an invalid response.']);
    exit;
}

if ($statusCode >= 400) {
    $message = $decoded['error']['message'] ?? 'Gemini request failed.';
    http_response_code($statusCode);
    echo json_encode(['error' => $message]);
    exit;
}

$text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
if (!is_string($text) || trim($text) === '') {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini returned no usable content.']);
    exit;
}

$result = json_decode($text, true);
if (!is_array($result)) {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini returned malformed JSON content.']);
    exit;
}

echo json_encode([
    'letters' => $result['letters'] ?? [],
]);
