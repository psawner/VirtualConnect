document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const rememberMeCheckbox = document.getElementById("rememberMe");
  const loginBtn = document.getElementById("loginBtn");

  const rememberedEmail = localStorage.getItem("rememberedEmail");
  if (rememberedEmail) {
    form.email.value = rememberedEmail;
    rememberMeCheckbox.checked = true;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    loginMessage.textContent = "";

    // Replace button text with loader
    const originalBtnContent = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span class="button-spinner"></span>`;

    const email = form.email.value;
    const password = form.password.value;

    try {
      const response = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (rememberMeCheckbox.checked) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }

        loginMessage.style.color = "green";
        loginMessage.textContent = data.message;

        // Redirect after a slight delay
        setTimeout(() => {
          window.location.href = "dashboard/dashboard.html";
        }, 300);
      } else {
        loginMessage.style.color = "red";
        loginMessage.textContent = data.message || "Invalid credentials.";

        // Restore button
        loginBtn.innerHTML = originalBtnContent;
        loginBtn.disabled = false;
      }
    } catch (error) {
      console.error("Login failed:", error);
      loginMessage.style.color = "red";
      loginMessage.textContent = "An error occurred while logging in.";

      // Restore button
      loginBtn.innerHTML = originalBtnContent;
      loginBtn.disabled = false;
    }
  });
});
