import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Camera, Mic, MicOff, Sparkles, Loader2, Paperclip, X } from 'lucide-react';

export default function ChatInput({ onSendMessage, isLoading, initialPrompt, onOpenStudio }) {
  const [text, setText] = useState(initialPrompt || '');
  const [isListening, setIsListening] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const stopListeningForSpeechOutput = () => {
      recognitionRef.current?.stop();
      setIsListening(false);
    };

    window.addEventListener('dark-ai-voice-output-started', stopListeningForSpeechOutput);
    return () => {
      window.removeEventListener('dark-ai-voice-output-started', stopListeningForSpeechOutput);
      recognitionRef.current?.stop();
    };
  }, []);

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  };

  useEffect(() => {
    if (!initialPrompt) return;
    textareaRef.current?.focus();
    adjustHeight();
  }, [initialPrompt]);

  const handleInput = (e) => {
    setText(e.target.value);
    adjustHeight();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((!text.trim() && !imageAttachment) || isLoading) return;

    onSendMessage(text.trim(), imageAttachment);
    setText('');
    setImageAttachment(null);
    setAttachmentError('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAttachmentError('');
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAttachmentError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('Image must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageAttachment({ dataUrl: reader.result, name: file.name });
      } else {
        setAttachmentError('Could not read this image file.');
      }
    };
    reader.onerror = () => setAttachmentError('Could not read this image file.');
    reader.readAsDataURL(file);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Web Speech API Voice Recognition (Speech-to-Text)
  const toggleListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      window.dispatchEvent(new Event('dark-ai-voice-input-started'));
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0].transcript)
          .join(' ')
          .trim();
        if (!transcript) return;

        const message = [text.trim(), transcript].filter(Boolean).join(' ');
        setText('');
        onSendMessage(message, imageAttachment);
        setImageAttachment(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition exception:', err);
      setIsListening(false);
    }
  };

  return (
    <div className="input-outer-wrapper">
      {imageAttachment && (
        <div className="image-attachment-preview">
          <img src={imageAttachment.dataUrl} alt={`Attached: ${imageAttachment.name}`} />
          <span title={imageAttachment.name}>
            {imageAttachment.name}
            <small>Sent to AI for analysis; not saved in chat history.</small>
          </span>
          <button
            type="button"
            className="remove-image-attachment"
            onClick={() => setImageAttachment(null)}
            aria-label="Remove attached image"
            disabled={isLoading}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {attachmentError && (
        <p className="image-attachment-error" role="alert">{attachmentError}</p>
      )}
      <form onSubmit={handleSubmit} className="gemini-input-pill">
        {/* Sparkle subtle icon */}
        <div className="input-sparkle-indicator">
          <Sparkles size={18} className="input-sparkle" />
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening to you speak English...'
              : 'Ask, practice English, or ask about a photo...'
          }
          rows={1}
          disabled={isLoading}
          className="gemini-textarea"
          aria-label="Message prompt"
        />

        {/* Controls (Mic & Send) */}
        <div className="input-actions-cluster">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden-file-input"
            onChange={handleImageSelection}
            aria-label="Choose an image to analyze"
          />
          <button
            type="button"
            className="mic-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach an image to analyze"
            aria-label="Attach an image to analyze"
            disabled={isLoading}
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            className="mic-btn"
            onClick={onOpenStudio}
            title="Open Teleprompter Studio"
            aria-label="Open Teleprompter Studio"
          >
            <Camera size={18} />
          </button>

          {/* Voice input button */}
          <button
            type="button"
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Speak in English'}
            aria-label="Voice input"
          >
            {isListening ? (
              <MicOff size={18} className="mic-listening-icon" />
            ) : (
              <Mic size={18} />
            )}
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={(!text.trim() && !imageAttachment) || isLoading}
            className={`${text.trim() || imageAttachment ? 'send-btn active' : 'send-btn'} ${isLoading ? 'loading' : ''}`}
            title="Send message"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 size={18} className="spinner-icon" />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>
      </form>

      {/* Subtle Gemini Disclaimer */}
      <div className="input-disclaimer">
        <span>DARK AI can make mistakes. Practice regularly to improve fluency.</span>
      </div>
    </div>
  );
}
