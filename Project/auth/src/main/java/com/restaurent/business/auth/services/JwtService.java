package com.restaurent.business.auth.services;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import com.nimbusds.jose.jwk.RSAKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

@Service
public class JwtService {

    private final PrivateKey privateKey;
    private final PublicKey publicKey;
    private final String keyId;

    @Autowired
    public JwtService(RSAKey rsaKey) {
        try {
            this.privateKey = rsaKey.toPrivateKey();
            this.publicKey = rsaKey.toPublicKey();
            this.keyId = rsaKey.getKeyID();
        } catch (Exception e) {
            throw new RuntimeException("Failed to load RSA Keys", e);
        }
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(publicKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    public String generateToken(String userName, Map<String, Object> extraClaims) {
        // Staff TTL is 15 mins (900,000 ms)
        long expirationMs = 900_000;
        return createToken(extraClaims, userName, expirationMs);
    }

    public String generateTableSessionToken(String subject, Map<String, Object> extraClaims) {
        // Table Session TTL is 2 hours (7,200,000 ms)
        long expirationMs = 7_200_000;
        return createToken(extraClaims, subject, expirationMs);
    }

    private String createToken(Map<String, Object> claims, String subject, long expirationMs) {
        return Jwts.builder()
                .setHeaderParam("kid", keyId)
                .setClaims(claims)
                .setSubject(subject)
                .setIssuer("https://dineflow.com/api/v1/auth")
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(privateKey, SignatureAlgorithm.RS256)
                .compact();
    }
}
