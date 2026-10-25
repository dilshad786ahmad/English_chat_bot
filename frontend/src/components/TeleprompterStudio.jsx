import { useEffect, useRef, useState } from 'react';
import { Camera, Pause, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import './TeleprompterStudio.css';

const SCRIPT_STORAGE_KEY = 'dark_ai_teleprompter_script';

export default function TeleprompterStudio({ onClose }) {
  const [facingMode, setFacingMode] = useState('user');
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [script, setScript] = useState(() => localStorage.getItem(SCRIPT_STORAGE_KEY) || '');
  const [fontSize, setFontSize] = useState(32);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [stage, setStage] = useState('script');
  const [countdown, setCountdown] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const videoRef = useRef(null);
  const scriptRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(SCRIPT_STORAGE_KEY, script);
  }, [script]);

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
          video: { facingMode: { ideal: facingMode } },
        });
      } catch (error) {
        if (!active) return;
        setCameraError(
          error.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
            : error.name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'Could not start the camera. Check that it is connected and not being used by another app.'
        );
        return;
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
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (countdown === null) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        setIsPaused(false);
      } else {
        setCountdown((value) => (value === null ? null : value - 1));
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown]);

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
          return;
        }
      }
      previousTime = time;
      animationFrame = window.requestAnimationFrame(scrollScript);
    };

    animationFrame = window.requestAnimationFrame(scrollScript);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [countdown, isPaused, scrollSpeed, stage]);

  const leadingWhitespace = script.match(/^\s*/)?.[0] || '';
  const scriptParts = script.slice(leadingWhitespace.length).match(/\S+\s*/g) || [];

  const startStudio = (event) => {
    event.preventDefault();
    if (!script.trim()) return;
    scriptRef.current?.scrollTo({ top: 0 });
    setCameraError('');
    setStream(null);
    setIsComplete(false);
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
          <button
            type="submit"
            className="teleprompter-action-button teleprompter-primary-action"
            disabled={!script.trim()}
          >
            <Camera size={17} />
            <span>Open camera</span>
          </button>
          <p>Your script will appear over the camera and scroll upward after a 5-second countdown.</p>
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
            <span key={index}>{part}</span>
          ))}
        </div>
      </div>

      {countdown !== null && !cameraError && (
        <div className="teleprompter-countdown" role="status" aria-live="assertive">
          <span>Get ready</span>
          <strong>{countdown}</strong>
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
          onClick={() => {
            if (isComplete) {
              if (scriptRef.current) scriptRef.current.scrollTop = 0;
              setIsComplete(false);
              setCountdown(5);
              setIsPaused(true);
              return;
            }
            setIsPaused((paused) => !paused);
          }}
          disabled={countdown !== null || Boolean(cameraError)}
          aria-label={isComplete ? 'Replay script' : isPaused ? 'Resume scrolling' : 'Pause scrolling'}
        >
          {isComplete ? <RotateCcw size={17} /> : isPaused ? <Play size={17} /> : <Pause size={17} />}
          <span>{isComplete ? 'Replay' : isPaused ? 'Resume' : 'Pause'}</span>
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
