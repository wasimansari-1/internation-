import { getDirectCasinoStreamUrl, CASINO_GAME_MAP } from '../backend/directStreamEngine/casinoDirectStream.js';
import { getDirectSportsStreamUrl } from '../backend/directStreamEngine/sportsDirectStream.js';

async function runDirectStreamTests() {
  console.log('==============================================');
  console.log('   DIRECT ORIGIN STREAM ENGINE - VERIFICATION ');
  console.log('==============================================\n');

  console.log('1. Checking Catalog Supported Games Count:', Object.keys(CASINO_GAME_MAP).length);

  // Test 1: Teen Patti 20-20 via common ID "3030"
  console.log('\n2. Testing Teen Patti 20-20 (ID: 3030)...');
  const tpRes = await getDirectCasinoStreamUrl('3030');
  console.log('   -> Success:', tpRes.success);
  console.log('   -> Provider:', tpRes.provider);
  console.log('   -> Stream ID:', tpRes.streamId);
  console.log('   -> WebRTC Watch Link:', tpRes.url);

  // Test 2: Dragon Tiger via alias "dt20"
  console.log('\n3. Testing Dragon Tiger (Alias: dt20)...');
  const dtRes = await getDirectCasinoStreamUrl('dt20');
  console.log('   -> Success:', dtRes.success);
  console.log('   -> Provider:', dtRes.provider);
  console.log('   -> Stream ID:', dtRes.streamId);
  console.log('   -> WebRTC Watch Link:', dtRes.url);

  // Test 3: Lucky 7 via common ID "3032"
  console.log('\n4. Testing Lucky 7 (ID: 3032)...');
  const l7Res = await getDirectCasinoStreamUrl('3032');
  console.log('   -> Success:', l7Res.success);
  console.log('   -> Provider:', l7Res.provider);
  console.log('   -> Stream ID:', l7Res.streamId);
  console.log('   -> WebRTC Watch Link:', l7Res.url);

  // Test 4: Sports Radar Tracker
  console.log('\n5. Testing Sports Radar Tracker (Event: 33924716)...');
  const sportsRes = await getDirectSportsStreamUrl('33924716', '4');
  console.log('   -> Radar Tracker Link:', sportsRes.radarUrl);

  console.log('\n==============================================');
  console.log('   ALL DIRECT ORIGIN TESTS COMPLETE!          ');
  console.log('==============================================');
}

runDirectStreamTests();

