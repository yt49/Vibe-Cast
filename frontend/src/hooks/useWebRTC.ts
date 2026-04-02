import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTC(roomId: string) {
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async (localStream: MediaStream) => {
    const ws = new WebSocket(`wss://vibe-cast-backend-905541599300.asia-northeast1.run.app/ws/${roomId}`);
    wsRef.current = ws;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // 自分のマイク音声を相手に送る
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // 相手の音声を受け取る
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);

    // ICE候補を相手に送る
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === 'connected');
    };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'peer_joined') {
        // 自分が先に部屋にいた → offerを作って送る
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
      } else if (msg.type === 'offer') {
        // 相手からofferが来た → answerを返す
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
      } else if (msg.type === 'answer') {
        await pc.setRemoteDescription(msg.sdp);
      } else if (msg.type === 'candidate') {
        await pc.addIceCandidate(msg.candidate);
      }
    };
  }, [roomId]);

  const disconnect = useCallback(() => {
    pcRef.current?.close();
    wsRef.current?.close();
    setConnected(false);
    setRemoteStream(null);
  }, []);

  return { connect, disconnect, connected, remoteStream };
}
