function switchTab(tab) {
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

function showAlert(message, type = "error") {
  const alert = document.getElementById("alert");
  alert.textContent = message;
  alert.className = `alert ${type}`;
  alert.style.display = "block";
}

function hideAlert() {
  document.getElementById("alert").style.display = "none";
}

function setLoading(button, loading) {
  const btnText = button.querySelector(".btn-text");
  if (loading) {
    button.disabled = true;
    btnText.innerHTML = '<span class="loading"></span>';
  } else {
    button.disabled = false;
    btnText.textContent = button.id === "login-btn" ? "Sign In" : "Sign Up";
  }
}

async function handleLogin(event) {
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

async function handleRegister(event) {
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
        switchTab("login");
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

// Auto-focus first input
document.getElementById("login-username").focus();
