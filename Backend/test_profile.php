<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$controller = new \App\Http\Controllers\WorkflowController();
try {
    $duplicateService = app(\App\Services\DuplicateApplicantService::class);
    $response = $controller->applicantProfile('01ksj1wbpd0atvhz04ytqjws71', $duplicateService);
    echo "Response: " . $response->getContent() . "\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
