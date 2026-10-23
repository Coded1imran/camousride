/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const CAMPUS = { lat: 6.5158, lng: 3.3898 };

const LOCATIONS = [
  { name: "Main Gate", zone: "South", kind: "GATE", lat: 6.5091, lng: 3.3891 },
  { name: "Second Gate", zone: "North", kind: "GATE", lat: 6.5215, lng: 3.3915 },
  { name: "Moremi Hall", zone: "Central", kind: "HOSTEL", lat: 6.5152, lng: 3.3931 },
  { name: "New Hall", zone: "East", kind: "HOSTEL", lat: 6.5179, lng: 3.3982 },
  { name: "Faculty of Science", zone: "Central", kind: "FACULTY", lat: 6.5171, lng: 3.3871 },
  { name: "Faculty of Arts", zone: "West", kind: "FACULTY", lat: 6.5144, lng: 3.3842 },
  { name: "Faculty of Engineering", zone: "North", kind: "FACULTY", lat: 6.5202, lng: 3.3868 },
  { name: "University Library", zone: "Central", kind: "LIBRARY", lat: 6.5165, lng: 3.3905 },
  { name: "Main Cafeteria", zone: "East", kind: "CAFETERIA", lat: 6.5168, lng: 3.3944 },
  { name: "Sports Centre", zone: "East", kind: "OTHER", lat: 6.5186, lng: 3.3961 },
  { name: "Medical Centre", zone: "South", kind: "OTHER", lat: 6.5122, lng: 3.3861 },
  { name: "Senate Building", zone: "West", kind: "OTHER", lat: 6.5138, lng: 3.3872 },
];

const DRIVERS = [
  { name: "Tunde Bakare", email: "tunde.driver@campusride.edu.ng", department: "Transport Unit", hostel: "Staff Quarters", phone: "0803 111 2222" },
  { name: "Ngozi Eze", email: "ngozi.driver@campusride.edu.ng", department: "Transport Unit", hostel: "Staff Quarters", phone: "0803 333 4444" },
  { name: "Ibrahim Musa", email: "ibrahim.driver@campusride.edu.ng", department: "Transport Unit", hostel: "Staff Quarters", phone: "0803 555 6666" },
];

const VEHICLES = [
  { make: "Toyota", model: "Corolla", plate: "LAG-482-XY", capacity: 4 },
  { make: "Toyota", model: "Sienna", plate: "LAG-719-AB", capacity: 6 },
  { make: "Honda", model: "Civic", plate: "LAG-203-QW", capacity: 4 },
  { make: "Kia", model: "Rio", plate: "LAG-556-MN", capacity: 4 },
  { make: "Toyota", model: "Hiace", plate: "LAG-901-ZZ", capacity: 8 },
  { make: "Hyundai", model: "Elantra", plate: "LAG-347-KL", capacity: 4 },
];

const STUDENT_NAMES = [
  "Adaeze Okafor", "Emeka Nwosu", "Fatima Bello", "Seyi Adeyemi", "Chiamaka Obi",
  "Musa Abdullahi", "Temi Ogunleye", "Ifeoma Eze", "Kelechi Umeh", "Zainab Yusuf",
  "David Ojo", "Blessing Etim", "Samuel Ade", "Halima Sani", "Grace Oni",
];

const HOSTELS = ["Moremi Hall", "New Hall", "Senate Building", "Staff Quarters", "Main Gate"];
const DEPARTMENTS = ["Computer Science", "Medicine", "Economics", "Engineering", "Law", "Mass Communication"];

const RIDE_PAIRS = [
  ["Moremi Hall", "Faculty of Science"],
  ["New Hall", "Faculty of Arts"],
  ["Main Gate", "Faculty of Engineering"],
  ["Faculty of Science", "Moremi Hall"],
  ["University Library", "Main Cafeteria"],
  ["Second Gate", "Faculty of Science"],
  ["Moremi Hall", "University Library"],
  ["Medical Centre", "New Hall"],
  ["Sports Centre", "Main Gate"],
  ["Senate Building", "Faculty of Engineering"],
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

async function main() {
  console.log("Seeding CampusRide demo data…");

  // Clean (order matters for FKs).
  await prisma.demandEvent.deleteMany();
  await prisma.sOSIncident.deleteMany();
  await prisma.driverRating.deleteMany();
  await prisma.driverAvailability.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.aICallLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campusLocation.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@campusride.edu.ng",
      passwordHash,
      role: "ADMIN",
      name: "Campus Transport Office",
      department: "Transport Office",
      phone: "0803 000 0001",
    },
  });

  const drivers = [];
  for (const d of DRIVERS) {
    const driver = await prisma.user.create({
      data: { ...d, passwordHash, role: "DRIVER" },
    });
    drivers.push(driver);
  }

  const vehicles = [];
  for (let i = 0; i < VEHICLES.length; i++) {
    const v = await prisma.vehicle.create({
      data: { ...VEHICLES[i], ownerId: drivers[i % drivers.length].id },
    });
    vehicles.push(v);
  }

  const students = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const student = await prisma.user.create({
      data: {
        email: `${STUDENT_NAMES[i].toLowerCase().replace(/[^a-z]+/g, ".")}@student.campusride.edu.ng`,
        passwordHash,
        role: "STUDENT",
        name: STUDENT_NAMES[i],
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        hostel: HOSTELS[i % HOSTELS.length],
        phone: `0803 200 ${String(1000 + i).slice(-4)}`,
      },
    });
    students.push(student);
  }

  await prisma.campusLocation.createMany({ data: LOCATIONS });

  // Driver availability: weekdays + weekend evenings.
  for (const driver of drivers) {
    for (let day = 0; day <= 6; day++) {
      await prisma.driverAvailability.create({
        data: {
          driverId: driver.id,
          dayOfWeek: day,
          startTime: day === 0 || day === 6 ? 16 * 60 : 7 * 60,
          endTime: day === 0 || day === 6 ? 23 * 60 : 21 * 60,
        },
      });
    }
  }

  const statuses = [
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
    "COMPLETED", "COMPLETED", "CANCELLED", "CANCELLED", "CANCELLED",
    "IN_PROGRESS", "IN_PROGRESS", "MATCHED", "MATCHED", "MATCHED",
    "REQUESTED", "REQUESTED", "REQUESTED", "REQUESTED", "REQUESTED",
  ];

  const rides = [];
  for (let i = 0; i < 40; i++) {
    const rider = students[i % students.length];
    const driver = drivers[i % drivers.length];
    const pair = RIDE_PAIRS[i % RIDE_PAIRS.length];
    const status = statuses[i];
    const needsDriver = ["COMPLETED", "IN_PROGRESS", "MATCHED"].includes(status);
    const fare = 250 + ((i * 37) % 450);
    const created = daysAgo(Math.floor(i / 6));

    const ride = await prisma.ride.create({
      data: {
        riderId: rider.id,
        driverId: needsDriver ? driver.id : null,
        status,
        pickup: pair[0],
        destination: pair[1],
        passengers: 1 + (i % 3),
        scheduledAt: created,
        fare: { total: fare, currency: "NGN", surge: i % 7 === 0 ? 1.5 : 1, discount: i % 4 === 0 ? 60 : 0 },
        poolId: i % 5 === 0 ? `pool-${Math.floor(i / 5)}` : null,
        statusHistory: {
          REQUESTED: created.toISOString(),
          ...(needsDriver ? { MATCHED: created.toISOString() } : {}),
          ...(["COMPLETED", "IN_PROGRESS"].includes(status) ? { IN_PROGRESS: created.toISOString() } : {}),
          ...(status === "COMPLETED" ? { COMPLETED: daysAgo(Math.floor(i / 6)).toISOString() } : {}),
        },
        createdAt: created,
      },
    });
    rides.push(ride);

    if (status === "COMPLETED") {
      await prisma.demandEvent.create({
        data: {
          zone: LOCATIONS.find((l) => l.name === pair[1])?.zone ?? "Central",
          hour: created.getHours(),
          rideId: ride.id,
          createdAt: created,
        },
      });

      if (i % 2 === 0) {
        await prisma.driverRating.create({
          data: {
            rideId: ride.id,
            fromUserId: rider.id,
            toUserId: driver.id,
            score: 4 + (i % 2),
            comment: i % 4 === 0 ? "Smooth ride, very professional." : "On time and friendly.",
            createdAt: created,
          },
        });
      }
    }
  }

  // A couple of safety incidents for the admin console.
  const sosRide = rides.find((r) => r.status === "COMPLETED");
  if (sosRide) {
    await prisma.sOSIncident.create({
      data: {
        rideId: sosRide.id,
        userId: sosRide.riderId,
        type: "SOS",
        lat: 6.5165,
        lng: 3.391,
        description: "Rider reported a long stop on a late-night trip near the library.",
        status: "OPEN",
        summary: { severity: "high", reason: "Long stop + late-night ride", recommendedAction: "Call rider and driver" },
      },
    });
    await prisma.sOSIncident.create({
      data: {
        rideId: null,
        userId: students[3].id,
        type: "FRAUD",
        description: "Driver asked for cash instead of in-app payment.",
        status: "ACKED",
        summary: { severity: "medium", reason: "Off-platform payment request" },
      },
    });
  }

  const counts = {
    admins: 1,
    drivers: drivers.length,
    students: students.length,
    vehicles: vehicles.length,
    rides: rides.length,
    locations: LOCATIONS.length,
    adminEmail: admin.email,
  };
  console.log("Seed complete:", counts);
  console.log("Demo password for every seeded account: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
