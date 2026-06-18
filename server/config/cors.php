<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    // Token (Bearer) auth — no cookies. localhost dev origins are always allowed;
    // in production set FRONTEND_URL (comma-separate for multiple) to lock the rest.
    'allowed_origins' => array_values(array_filter(array_merge(
        ['http://localhost:5173', 'http://127.0.0.1:5173'],
        array_map('trim', explode(',', (string) env('FRONTEND_URL', ''))),
    ))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
