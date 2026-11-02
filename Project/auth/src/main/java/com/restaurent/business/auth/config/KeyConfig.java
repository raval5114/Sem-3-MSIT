package com.restaurent.business.auth.config;

import com.nimbusds.jose.jwk.RSAKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.Base64;
import java.util.EnumSet;

@Configuration
public class KeyConfig {

    private final Path keyDirectory;

    public KeyConfig(@Value("${jwt.key-dir:./data/jwt-keys}") String keyDirectory) {
        this.keyDirectory = Path.of(keyDirectory);
    }

    @Bean
    public RSAKey rsaKey() {
        try {
            KeyPair keyPair = loadOrCreateKeyPair();
            RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
            RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();
            return new RSAKey.Builder(publicKey)
                    .privateKey(privateKey)
                    .keyID(keyId(publicKey))
                    .build();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to load or create persistent JWT signing keys", ex);
        }
    }

    private KeyPair loadOrCreateKeyPair() throws Exception {
        Path privateKeyFile = keyDirectory.resolve("jwt-private.pk8");
        Path publicKeyFile = keyDirectory.resolve("jwt-public.der");
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");

        if (Files.isRegularFile(privateKeyFile) && Files.isRegularFile(publicKeyFile)) {
            RSAPrivateKey privateKey = (RSAPrivateKey) keyFactory.generatePrivate(
                    new PKCS8EncodedKeySpec(Files.readAllBytes(privateKeyFile)));
            RSAPublicKey publicKey = (RSAPublicKey) keyFactory.generatePublic(
                    new X509EncodedKeySpec(Files.readAllBytes(publicKeyFile)));
            return new KeyPair(publicKey, privateKey);
        }

        Files.createDirectories(keyDirectory);
        Files.deleteIfExists(privateKeyFile);
        Files.deleteIfExists(publicKeyFile);
        KeyPair keyPair = generateRsaKey();
        writeKey(privateKeyFile, keyPair.getPrivate().getEncoded());
        writeKey(publicKeyFile, keyPair.getPublic().getEncoded());
        return keyPair;
    }

    private void writeKey(Path destination, byte[] contents) throws IOException {
        Files.write(destination, contents, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING,
                StandardOpenOption.WRITE);
        if (destination.getFileName().toString().equals("jwt-private.pk8")) {
            try {
                Files.setPosixFilePermissions(destination, EnumSet.of(
                        PosixFilePermission.OWNER_READ,
                        PosixFilePermission.OWNER_WRITE));
            } catch (UnsupportedOperationException ignored) {
                // POSIX permissions are unavailable on some local development filesystems.
            }
        }
    }

    private String keyId(RSAPublicKey publicKey) throws Exception {
        byte[] fingerprint = MessageDigest.getInstance("SHA-256").digest(publicKey.getEncoded());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOf(fingerprint, 12));
    }

    private KeyPair generateRsaKey() {
        KeyPair keyPair;
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048);
            keyPair = keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
        return keyPair;
    }
}
