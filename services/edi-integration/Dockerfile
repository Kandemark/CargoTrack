# ── Build stage ──────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build
COPY pom.xml .
COPY src/ src/
RUN find src/ -name "*.java" -exec sh -c ' \
      [ "$(head -c 3 "$1")" = "$(printf "\\xef\\xbb\\xbf")" ] && { tail -c +4 "$1" > "$1.tmp" && mv "$1.tmp" "$1"; } \
    ' _ {} \; && \
    mvn package -DskipTests -B -q

# ── Run stage ────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S cargotrack && adduser -S cargotrack -G cargotrack
USER cargotrack
WORKDIR /app
COPY --from=build /build/target/edi-integration-*.jar app.jar

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${SERVER_PORT:-8080}/actuator/health || exit 1

EXPOSE 8080 9090
ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", \
            "-Djava.security.egd=file:/dev/./urandom", \
            "-jar", "/app/app.jar"]
