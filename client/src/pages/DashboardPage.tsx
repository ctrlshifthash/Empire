import { motion } from "framer-motion";
import ProfileCard from "../game/ProfileCard";
import RewardsPanel from "../game/RewardsPanel";
import InventoryDashboard from "../game/InventoryDashboard";

// Full-page player dashboard: empire record + Solana token rewards.
export default function DashboardPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-5 py-10">
      <div className="absolute inset-0 bg-hero-radial" />
      <div className="absolute inset-0 bg-grid opacity-10" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mx-auto w-full max-w-4xl"
      >
        <ProfileCard />
        <RewardsPanel />
        <InventoryDashboard />
      </motion.div>
    </div>
  );
}
