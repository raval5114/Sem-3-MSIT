package com.restaurent.business.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@EnabledIfSystemProperty(named = "auth.integration", matches = "true")
class AuthApplicationTests {

	@Test
	void contextLoads() {
	}

}
