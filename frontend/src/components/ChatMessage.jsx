import React, { useEffect, useState } from 'react';
import { Sparkles, Copy, Check, Volume2, VolumeX, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const parseAiContent = (content) => {
  const badges = [];
  const markdownLines = [];
  let suggestion = '';

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    const nextSuggestion = trimmed.match(/^(?:💡\s*)?(?:Try this next|Next suggestion):\s*(.*)$/i);
    if (nextSuggestion) {
      suggestion = nextSuggestion[1].trim();
      return;
    }

    if (/^\*{0,2}(?:Gentle\s+)?Correction\*{0,2}:?$/i.test(trimmed)) {
      return;
    }

    const correction = trimmed.match(/^(?:✓|\*|-)?\s*\*{0,2}Corrected(?:\s+version)?\*{0,2}:\s*(.*)$/i);
    if (correction) {
      const text = correction[1]
        .replace(/^["“*`]|["”*`]$/g, '')
        .replace(/^\*+|\*+$/g, '')
        .trim();
      badges.push({ type: 'correction', text });
      return;
    }

    const tip = trimmed.match(/^(?:💡|\*|-)?\s*\*{0,2}(?:Grammar\s+)?Tip\*{0,2}:\s*(.*)$/i);
    if (tip) {
      badges.push({
        type: 'tip',
        text: tip[1].replace(/^\*+|\*+$/g, '').trim(),
      });
      return;
    }

    markdownLines.push(line);
  });

  const markdownText = markdownLines.join('\n').trim();
  const readableMarkdown = markdownText
    .replace(/```[\w-]*\n?|```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[|*_~`>#]/g, ' ')
    .replace(/✓|💡/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    badges,
    markdownText,
    suggestion,
    speechText: [...badges.map((badge) => badge.text), readableMarkdown, suggestion]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
};

const isFemaleVoice = (voice) =>
  /\b(female|woman|samantha|karen|moira|tessa|victoria|zira|jenny|aria|ava|sara|susan|hazel|libby|sonia|natasha|joanna|kendra|kimberly|salli|ivy|olivia|google (?:uk|us) english)\b/i.test(voice.name);

const getPreferredVoice = (voices) =>
  voices.find((voice) => isFemaleVoice(voice) && /^en(-|_|$)/i.test(voice.lang)) ||
  voices.find((voice) => isFemaleVoice(voice)) ||
  voices.find((voice) => /^en(-|_|$)/i.test(voice.lang)) ||
  voices[0];

export default function ChatMessage({ message, isLatest, user }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(
    () => localStorage.getItem('dark_ai_speech_voice') || ''
  );

  useEffect(() => {
    if (isUser || !('speechSynthesis' in window)) return undefined;

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (!availableVoices.length) return;

      const englishVoices = availableVoices.filter((voice) => /^en(-|_|$)/i.test(voice.lang));
      const voiceOptions = englishVoices.length ? englishVoices : availableVoices;
      setVoices(voiceOptions);
      setSelectedVoiceURI((currentURI) => {
        if (voiceOptions.some((voice) => voice.voiceURI === currentURI)) return currentURI;
        const preferredVoice = getPreferredVoice(voiceOptions);
        localStorage.setItem('dark_ai_speech_voice', preferredVoice.voiceURI);
        return preferredVoice.voiceURI;
      });
    };

    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      window.speechSynthesis.cancel();
    };
  }, [isUser]);

  // Copy to clipboard handler
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Text-To-Speech handler for English learners
  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentWordIndex(-1);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech

    const { speechText } = parseAiContent(message.content);
    if (!speechText) return;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95; // Slightly slower for clear comprehension
    utterance.voice =
      voices.find((voice) => voice.voiceURI === selectedVoiceURI) || getPreferredVoice(voices) || null;

    const finishSpeaking = () => {
      setIsSpeaking(false);
      setCurrentWordIndex(-1);
    };

    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return;

      const spokenBeforeBoundary = speechText.slice(0, event.charIndex).trim();
      const wordIndex = spokenBeforeBoundary
        ? spokenBeforeBoundary.split(/\s+/).length
        : 0;
      setCurrentWordIndex(wordIndex);
    };
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;

    setCurrentWordIndex(0);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const renderHighlightedText = (children, nextWordIndex) => {
    if (typeof children === 'string') {
      return children.split(/(\s+)/).map((part) => {
        if (!part || /^\s+$/.test(part)) return part;

        const wordIndex = nextWordIndex();
        return (
          <span
            key={`spoken-word-${wordIndex}`}
            className={isSpeaking && currentWordIndex === wordIndex ? 'spoken-word-active' : undefined}
          >
            {part}
          </span>
        );
      });
    }

    if (Array.isArray(children)) {
      return children.map((child, index) => (
        <React.Fragment key={`spoken-child-${index}`}>
          {renderHighlightedText(child, nextWordIndex)}
        </React.Fragment>
      ));
    }

    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...children.props,
        children: renderHighlightedText(children.props.children, nextWordIndex),
      });
    }

    return children;
  };

  const renderAiContent = (content) => {
    const { badges, markdownText, suggestion } = parseAiContent(content);
    let renderedWordIndex = 0;
    const nextWordIndex = () => renderedWordIndex++;
    const highlight = (children) => renderHighlightedText(children, nextWordIndex);

    return (
      <div className="ai-formatted-wrapper">
        {/* Render highlight badges first if present */}
        {badges.length > 0 && (
          <div className="badges-group">
            {badges.map((badge, index) => (
              <div
                key={`${badge.type}-${index}`}
                className={`highlight-pill ${badge.type}-pill animate-fade-in`}
              >
                <span className="pill-badge">
                  {badge.type === 'correction' ? 'CORRECTION' : 'TIP'}
                </span>
                <span className="pill-text">
                  {badge.type === 'correction' && '"'}
                  {highlight(badge.text)}
                  {badge.type === 'correction' && '"'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Render remaining content with rich colorful Markdown */}
        {markdownText && (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="table-responsive-wrapper">
                    <table className="gemini-table">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="gemini-thead">{children}</thead>,
                th: ({ children }) => <th className="gemini-th">{highlight(children)}</th>,
                td: ({ children }) => <td className="gemini-td">{highlight(children)}</td>,
                ul: ({ children }) => <ul className="gemini-ul">{children}</ul>,
                ol: ({ children }) => <ol className="gemini-ol">{children}</ol>,
                li: ({ children }) => (
                  <li className="gemini-li">
                    {React.Children.map(children, (child) =>
                      typeof child === 'string' ? highlight(child) : child
                    )}
                  </li>
                ),
                h1: ({ children }) => <h1>{highlight(children)}</h1>,
                h2: ({ children }) => <h2>{highlight(children)}</h2>,
                h3: ({ children }) => <h3>{highlight(children)}</h3>,
                h4: ({ children }) => <h4>{highlight(children)}</h4>,
                h5: ({ children }) => <h5>{highlight(children)}</h5>,
                h6: ({ children }) => <h6>{highlight(children)}</h6>,
                strong: ({ children }) => <strong className="gemini-strong">{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote className="gemini-blockquote">{children}</blockquote>
                ),
                p: ({ children }) => <p className="gemini-p">{highlight(children)}</p>,
                code: ({ children }) => <code className="gemini-code">{children}</code>,
              }}
            >
              {markdownText}
            </ReactMarkdown>
          </div>
        )}
        {suggestion && (
          <div className="next-suggestion-box">
            <span className="next-suggestion-label">💡 Try this next: </span>
            {highlight(suggestion)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'} animate-fade-in`}>
      <div className="message-container">
        {/* Avatar */}
        <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
          {isUser ? (
            user?.avatar ? (
              <img src={user.avatar} alt="" className="message-user-avatar-img" />
            ) : user?.name ? (
              user.name.charAt(0).toUpperCase()
            ) : (
              <User size={16} />
            )
          ) : (
            <Sparkles size={16} className="ai-avatar-sparkle" />
          )}
        </div>

        {/* Bubble Content */}
        <div className="message-bubble-wrapper">
          <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
            {isUser ? (
              <p className="user-message-text">{message.content}</p>
            ) : (
              <div className="ai-message-text">
                {renderAiContent(message.content)}
              </div>
            )}
          </div>

          {/* Action Toolbar (for AI messages) */}
          {!isUser && (
            <div className="message-actions">
              <select
                className="voice-select"
                value={selectedVoiceURI}
                onChange={(event) => {
                  setSelectedVoiceURI(event.target.value);
                  localStorage.setItem('dark_ai_speech_voice', event.target.value);
                }}
                disabled={!voices.length}
                aria-label="Choose speech voice"
              >
                {voices.length ? (
                  voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))
                ) : (
                  <option value="">Loading voices...</option>
                )}
              </select>
              <button
                className={`action-btn ${isSpeaking ? 'active-speaking' : ''}`}
                onClick={handleSpeak}
                title={isSpeaking ? 'Stop listening' : 'Listen to pronunciation'}
                aria-label="Listen to pronunciation"
              >
                {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="action-btn-label">
                  {isSpeaking ? 'Stop' : 'Listen'}
                </span>
              </button>

              <button
                className="action-btn"
                onClick={handleCopy}
                title="Copy text"
                aria-label="Copy text"
              >
                {copied ? (
                  <>
                    <Check size={15} className="copied-icon" />
                    <span className="action-btn-label">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    <span className="action-btn-label">Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
