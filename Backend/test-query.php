<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::find(3); // li_coordinator and system_lead
Auth::login($user);
$actor = Auth::user();
$actor->load('roles');
$actorSlugs = $actor->roles->pluck('slug')->toArray();

$query = \App\Models\AccessRequest::with(['user.registration', 'institute']);

if (in_array('system_lead', $actorSlugs) && !in_array('super_admin', $actorSlugs) && !in_array('pet_lead', $actorSlugs)) {
    $query->where('institute_id', $actor->institute_id);
} elseif (in_array('li_coordinator', $actorSlugs) && !in_array('super_admin', $actorSlugs) && !in_array('pet_lead', $actorSlugs)) {
    $query->where('institute_id', $actor->institute_id);
}

echo $query->toSql() . "\n";
print_r($query->getBindings());
$reqs = $query->get();
echo "Count: " . count($reqs) . "\n";

$user7 = App\Models\User::find(7); // system_lead only
Auth::login($user7);
$actor = Auth::user();
$actor->load('roles');
$actorSlugs = $actor->roles->pluck('slug')->toArray();

$query2 = \App\Models\AccessRequest::with(['user.registration', 'institute']);
if (in_array('system_lead', $actorSlugs) && !in_array('super_admin', $actorSlugs) && !in_array('pet_lead', $actorSlugs)) {
    $query2->where('institute_id', $actor->institute_id);
}
echo $query2->toSql() . "\n";
print_r($query2->getBindings());
$reqs2 = $query2->get();
echo "Count 2: " . count($reqs2) . "\n";
