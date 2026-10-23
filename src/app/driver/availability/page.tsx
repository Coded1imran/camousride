import { requirePageRole } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  const user = await requirePageRole("DRIVER");
  return (
    <AppShell user={user} active="/driver/availability">
      <AvailabilityClient />
    </AppShell>
  );
}
