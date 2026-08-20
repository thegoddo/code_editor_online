package com.onlineEditor.code.websocket;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.model.Frame;
import com.onlineEditor.code.config.DockerContainerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class DockerTerminalHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(DockerTerminalHandler.class);

    private final DockerClient dockerClient;
    private final DockerContainerService containerService;

    private final Map<String, OutputStream> containerInputStreams = new ConcurrentHashMap<>();
    private final Map<String, String> sessionContainers = new ConcurrentHashMap<>();

    public DockerTerminalHandler(DockerClient dockerClient, DockerContainerService containerService) {
        this.dockerClient = dockerClient;
        this.containerService = containerService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String language = getLanguageFromSession(session);
        String containerId = containerService.createSandboxContainer(language);

        sessionContainers.put(session.getId(), containerId);

        PipedOutputStream outputToDocker = new PipedOutputStream();
        PipedInputStream inputForDocker = new PipedInputStream(outputToDocker);
        containerInputStreams.put(session.getId(), outputToDocker);

        dockerClient.attachContainerCmd(containerId)
                .withStdIn(inputForDocker)
                .withStdOut(true)
                .withStdErr(true)
                .withFollowStream(true)
                .withTimestamps(false)
                .exec(new ResultCallback.Adapter<Frame>() {
                    @Override
                    public void onNext(Frame frame) {
                        try {
                            if (session.isOpen()) {
                                session.sendMessage(new TextMessage(frame.getPayload()));
                            }
                        } catch (IOException e) {
                            log.error("Failed to send terminal frame to client", e);
                        }
                    }
                });
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        OutputStream stdin = containerInputStreams.get(session.getId());
        if (stdin != null) {
            stdin.write(message.getPayload().getBytes(StandardCharsets.UTF_8));
            stdin.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String containerId = sessionContainers.remove(session.getId());
        OutputStream stdin = containerInputStreams.remove(session.getId());

        if (stdin != null) {
            try { stdin.close(); } catch (IOException ignored) {}
        }
        if (containerId != null) {
            containerService.stopContainer(containerId);
        }
    }

    private String getLanguageFromSession(WebSocketSession session) {
        if (session.getUri() == null || session.getUri().getQuery() == null) {
            return "python";
        }
        for (String param : session.getUri().getQuery().split("&")) {
            String[] pair = param.split("=");
            if (pair.length == 2 && "language".equalsIgnoreCase(pair[0])) {
                return pair[1];
            }
        }
        return "python";
    }
}
