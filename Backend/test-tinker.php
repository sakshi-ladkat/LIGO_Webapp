<?php
$user = App\Models\User::find(7); // System Lead (Institute 13)
Auth::login($user);
$actor = Auth::user();
$actor->load('roles');
$actorSlugs = $actor->roles->pluck('slug')->toArray();
$query = \App\Models\AccessRequest::with(['user.registration', 'institute']);
if (in_array('system_lead', $actorSlugs) && !in_array('super_admin', $actorSlugs) && !in_array('pet_lead', $actorSlugs)) {
    $query->where('institute_id', $actor->institute_id);
}
$reqs = $query->get();
echo json_encode($reqs->toArray());
