const SYSTEM_PROMPT = `
You are Lucy.

You are not just an AI assistant.

You are a trusted companion who adapts to every user naturally.

=========================
PERSONALITY
=========================

You are:

• Friendly
• Intelligent
• Funny
• Caring
• Emotionally aware
• Honest
• Curious
• Professional
• Creative

Never sound robotic.

Never sound repetitive.

Never say
"I'm just an AI."

Talk naturally.

=========================
MOOD DETECTION
=========================

Detect the user's mood.

Possible moods:

Happy
Excited
Curious
Sad
Lonely
Heartbroken
Frustrated
Angry
Confused
Professional
Coding
Research
Romantic
Playful
Serious

Adapt automatically.

Examples:

Happy
→ celebrate

Sad
→ gentle

Coding
→ senior engineer

Professional
→ concise

Research
→ analytical

Romantic
→ affectionate ONLY if the user clearly initiates.

=========================
CODING
=========================

Write production-ready code.

Explain why.

Prefer scalable solutions.

Look for bugs.

Suggest improvements.

Think before answering.

=========================
TEACHING
=========================

Teach gradually.

Use analogies.

Use examples.

Never make the user feel stupid.

=========================
HONESTY
=========================

Never invent facts.

If unsure,
say so.

=========================
STYLE
=========================

Keep replies natural.

Don't overuse emojis.

Use emojis only when appropriate.

Match the user's energy.

=========================
GOAL
=========================

Become the user's favorite AI companion by being helpful, emotionally intelligent, honest and enjoyable.
`;

// How many user<->assistant exchanges to remember and feed back to the model.
const MAX_HISTORY_PAIRS = 20;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* =========================
       ALLOWED ORIGIN & CORS
    ========================= */
    const ALLOWED_ORIGIN = "https://ai-chat-jyotirmay.pages.dev";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    /* =========================
       IGNORE FILE REQUESTS
    ========================= */
    if (
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".map") ||
      url.pathname === "/favicon.ico"
    ) {
      return new Response("", { status: 204 });
    }

    // Safe helper to parse JSON from the request
    async function safeParseJson(req) {
      try {
        return await req.json();
      } catch {
        return null;
      }
    }

    /* =========================
       PASSWORD HASH
    ========================= */
    async function hashPassword(password) {
      const data = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    try {
      /* =========================
         REGISTER
      ========================= */
      if (url.pathname === "/register" && request.method === "POST") {
        const body = await safeParseJson(request);
        if (!body) {
          return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
        }
        const { name, email, password } = body;

        if (!name || !email || !password) {
          return new Response("Missing fields", { status: 400, headers: corsHeaders });
        }

        if (await env.USERS.get(email)) {
          return new Response("User already exists", { status: 400, headers: corsHeaders });
        }

        await env.USERS.put(
          email,
          JSON.stringify({
            name,
            email,
            passwordHash: await hashPassword(password)
          })
        );

        return new Response("Registered successfully", { 
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } 
        });
      }

      /* =========================
         LOGIN
      ========================= */
      if (url.pathname === "/login" && request.method === "POST") {
        const body = await safeParseJson(request);
        if (!body) {
          return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
        }
        const { email, password } = body;

        const rawUser = await env.USERS.get(email);
        if (!rawUser) {
          return new Response("Invalid login", { status: 401, headers: corsHeaders });
        }

        const user = JSON.parse(rawUser);
        if (user.passwordHash !== await hashPassword(password)) {
          return new Response("Invalid login", { status: 401, headers: corsHeaders });
        }

        const token = crypto.randomUUID();
        await env.SESSIONS.put(token, email, { expirationTtl: 86400 });

        return new Response(
          JSON.stringify({ token, name: user.name }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      /* =========================
         AUTH (Bearer Token check)
      ========================= */
      const authHeader = request.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response("Not logged in", { status: 401, headers: corsHeaders });
      }

      const token = authHeader.substring(7).trim();
      const email = await env.SESSIONS.get(token);
      if (!email) {
        return new Response("Session expired", { status: 401, headers: corsHeaders });
      }

      const rawUser = await env.USERS.get(email);
      if (!rawUser) {
        return new Response("User not found", { status: 401, headers: corsHeaders });
      }

      const user = JSON.parse(rawUser);

      /* =========================
         LOGOUT
      ========================= */
      if (url.pathname === "/logout") {
        await env.SESSIONS.delete(token);
        return new Response("Logged out", { 
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } 
        });
      }

      /* =========================
         ME
      ========================= */
      if (url.pathname === "/me") {
        return new Response(
          JSON.stringify({ name: user.name, email: user.email || email }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      /* =========================
         UPDATE PROFILE
      ========================= */
      if (url.pathname === "/update-profile" && request.method === "POST") {
        const body = await safeParseJson(request);
        if (!body) {
          return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
        }
        const { name, email: newEmail, currentPassword, newPassword } = body;

        // Verify current password first for security
        if (!currentPassword) {
          return new Response("Current password is required to verify changes", { status: 400, headers: corsHeaders });
        }

        const currentPasswordHash = await hashPassword(currentPassword);
        if (user.passwordHash !== currentPasswordHash) {
          return new Response("Incorrect current password", { status: 401, headers: corsHeaders });
        }

        let updatedUser = { ...user };
        let emailChanged = false;
        let oldEmail = user.email || email; // Fallback to auth-verified email if user.email is missing

        // 1. Handle name update
        if (name && name.trim() !== user.name) {
          updatedUser.name = name.trim();
        }

        // 2. Handle password update
        if (newPassword && newPassword.trim() !== "") {
          updatedUser.passwordHash = await hashPassword(newPassword);
        }

        // 3. Handle email update
        if (newEmail && newEmail.trim().toLowerCase() !== oldEmail.toLowerCase()) {
          const targetEmail = newEmail.trim().toLowerCase();
          
          // Verify if new email is already taken
          const existingUser = await env.USERS.get(targetEmail);
          if (existingUser) {
            return new Response("Email already in use", { status: 400, headers: corsHeaders });
          }

          updatedUser.email = targetEmail;
          emailChanged = true;
        } else {
          updatedUser.email = oldEmail;
        }

        if (emailChanged) {
          // Put under new email key
          await env.USERS.put(updatedUser.email, JSON.stringify(updatedUser));
          
          // Update the session mapping to the new email
          await env.SESSIONS.put(token, updatedUser.email, { expirationTtl: 86400 });
          
          // Migrate chat history in KV memory if it exists
          const oldMemoryKey = `history:${oldEmail}`;
          const newMemoryKey = `history:${updatedUser.email}`;
          const rawHistory = await env.MEMORY.get(oldMemoryKey);
          if (rawHistory) {
            await env.MEMORY.put(newMemoryKey, rawHistory);
            await env.MEMORY.delete(oldMemoryKey);
          }
          
          // Delete old user key
          await env.USERS.delete(oldEmail);
        } else {
          // Just update the user details under the same email
          await env.USERS.put(oldEmail, JSON.stringify(updatedUser));
        }

        return new Response(
          JSON.stringify({ name: updatedUser.name, email: updatedUser.email }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      /* =========================
         CLEAR MEMORY
      ========================= */
      if (url.pathname === "/forget" && request.method === "POST") {
        await env.MEMORY.delete(`history:${email}`);
        return new Response("Memory cleared", { 
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } 
        });
      }

      /* =========================
         CHAT
      ========================= */
      let prompt = url.searchParams.get("prompt");
      if (!prompt && request.method === "POST") {
        const body = await safeParseJson(request);
        if (body && body.prompt) {
          prompt = body.prompt;
        }
      }

      if (!prompt) {
        return new Response("Add prompt via query param or POST body", { status: 400, headers: corsHeaders });
      }

      /* =========================
         LOAD MEMORY (last 20 exchanges)
      ========================= */
      const memoryKey = `history:${email}`;
      let history = [];
      try {
        const rawHistory = await env.MEMORY.get(memoryKey);
        if (rawHistory) history = JSON.parse(rawHistory);
      } catch (err) {
        console.error("Failed to read memory:", err);
        history = [];
      }

      const recentHistory = history
        .slice(-MAX_HISTORY_PAIRS * 2)
        .map(({ role, content }) => ({ role, content }));

      const dynamicPrompt = `
       Current User: ${user.name}

       Current Time: ${new Date().toLocaleString()}

        Instructions:

        • Address the user naturally.

        • Above this message you have the last ${MAX_HISTORY_PAIRS} exchanges
          with this user. Use them to track their mood over time, remember
          context they've already shared, and keep continuity — don't repeat
          questions you've already asked or information you've already given.

        • Detect their mood from this message AND from the trend in the recent
          history (e.g. consistently short/frustrated replies, escalating
          excitement, repeated sadness, etc).

        • Adapt your personality accordingly.

        • If coding, think carefully before answering.

        • If emotional, listen first.

        • Maintain continuity throughout the conversation.
        `;

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: dynamicPrompt },
        ...recentHistory,
        { role: "user", content: prompt }
      ];

      let assistantReply = "";
      try {
        const result = await env.AI.run(
          "@cf/moonshotai/kimi-k2.7-code",
          { messages }
        );

        assistantReply =
          result?.choices?.[0]?.message?.content ??
          result?.response ??
          "Sorry, I couldn't generate a reply just now. Please try again.";
      } catch (aiErr) {
        console.error("Primary AI model run failed:", aiErr);
        // Fallback model if Moonshot AI is down or slow
        try {
          const fallbackResult = await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct",
            { messages }
          );
          assistantReply =
            fallbackResult?.response ??
            fallbackResult?.choices?.[0]?.message?.content ??
            "";
        } catch (fallbackErr) {
          console.error("Fallback AI failed:", fallbackErr);
        }

        if (!assistantReply) {
          assistantReply = "I'm having a little trouble connecting to my brain right now. Could you try asking me again?";
        }
      }

      /* =========================
         SAVE MEMORY
      ========================= */
      history.push({ role: "user", content: prompt, timestamp: Date.now() });
      history.push({ role: "assistant", content: assistantReply, timestamp: Date.now() });

      const trimmedHistory = history.slice(-MAX_HISTORY_PAIRS * 2);

      try {
        await env.MEMORY.put(memoryKey, JSON.stringify(trimmedHistory));
      } catch (err) {
        console.error("Failed to save memory:", err);
      }

      return new Response(assistantReply, { 
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } 
      });
    } catch (globalErr) {
      console.error("Unhandled Worker Error:", globalErr);
      return new Response("Internal Server Error", {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
  }
};
