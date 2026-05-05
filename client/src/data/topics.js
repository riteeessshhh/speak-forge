/**
 * topics.js — The Topic Bank for Speak Forge
 *
 * DATA STRUCTURE (v2 — with Difficulty Levels):
 * ──────────────────────────────────────────────
 * Still a hash-map keyed by track name for O(1) track lookup.
 * BUT each entry is now an OBJECT instead of a raw string:
 *
 *   { text: string, difficulty: "easy" | "medium" | "hard" }
 *
 * WHY this shape?
 *   → Track lookup is O(1): tracks["Interview Prep"]
 *   → Difficulty filtering is O(n) where n ≈ 30 — negligible.
 *   → We chain: tracks[track].filter(t => t.difficulty === diff)
 *   → "True Random" has its OWN array — not derived from other tracks.
 *
 * FILTERING STRATEGY (Derived State):
 *   We do NOT store filtered results in React state.
 *   Instead, we compute them on-the-fly during render:
 *     const pool = tracks[selectedTrack].filter(t => t.difficulty === selectedDifficulty);
 *   This avoids stale data bugs and keeps the state tree minimal.
 */

export const tracks = {
  "Interview Prep": [
    // ── EASY: Common openers, low pressure ──
    { text: "Tell me about yourself and your background.", difficulty: "easy", isBehavioral: false },
    { text: "Why are you interested in this role?", difficulty: "easy", isBehavioral: false },
    { text: "What are your greatest strengths?", difficulty: "easy", isBehavioral: false },
    { text: "Describe your ideal work environment.", difficulty: "easy", isBehavioral: false },
    { text: "What motivates you to do your best work?", difficulty: "easy", isBehavioral: false },
    { text: "How did you hear about this position?", difficulty: "easy", isBehavioral: false },
    { text: "What do you know about our company?", difficulty: "easy", isBehavioral: false },
    { text: "Where do you see yourself in five years?", difficulty: "easy", isBehavioral: false },
    { text: "What are you looking for in your next role?", difficulty: "easy", isBehavioral: false },
    { text: "Describe a typical day at your current or most recent job.", difficulty: "easy", isBehavioral: false },

    // ── MEDIUM: STAR-method behavioral, require real stories ──
    { text: "Tell me about a time you had to learn a new technology under a tight deadline.", difficulty: "medium", isBehavioral: true },
    { text: "Describe a project where you had to make a significant trade-off.", difficulty: "medium", isBehavioral: true },
    { text: "Tell me about a time you disagreed with a teammate. How did you resolve it?", difficulty: "medium", isBehavioral: true },
    { text: "Describe the most challenging bug you've ever fixed. Walk me through your debugging process.", difficulty: "medium", isBehavioral: true },
    { text: "Tell me about a time you went above and beyond what was expected.", difficulty: "medium", isBehavioral: true },
    { text: "How do you prioritize tasks when multiple deadlines are approaching?", difficulty: "medium", isBehavioral: true },
    { text: "Describe a project you are most proud of and your specific contribution.", difficulty: "medium", isBehavioral: true },
    { text: "Tell me about a time you automated a manual process. What was the impact?", difficulty: "medium", isBehavioral: true },
    { text: "Describe a situation where you had to collaborate across teams.", difficulty: "medium", isBehavioral: true },
    { text: "Tell me about a time you used data to make an important decision.", difficulty: "medium", isBehavioral: true },

    // ── HARD: Conflict, failure, leadership pressure ──
    { text: "Tell me about a time you failed on a project. What did you learn from it?", difficulty: "hard", isBehavioral: true },
    { text: "Tell me about a time you had to push back on your manager's decision.", difficulty: "hard", isBehavioral: true },
    { text: "Describe how you handle working on a codebase with massive technical debt.", difficulty: "hard", isBehavioral: true },
    { text: "Tell me about a time you had to deliver without all the resources you needed.", difficulty: "hard", isBehavioral: true },
    { text: "Describe a technical decision you made that you later deeply regretted.", difficulty: "hard", isBehavioral: true },
    { text: "Tell me about handling a production incident that affected thousands of users.", difficulty: "hard", isBehavioral: true },
    { text: "How would you handle a situation where your team is consistently missing deadlines?", difficulty: "hard", isBehavioral: true },
    { text: "Describe a time when you had to say no to a feature request from a senior stakeholder.", difficulty: "hard", isBehavioral: true },
    { text: "Tell me about leading a project where the scope changed dramatically mid-sprint.", difficulty: "hard", isBehavioral: true },
    { text: "Describe a time you had to persuade an entire team to adopt a new approach they resisted.", difficulty: "hard", isBehavioral: true },
  ],

  "Tech & CS": [
    // ── EASY: Definitions and basic concepts ──
    { text: "What is the difference between a stack and a queue?", difficulty: "easy" },
    { text: "Explain what an API is as if you're talking to a non-technical person.", difficulty: "easy" },
    { text: "What is the difference between HTTP and HTTPS?", difficulty: "easy" },
    { text: "Explain what a database is and why applications need one.", difficulty: "easy" },
    { text: "What is the difference between front-end and back-end development?", difficulty: "easy" },
    { text: "Explain what version control is and why developers use Git.", difficulty: "easy" },
    { text: "What is the difference between a compiler and an interpreter?", difficulty: "easy" },
    { text: "Explain what an array is and when you would use one.", difficulty: "easy" },
    { text: "What does 'open source' mean and why does it matter?", difficulty: "easy" },
    { text: "Explain the concept of a variable in programming.", difficulty: "easy" },

    // ── MEDIUM: Systems, trade-offs, intermediate DSA ──
    { text: "Explain how a hash map handles collisions and why that matters for performance.", difficulty: "medium" },
    { text: "Walk me through what happens when you type a URL into a browser and press Enter.", difficulty: "medium" },
    { text: "What is the difference between a process and a thread?", difficulty: "medium" },
    { text: "Explain Big-O notation. Why does it matter in real engineering?", difficulty: "medium" },
    { text: "What is a deadlock? Describe a real-world scenario where it could occur.", difficulty: "medium" },
    { text: "Explain the difference between TCP and UDP. When would you pick one over the other?", difficulty: "medium" },
    { text: "What are database indexes and how do they speed up queries?", difficulty: "medium" },
    { text: "Describe how an event loop works in Node.js.", difficulty: "medium" },
    { text: "What is a REST API? How does it differ from GraphQL?", difficulty: "medium" },
    { text: "Explain recursion vs iteration. When is recursion a bad choice?", difficulty: "medium" },

    // ── HARD: Distributed systems, advanced architecture ──
    { text: "Explain the CAP theorem as if you were teaching it to a non-technical PM.", difficulty: "hard" },
    { text: "What is consistent hashing and why is it used in distributed systems?", difficulty: "hard" },
    { text: "Describe how garbage collection works in a managed language. What are the trade-offs?", difficulty: "hard" },
    { text: "Explain dynamic programming. Walk through the coin change problem step by step.", difficulty: "hard" },
    { text: "What is virtual memory and how does the OS manage it with paging?", difficulty: "hard" },
    { text: "Describe the differences between SQL and NoSQL databases with concrete trade-offs.", difficulty: "hard" },
    { text: "What is a message queue? Design a scenario where you'd introduce Kafka or RabbitMQ.", difficulty: "hard" },
    { text: "Explain the difference between monolithic and microservice architectures. When is each better?", difficulty: "hard" },
    { text: "Describe how a load balancer works and compare round-robin vs least-connections strategies.", difficulty: "hard" },
    { text: "What is a race condition? Give a real example and explain how to prevent it with locks.", difficulty: "hard" },
  ],

  "Hot Takes": [
    // ── EASY: Fun, low-stakes, everyone has an opinion ──
    { text: "Defend: 'Tabs are objectively superior to spaces.'", difficulty: "easy" },
    { text: "Defend: 'Dark mode is overrated and light mode is better for productivity.'", difficulty: "easy" },
    { text: "Defend: 'Copy-pasting code from the internet is a legitimate engineering skill.'", difficulty: "easy" },
    { text: "Defend: 'Stack Overflow answers are the best form of documentation.'", difficulty: "easy" },
    { text: "Defend: 'JavaScript is the only programming language anyone will ever need.'", difficulty: "easy" },
    { text: "Defend: 'Vim is the only text editor a real programmer needs.'", difficulty: "easy" },
    { text: "Defend: 'PHP is the best language for building modern web applications.'", difficulty: "easy" },
    { text: "Defend: 'The best engineers are the ones who write the most code.'", difficulty: "easy" },
    { text: "Defend: 'Print debugging is superior to using a proper debugger.'", difficulty: "easy" },
    { text: "Defend: 'README files are optional for any project.'", difficulty: "easy" },

    // ── MEDIUM: Requires nuanced reasoning ──
    { text: "Defend: 'You don't need data structures and algorithms to be a good engineer.'", difficulty: "medium" },
    { text: "Defend: 'Unit tests are a waste of time and slow down development.'", difficulty: "medium" },
    { text: "Defend: 'Remote work is worse for productivity than in-office work.'", difficulty: "medium" },
    { text: "Defend: 'Agile methodology is just a way for managers to micromanage developers.'", difficulty: "medium" },
    { text: "Defend: 'Meetings are the most important part of a software engineer's day.'", difficulty: "medium" },
    { text: "Defend: 'Code comments are a code smell and should be completely avoided.'", difficulty: "medium" },
    { text: "Defend: 'Frontend development is harder than backend development.'", difficulty: "medium" },
    { text: "Defend: 'Code readability doesn't matter if the code is performant.'", difficulty: "medium" },
    { text: "Defend: 'Pair programming halves your team's output.'", difficulty: "medium" },
    { text: "Defend: 'Technical debt doesn't exist — it's just evolution.'", difficulty: "medium" },

    // ── HARD: Provocative, requires argument construction ──
    { text: "Defend: 'AI will completely replace software engineers within 5 years.'", difficulty: "hard" },
    { text: "Defend: 'A CS degree is completely useless for modern software development.'", difficulty: "hard" },
    { text: "Defend: 'Working 80-hour weeks is the best way to advance your career.'", difficulty: "hard" },
    { text: "Defend: 'Every company should rewrite their entire codebase every two years.'", difficulty: "hard" },
    { text: "Defend: 'Microservices are always better than a monolith — no exceptions.'", difficulty: "hard" },
    { text: "Defend: 'Using AI to write code is cheating and should be banned in interviews.'", difficulty: "hard" },
    { text: "Defend: 'Security is a secondary concern. Ship features first, patch later.'", difficulty: "hard" },
    { text: "Defend: 'You should always build everything from scratch instead of using libraries.'", difficulty: "hard" },
    { text: "Defend: 'You should never refactor code that's already working in production.'", difficulty: "hard" },
    { text: "Defend: 'The best code is code written without any planning or design documents.'", difficulty: "hard" },
  ],

  "Creative Pitch": [
    // ── EASY: Simple, fun product ideas ──
    { text: "Pitch a mobile app that helps people find study partners near them.", difficulty: "easy" },
    { text: "Pitch a product that gamifies household chores for families.", difficulty: "easy" },
    { text: "Pitch yourself for a software engineering role in 60 seconds.", difficulty: "easy" },
    { text: "Pitch a personal finance app designed for college students.", difficulty: "easy" },
    { text: "Pitch a gamified learning platform for data structures and algorithms.", difficulty: "easy" },
    { text: "Explain in 60 seconds why open source contribution matters for career growth.", difficulty: "easy" },
    { text: "Pitch a smart recipe app that suggests meals based on what's in your fridge.", difficulty: "easy" },
    { text: "Pitch a browser extension that blocks distracting websites during work hours.", difficulty: "easy" },
    { text: "Pitch a neighborhood tool-sharing app to reduce waste.", difficulty: "easy" },
    { text: "Pitch yourself as a freelance developer to a potential client.", difficulty: "easy" },

    // ── MEDIUM: Requires market thinking and structure ──
    { text: "You have 60 seconds to convince an investor to fund a developer productivity tool.", difficulty: "medium" },
    { text: "Pitch an AI-powered browser extension that summarizes Terms of Service pages.", difficulty: "medium" },
    { text: "Pitch a SaaS product that automates weekly standup meetings.", difficulty: "medium" },
    { text: "Pitch a marketplace connecting junior developers with mentors for mock interviews.", difficulty: "medium" },
    { text: "Pitch an AI resume builder that tailors resumes to specific job descriptions.", difficulty: "medium" },
    { text: "Pitch a real-time collaboration tool for remote design teams.", difficulty: "medium" },
    { text: "Pitch a mental health app designed specifically for software engineers.", difficulty: "medium" },
    { text: "Pitch a tool that automatically generates API documentation from code comments.", difficulty: "medium" },
    { text: "Pitch a smart home device that helps elderly people live independently.", difficulty: "medium" },
    { text: "Explain to a board of directors why investing in developer experience improves revenue.", difficulty: "medium" },

    // ── HARD: Strategic pivots, complex arguments ──
    { text: "Explain your senior project as if pitching it to a top-tier VC for Series A funding.", difficulty: "hard" },
    { text: "Pitch a decentralized social media platform focused on privacy to a skeptical board.", difficulty: "hard" },
    { text: "Explain why your startup should pivot from B2C to B2B in 60 seconds.", difficulty: "hard" },
    { text: "Pitch a code review tool that uses AI to detect security vulnerabilities — how is it better than existing tools?", difficulty: "hard" },
    { text: "You are in an elevator with the CTO. Convince them to fund an internal developer platform.", difficulty: "hard" },
    { text: "Explain in 60 seconds why a company should migrate from a monolith to microservices.", difficulty: "hard" },
    { text: "Pitch a browser-based IDE optimized for pair programming that competes with VS Code.", difficulty: "hard" },
    { text: "Pitch an automated code migration tool for legacy codebases to enterprise clients.", difficulty: "hard" },
    { text: "Pitch a non-profit tech initiative teaching coding to underserved communities — to a government committee.", difficulty: "hard" },
    { text: "Explain in 60 seconds why companies should invest heavily in accessibility over new features.", difficulty: "hard" },
  ],

  "True Random": [
    // ── EASY: Fun everyday questions ──
    { text: "Why is water wet? Build a convincing argument.", difficulty: "easy" },
    { text: "If animals could talk, which species would be the rudest?", difficulty: "easy" },
    { text: "Pitch a new holiday. What's it called, when is it, and how do people celebrate?", difficulty: "easy" },
    { text: "You are the CEO of a crayon company. Convince the board to add a new color.", difficulty: "easy" },
    { text: "Explain the internet to a medieval knight.", difficulty: "easy" },
    { text: "If you could remove one minor inconvenience from the world, what would it be and why?", difficulty: "easy" },
    { text: "You have discovered a new planet. Name it and describe its first tourism ad.", difficulty: "easy" },
    { text: "Is a hotdog a sandwich? Defend your position.", difficulty: "easy" },
    { text: "If you could have dinner with any fictional character, who and why?", difficulty: "easy" },
    { text: "Describe your life using only movie titles.", difficulty: "easy" },

    // ── MEDIUM: Requires structured improvisation ──
    { text: "You've been appointed the Minister of Fun. What's your first policy?", difficulty: "medium" },
    { text: "Convince a room of people that the best superpower is the ability to talk to plants.", difficulty: "medium" },
    { text: "Design a school subject that doesn't exist yet. What would students learn?", difficulty: "medium" },
    { text: "If social media existed in the 1800s, what would trending tweets look like?", difficulty: "medium" },
    { text: "You are the spokesperson for a haunted house. Sell it as a family-friendly vacation spot.", difficulty: "medium" },
    { text: "Explain quantum physics using only cooking metaphors.", difficulty: "medium" },
    { text: "If you could make one law that everyone must follow, what would it be?", difficulty: "medium" },
    { text: "You are a defense attorney for the villain in a fairy tale. Make your closing argument.", difficulty: "medium" },
    { text: "If time travel were real, pitch a time-travel tourism company.", difficulty: "medium" },
    { text: "Describe what a day in your life looks like in the year 2085.", difficulty: "medium" },

    // ── HARD: Philosophical, abstract, deep thinking ──
    { text: "If you could change one decision in human history, what would it be and what are the second-order effects?", difficulty: "hard" },
    { text: "Make a compelling argument that boredom is the most important human emotion.", difficulty: "hard" },
    { text: "If every job paid the same salary, what would society look like in 50 years?", difficulty: "hard" },
    { text: "You must convince an alien species that humans deserve to keep existing. Go.", difficulty: "hard" },
    { text: "Design an entirely new economic system in 60 seconds. What are its core principles?", difficulty: "hard" },
    { text: "If consciousness could be uploaded, argue whether the copy is still 'you'.", difficulty: "hard" },
    { text: "Make a case for why failure should be celebrated more than success.", difficulty: "hard" },
    { text: "If we discovered that the universe is a simulation, how should society respond?", difficulty: "hard" },
    { text: "Argue that the invention of the internet has done more harm than good to humanity.", difficulty: "hard" },
    { text: "Design a perfect city from scratch. What are your three non-negotiable principles?", difficulty: "hard" },
  ],
};

/**
 * TRACK_META — UI metadata for each track.
 *
 * Separated from topic data so the data file stays testable
 * and the UI layer can evolve independently.
 *
 * The `icon` field maps to a Lucide icon name (resolved in the component).
 * `color` is used for accent color in various UI states.
 */
export const TRACK_META = {
  "Interview Prep": {
    description: "Behavioral & HR questions from easy icebreakers to tough conflict scenarios.",
    icon: "Briefcase",
    color: "emerald",
    gradient: "from-emerald-400 to-teal-600",
    bgGlow: "rgba(52, 211, 153, 0.08)",
  },
  "Tech & CS": {
    description: "Data structures, algorithms, systems design, and networking fundamentals.",
    icon: "Cpu",
    color: "blue",
    gradient: "from-blue-400 to-indigo-600",
    bgGlow: "rgba(96, 165, 250, 0.08)",
  },
  "Hot Takes": {
    description: "Defend the indefensible. Practice thinking on your feet under pressure.",
    icon: "Flame",
    color: "rose",
    gradient: "from-rose-400 to-pink-600",
    bgGlow: "rgba(251, 113, 133, 0.08)",
  },
  "Creative Pitch": {
    description: "Sell an idea, a product, or yourself to investors in 60 seconds flat.",
    icon: "Rocket",
    color: "amber",
    gradient: "from-amber-400 to-orange-600",
    bgGlow: "rgba(251, 191, 36, 0.08)",
  },
  "True Random": {
    description: "Bizarre, philosophical, and everyday impromptu questions. Expect chaos.",
    icon: "Dices",
    color: "violet",
    gradient: "from-violet-400 to-purple-600",
    bgGlow: "rgba(167, 139, 250, 0.08)",
  },
};

/**
 * DIFFICULTY_META — metadata for difficulty pills.
 * Used by the DifficultySelector component for colors and labels.
 */
export const DIFFICULTY_META = {
  easy: { label: "Easy", color: "emerald", emoji: "🌱" },
  medium: { label: "Medium", color: "amber", emoji: "⚡" },
  hard: { label: "Hard", color: "rose", emoji: "🔥" },
};

/**
 * getRandomTopic(trackName, difficulty)
 *
 * DERIVED STATE PATTERN:
 * This function computes the filtered pool on-the-fly.
 * We never store filtered results — we derive them from
 * the source data + the user's current selections.
 *
 * Returns { track, topic, difficulty } so the UI knows everything
 * about the generated result.
 */
export function getRandomTopic(trackName, difficulty) {
  const trackTopics = tracks[trackName];
  if (!trackTopics) return null;

  // Filter by difficulty — O(n) where n ≈ 30, negligible
  const pool = trackTopics.filter((t) => t.difficulty === difficulty);
  if (pool.length === 0) return null;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return { track: trackName, topic: chosen.text, difficulty: chosen.difficulty, isBehavioral: chosen.isBehavioral || false };
}

/**
 * getTopicCount(trackName, difficulty)
 *
 * Utility to show how many topics match the current filter.
 * Used by the UI to display "12 topics available" text.
 */
export function getTopicCount(trackName, difficulty) {
  const trackTopics = tracks[trackName];
  if (!trackTopics) return 0;
  if (!difficulty) return trackTopics.length;
  return trackTopics.filter((t) => t.difficulty === difficulty).length;
}
