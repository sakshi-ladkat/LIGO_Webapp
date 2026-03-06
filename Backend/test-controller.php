<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::find(7); // system_lead only (institute 13)
Auth::login($user);
$controller = app()->make(App\Http\Controllers\AdminController::class);
$request = Illuminate\Http\Request::create('/api/admin/requests', 'GET');
$response = $controller->listRequests($request);
echo $response->getContent() . "\n";
