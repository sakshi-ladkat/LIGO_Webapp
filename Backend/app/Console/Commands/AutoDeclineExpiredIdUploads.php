<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:auto-decline-expired-id-uploads')]
#[Description('Command description')]
class AutoDeclineExpiredIdUploads extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
    }
}
