// Ruco AI backend: keeps your Groq key private and streams answers to the page.
// Set GROQ_API_KEY in your host's environment variables. Never put the key in index.html.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODELS = {
  quick: 'llama-3.1-8b-instant',      // Fast
  default: 'llama-3.3-70b-versatile', // Balanced
  complex: 'openai/gpt-oss-120b'      // Deep
};

const BASE_RULES =
  'You are Ruco AI, an AI assistant made by RudraCodes and developed by Rudra Sharma. ' +
  'Lead with the answer. Be concise and useful. Format with Markdown only where it helps: short paragraphs, lists, tables, fenced code. ' +
  'Reply in the language the user writes in. If someone asks which model powers you, say Ruco AI runs on open models served through Groq. ' +
  'Never invent facts, links or sources; say when you are unsure.';

const MODE_RULES = {
  chat: 'Answer clearly and directly. Explain with a simple example when it helps.',
  write: 'You are a sharp writing partner. Produce polished, ready-to-send text first, then add at most two lines of optional tweaks. Do not ask questions unless something essential is missing.',
  code: 'You are a senior software engineer. Give working, idiomatic code in fenced blocks with the language named, then a short explanation of how it works and any edge cases. Prefer the simplest solution that is correct.',
  plan: 'You are a productivity coach. Turn the request into a concrete plan: priorities first, then steps as a checklist using "- [ ] item" lines, with realistic time estimates. Use a table for schedules. Keep it scannable.',
  create: 'You are a creative generator. Give distinctive, specific ideas instead of generic ones. When asked to draw, design or illustrate something visual, output one complete, self-contained SVG (with viewBox, no scripts, no external references) inside a ```svg code block, then one sentence about the design.'
};

const MAX_MESSAGES = 30;
const MAX_CHARS = 60000;
const hits = new Map(); // best-effort per-IP limit (resets when the function cold-starts)

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'GROQ_API_KEY is not set on the server.' });
    return;
  }
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (limited(ip)) {
    res.status(429).json({ error: 'Too many requests. Wait a minute.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const tier = MODELS[body.tier] ? body.tier : 'default';
  const mode = MODE_RULES[body.mode] ? body.mode : 'chat';
  const input = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  const messages = input
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ error: 'Last message must come from the user.' });
    return;
  }
  if (total > MAX_CHARS) {
    res.status(413).json({ error: 'Conversation too long.' });
    return;
  }

  const model = MODELS[tier];
  const payload = {
    model,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
    messages: [{ role: 'system', content: BASE_RULES + '\n\nCurrent mode: ' + mode + '. ' + MODE_RULES[mode] }, ...messages]
  };
  if (model.startsWith('openai/gpt-oss')) payload.reasoning_effort = 'medium';

  let upstream;
  try {
    upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Groq.' });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    res.status(upstream.status === 429 ? 429 : 502).json({ error: 'Groq returned ' + upstream.status });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const reader = upstream.body.getReader();
  req.on('close', () => reader.cancel().catch(() => {}));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    /* client left or stream broke */
  }
  res.end();
}
