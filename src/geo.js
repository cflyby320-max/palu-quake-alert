// Great-circle distance between two lat/lon points, in kilometres.
export function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371; // Earth radius (km)
  const d = Math.PI / 180;
  const la1 = aLat * d;
  const la2 = bLat * d;
  const dLa = (bLat - aLat) * d;
  const dLo = (bLon - aLon) * d;
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
