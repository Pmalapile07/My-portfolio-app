<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - TaskMart</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Manrope', sans-serif;
            background: #f8fafd;
            min-height: 100vh;
            color: #1e293b;
        }

        /* Header - Pink matching login button */
        .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 1rem 2rem;
            background: #FF286F;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(255, 40, 111, 0.2);
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo {
            height: 40px;
            width: auto;
            display: flex;
            align-items: center;
        }

        .logo img {
            height: 100%;
            width: auto;
            object-fit: contain;
            filter: brightness(0) invert(1);
        }

        .debug-toggle {
            background: white;
            color: #FF286F;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .debug-toggle:hover {
            background: rgba(255, 255, 255, 0.9);
            transform: scale(1.05);
        }

        .debug-panel {
            position: fixed;
            top: 80px;
            right: 2rem;
            background: #1e293b;
            color: #94a3b8;
            padding: 1rem;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.75rem;
            max-width: 400px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            border-left: 4px solid #FF286F;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .debug-panel.show {
            display: block;
        }

        .debug-error {
            color: #FF286F;
        }

        .debug-success {
            color: #10b981;
        }

        .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6rem 1rem 2rem;
        }

        .auth-card {
            background: white;
            border-radius: 20px;
            padding: 2.5rem;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 10px 40px rgba(4, 91, 146, 0.08);
            border: 1px solid rgba(4, 91, 146, 0.1);
        }

        .auth-tabs {
            display: flex;
            gap: 2rem;
            margin-bottom: 2rem;
            border-bottom: 1px solid rgba(4, 91, 146, 0.1);
            padding-bottom: 0.5rem;
        }

        .auth-tab {
            font-size: 1rem;
            font-weight: 500;
            color: #94a3b8;
            cursor: pointer;
            padding: 0.5rem 0;
            position: relative;
            transition: color 0.2s;
        }

        .auth-tab.active {
            color: #045B92;
        }

        .auth-tab.active::after {
            content: '';
            position: absolute;
            bottom: -0.5rem;
            left: 0;
            right: 0;
            height: 2px;
            background: #FF286F;
            border-radius: 2px;
        }

        .auth-form {
            display: none;
        }

        .auth-form.active {
            display: block;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #045B92;
            font-weight: 500;
            font-size: 0.85rem;
        }

        .form-group input {
            width: 100%;
            padding: 0.9rem 1.2rem;
            border: 1px solid rgba(4, 91, 146, 0.2);
            border-radius: 10px;
            font-family: 'Manrope', sans-serif;
            font-size: 0.95rem;
            transition: all 0.2s;
            outline: none;
            background: #f8fafd;
        }

        .form-group input:focus {
            border-color: #FF286F;
            background: white;
        }

        .form-group input.error {
            border-color: #FF286F;
            background: rgba(255, 40, 111, 0.02);
        }

        .password-input-wrapper {
            position: relative;
        }

        .toggle-password {
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            color: #94a3b8;
        }

        .toggle-password:hover {
            color: #FF286F;
        }

        .error-message {
            color: #FF286F;
            font-size: 0.75rem;
            margin-top: 0.5rem;
            display: none;
        }

        .error-message.visible {
            display: block;
        }

        .role-selector {
            display: flex;
            gap: 1rem;
            margin-top: 0.5rem;
        }

        .role-option {
            flex: 1;
            cursor: pointer;
        }

        .role-option input[type="radio"] {
            display: none;
        }

        .role-card {
            border: 1px solid rgba(4, 91, 146, 0.2);
            border-radius: 10px;
            padding: 1rem;
            text-align: center;
            transition: all 0.2s;
            background: #f8fafd;
        }

        .role-option input[type="radio"]:checked + .role-card {
            border-color: #FF286F;
            background: white;
        }

        .role-icon {
            font-size: 24px !important;
            color: #045B92;
            margin-bottom: 0.5rem;
        }

        .role-title {
            font-weight: 600;
            color: #045B92;
            font-size: 0.9rem;
            margin-bottom: 0.25rem;
        }

        .role-desc {
            font-size: 0.7rem;
            color: #94a3b8;
        }

        .auth-button {
            width: 100%;
            padding: 1rem;
            background: #FF286F;
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 1rem;
        }

        .auth-button:hover {
            background: #d61e5b;
        }

        .auth-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .auth-button.loading {
            color: transparent;
            position: relative;
        }

        .auth-button.loading::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            top: 50%;
            left: 50%;
            margin-left: -10px;
            margin-top: -10px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .forgot-password {
            text-align: right;
            margin-top: 0.5rem;
        }

        .forgot-password a {
            color: #94a3b8;
            text-decoration: none;
            font-size: 0.8rem;
            transition: color 0.2s;
        }

        .forgot-password a:hover {
            color: #FF286F;
        }

        .terms-text {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.75rem;
            color: #94a3b8;
        }

        .terms-text a {
            color: #FF286F;
            text-decoration: none;
        }

        .toast {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 1rem 2rem;
            border-radius: 30px;
            font-weight: 500;
            font-size: 0.9rem;
            z-index: 1000;
            display: none;
            animation: slideUp 0.3s ease;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.2);
        }

        .toast.show {
            display: block;
        }

        .toast.error {
            background: #ef4444;
        }

        @media (max-width: 640px) {
            .header {
                padding: 1rem;
            }
            
            .logo {
                height: 35px;
            }
            
            .auth-card {
                padding: 1.5rem;
            }
            
            .debug-panel {
                right: 1rem;
                left: 1rem;
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <div class="logo">
                <img src="Cream Black Typography Loop Brand Logo (500 x 180 px).png" alt="TaskMart" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <span style="display: none; font-weight: 700; color: white; font-size: 1.5rem;">TaskMart</span>
            </div>
            <button class="debug-toggle" onclick="toggleDebug()">Debug</button>
        </div>
    </header>

    <div class="debug-panel" id="debugPanel"></div>

    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-tabs">
                <div class="auth-tab active" data-tab="login">Log In</div>
                <div class="auth-tab" data-tab="signup">Sign Up</div>
            </div>

            <!-- Login Form -->
            <form class="auth-form active" id="loginForm">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" placeholder="your@email.com" value="pmalapile07@gmail.com">
                    <div class="error-message" id="loginEmailError"></div>
                </div>

                <div class="form-group">
                    <label>Password</label>
                    <div class="password-input-wrapper">
                        <input type="password" id="loginPassword" placeholder="••••••••" value="password123">
                        <span class="material-symbols-outlined toggle-password" onclick="togglePassword('loginPassword')">visibility_off</span>
                    </div>
                    <div class="error-message" id="loginPasswordError"></div>
                </div>

                <div class="forgot-password">
                    <a href="#" id="forgotPassword">Forgot password?</a>
                </div>

                <button type="submit" class="auth-button" id="loginBtn">Log In</button>
            </form>

            <!-- Signup Form -->
            <form class="auth-form" id="signupForm">
                <div class="form-group">
                    <label>Full name</label>
                    <input type="text" id="signupName" placeholder="Pearl Malapile">
                    <div class="error-message" id="signupNameError"></div>
                </div>

                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="signupEmail" placeholder="your@email.com">
                    <div class="error-message" id="signupEmailError"></div>
                </div>

                <div class="form-group">
                    <label>I want to:</label>
                    <div class="role-selector">
                        <label class="role-option">
                            <input type="radio" name="role" value="poster" checked>
                            <div class="role-card">
                                <span class="material-symbols-outlined role-icon">assignment</span>
                                <div class="role-title">Get Help</div>
                                <div class="role-desc">Post tasks</div>
                            </div>
                        </label>
                        <label class="role-option">
                            <input type="radio" name="role" value="helper">
                            <div class="role-card">
                                <span class="material-symbols-outlined role-icon">handyman</span>
                                <div class="role-title">Earn Money</div>
                                <div class="role-desc">Do tasks</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label>Password</label>
                    <div class="password-input-wrapper">
                        <input type="password" id="signupPassword" placeholder="••••••••">
                        <span class="material-symbols-outlined toggle-password" onclick="togglePassword('signupPassword')">visibility_off</span>
                    </div>
                    <div class="error-message" id="signupPasswordError"></div>
                </div>

                <div class="form-group">
                    <label>Confirm password</label>
                    <div class="password-input-wrapper">
                        <input type="password" id="signupConfirmPassword" placeholder="••••••••">
                        <span class="material-symbols-outlined toggle-password" onclick="togglePassword('signupConfirmPassword')">visibility_off</span>
                    </div>
                    <div class="error-message" id="signupConfirmError"></div>
                </div>

                <button type="submit" class="auth-button" id="signupBtn">Create Account</button>

                <div class="terms-text">
                    By signing up, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
                </div>
            </form>
        </div>
    </div>

    <div class="toast" id="toast"></div>

    <script>
        // ==================== CONFIG ====================
        const API_BASE_URL = 'https://taskmartapp.onrender.com';

        // ==================== DEBUG ====================
        function addDebug(message, type = 'info', data = null) {
            const panel = document.getElementById('debugPanel');
            const timestamp = new Date().toLocaleTimeString();
            const className = type === 'error' ? 'debug-error' : type === 'success' ? 'debug-success' : '';
            
            let debugText = `<span class="${className}">[${timestamp}]</span> ${message}`;
            if (data) {
                debugText += `\n${JSON.stringify(data, null, 2)}`;
            }
            panel.innerHTML += debugText + '\n---\n';
            console.log(`[${type}]`, message, data);
        }

        function toggleDebug() {
            const panel = document.getElementById('debugPanel');
            panel.classList.toggle('show');
            if (panel.classList.contains('show')) {
                addDebug('Debug mode enabled', 'info');
                addDebug('API URL:', 'info', API_BASE_URL);
            }
        }

        // ==================== TOAST ====================
        function showToast(message, isError = false) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast' + (isError ? ' error' : '') + ' show';
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        // ==================== UI HELPERS ====================
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const tabName = this.dataset.tab;
                document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
                document.getElementById(tabName + 'Form').classList.add('active');
                
                clearAllErrors();
            });
        });

        function togglePassword(inputId) {
            const input = document.getElementById(inputId);
            const icon = event.target;
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = 'visibility';
            } else {
                input.type = 'password';
                icon.textContent = 'visibility_off';
            }
        }

        function clearAllErrors() {
            document.querySelectorAll('.error-message').forEach(el => {
                el.textContent = '';
                el.classList.remove('visible');
            });
            document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
        }

        function showFieldError(inputId, message) {
            const input = document.getElementById(inputId);
            const errorEl = document.getElementById(inputId + 'Error');
            input.classList.add('error');
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.classList.add('visible');
            }
        }

        function isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        function saveUserSession(user, token) {
            localStorage.setItem('taskmart_user', JSON.stringify(user));
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            addDebug('User session saved', 'success', user);
        }

        function getReturnUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('returnTo') || '/dashboard.html';
        }

        // ==================== LOGIN - REAL MONGODB ====================
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            clearAllErrors();

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const returnUrl = getReturnUrl();
            
            addDebug('Login attempt for: ' + email, 'info');

            let isValid = true;

            if (!email) {
                showFieldError('loginEmail', 'Email required');
                isValid = false;
            } else if (!isValidEmail(email)) {
                showFieldError('loginEmail', 'Invalid email');
                isValid = false;
            }

            if (!password) {
                showFieldError('loginPassword', 'Password required');
                isValid = false;
            }

            if (!isValid) return;

            const loginBtn = document.getElementById('loginBtn');
            loginBtn.disabled = true;
            loginBtn.classList.add('loading');

            try {
                addDebug('Calling login API: ' + `${API_BASE_URL}/api/auth/login`, 'info');
                
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    addDebug('Login failed: ' + data.error, 'error');
                    throw new Error(data.error || 'Login failed');
                }

                addDebug('Login successful', 'success', data.user);
                
                saveUserSession(data.user, data.token);
                showToast('Login successful!');
                
                setTimeout(() => {
                    window.location.href = returnUrl;
                }, 1000);

            } catch (error) {
                addDebug('Login error: ' + error.message, 'error');
                loginBtn.disabled = false;
                loginBtn.classList.remove('loading');
                showFieldError('loginEmail', 'Invalid credentials');
                showToast('Login failed: ' + error.message, true);
            }
        });

        // ==================== SIGNUP - REAL MONGODB ====================
        document.getElementById('signupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            clearAllErrors();

            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const role = document.querySelector('input[name="role"]:checked')?.value;
            const returnUrl = getReturnUrl();
            
            addDebug('Signup attempt for: ' + email, 'info');

            let isValid = true;

            if (!name) {
                showFieldError('signupName', 'Name required');
                isValid = false;
            }

            if (!email) {
                showFieldError('signupEmail', 'Email required');
                isValid = false;
            } else if (!isValidEmail(email)) {
                showFieldError('signupEmail', 'Invalid email');
                isValid = false;
            }

            if (!password) {
                showFieldError('signupPassword', 'Password required');
                isValid = false;
            } else if (password.length < 6) {
                showFieldError('signupPassword', 'Min 6 characters');
                isValid = false;
            }

            if (password !== confirmPassword) {
                showFieldError('signupConfirm', 'Passwords do not match');
                isValid = false;
            }

            if (!role) {
                showToast('Select a role', true);
                isValid = false;
            }

            if (!isValid) return;

            const signupBtn = document.getElementById('signupBtn');
            signupBtn.disabled = true;
            signupBtn.classList.add('loading');

            try {
                addDebug('Calling register API: ' + `${API_BASE_URL}/api/auth/register`, 'info');
                
                const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    addDebug('Signup failed: ' + data.error, 'error');
                    throw new Error(data.error || 'Signup failed');
                }

                addDebug('Signup successful', 'success', data.user);
                
                saveUserSession(data.user, data.token);
                showToast('Account created!');
                
                setTimeout(() => {
                    window.location.href = returnUrl;
                }, 1000);

            } catch (error) {
                addDebug('Signup error: ' + error.message, 'error');
                signupBtn.disabled = false;
                signupBtn.classList.remove('loading');
                
                if (error.message.includes('already exists')) {
                    showFieldError('signupEmail', 'Email already registered');
                }
                showToast('Signup failed: ' + error.message, true);
            }
        });

        // ==================== FORGOT PASSWORD ====================
        document.getElementById('forgotPassword').addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            if (!email || !isValidEmail(email)) {
                showToast('Enter a valid email first', true);
                return;
            }

            try {
                await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                showToast('Reset link sent if email exists');
            } catch (error) {
                showToast('Error sending reset link', true);
            }
        });

        // ==================== CHECK EXISTING SESSION ====================
        const existingUser = localStorage.getItem('taskmart_user');
        const existingToken = localStorage.getItem('auth_token');
        
        if (existingUser && existingToken) {
            addDebug('Existing session found', 'info', JSON.parse(existingUser));
            
            // Verify token with backend
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${existingToken}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        const returnUrl = getReturnUrl();
                        if (returnUrl !== '/login.html') {
                            addDebug('Valid session, redirecting to: ' + returnUrl, 'success');
                            window.location.href = returnUrl;
                        }
                    }
                } else {
                    // Token invalid, clear storage
                    localStorage.removeItem('taskmart_user');
                    localStorage.removeItem('auth_token');
                    addDebug('Invalid token cleared', 'info');
                }
            } catch (error) {
                addDebug('Token verification failed', 'error');
            }
        } else {
            addDebug('No existing session', 'info');
        }
    </script>
</body>
</html>
