import { useState, useRef, useCallback, useEffect } from 'react'
import { useVideoSignaling } from './useVideoSignaling'

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

interface VideoCallState {
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended'
  callId: number | null
  callerId: number | null
  callerName: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
}

export function useVideoCall(conversationId: number | null) {
  const [state, setState] = useState<VideoCallState>({
    status: 'idle', callId: null, callerId: null, callerName: null,
    localStream: null, remoteStream: null,
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const update = (patch: Partial<VideoCallState>) => setState((s) => ({ ...s, ...patch }))

  const closeConnection = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    stateRef.current.localStream?.getTracks().forEach((t) => t.stop())
  }, [])

  const { send } = useVideoSignaling(conversationId, {
    onIncomingCall: (payload) => {
      update({ status: 'ringing', callId: payload.call_id, callerId: payload.caller_id, callerName: payload.caller_name })
    },

    onCallAccepted: async () => {
      update({ status: 'connecting' })
      const pc = new RTCPeerConnection(STUN_SERVERS)
      pcRef.current = pc

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({ type: 'signal', candidate: e.candidate })
        }
      }

      pc.ontrack = (e) => {
        update({ remoteStream: e.streams[0] })
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        update({ localStream: stream })
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send({ type: 'signal', sdp: pc.localDescription })
      } catch {
        update({ status: 'ended' })
      }
    },

    onSignal: async (payload) => {
      const pc = pcRef.current
      if (!pc) return

      try {
        if (payload.sdp) {
          const desc = new RTCSessionDescription(payload.sdp)
          await pc.setRemoteDescription(desc)

          if (desc.type === 'offer') {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            update({ localStream: stream })
            stream.getTracks().forEach((t) => pc.addTrack(t, stream))

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            send({ type: 'signal', sdp: pc.localDescription })
            update({ status: 'active' })
          } else {
            update({ status: 'active' })
          }
        }

        if (payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      } catch {
        // Ignore signaling errors — browser will recover or call will end
      }
    },

    onCallEnded: () => {
      closeConnection()
      update({ status: 'ended', localStream: null, remoteStream: null })
    },

    onCallMissed: () => {
      closeConnection()
      update({ status: 'ended', localStream: null, remoteStream: null })
    },
  })

  const startCall = useCallback(async (calleeId: number) => {
    update({ status: 'connecting' })

    const pc = new RTCPeerConnection(STUN_SERVERS)
    pcRef.current = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'signal', candidate: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      update({ remoteStream: e.streams[0] })
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      update({ localStream: stream })
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      send({ type: 'call', callee_id: calleeId })
      send({ type: 'signal', sdp: pc.localDescription })
    } catch {
      update({ status: 'ended' })
    }
  }, [send])

  const acceptCall = useCallback(async () => {
    const s = stateRef.current
    if (!s.callId) return
    update({ status: 'connecting' })

    const pc = new RTCPeerConnection(STUN_SERVERS)
    pcRef.current = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'signal', candidate: e.candidate })
      }
    }

    pc.ontrack = (e) => {
      update({ remoteStream: e.streams[0] })
    }

    send({ type: 'accept', call_id: s.callId })
  }, [send])

  const endCall = useCallback(() => {
    const s = stateRef.current
    if (s.callId) {
      send({ type: 'end', call_id: s.callId })
    }
    closeConnection()
    update({ status: 'ended', localStream: null, remoteStream: null, callId: null })
  }, [send, closeConnection])

  const declineCall = useCallback(() => {
    const s = stateRef.current
    if (s.callId) {
      send({ type: 'missed', call_id: s.callId })
    }
    closeConnection()
    update({ status: 'ended', localStream: null, remoteStream: null, callId: null })
  }, [send, closeConnection])

  useEffect(() => {
    return () => {
      closeConnection()
    }
  }, [closeConnection])

  return { state, startCall, acceptCall, endCall, declineCall }
}
