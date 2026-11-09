import net from "net";
import tls from "tls";
import https from "https";

let cachedAgent = null;
let warpActive = null;
let lastCheck = 0;

export async function isWarpProxyAvailable(proxyHost = "127.0.0.1", proxyPort = 40000) {
  const now = Date.now();
  if (warpActive !== null && (now - lastCheck < 30000)) {
    return warpActive;
  }
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: proxyHost, port: proxyPort }, () => {
      socket.destroy();
      warpActive = true;
      lastCheck = Date.now();
      resolve(true);
    });
    socket.on("error", () => {
      warpActive = false;
      lastCheck = Date.now();
      resolve(false);
    });
    socket.setTimeout(500, () => {
      socket.destroy();
      warpActive = false;
      lastCheck = Date.now();
      resolve(false);
    });
  });
}

// Create custom HTTPS Agent that routes through SOCKS5 proxy on 127.0.0.1:40000
export function createSocks5HttpsAgent(proxyHost = "127.0.0.1", proxyPort = 40000) {
  return new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 50,
    createConnection(options, callback) {
      const socket = net.createConnection({ host: proxyHost, port: proxyPort }, () => {
        // Step 1: SOCKS5 greeting (version 5, 1 auth method: 00 no auth)
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      });

      let state = "HANDSHAKE";

      socket.on("data", (data) => {
        if (state === "HANDSHAKE") {
          if (data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy(new Error("SOCKS5 handshake failed"));
            return;
          }
          // Step 2: SOCKS5 connect request (domain name: 0x03)
          state = "CONNECT";
          const host = options.host;
          const port = options.port || 443;
          const hostBuf = Buffer.from(host);
          const reqBuf = Buffer.alloc(5 + hostBuf.length + 2);
          reqBuf[0] = 0x05; // SOCKS5
          reqBuf[1] = 0x01; // CONNECT
          reqBuf[2] = 0x00; // RESERVED
          reqBuf[3] = 0x03; // DOMAINNAME
          reqBuf[4] = hostBuf.length;
          hostBuf.copy(reqBuf, 5);
          reqBuf.writeUInt16BE(port, 5 + hostBuf.length);
          socket.write(reqBuf);
        } else if (state === "CONNECT") {
          if (data[0] !== 0x05 || data[1] !== 0x00) {
            socket.destroy(new Error(`SOCKS5 connect error: ${data[1]}`));
            return;
          }
          // Step 3: Successfully connected! Remove data listener and upgrade to TLS
          state = "CONNECTED";
          socket.removeAllListeners("data");
          const tlsSocket = tls.connect({
            socket,
            servername: options.host,
            rejectUnauthorized: false,
            minVersion: "TLSv1.2",
            maxVersion: "TLSv1.3",
            ciphers: [
              "ECDHE-ECDSA-AES128-GCM-SHA256",
              "ECDHE-RSA-AES128-GCM-SHA256",
              "ECDHE-ECDSA-AES256-GCM-SHA384",
              "ECDHE-RSA-AES256-GCM-SHA384",
              "ECDHE-ECDSA-CHACHA20-POLY1305",
              "ECDHE-RSA-CHACHA20-POLY1305",
              "ECDHE-RSA-AES128-SHA",
              "ECDHE-RSA-AES256-SHA",
              "AES128-GCM-SHA256",
              "AES256-GCM-SHA384"
            ].join(":"),
            ALPNProtocols: ["http/1.1"]
          }, () => {
            callback(null, tlsSocket);
          });
          tlsSocket.on("error", (err) => callback(err));
        }
      });

      socket.on("error", (err) => callback(err));
      socket.setTimeout(6000, () => {
        socket.destroy(new Error("SOCKS5 connection timeout"));
      });
    }
  });
}

// Get appropriate HTTPS Agent (Auto-detects Cloudflare WARP proxy on 127.0.0.1:40000)
export async function getD247HttpsAgent() {
  const isAvailable = await isWarpProxyAvailable("127.0.0.1", 40000);
  if (isAvailable) {
    if (!cachedAgent) {
      cachedAgent = createSocks5HttpsAgent("127.0.0.1", 40000);
      console.log("[D247 Agent] Cloudflare WARP SOCKS5 Active (127.0.0.1:40000) -> Direct Zero-Browser Bypass Enabled!");
    }
    return cachedAgent;
  }
  return undefined;
}
