async function inspectPlayerJsCode() {
  const res = await fetch('https://live.livecdnplatin.com/player/player.js');
  const code = await res.text();
  console.log('Code length:', code.length);

  // Search for fetch or xhr or webrtc
  const matches = [...code.matchAll(/fetch\([^)]+\)|\.post\([^)]+\)|RTCPeerConnection/g)];
  console.log('Matches:', matches.slice(0, 15).map(m => m[0]));

  // Search for endpoints or paths
  const paths = [...code.matchAll(/["']\/[a-zA-Z0-9_\-\.\/]+["']/g)];
  console.log('Paths:', [...new Set(paths.map(m => m[0]))]);
}

inspectPlayerJsCode();

