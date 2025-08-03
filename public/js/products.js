async function loadProducts() {
  const response = await fetch("/api/products");
  const data = await response.json();
  const productsDiv = document.getElementById("products");
  data.data.forEach((product) => {
    const productElement = document.createElement("div");
    productElement.innerHTML = `
      <h2>${product.name}</h2>
      <p>${product.description}</p>
      <p>Price: $${product.price}</p>
      <button onclick="addToCart(${product.id})">Add to Cart</button>
      <a href="/product.html?id=${product.id}">View Details</a>
    `;
    productsDiv.appendChild(productElement);
  });
}

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(productId) {
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Added to cart");
}

loadProducts();
