let countdownTimer = null;
let activeConferenceId = null;

async function getLoggedInUser() {
  const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
    
    credentials: "include" // ✅ Send session cookie
  });

  if (!res.ok) throw new Error("Session expired");

  const user = await res.json();
  return user;
}



let currentUser = null;

async function loadProfile() {
  try {
    currentUser = await getLoggedInUser(); // ✅ reuse

    document.getElementById('profileData').innerHTML = `
      <p><strong>Name:</strong> ${currentUser.name || 'N/A'} ${currentUser.role === 'host' ? '<span style="color: green; font-weight: bold;">(Host)</span>' : ''}</p>
      <p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p>
      <p><strong>Role:</strong> ${currentUser.role || 'N/A'}</p>
    `;

    await loadConferences(); // If needed

  } catch (err) {
    console.error(err.message);
    alert("You are not logged in. Please login.");
    window.location.href = "../index.html";
  }
}





function showSection(id) {
    document.querySelectorAll('.section').forEach(div => div.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }





  async function loadConferences() {
    const tbody = document.getElementById("conferenceTable");
  
    try {
      const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/conference/all", {
        credentials: "include"
      });
  
      const data = await res.json();
      tbody.innerHTML = "";
  
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No conferences scheduled.</td></tr>`;
      } else {
        data.forEach(conf => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${conf.title}</td>
            <td>${new Date(conf.datetime).toLocaleDateString('en-GB')} ${new Date(conf.datetime).toLocaleTimeString()}</td>
            <td>${conf.duration} minutes</td>
            <td>${conf.description}</td>
          `;
          row.addEventListener("click", () => showCard(conf, currentUser));
          tbody.appendChild(row);
        });
      }
  
    } catch (err) {
      console.error("Failed to fetch conferences:", err);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error loading conferences.</td></tr>`;
    }
  }
  







  document.addEventListener("DOMContentLoaded", async () => {
    await new Promise(res => setTimeout(res, 100)); // Wait 100ms

   
  
    // ========== 1. Get Logged In User ==========
    try {
      const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
        credentials: "include"
      });
  
      if (!res.ok) throw new Error("Not logged in");
      currentUser = await res.json();
  
      // Show profile
      document.getElementById("profileData").innerHTML = `
        <p><strong>Name:</strong> ${currentUser.name} ${currentUser.role === 'host' ? '<span style="color:green;font-weight:bold;">(Host)</span>' : ''}</p>
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <p><strong>Role:</strong> ${currentUser.role}</p>
      `;
  
    } catch (err) {
      console.error("Login error:", err.message);
      alert("You are not logged in. Redirecting to login...");
      window.location.href = "../index.html";
      return;
    }
  
    // ========== 2. Load Conferences ==========
    await loadConferences();

  
    // ========== 3. Host: Conference Creation ==========
    const form = document.getElementById("conferenceForm");
    const message = document.getElementById("conferenceMessage");
  
    if (currentUser.role !== "host") {
      message.style.color = "red";
      message.innerHTML = "🚫 Only hosts can create conferences.";
      form.style.display = "none";
      return;
    }
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const title = form.title.value;
      const datetime = form.datetime.value;
      const duration = form.duration.value;
      const description = form.description.value;
      const hostEmail = currentUser.email;
  
      try {
        const response = await fetch("https://virtualbackend-fmsl.onrender.com/api/conference/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title, datetime, duration, description, hostEmail })
        });
  
        const data = await response.json();
  
        if (response.ok) {
          message.style.color = "green";
          message.innerHTML = `✅ ${data.message || "Conference created!"}<br><strong>ID:</strong> ${data.id}`;
          form.reset();
        } else {
          message.style.color = "red";
          message.textContent = data.message || "Failed to create conference.";
        }
      } catch (error) {
        console.error("Conference creation error:", error);
        message.style.color = "red";
        message.textContent = "An error occurred.";
      }
    });
  
  });



  function showCard(conf, user) {
    const card = document.getElementById("previewCard");
    card.style.display = "block";
  
    console.log("🔍 Showing card for:", conf);
    console.log("🙋 Passed user:", user);
  
    let buttonsHTML = "";
    if (!user) {
      card.innerHTML = "<p style='color:red;'>User not loaded. Please refresh the page.</p>";
      return;
    }
    
    if (user && user.role === "host") {
      buttonsHTML = `
        <button onclick="enterEditMode(${JSON.stringify(conf).replace(/"/g, '&quot;')})">Edit</button>
        <button onclick="deleteConference(${conf.id})">Delete</button>
        <button onclick="goToManageSection(${conf.id})">Manage Participants</button>
        
      `;
    }
  
    card.innerHTML = `
      <div class="conference-title">${conf.title}</div>
      <div class="conference-info"><strong>Date:</strong> ${new Date(conf.datetime).toLocaleString()}</div>
      <div class="conference-info"><strong>Duration:</strong> ${conf.duration} minutes</div>
      <div class="conference-info"><strong>Description:</strong> ${conf.description}</div>
      <div class="card-buttons">${buttonsHTML}</div>
    `;
  }
  
  
  

  
  

  function enterEditMode(conf) {
    const card = document.getElementById("previewCard");
  
    card.innerHTML = `
      <input type="hidden" id="edit-id" value="${conf.id}" />
      <input type="text" id="edit-title" value="${conf.title}" placeholder="Title" required />
      <input type="datetime-local" id="edit-datetime" value="${conf.datetime.slice(0, 16)}" required />
      <input type="number" id="edit-duration" value="${conf.duration}" placeholder="Duration (min)" required />
      <textarea id="edit-description" placeholder="Description" required>${conf.description}</textarea>
      
      <div class="card-buttons">
        <button onclick="updateConference()">Update</button>
        <button onclick="showCard(${JSON.stringify(conf).replace(/"/g, '&quot;')})">Cancel</button>
      </div>
    `;
  }
  
  async function updateConference() {
    const id = document.getElementById("edit-id").value;
    const updated = {
      title: document.getElementById("edit-title").value,
      datetime: document.getElementById("edit-datetime").value,
      duration: document.getElementById("edit-duration").value,
      description: document.getElementById("edit-description").value
    };
  
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/conference/${id}`, {
        method: "PUT",
        credentials: "include", // ✅ Include session cookie
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updated)
      });
  
      const data = await res.json();
  
      if (res.ok) {
        alert("Conference updated successfully!");
        location.reload(); // Or re-fetch and re-render list
      } else {
        alert(data.message || "Failed to update conference.");
      }
    } catch (err) {
      console.error("Error updating conference:", err);
      alert("Session expired or server error. Please login again.");
      window.location.href = "../index.html";
    }
  }
  
  
  async function deleteConference(id) {
    if (!confirm("Are you sure you want to delete this conference?")) return;
  
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/conference/${id}`, {
        method: "DELETE",
        credentials: "include" // ✅ Include session cookie
      });
  
      const data = await res.json();
  
      if (res.ok) {
        alert("Deleted successfully.");
        location.reload(); // Refresh to show changes
      } else {
        alert(data.message || "Failed to delete the conference.");
      }
    } catch (err) {
      console.error("Error deleting conference:", err);
      alert("Session expired or server error. Please login again.");
      window.location.href = "../index.html";
    }
  }
  
  
  
  


  document.querySelector("button[onclick=\"showSection('profile')\"]")
  .addEventListener('click', () => {
    showSection('profile');
    loadProfile();
  });


  async function logout() {
    try {
      await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/logout", {
        method: "POST",
        credentials: "include" // ✅ send session cookie to properly log out
      });
  
      
      // Redirect to login page after logout
      window.location.href = "../index.html";
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Error during logout. Please try again.");
    }
  }
  

 





const sidebar = document.querySelector('.sidebar');
const main = document.querySelector('.main');

const btn1 = document.querySelector(".toggle-sidebar i"); // ≡ icon button
const btn2 = document.querySelector("#icon i"); // × icon button

// Initially, show only btn1
btn2.style.display = 'none';

btn1.addEventListener('click', () => {
  sidebar.classList.add('visible');
  main.classList.add('shifted');

  btn1.style.display = 'none';
  btn2.style.display = 'inline-block';
});

btn2.addEventListener('click', () => {
  sidebar.classList.remove('visible');
  main.classList.remove('shifted');

  btn2.style.display = 'none';
  btn1.style.display = 'inline-block';
});




  document.getElementById("joinConferenceForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    if (!data.conferenceId || isNaN(parseInt(data.conferenceId))) {
      alert("Please enter a valid conference ID");
      return;
    }
    let user;
  
    console.log("🚀 Data before sending to backend:", data);

    try {
      // Fetch logged-in user with session credentials
      const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
        method: "GET",
        credentials: "include"
      });
  
      if (!res.ok) throw new Error("Not logged in or session expired");
      user = await res.json();
  
      if (user.role !== "participant" && user.role !== "host") {
        alert("Only participants or hosts can join conferences.");
        return;
      }
  
      if (
        data.name.trim().toLowerCase() !== user.name.trim().toLowerCase() ||
        data.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
      ) {
        alert("Name or email doesn't match your logged-in identity. Please use your registered credentials.");
        return;
      }
  
    } catch (err) {
      console.error("❌ Failed to load user:", err);
      alert("Session expired. Please log in again.");
      window.location.href = "../index.html";
      return;
    }
  
    try {
      const confRes = await fetch(`https://virtualbackend-fmsl.onrender.com/api/conference/${data.conferenceId}`);
      if (!confRes.ok) throw new Error("Conference not found.");
      const conference = await confRes.json();
  
      const joinMessage = document.getElementById("joinMessage");
      const now = new Date();
      const confStartTime = new Date(conference.datetime);
      const confEndTime = new Date(confStartTime.getTime() + conference.duration * 60000);
  
      // Participant logic
      if (user.role === "participant") {
        activeConferenceId = data.conferenceId;
  
        if (now >= confEndTime) {
          joinMessage.innerText = "❌ This conference has already ended. You cannot join.";
          return;
        }
  
        if (now < confStartTime) {
          const updateCountdown = () => {
            if (activeConferenceId !== data.conferenceId) {
              clearInterval(countdownTimer);
              return;
            }
  
            const diff = Math.floor((confStartTime - new Date()) / 1000);
            if (diff <= 0) {
              clearInterval(countdownTimer);
              joinMessage.innerText = "✅ Conference has started! Redirecting...";
              setTimeout(() => {
                window.location.href = `/VirtualConnect/join-conference/join-conference.html?conferenceId=${encodeURIComponent(data.conferenceId)}&email=${encodeURIComponent(user.email)}`;
              }, 1000);
              return;
            }
  
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            joinMessage.innerText = `⏳ Conference starts in ${mins} min ${secs} sec. Please wait...`;
          };
  
          updateCountdown();
          countdownTimer = setInterval(updateCountdown, 1000);
          return;
        }
  
        // If ongoing
        joinMessage.innerText = "Joining... Redirecting...";
        setTimeout(() => {
          window.location.href = `/VirtualConnect/join-conference/join-conference.html?conferenceId=${encodeURIComponent(data.conferenceId)}&email=${encodeURIComponent(user.email)}`;
        }, 1000);
        return;
      }
  
      // Host logic
      if (user.role === "host") {
        if ((conference.host_email || "").trim().toLowerCase() !== user.email.trim().toLowerCase()) {
          joinMessage.innerText = "❌ You can only join your own hosted conference.";
          return;
        }
  
        if (now > confEndTime) {
          joinMessage.innerText = "❌ This conference has already ended. You cannot join.";
          return;
        }
  
        joinMessage.innerText = "✅ Host joining... Redirecting";
        setTimeout(() => {
          window.location.href = `/VirtualConnect/join-conference/join-conference.html?conferenceId=${encodeURIComponent(data.conferenceId)}&email=${encodeURIComponent(user.email)}`;
        }, 1000);
        return;
      }
  
      // Check if already joined
      const existingCheck = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${data.conferenceId}`);
      const participants = await existingCheck.json();
      const alreadyJoined = participants.some(p => p.email === user.email);
  
      if (alreadyJoined) {
        joinMessage.innerText = "Already joined. Redirecting...";
        setTimeout(() => {
          window.location.href = `/VirtualConnect/join-conference/join-conference.html?conferenceId=${encodeURIComponent(data.conferenceId)}&email=${encodeURIComponent(user.email)}`;
        }, 1000);
        return;
      }
  
      // Register as participant
      const response = await fetch("https://virtualbackend-fmsl.onrender.com/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include", // ✅ include session cookie
        //body: JSON.stringify({ ...data })
        body: JSON.stringify({
          conferenceId: parseInt(data.conferenceId, 10),
          email: data.email,
          name: data.name
        })
        
      });
  
      if (response.ok) {
        joinMessage.innerText = "Joined! Redirecting...";
        setTimeout(() => {
          window.location.href = `/VirtualConnect/join-conference/join-conference.html?conferenceId=${encodeURIComponent(data.conferenceId)}&email=${encodeURIComponent(user.email)}`;
        }, 1000);
      } else {
        const error = await response.json();
        joinMessage.innerText = error.message || "Failed to join.";
      }
  
    } catch (err) {
      console.error("Join Conference Error:", err);
      document.getElementById("joinMessage").innerText = "Error: " + err.message;
    }
  });
  

  
  


  

  async function loadParticipants() {
    const conferenceId = document.getElementById("manageConfId").value.trim();
    if (!conferenceId) return alert("Please enter a Conference ID");
  
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${conferenceId}`, {
        method: "GET",
        credentials: "include" // ✅ Send session cookie
      });
  
      if (!res.ok) {
        throw new Error("Failed to fetch participants. Are you logged in?");
      }
  
      const participants = await res.json();
      const tableBody = document.getElementById("participantTable");
      tableBody.innerHTML = "";
  
      participants.forEach(p => {
        const row = document.createElement("tr");
      
        // 👇 Determine if edit/remove buttons should be shown
        const isEditable = p.status !== "joined"; // you may change logic depending on your backend value
      
        let actions = "";
      
        if (isEditable) {
          actions = `
            <button id="edit-btn-${p.id}" onclick="enableEdit(${p.id})">Edit</button>
            <button style="display: none;" id="save-btn-${p.id}" onclick="saveName(${p.id})">Save</button>
            <button onclick="removeParticipant(${p.id})">Remove</button>
          `;
        } else {
          actions = `<span>✅ Joined</span>`;
        }
      
        row.innerHTML = `
          <td>
            <span id="name-display-${p.id}" style="display: inline;">${p.name || "No Name"}</span>
            <input type="text" id="name-input-${p.id}" value="${p.name || ""}" style="display: none;" />
          </td>
          <td>${p.email}</td>
          <td>${actions}</td>
        `;
      
        tableBody.appendChild(row);
      });
      
  
    } catch (error) {
      console.error("Error loading participants:", error);
      alert("Session expired or not logged in. Please login again.");
      window.location.href = "../index.html";
    }
  }
  
  





  async function updateStatus(id, status) {
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${id}/status`, {
        method: 'PUT',
        credentials: 'include', // ✅ Send session cookie
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
  
      const result = await res.json();
  
      if (res.ok) {
        alert(`Participant ${status}`);
        loadParticipants(); // 🔁 Reload participant list
      } else {
        alert(result.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating participant status:", err);
      alert("Session expired or not logged in. Please login again.");
      window.location.href = "../index.html";
    }
  }

  

  
  
  function enableEdit(id) {
    document.getElementById(`name-display-${id}`).style.display = "none";
    document.getElementById(`name-input-${id}`).style.display = "inline";
    document.getElementById(`edit-btn-${id}`).style.display = "none";
    document.getElementById(`save-btn-${id}`).style.display = "inline";
  }
  
  async function saveName(id) {
    const nameInput = document.getElementById(`name-input-${id}`);
    const newName = nameInput.value.trim();
  
    if (!newName) {
      alert("Name cannot be empty");
      return;
    }
  
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${id}`, {
        method: "PUT",
        credentials: "include", // ✅ Send session cookie
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newName })
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        alert(data.error || "Failed to update name");
        return;
      }
  
      // ✅ Update UI on success
      document.getElementById(`name-display-${id}`).textContent = newName;
      document.getElementById(`name-display-${id}`).style.display = "inline";
      document.getElementById(`name-input-${id}`).style.display = "none";
      document.getElementById(`edit-btn-${id}`).style.display = "inline";
      document.getElementById(`save-btn-${id}`).style.display = "none";
    } catch (err) {
      console.error("Error updating name:", err);
      alert("Session expired or not logged in. Please login again.");
      window.location.href = "../index.html";
    }
  }

  

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  
  

  async function updateParticipant(id) {
    const nameInput = document.getElementById(`name-${id}`);
    const name = nameInput.value.trim();
  
    if (!name) return alert("Name cannot be empty");
  
    try {
      const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${id}`, {
        method: "PUT",
        credentials: "include", // ✅ Send session cookie
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        alert(data.error || "Failed to update name");
      } else {
        alert("Participant name updated");
        loadParticipants();
      }
    } catch (err) {
      console.error("Update error:", err);
      alert("Session expired or server error. Please login again.");
      window.location.href = "../index.html";
    }
  }
  
  
  async function addParticipant() {
    const conferenceId = document.getElementById("manageConfId").value.trim();
    const name = document.getElementById("participantName").value.trim();
    const email = document.getElementById("participantEmail").value.trim();
  
    if (!conferenceId || !email) {
      return alert("Please enter Conference ID and Email");
    }
  
    try {
      const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/participants", {
        method: "POST",
        credentials: "include", // ✅ Send session cookie
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ conferenceId, email, name, status: "pending" })
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        alert(data.error || "Failed to add participant");
        return;
      }
  
      // Clear form
      document.getElementById("participantEmail").value = "";
      document.getElementById("participantName").value = "";
  
      // Reload participant list
      loadParticipants();
    } catch (err) {
      console.error("Add error:", err);
      alert("Session expired or server error. Please login again.");
      window.location.href = "../index.html";
    }
  }
  
  
  
 // ===================== REMOVE PARTICIPANT =====================
async function removeParticipant(id) {
  try {
    const res = await fetch(`https://virtualbackend-fmsl.onrender.com/api/participants/${id}`, {
      method: "DELETE",
      credentials: "include" // ✅ Send session cookie
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to remove participant");
      return;
    }

    loadParticipants();
  } catch (err) {
    console.error("Remove error:", err);
    alert("Session expired or server error.");
    window.location.href = "../index.html";
  }
}


// ===================== SHOW SECTION =====================
async function showSection(id) {
  const isHost = await checkHostAccess();

  if (id === 'manage' && !isHost) {
    alert("Access denied: Only hosts can manage participants.");
    return;
  }

  document.querySelectorAll('.section').forEach(div => div.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}


// ===================== CHECK HOST ACCESS =====================
async function checkHostAccess() {
  try {
    const res = await fetch('https://virtualbackend-fmsl.onrender.com/api/auth/me', {
      credentials: "include" // ✅ Send session cookie
    });

    if (!res.ok) {
      console.warn("User not logged in or session expired");
      return false;
    }

    const user = await res.json();
    return user.role === 'host';
  } catch (err) {
    console.error("checkHostAccess error:", err);
    return false;
  }
}


// ===================== GO TO MANAGE SECTION =====================
function goToManageSection(confId) {
  // Show the manage section
  showSection('manage');

  // Set the conference ID input
  const input = document.getElementById("manageConfId");
  input.value = confId;

  // Load participants for the given conference
  loadParticipants();

  // Optional: scroll into view (once it's visible)
  setTimeout(() => {
    document.getElementById("manage").scrollIntoView({ behavior: "smooth" });
  }, 100); // small delay ensures it's rendered
}




document.addEventListener("DOMContentLoaded", () => {
  const notificationIcon = document.getElementById("notification");
  const panel = document.getElementById("notificationPanel");
  const joinedList = document.getElementById("joinedList");
  const upcomingList = document.getElementById("upcomingList");
  const badge = document.getElementById("notificationBadge");

  let unjoinedCountGlobal = 0;

  async function updateBadge() {
    try {
      const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/notifications/unseen-upcoming", {
        credentials: "include"
      });

      if (!res.ok) {
        console.warn("Session may have expired while fetching badge");
        badge.style.display = "none";
        return;
      }

      const data = await res.json();

      if (data.unseen && data.unseen.length > 0) {
        badge.textContent = data.unseen.length;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    } catch (err) {
      console.error("Notification badge fetch error:", err);
      badge.style.display = "none";
    }
  }

  // Fetch and update panel data
  async function loadNotifications() {
    try {
      // 1. Fetch unseen notifications
      const unseenRes = await fetch("https://virtualbackend-fmsl.onrender.com/api/notifications/unseen-upcoming", {
        credentials: "include"
      });

      if (!unseenRes.ok) throw new Error("Unauthorized");

      const unseenData = await unseenRes.json();
      const seenIds = (unseenData.unseen || []).map(conf => conf.id);

      // 2. Mark unseen as seen
      if (seenIds.length > 0) {
        await fetch("https://virtualbackend-fmsl.onrender.com/api/notifications/mark-seen", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ seenIds })
        });
      }

      // 3. Fetch joined conferences
      const joinedRes = await fetch("https://virtualbackend-fmsl.onrender.com/api/participants/my", {
        credentials: "include"
      });

      if (!joinedRes.ok) throw new Error("Unauthorized");

      const joinedConfs = await joinedRes.json();
      const joinedIds = joinedConfs.map(conf => conf.id);

      joinedList.innerHTML = joinedConfs.length === 0
        ? "<li>No joined conferences yet.</li>"
        : "";

      joinedConfs.forEach(conf => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${conf.title}</strong><br/>
          <small>${new Date(conf.datetime).toLocaleString()}</small>
        `;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => showSection('view'));
        joinedList.appendChild(li);
      });

      // 4. Fetch all conferences
      const allRes = await fetch("https://virtualbackend-fmsl.onrender.com/api/conference/all", {
        credentials: "include"
      });

      if (!allRes.ok) throw new Error("Failed to load conferences");

      const allConfs = await allRes.json();

      const upcomingOnly = allConfs.filter(conf => new Date(conf.datetime).getTime() > Date.now());

      upcomingList.innerHTML = upcomingOnly.length === 0
        ? "<li>No upcoming conferences.</li>"
        : "";

      let unjoinedCount = 0;

      upcomingOnly.forEach(conf => {
        const li = document.createElement("li");
        li.classList.add("notification-item");

        const isJoined = joinedIds.includes(conf.id);
        li.innerHTML = `
          <strong>${conf.title}</strong><br/>
          <small>${new Date(conf.datetime).toLocaleString()}</small>
        `;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => showSection('view'));

        if (!isJoined) unjoinedCount++;
        upcomingList.appendChild(li);
      });

      unjoinedCountGlobal = unjoinedCount;

    } catch (err) {
      console.error("Notification panel error:", err);
      joinedList.innerHTML = "<li>Please log in to see joined conferences.</li>";
      upcomingList.innerHTML = "<li>Please log in to see upcoming conferences.</li>";
    }
  }

  // Show or hide panel and handle logic
  notificationIcon.addEventListener("click", async () => {
    const isVisible = panel.classList.toggle("show");

    if (isVisible) {
      badge.style.display = "none";
      joinedList.innerHTML = "";
      upcomingList.innerHTML = "";
      await loadNotifications();
    }
  });

  document.addEventListener("click", (e) => {
    if (!notificationIcon.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove("show");
    }
  });

  // Initial badge load
  updateBadge();

  // Optional: Poll every 30 seconds for updates (real-time-ish)
  setInterval(updateBadge, 30000);
});

























