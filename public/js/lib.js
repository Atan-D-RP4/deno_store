export function showAlert(message, type = "error") {
  const alert = document.getElementById("alert");
  alert.textContent = message;
  alert.className = `alert ${type} show`;
  setTimeout(() => {
    alert.classList.remove("show");
  }, 5000);
}

export function hideAlert() {
  document.getElementById("alert").style.display = "none";
}

export function setLoading(button, loading) {
  const btnText = button.querySelector(".btn-text");
  if (loading) {
    button.disabled = true;
    btnText.innerHTML = '<span class="loading"></span>';
  } else {
    button.disabled = false;
    btnText.textContent = button.id === "login-btn" ? "Sign In" : "Sign Up";
  }
}

export async function handleLogout() {
  try {
    const response = await fetch("/api/logout", { method: "POST" });
    const result = await response.json();

    if (result.success) {
      showAlert("Logged out successfully. Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1000);
    } else {
      throw new Error("Logout failed");
    }
  } catch (error) {
    showAlert("Logout failed. Please try again.");
  }
}

export function addToCart(productId) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(item => item.productId === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ productId, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    alert('Added to cart');
}

export async function loadCart() {
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

export function removeFromCart(productId) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart = cart.filter(item => item.productId !== productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  loadCart();
}

export async function checkout() {
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

export async function loadOrders() {
  const response = await fetch("/api/orders");
  const data = await response.json();
  const ordersDiv = document.getElementById("orders");
  if (data.success) {
    data.data.forEach((order) => {
      const orderElement = document.createElement("div");
      orderElement.innerHTML = `
        <h2>Order #${order.id}</h2>
        <p>Total: $${order.total_amount}</p>
        <p>Status: ${order.status}</p>
        <p>Placed: ${order.created_at}</p>
        <ul>
          ${
        order.items.map((item) =>
          `<li> <strong>${item.product.name}</strong> - $${item.product.price} x ${item.quantity} </li>`
        ).join("")
      }
        </ul>
      `;
      ordersDiv.appendChild(orderElement);
    });
  }
}

export async function loadProduct() {
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

export async function loadProducts() {
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

export async function handleLogin(event) {
  event.preventDefault();
  hideAlert();

  const button = document.getElementById("login-btn");
  setLoading(button, true);

  const formData = new FormData(event.target);
  const data = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      showAlert("Login successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1000);
    } else {
      showAlert(result.error || "Login failed");
    }
  } catch (error) {
    showAlert("Network error. Please try again.");
  } finally {
    setLoading(button, false);
  }
}

export async function handleRegister(event) {
  event.preventDefault();
  hideAlert();

  const button = document.getElementById("register-btn");
  setLoading(button, true);

  const formData = new FormData(event.target);
  const data = {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const request = new Request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  try {
    const response = await fetch(request);
    const result = await response.json();
    console.log(request);
    console.log(result);

    if (result.success) {
      showAlert("Registration successful! You can now sign in.", "success");
      setTimeout(() => {
        switchTab(event, "login");
        document.getElementById("login-username").value = data.username;
      }, 1500);
    } else {
      showAlert(result.error || "Registration failed");
    }
  } catch (error) {
    showAlert("Network error. Please try again.");
  } finally {
    setLoading(button, false);
  }
}

export function switchTab(event, tab) {
  // Update tabs
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.remove("active")
  );
  event.target.classList.add("active");

  // Update forms
  document.querySelectorAll(".form-section").forEach((f) =>
    f.classList.remove("active")
  );
  document.getElementById(tab + "-form").classList.add("active");

  // Clear alert
  hideAlert();
}
