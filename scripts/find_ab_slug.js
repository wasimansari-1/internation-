async function findAbSlug() {
  const slugs = ['ab20', 'ab', 'andar', 'andar20', 'andarBahar', 'andarbahar', 'card32', 'baccarat', 'worli', 'btable'];
  for (const s of slugs) {
    try {
      const res = await fetch(`https://stream.trubets365.com/?id=${s}`);
      const text = await res.text();
      if (text.includes('__STREAM_RELAY_ROUTE__')) {
        const match = text.match(/window\.__STREAM_RELAY_ROUTE__\s*=\s*(\{.*?\});/);
        console.log(`Slug [${s}] -> VALID ROUTE:`, match ? match[1] : 'yes');
      } else {
        console.log(`Slug [${s}] -> No route`);
      }
    } catch(e) {}
  }
}

findAbSlug();

