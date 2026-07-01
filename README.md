# Lucy AI Companion 💜

Lucy AI is a premium, high-fidelity chat companion application built on serverless architecture. It features a responsive glassmorphic frontend and a robust backend running on **Cloudflare Workers**, **Cloudflare KV**, and **Cloudflare Workers AI**.

---

## 🌟 Key Features

### 1. 🌌 High-Fidelity UI/UX & 3D Interactive Design
* **Glassmorphic Panels:** Modern, translucent card layouts with rich background blurs (`backdrop-filter: blur(25px)`).
* **3D Particle Background:** Smooth, CSS-only morphing background blobs that float dynamically in perspective space.
* **Card Tilt Physics:** The login panel dynamically tilts in 3D based on desktop mouse movements and smoothly re-centers when the mouse leaves.

### 2. 🐒 Interactive Monkey Password Avatar (Telegram-Style)
* A reactive SVG avatar that tracks password field actions:
  * **Hands Down (Default):** Rest state when filling out username/email.
  * **Hands Covering Eyes:** Triggered when the password field gains focus, shielding the eyes.
  * **Peeking State:** If the password visibility toggle (`👁️` / `🙈`) is clicked, the monkey peeks through one eye.

### 3. 🛡️ Production-Grade Security & Hardening
* **Bearer Token Authorization:** Secure session state via `Authorization: Bearer <token>` headers instead of vulnerable third-party cookies.
* **XSS Sanitization:** Full HTML escaping of prompts and AI text prior to Markdown parsing to prevent script injections.
* **User Isolation:** Local browser history is stored under user-scoped storage keys (`lucy_chat_history:${email}`), ensuring privacy on shared machines.
* **Double-Submission Lock:** Input forms lock during requests to prevent spam-clicking or duplicated messages.

### 4. ⚙️ Dynamic Profile Drawer (Settings Panel)
* A sliding sidebar panel allowing users to change their display name, email, and password.
* **Smart KV Migration:** If a user updates their email:
  * Their record in the database is renamed.
  * Their active session is updated (preventing forced logouts).
  * Their backend memory history is moved (`history:oldEmail` ➔ `history:newEmail`).
  * Their frontend local history is migrated dynamically.

### 5. 🧠 Serverless Workers AI Integration
* Uses Moonshot AI (`@cf/moonshotai/kimi-k2.7-code`) as the primary model.
* Includes automatic failover to Meta Llama 3.1 (`@cf/meta/llama-3.1-8b-instruct`) in case of model load errors or slow response times.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3 (variables, 3D perspective animations), JavaScript (ES6+).
* **Backend:** Cloudflare Workers (ES Modules format).
* **Databases:** Cloudflare Key-Value (KV) Storage.
  * `USERS` - Handles accounts credentials (SHA-256 password hashing).
  * `SESSIONS` - Handles temporary tokens mapping to active accounts.
  * `MEMORY` - Stores the recent chat history pairs (capped at last 20 exchanges) for context tracking.

---

## 📁 Project Structure

```bash
├── index.html        # Interactive login and registration portal
├── chat.html         # Lock-to-screen responsive chat interface
├── worker.js             # Cloudflare worker backend router and API
└── README.md             # Project documentation
```

---

## 🚀 Deployment Guide

### 1. Setup the Cloudflare Worker (Backend)
1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
2. Authenticate Wrangler with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
3. Create the KV Namespaces:
   ```bash
   npx wrangler kv:namespace create USERS
   npx wrangler kv:namespace create SESSIONS
   npx wrangler kv:namespace create MEMORY
   ```
4. Configure your `wrangler.toml` file in your root folder:
   ```toml
   name = "lucy-ai-backend"
   main = "worker.js"
   compatibility_date = "2024-03-01"

   [ai]
   binding = "AI"

   [[kv_namespaces]]
   binding = "USERS"
   id = "YOUR_USERS_KV_ID"

   [[kv_namespaces]]
   binding = "SESSIONS"
   id = "YOUR_SESSIONS_KV_ID"

   [[kv_namespaces]]
   binding = "MEMORY"
   id = "YOUR_MEMORY_KV_ID"
   ```
5. Deploy your worker:
   ```bash
   npx wrangler deploy
   ```

### 2. Configure & Deploy the Frontend
1. Open both `html/index.html` and `html/chat.html`.
2. Locate the configuration lines at the top of the scripts:
   ```javascript
   const API = "https://your-worker-url.workers.dev";
   const PAGES = "https://your-pages-url.pages.dev";
   ```
3. Update `API` to match your deployed Cloudflare Worker's URL.
4. Update `PAGES` to match your frontend hosting domain (e.g. Cloudflare Pages or GitHub Pages URL).
5. Open `worker.js` and set the `ALLOWED_ORIGIN` constant to match your frontend domain to ensure CORS handles requests properly:
   ```javascript
   const ALLOWED_ORIGIN = "https://your-pages-url.pages.dev";
   ```
6. Deploy the `html` folder files to your frontend hosting provider.
