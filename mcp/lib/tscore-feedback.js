/**
 * T-Score Feedback Aggregation
 * Reads accumulated feedback from decisions table to calibrate T-Scores.
 *
 * When users approve VS recommendations at checkpoints, they can optionally
 * rate the recommendation's novelty (1-5 scale). This module aggregates those
 * ratings and produces calibration adjustments for the T-Score system.
 */

/**
 * Get aggregated T-Score feedback for a checkpoint or methodology.
 *
 * Queries the decisions table for rows whose context JSON contains
 * `t_score_feedback`, then computes summary statistics.
 *
 * @param {import('better-sqlite3').Database} db - SQLite database instance
 * @param {object} options
 * @param {string} [options.checkpointId] - Filter by specific checkpoint
 * @param {string} [options.methodology] - Search decision `selected` text for methodology name
 * @returns {{ count: number, avgFeedback: number|null, distribution: number[] }}
 */
export function getAggregatedFeedback(db, options = {}) {
  const { checkpointId, methodology } = options;

  let sql = 'SELECT * FROM decisions WHERE context IS NOT NULL';
  const params = [];

  if (checkpointId) {
    sql += ' AND checkpoint_id = ?';
    params.push(checkpointId);
  }

  const rows = db.prepare(sql).all(...params);

  // Filter by methodology in selected text (if specified)
  let filtered = rows;
  if (methodology) {
    const lowerMethodology = methodology.toLowerCase();
    filtered = rows.filter(
      r => r.selected && r.selected.toLowerCase().includes(lowerMethodology)
    );
  }

  // Extract t_score_feedback values from context JSON
  const feedbackValues = [];
  for (const row of filtered) {
    try {
      const parsed = JSON.parse(row.context);
      if (parsed.t_score_feedback != null) {
        feedbackValues.push(parsed.t_score_feedback);
      }
    } catch {
      // skip unparseable context
    }
  }

  if (feedbackValues.length === 0) {
    return { count: 0, avgFeedback: null, distribution: [0, 0, 0, 0, 0] };
  }

  const sum = feedbackValues.reduce((a, b) => a + b, 0);
  const avgFeedback = Math.round((sum / feedbackValues.length) * 100) / 100;

  // Distribution: count of each rating 1 through 5
  const distribution = [0, 0, 0, 0, 0];
  for (const v of feedbackValues) {
    if (v >= 1 && v <= 5) {
      distribution[v - 1]++;
    }
  }

  return { count: feedbackValues.length, avgFeedback, distribution };
}

/**
 * Calculate calibration factor from user feedback.
 *
 * Maps average user feedback to a T-Score adjustment.  A low average means
 * users perceive the recommendations as more typical than the T-Score
 * suggests, so we nudge the score down (positive adjustment to typicality).
 * A high average means the opposite.
 *
 * @param {number} avgFeedback - Average feedback (1-5)
 * @returns {{ adjustment: number, calibratedRange: string }}
 */
export function calculateCalibration(avgFeedback) {
  if (avgFeedback == null || typeof avgFeedback !== 'number') {
    return { adjustment: 0, calibratedRange: 'insufficient data' };
  }

  if (avgFeedback <= 1.5) {
    return {
      adjustment: 0.2,
      calibratedRange: 'very typical — T-Score should be lower',
    };
  }

  if (avgFeedback <= 2.5) {
    return {
      adjustment: 0.1,
      calibratedRange: 'somewhat typical — T-Score slightly high',
    };
  }

  if (avgFeedback <= 3.5) {
    return {
      adjustment: 0,
      calibratedRange: 'balanced — T-Score matches user perception',
    };
  }

  if (avgFeedback <= 4.5) {
    return {
      adjustment: -0.1,
      calibratedRange: 'somewhat novel — T-Score slightly low',
    };
  }

  return {
    adjustment: -0.2,
    calibratedRange: 'very novel — T-Score should be higher',
  };
}
