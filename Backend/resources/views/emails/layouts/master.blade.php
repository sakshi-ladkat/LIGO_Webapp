<!DOCTYPE html>
<html>
<head>
    <title>OrbitAccess Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto;">
        <h2 style="color: @yield('title_color', '#0284c7'); border-bottom: 2px solid @yield('title_border_color', '#e0f2fe'); padding-bottom: 10px;">@yield('title')</h2>
        
        @yield('content')
        
        <p style="margin-top: 30px;">Best regards,<br><strong>OrbitAccess Team</strong></p>
    </div>
</body>
</html>
