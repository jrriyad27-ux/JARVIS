import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Mic, MicOff, UserCheck, Activity, Power, Volume2 } from 'lucide-react';

// API Key provided by the user
const apiKey = "AIzaSyCoVxqa5S0nU07_A5KdVaMWWl_N7YTBG-A"; 

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("System Standby. Click Power to Initialize.");
  const [messages, setMessages] = useState([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(false);
  
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const currentSourceRef = useRef(null); 

  // Mobile Audio fix: Resume AudioContext on every interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playPCM = async (base64Data) => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) {}
    }
    initAudioContext();
    
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768;

    const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    currentSourceRef.current = source;
    source.start();
  };

  const speak = async (text) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
          }
        })
      });
      const data = await response.json();
      const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioBase64) await playPCM(audioBase64);
    } catch (error) { console.error("TTS Error"); }
  };

  const processWithAI = async (query) => {
    setStatus("Thinking...");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are Jarvis, created by Riyad sir. Use a warm, proactive, human-like tone. Introduce yourself as: 'Hello sir! I'm Jarvis. Amake Riyad sir baniyese. Tar personal assistant hisebe.' Speak English and Bengali mixed as the user does. Be very concise." }]
          },
          contents: [{ parts: [{ text: query }] }]
        })
      });
      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sir, network issue.";
      setMessages(prev => [...prev, { role: 'jarvis', text: aiText }]);
      await speak(aiText);
      setStatus("Listening...");
    } catch (error) { setStatus("Sync Error."); }
  };

  const startSystem = async () => {
    initAudioContext();
    setIsSystemActive(true);
    setStatus("Syncing Neural Links...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onspeechstart = () => {
          if (currentSourceRef.current) {
            currentSourceRef.current.stop();
            currentSourceRef.current = null;
          }
        };

        recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          if (transcript.trim()) {
            setMessages(prev => [...prev, { role: 'user', text: transcript }]);
            processWithAI(transcript);
          }
        };

        recognition.onend = () => { if (isSystemActive) recognition.start(); };
        recognitionRef.current = recognition;
        recognition.start();

        setTimeout(() => {
          setFaceDetected(true);
          const intro = "Hello sir! I'm Jarvis. Amake Riyad sir baniyese. How can I help you?";
          setMessages([{ role: 'jarvis', text: intro }]);
          speak(intro);
          setStatus("Online");
        }, 1000);
      }
    } catch (err) { setStatus("Permission Denied."); }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono flex flex-col items-center overflow-hidden">
      {/* HUD Header */}
      <div className="w-full p-4 flex justify-between items-center border-b border-cyan-900/30">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="animate-pulse" />
          <span className="text-sm font-bold tracking-tighter text-white">JARVIS_MOB_V3</span>
        </div>
        <div className={`text-[10px] ${faceDetected ? 'text-green-500' : 'text-slate-600'}`}>
          {faceDetected ? 'RIYAD_LINK_OK' : 'SEARCHING_FACE'}
        </div>
      </div>

      {!isSystemActive ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <button onClick={startSystem} className="w-24 h-24 bg-cyan-500/20 border-2 border-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
            <Power size={40} />
          </button>
          <p className="text-[10px] uppercase tracking-widest opacity-50 text-center">Tap to Wake Jarvis</p>
        </div>
      ) : (
        <div className="flex-1 w-full flex flex-col p-4 gap-4">
          {/* Mobile Camera Preview */}
          <div className="relative h-1/3 rounded-2xl overflow-hidden border border-cyan-900/50 bg-slate-950">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-30 grayscale scale-x-[-1]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-32 h-32 border border-cyan-500/10 rounded-full ${isListening ? 'animate-ping' : ''}`} />
              <Activity className={`absolute ${isListening ? 'text-cyan-400' : 'text-slate-800'}`} />
            </div>
            <div className="absolute top-2 left-2 text-[8px] bg-black/50 p-1 px-2 rounded tracking-tighter">LIVE_SCAN</div>
          </div>

          {/* Conversation Area */}
          <div className="flex-1 bg-slate-900/20 rounded-2xl p-4 overflow-y-auto border border-cyan-900/20 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-xl text-xs ${m.role === 'user' ? 'bg-cyan-900/40 text-cyan-50' : 'bg-slate-800 text-white'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Interaction Status */}
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-cyan-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-cyan-500 shadow-[0_0_8px_cyan]' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold uppercase">{status}</span>
            </div>
            <Volume2 size={16} className={status.includes("speaking") ? "animate-bounce" : "opacity-20"} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
