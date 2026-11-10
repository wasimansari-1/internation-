async function checkPlayerJs() {
  const res = await fetch('https://live.livecdnplatin.com/player/player.js', {
    headers: {
      Referer: 'https://casino.startexch99.com/',
      Origin: 'https://casino.startexch99.com'
    }
  });
  console.log('player.js status:', res.status);
  console.log('player.js length:', (await res.text()).length);
}

checkPlayerJs();

