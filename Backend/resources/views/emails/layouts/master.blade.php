<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OrbitAccess Notification</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter, 'Segoe UI', Arial, sans-serif;-webkit-font-smoothing:antialiased;color:#334155;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <!-- Main Card -->
                <table width="650" cellpadding="0" cellspacing="0" border="0"
                    style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">

                    <!-- Header -->
                    <tr>
                        <td style="background:#ffffff;padding:40px 32px 20px;text-align:center;">
                            <table cellpadding="0" cellspacing="0" border="0" align="center">
                                <tr>
                                    <td style="background:#6366f1;color:#ffffff;border-radius:10px;width:38px;height:38px;font-weight:800;font-size:22px;text-align:center;line-height:38px;box-shadow:0 4px 6px -1px rgba(99,102,241,0.2);">
                                        O
                                    </td>
                                    <td style="padding-left:12px;">
                                        <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">
                                            OrbitAccess
                                        </h1>
                                        <p style="margin:4px 0 0;color:#64748b;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">
                                            Research Management System
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Content Area -->
                    <tr>
                        <td style="padding:10px 40px 40px;font-size:16px;line-height:1.6;color:#334155;">
                            @yield('content')
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#f8fafc;padding:24px;text-align:center;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;">
                            This is an automated notification from OrbitAccess Research Management System.<br>
                            Please do not reply to this email.
                            <br><br>
                            &copy; {{ date('Y') }} OrbitAccess. All rights reserved.
                        </td>
                    </tr>

                </table>
                <!-- End Main Card -->
            </td>
        </tr>
    </table>
</body>
</html>
