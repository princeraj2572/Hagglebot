"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** "Beat the bot": a QR code that opens this thread's seller side on someone's phone. */
export function LiveSellerCard({ threadId }: { threadId: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/sell/${encodeURIComponent(threadId)}`;
    setUrl(u);
    void QRCode.toDataURL(u, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(""));
  }, [threadId]);
  const local = url.includes("//localhost") || url.includes("//127.0.0.1");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/5 p-4">
      {qr && <img src={qr} alt="QR code that opens the seller chat" width={120} height={120} className="rounded-md bg-white" />}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-semibold">Beat the bot: you play the seller</p>
        <p className="text-muted">Scan with a phone and haggle against Hagglebot. Try to push the price up, add a fee or ask for its budget.</p>
        <a className="block break-all font-medium text-ultra underline-offset-4 [@media(hover:hover)]:hover:underline" href={url} target="_blank" rel="noreferrer">{url}</a>
        {local && <p className="text-[13px] text-scam">Phones can't reach localhost: open this dashboard with your computer's network address (shown when the dev server starts) and scan again.</p>}
      </div>
    </div>
  );
}
