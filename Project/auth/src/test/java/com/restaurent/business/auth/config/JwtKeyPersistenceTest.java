package com.restaurent.business.auth.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.nimbusds.jose.jwk.RSAKey;
import com.restaurent.business.auth.services.JwtService;

import io.jsonwebtoken.security.SignatureException;

class JwtKeyPersistenceTest {

    @TempDir
    Path keyDirectory;

    @Test
    void tokenRemainsVerifiableWhenKeyConfigIsRecreatedFromSameDirectory() {
        RSAKey keyBeforeRestart = new KeyConfig(keyDirectory.toString()).rsaKey();
        String token = new JwtService(keyBeforeRestart).generateToken("staff@example.com", Map.of());

        RSAKey keyAfterRestart = new KeyConfig(keyDirectory.toString()).rsaKey();
        JwtService restartedJwtService = new JwtService(keyAfterRestart);

        assertEquals(keyBeforeRestart.getKeyID(), keyAfterRestart.getKeyID());
        assertEquals("staff@example.com", restartedJwtService.extractUsername(token));
    }

    @Test
    void tokenSignedByDifferentKeyIsRejected() {
        RSAKey signingKey = new KeyConfig(keyDirectory.resolve("signer").toString()).rsaKey();
        RSAKey unrelatedKey = new KeyConfig(keyDirectory.resolve("other").toString()).rsaKey();
        String token = new JwtService(signingKey).generateToken("staff@example.com", Map.of());

        assertThrows(SignatureException.class,
                () -> new JwtService(unrelatedKey).extractUsername(token));
    }
}
