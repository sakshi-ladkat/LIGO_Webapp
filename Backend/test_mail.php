<?php
require_once 'vendor/autoload.php';
require_once 'bootstrap/app.php';

use Illuminate\Support\Facades\Mail;
use App\Mail\OtpMail;

$app = require_once 'bootstrap/app.php';

try {
    Mail::to('ladkatsakshi2507@gmail.com')->send(new OtpMail('123456'));
    echo "Email sent successfully\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
?>
