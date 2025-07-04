
let currentUser = null;

let timerInterval;
let callStartTime;

let hasJoinedRoom = false;
const socketIdToEmail = {};

function safeJoinRoom() {
  if (!hasJoinedRoom && roomId && email) {
    socket.emit("join-room", { roomId });
    hasJoinedRoom = true;
  }
}

const peerConnections = {}; // Map of socketId => RTCPeerConnection
const remoteStreams = {};   // Map of socketId => MediaStream


async function getLoggedInUser() {
  if (currentUser) return currentUser;

  const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
    credentials: "include"
  });

  if (!res.ok) throw new Error("Session expired");

  currentUser = await res.json();
  return currentUser;
}


async function loadProfileDropdown() {
  try {
    const user = await getLoggedInUser(); // Always fetch latest
    

    // Set text content safely
    document.getElementById("profileName").textContent = user.name || "N/A";
    document.getElementById("profileEmail").textContent = user.email || "N/A";
    document.getElementById("profileRole").textContent = user.role || "N/A";

    // Profile image
    const dropdownPic = document.getElementById("dropdownProfilePic");
    if (dropdownPic && user.image) {
      dropdownPic.src = user.image;
    }

    const topPic = document.getElementById("profilePic");
    if (topPic && user.image) {
      topPic.src = user.image;
    }

  } catch (err) {
    console.error("Dropdown profile load failed:", err.message);
    alert("Session expired. Please login again.");
    window.location.href = "../index.html";
  }
}




document.addEventListener("DOMContentLoaded", () => {
  const profilePic = document.querySelector("#profilePic");
  const profileDropdown = document.querySelector("#profileDropdown");

  if (profileDropdown) profileDropdown.style.display = "none";

  if (profilePic) {
    profilePic.addEventListener("click", async () => {
      if (profileDropdown.style.display === "none") {
        profileDropdown.style.display = "";
        await loadProfileDropdown();
      } else {
        profileDropdown.style.display = "none";
      }
    });
  }

  // Logout handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/logout", {
          method: "POST",
          credentials: "include"
        });
        window.location.href = "../index.html";
      } catch (err) {
        console.error("Logout failed:", err);
        alert("Failed to log out. Try again.");
      }
    });
  }
});



const socket = io("https://virtualbackend-fmsl.onrender.com", {
  withCredentials: true
});

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("conferenceId");

let email = null; // store user email globally

window.onload = async () => {
  try {
    const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
      credentials: "include"
    });

    if (!res.ok) throw new Error("Not logged in");

    const user = await res.json();
    email = user.email;
    currentUser = user;

    if (currentUser.role === "participant") {
      document.getElementById("leaveCall").style.display = "none"; // default hidden
    } else {
      document.getElementById("leaveCall").style.display = "none"; // never shown for host
    }
    
    
    
    // Show/hide buttons based on user role
    if (currentUser.role === "host") {
      endCallBtn.style.display = "inline-block";

      endCallBtn.onclick = () => {
        if (!callStarted) return;

        const confirmed = confirm("Do you really want to end the call?");
        if (!confirmed) return;

        clearInterval(timerInterval);
        document.getElementById("callTimer").textContent = "";
        statusMsg.textContent = "Call ended.";
        callStarted = false;
        localStorage.removeItem("callStarted");

        
        // Stop local stream
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          localStream = null;
          localVideo.srcObject = null;
        }

        // Close all peer connections
        Object.values(peerConnections).forEach(pc => pc.close());
        Object.keys(peerConnections).forEach(id => {
          const videoWrapper = document.getElementById(`video-${id}`)?.parentElement;
          if (videoWrapper && videoWrapper.classList.contains("video-grid-item")) {
             videoWrapper.remove();
          }
          delete peerConnections[id];
        });

        socket.emit("end-call", { roomId });


      };
    } else {
      endCallBtn.style.display = "none";
    }

    // Register socket listeners
    setupSocketListeners();

    // Participant: show Join button if host already started the call
    const callWasStarted = localStorage.getItem("callStarted") === "true";
    if (currentUser.role === "participant" && callWasStarted) {
      document.getElementById("joinCall").style.display = "inline-block";
      statusMsg.textContent = "Call already started. Click Join to connect.";
    }

    if (currentUser.role === "host") {
      startCallBtn.style.display = "inline-block";
      document.getElementById("joinCall").style.display = "none";
    } else {
      startCallBtn.style.display = "none";
      document.getElementById("joinCall").style.display = "none"; // will be shown on "call-started"
    }

    // Join room
    if (roomId && email) {
      socket.emit("join-room", { roomId });
    } else {
      alert("Missing conference info. Please join again from the home page.");
      window.location.href = "dashboard/dashboard.html";
    }

  } catch (err) {
    console.error("Session check failed:", err.message);
    alert("You are not logged in. Please login.");
    window.location.href = "../index.html";
  }

  

};



const localVideo = document.getElementById("localVideo");
const startCallBtn = document.getElementById("startCall");
const endCallBtn = document.getElementById("endCall");
const muteBtn = document.getElementById("muteAudio");
const muteIcon = document.getElementById("muteIcon");
const muteText = document.getElementById("muteText");
const videoBtn = document.getElementById("toggleVideo");
const videoIcon = document.getElementById("videoIcon");
const videoText = document.getElementById("videoText");
const statusMsg = document.getElementById("statusMsg");

let localStream;
let isMuted = false;
let isVideoOff = false;
let callStarted = false;

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// 🎤 Mute/Unmute Microphone
muteBtn.onclick = () => {
  if (!localStream) return;

  isMuted = !isMuted;

  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMuted;
  });

  if (isMuted) {
    muteIcon.className = "fa-solid fa-microphone"; // unmuted icon
    muteText.textContent = "Unmute";
  } else {
    muteIcon.className = "fa-solid fa-microphone-slash"; // muted icon
    muteText.textContent = "Mute";
  }
};

// 📷 Hide/Show Video
videoBtn.onclick = () => {
  if (!localStream) return;

  isVideoOff = !isVideoOff;

  localStream.getVideoTracks().forEach(track => {
    track.enabled = !isVideoOff;
  });

  if (isVideoOff) {
    videoIcon.className = "fa-solid fa-eye"; // Eye open (show video)
    videoText.textContent = "Show Video";
  } else {
    videoIcon.className = "fa-solid fa-eye-slash"; // Eye slash (hide video)
    videoText.textContent = "Hide Video";
  }
};

// 🧠 Mesh-based Socket Events
function setupSocketListeners() {
  socket.on("user-joined", () => {
    statusMsg.textContent = "User joined. You can now start the call if you're the host.";
  });

  // 🔁 For each peer, initiate connection
  socket.on("room-participants", (participants) => {
    participants.forEach(({ id, name }) => {
      socketIdToEmail[id] = name;
      if (id !== socket.id && !peerConnections[id]) {
        createPeerConnection(id);
      }
    });
  });

  

  // 🔌 Incoming offer from another peer
  socket.on("offer", async ({ from, offer }) => {
    createPeerConnection(from);
    const pc = peerConnections[from];
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { roomId, target: from, answer });
  });

  // 💬 Answer received from another peer
  socket.on("answer", async ({ from, answer }) => {
    const pc = peerConnections[from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  // ❄️ ICE Candidate exchange
  socket.on("ice-candidate", async ({ from, candidate }) => {
    const pc = peerConnections[from];
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

// 🧍 Someone new joined
socket.on("participant-joined", ({ all }) => {
  const connectionStatus = document.getElementById("connectionStatus");

  if (all.length >= 2) {
    connectionStatus.textContent = currentUser.role === "host"
      ? "Both participants connected. Starting call..."
      : "You are connected. Please wait for the host to start the call.";

    all.forEach(({ id, name }) => {
      if (id !== socket.id && !peerConnections[id]) {
        socketIdToEmail[id] = name;
        createPeerConnection(id); // This sets up WebRTC peer connection
      }
    });

    // ✅ ADD THIS HERE to auto-hide messages after 2 seconds
    setTimeout(() => {
      if (connectionStatus) connectionStatus.textContent = "";
      statusMsg.textContent = "";
    }, 2000);

  } else {
    connectionStatus.textContent = "Waiting for another participant to join...";
  }
});

  

  // 👋 Someone left
  socket.on("participant-left", ({ all }) => {
    const count = all.length;
    const connectionStatus = document.getElementById("connectionStatus");
    connectionStatus.textContent = count < 2
      ? "Other participant left. Waiting to reconnect..."
      : "Connected";
  });

  // 🟢 Call officially started
socket.on("call-started", () => {
  localStorage.setItem("callStarted", "true");

  if (currentUser.role === "participant") {
    document.getElementById("joinCall").style.display = "inline-block";
    statusMsg.textContent = "Call started by host. Click Join to connect.";
  } else if (currentUser.role === "host") {
    startCallBtn.style.display = "none";

    if (!callStarted) {
      callStarted = true;
      // 👇 Create connections only after knowing who is in the room
      setTimeout(() => {
        startWebRTCAsHost(); // <- this triggers offer sending
      }, 500); // Give time for "room-participants" or "participant-joined"
    }
  }

  // ✅ Enable chat box
  chatInput.disabled = false;
  fileInput.disabled = false;
  chatForm.querySelector("button[type='submit']").disabled = false;

});


  // 🔴 Call ended
  socket.on("call-ended", () => {
    statusMsg.textContent = "Call has been ended by the host.";
    clearInterval(timerInterval);
    document.getElementById("callTimer").textContent = '';
    document.getElementById("joinCall").style.display = "none";
    fullscreenBtn.style.display = "none";

    if (currentUser.role === "participant") {
      document.getElementById("leaveCall").style.display = "none";
    }

    callStarted = false;
    localStorage.removeItem("callStarted");

    // 🧼 Clean all remote videos & peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    Object.keys(peerConnections).forEach(id => {
      const videoWrapper = document.getElementById(`video-${id}`)?.parentElement;
      if (videoWrapper && videoWrapper.classList.contains("video-grid-item")) {
        videoWrapper.remove();
      }
      delete peerConnections[id];
    });
    

    if (localVideo) localVideo.srcObject = null;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }


    // ✅ Clear stored chat for the ended conference
    sessionStorage.removeItem(`chat-${roomId}`);

    // ✅ Disable chat box
    chatInput.disabled = true;
    fileInput.disabled = true;
    chatForm.querySelector("button[type='submit']").disabled = true;


  });
}


async function startWebRTCAsHost() {
  callStarted = true;
  statusMsg.textContent = "Starting call...";

  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    }

    

    setTimeout(async () => {
      // Create missing peer connections first
      for (const id in socketIdToEmail) {
        if (id !== socket.id && !peerConnections[id]) {
          createPeerConnection(id);
        }
      }
    
      // Then send offers
      await sendOffersToAll();
    }, 500);
    

    callStartTime = Date.now();
    timerInterval = setInterval(updateCallTimer, 1000);
    statusMsg.textContent = "Call started.";
    fullscreenBtn.style.display = "inline-block";

  } catch (err) {
    console.error("Error in WebRTC host flow:", err);
    statusMsg.textContent = "Failed to start call.";
    callStarted = false;
  }
}


function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(servers);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }
  

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        target: targetId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    if (!remoteStreams[targetId]) {
      remoteStreams[targetId] = new MediaStream();
    }
    event.streams[0].getTracks().forEach(track => {
      remoteStreams[targetId].addTrack(track);
    });

    let video = document.getElementById(`video-${targetId}`);
    if (!video) {
     const wrapper = document.createElement("div");
     wrapper.className = "video-grid-item";

     video = document.createElement("video");
     video.id = `video-${targetId}`;
     video.autoplay = true;
     video.playsInline = true;

     const label = document.createElement("p");
     label.className = "video-label";
     label.textContent = socketIdToEmail[targetId] || "Guest";


      wrapper.appendChild(video);
      wrapper.appendChild(label);

      document.getElementById("remoteVideos").appendChild(wrapper);
    }


    video.srcObject = remoteStreams[targetId];
  };

  peerConnections[targetId] = pc;
}


async function sendOffersToAll() {
  for (const targetId in peerConnections) {
    const pc = peerConnections[targetId];

    // Add tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    // Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { roomId, target: targetId, offer });
  }
}



startCallBtn.onclick = () => {
  if (callStarted) return;

  callStarted = true;
  statusMsg.textContent = "Host is starting the call...";
  localStorage.setItem("callStarted", "true");

  // Emit event to notify others
  socket.emit("start-call", { roomId });

  setTimeout(() => {
    startWebRTCAsHost();
  }, 500); // or wait for "participant-joined"
};


document.getElementById("joinCall").onclick = async () => {
  if (callStarted) return;

  callStarted = true;
  statusMsg.textContent = "Joining call...";

  try {
    // ✅ 1. Start participant stream
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    }

    // ✅ 2. Emit join again to ensure you're in the room
    safeJoinRoom();

    // ✅ 3. Create peer connections and send offers
    setTimeout(async () => {
      for (const id in socketIdToEmail) {
        if (id !== socket.id && !peerConnections[id]) {
          createPeerConnection(id);
        }
      }

      await sendOffersToAll();
    }, 500);

    // ✅ 4. Start call timer
    callStartTime = Date.now();
    timerInterval = setInterval(updateCallTimer, 1000);

    // ✅ 5. Hide join button, show leave button
    document.getElementById("joinCall").style.display = "none";
    document.getElementById("leaveCall").style.display = "inline-block";
    fullscreenBtn.style.display = "inline-block";

    statusMsg.textContent = "Waiting for host to send offer...";

    // Hide the connection status message after a short delay
setTimeout(() => {
  const connectionStatus = document.getElementById("connectionStatus");
  if (connectionStatus) {
    connectionStatus.textContent = "";
    connectionStatus.display = "none";
  }
  statusMsg.textContent = "";
}, 2000); // hides messages after 2 seconds


  } catch (err) {
    console.error("Error joining call:", err);
    statusMsg.textContent = "Failed to join call.";
    callStarted = false;
  }
};

document.getElementById("leaveCall").onclick = () => {
  // Leave cleanup
  clearInterval(timerInterval);
  callStarted = false;
  localStorage.removeItem("callStarted");

  document.getElementById("callTimer").textContent = '';
  document.getElementById("statusMsg").textContent = "You left the call.";
  document.getElementById("leaveCall").style.display = "none";
  fullscreenBtn.style.display = "none";

  // Close own video and connections
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }

  Object.values(peerConnections).forEach(pc => pc.close());
  Object.keys(peerConnections).forEach(id => {
    const videoWrapper = document.getElementById(`video-${id}`)?.parentElement;
    if (videoWrapper && videoWrapper.classList.contains("video-grid-item")) {
      videoWrapper.remove();
    }
    delete peerConnections[id];
  });
  

  socket.emit("participant-left", { roomId });

  // Optionally redirect or just hide UI
  // window.location.href = 'dashboard/dashboard.html';
};


// TIMER FUNCTION
function updateCallTimer() {
  const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  document.getElementById('callTimer').textContent = `Call Duration: ${minutes}:${seconds}`;
}



const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");


socket.on("chat-message", (data) => {
  const isSelf = data.sender === currentUser?.name;
  appendChat(isSelf ? "You" : data.sender, data.message, isSelf, data.fileData, data.fileName);
});



const screenShareBtn = document.getElementById("screenShareBtn");
const startBtn = document.getElementById("startRecording");
const stopBtn = document.getElementById("stopRecording");
const downloadLink = document.getElementById("downloadLink");

let isScreenSharing = false;
let screenStream;
let mediaRecorder;
let recordedChunks = [];

screenShareBtn.onclick = async () => {
  if (!localStream || Object.keys(peerConnections).length === 0) {
    console.warn("No active peer connections or local stream.");
    return;
  }

  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      for (const id in peerConnections) {
        const sender = peerConnections[id]
          .getSenders()
          .find(s => s.track.kind === "video");

        if (sender) sender.replaceTrack(screenTrack);
      }

      localVideo.srcObject = screenStream;
      screenShareBtn.textContent = "Stop Sharing";
      isScreenSharing = true;

      // Show recording buttons
      startBtn.style.display = "inline-block";
      stopBtn.style.display = "inline-block";
      downloadLink.style.display = "none";
      stopBtn.disabled = true;

      screenTrack.onended = () => {
        stopScreenSharing();
      };

    } catch (err) {
      console.error("Error starting screen sharing:", err);
    }
  } else {
    stopScreenSharing();
  }
};

function stopScreenSharing() {
  const videoTrack = localStream.getVideoTracks()[0];

  for (const id in peerConnections) {
    const sender = peerConnections[id]
      .getSenders()
      .find(s => s.track.kind === "video");

    if (sender) sender.replaceTrack(videoTrack);
  }

  localVideo.srcObject = localStream;

  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
  }

  screenShareBtn.textContent = "Share Screen";
  isScreenSharing = false;

  // Hide all recording UI
  startBtn.style.display = "none";
  stopBtn.style.display = "none";
  downloadLink.style.display = "none";

  // Stop recording if still running
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}



// ==== Emoji Picker Logic ====
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");


emojiBtn.onclick = () => {
  if (!emojiPicker) return;
  emojiPicker.style.display = emojiPicker.style.display === "none" ? "block" : "none";
};

emojiPicker.addEventListener("emoji-click", (event) => {
  chatInput.value += event.detail.unicode;
  emojiPicker.style.display = "none";
  chatInput.focus();
});




const fileInput = document.getElementById("fileInput");

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const message = chatInput.value.trim();
  const file = fileInput.files[0];

  if (!message && !file) return;

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const fileData = reader.result;

      socket.emit("chat-message", {
        roomId,
        message,
        fileData,
        fileName: file.name,
        fileType: file.type
      });

      appendChat("You", message, true, fileData, file.name);

      chatInput.value = "";
      fileInput.value = "";
    };
    reader.readAsDataURL(file);
  } else {
    socket.emit("chat-message", { roomId, message });
    appendChat("You", message, true);
    chatInput.value = "";
  }
});

function appendChat(sender, message, isSelf = false, fileData = null, fileName = "") {
  const msgWrapper = document.createElement("div");
  msgWrapper.classList.add("chat-message", isSelf ? "you" : "other");

  const msgBubble = document.createElement("div");
  msgBubble.classList.add("msg-bubble");

  // 👤 Small sender name (top-left)
  if (!isSelf) {
    const senderSmall = document.createElement("div");
    senderSmall.className = "sender-name";
    senderSmall.textContent = sender;
    msgBubble.appendChild(senderSmall);
  }

  // 📎 File logic (image or other)
  if (fileData && fileName) {
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
      const link = document.createElement("a");
      link.href = fileData;
      link.target = "_blank";
      link.download = fileName;

      const img = document.createElement("img");
      img.src = fileData;
      img.alt = fileName;
      img.className = "chat-image";

      link.appendChild(img);
      msgBubble.appendChild(link);
    } else {
      const link = document.createElement("a");
      link.href = fileData;
      link.target = "_blank";
      link.download = fileName;
      link.className = "file-download";
      link.textContent = `📎 ${fileName} (click to open/download)`;

      msgBubble.appendChild(link);
    }
  }

  // 💬 Text
  if (message) {
    const textPara = document.createElement("p");
    textPara.className = "chat-text";
    textPara.textContent = message;
    msgBubble.appendChild(textPara);
  }

  // ⏰ Time
  const time = document.createElement("span");
  time.className = "timestamp";
  const now = new Date();
  time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgWrapper.appendChild(msgBubble);
  msgWrapper.appendChild(time);

  chatBox.appendChild(msgWrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

   
  

}




const participantsList = document.getElementById("participantsList");
const participantHeader = document.createElement("p");
participantHeader.textContent = "👤 Showing participant count or roles";
participantHeader.style.fontWeight = "bold";
participantsList.parentElement.insertBefore(participantHeader, participantsList);

if (roomId) {
  socket.emit("join-room", roomId);
}

socket.on("room-participants", (participants) => {

  console.log("Participants received:", participants); // 👈 Add this line
  participantsList.innerHTML = "";
  const seen = new Set();
  participantHeader.textContent = `👤 ${participants.length} Participant(s)`;

  if (Array.isArray(participants)) {
    participants.forEach(p => {
      let name = "Unknown";
      let role = "";

      if (typeof p === "object" && p.name) {
        name = p.name;
        role = (p.role === "host") ? "(host)" : ""; // Only show host role
      } else if (typeof p === "string") {
        name = p;
      }

      if (!seen.has(name)) {
        seen.add(name);

        const li = document.createElement("li");
        li.textContent = `${name} ${role}`;
        li.classList.add("pop-in");
        participantsList.appendChild(li);
      }
    });
  } else {
    console.warn("Invalid participants list received:", participants);
  }
});



// Ensure video container is wrapped correctly
const fullscreenBtn = document.getElementById("fullscreenBtn");
const videoGridContainer = document.getElementById("videoGridContainer");

// Fix black screen issue by requesting fullscreen on a container that has video elements
fullscreenBtn.onclick = () => {
  if (!document.fullscreenElement) {
    videoGridContainer.requestFullscreen().then(() => {
      fullscreenBtn.style.display = "none"; // hide during fullscreen
    });
  } else {
    document.exitFullscreen();
  }
};

// On fullscreen exit, show button again only if call is active
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && callStarted && localStream) {
    fullscreenBtn.style.display = "inline-block";
  }
});




const toggleBtnn = document.getElementById("themeToggle");
  toggleBtnn.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    document.body.classList.toggle("light-theme");
  });

  // Optional: set default theme
  document.body.classList.add("light-theme");




  function showNotification(message) {
    const note = document.createElement("div");
    note.innerText = message;
    note.style.background = "#007bff";
    note.style.color = "white";
    note.style.padding = "10px 20px";
    note.style.borderRadius = "8px";
    note.style.marginBottom = "10px";
    note.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    note.style.animation = "fadeIn 0.5s ease-out";

    document.getElementById("notificationContainer").appendChild(note);

    setTimeout(() => {
      note.style.opacity = "0";
      setTimeout(() => note.remove(), 500);
    }, 3000);
  }




  startBtn.addEventListener("click", async () => {
    try {
      const screenTracks = isScreenSharing && screenStream
        ? screenStream.getVideoTracks()
        : (await navigator.mediaDevices.getDisplayMedia({ video: true })).getVideoTracks();
  
      const micTracks = localStream
        ? localStream.getAudioTracks()
        : (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks();
  
      const combinedStream = new MediaStream([...screenTracks, ...micTracks]);
  
      mediaRecorder = new MediaRecorder(combinedStream);
      recordedChunks = [];
  
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
  
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = "recording.webm";
        downloadLink.style.display = "inline";
  
        // Clean up if needed later: URL.revokeObjectURL(url);
      };
  
      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      downloadLink.style.display = "none";
    } catch (err) {
      console.error("Recording error:", err);
      alert("Failed to start recording. Please allow screen/mic access.");
    }
  });
  
  stopBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  });
  

document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById("adminToggleBtn");
  const sidebar = document.getElementById("adminSidebar");
  const closeBtn = document.getElementById("closeSidebarBtn");

  toggleBtn.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });

  closeBtn.addEventListener("click", function () {
    sidebar.classList.remove("open");
  });
});



let isHost = false; // default
window.addEventListener("load", async () => {
  try {
    const res = await fetch("https://virtualbackend-fmsl.onrender.com/api/auth/me", {
      credentials: "include"
    });

    if (!res.ok) throw new Error("Not logged in");

    const user = await res.json();
    email = user.email;
    isHost = user.role === "host";

    if (isHost) {
      adminSidebar.style.display = "";
    } else {
      adminSidebar.style.display = "none"; // hide for others
    }

    socket.emit("join-room", { roomId, name: email });
    socket.on("room-locked", () => {
      alert("This conference is locked. You cannot join.");
      window.location.href = "../index.html"; // or redirect to a safe page
    });
    

  } catch (err) {
    console.error("Admin session check failed:", err.message);
    alert("You are not logged in.");
    window.location.href = "../index.html";
  }
});


const adminSidebar = document.getElementById("adminSidebar");
const participantsAdminList = document.getElementById("participantsAdminList");



// 👥 Handle participant list updates
socket.on("participant-joined", ({ all }) => {
  updateAdminList(all);
});

socket.on("participant-left", ({ all }) => {
  updateAdminList(all);
});


// 🎯 Update the sidebar with participant info (excluding host)
function updateAdminList(participants) {
  participantsAdminList.innerHTML = "";

  participants.forEach((p) => {
    if (p.name === email) return; // ✅ Skip the admin

    const entry = document.createElement("div");
    entry.innerHTML = `
      <span>${p.name}</span>
      <button class="kick-btn" data-id="${p.id}">Kick</button>
      <button class="mute-btn" data-id="${p.id}">Mute</button>
    `;
    participantsAdminList.appendChild(entry);
  });

  // Bind events after inserting buttons
  document.querySelectorAll(".kick-btn").forEach((btn) => {
    btn.addEventListener("click", () => kickParticipant(btn.dataset.id));
  });

  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.addEventListener("click", () => muteParticipant(btn.dataset.id));
  });
}

// 🦶 Kick participant
function kickParticipant(socketId) {
  socket.emit("admin-kick", socketId);
}

// 🔇 Mute participant
function muteParticipant(socketId) {
  socket.emit("admin-mute", socketId);
}


// 🔐 Lock conference (placeholder)
const lockBtn = document.getElementById("lockConferenceBtn");
if (lockBtn) {
  lockBtn.addEventListener("click", () => {
    if (isHost) {
      socket.emit("lock-conference");
      alert("🔒 Conference is now locked. No new participants can join.");
    }
  });
}


// ❌ End call for all
const endBtn = document.getElementById("endCallForAllBtn");
if (endBtn) {
  endBtn.addEventListener("click", () => {
    socket.emit("end-call-for-all");
    alert("Call ended for everyone.");
  });
}

// 🛑 If kicked
socket.on("kick", () => {
  alert("You have been removed from the conference.");
  window.location.href = "../index.html"; // Redirect home
});

// 🔇 If muted
socket.on("mute", () => {
  if (typeof localStream !== "undefined" && localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    alert("You have been muted by the host.");
  }
});

socket.on("conference-locked", () => {
  alert("🔒 The host has locked the conference. No new participants can join now.");
});



function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  const container = document.getElementById('notificationContainer');
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}



document.getElementById("raiseHandBtn").addEventListener("click", () => {
  socket.emit("raise-hand");
  showToast("You raised your hand ✋");
});

socket.on("user-raised-hand", (name) => {
  if (name !== email) {
    showToast(`${name} raised their hand ✋`);
  }
});









const notifySound = document.getElementById("notifySound");

function playNotificationSound() {
  notifySound.currentTime = 0;
  notifySound.play();
}

socket.on("chat-message", (msg) => {
  // Append message to UI
  playNotificationSound();
});
socket.on("user-joined", (name) => {
  playNotificationSound();
  showToast(`${name} joined the room`);
});

function renderAdminList(users) {
  participantsAdminList.innerHTML = '';
  for (const id in users) {
    const name = users[id];
    const p = document.createElement("p");
    p.innerHTML = `${name} <button onclick="kickUser('${id}')">Kick</button>`;
    participantsAdminList.appendChild(p);
  }
}







const connectionStatus = document.getElementById("connectionStatus");
const originalOffset = connectionStatus.offsetTop;

window.addEventListener("scroll", () => {
  if (window.scrollY > originalOffset) {
    connectionStatus.classList.add("hidden");
  } else {
    connectionStatus.classList.remove("hidden");
  }
});












