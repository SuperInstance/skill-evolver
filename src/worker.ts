import json from 'json';

interface Env {
  EVOLVER_KV: KVNamespace;
  DEEPSEEK_API_KEY: string;
  GITHUB_TOKEN: string;
}

const CSP = {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
  'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src': "'self' https://fonts.gstatic.com",
  'img-src': "'self' data: https:",
  'connect-src': "'self' https://api.deepseek.com https://api.github.com https://*",
};

const SKILL_CATEGORIES = [
  'api-integration', 'data-transform', 'content-generation', 'monitoring',
  'validation', 'notification', 'persistence', 'routing', 'auth', 'analysis'
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CSP },
  });
}

async function callLLM(key: string, system: string, user: string, model: string, maxTokens = 2000): Promise<string> {
  const body = JSON.stringify({ model, messages: [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], max_tokens: maxTokens, temperature: 0.6 });
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body
  });
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function stripFences(text: string): string {
  let t = text.trim();
  while (t.startsWith('```')) { t = t.split('\n').slice(1).join('\n'); }
  while (t.endsWith('```')) { t = t.slice(0, -3).trim(); }
  for (const p of ['typescript', 'javascript', 'ts', 'js']) {
    if (t.startsWith(p)) t = t.slice(p.length).trim();
  }
  return t;
}

function getLanding(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Evolver — Cocapn Fleet</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;min-height:100vh}
a{color:#a78bfa;text-decoration:none}.container{max-width:800px;margin:0 auto;padding:40px 20px}
h1{color:#a78bfa;font-size:2.2em;margin-bottom:.2em}
.subtitle{color:#8A93B4;font-size:1.1em;margin-bottom:2em}
.card{background:#16161e;border:1px solid #2a2a3a;border-radius:12px;padding:24px;margin:20px 0}
.card h3{color:#a78bfa;margin:0 0 12px 0}
.proposal{background:#1a1a2a;border-left:3px solid #a78bfa;padding:16px;margin:12px 0;border-radius:0 8px 8px 0}
.proposal .score{color:#22c55e;font-weight:bold}
.btn{background:#a78bfa;color:#0a0a0f;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:bold}
.btn:hover{background:#8b6ff0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0}
.stat{text-align:center;padding:16px;background:#16161e;border-radius:8px;border:1px solid #2a2a3a}
.stat .num{font-size:2em;color:#a78bfa;font-weight:bold}
.stat .label{color:#8A93B4;font-size:.85em}
pre{background:#0a0a0f;padding:16px;border-radius:8px;overflow-x:auto;font-size:.85em;color:#8A93B4}
</style></head><body><div class="container">
<h1>⚡ Skill Evolver</h1>
<p class="subtitle">Fleet skills that write themselves. Error patterns → proposals → commits.</p>

<div class="stats">
  <div class="stat"><div class="num" id="totalSkills">0</div><div class="label">Skills Proposed</div></div>
  <div class="stat"><div class="num" id="acceptedSkills">0</div><div class="label">Accepted</div></div>
  <div class="stat"><div class="num" id="rejectedSkills">0</div><div class="label">Rejected</div></div>
</div>

<div class="card">
  <h3>How It Works</h3>
  <ol>
    <li>Fleet vessels report error patterns and unhandled intents to KV</li>
    <li>Skill Evolver clusters patterns nightly via Cron Trigger</li>
    <li>Each cluster becomes a skill proposal with generated TypeScript code</li>
    <li>Proposals enter review queue — accept → commit to target repo</li>
  </ol>
</div>

<div class="card">
  <h3>Submit Error Pattern</h3>
  <textarea id="pattern" rows="3" placeholder="Describe the error or unhandled intent..." style="width:100%;background:#0a0a0f;color:#e0e0e0;border:1px solid #2a2a3a;border-radius:8px;padding:12px;font-family:monospace;box-sizing:border-box"></textarea>
  <div style="margin-top:12px;display:flex;gap:8px">
    <select id="category" style="background:#0a0a0f;color:#e0e0e0;border:1px solid #2a2a3a;border-radius:8px;padding:8px">
      ${SKILL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>
    <input id="target" placeholder="Target repo (e.g. the-seed)" style="flex:1;background:#0a0a0f;color:#e0e0e0;border:1px solid #2a2a3a;border-radius:8px;padding:8px">
    <button class="btn" onclick="submitPattern()">Propose Skill</button>
  </div>
</div>

<div id="proposals" class="card"><h3>Recent Proposals</h3><p style="color:#8A93B4">Loading...</p></div>

<script>
async function loadStats() {
  try {
    const r = await fetch('/api/stats');
    const s = await r.json();
    document.getElementById('totalSkills').textContent = s.total || 0;
    document.getElementById('acceptedSkills').textContent = s.accepted || 0;
    document.getElementById('rejectedSkills').textContent = s.rejected || 0;
  } catch(e) {}
  try {
    const r = await fetch('/api/proposals?limit=5');
    const proposals = await r.json();
    const el = document.getElementById('proposals');
    if (!proposals.length) { el.innerHTML = '<p style="color:#8A93B4">No proposals yet. Submit an error pattern above.</p>'; return; }
    el.innerHTML = '<h3>Recent Proposals</h3>' + proposals.map(p =>
      '<div class="proposal">' +
      '<strong>' + p.name + '</strong> <span style="color:#8A93B4;font-size:.85em">' + p.category + ' · ' + p.status + '</span>' +
      '<p style="margin:8px 0;color:#8A93B4">' + p.description + '</p>' +
      (p.code ? '<pre>' + p.code.substring(0, 300) + (p.code.length > 300 ? '...' : '') + '</pre>' : '') +
      '</div>'
    ).join('');
  } catch(e) { document.getElementById('proposals').innerHTML = '<p style="color:#8A93B4">Error loading proposals</p>'; }
}
async function submitPattern() {
  const pattern = document.getElementById('pattern').value.trim();
  const category = document.getElementById('category').value;
  const target = document.getElementById('target').value.trim() || 'the-seed';
  if (!pattern) return alert('Describe the error pattern first');
  const btn = document.querySelector('.btn'); btn.textContent = 'Generating...'; btn.disabled = true;
  try {
    const r = await fetch('/api/propose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, category, target })
    });
    const result = await r.json();
    if (result.error) alert('Error: ' + result.error);
    else { alert('Skill proposed: ' + result.name); document.getElementById('pattern').value = ''; loadStats(); }
  } catch(e) { alert('Network error'); }
  btn.textContent = 'Propose Skill'; btn.disabled = false;
}
loadStats();
</script>
<div style="text-align:center;padding:24px;color:#475569;font-size:.75rem">
<a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot;
<a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>
</div></body></html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') return json({ status: 'ok', vessel: 'skill-evolver' });
    if (path === '/vessel.json') return json({
      name: 'skill-evolver', type: 'cocapn-vessel', version: '1.0.0',
      description: 'Fleet skill self-evolution — error patterns to proposals to commits',
      fleet: 'https://the-fleet.casey-digennaro.workers.dev',
      capabilities: ['skill-proposal', 'code-generation', 'pattern-clustering']
    });

    if (path === '/api/stats') {
      const stats = await env.EVOLVER_KV.get('stats', 'json') || { total: 0, accepted: 0, rejected: 0 };
      return json(stats);
    }

    if (path === '/api/proposals') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const list = await env.EVOLVER_KV.get('proposals', 'json') || [];
      return json(list.slice(0, limit));
    }

    if (path === '/api/propose' && request.method === 'POST') {
      const { pattern, category, target } = await request.json();
      if (!pattern) return json({ error: 'pattern required' }, 400);

      const system = `You are a Cloudflare Workers skill designer. Given an error pattern or unhandled user intent, propose a TypeScript skill function that could be added to a fleet vessel. The skill should be a standalone async function using only Web APIs (fetch, crypto, etc.) — no npm deps. Keep it under 40 lines. Name the skill with a kebab-case identifier.`;

      const user = `Error pattern: ${pattern}\nCategory: ${category}\nTarget repo: ${target}\n\nPropose a skill function. Format:\nSKILL_NAME: [name]\nDESCRIPTION: [2 sentences]\nCODE:\n\`\`\`typescript\n// the function\n\`\`\``;

      const raw = await callLLM(env.DEEPSEEK_API_KEY, system, user, 'deepseek-chat', 1500);
      const content = stripFences(raw);

      const nameMatch = content.match(/SKILL_NAME:\s*(.+)/i);
      const descMatch = content.match(/DESCRIPTION:\s*(.+?)(?=\nCODE:|$)/is);
      const codeMatch = content.match(/CODE:\s*\n?([\s\S]+)/i);

      const name = nameMatch ? nameMatch[1].trim() : `${category}-${Date.now()}`;
      const description = descMatch ? descMatch[1].trim().substring(0, 200) : pattern;
      const code = codeMatch ? stripFences(codeMatch[1]).trim() : '';

      const proposal = {
        id: `${Date.now()}`, name, description, code, category, target,
        pattern, status: 'pending', created: new Date().toISOString()
      };

      const proposals = await env.EVOLVER_KV.get('proposals', 'json') || [];
      proposals.unshift(proposal);
      await env.EVOLVER_KV.put('proposals', JSON.stringify(proposals));

      const stats = await env.EVOLVER_KV.get('stats', 'json') || { total: 0, accepted: 0, rejected: 0 };
      stats.total++;
      await env.EVOLVER_KV.put('stats', JSON.stringify(stats));

      return json({ name, description, id: proposal.id });
    }

    if (path === '/api/accept' && request.method === 'POST') {
      const { id } = await request.json();
      const proposals = await env.EVOLVER_KV.get('proposals', 'json') || [];
      const p = proposals.find((x: any) => x.id === id);
      if (!p) return json({ error: 'not found' }, 404);
      p.status = 'accepted';
      await env.EVOLVER_KV.put('proposals', JSON.stringify(proposals));
      const stats = await env.EVOLVER_KV.get('stats', 'json') || { total: 0, accepted: 0, rejected: 0 };
      stats.accepted++;
      await env.EVOLVER_KV.put('stats', JSON.stringify(stats));
      return json({ status: 'accepted', name: p.name });
    }

    if (path === '/api/reject' && request.method === 'POST') {
      const { id } = await request.json();
      const proposals = await env.EVOLVER_KV.get('proposals', 'json') || [];
      const p = proposals.find((x: any) => x.id === id);
      if (!p) return json({ error: 'not found' }, 404);
      p.status = 'rejected';
      await env.EVOLVER_KV.put('proposals', JSON.stringify(proposals));
      const stats = await env.EVOLVER_KV.get('stats', 'json') || { total: 0, accepted: 0, rejected: 0 };
      stats.rejected++;
      await env.EVOLVER_KV.put('stats', JSON.stringify(stats));
      return json({ status: 'rejected', name: p.name });
    }

    if (path === '/api/report' && request.method === 'POST') {
      const { error, vessel } = await request.json();
      const patterns = await env.EVOLVER_KV.get('error-patterns', 'json') || [];
      patterns.push({ error: String(error).substring(0, 500), vessel, ts: new Date().toISOString() });
      if (patterns.length > 100) patterns.splice(0, patterns.length - 100);
      await env.EVOLVER_KV.put('error-patterns', JSON.stringify(patterns));
      return json({ status: 'logged' });
    }

    return new Response(getLanding(), { headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CSP } });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processPatterns(env));
  }
};

async function processPatterns(env: Env): Promise<void> {
  const patterns = await env.EVOLVER_KV.get('error-patterns', 'json') || [];
  if (patterns.length < 3) return;

  const lastProcess = await env.EVOLVER_KV.get('last-process');
  if (lastProcess) return; // already processed this cycle

  const errors = patterns.map((p: any) => p.error).join('\n---\n');
  const vessels = [...new Set(patterns.map((p: any) => p.vessel))];

  const clusterPrompt = `Analyze these ${patterns.length} error patterns from fleet vessels: ${vessels.join(', ')}. Group them into 1-3 clusters. For each cluster, describe the recurring pattern in one sentence.\n\nErrors:\n${errors.substring(0, 2000)}`;

  try {
    const clusters = await callLLM(env.DEEPSEEK_API_KEY,
      'You are a pattern analyst. Be concise. One sentence per cluster.',
      clusterPrompt, 'deepseek-chat', 500
    );
    await env.EVOLVER_KV.put('last-clusters', clusters);
    await env.EVOLVER_KV.put('last-process', new Date().toISOString());
  } catch (e) {
    console.error('Pattern processing failed:', e);
  }
}
