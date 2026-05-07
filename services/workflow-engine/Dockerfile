# CargoTrack Workflow Engine — Camunda BPMN + DMN
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon 2>/dev/null || true

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/build/libs/*.jar /app/workflow-engine.jar
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/workflow-engine.jar"]
