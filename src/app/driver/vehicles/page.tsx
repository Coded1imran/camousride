import { requirePageRole } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { VehiclesClient } from "./VehiclesClient";

export default async function VehiclesPage() {
  const user = await requirePageRole("DRIVER");
  return (
    <AppShell user={user} active="/driver/vehicles">
      <VehiclesClient />
    </AppShell>
  );
}
