<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Up Password - LIGO </title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px 20px; color: #2d3748;">
    
    <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
        
        <div style="padding: 40px 40px 30px 40px; text-align: center;">
            <h2 style="color: #1a202c; font-size: 20px; margin: 0 0 20px 0; font-weight: 600;">Complete Registration</h2>
            
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
                Hello {{ $name }}, <br><br>
                Thank you for registering! Please click the button below to set up your password and complete your registration.
            </p>



            <a href="{{ $link }}" style="display: inline-block; background-color: #3182ce; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">
                Set Up Password
            </a>
        </div>

        <div style="padding: 0 40px 40px 40px; text-align: center;">
            <p style="color: #718096; font-size: 12px; line-height: 1.5; margin: 0;">
                Or paste this link into your browser:<br>
                <a href="{{ $link }}" style="color: #3182ce; text-decoration: underline; word-break: break-all;">{{ $link }}</a>
            </p>
        </div>

    </div>
    
    <div style="text-align: center; margin-top: 20px;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">&copy; {{ date('Y') }} LIGO</p>
    </div>

</body>
</html>
