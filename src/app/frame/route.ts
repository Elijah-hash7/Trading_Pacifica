import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pacificast Frame</title>
    <meta name="fc:frame" content="true" />
    <meta name="fc:frame:version" content="1" />
    <meta name="fc:frame:name" content="Pacificast" />
    <meta name="fc:frame:icon" content="${origin}/icon.png" />
    <meta name="fc:frame:homeUrl" content="${origin}" />
    <meta name="fc:frame:buttonTitle" content="Open Pacificast" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at top, #0f172a, #05060c 60%);
        color: #e2e8f0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .card {
        width: min(520px, 92vw);
        background: #0b1220;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        text-align: center;
      }
      .logo {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        border: 2px solid rgba(56, 189, 248, 0.6);
        margin: 0 auto 16px;
        background: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: 700;
        color: #38bdf8;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0 0 20px;
        color: #94a3b8;
      }
      button {
        padding: 12px 20px;
        font-size: 16px;
        cursor: pointer;
        border: none;
        background: linear-gradient(135deg, #38bdf8, #4f46e5);
        color: white;
        border-radius: 10px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">P</div>
      <h1>Welcome to Pacificast!</h1>
      <p>Click the button to connect your wallet and start using the dapp.</p>
      <button id="connectWalletBtn">Connect Wallet</button>
    </div>
    <script>
      const connectButton = document.getElementById("connectWalletBtn");
      connectButton.addEventListener("click", async () => {
        if (!window.farcaster) {
          alert("Please open this in the Farcaster app!");
          return;
        }
        try {
          const wallet = await window.farcaster.connect();
          alert("Connected! Wallet address: " + wallet.address);
        } catch (err) {
          console.error(err);
          alert("Wallet connection failed. Check console for errors.");
        }
      });
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
