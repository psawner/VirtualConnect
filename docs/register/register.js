// register.js
/*
document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries()); // name, email, password, role

  try {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ✅ Needed for session cookie
      body: JSON.stringify(data)
    });

    const result = await res.json();
    const msgEl = document.getElementById('registerMessage');

    if (res.ok) {
      msgEl.style.color = 'green';
      msgEl.textContent = result.message || "Registered successfully!";

      // ✅ Delay to ensure session is stored before redirect
      setTimeout(() => {
        window.location.href = "../index.html";
      }, 300);
    } else {
      msgEl.style.color = 'red';
      msgEl.textContent = result.message || "Registration failed.";
    }

  } catch (err) {
    console.error('Error:', err);
    document.getElementById('registerMessage').innerText = 'Something went wrong';
  }
});
*/

document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const registerBtn = document.getElementById('registerBtn');
  const originalBtnContent = registerBtn.innerHTML;
  const msgEl = document.getElementById('registerMessage');

  // Show loader in button
  registerBtn.disabled = true;
  registerBtn.innerHTML = `<span class="button-spinner"></span>`;

  try {
    const res = await fetch('https://virtualbackend-fmsl.onrender.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      msgEl.style.color = 'green';
      msgEl.textContent = result.message || "Registered successfully!";

      setTimeout(() => {
        window.location.href = "../index.html";
      }, 300);
    } else {
      msgEl.style.color = 'red';
      msgEl.textContent = result.message || "Registration failed.";

      // Restore button
      registerBtn.innerHTML = originalBtnContent;
      registerBtn.disabled = false;
    }

  } catch (err) {
    console.error('Error:', err);
    msgEl.style.color = 'red';
    msgEl.innerText = 'Something went wrong';

    // Restore button
    registerBtn.innerHTML = originalBtnContent;
    registerBtn.disabled = false;
  }
});
