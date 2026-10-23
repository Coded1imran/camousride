import { requirePageRole } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { ActivityClient } from "./ActivityClient";

export default async function AIActivityPage() {
  const user = await requirePageRole("STUDENT", "DRIVER", "ADMIN");
  return (
    <AppShell user={user} active="/ai/activity">
      <ActivityClient />
    </AppShell>
  );
}
