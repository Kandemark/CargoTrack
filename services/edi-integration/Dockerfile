# CargoTrack EDI Integration Gateway — Apache Camel
# EDIFACT + ANSI X12 + AS2/AS4 + SFTP
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon 2>/dev/null || true

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache ca-certificates openssh-client
COPY --from=builder /app/build/libs/*.jar /app/edi-integration.jar
EXPOSE 8085
ENTRYPOINT ["java", "-jar", "/app/edi-integration.jar"]
