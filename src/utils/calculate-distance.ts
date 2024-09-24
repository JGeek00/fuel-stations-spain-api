export const calculateBoundingBox = (latitude: number, longitude: number, radius: number) => {
  const earthRadiusKm = 6371; // Radius of the Earth in km
  const lat = latitude;
  const lon = longitude;

  // Convert latitude and longitude from degrees to radians
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;

  // Distance per degree of latitude and longitude in kilometers
  const latDistancePerDegree = 111.32; // ~111.32 km per degree of latitude
  const lonDistancePerDegree = Math.cos(radLat) * (Math.PI / 180) * earthRadiusKm * 1000;

  // Latitude delta (how many degrees to add/subtract)
  const latDelta = radius / latDistancePerDegree;

  // Longitude delta (how many degrees to add/subtract)
  const lonDelta = radius / (lonDistancePerDegree / 1000);

  // Minimum and maximum latitude
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;

  // Minimum and maximum longitude
  const minLon = lon - lonDelta;
  const maxLon = lon + lonDelta;

  return {
    minLat,
    maxLat,
    minLon,
    maxLon
  };
}