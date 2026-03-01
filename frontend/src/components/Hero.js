import React from 'react';
import './hero.css';

export default function Hero({ onAnalyzeClick }) {
  return (
    <div className="hero-spot">
      <div className="hero-left">
        <h1>Precision Medical Analytics.</h1>
        <p>Harnessing AI-driven biomarker analysis and longitudinal data architecture to provide actionable clinical insights for practitioners and patients.</p>
      </div>
      <div className="hero-actions">
        <button className="hero-cta" onClick={onAnalyzeClick}>Analyze Report</button>
        <button className="hero-secondary" onClick={() => window.open('/demo-report.pdf', '_blank')}>View Demo</button>
      </div>
    </div>
  )
}
