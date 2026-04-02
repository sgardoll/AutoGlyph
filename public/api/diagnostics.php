<?php
declare(strict_types=1);

header('Content-Type: application/json');

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
$candidatePaths = [
    dirname($documentRoot) . '/.env.local',
    $documentRoot . '/.env.local',
    $scriptDir . '/.env.local',
    dirname($scriptDir) . '/.env.local',
    dirname(__DIR__, 2) . '/.env.local',
];

$loadedEnvPath = loadEnvFile($candidatePaths);

$apiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '';

echo json_encode([
    'ok' => true,
    'php_version' => PHP_VERSION,
    'curl_enabled' => function_exists('curl_init'),
    'json_enabled' => function_exists('json_encode'),
    'env_candidates' => $candidatePaths,
    'env_file_checked' => $loadedEnvPath,
    'env_file_exists' => $loadedEnvPath !== null,
    'env_loaded' => $loadedEnvPath !== null,
    'gemini_api_key_present' => $apiKey !== '',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? null,
    'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? null,
], JSON_PRETTY_PRINT);
