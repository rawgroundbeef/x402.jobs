import DashboardRewardsPage from "@/components/pages/DashboardRewardsPage/DashboardRewardsPage";

export const metadata = {
  title: "$JOBS Rewards | x402.jobs",
  description:
    "Manage your linked wallets and claim $JOBS revenue sharing rewards",
};

export default function Page() {
  return (
    <div className="max-w-3xl">
      <DashboardRewardsPage />
    </div>
  );
}
