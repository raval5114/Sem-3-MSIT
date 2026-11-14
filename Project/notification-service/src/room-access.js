function roomForClaims(claims) {
  if (claims?.type === "STAFF" && claims.restaurantId) {
    return `kitchen:${claims.restaurantId}`;
  }
  if (claims?.type === "CUSTOMER" && claims.tableSessionId) {
    return `table:${claims.tableSessionId}`;
  }
  return null;
}

function canJoinRoom(claims, room) {
  return typeof room === "string" && room === roomForClaims(claims);
}

module.exports = { roomForClaims, canJoinRoom };
