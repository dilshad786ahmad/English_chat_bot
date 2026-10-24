import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Mic, MicOff, Sparkles, Loader2 } from 'lucide-react';

export default function ChatInput({ onSendMessage, isLoading, initialPrompt }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // If initialPrompt changes (e.g. from clicking a card), update text & focus
  useEffect(() => {
    if (initialPrompt) {
      setText(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight();
      }
    }
  }, [initialPrompt]);

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);
    adjustHeight();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isLoading) return;

    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
        onSendMessage(message);
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
              : 'Ask a question, practice a sentence, or start a conversation...'
          }
          rows={1}
          disabled={isLoading}
          className="gemini-textarea"
          aria-label="Message prompt"
        />

        {/* Controls (Mic & Send) */}
        <div className="input-actions-cluster">
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
            disabled={!text.trim() || isLoading}
            className={`send-btn ${text.trim() && !isLoading ? 'active' : ''}`}
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
