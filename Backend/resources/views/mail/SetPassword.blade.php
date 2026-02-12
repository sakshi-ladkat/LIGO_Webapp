<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Your Password - LIGO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
    
    <!-- Main Container -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background: transparent;">
        <tr>
            <td style="padding: 40px 20px;">
                
                <!-- Email Card -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;">
                    
                    <!-- Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <!-- Lock Icon -->
                            <div style="margin-bottom: 20px;">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));">
                                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="white" stroke-width="2"/>
                                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="white" stroke-width="2" stroke-linecap="round"/>
                                    <circle cx="12" cy="16" r="1" fill="white"/>
                                </svg>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Set Your Password</h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">Complete your account setup</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            
                            <!-- Success Badge -->
                            <div style="text-align: center; margin-bottom: 30px;">
                                <span style="display: inline-block; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); color: #155724; padding: 10px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; border: 1px solid #c3e6cb;">
                                    ✅ Registration Successful
                                </span>
                            </div>
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 20px 0; color: #1a202c; font-size: 18px; font-weight: 600; line-height: 1.6;">
                                Hello {{ $name }}!
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                Congratulations! Your registration has been successfully completed. You're almost ready to access the <strong style="color: #667eea;">LIGO Scientific Collaboration</strong> platform.
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                To complete your account setup and start collaborating, please set your password by clicking the button below:
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin: 30px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{{ $link }}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                                            🔐 Set My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Important Information -->
                            <div style="background: linear-gradient(135deg, #fff3cd 0%, #fff3cd 100%); border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 30px 0;">
                                <p style="margin: 0 0 12px 0; color: #856404; font-size: 15px; font-weight: 600;">
                                    📌 Important Information
                                </p>
                                <table role="presentation" style="width: 100%;">
                                    <tr>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6; vertical-align: top; width: 20px;">
                                            •
                                        </td>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            This link will expire in <strong>24 hours</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6; vertical-align: top;">
                                            •
                                        </td>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            Your password must be at least <strong>8 characters long</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6; vertical-align: top;">
                                            •
                                        </td>
                                        <td style="padding: 6px 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            Use a mix of <strong>letters, numbers, and symbols</strong> for security
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Password Tips -->
                            <div style="margin: 30px 0;">
                                <h2 style="margin: 0 0 16px 0; color: #1a202c; font-size: 18px; font-weight: 600;">🔒 Password Security Tips</h2>
                                <table role="presentation" style="width: 100%;">
                                    <tr>
                                        <td style="padding: 10px 0; vertical-align: top; width: 30px;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: #e6fffa; color: #047857; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">✓</span>
                                        </td>
                                        <td style="padding: 10px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                                            Use a unique password you don't use elsewhere
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; vertical-align: top;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: #e6fffa; color: #047857; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">✓</span>
                                        </td>
                                        <td style="padding: 10px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                                            Avoid personal information like names or birthdays
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; vertical-align: top;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: #e6fffa; color: #047857; border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; font-weight: 600;">✓</span>
                                        </td>
                                        <td style="padding: 10px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                                            Consider using a password manager for security
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- What's Next -->
                            <div style="background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%); border-radius: 8px; padding: 20px; margin: 30px 0;">
                                <p style="margin: 0 0 12px 0; color: #4c1d95; font-size: 15px; font-weight: 600;">
                                    🚀 What's Next?
                                </p>
                                <p style="margin: 0; color: #5b21b6; font-size: 14px; line-height: 1.6;">
                                    After setting your password, you'll have full access to the LIGO platform including data analysis tools, collaboration features, and research resources.
                                </p>
                            </div>
                            
                            <!-- Security Warning -->
                            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 30px 0;">
                                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                                    <strong style="display: block; margin-bottom: 8px;">⚠️ Didn't register?</strong>
                                    If you didn't create an account with us, please ignore this email or contact our support team immediately.
                                </p>
                            </div>
                            
                            <!-- Alternative Link -->
                            <div style="margin: 30px 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                                    If the button doesn't work, copy and paste this link into your browser:
                                </p>
                                <p style="margin: 0; word-break: break-all;">
                                    <a href="{{ $link }}" style="color: #667eea; text-decoration: none; font-size: 13px;">{{ $link }}</a>
                                </p>
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            
                            <!-- Security Badge -->
                            <div style="margin-bottom: 20px;">
                                <span style="display: inline-block; background: #e6fffa; color: #047857; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                    🔐 Secure Password Setup
                                </span>
                            </div>
                            
                            <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                                <strong style="color: #4a5568;">LIGO Scientific Collaboration</strong><br>
                                Technology · Research · Collaboration
                            </p>
                            
                            <p style="margin: 0 0 15px 0; color: #a0aec0; font-size: 12px;">
                                © {{ date('Y') }} LIGO. All rights reserved.
                            </p>
                            
                            <!-- Social Links -->
                            <div style="margin-top: 15px;">
                                <a href="{{ config('app.url') }}" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Visit Website</a>
                                <span style="color: #cbd5e0; margin: 0 8px;">|</span>
                                <a href="{{ config('app.url') }}/help" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Help Center</a>
                                <span style="color: #cbd5e0; margin: 0 8px;">|</span>
                                <a href="{{ config('app.url') }}/support" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a>
                            </div>
                            
                        </td>
                    </tr>
                    
                </table>
                
                <!-- Email Client Notice -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0;">
                    <tr>
                        <td style="text-align: center; padding: 0 20px;">
                            <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 12px; line-height: 1.6;">
                                This is an automated email. Please do not reply to this message.
                            </p>
                        </td>
                    </tr>
                </table>
                
            </td>
        </tr>
    </table>
    
</body>
</html>
