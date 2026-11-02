const crypto = require("node:crypto");

const ISSUER = "https://dineflow.com/api/v1/auth";

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

class JwtVerifier {
  constructor({ jwksUrl = process.env.AUTH_JWKS_URL || "http://localhost:8081/.well-known/jwks.json", fetchImpl = fetch, clock = () => Date.now() } = {}) {
    this.jwksUrl = jwksUrl;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.keys = null;
    this.keysExpireAt = 0;
  }

  async verify(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw new Error("Invalid bearer token");
    let header;
    let claims;
    try { header = decodePart(parts[0]); claims = decodePart(parts[1]); }
    catch { throw new Error("Invalid bearer token"); }
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported bearer token");
    const jwk = await this.key(header.kid);
    const valid = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
    if (!valid) throw new Error("Invalid bearer token signature");
    const now = Math.floor(this.clock() / 1000);
    if (claims.iss !== ISSUER || !claims.exp || claims.exp <= now || (claims.nbf && claims.nbf > now)) {
      throw new Error("Expired or invalid bearer token");
    }
    return claims;
  }

  async key(kid) {
    if (!this.keys || this.keysExpireAt <= this.clock()) {
      let response;
      try { response = await this.fetch(this.jwksUrl); }
      catch { throw new Error("Auth key service is unavailable"); }
      if (!response.ok) throw new Error("Auth key service is unavailable");
      const body = await response.json();
      this.keys = Array.isArray(body.keys) ? body.keys : [];
      this.keysExpireAt = this.clock() + 60_000;
    }
    const key = this.keys.find((candidate) => candidate.kid === kid && candidate.kty === "RSA" && candidate.use !== "enc");
    if (!key) throw new Error("Unknown signing key");
    return key;
  }
}

module.exports = { JwtVerifier, ISSUER };

