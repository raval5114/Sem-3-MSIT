const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { JwtVerifier, ISSUER } = require("../src/jwt-verifier");

function tokenPair(claimOverrides = {}) {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = pair.publicKey.export({ format: "jwk" });
  const jwk = { ...publicJwk, kid: "test-key", kty: "RSA", use: "sig" };
  const encode = (object) => Buffer.from(JSON.stringify(object)).toString("base64url");
  const header = encode({ alg: "RS256", kid: jwk.kid, typ: "JWT" });
  const claims = encode({ iss: ISSUER, sub: "guest_test", exp: 2_000_000_000, type: "CUSTOMER", ...claimOverrides });
  const content = `${header}.${claims}`;
  return { jwk, token: `${content}.${crypto.sign("RSA-SHA256", Buffer.from(content), pair.privateKey).toString("base64url")}` };
}

test("verifies RS256 JWT from the Auth Service JWKS", async () => {
  const { jwk, token } = tokenPair();
  const verifier = new JwtVerifier({ clock: () => 1_900_000_000_000, fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }) });
  assert.equal((await verifier.verify(token)).sub, "guest_test");
});

test("rejects wrong issuer and expired token after signature verification", async () => {
  const wrongIssuer = tokenPair({ iss: "https://attacker.invalid" });
  const verifier1 = new JwtVerifier({ clock: () => 1_900_000_000_000, fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [wrongIssuer.jwk] }) }) });
  await assert.rejects(verifier1.verify(wrongIssuer.token), /Expired or invalid/);
  const expired = tokenPair({ exp: 1_800_000_000 });
  const verifier2 = new JwtVerifier({ clock: () => 1_900_000_000_000, fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [expired.jwk] }) }) });
  await assert.rejects(verifier2.verify(expired.token), /Expired or invalid/);
});

test("rejects tampered token and unknown signing key", async () => {
  const signed = tokenPair();
  const verifier = new JwtVerifier({ clock: () => 1_900_000_000_000, fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [signed.jwk] }) }) });
  const parts = signed.token.split(".");
  await assert.rejects(verifier.verify(`${parts[0]}.${Buffer.from(JSON.stringify({ iss: ISSUER, sub: "guest_test", exp: 2_000_000_000 })).toString("base64url")}.${parts[2]}`), /signature/);
  const unknown = new JwtVerifier({ fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [] }) }) });
  await assert.rejects(unknown.verify(signed.token), /Unknown signing key/);
});
