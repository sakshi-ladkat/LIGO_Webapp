<?php

namespace App\Services;

use App\Models\User;
use App\Models\Institute;
use App\Models\Service;
use App\Models\Subservice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class LdapService
{
    protected $host;
    protected $port;
    protected $bindDn;
    protected $bindPass;

    public function __construct()
    {
        $this->host = env('LDAP_HOST', '127.0.0.1');
        $this->port = env('LDAP_PORT', 389);
        $this->bindDn = env('LDAP_BIND_DN', 'cn=admin,dc=internship,dc=local');
        $this->bindPass = env('LDAP_BIND_PASS', 'admin');
    }

    /**
     * Provision a user in LDAP and add to service groups.
     */
    public function provisionUser(User $user, array $serviceIds, array $subserviceIds)
    {
        Log::info("LDAP: Provisioning user {$user->username} (ID: {$user->user_id})");

        // 1. Determine User DN based on Institute
        $userDn = $this->generateUserDn($user);
        if (!$userDn) {
            Log::error("LDAP: Could not determine User DN for {$user->username}");
            return false;
        }

        // 2. Prepare Group DNs
        $groupDns = $this->collectGroupDns($serviceIds, $subserviceIds);

        // 3. Perform LDAP Operations
        if (!extension_loaded('ldap')) {
            Log::warning("LDAP: PHP ldap extension not loaded. MOCKING provisioning for {$userDn}");
            foreach ($groupDns as $groupDn) {
                Log::info("LDAP: [MOCK] Adding {$userDn} to group {$groupDn}");
            }
            return true;
        }

        return $this->executeLdapProvisioning($userDn, $user, $groupDns);
    }

    protected function generateUserDn(User $user): ?string
    {
        $aff = DB::table('user_affilation')->where('user_id', $user->user_id)->first();
        if (!$aff) return null;

        $institute = Institute::find($aff->institute_id);
        if (!$institute || !$institute->ldap_dn) {
            // Fallback to ou=Other if institute not found or has no DN
            $otherDn = 'ou=Other,ou=organization,dc=internship,dc=local';
            return "uid={$user->username},ou=users,{$otherDn}";
        }

        return "uid={$user->username},ou=users,{$institute->ldap_dn}";
    }

    protected function collectGroupDns(array $serviceIds, array $subserviceIds): array
    {
        $dns = [];

        if (!empty($serviceIds)) {
            $dns = array_merge($dns, Service::whereIn('id', $serviceIds)
                ->whereNotNull('ldap_dn')
                ->pluck('ldap_dn')
                ->toArray());
        }

        if (!empty($subserviceIds)) {
            $dns = array_merge($dns, Subservice::whereIn('id', $subserviceIds)
                ->whereNotNull('ldap_dn')
                ->pluck('ldap_dn')
                ->toArray());
        }

        return array_unique($dns);
    }

    protected function executeLdapProvisioning(string $userDn, User $user, array $groupDns): bool
    {
        $conn = ldap_connect($this->host, $this->port);
        if (!$conn) {
            Log::error("LDAP: Could not connect to {$this->host}");
            return false;
        }

        ldap_set_option($conn, LDAP_OPT_PROTOCOL_VERSION, 3);

        try {
            if (!ldap_bind($conn, $this->bindDn, $this->bindPass)) {
                Log::error("LDAP: Bind failed for {$this->bindDn}");
                return false;
            }

            // A. Create User Entry (if doesn't exist)
            $this->ensureUserEntry($conn, $userDn, $user);

            // B. Add to Groups
            foreach ($groupDns as $groupDn) {
                $this->addUserToGroup($conn, $userDn, $groupDn);
            }

            return true;
        } catch (\Exception $e) {
            Log::error("LDAP: Error during provisioning: " . $e->getMessage());
            return false;
        } finally {
            ldap_unbind($conn);
        }
    }

    protected function ensureUserEntry($conn, string $userDn, User $user)
    {
        // Global Uniqueness Check (LDAP Safety)
        $baseDn = env('LDAP_BASE_DN', 'dc=internship,dc=local');
        $filter = "(|(uid={$user->username})(mail={$user->email}))";
        
        $globalSearch = @ldap_search($conn, $baseDn, $filter);
        if ($globalSearch && ldap_count_entries($conn, $globalSearch) > 0) {
            $entries = ldap_get_entries($conn, $globalSearch);
            $existingDn = $entries[0]['dn'];
            
            if (strtolower($existingDn) !== strtolower($userDn)) {
                Log::error("LDAP SAFETY VIOLATION: Identity with uid={$user->username} or mail={$user->email} already exists at {$existingDn}");
                throw new \Exception("LDAP identity collision detected. Provisioning aborted.");
            }
        }

        $search = @ldap_read($conn, $userDn, '(objectClass=*)');
        if (!$search || ldap_count_entries($conn, $search) == 0) {
            // Create user entry
            $profile = DB::table('user_profiles')->where('user_id', $user->user_id)->first();
            $firstName = $profile->first_name ?? 'User';
            $lastName = $profile->last_name ?? $user->username;

            $entry = [
                'objectClass' => ['top', 'person', 'organizationalPerson', 'inetOrgPerson'],
                'cn' => $firstName . ' ' . $lastName,
                'sn' => $lastName,
                'givenName' => $firstName,
                'uid' => $user->username,
                'mail' => $user->email,
                'userPassword' => '{SASL}' . $user->email, // Placeholder
            ];

            if (!ldap_add($conn, $userDn, $entry)) {
                Log::error("LDAP: Failed to add user entry {$userDn}: " . ldap_error($conn));
            } else {
                Log::info("LDAP: Created user entry {$userDn}");
            }
        }
    }

    protected function addUserToGroup($conn, string $userDn, string $groupDn)
    {
        $entry = ['member' => $userDn];
        if (!@ldap_mod_add($conn, $groupDn, $entry)) {
            $err = ldap_error($conn);
            if (strpos($err, 'Already exists') !== false) {
                return; // Already a member
            }
            Log::error("LDAP: Failed to add user to group {$groupDn}: {$err}");
        } else {
            Log::info("LDAP: Added user to group {$groupDn}");
        }
    }
}
