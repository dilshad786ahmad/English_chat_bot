import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Circle,
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteTeleprompterScript,
  fetchTeleprompterScripts,
  saveTeleprompterScript,
  updateTeleprompterScript,
} from '../services/api';
import './TeleprompterStudio.css';

const SCRIPT_STORAGE_KEY = 'dark_ai_teleprompter_script';

const getScriptApiError = (error, fallback) => (
  error.response?.status === 404
    ? 'Saved scripts are not available on the server yet. Deploy the latest backend and try again.'
    : error.response?.data?.message || fallback
);

export default function TeleprompterStudio({ onClose }) {
  const [facingMode, setFacingMode] = useState('user');
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState('');
  const [recordedVideoType, setRecordedVideoType] = useState('');
  const [script, setScript] = useState(() => localStorage.getItem(SCRIPT_STORAGE_KEY) || '');
  const [savedScripts, setSavedScripts] = useState([]);
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [selectedScriptId, setSelectedScriptId] = useState(null);
  const [isLoadingScripts, setIsLoadingScripts] = useState(true);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [libraryMessage, setLibraryMessage] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [stage, setStage] = useState('script');
  const [countdown, setCountdown] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const videoRef = useRef(null);
  const scriptRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    localStorage.setItem(SCRIPT_STORAGE_KEY, script);
  }, [script]);

  useEffect(() => {
    let active = true;

    fetchTeleprompterScripts()
      .then((scripts) => {
        if (active) setSavedScripts(scripts);
      })
      .catch((error) => {
        if (active) setLibraryError(getScriptApiError(error, 'Could not load your saved scripts. Please try again.'));
      })
      .finally(() => {
        if (active) setIsLoadingScripts(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => () => {
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
  }, [recordedVideoUrl]);

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
        const finalTextPosition = scriptElement.scrollHeight - scriptElement.clientHeight;

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
    setRecordingError('');
    setStream(null);
    setIsComplete(false);
    setIsPaused(true);
    setCountdown(null);
    setControlsVisible(true);
    setStage('studio');
  };

  const restartScript = () => {
    if (scriptRef.current) scriptRef.current.scrollTop = 0;
    setIsComplete(false);
    setIsPaused(true);
    setCountdown(5);
  };

  const toggleControls = () => setControlsVisible((visible) => !visible);

  const handleStudioClick = (event) => {
    if (event.target.closest('.teleprompter-controls, .teleprompter-topbar, button, input, label')) return;
    toggleControls();
  };

  const handleStudioKeyDown = (event) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggleControls();
  };

  const startRecording = async () => {
    if (isStartingRecording || isRecording) return;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setRecordingError('Video recording is not supported in this browser.');
      return;
    }

    setIsStartingRecording(true);
    setRecordingError('');
    let audioStream;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recordingStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);

      recordedChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        audioStream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        if (!blob.size) {
          setRecordingError('The recording was empty. Please try recording again.');
          setIsRecording(false);
          return;
        }

        setRecordedVideoType(blob.type);
        setRecordedVideoUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setStage('playback');
      };
      recorder.onerror = () => {
        audioStream.getTracks().forEach((track) => track.stop());
        setRecordingError('Recording failed. Please check your camera and microphone permissions, then try again.');
        setIsRecording(false);
      };
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      audioStream?.getTracks().forEach((track) => track.stop());
      setRecordingError(
        error.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access to record video with audio.'
          : 'Could not start recording. Check microphone access and try again.'
      );
    } finally {
      setIsStartingRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const getScriptTitle = (content) => {
    const firstLine = content.split(/\r?\n/).find((line) => line.trim())?.trim() || '';
    return firstLine.slice(0, 100) || 'Untitled script';
  };

  const persistScript = async () => {
    const scriptData = { title: getScriptTitle(script), content: script.trim() };
    setIsSavingScript(true);
    setLibraryError('');
    setLibraryMessage('');

    try {
      const scripts = editingScriptId
        ? await updateTeleprompterScript(editingScriptId, scriptData)
        : await saveTeleprompterScript(scriptData);
      setSavedScripts(scripts);
      setSelectedScriptId(editingScriptId);
      setEditingScriptId(null);
      setLibraryMessage(editingScriptId ? 'Script updated.' : 'Script saved.');
    } catch (error) {
      setLibraryError(getScriptApiError(error, 'Could not save this script. Please try again.'));
    } finally {
      setIsSavingScript(false);
    }
  };

  const removeScript = async (scriptId) => {
    setLibraryError('');
    setLibraryMessage('');
    try {
      const scripts = await deleteTeleprompterScript(scriptId);
      setSavedScripts(scripts);
      if (selectedScriptId === scriptId) setSelectedScriptId(null);
      if (editingScriptId === scriptId) setEditingScriptId(null);
      setLibraryMessage('Script deleted.');
    } catch (error) {
      setLibraryError(getScriptApiError(error, 'Could not delete this script. Please try again.'));
    }
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
            onChange={(event) => {
              setScript(event.target.value);
              setLibraryMessage('');
            }}
            placeholder="Type or paste your script here..."
            spellCheck="true"
            autoFocus
            required
          />
          <div className="teleprompter-script-actions">
            <button
              type="submit"
              className="teleprompter-action-button teleprompter-primary-action"
              disabled={!script.trim()}
            >
              <Camera size={17} />
              <span>Open camera</span>
            </button>
            <button
              type="button"
              className="teleprompter-action-button"
              onClick={persistScript}
              disabled={!script.trim() || isSavingScript}
            >
              <Save size={17} />
              <span>{isSavingScript ? 'Saving...' : editingScriptId ? 'Update script' : 'Save script'}</span>
            </button>
          </div>
          {libraryError && <p className="teleprompter-library-error" role="alert">{libraryError}</p>}
          {libraryMessage && <p className="teleprompter-library-message" role="status">{libraryMessage}</p>}
          <p>Your script will appear over the camera and scroll upward after a 5-second countdown.</p>
          <div className="teleprompter-saved-scripts" aria-label="Saved scripts">
            <h2>Saved scripts</h2>
            {isLoadingScripts ? (
              <p>Loading your scripts...</p>
            ) : savedScripts.length === 0 ? (
              <p>No saved scripts yet.</p>
            ) : (
              <ul>
                {savedScripts.map((savedScript) => (
                  <li key={savedScript._id} className={selectedScriptId === savedScript._id ? 'is-selected' : ''}>
                    <button
                      type="button"
                      className="teleprompter-saved-script-title"
                      onClick={() => {
                        setScript(savedScript.content);
                        setSelectedScriptId(savedScript._id);
                        setEditingScriptId(null);
                        setLibraryError('');
                        setLibraryMessage('');
                      }}
                      title="Load this script for reading"
                    >
                      <strong>{savedScript.title}</strong>
                      <span>{savedScript.content.slice(0, 110)}</span>
                    </button>
                    <div className="teleprompter-saved-script-actions">
                      <button
                        type="button"
                        className="teleprompter-action-button"
                        onClick={() => {
                          setScript(savedScript.content);
                          setSelectedScriptId(savedScript._id);
                          setEditingScriptId(savedScript._id);
                          setLibraryError('');
                          setLibraryMessage('Edit the script above, then choose Update script.');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="teleprompter-icon-button"
                        onClick={() => removeScript(savedScript._id)}
                        aria-label={`Delete ${savedScript.title}`}
                        title="Delete script"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </section>
    );
  }

  if (stage === 'playback' && recordedVideoUrl) {
    return (
      <section className="teleprompter-studio teleprompter-playback" aria-label="Recorded video">
        <video
          className="teleprompter-recorded-video"
          src={recordedVideoUrl}
          controls
          autoPlay
          playsInline
        />
        <a
          className="teleprompter-download-button"
          href={recordedVideoUrl}
          download={`teleprompter-recording.${recordedVideoType.includes('mp4') ? 'mp4' : 'webm'}`}
          aria-label="Download recorded video"
          title="Download video"
        >
          <Download size={20} />
          <span>Download video</span>
        </a>
      </section>
    );
  }

  return (
    <section
      className="teleprompter-studio"
      aria-label="Teleprompter camera preview"
      tabIndex={0}
      onClick={handleStudioClick}
      onKeyDown={handleStudioKeyDown}
    >
      <video
        ref={videoRef}
        className={`teleprompter-camera-preview ${facingMode === 'user' ? 'is-mirrored' : ''}`}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <div className="teleprompter-camera-shade" aria-hidden="true" />

      <header
        className={`teleprompter-topbar ${controlsVisible ? '' : 'is-hidden'}`}
        aria-hidden={!controlsVisible}
        inert={!controlsVisible}
      >
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

      {recordingError && <p className="teleprompter-camera-error" role="alert">{recordingError}</p>}

      <div
        className={`teleprompter-controls ${controlsVisible ? '' : 'is-hidden'}`}
        aria-label="Teleprompter controls"
        aria-hidden={!controlsVisible}
        inert={!controlsVisible}
      >
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
              restartScript();
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

        {isRecording ? (
          <button
            type="button"
            className="teleprompter-action-button teleprompter-recording-action"
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            <Square size={17} />
            <span>Stop recording</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="teleprompter-action-button"
              onClick={restartScript}
              disabled={Boolean(cameraError || countdown !== null)}
              title="Restart script from the beginning"
            >
              <RotateCcw size={17} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              className="teleprompter-action-button"
              onClick={startRecording}
              disabled={Boolean(cameraError || countdown !== null || !stream || isStartingRecording)}
              aria-label="Start video recording"
            >
              <Circle size={17} />
              <span>{isStartingRecording ? 'Starting...' : 'Record'}</span>
            </button>

            <button
              type="button"
              className="teleprompter-action-button"
              onClick={() => setFacingMode((mode) => (mode === 'user' ? 'environment' : 'user'))}
              aria-label={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
              title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
            >
              <RefreshCw size={17} />
              <span>Switch camera</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
