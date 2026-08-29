import LeaderboardClient from "./leaderboard-client";
import LeaderboardQrCode from "./qr-code";

export default function LeaderboardPage() {
  return <LeaderboardClient qrCode={<LeaderboardQrCode />} />;
}
