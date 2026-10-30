// Configuration-quality score + letter grade. Single source of truth so the
// WAF posture table (/waf) and the policy detail page (/policies/:id) always
// agree — previously each had its own thresholds and rounding order, so the
// same policy could show a different number/grade on the two screens.
//
// `penalty` is the sum of analyzer finding weights (stored as analysis.score).
// Score = 100 − penalty, rounded once and clamped to 0–100.
export const configScore = (penalty) =>
  Math.max(0, Math.min(100, Math.round(100 - (Number(penalty) || 0))))

export const configGrade = (score) =>
  score >= 90 ? { g: 'A', bg: '#16a34a' }
    : score >= 80 ? { g: 'B', bg: '#16a34a' }
      : score >= 70 ? { g: 'C', bg: '#d97706' }
        : score >= 60 ? { g: 'D', bg: '#f97316' }
          : { g: 'F', bg: '#e11d48' }
