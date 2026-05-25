import TimelineDashboard from "@/components/timeline-dashboard";
import { getRegions } from "@/lib/data";
import { FEATURE_KEYS } from "@/lib/shared";

export default async function HomePage() {
  const regions = await getRegions();
  return <TimelineDashboard regions={regions} featureKeys={FEATURE_KEYS} />;
}
