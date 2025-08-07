import { switchTab, showAlert, hideAlert, setLoading, handleLogin, handleRegister } from './lib.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (event) => switchTab(event, event.target.textContent.toLowerCase()));
    });
    document.getElementById("login-username").focus();
});