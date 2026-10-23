import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { RideDetail } from "./RideDetail";

export default async function RideDetailPage({ params }: { params: { id: string } }) {
  const user = await requireSession();

  const ride = await prisma.ride.findUnique({
    where: { id: params.id },
    include: {
      rider: { select: { id: true, name: true, phone: true, hostel: true, department: true } },
      driver: { select: { id: true, name: true, phone: true } },
      ratings: { select: { id: true, score: true, comment: true, fromUserId: true, createdAt: true } },
      sosIncidents: { select: { id: true, status: true, type: true, createdAt: true } },
    },
  });

  if (!ride) redirect("/dashboard");

  const isParticipant = ride.riderId === user.id || ride.driverId === user.id;
  const canPreview = user.role === "DRIVER" && ride.status === "REQUESTED";
  if (!isParticipant && !canPreview && user.role !== "ADMIN") redirect("/dashboard");

  const data = {
    id: ride.id,
    status: ride.status,
    pickup: ride.pickup,
    destination: ride.destination,
    pickupLat: ride.pickupLat,
    pickupLng: ride.pickupLng,
    destLat: ride.destLat,
    destLng: ride.destLng,
    passengers: ride.passengers,
    scheduledAt: ride.scheduledAt?.toISOString() ?? null,
    createdAt: ride.createdAt.toISOString(),
    fare: ride.fare as {
      total?: number;
      currency?: string;
      base?: number;
      surge?: number;
      discount?: number;
      distanceKm?: number;
      durationMin?: number;
    } | null,
    statusHistory: (ride.statusHistory as Record<string, string>) ?? {},
    poolId: ride.poolId,
    rider: ride.rider,
    driver: ride.driver,
    ratings: ride.ratings.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      fromUserId: r.fromUserId,
      createdAt: r.createdAt.toISOString(),
    })),
    sosIncidents: ride.sosIncidents.map((s) => ({
      id: s.id,
      status: s.status,
      type: s.type,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return (
    <AppShell user={user} active={user.role === "DRIVER" ? "/driver/rides" : "/rides"}>
      <RideDetail ride={data} role={user.role as "STUDENT" | "DRIVER" | "ADMIN"} userId={user.id} />
    </AppShell>
  );
}
