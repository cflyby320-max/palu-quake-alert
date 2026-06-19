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

// Initial great-circle bearing from point A to point B, in degrees clockwise
// from true north (0-360). Used to tell which way an epicentre lies from Palu.
export function bearingDeg(aLat, aLon, bLat, bLon) {
  const d = Math.PI / 180;
  const la1 = aLat * d;
  const la2 = bLat * d;
  const dLo = (bLon - aLon) * d;
  const y = Math.sin(dLo) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLo);
  return (Math.atan2(y, x) / d + 360) % 360;
}
