package com.cargotrack.edi.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
@ConfigurationProperties(prefix = "cargotrack.edi")
@Data
public class EdiGatewayConfig {

    private Map<String, CustomsSystemConfig> customsSystems;

    @Data
    public static class CustomsSystemConfig {
        private String name;
        private String country;
        private String baseUrl;
        private String apiKey;
        private String username;
        private String password;
        private String sftpHost;
        private int sftpPort = 22;
        private String sftpUser;
        private String sftpPassword;
        private String sftpPickupDir = "/inbox";
        private String sftpDropDir = "/outbox";
        private String as2Id;
        private String as2Url;
        private String as2Certificate;
        private String as2PrivateKey;
        private int connectTimeoutMs = 30_000;
        private int readTimeoutMs = 60_000;
        private int maxRetries = 5;
        private long retryBackoffMs = 2000;
        private String pollenCron = "0 */15 * * * ?";
    }
}
