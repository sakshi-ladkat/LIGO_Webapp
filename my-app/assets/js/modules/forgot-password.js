export function mountForgotPassword() {
    console.log('[SPA] Forgot Password page mounted');

    // Make sure we have the DOM forms ready
    const fpForm = document.getElementById('forgotPasswordForm');
    if (!fpForm) {
        console.warn('Forgot Password form not found');
        return;
    }

    fpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('forgotEmail').value;
        const submitBtn = document.getElementById('forgotSubmitBtn');

        if (!email) {
            if (window.toastr) toastr.error('Please enter your email address');
            else alert('Please enter your email address');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending...';

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/password/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (res.ok) {
                if (window.toastr) toastr.success(data.message || 'Reset link sent successfully!');
                else alert(data.message || 'Reset link sent successfully!');

                // clear it
                document.getElementById('forgotEmail').value = '';

                // Option to redirect to login
                setTimeout(() => { window.location.hash = '#/login'; }, 2000);
            } else {
                throw new Error(data.message || 'An error occurred while sending the reset link');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            if (window.toastr) toastr.error(error.message);
            else alert(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Reset Link';
        }
    });
}
