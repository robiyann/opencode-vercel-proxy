export const config = {
  runtime: 'edge',
};

const OPENCODE_BASE_URL = 'https://opencode.ai';
const OPENCODE_UA = 'opencode';

// Helper to generate OpenCode session & request IDs
function genId(prefix) {
  const hex = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2))
    .replace(/-/g, '');
  return `${prefix}_${hex}`;
}

// Extract conversation/session ID from any known AI agent headers or body
function extractStickySession(req, body) {
  // 1. Check HTTP Headers (Claude Code, Cline, Roo, Cursor, 9router, OpenAI SDK)
  const headerKeys = [
    'x-opencode-session',
    'x-session-id',
    'session-id',
    'session_id',
    'x-conversation-id',
    'x-thread-id',
    'x-amp-thread-id',
  ];
  for (const k of headerKeys) {
    const val = req.headers.get(k);
    if (val && typeof val === 'string' && val.trim()) {
      const clean = val.trim().replace(/^ses_/, '').replace(/-/g, '');
      return `ses_${clean}`;
    }
  }

  // 2. Check Request Body metadata (Claude Code user_id "_session_xxx", prompt_cache_key, session_id)
  if (body) {
    if (typeof body.metadata?.user_id === 'string') {
      const m = body.metadata.user_id.match(/_session_([a-f0-9-]+)$/i);
      if (m) return `ses_${m[1].replace(/-/g, '')}`;
    }
    const bodyCandidates = [body.session_id, body.conversation_id, body.prompt_cache_key];
    for (const cand of bodyCandidates) {
      if (cand && typeof cand === 'string' && cand.trim()) {
        const clean = cand.trim().replace(/^ses_/, '').replace(/-/g, '');
        return `ses_${clean}`;
      }
    }
  }

  // Fallback: Generate fresh session
  return genId('ses');
}

// Inject reasoning_content placeholder for models like DeepSeek / Kimi that validate assistant history
function patchReasoningContent(body) {
  if (!body || !Array.isArray(body.messages)) return body;
  const model = String(body.model || '').toLowerCase();
  const needsReasoning = model.includes('deepseek') || model.includes('kimi');
  if (!needsReasoning) return body;

  const patchedMessages = body.messages.map((m) => {
    if (m?.role === 'assistant' && (!m.reasoning_content || m.reasoning_content.length === 0)) {
      return { ...m, reasoning_content: ' ' };
    }
    return m;
  });

  return { ...body, messages: patchedMessages };
}

export default async function handler(req) {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const rawBody = await req.json();
    const isStream = Boolean(rawBody.stream);
    const patchedBody = patchReasoningContent(rawBody);

    // Endpoint URL
    const targetUrl = `${OPENCODE_BASE_URL}/zen/v1/chat/completions`;

    // Extract sticky session for AI Agent context preservation
    const sessionId = extractStickySession(req, rawBody);
    const requestId = req.headers.get('x-opencode-request') || req.headers.get('x-client-request-id') || genId('msg');
    const clientProject = req.headers.get('x-opencode-project') || 'global';
    const clientHeader = req.headers.get('x-opencode-client') || 'desktop';

    // Upstream Headers
    const upstreamHeaders = {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('authorization') || 'Bearer public',
      'User-Agent': OPENCODE_UA,
      'x-opencode-client': clientHeader,
      'x-opencode-session': sessionId,
      'x-opencode-request': requestId,
      'x-opencode-project': clientProject,
      'Accept': isStream ? 'text/event-stream' : 'application/json, */*',
    };

    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(patchedBody),
    });

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('x-proxy-session', sessionId);
    responseHeaders.set('x-session-id', sessionId);
    responseHeaders.set('x-proxy-request', requestId);
    responseHeaders.set('x-relay-region', req.headers.get('x-vercel-id') || 'edge');

    // Transfer Content-Type from upstream
    const upstreamCt = upstreamRes.headers.get('content-type');
    if (upstreamCt) {
      responseHeaders.set('Content-Type', upstreamCt);
    } else {
      responseHeaders.set('Content-Type', isStream ? 'text/event-stream; charset=utf-8' : 'application/json');
    }

    if (isStream) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('Connection', 'keep-alive');
      responseHeaders.set('X-Accel-Buffering', 'no');
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: {
          type: 'proxy_error',
          message: err.message || 'Error communicating with upstream OpenCode API',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
