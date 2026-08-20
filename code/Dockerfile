#---------------------------------------
# Stage 1: Build
#---------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Download dependencies (improves caching across code changes)
RUN ./mvnw dependency:go-offline -B

# Copy source code and build the application JAR
COPY src src
RUN ./mvnw clean package -DskipTests -B

#----------------------------
# Stage 2: Runtime
#----------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy built JAR from target directory (excluding plain JAR if Spring Boot creates one)
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8000

ENTRYPOINT ["java", "-jar", "app.jar"]