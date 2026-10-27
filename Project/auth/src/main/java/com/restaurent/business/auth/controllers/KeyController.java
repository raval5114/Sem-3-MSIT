package com.restaurent.business.auth.controllers;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;

@RestController
public class KeyController {

    private final RSAKey rsaPublicKey;

    public KeyController(RSAKey rsaPublicKey) {
        this.rsaPublicKey = rsaPublicKey;
    }

    @GetMapping("/.well-known/jwks.json")
    public Map<String, Object> getJwks() {
        JWKSet jwkSet = new JWKSet(this.rsaPublicKey.toPublicJWK());
        return jwkSet.toJSONObject();
    }
}
