export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const vercelRegion = req.headers.get('x-vercel-id') || 'unknown';

  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'OpenCode Vercel Edge Proxy',
      timestamp: new Date().toISOString(),
      clientIp,
      vercelRegion,
      endpoints: {
        chat: '/v1/chat/completions',
        models: '/v1/models'
      }
    }, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
