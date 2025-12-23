# 🎙️ **Trial.AI**

### A Multi-Chat, Voice-Driven AI Assistant Powered by Gemini + ElevenLabs

---

## 🌟 Highlights

* 🎤 **Full voice interaction** — Speak to AI and hear natural replies
* 🔊 **High-quality TTS** using **ElevenLabs**
* 🧠 **Gemini-powered intelligence** via Google Vertex AI
* 🗂️ **Multiple chat sessions**, rename chats, delete chats
* 👤 **User authentication** (Google + Email/Password) using Firebase
* ☁️ **Cloud-synced conversations** (Firestore) — your chats travel with you
* 📄 **File understanding** — upload PDFs and ask questions about them
* 🎛️ **Light/Dark theme switching**
* 📱 **Fully responsive** — works beautifully on mobile, tablet, desktop
* 📚 Clean, scalable codebase that resembles real production AI apps
* 🚀 Built for hackathons, demos, learning, and real-world prototyping

---

## ℹ️ Overview

**Trial.AI** is a modern, voice-first AI assistant designed for natural conversations powered by **Google Vertex AI (Gemini)** and **ElevenLabs**.

It offers:

* **Voice → Text → AI → Voice** interaction
* Multi-chat system like ChatGPT
* Cloud-backed chat history
* File upload & analysis
* Full authentication
* Real-time Firestore sync
* Beautiful responsive UI

It is designed to be:

* A **learning project**
* A **hackathon-ready submission**
* A **base template for future AI projects**
* A **reference architecture** for voice + AI apps

Trial.AI aims to show what a **polished, user-friendly, production-grade** AI app can look like — including UX, backend, frontend, auth, cloud services, and deployment flow.

---

## 😊 Leave a Good Impression

This project is built with the same philosophy as top-tier AI apps:

* Clear UI
* Fast responsiveness
* Helpful interactions
* Stable backend
* Easy onboarding
* Clean, welcoming code

Your README is often the **first impression** a user or developer gets — this project is meant to look and feel **professional, modern, and inspiring**.

---

## ⌛ Be considerate of people's time

Someone scanning this README should instantly learn:

* ✔️ What the project does
* ✔️ How to use it
* ✔️ How to run it
* ✔️ Who built it
* ✔️ What makes it special

That is exactly what this README provides.

---

# 🎁 Template (This Project)

Below is a full breakdown of the core features and why they matter.
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/a1d851b4-75b5-4500-8b26-9d22d9c0ecca" />


---

# 🚀 Usage Instructions

### 🗣️ Talk to AI

Press the **mic button**, speak, and Trial.AI will:

1. Convert your voice → text
2. Send it to Gemini
3. Convert AI response → natural voice
4. Play it automatically

### 💬 Text Chat

Just type your message and hit **Enter** — AI responds via text and audio.

### 📂 Upload files

Upload a PDF and ask questions about its content:

> "Explain chapter 2 in simple words"
> "Summarize this document"
> "Extract the key points"

### 🗂️ Multiple chats

Create, rename, and delete chats — just like ChatGPT.

### 🌗 Themes

Switch between **light** and **dark** mode instantly.

---

# ⬇️ Installation Instructions

### 1. Clone the repo

```sh
git clone https://github.com/<your-username>/trial.ai.git
cd trial.ai
```

### 2. Install Backend

```sh
cd backend
npm install
```

Create `.env`:

```
ELEVENLABS_API_KEY=your_key_here
PROJECT_ID=your_gcp_project
LOCATION=us-central1
```

Start server:

```sh
node voicechat.js
```

### 3. Install Frontend

```sh
cd voice-frontend
npm install
npm start
```

### Requirements

* Node.js 18+
* A Google Cloud project with Vertex AI enabled
* ElevenLabs API key
* Firebase project (Auth + Firestore)

Works on:

* Windows
* Mac
* Linux
* Mobile browsers
* Chrome/Safari/Edge

---

# 🏆 Examples That Inspire This Project

These repos helped shape the readability & structure of this README:

* `fatiando/pooch`
* `gruns/furl`
* `marcomusy/vedo`
* `giampaolo/psutil`
* `MonitorControl/MonitorControl`

They set strong examples of:

* simplicity
* clarity
* fast understanding

---

# 💭 Feedback & Contributions

Have ideas? Want features? Found a bug?

* Open an Issue
* Start a Discussion
* Submit a Pull Request
* Improve documentation

Everyone is welcome! 😊
This project exists to inspire learners & developers.

---

# ✍️ Author

**Created by Aditya Jain**, exploring full-stack AI development with:

* Vertex AI (Gemini)
* ElevenLabs
* Firebase
* React
* Node.js

This project demonstrates how modern AI tools can create useful, voice-driven applications with clean design and great UX.

---

# 📖 Further Reading

* [https://github.com/hackergrrl/art-of-readme](https://github.com/hackergrrl/art-of-readme)
* [https://www.giacomodebidda.com/articles/how-to-write-a-killer-readme/](https://www.giacomodebidda.com/articles/how-to-write-a-killer-readme/)
* [https://cloud.google.com/vertex-ai](https://cloud.google.com/vertex-ai)
* [https://elevenlabs.io](https://elevenlabs.io)
* [https://firebase.google.com](https://firebase.google.com)

---

# 🎉 Final Notes

This project is **not just a demo** — it is a complete, extendable base for:

* Voice AI apps
* Chat systems
* File-reading assistants
* Multi-user platforms
* Hackathon submissions
* Production-ready prototypes

If you use Trial.AI as inspiration or a base for your own project, feel free to ⭐ star the repo!
