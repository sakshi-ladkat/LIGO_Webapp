<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - LIGO</title>
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
                            <!-- Logo Icon -->
                            <div style="margin-bottom: 20px;">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">Complete your LIGO registration</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 20px 0; color: #1a202c; font-size: 16px; line-height: 1.6;">
                                Hello,
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                Thank you for joining the <strong style="color: #667eea;">LIGO Scientific Collaboration</strong> community! To complete your registration, please verify your email address by clicking the button below.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin: 30px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{{ $verificationLink }}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Expiration Notice -->
                            <div style="background: linear-gradient(135deg, #fef5e7 0%, #fdebd0 100%); border-left: 4px solid #f39c12; padding: 16px 20px; border-radius: 8px; margin: 30px 0;">
                                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                    <strong style="display: block; margin-bottom: 8px; font-size: 15px;">⏱️ Time-Sensitive</strong>
                                    This verification link expires in <strong>{{ $expiresInMinutes }} minutes</strong>. If you don't verify within this time, you'll need to request a new link.
                                </p>
                            </div>
                            
                            <!-- What's Next -->
                            <div style="margin: 30px 0;">
                                <h2 style="margin: 0 0 16px 0; color: #1a202c; font-size: 18px; font-weight: 600;">What happens next?</h2>
                                <table role="presentation" style="width: 100%;">
                                    <tr>
                                        <td style="padding: 12px 0; vertical-align: top; width: 30px;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">1</span>
                                        </td>
                                        <td style="padding: 12px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                                            Click the verification button to confirm your email
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; vertical-align: top;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">2</span>
                                        </td>
                                        <td style="padding: 12px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                                            Complete your registration with personal details
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; vertical-align: top;">
                                            <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">3</span>
                                        </td>
                                        <td style="padding: 12px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                                            Set up your password and access the platform
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Security Notice -->
                            <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 30px 0;">
                                <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                                    <strong style="color: #2d3748;">🔒 Didn't request this?</strong><br>
                                    If you didn't create an account, you can safely ignore this email. Your email address will not be registered unless you click the verification link.
                                </p>
                            </div>
                            
                            <!-- Alternative Link -->
                            <div style="margin: 30px 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                                    If the button doesn't work, copy and paste this link into your browser:
                                </p>
                                <p style="margin: 0; word-break: break-all;">
                                    <a href="{{ $verificationLink }}" style="color: #667eea; text-decoration: none; font-size: 13px;">{{ $verificationLink }}</a>
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
                                    🔐 Secure Email Verification
                                </span>
                            </div>
                            
                            <p style="margin: 0 0 10px 0; color: #718096; font-size: 13px; line-height: 1.6;">
                                <strong style="color: #4a5568;">LIGO Scientific Collaboration</strong><br>
                                Technology · Research · Collaboration
                            </p>
                            
                            <p style="margin: 0 0 15px 0; color: #a0aec0; font-size: 12px;">
                                © {{ date('Y') }} LIGO. All rights reserved.
                            </p>
                            
                            <!-- Social Links (Optional) -->
                            <div style="margin-top: 15px;">
                                <a href="{{ config('app.url') }}" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Visit Website</a>
                                <span style="color: #cbd5e0; margin: 0 8px;">|</span>
                                <a href="{{ config('app.url') }}/help" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Help Center</a>
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