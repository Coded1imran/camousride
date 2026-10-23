import { requirePageRole } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { OpsChat } from "./OpsChat";

export default async function OpsPage() {
  const user = await requirePageRole("ADMIN");
  return (
    <AppShell user={user} active="/admin/ops">
      <OpsChat />
    </AppShell>
  );
}
