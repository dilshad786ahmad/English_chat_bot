import React, { useEffect, useState } from 'react';
import { Sparkles, MessageCircle, BookCheck, Briefcase, Sparkle } from 'lucide-react';

const GREETINGS = ['Hello, Learner', 'Ready to practice?', "Let's learn English!"];

export default function HeroGreeting({ onSelectPrompt }) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGreeting(GREETINGS[0]);
      return undefined;
    }

    let greetingIndex = 0;
    let characterIndex = 0;
    let isDeleting = false;
    let timeoutId;

    const typeGreeting = () => {
      const currentGreeting = GREETINGS[greetingIndex];
      characterIndex += isDeleting ? -1 : 1;
      setGreeting(currentGreeting.slice(0, characterIndex));

      let delay = isDeleting ? 55 : 100;
      if (!isDeleting && characterIndex === currentGreeting.length) {
        isDeleting = true;
        delay = 1400;
      } else if (isDeleting && characterIndex === 0) {
        isDeleting = false;
        greetingIndex = (greetingIndex + 1) % GREETINGS.length;
        delay = 350;
      }

      timeoutId = window.setTimeout(typeGreeting, delay);
    };

    timeoutId = window.setTimeout(typeGreeting, 350);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const cards = [
    {
      icon: <Briefcase className="card-icon blue" size={22} />,
      title: 'Practice for Job Interview',
      desc: 'Ask me common interview questions and give me feedback on my answers.',
      prompt: "I want to prepare for a job interview in English. Please act as the interviewer and ask me the first question.",
    },
    {
      icon: <BookCheck className="card-icon purple" size={22} />,
      title: 'Fix My Grammar',
      desc: 'Type any English sentence you are unsure about and learn the correct rule.',
      prompt: "Please check this sentence for grammar mistakes and explain: 'Yesterday I have visited to Mumbai for some work.'",
    },
    {
      icon: <MessageCircle className="card-icon emerald" size={22} />,
      title: 'Daily Casual Conversation',
      desc: 'Chat freely like with a native English friend on topics you love.',
      prompt: "Hi! Let's talk about travel and favorite foods. How should we start?",
    },
    {
      icon: <Sparkle className="card-icon amber" size={22} />,
      title: 'Vocabulary & Idioms',
      desc: 'Discover smart English idioms and vocabulary to sound more natural.',
      prompt: "Teach me 3 smart idioms that native English speakers use every day with examples.",
    },
  ];

  return (
    <div className="hero-container">
      {/* Hero Header */}
      <div className="hero-header">
        <div className="hero-badge">
          <Sparkles size={16} className="hero-badge-icon" />
          <span>DARK AI • English Tutor</span>
        </div>

        <h1 className="hero-title">
          <span className="gemini-gradient-text typing-greeting" aria-label="Hello, Learner">
            {greeting}
          </span>
        </h1>
        <p className="hero-subtitle">
          How can DARK AI help you speak English more fluently today?
        </p>
      </div>

      {/* Suggestion Cards Grid */}
      <div className="cards-grid">
        {cards.map((card, idx) => (
          <button
            key={idx}
            className="suggestion-card"
            onClick={() => onSelectPrompt(card.prompt)}
          >
            <div className="card-top">
              <div className="card-icon-wrapper">{card.icon}</div>
              <h3 className="card-title">{card.title}</h3>
            </div>
            <p className="card-desc">{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
