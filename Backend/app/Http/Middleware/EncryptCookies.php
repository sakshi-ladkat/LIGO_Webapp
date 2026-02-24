<?php

namespace App\Http\Middleware;

use Illuminate\Cookie\Middleware\EncryptCookies as Middleware;

class EncryptCookies extends Middleware
{
    /**
     * The names of the cookies that should not be encrypted.
     *
     * XSRF-TOKEN must NOT be encrypted: the browser reads it as plain-text
     * and sends it back as the X-XSRF-TOKEN header. Laravel's VerifyCsrfToken
     * middleware decrypts/validates that header value itself — if EncryptCookies
     * also encrypts the cookie, the token is double-encrypted and always fails.
     *
     * @var array<int, string>
     */
    protected $except = [
        'XSRF-TOKEN',
    ];
}
