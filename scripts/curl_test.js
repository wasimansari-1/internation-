import http from 'http';

function curlTest(path) {
  return new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: 5001,
      path: path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          length: data.length,
          preview: data.slice(0, 300)
        });
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function testAll() {
  console.log('Testing /api/direct-stream/health:');
  const h = await curlTest('/api/direct-stream/health');
  console.log(h);

  console.log('\nTesting /api/direct-stream/casino/link/3030:');
  const l = await curlTest('/api/direct-stream/casino/link/3030');
  console.log(l);

  console.log('\nTesting /api/direct-stream/casino/player/3030:');
  const p = await curlTest('/api/direct-stream/casino/player/3030');
  console.log(p);
}

testAll();

