package com.onlineEditor.code.websocket;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.model.Frame;
import com.onlineEditor.code.config.DockerContainerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.awt.*;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class DockerTerminalHandler extends TextWebSocketHandler {

    private final DockerClient dockerClient;
    private final DockerContainerService containerService;

    // Session ID -> Container Output Stream (Terminal STDIN)
    private final Map<String, OutputStream> containerInputStreams = new ConcurrentHashMap<>();
    // Session ID -> Container ID
    private final Map<String, String> sessionContainers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String language = getLanguageFromSession(session);
        String containerId = containerService.createSandboxContainer(language);

        sessionContainers.put(session.getId(), containerId);

        PipedOutputStream outputToDocker = new PipedOutputStream();
        PipedInputStream inputFromDocker = new PipedInputStream();
        containerInputStreams.put(session.getId(), outputToDocker);

        dockerClient.attachContainerCmd(containerId)
                .withStdIn(inputFromDocker)
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
                            log.error("Failed to send terminal frame to client");
                        }
                    }

                }
                );
    }
    @Override
    protected  void handleTextMessage(WebSocketSession session, TextMessage message)throws Exception {
        OutputStream stdin = containerInputStreams.get(session.getId());
        if(stdin != null) {
            stdin.write(message.getPayload().getBytes(StandardCharsets.UTF_8));
            stdin.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String containerId = sessionContainers.remove(session.getId());
        OutputStream stdin = containerInputStreams.remove(session.getId());

        if (stdin != null) {
            try {stdin.close();} catch (IOException ignored) {}
        }
        if(containerId != null) {
            containerService.stopContainer(containerId);
        }
    }

    private String getLanguageFromSession(WebSocketSession session) {
        if(session.getUri() == null || session.getUri().getQuery() == null)  {
            return "python";
        }

        for (String param: session.getUri().getQuery().split("&")) {
            String[] pair = param.split("=");
            if(pair.length == 2 && "language".equalsIgnoreCase(pair[0])) {
                return pair[1];
            }
        }
        return "python";
    }
}
