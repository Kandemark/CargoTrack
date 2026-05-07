plugins {
    java
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.cargotrack"
version = "0.1.0"

java {
    sourceCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Camunda Platform 7 embedded engine
    implementation("org.camunda.bpm.springboot:camunda-bpm-spring-boot-starter-rest:7.21.0")
    implementation("org.camunda.bpm.springboot:camunda-bpm-spring-boot-starter-webapp:7.21.0")
    implementation("org.camunda.bpm:camunda-engine-plugin-spin:7.21.0")
    implementation("org.camunda.spin:camunda-spin-dataformat-json-jackson:1.23.0")

    // Kafka
    implementation("org.springframework.kafka:spring-kafka")

    // Database
    runtimeOnly("org.postgresql:postgresql")

    // Utilities
    implementation("com.google.code.gson:gson:2.11.0")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
