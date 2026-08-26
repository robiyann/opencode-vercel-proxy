// Script to test the deployed Vercel OpenCode proxy
const proxyUrl = process.argv[2];

if (!proxyUrl) {
  console.log("Usage: node test-proxy.js <DEPLOYED_URL>");
  process.exit(1);
}

const baseUrl = proxyUrl.replace(/\/$/, "");

async function test() {
  console.log(`\n=== Testing Vercel OpenCode Proxy at ${baseUrl} ===\n`);

  // 1. Test Health
  try {
    console.log("1. Testing Health Endpoint...");
    const healthRes = await fetch(`${baseUrl}/health`);
    console.log("Status:", healthRes.status);
    console.log("Response:", await healthRes.json());
  } catch (e) {
    console.error("Health test failed:", e.message);
  }

  // 2. Test Models
  try {
    console.log("\n2. Testing Models Endpoint (/v1/models)...");
    const modelsRes = await fetch(`${baseUrl}/v1/models`);
    console.log("Status:", modelsRes.status);
    const models = await modelsRes.json();
    console.log(`Found ${models.data?.length || 0} models! Sample models:`,
      models.data?.slice(0, 5).map(m => m.id)
    );
  } catch (e) {
    console.error("Models test failed:", e.message);
  }

  // 3. Test Chat Completion
  try {
    console.log("\n3. Testing Chat Completion (/v1/chat/completions)...");
    const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nemotron-3-ultra-free",
        messages: [{ role: "user", content: "Halo, jawab dalam 3 kata saja!" }],
        stream: false,
      }),
    });

    console.log("Status:", chatRes.status);
    const data = await chatRes.json();
    console.log("Chat Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Chat test failed:", e.message);
  }

  // 4. Test Streaming Chat Completion
  try {
    console.log("\n4. Testing Streaming Chat (/v1/chat/completions with stream: true)...");
    const streamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nemotron-3-ultra-free",
        messages: [{ role: "user", content: "Hitung 1 sampai 3" }],
        stream: true,
      }),
    });

    console.log("Status:", streamRes.status);
    console.log("Content-Type:", streamRes.headers.get("content-type"));
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    process.stdout.write("Stream chunks: ");
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        process.stdout.write(decoder.decode(value, { stream: true }));
      }
    }
    console.log("\nStream complete!");
  } catch (e) {
    console.error("Stream test failed:", e.message);
  }
}

test();
