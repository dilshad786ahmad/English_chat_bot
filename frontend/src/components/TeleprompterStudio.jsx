import { useEffect, useRef, useState } from 'react';
import { Camera, Pause, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import './TeleprompterStudio.css';

const normalizeWord = (word) => word.toLowerCase().replace(/[^a-z0-9']/g, '');

const analyzeScript = (script, recognizedWords, complete) => {
  const words = script.match(/\S+/g) || [];
  const statuses = words.map(() => 'pending');
  let scriptIndex = 0;

  recognizedWords
    .filter((word) => word.isFinal)
    .forEach((spokenWord) => {
      if (scriptIndex >= words.length) return;

      const spoken = normalizeWord(spokenWord.text);
      if (!spoken) return;

      let matchingIndex = -1;
      const searchEnd = Math.min(scriptIndex + 4, words.length - 1);
      for (let index = scriptIndex; index <= searchEnd; index += 1) {
        if (normalizeWord(words[index]) === spoken) {
          matchingIndex = index;
          break;
        }
      }

      if (matchingIndex >= 0) {
        while (scriptIndex < matchingIndex) {
          statuses[scriptIndex] = 'error';
          scriptIndex += 1;
        }
        statuses[matchingIndex] =
          spokenWord.confidence !== null && spokenWord.confidence < 0.55
            ? 'uncertain'
            : 'correct';
        scriptIndex = matchingIndex + 1;
      } else {
        statuses[scriptIndex] =
          spokenWord.confidence !== null && spokenWord.confidence < 0.55
            ? 'uncertain'
            : 'error';
        scriptIndex += 1;
      }
    });

  if (complete) {
    statuses.forEach((status, index) => {
      if (status === 'pending') statuses[index] = 'error';
    });
  }

  const correctCount = statuses.filter((status) => status === 'correct').length;
  const errorCount = statuses.filter((status) => status === 'error').length;
  const uncertainCount = statuses.filter((status) => status === 'uncertain').length;

  return {
    words,
    statuses,
    correctCount,
    errorCount,
    uncertainCount,
    score: words.length ? Math.round((correctCount / words.length) * 100) : 0,
  };
};

export default function TeleprompterStudio({ onClose }) {
  const [facingMode, setFacingMode] = useState('user');
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recognizedWords, setRecognizedWords] = useState([]);
  const [script, setScript] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [stage, setStage] = useState('script');
  const [countdown, setCountdown] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const videoRef = useRef(null);
  const scriptRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognizedWordsRef = useRef([]);
  const recognitionBaseRef = useRef([]);

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setIsListening(false);
    if (!recognition) return;

    recognition.onend = null;
    try {
      recognition.stop();
    } catch (error) {
      console.warn('Could not stop browser speech recognition:', error);
    }
  };

  const startSpeechRecognition = () => {
    if (recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechAvailable(false);
      setSpeechError('Speech recognition is not supported by this browser.');
      return;
    }

    try {
      window.dispatchEvent(new Event('dark-ai-voice-input-started'));
      const recognition = new SpeechRecognition();
      recognitionBaseRef.current = recognizedWordsRef.current.filter((word) => word.isFinal);
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const sessionWords = Array.from(event.results).flatMap((result) => {
          const alternative = result[0];
          return (alternative.transcript.match(/\S+/g) || []).map((text) => ({
            text,
            confidence: typeof alternative.confidence === 'number'
              ? alternative.confidence
              : null,
            isFinal: result.isFinal,
          }));
        });
        const words = [...recognitionBaseRef.current, ...sessionWords];
        recognizedWordsRef.current = words.filter((word) => word.isFinal);
        setRecognizedWords(words);
      };
      recognition.onerror = (event) => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setSpeechAvailable(false);
        setSpeechError(
          event.error === 'not-allowed'
            ? 'Microphone permission was denied. The word comparison is unavailable.'
            : 'Browser speech recognition stopped. The word comparison may be incomplete.'
        );
        setIsListening(false);
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setIsListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setSpeechAvailable(true);
      setSpeechError('');
      setIsListening(true);
    } catch (error) {
      setSpeechAvailable(false);
      setSpeechError('Could not start browser speech recognition.');
      setIsListening(false);
      console.warn('Could not start browser speech recognition:', error);
    }
  };

  useEffect(() => {
    if (stage !== 'studio') return undefined;

    let active = true;
    let cameraStream;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is unavailable. Open this page in a supported browser over HTTPS or localhost.');
        return;
      }

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: { ideal: facingMode } },
        });
        setSpeechAvailable(true);
        setSpeechError('');
      } catch (audioError) {
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: facingMode } },
          });
          setSpeechAvailable(false);
          setSpeechError('Microphone access is unavailable. Camera preview will work, but no voice report can be made.');
        } catch {
          if (!active) return;
          setCameraError(
            audioError.name === 'NotAllowedError'
              ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
              : audioError.name === 'NotFoundError'
                ? 'No camera was found on this device.'
                : 'Could not start the camera. Check that it is connected and not being used by another app.'
          );
          return;
        }
      }

      if (!active) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }

      setStream(cameraStream);
      setCameraError('');
      setCountdown(5);
      setIsPaused(true);
    };

    startCamera();

    return () => {
      active = false;
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode, stage]);

  useEffect(() => {
    const stopListeningForSpeechOutput = () => stopSpeechRecognition();
    window.addEventListener('dark-ai-voice-output-started', stopListeningForSpeechOutput);
    return () => {
      window.removeEventListener('dark-ai-voice-output-started', stopListeningForSpeechOutput);
      stopSpeechRecognition();
    };
  }, []);

  useEffect(() => {
    if (!isListening) return undefined;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isListening]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (countdown === null) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        setIsPaused(false);
        if (speechAvailable) startSpeechRecognition();
      } else {
        setCountdown((value) => (value === null ? null : value - 1));
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown, speechAvailable]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (stage !== 'studio' || isPaused || countdown !== null) return undefined;

    let animationFrame;
    let previousTime;

    const scrollScript = (time) => {
      if (previousTime !== undefined && scriptRef.current) {
        const elapsedSeconds = (time - previousTime) / 1000;
        const scriptElement = scriptRef.current;
        scriptElement.scrollTop += scrollSpeed * elapsedSeconds;

        const bottomPadding = Number.parseFloat(
          window.getComputedStyle(scriptElement).paddingBottom
        ) || 0;
        const finalTextPosition =
          scriptElement.scrollHeight -
          scriptElement.clientHeight -
          bottomPadding -
          scriptElement.clientHeight * 0.15;

        if (scriptElement.scrollTop >= finalTextPosition) {
          setIsComplete(true);
          setIsPaused(true);
          stopSpeechRecognition();
          return;
        }
      }
      previousTime = time;
      animationFrame = window.requestAnimationFrame(scrollScript);
    };

    animationFrame = window.requestAnimationFrame(scrollScript);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [countdown, isPaused, scrollSpeed, stage]);

  const analysis = analyzeScript(script, recognizedWords, isComplete);
  const leadingWhitespace = script.match(/^\s*/)?.[0] || '';
  const scriptParts = script.slice(leadingWhitespace.length).match(/\S+\s*/g) || [];

  const startStudio = (event) => {
    event.preventDefault();
    if (!script.trim()) return;
    scriptRef.current?.scrollTo({ top: 0 });
    setCameraError('');
    setSpeechError('');
    recognizedWordsRef.current = [];
    recognitionBaseRef.current = [];
    setStream(null);
    setRecognizedWords([]);
    setIsComplete(false);
    setRecordingSeconds(0);
    setIsPaused(true);
    setCountdown(null);
    setStage('studio');
  };

  if (stage === 'script') {
    return (
      <section className="teleprompter-studio teleprompter-script-entry" aria-label="Enter teleprompter script">
        <header className="teleprompter-topbar">
          <div className="teleprompter-title">
            <Camera size={18} />
            <span>Teleprompter Studio</span>
          </div>
          <button
            type="button"
            className="teleprompter-icon-button"
            onClick={onClose}
            aria-label="Close Teleprompter Studio"
            title="Close Studio"
          >
            <X size={20} />
          </button>
        </header>

        <form className="teleprompter-script-form" onSubmit={startStudio}>
          <label htmlFor="teleprompter-script-input">Your script</label>
          <textarea
            id="teleprompter-script-input"
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="Type or paste your script here..."
            spellCheck="true"
            autoFocus
            required
          />
          <p>Your script will appear over the camera and scroll upward after a 5-second countdown.</p>
          <p>Speech is checked with browser recognition, which may process audio using browser services. Results are approximate; it cannot reliably score pronunciation.</p>
          <button
            type="submit"
            className="teleprompter-action-button teleprompter-primary-action"
            disabled={!script.trim()}
          >
            <Camera size={17} />
            <span>Open camera</span>
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="teleprompter-studio" aria-label="Teleprompter camera preview">
      <video
        ref={videoRef}
        className={`teleprompter-camera-preview ${facingMode === 'user' ? 'is-mirrored' : ''}`}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="teleprompter-camera-shade" aria-hidden="true" />

      <header className="teleprompter-topbar">
        <div className="teleprompter-title">
          <Camera size={18} />
          <span>Teleprompter Studio</span>
        </div>
        <div className="teleprompter-topbar-actions">
          {isListening && (
            <div className="teleprompter-recording-indicator" role="status" aria-label="Recording">
              <span className="teleprompter-recording-dot" aria-hidden="true" />
              <span>Recording</span>
              <time>
                {`${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`}
              </time>
            </div>
          )}
          <button
            type="button"
            className="teleprompter-icon-button"
            onClick={onClose}
            aria-label="Close Teleprompter Studio"
            title="Close Studio"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="teleprompter-script-area">
        {cameraError && <p className="teleprompter-camera-error" role="alert">{cameraError}</p>}
        <div
          ref={scriptRef}
          className="teleprompter-script"
          role="presentation"
          style={{ fontSize: `${fontSize}px` }}
        >
          {leadingWhitespace}
          {scriptParts.map((part, index) => (
            <span className={`teleprompter-word is-${analysis.statuses[index]}`} key={index}>
              {part}
            </span>
          ))}
        </div>
      </div>

      {countdown !== null && !cameraError && (
        <div className="teleprompter-countdown" role="status" aria-live="assertive">
          <span>Get ready</span>
          <strong>{countdown}</strong>
        </div>
      )}

      {isComplete && (
        <div className="teleprompter-complete-message" role="status" aria-live="polite">
          <span>Script complete</span>
          {speechAvailable ? (
            <div className="teleprompter-speech-report">
              <strong>Approximate match: {analysis.score}%</strong>
              <span>{analysis.correctCount} words recognized as matching the script</span>
              <span className="teleprompter-report-error">{analysis.errorCount} mismatched or unrecognized words</span>
              <span className="teleprompter-report-uncertain">{analysis.uncertainCount} words with low recognition confidence</span>
              {speechError && <small>{speechError}</small>}
            </div>
          ) : (
            <p className="teleprompter-speech-report">
              Voice comparison unavailable: {speechError || 'Browser speech recognition is unavailable.'}
            </p>
          )}
          <p className="teleprompter-report-note">
            Browser transcription is approximate and cannot reliably score pronunciation. Yellow marks low-confidence recognition, not a confirmed pronunciation issue.
          </p>
          <button
            type="button"
            className="teleprompter-action-button teleprompter-primary-action"
            onClick={() => {
              if (scriptRef.current) scriptRef.current.scrollTop = 0;
              recognizedWordsRef.current = [];
              recognitionBaseRef.current = [];
              setRecognizedWords([]);
              setRecordingSeconds(0);
              setSpeechError('');
              setSpeechAvailable(Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live')));
              setIsComplete(false);
              setCountdown(5);
              setIsPaused(true);
            }}
          >
            <RotateCcw size={17} />
            <span>Replay</span>
          </button>
        </div>
      )}

      {cameraError && (
        <button
          type="button"
          className="teleprompter-action-button teleprompter-return-button"
          onClick={() => {
            setStream(null);
            setStage('script');
          }}
        >
          Back to script
        </button>
      )}

      {speechError && !isComplete && (
        <div className="teleprompter-speech-warning" role="status">
          {speechError}
        </div>
      )}

      <div className="teleprompter-controls" aria-label="Teleprompter controls">
        <label className="teleprompter-range-control">
          <span>Text size <strong>{fontSize}px</strong></span>
          <input
            type="range"
            min="20"
            max="64"
            step="1"
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
            aria-label="Script font size"
          />
        </label>

        <label className="teleprompter-range-control">
          <span>Scroll speed <strong>{scrollSpeed}px/s</strong></span>
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={scrollSpeed}
            onChange={(event) => setScrollSpeed(Number(event.target.value))}
            aria-label="Script scrolling speed"
          />
        </label>

        <button
          type="button"
          className="teleprompter-action-button teleprompter-primary-action"
          onClick={() => setIsPaused((paused) => !paused)}
          disabled={countdown !== null || Boolean(cameraError) || isComplete}
          aria-label={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
        >
          {isPaused ? <Play size={17} /> : <Pause size={17} />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        <button
          type="button"
          className="teleprompter-action-button"
          onClick={() => setFacingMode((mode) => (mode === 'user' ? 'environment' : 'user'))}
          aria-label={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
          title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
        >
          <RefreshCw size={17} />
          <span>{facingMode === 'user' ? 'Front camera' : 'Back camera'}</span>
        </button>
      </div>
    </section>
  );
}
