import { headers } from "next/headers";
import QRCode from "qrcode";

export default async function LeaderboardQrCode() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0].trim() || requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol?.split(",")[0].trim() ||
    (host?.startsWith("localhost") ? "http" : "https");
  const trackUrl = `${protocol}://${host || "localhost:3000"}/track`;
  const svg = await QRCode.toString(trackUrl, {
    type: "svg",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="rounded-3xl bg-white p-6 text-center text-black">
      <div
        aria-label={`QR code for ${trackUrl}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-4 text-lg font-black tracking-tight">
        scan to get coached
      </p>
      <p className="mt-2 break-all font-mono text-xs text-black/60">
        {trackUrl}
      </p>
    </div>
  );
}
