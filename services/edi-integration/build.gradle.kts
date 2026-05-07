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
    // Spring Boot + Apache Camel
    implementation("org.apache.camel.springboot:camel-spring-boot-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-ftp-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-kafka-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-jackson-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-quartz-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-http-starter:4.9.0")
    implementation("org.apache.camel.springboot:camel-sftp-starter:4.9.0")

    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Smooks for EDIFACT/EDI parsing
    implementation("org.milyn:milyn-smooks-edi:1.7.0")
    implementation("org.milyn:milyn-smooks-core:1.7.0")

    // Google Gson
    implementation("com.google.code.gson:gson:2.11.0")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
