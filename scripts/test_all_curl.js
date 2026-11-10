async function testAllCurl() {
  const games = [
    { id: "3030", name: "Teen Patti 20-20" },
    { id: "3035", name: "Dragon Tiger" },
    { id: "3032", name: "Lucky 7" },
    { id: "3055", name: "Andar Bahar" },
    { id: "3047", name: "DTL (Dragon Tiger Lion)" }
  ];

  console.log("=== CURL VERIFICATION OF LOCAL PLAYERS ===");
  for (const g of games) {
    try {
      const res = await fetch(`http://127.0.0.1:5001/api/direct-stream/casino/player/${g.id}`);
      const html = await res.text();
      const wsMatch = html.match(/window\.webSocketURL="([^"]+)"/);
      console.log(`✅ [${g.name}] (id: ${g.id})`);
      console.log(`   Status: ${res.status}`);
      console.log(`   Live Stream: ${wsMatch ? wsMatch[1] : 'FAIL'}`);
    } catch(e) {
      console.error(`❌ [${g.name}] Error:`, e.message);
    }
  }

  // Test Radar Tracker
  try {
    const radar = await fetch("http://127.0.0.1:5001/api/direct-stream/sports/radar/33924716");
    console.log(`\n✅ [Match Radar Tracker] Status: ${radar.status}, Content-Type: ${radar.headers.get('content-type')}`);
  } catch(e) {
    console.error("❌ Radar error:", e.message);
  }
}

testAllCurl();

