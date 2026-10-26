import React, { useState } from 'react';
import { BookOpen, X } from 'lucide-react';

const goals = [
  ['daily-conversation', 'Daily conversation'],
  ['fluency', 'Fluency'],
  ['grammar', 'Grammar'],
  ['vocabulary', 'Vocabulary'],
  ['job-interviews', 'Job interviews'],
  ['workplace-english', 'Workplace English'],
  ['exam-preparation', 'Exam preparation'],
];

export default function LearningProfileModal(props) {
  if (!props.isOpen) return null;
  return <LearningProfileDialog {...props} />;
}

function LearningProfileDialog({
  profile,
  isSaving,
  error,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => ({
    goals: profile?.goals || [],
    preferredExplanationLanguage: profile?.preferredExplanationLanguage || 'English',
    startingLevel: profile?.startingLevel || 'Beginner',
  }));

  const toggleGoal = (goal) => {
    setDraft((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((item) => item !== goal)
        : current.goals.length < 3
          ? [...current.goals, goal]
          : current.goals,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (draft.goals.length < 1 || isSaving) return;
    onSave(draft);
  };

  return (
    <div className="learning-profile-backdrop" role="presentation">
      <section
        className="learning-profile-modal animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-profile-title"
      >
        <button
          className="learning-profile-close"
          type="button"
          onClick={onClose}
          aria-label="Close learning preferences"
        >
          <X size={18} />
        </button>
        <div className="learning-profile-heading-icon"><BookOpen size={20} /></div>
        <h2 id="learning-profile-title">Personalize your learning</h2>
        <p className="learning-profile-description">
          Choose a starting point. Your selections are saved to your account and used to tailor explanations.
        </p>

        <form onSubmit={handleSubmit}>
          <fieldset className="learning-goals-fieldset">
            <legend>What would you like to practice? <span>(choose up to 3)</span></legend>
            <div className="learning-goals-grid">
              {goals.map(([value, label]) => (
                <label className="learning-goal-option" key={value}>
                  <input
                    type="checkbox"
                    checked={draft.goals.includes(value)}
                    onChange={() => toggleGoal(value)}
                    disabled={!draft.goals.includes(value) && draft.goals.length >= 3}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="learning-profile-label" htmlFor="explanation-language">
            Explanation language
          </label>
          <select
            id="explanation-language"
            className="learning-profile-select"
            value={draft.preferredExplanationLanguage}
            onChange={(event) => setDraft((current) => ({
              ...current,
              preferredExplanationLanguage: event.target.value,
            }))}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Hinglish">Hinglish</option>
          </select>

          <label className="learning-profile-label" htmlFor="starting-level">
            Starting level
          </label>
          <select
            id="starting-level"
            className="learning-profile-select"
            value={draft.startingLevel}
            onChange={(event) => setDraft((current) => ({
              ...current,
              startingLevel: event.target.value,
            }))}
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <p className="learning-profile-note">
            This is your chosen starting level, not a test result.
          </p>

          {error && <p className="learning-profile-error" role="alert">{error}</p>}
          <button
            className="learning-profile-submit"
            type="submit"
            disabled={draft.goals.length === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : profile ? 'Save preferences' : 'Start learning'}
          </button>
        </form>
      </section>
    </div>
  );
}
