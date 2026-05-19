import sys

file_path = '/home/sakshiladkat/Desktop/MSc_Project/Backend/app/Http/Controllers/WorkflowController.php'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Find the last closing brace
for i in range(len(lines) - 1, -1, -1):
    if '}' in lines[i]:
        lines[i] = lines[i].replace('}', '')
        break

new_method = """
    /**
     * GET /api/auth/review/staff/subsystem/{subsystemId}
     *
     * Returns users with 'subsystem_lead' role assigned to a specific subsystem.
     */
    public function staffBySubsystem(int $subsystemId): JsonResponse
    {
        $staff = DB::table('users as u')
            ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('u.subsystem_id', $subsystemId)
            ->where('r.slug', 'subsystem_lead')
            ->where('ur.is_active', true)
            ->where('u.status', '!=', 'deactivated')
            ->select([
                'u.user_id as id',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                'u.email',
            ])
            ->orderBy('name')
            ->get();

        return response()->json($staff);
    }
}
"""

lines.append(new_method)

with open(file_path, 'w') as f:
    f.writelines(lines)
