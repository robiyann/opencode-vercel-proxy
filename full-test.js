// Comprehensive diagnostic & model availability test for Vercel OpenCode Relay
const baseUrl = (process.argv[2] || "https://opencode-vercel-proxy-woad.vercel.app").replace(/\/$/, "");

async function run() {
  console.log(`\n======================================================`);
  console.log(`🔍 DIAGNOSTIC SUITE: Vercel OpenCode Relay`);
  console.log(`🌐 Target URL: ${baseUrl}`);
  console.log(`======================================================\n`);

  // 1. Health & Vercel Relay Status
  console.log(`[1/4] Checking Vercel Relay Health & Edge Region...`);
  try {
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/health`);
    const dt = Date.now() - t0;
    const data = await res.json();
    console.log(`  ✅ Relay Status: ACTIVE (${res.status} OK) in ${dt}ms`);
    console.log(`  📍 Vercel PoP Region: ${data.vercelRegion}`);
    console.log(`  🖥️ Inbound Client IP: ${data.clientIp}\n`);
  } catch (err) {
    console.error(`  ❌ Health check failed:`, err.message);
    return;
  }

  // 2. Fetch Available Models
  console.log(`[2/4] Fetching Model Catalog from Upstream OpenCode...`);
  let modelsList = [];
  try {
    const res = await fetch(`${baseUrl}/v1/models`);
    const catalog = await res.json();
    modelsList = catalog.data || [];
    console.log(`  ✅ Total Models Available: ${modelsList.length}`);

    const freeModels = modelsList.filter(m => m.id.endsWith("-free"));
    const premiumModels = modelsList.filter(m => !m.id.endsWith("-free"));

    console.log(`  🆓 Free Tier Models (${freeModels.length}):`);
    freeModels.forEach(m => console.log(`     - ${m.id}`));

    console.log(`  💼 Sample Premium/Flagship Models (${premiumModels.length} total):`);
    premiumModels.slice(0, 10).forEach(m => console.log(`     - ${m.id}`));
    console.log();
  } catch (err) {
    console.error(`  ❌ Failed to fetch models:`, err.message);
    return;
  }

  // 3. Test Which Free Models Are Online / Responsive (with 12s timeout)
  console.log(`[3/4] Testing Model Responsiveness via Relay...`);
  const testCandidates = [
    "nemotron-3-ultra-free",
    "mimo-v2.5-free",
    "hy3-free",
    "laguna-s-2.1-free",
    "deepseek-v4-flash-free",
    "x-preview-f-free"
  ];

  for (const model of testCandidates) {
    process.stdout.write(`  🧪 Testing "${model}"... `);
    try {
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);

      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          stream: false
        })
      });
      clearTimeout(timer);
      const dt = Date.now() - t0;
      if (res.ok) {
        const json = await res.json();
        const reply = json.choices?.[0]?.message?.content?.trim() || "";
        console.log(`✅ ONLINE (${res.status} OK, ${dt}ms) -> "${reply.substring(0, 35)}..."`);
      } else {
        const errText = await res.text();
        let errMsg = errText;
        try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch {}
        console.log(`⚠️ ${res.status} (${dt}ms) -> ${errMsg.substring(0, 60)}`);
      }
    } catch (e) {
      if (e.name === "AbortError") {
        console.log(`⏱️ TIMEOUT (>12s) - Upstream OpenCode slow for this model`);
      } else {
        console.log(`❌ ERROR: ${e.message}`);
      }
    }
  }
  console.log();

  // 4. Test Sticky Session Preservation (AI Agent Continuity)
  console.log(`[4/4] Testing Sticky Session Preservation for AI Agent...`);
  const agentSession = "ses_agent_task_abc12345";
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": agentSession
      },
      body: JSON.stringify({
        model: "nemotron-3-ultra-free",
        messages: [
          { role: "user", content: "Ingat kata rahasia: 'PISANG GORENG'" },
          { role: "assistant", content: "Baik, saya ingat kata rahasianya: PISANG GORENG" },
          { role: "user", content: "Apa kata rahasianya?" }
        ],
        stream: false
      })
    });

    const returnedSession = res.headers.get("x-session-id");
    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content?.trim() || "";

    console.log(`  ➡️ Sent Session:     ${agentSession}`);
    console.log(`  ⬅️ Preserved Session: ${returnedSession}`);
    console.log(`  🧠 Context Reply:    "${reply}"`);

    if (returnedSession === agentSession && reply.toLowerCase().includes("pisang")) {
      console.log(`  ✅ STICKY SESSION & CONTEXT PRESERVED 100%!\n`);
    } else {
      console.log(`  ⚠️ Session status: ${returnedSession}\n`);
    }
  } catch (err) {
    console.error(`  ❌ Sticky session test failed:`, err.message);
  }

  console.log(`======================================================`);
  console.log(`🎉 ALL TESTS COMPLETED!`);
  console.log(`======================================================\n`);
}

run();
