import { Mic } from "lucide-react";
import { useState } from "react";

export function MovieReviewField({ form, speech, onChange }) {
  const [language, setLanguage] = useState("id-ID");
  const buttonLabel = speech.listening ? "Stop recording" : "Speak review";

  return (
    <div className="form-field is-full review-field">
      <div className="review-field-header">
        <label className="form-label" htmlFor="review">
          Review or impression
        </label>
        <div className="speech-tools">
          <select
            className="speech-language"
            aria-label="Speech language"
            disabled={!speech.supported || speech.listening}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="id-ID">Bahasa Indonesia</option>
            <option value="en-US">English</option>
          </select>
          <button
            className={`speech-button ${speech.listening ? "is-listening" : ""}`}
            type="button"
            disabled={!speech.supported}
            aria-pressed={speech.listening}
            onClick={() => speech.toggle(language)}
          >
            <Mic aria-hidden="true" />
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>

      <div className="review-input-wrap">
        <textarea
          id="review"
          value={form.review}
          placeholder="What stayed with you?"
          onChange={(event) => onChange("review", event.target.value)}
        />
        {speech.listening && (
          <div className="speech-live-indicator">
            <span className="speech-live-dot" />
            Listening
          </div>
        )}
      </div>

      <p className="speech-status" role="status">
        {speech.status}
      </p>
    </div>
  );
}
