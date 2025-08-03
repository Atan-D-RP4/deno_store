async function loadOrders() {
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

loadOrders();
