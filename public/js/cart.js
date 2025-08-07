import { loadCart, removeFromCart, checkout } from './lib.js';

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    document.getElementById('checkout').addEventListener('click', checkout);
});