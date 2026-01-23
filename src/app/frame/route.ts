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
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 18px;
        background: radial-gradient(circle at top, #141726, #06070d 60%);
        color: #e5e7eb;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .card {
        width: min(340px, 92vw);
        background: linear-gradient(180deg, rgba(20, 22, 30, 0.98), rgba(13, 15, 20, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 18px;
        padding: 22px 18px 24px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.65);
        text-align: center;
      }
      .logo {
        width: 70px;
        height: 70px;
        border-radius: 16px;
        border: 1px solid rgba(34, 197, 94, 0.35);
        margin: 0 auto 16px;
        background: #0b0d13;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .logo img {
        width: 44px;
        height: 44px;
        object-fit: contain;
        border-radius: 12px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 19px;
        font-weight: 700;
      }
      p {
        margin: 0 0 18px;
        color: #a1a1aa;
        font-size: 13px;
        line-height: 1.45;
      }
      button {
        padding: 10px 16px;
        font-size: 13px;
        cursor: pointer;
        border: none;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        border-radius: 10px;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">
        <img src="${origin}/icon.png" alt="Pacificast" />
      </div>
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
