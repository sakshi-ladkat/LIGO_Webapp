<?php
$routesJson = shell_exec('php artisan route:list --path=api --json');
$routes = json_decode($routesJson, true);

$md = "# API Documentation\n\n";
$md .= "This document lists all the backend API endpoints, their expected inputs, and outputs.\n\n";

$i = 1;
foreach ($routes as $route) {
    if (strpos($route['uri'], 'api/') !== 0) continue;
    $method = $route['method'];
    $method = str_replace('|HEAD', '', $method);
    $uri = "/" . $route['uri'];
    $action = $route['action'];
    
    $md .= "## {$i}. {$uri}\n";
    $md .= "- **Method:** `{$method}`\n";
    $md .= "- **Controller Action:** `{$action}`\n";
    
    if (in_array('POST', explode('|', $method)) || in_array('PATCH', explode('|', $method)) || in_array('PUT', explode('|', $method))) {
        $md .= "- **Input (JSON Payload):**\n  ```json\n  {\n    // Document payload here\n  }\n  ```\n";
    } else {
        $md .= "- **Input:** None (or Query Parameters)\n";
    }
    
    $md .= "- **Expected Output (JSON):**\n  ```json\n  {\n    // Document response here\n  }\n  ```\n\n";
    $i++;
}

file_put_contents('/home/sakshiladkat/.gemini/antigravity/brain/1c00e9c7-da0f-48fe-8369-58910d28bad8/api_documentation.md', $md);
echo "Generated api_documentation.md";
