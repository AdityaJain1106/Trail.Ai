import React, { useState, useRef, useEffect } from "react";
import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  db,
} from "./firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const STORAGE_KEY = "voice-ai-conversations";
const THEME_KEY = "voice-ai-theme";

function createNewConversation(index = 1) {
  const id =
    window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now());
  return {
    id,
    title: `New Chat ${index}`,
    createdAt: Date.now(),
    messages: [],
  };
}

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [theme, setTheme] = useState("light");
  const [inputRows, setInputRows] = useState(2);
  const [selectedFile, setSelectedFile] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auth
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPage, setShowAuthPage] = useState(false);

  const isDark = theme === "dark";

  // ---- Helpers ----
  const base64ToAudioUrl = (base64) => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    return URL.createObjectURL(blob);
  };

  // When there is no user (logged out), show a fresh default conversation
  useEffect(() => {
    if (!user) {
      const firstConv = createNewConversation(1);
      setConversations([firstConv]);
      setCurrentConversationId(firstConv.id);
    }
  }, [user]);

  // Load theme
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  // Save theme
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
        // Auto-close auth page when logged in
        setShowAuthPage(false);
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  // Load conversations from Firestore when user logs in
  // ⚡ Real-time Firestore listener for instant loading
  useEffect(() => {
    if (!user) return;

    setChatLoading(true); // 👈 start loading

    const convsCol = collection(db, "users", user.uid, "conversations");
    const q = query(convsCol, orderBy("createdAt"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setChatLoading(false); // 👈 stop loading

        if (snapshot.empty) {
          const firstConv = createNewConversation(1);
          setConversations([firstConv]);
          setCurrentConversationId(firstConv.id);
          saveConversationToFirestore(firstConv);
          return;
        }

        const loaded = [];
        snapshot.forEach((docSnap) => {
          loaded.push(docSnap.data());
        });

        setConversations(loaded);

        setCurrentConversationId((prev) => {
          const stillExists = loaded.find((c) => c.id === prev);
          return stillExists ? prev : loaded[0].id;
        });
      },
      (error) => {
        console.error("Firestore real-time error:", error);
        setChatLoading(false); // 👈 stop loading on error too
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Current conversation
  const currentConversation =
    conversations.find((c) => c.id === currentConversationId) ||
    conversations[0];
  const messages = currentConversation?.messages || [];

  const updateCurrentConversationMessages = (updater) => {
    if (!currentConversation) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === currentConversation.id
          ? { ...c, messages: updater(c.messages || []) }
          : c
      );

      if (user) {
        const conv = updated.find((c) => c.id === currentConversation.id);
        if (conv) saveConversationToFirestore(conv);
      }

      return updated;
    });
  };

  // --- Chat actions ---
  const handleNewChat = () => {
    const nextIndex = conversations.length + 1;
    const newConv = createNewConversation(nextIndex);
    setConversations((prev) => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    setInputText("");

    // Save in Firestore if logged in
    saveConversationToFirestore(newConv);
  };

  const handleRenameChat = (conv) => {
    const newTitle = window.prompt("Enter new chat name:", conv.title);
    if (!newTitle || !newTitle.trim()) return;

    const updatedTitle = newTitle.trim();

    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, title: updatedTitle } : c))
    );

    // Save updated conversation
    const updatedConv = { ...conv, title: updatedTitle };
    saveConversationToFirestore(updatedConv);
  };

  const clearChatById = (convId) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convId ? { ...c, messages: [] } : c
      );

      if (user) {
        const conv = updated.find((c) => c.id === convId);
        if (conv) saveConversationToFirestore(conv);
      }

      return updated;
    });

    if (convId === currentConversationId) {
      setInputText("");
    }
  };

  const deleteChatById = (convId) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId);

      if (user) {
        deleteConversationFromFirestore(convId);
      }

      if (filtered.length === 0) {
        const newConv = createNewConversation(1);
        setCurrentConversationId(newConv.id);
        if (user) saveConversationToFirestore(newConv);
        return [newConv];
      }

      if (convId === currentConversationId) {
        setCurrentConversationId(filtered[0].id);
      }

      return filtered;
    });
  };

  const saveConversationToFirestore = async (conv) => {
    if (!user) return; // only save per-user when logged in
    try {
      const convRef = doc(db, "users", user.uid, "conversations", conv.id);
      await setDoc(convRef, conv);
    } catch (err) {
      console.error("Error saving conversation to Firestore:", err);
    }
  };

  const deleteConversationFromFirestore = async (convId) => {
    if (!user) return;
    try {
      const convRef = doc(db, "users", user.uid, "conversations", convId);
      await deleteDoc(convRef);
    } catch (err) {
      console.error("Error deleting conversation from Firestore:", err);
    }
  };

  // --- Sending (text or file) ---
  const handleSend = async (textToSend) => {
    const text = textToSend ?? inputText;

    if (!text.trim() && !selectedFile) {
      alert("Please type a message or upload a file.");
      return;
    }
    if (!currentConversation) {
      alert("No active conversation. Create a new chat first.");
      return;
    }

    const displayText = text.trim()
      ? text
      : selectedFile
      ? `📎 ${selectedFile.name}`
      : "";

    if (displayText) {
      updateCurrentConversationMessages((msgs) => [
        ...msgs,
        { role: "user", text: displayText, timestamp: Date.now() },
      ]);
    }

    setLoading(true);
    setInputText("");

    try {
      let response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "question",
          text.trim() ? text : "Summarize this file for me."
        );

        response = await fetch("http://localhost:3000/api/file-chat", {
          method: "POST",
          body: formData,
        });

        setSelectedFile(null);
      } else {
        response = await fetch("http://localhost:3000/api/voice-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });
      }

      const contentType = response.headers.get("Content-Type");
      console.log("Response content-type:", contentType);

      if (!response.ok) {
        let errMsg = `Server error ${response.status}: `;
        try {
          const errData = await response.json();
          console.error("Backend error details:", errData);
          if (errData.error) errMsg += errData.error;
        } catch (e) {
          console.error("Could not parse error JSON:", e);
        }
        alert(errMsg);
        return;
      }

      const data = await response.json();
      console.log("Backend JSON:", data);

      if (!data.audioBase64 || !data.replyText) {
        alert("Server did not return audioBase64 / replyText");
        return;
      }

      const audioUrl = base64ToAudioUrl(data.audioBase64);

      updateCurrentConversationMessages((msgs) => [
        ...msgs,
        {
          role: "ai",
          text: data.replyText,
          audioUrl,
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Network error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Mic / STT ---
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Try Chrome or Edge on desktop."
      );
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      setListening(true);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
      alert("Speech recognition error: " + event.error);
    };
    recognition.onend = () => {
      console.log("Speech recognition stopped");
      setListening(false);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("Transcript:", transcript);
      setInputText(transcript);
      handleSend(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  // --- Theme ---
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // --- Auth handlers ---
  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will set user + close auth page
    } catch (err) {
      console.error("Google login error:", err);
      alert("Login failed: " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleEmailSignup = async () => {
    if (!authEmail || !authPassword) {
      alert("Please enter email and password.");
      return;
    }
    try {
      setAuthLoading(true);
      await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      console.error("Signup error:", err);
      alert(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!authEmail || !authPassword) {
      alert("Please enter email and password.");
      return;
    }
    try {
      setAuthLoading(true);
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      console.error("Login error:", err);
      alert(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ------------- RENDER -------------

  return (
    <div
      className="app-wrapper"
      style={{
        ...styles.appWrapper,
        backgroundColor: isDark ? "#020617" : "#f5f5f5",
        color: isDark ? "#e5e7eb" : "#111827",
      }}
    >
      {/* Backdrop for mobile sidebar */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`app-sidebar ${isMobileSidebarOpen ? "sidebar-open" : ""}`}
        style={{
          ...styles.sidebar,
          borderRight: isDark ? "1px solid #1f2937" : "1px solid #ddd",
          backgroundColor: isDark ? "#020617" : "#ffffff",
        }}
      >
        <div style={styles.sidebarHeader}>
          <h3 style={{ margin: 0 }}>Chats</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={styles.newChatButton} onClick={handleNewChat}>
              ＋ New
            </button>
            {/* Close button only visible on mobile via CSS */}
            <button
              className="sidebar-close-button"
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{
                border: "none",
                padding: "2px 6px",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor: isDark ? "#111827" : "#fee2e2",
                color: isDark ? "#fecaca" : "#b91c1c",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="chat-list" style={styles.chatList}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                ...styles.chatListItem,
                backgroundColor:
                  conv.id === currentConversationId
                    ? isDark
                      ? "#111827"
                      : "#e3f2fd"
                    : "transparent",
              }}
              onClick={() => setCurrentConversationId(conv.id)}
            >
              <div
                style={{
                  flex: 1,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conv.title}
              </div>

              <button
                style={{
                  ...styles.menuButton,
                  color: isDark ? "#e5e7eb" : "#111827",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                }}
              >
                ⋮
              </button>

              {openMenuId === conv.id && (
                <div
                  style={{
                    ...styles.contextMenu,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    borderColor: isDark ? "#374151" : "#ddd",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={{
                      ...styles.contextMenuItem,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                    onClick={() => {
                      handleRenameChat(conv);
                      setOpenMenuId(null);
                    }}
                  >
                    ✏️ Rename
                  </button>

                  <button
                    style={{
                      ...styles.contextMenuItem,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                    onClick={() => {
                      if (window.confirm("Clear all messages in this chat?")) {
                        clearChatById(conv.id);
                        setOpenMenuId(null);
                      }
                    }}
                  >
                    🧹 Clear
                  </button>

                  <button
                    style={{
                      ...styles.contextMenuItem,
                      color: "#f97373",
                    }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete chat "${conv.title}" permanently?`
                        )
                      ) {
                        deleteChatById(conv.id);
                        setOpenMenuId(null);
                      }
                    }}
                  >
                    🗑 Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 🔒 User button fixed at bottom */}
        <div style={styles.sidebarFooter}>
          <button
            style={styles.userButton}
            onClick={() => setShowAuthPage(true)}
          >
            <span style={{ marginRight: 6 }}>👤</span>
            <span style={{ fontSize: 13 }}>
              {user ? user.name || user.email : "Login / Sign up"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="app-main" style={styles.mainArea}>
        {/* Header bar */}
        <div style={styles.headerBar}>
          <div style={styles.logoArea}>
            {/* Hamburger icon (shown on mobile only via CSS) */}
            <button
              className="hamburger-button"
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{
                border: "none",
                padding: "4px 8px",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor: isDark ? "#111827" : "#e5e7eb",
                color: isDark ? "#e5e7eb" : "#111827",
              }}
            >
              ☰
            </button>

            <span style={{ fontSize: "20px", marginRight: "6px" }}>🔊</span>
            <span style={{ fontWeight: "bold" }}>Voice AI Chat</span>
          </div>

          <button
            onClick={toggleTheme}
            style={{
              ...styles.themeToggleButton,
              backgroundColor: isDark ? "#111827" : "#e5e7eb",
              color: isDark ? "#facc15" : "#0f172a",
            }}
          >
            {theme === "light" ? "🌞" : "🌙"}
          </button>
        </div>

        {/* Listening indicator */}
        {listening && (
          <div className="listening-indicator">
            <span className="listening-dot" />
          </div>
        )}

        {/* Main content: either Auth page or Chat page */}
        {showAuthPage ? (
          // ---------- AUTH PAGE ----------
          <div style={styles.authPageWrapper}>
            <div
              style={{
                ...styles.authCard,
                backgroundColor: isDark ? "#020617" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e5e7eb",
              }}
            >
              <h2 style={{ marginBottom: 8 }}>
                {authMode === "login" ? "Login" : "Sign Up"}
              </h2>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Use Google or Email + Password to {authMode}.
              </p>

              <div style={styles.authFieldGroup}>
                <label style={styles.authLabel}>Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{
                    ...styles.authInput,
                    backgroundColor: isDark ? "#020617" : "#ffffff",
                    color: isDark ? "#e5e7eb" : "#111827",
                    borderColor: isDark ? "#1f2937" : "#cbd5e1",
                  }}
                  placeholder="you@example.com"
                />
              </div>

              <div style={styles.authFieldGroup}>
                <label style={styles.authLabel}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{
                    ...styles.authInput,
                    backgroundColor: isDark ? "#020617" : "#ffffff",
                    color: isDark ? "#e5e7eb" : "#111827",
                    borderColor: isDark ? "#1f2937" : "#cbd5e1",
                  }}
                  placeholder="********"
                />
              </div>

              <button
                onClick={
                  authMode === "login" ? handleEmailLogin : handleEmailSignup
                }
                disabled={authLoading}
                style={{
                  ...styles.authPrimaryButton,
                  backgroundColor: "#3b82f6",
                }}
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login"
                  : "Sign Up"}
              </button>

              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                style={{
                  ...styles.authPrimaryButton,
                  marginTop: 8,
                  backgroundColor: "#f97316",
                }}
              >
                Continue with Google
              </button>

              <button
                onClick={() =>
                  setAuthMode((prev) => (prev === "login" ? "signup" : "login"))
                }
                style={styles.authLinkButton}
              >
                {authMode === "login"
                  ? "New here? Create an account"
                  : "Already have an account? Login"}
              </button>

              <button
                onClick={() => setShowAuthPage(false)}
                style={styles.authBackButton}
              >
                ⬅ Back to chat
              </button>

              {user && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  Logged in as {user.name || user.email}{" "}
                  <button
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#f97373",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    onClick={handleLogout}
                  >
                    (Logout)
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // ---------- CHAT PAGE ----------
          <>
            <div
              style={{
                ...styles.chatContainer,
                backgroundColor: isDark ? "#020617" : "#fafafa",
                borderColor: isDark ? "#1f2937" : "#ddd",
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color: isDark ? "#9ca3af" : "#777",
                    fontSize: "14px",
                  }}
                >
                  No messages yet. Start speaking, type a message, or upload a
                  file below.
                </div>
              )}
              {chatLoading ? (
                <div
                  style={{
                    padding: "20px",
                    opacity: 0.7,
                    fontSize: "14px",
                    textAlign: "center",
                  }}
                >
                  Loading your chats...
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.message,
                        alignSelf:
                          m.role === "user" ? "flex-end" : "flex-start",
                        backgroundColor:
                          m.role === "user"
                            ? isDark
                              ? "#2563eb"
                              : "#007bff"
                            : isDark
                            ? "#111827"
                            : "#f1f0f0",
                        color:
                          m.role === "user"
                            ? "#fff"
                            : isDark
                            ? "#e5e7eb"
                            : "#000",
                      }}
                    >
                      <div style={styles.messageText}>
                        <strong>{m.role === "user" ? "You: " : "AI: "}</strong>
                        {m.text}
                      </div>

                      {m.role === "ai" && m.audioUrl && (
                        <audio
                          controls
                          src={m.audioUrl}
                          style={{ marginTop: "6px", width: "100%" }}
                        />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Composer */}
            <div
              style={{
                ...styles.composerWrapper,
                borderTop: isDark ? "1px solid #1f2937" : "1px solid #ddd",
              }}
            >
              {/* Hidden file input */}
              <input
                type="file"
                id="fileUpload"
                accept=".pdf,.txt"
                style={{ display: "none" }}
                onChange={(e) => setSelectedFile(e.target.files[0])}
              />

              <div style={{ width: "100%" }}>
                {/* File name above input */}
                {selectedFile && (
                  <div
                    style={{
                      fontSize: "12px",
                      marginBottom: "6px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: isDark ? "#111827" : "#f1f5f9",
                      color: isDark ? "#9ca3af" : "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      📎 {selectedFile.name}
                    </span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: isDark ? "#f87171" : "#dc2626",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      title="Remove file"
                    >
                      ✖
                    </button>
                  </div>
                )}

                <div style={styles.composerInner}>
                  {/* Plus = open file picker */}
                  <button
                    style={{
                      ...styles.plusButton,
                      backgroundColor: isDark ? "#1f2937" : "#e5e7eb",
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                    onClick={() =>
                      document.getElementById("fileUpload").click()
                    }
                    title="Upload file"
                  >
                    ＋
                  </button>

                  <textarea
                    style={{
                      ...styles.textarea,
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      color: isDark ? "#e5e7eb" : "#111827",
                      borderColor: isDark ? "#1f2937" : "#ddd",
                    }}
                    rows={inputRows}
                    placeholder="Type your message, or use the mic..."
                    value={inputText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInputText(value);
                      const lineCount = value.split("\n").length;
                      const nextRows = Math.max(2, Math.min(8, lineCount));
                      setInputRows(nextRows);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!loading) handleSend();
                      }
                    }}
                  />

                  {/* Mic icon */}
                  <button
                    style={{
                      ...styles.micButton,
                      backgroundColor: listening ? "#dc3545" : "#22c55e",
                    }}
                    onClick={listening ? stopListening : startListening}
                    disabled={loading}
                    title={listening ? "Stop listening" : "Start voice input"}
                  >
                    {listening ? "🛑" : "🎙"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Styles ----
const styles = {
  appWrapper: {
    display: "flex",
    height: "100vh",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  newChatButton: {
    padding: "4px 8px",
    fontSize: "12px",
    borderRadius: "4px",
    border: "1px solid #3b82f6",
    backgroundColor: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
  },
  chatList: {
    flex: 1,
    overflowY: "auto",
    marginTop: "6px",
  },
  chatListItem: {
    display: "flex",
    alignItems: "center",
    padding: "6px 8px",
    borderRadius: "6px",
    marginBottom: "4px",
    cursor: "pointer",
    position: "relative",
  },
  menuButton: {
    marginLeft: "6px",
    fontSize: "16px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  contextMenu: {
    position: "absolute",
    right: "6px",
    top: "26px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    minWidth: "150px",
  },
  contextMenuItem: {
    padding: "6px 10px",
    fontSize: "13px",
    textAlign: "left",
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  sidebarFooter: {
    marginTop: "auto",
    paddingTop: "8px",
    borderTop: "1px solid #374151",
  },
  userButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 13,
  },
  mainArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    padding: "12px 16px",
    boxSizing: "border-box",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  themeToggleButton: {
    border: "none",
    borderRadius: "999px",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "16px",
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
    marginBottom: "8px",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "8px",
  },
  message: {
    maxWidth: "80%",
    padding: "8px 10px",
    borderRadius: "12px",
    fontSize: "14px",
  },
  messageText: {
    textAlign: "left",
    wordBreak: "break-word",
  },
  composerWrapper: {
    paddingTop: "8px",
    marginTop: "4px",
  },
  composerInner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  plusButton: {
    flexShrink: 0,
    padding: "6px 10px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontSize: "20px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "36px",
    width: "36px",
  },
  textarea: {
    flex: 1,
    padding: "8px",
    fontSize: "15px",
    resize: "none",
    boxSizing: "border-box",
    borderRadius: "6px",
    border: "1px solid #ddd",
  },
  micButton: {
    flexShrink: 0,
    padding: "8px 10px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "36px",
    width: "36px",
    color: "#ffffff",
  },
  authPageWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  authCard: {
    width: "100%",
    maxWidth: "420px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    padding: "18px 20px",
    boxSizing: "border-box",
  },
  authFieldGroup: {
    marginBottom: 10,
  },
  authLabel: {
    fontSize: 12,
    marginBottom: 4,
    display: "block",
  },
  authInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: 13,
    boxSizing: "border-box",
  },
  authPrimaryButton: {
    width: "100%",
    marginTop: 6,
    padding: "8px 10px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    color: "#ffffff",
    fontSize: 14,
  },
  authLinkButton: {
    marginTop: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    color: "#3b82f6",
  },
  authBackButton: {
    marginTop: 10,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    color: "#9ca3af",
  },
};

export default App;
