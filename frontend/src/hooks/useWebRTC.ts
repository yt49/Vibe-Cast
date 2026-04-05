import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTC(
  roomId: string,
  onSessionId?: (id: string) => void,
  onRecordingStop?: () => void,
  onRoleConflict?: () => void,
) {
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 常に最新のコールバックを参照（stale closure対策）
  const onSessionIdRef = useRef(onSessionId);
  const onRecordingStopRef = useRef(onRecordingStop);
  const onRoleConflictRef = useRef(onRoleConflict);
  onSessionIdRef.current = onSessionId;
  onRecordingStopRef.current = onRecordingStop;
  onRoleConflictRef.current = onRoleConflict;

  const connect = useCallback(async (localStream: MediaStream, role: 'host' | 'guest') => {
    const ws = new WebSocket(
      `${import.meta.env.VITE_BACKEND_URL.replace(/^http/, 'ws')}/ws/${roomId}`
    );
    wsRef.current = ws;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
    };
    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === 'connected');
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'role', role }));
    };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'role') {
        if (msg.role === role) {
          onRoleConflictRef.current?.();
        }
      } else if (msg.type === 'peer_joined') {
        ws.send(JSON.stringify({ type: 'role', role }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
      } else if (msg.type === 'offer') {
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
      } else if (msg.type === 'answer') {
        await pc.setRemoteDescription(msg.sdp);
      } else if (msg.type === 'candidate') {
        await pc.addIceCandidate(msg.candidate);
      } else if (msg.type === 'session_id') {
        onSessionIdRef.current?.(msg.id);
      } else if (msg.type === 'session_stop') {
        onRecordingStopRef.current?.();
      }
    };
  }, [roomId]);

  const sendSessionId = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'session_id', id }));
  }, []);

  const sendRecordingStop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'session_stop' }));
  }, []);

  const disconnect = useCallback(() => {
    pcRef.current?.close();
    wsRef.current?.close();
    setConnected(false);
    setRemoteStream(null);
  }, []);

  return { connect, disconnect, connected, remoteStream, sendSessionId, sendRecordingStop };
}
