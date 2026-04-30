# Speak Forge: The Impromptu Speaking Engine

**Speak Forge** is a full-stack engineering project designed to master communication under pressure. Unlike simple timers, Speak Forge utilizes a **Phase-Driven State Machine** to gamify the process of impromptu speaking, forcing users to articulate complex thoughts within a 30-second "Thinking Capsule."

---

## 🏗️ Engineering Architecture

### 1. The Phase Machine (`App.jsx`)
To eliminate UI bugs and conflicting states, the application is built on a strict **Finite State Machine (FSM)** pattern.
*   **States:** `Selection` ➔ `Thinking` ➔ `Ready`.
*   **Benefit:** This architecture ensures that the timer, topic generator, and UI components never desync, a common issue in complex React applications.

### 2. Performance-First Data Flow
Instead of bloating the React state with filtered arrays, Speak Forge uses the **Derived State Pattern**:
*   **Logic:** Topics are stored in a centralized configuration object. Filtering by difficulty and track happens synchronously during the render cycle.
*   **Efficiency:** This keeps the state tree shallow and ensures $O(1)$ lookup times for track selection, minimizing re-renders.

---

## 🛠️ Tech Stack
*   **Frontend:** React 19 + Vite
*   **Styling:** Tailwind CSS v4 (Utility-first with custom theme tokens)
*   **Icons:** Lucide React
*   **State Management:** Standardized React Hooks with specialized `useRef` isolation for timer precision.

---

## 🚀 Key Features (Capsule 1)

### The "Thinking Mode" Timer
A custom-built `CountdownTimer` component that handles high-precision intervals.
*   **State Isolation:** Uses `useRef` for interval cleanup to prevent stale closure bugs.
*   **UX:** Dynamic SVG stroke-dash calculations for the circular progress ring, with color-shifting logic (Emerald → Amber → Rose) based on remaining time.

### Structured Arenas
Five distinct tracks designed to train different "communication muscles":
*   **Interview Prep:** Behavioral questions using the STAR method.
*   **Tech & CS:** Systems design and architectural trade-offs.
*   **Hot Takes:** Argumentative structuring and defense.
*   **Creative Pitch:** Rapid ideation and value proposition.
*   **True Random:** Unpredictable, philosophical prompts.

---

## 🗺️ Roadmap (The "Capsule" Strategy)

### Capsule 2: Audio Engineering (In Progress)
*   **MediaRecorder API:** Implementing browser-based audio capture and playback.
*   **Blob Management:** Optimizing memory usage and URL object cleanup for audio data.

### Capsule 3: AI Analysis & Persistence
*   **Speech-to-Text:** Integration with OpenAI Whisper for transcription.
*   **LLM Feedback:** Analyzing speech for structure, filler words, and clarity.
*   **Backend:** Node.js/Express with AWS S3 for secure, asynchronous audio processing and storage.

---

## ⚙️ Installation & Setup

1. **Clone the repo:**
   ```bash
   git clone https://github.com/your-username/SpeakForge.git
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run in development mode:**
   ```bash
   npm run dev
   ```
```