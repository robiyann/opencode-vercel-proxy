export const config = {
  runtime: 'edge',
};

const OPENCODE_MODELS_URL = 'https://opencode.ai/zen/v1/models';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const upstreamRes = await fetch(OPENCODE_MODELS_URL, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer public',
        'x-opencode-client': 'desktop',
        'User-Agent': 'opencode',
      },
    });

    const data = await upstreamRes.text();

    return new Response(data, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: err.message || 'Failed to fetch models' } }),
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
