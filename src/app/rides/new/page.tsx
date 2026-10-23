import { requirePageRole } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { BookingClient } from "./BookingClient";

export default async function NewRidePage() {
  const user = await requirePageRole("STUDENT");
  return (
    <AppShell user={user} active="/rides/new">
      <BookingClient riderName={user.name} />
    </AppShell>
  );
}
