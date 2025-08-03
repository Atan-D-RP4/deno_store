async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const response = await fetch(`/api/products/${id}`);
  const data = await response.json();
  if (data.success) {
    const product = data.data;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-description').textContent = product.description;
    document.getElementById('product-price').textContent = `Price: $${product.price}`;
    document.getElementById('add-to-cart').onclick = () => addToCart(product.id);
  } else {
    document.getElementById('product-name').textContent = 'Product not found';
  }
}

let cart = JSON.parse(localStorage.getItem('cart')) || [];

function addToCart(productId) {
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  alert('Added to cart');
}

loadProduct();
