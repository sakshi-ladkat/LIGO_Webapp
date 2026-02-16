<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Password | LIGO</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; }
        .success-text { color: #10b981; text-decoration: line-through; }
        .error-text { color: #ef4444; }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen">

    <div class="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden p-8">
        <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">
                @if(isset($isReset) && $isReset)
                    Reset Your Password
                @else
                    Set Your Password
                @endif
            </h2>
            <p class="text-gray-500 text-sm mt-1">
                @if(isset($isReset) && $isReset)
                    Enter a new password to recover access.
                @else
                    Secure your account to continue
                @endif
            </p>
        </div>

        @if(session('error'))
            <div class="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{{ session('error') }}</div>
        @endif

        <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm">
            <p class="font-semibold text-blue-800 mb-2">Password Requirements:</p>
            <ul class="space-y-1 text-gray-600 pl-1">
                <li id="req-length">Length: At least 8 characters</li>
                <li id="req-upper">One uppercase letter (A-Z)</li>
                <li id="req-number">One number (0-9)</li>
                <li id="req-special">One special character (!@#$...)</li>
            </ul>
        </div>

        <form action="{{ isset($isReset) && $isReset ? route('password.update') : route('password.store') }}" method="POST" id="passwordForm">
            @csrf
            <input type="hidden" name="token" value="{{ isset($token) ? $token : request('token') }}">
            <input type="hidden" name="email" value="{{ isset($email) ? $email : request('email') }}">

            <div class="mb-4">
                <label class="block text-gray-700 text-sm font-medium mb-1">New Password</label>
                <input type="password" name="password" id="password" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Enter password" required>
            </div>

            <div class="mb-6">
                <label class="block text-gray-700 text-sm font-medium mb-1">Confirm Password</label>
                <input type="password" name="password_confirmation" id="confirmPassword" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Confirm password" required>
                <p id="matchError" class="text-red-500 text-xs mt-1 hidden">Passwords do not match</p>
            </div>

            <button type="submit" id="submitBtn" disabled class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                @if(isset($isReset) && $isReset)
                    Reset Password
                @else
                    Set Password & Login
                @endif
            </button>
        </form>
    </div>

    <script>
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirmPassword');
        const submitBtn = document.getElementById('submitBtn');
        const matchError = document.getElementById('matchError');

        const reqLength = document.getElementById('req-length');
        const reqUpper = document.getElementById('req-upper');
        const reqNumber = document.getElementById('req-number');
        const reqSpecial = document.getElementById('req-special');

        function validatePassword() {
            const pwd = passwordInput.value;
            let valid = true;

            // Length
            if (pwd.length >= 8) updateStatus(reqLength, true);
            else { updateStatus(reqLength, false); valid = false; }

            // Uppercase
            if (/[A-Z]/.test(pwd)) updateStatus(reqUpper, true);
            else { updateStatus(reqUpper, false); valid = false; }

            // Number
            if (/[0-9]/.test(pwd)) updateStatus(reqNumber, true);
            else { updateStatus(reqNumber, false); valid = false; }

            // Special Char
            if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) updateStatus(reqSpecial, true);
            else { updateStatus(reqSpecial, false); valid = false; }

            return valid;
        }

        function updateStatus(el, isValid) {
            if (isValid) {
                el.classList.add('success-text');
                el.classList.remove('error-text');
                if (!el.innerText.startsWith('✅')) el.innerText = '✅ ' + el.innerText.replace('❌ ', '');
            } else {
                el.classList.remove('success-text');
                el.classList.add('error-text');
                if (!el.innerText.startsWith('❌')) el.innerText = '❌ ' + el.innerText.replace('✅ ', '');
            }
        }

        function checkMatch() {
            const pwd = passwordInput.value;
            const confirm = confirmInput.value;
            
            if (confirm.length > 0 && pwd !== confirm) {
                matchError.classList.remove('hidden');
                return false;
            } else {
                matchError.classList.add('hidden');
                return true;
            }
        }

        function updateFormState() {
            const isValid = validatePassword();
            const isMatch = checkMatch();
            const hasValue = passwordInput.value.length > 0;

            if (isValid && isMatch && hasValue) {
                submitBtn.disabled = false;
            } else {
                submitBtn.disabled = true;
            }
        }

        passwordInput.addEventListener('input', updateFormState);
        confirmInput.addEventListener('input', updateFormState);
    </script>
</body>
</html>
