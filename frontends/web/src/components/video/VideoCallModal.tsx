import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useState } from 'react'

interface Props {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callerName?: string | null
  status: 'connecting' | 'active'
  onEndCall: () => void
}

export default function VideoCallModal({ localStream, remoteStream, callerName, status, onEndCall }: Props) {
  const [micMuted, setMicMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const localRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream
    }
  }, [localStream])

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled))
    setMicMuted((m) => !m)
  }

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled))
    setVideoOff((v) => !v)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      {/* Remote video — full screen */}
      <div className="flex-1 relative flex items-center justify-center">
        {remoteStream ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-white/60 text-lg animate-pulse">
            {status === 'connecting' ? 'Connecting...' : 'Waiting for video...'}
          </div>
        )}

        {/* Local video — PiP */}
        <div className="absolute bottom-4 right-4 w-40 h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-800">
          {localStream && !videoOff ? (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
              Camera off
            </div>
          )}
        </div>

        {/* Caller name */}
        {callerName && (
          <div className="absolute top-4 left-4 text-white/90 text-sm font-semibold bg-black/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            {callerName}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-20 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-colors ${
            micMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title={micMuted ? 'Unmute' : 'Mute'}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onEndCall}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/30"
          title="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            videoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title={videoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  )
}
