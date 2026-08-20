package com.onlineEditor.code.config;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.model.Capability;
import com.github.dockerjava.api.model.HostConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class DockerContainerService {

    private static final Logger log = LoggerFactory.getLogger(DockerContainerService.class);
    private final DockerClient dockerClient;

    public DockerContainerService(DockerClient dockerClient) {
        this.dockerClient = dockerClient;
    }

    private static final Map<String, String> LANGUAGE_IMAGES = Map.of(
            "python", "python:3.11-alpine",
            "javascript", "node:20-alpine",
            "java", "eclipse-temurin:21-alpine",
            "cpp", "gcc:latest"
    );

    public String createSandboxContainer(String language) {
        String langKey = (language != null) ? language.toLowerCase() : "python";
        String image = LANGUAGE_IMAGES.getOrDefault(langKey, "python:3.11-alpine");

        HostConfig hostConfig = HostConfig.newHostConfig()
                .withCapDrop(Capability.ALL)                          // Strip all kernel capabilities
                .withSecurityOpts(List.of("no-new-privileges:true")) // Prevent setuid privilege escalation
                .withNetworkMode("none")                              // Block all incoming/outgoing network access
                .withMemory(256 * 1024 * 1024L)                      // 256MB RAM cap
                .withCpuQuota(50000L)                                // Limit CPU usage to 50% of 1 core
                .withPidsLimit(50L)                                  // Stop fork bombs
                .withAutoRemove(true);                               // Destroy container on exit

        CreateContainerResponse container = dockerClient.createContainerCmd(image)
                .withHostConfig(hostConfig)
                .withUser("1000:1000")
                .withWorkingDir("/tmp")
                .withTty(true)
                .withStdinOpen(true)
                .withCmd("/bin/sh")
                .exec();

        dockerClient.startContainerCmd(container.getId()).exec();
        log.info("Sandbox container started: {}", container.getId());
        return container.getId();
    }

    public void stopContainer(String containerId) {
        try {
            dockerClient.stopContainerCmd(containerId).withTimeout(2).exec();
            log.info("Sandbox container stopped: {}", containerId);
        } catch (Exception e) {
            log.warn("Failed or already stopped container {}: {}", containerId, e.getMessage());
        }
    }
}
