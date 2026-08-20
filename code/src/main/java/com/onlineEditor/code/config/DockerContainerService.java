package com.onlineEditor.code.config;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.github.dockerjava.api.model.HostConfig;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DockerContainerService {
    private final DockerClient dockerClient;

    // Supported language images mapping
    private static final Map<String, String> LANGUAGE_IMAGES = Map.of(
            "python", "python:3.11-alpine",
            "javascript", "node:20-alpine",
            "java", "eclipse-temurin:21-alpine",
            "cpp", "gcc:latest"
    );

    public String createSandboxContainer(String language) {
        String image = LANGUAGE_IMAGES.getOrDefault(language.toLowerCase(), "python:3.11-alpine");

        HostConfig hostConfig = HostConfig.newHostConfig()
                .withMemory(256 * 1024 * 1024L)
                .withCpuQuota(50000L) // 0.5 CPU limit
                .withPidsLimit((50L))
                .withNetworkMode("none")
                .withAutoRemove(true); // remove container when stopped

        CreateContainerResponse container = dockerClient.createContainerCmd(image)
                .withHostConfig(hostConfig)
                .withTty(true) // Allocate pseudo tty
                .withStdinOpen(true) // Keep STDIN open
                .withCmd("/bin/sh")
                .exec();

        dockerClient.startContainerCmd(container.getId()).exec();
        log.info("Sandbox container started: {}", container.getId());
        return container.getId();
    }

    public void stopContainer(String containerId) {
        try {
            dockerClient.stopContainerCmd(containerId).withTimeout(2).exec();
            log.info("Sandbox container stoppd: {}", containerId);
        } catch (Exception e) {
            log.warn("Failed or already stopped container {}: {}", containerId, e.getMessage());
        }
    }
}
