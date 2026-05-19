<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LdapDnSeeder extends Seeder
{
    public function run(): void
    {
        $baseDn = 'dc=internship,dc=local';

        // 1. Institutes
        $institutes = [
            'Inter-University Center for Astronomy & Astrophysics (IUCAA)' => "ou=IUCAA,ou=organization,$baseDn",
            'Indian Institute for Plasma Research (IPR)' => "ou=IPR,ou=organization,$baseDn",
            'Raja Ramanna Center for Advanced Technology (RRCAT)' => "ou=RRCAT,ou=organization,$baseDn",
            'Directorate of Construction, Services & Estate Management (DCSEM)' => "ou=DCSEM,ou=organization,$baseDn",
        ];

        foreach ($institutes as $name => $dn) {
            DB::table('institutes')->where('name', $name)->update(['ldap_dn' => $dn]);
        }

        // 2. Services
        $services = [
            'HPC' => "cn=hpc,ou=services,ou=groups,$baseDn",
            'HTC' => "cn=htc,ou=services,ou=groups,$baseDn",
            'GW' => "cn=gravitational-wave,ou=services,ou=groups,$baseDn",
            'Jupyterhub' => "cn=jupyterhub,ou=services,ou=groups,$baseDn",
            'Web-Services' => "ou=web-service,ou=services,ou=groups,$baseDn",
        ];

        foreach ($services as $code => $dn) {
            DB::table('services')->where('code', $code)->update(['ldap_dn' => $dn]);
        }

        // 3. Subservices
        $subservices = [
            'Alog' => "cn=alog,ou=web-service,ou=services,ou=groups,$baseDn",
            'Gitlab' => "cn=gitlab,ou=web-service,ou=services,ou=groups,$baseDn",
            'Sympa' => "cn=sympa,ou=web-service,ou=services,ou=groups,$baseDn",
        ];

        foreach ($subservices as $code => $dn) {
            DB::table('subservices')->where('code', $code)->update(['ldap_dn' => $dn]);
        }
    }
}
