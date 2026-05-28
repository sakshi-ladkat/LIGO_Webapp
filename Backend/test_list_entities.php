<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $data = \DB::table('titles')->select(['*', 'name'])->orderBy('name')->get();
    echo "Titles: " . count($data) . "\n";
} catch (\Exception $e) {
    echo "Error in titles: " . $e->getMessage() . "\n";
}
try {
    $data = \DB::table('durations')->select(['*', 'name'])->get();
    echo "Durations: " . count($data) . "\n";
} catch (\Exception $e) {
    echo "Error in durations: " . $e->getMessage() . "\n";
}
