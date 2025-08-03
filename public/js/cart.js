async function loadCart() {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  const cartItemsDiv = document.getElementById('cart-items');
  cartItemsDiv.innerHTML = '';
  for (const item of cart) {
    const response = await fetch(`/api/products/${item.productId}`);
    const data = await response.json();
    if (data.success) {
      const product = data.data;
      const itemElement = document.createElement('div');
      itemElement.innerHTML = `
        <h3>${product.name}</h3>
        <p>Price: $${product.price}</p>
        <p>Quantity: ${item.quantity}</p>
        <button onclick="removeFromCart(${item.productId})">Remove</button>
      `;
      cartItemsDiv.appendChild(itemElement);
    }
  }
}

function removeFromCart(productId) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => item.productId !== productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  loadCart();
}

async function checkout() {
  const isLoggedIn = await fetch('/api/me').then(res => res.ok);
  if (!isLoggedIn) {
    window.location.href = '/login.html';
    return;
  }
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cart.length === 0) {
    alert('Cart is empty');
    return;
  }
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cart })
  });
  const result = await response.json();
  if (result.success) {
    alert('Order placed successfully');
    localStorage.removeItem('cart');
    window.location.href = '/orders.html';
  } else {
    alert('Failed to place order: ' + result.error);
  }
}

document.getElementById('checkout').onclick = checkout;
loadCart();
