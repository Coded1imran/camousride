export interface FareBreakdown {
  base: number;
  currency: string;
  perKm: number;
  perMin: number;
  surge: number;
  discount: number;
  total: number;
  distanceKm: number;
  durationMin: number;
  passengers: number;
  shareable: boolean;
}

export const CAMPUS_FARE = {
  base: 150,
  currency: 'NGN',
  perKm: 50,
  perMin: 25,
  surgeThreshold: 1.5,
};

export function computeFare(input: {
  distanceKm: number;
  durationMin: number;
  passengers?: number;
  surge?: number;
  discount?: number;
}): FareBreakdown {
  const distanceKm = input.distanceKm > 0 ? input.distanceKm : 2;
  const durationMin = input.durationMin > 0 ? input.durationMin : 12;
  const passengers = input.passengers && input.passengers > 0 ? input.passengers : 1;
  const surge = input.surge && input.surge > 0 ? input.surge : 1;
  const discount = input.discount && input.discount > 0 ? input.discount : 0;

  const base = CAMPUS_FARE.base;
  const perKm = CAMPUS_FARE.perKm * distanceKm;
  const perMin = CAMPUS_FARE.perMin * durationMin;
  const subtotal = base + perKm + perMin;
  const total = Math.max(0, Math.round(subtotal * surge - discount));

  return {
    base,
    currency: CAMPUS_FARE.currency,
    perKm: CAMPUS_FARE.perKm,
    perMin: CAMPUS_FARE.perMin,
    surge,
    discount,
    total,
    distanceKm,
    durationMin,
    passengers,
    shareable: passengers > 1 && discount > 0,
  };
}

export function estimateDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat = (b.lat - a.lat) * 111;
  const lng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.sqrt(lat * lat + lng * lng) * 10) / 10;
}

export function estimateDurationMin(distanceKm: number, trafficFactor = 1): number {
  return Math.max(5, Math.round((distanceKm / 30) * 60 * trafficFactor));
}
