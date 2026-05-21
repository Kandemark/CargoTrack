# CargoTrack Workflow Engine — Camunda BPMN + DMN
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN apk add --no-cache gradle
RUN gradle bootJar --no-daemon -q

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 1000 app \
    && adduser -S -u 1000 -G app app
COPY --from=builder /app/build/libs/*.jar /app/workflow-engine.jar
RUN chown -R app:app /app
USER app
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/workflow-engine.jar"]
