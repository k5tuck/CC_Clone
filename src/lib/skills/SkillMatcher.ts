import { Skill, SkillMatch } from './types';

export class SkillMatcher {
  /**
   * Find skills that match the user's request
   * Uses keyword matching, embeddings similarity (future), and heuristics
   */
  findMatches(
    userMessage: string,
    availableSkills: Skill[],
    threshold: number = 0.3
  ): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const lowerMessage = userMessage.toLowerCase();

    for (const skill of availableSkills) {
      const confidence = this.calculateConfidence(lowerMessage, skill);

      if (confidence >= threshold) {
        matches.push({
          skill,
          confidence,
          reason: this.getMatchReason(lowerMessage, skill),
        });
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate how well a skill matches the user's message
   */
  private calculateConfidence(message: string, skill: Skill): number {
    let score = 0;
    let matchCount = 0;

    // Check activation keywords
    if (skill.metadata.activation_keywords) {
      for (const keyword of skill.metadata.activation_keywords) {
        if (message.includes(keyword.toLowerCase())) {
          score += 0.3;
          matchCount++;
        }
      }
    }

    // Check tags
    if (skill.metadata.tags) {
      for (const tag of skill.metadata.tags) {
        if (message.includes(tag.toLowerCase())) {
          score += 0.2;
          matchCount++;
        }
      }
    }

    // Check skill name (partial match)
    const skillNameWords = skill.metadata.name.toLowerCase().split('-');
    for (const word of skillNameWords) {
      if (message.includes(word)) {
        score += 0.15;
        matchCount++;
      }
    }

    // Check description for key phrases
    const descWords = skill.metadata.description.toLowerCase().split(' ');
    const importantWords = descWords.filter(w => w.length > 5);
    for (const word of importantWords) {
      if (message.includes(word)) {
        score += 0.1;
        matchCount++;
      }
    }

    // Normalize score (cap at 1.0)
    return Math.min(score, 1.0);
  }

  /**
   * Generate a human-readable reason for the match
   */
  private getMatchReason(message: string, skill: Skill): string {
    const reasons: string[] = [];

    // Check activation keywords
    if (skill.metadata.activation_keywords) {
      const matchedKeywords = skill.metadata.activation_keywords.filter(k =>
        message.includes(k.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        reasons.push(`Matched keywords: ${matchedKeywords.join(', ')}`);
      }
    }

    // Check tags
    if (skill.metadata.tags) {
      const matchedTags = skill.metadata.tags.filter(t =>
        message.includes(t.toLowerCase())
      );
      if (matchedTags.length > 0) {
        reasons.push(`Matched tags: ${matchedTags.join(', ')}`);
      }
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : 'General relevance to task';
  }

  /**
   * Select the best skill match (if confidence is high enough)
   */
  selectBest(matches: SkillMatch[]): SkillMatch | null {
    if (matches.length === 0) return null;

    const best = matches[0];
    
    // Only return if confidence is reasonably high
    return best.confidence >= 0.5 ? best : null;
  }
}