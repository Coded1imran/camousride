import { z } from 'zod';

export const RideDraftSchema = z.object({
  pickup: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  time: z.string().optional(),
  passengers: z.number().int().min(1).max(8).default(1),
  wheelchair: z.boolean().default(false),
});

export type RideDraft = z.infer<typeof RideDraftSchema>;

export const SOSIncidentSchema = z.object({
  rideId: z.string().optional(),
  type: z.enum(['SOS', 'FRAUD', 'VEHICLE', 'OTHER']).default('SOS'),
  description: z.string().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const FareQuoteSchema = z.object({
  pickup: z.string().min(2),
  destination: z.string().min(2),
  distanceKm: z.number().positive(),
  durationMin: z.number().positive(),
  passengers: z.number().int().min(1).max(8).default(1),
  surge: z.number().min(1).max(5).default(1),
  discount: z.number().min(0).max(500).default(0),
});

export const RatingSchema = z.object({
  rideId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const AvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.number().int().min(0).max(1439),
  endTime: z.number().int().min(1).max(1439),
}).refine((v) => v.endTime > v.startTime, { message: 'End time must be after start time' });

export const VehicleSchema = z.object({
  make: z.string().min(2).max(60),
  model: z.string().min(1).max(60),
  plate: z.string().min(2).max(12).toUpperCase(),
  capacity: z.number().int().min(1).max(16),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(80),
  role: z.enum(['STUDENT', 'DRIVER']).default('STUDENT'),
  phone: z.string().max(20).optional(),
  department: z.string().max(80).optional(),
  hostel: z.string().max(80).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(72),
});
