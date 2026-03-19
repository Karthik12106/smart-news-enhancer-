// js/fake-news-detector.js
/**
 * Fake News Detector Module
 * 
 * This module analyzes article text to detect potential bias, misleading content,
 * or other indicators of unreliable information using linguistic analysis.
 * 
 * Note: This is a simplified approach using basic linguistic markers and is not
 * a definitive fact-checking system. It should be used as a starting point for
 * critical reading, not as an authoritative determination of an article's veracity.
 */

/**
 * Analyze article text for indicators of potential bias or misleading content
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @param {string} source - Article source
 * @returns {Object} Analysis results
 */
async function detectFakeNews(doc, content, source) {
    try {
        console.log('Analyzing article for potential bias indicators...');
        
        // 1. Check for subjective language (neutral reporting words don't count heavily)
        const subjectiveWords = [
            'believe', 'think', 'feel', 'opinion', 'claim', 'allegedly',
            'reportedly', 'supposedly', 'apparent', 'seemingly'
        ];
        const subjectiveCount = countWordMatches(content, subjectiveWords);
        
        // 2. Check for emotional language
        const emotionalWords = [
            'shocking', 'outrageous', 'incredible', 'amazing', 'terrible', 'horrible',
            'stunning', 'extraordinary', 'unbelievable', 'devastating', 'catastrophic',
            'fantastic', 'wonderful', 'terrific', 'awful', 'disgusting'
        ];
        const emotionalCount = countWordMatches(content, emotionalWords);
        
        // 3. Check for certainty markers (absolute statements)
        const certaintyWords = [
            'always', 'never', 'all', 'none', 'every', 'absolutely',
            'undoubtedly', 'certainly', 'definitely', 'undeniably',
            'obviously', 'without a doubt', 'unquestionably'
        ];
        const certaintyCount = countWordMatches(content, certaintyWords);
        
        // 4. Check for question marks (speculative content)
        const questionCount = (content.match(/\?/g) || []).length;
        
        // 5. Check for exclamation marks (sensationalism)
        const exclamationCount = (content.match(/!/g) || []).length;
        
        // 6. Check for weasel words (vague attributions)
        const weaselWords = [
            'experts say', 'scientists believe', 'many people', 'some say',
            'critics claim', 'sources say', 'it is said', 'it is believed',
            'it is reported', 'it is rumored', 'people are saying'
        ];
        const weaselCount = countPhraseMatches(content, weaselWords);
        
        // 7. Check for quote density (direct quotes are generally good for credibility)
        const quoteCount = (content.match(/"/g) || []).length / 2; // Pairs of quotes
        
        // Calculate a basic score (higher = more potential issues)
        const wordCount = content.split(/\s+/).length;
        const normalizer = Math.max(1, wordCount / 500); // Normalize for article length
        
        // Reduce weight for "said" which is common in news reporting
        const adjustedSubjective = Math.max(0, subjectiveCount - (content.match(/\bsaid\b/gi) || []).length);
        
        const subjectiveScore = (adjustedSubjective / normalizer) * 1.5;
        const emotionalScore = (emotionalCount / normalizer) * 3;
        const certaintyScore = (certaintyCount / normalizer) * 2.5;
        const questionScore = (questionCount / normalizer) * 1;
        const exclamationScore = (exclamationCount / normalizer) * 2;
        const weaselScore = (weaselCount / normalizer) * 3;
        
        // Bonus for having quotes (indicates direct sourcing)
        const quoteBonus = (quoteCount > 3) ? -2 : 0; // Reduce score if article has quotes
        
        const totalScore = subjectiveScore + emotionalScore + certaintyScore + 
                          questionScore + exclamationScore + weaselScore + quoteBonus;
        
        // Determine a simple rating with adjusted thresholds
        let level, rating, explanation;
        if (totalScore < 4) {
            level = 'low';
            rating = 'Low Concern';
            explanation = 'This article uses mostly neutral language with few emotional or subjective terms. It appears to present information in a relatively balanced way.';
        } else if (totalScore < 8) {
            level = 'medium';
            rating = 'Moderate Concern';
            explanation = 'This article contains some subjective or emotional language that may indicate bias. This is common in opinion pieces or political reporting. Consider cross-checking key claims with other sources.';
        } else {
            level = 'high';
            rating = 'Higher Concern';
            explanation = 'This article contains notable emotional language, subjective terms, or absolute statements. This may indicate strong editorial voice, opinion content, or potential bias. Verify key claims with multiple reliable sources.';
        }
        
        // Compile metrics for display
        const metrics = [
            { name: 'Subjective language', value: subjectiveCount, unit: 'instances' },
            { name: 'Emotional terms', value: emotionalCount, unit: 'instances' },
            { name: 'Absolute statements', value: certaintyCount, unit: 'instances' },
            { name: 'Exclamation marks', value: exclamationCount, unit: 'instances' },
            { name: 'Vague attributions', value: weaselCount, unit: 'instances' },
            { name: 'Direct quotes', value: Math.floor(quoteCount), unit: 'instances' }
        ];
        
        return {
            level,
            rating,
            explanation,
            metrics,
            score: totalScore
        };
        
    } catch (error) {
        console.error('Error in fake news detection:', error);
        return {
            level: 'unknown',
            rating: 'Analysis Error',
            explanation: 'Could not complete analysis due to an error.',
            metrics: [],
            score: 0
        };
    }
}

/**
 * Count occurrences of words in content
 * @param {string} content - Text content to analyze
 * @param {Array} wordList - List of words to count
 * @returns {number} Total count of matches
 */
function countWordMatches(content, wordList) {
    let count = 0;
    const lowerContent = content.toLowerCase();
    
    wordList.forEach(word => {
        // Create regex to match whole words only
        const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
        const matches = lowerContent.match(regex);
        if (matches) {
            count += matches.length;
        }
    });
    
    return count;
}

/**
 * Count occurrences of phrases in content
 * @param {string} content - Text content to analyze
 * @param {Array} phraseList - List of phrases to count
 * @returns {number} Total count of matches
 */
function countPhraseMatches(content, phraseList) {
    let count = 0;
    const lowerContent = content.toLowerCase();
    
    phraseList.forEach(phrase => {
        const regex = new RegExp(escapeRegExp(phrase), 'gi');
        const matches = lowerContent.match(regex);
        if (matches) {
            count += matches.length;
        }
    });
    
    return count;
}

/**
 * Escape special characters in string for use in RegExp
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}// js/fake-news-detector.js
/**
 * Fake News Detector Module
 * 
 * This module analyzes article text to detect potential bias, misleading content,
 * or other indicators of unreliable information using linguistic analysis.
 * 
 * Note: This is a simplified approach using basic linguistic markers and is not
 * a definitive fact-checking system. It should be used as a starting point for
 * critical reading, not as an authoritative determination of an article's veracity.
 */

/**
 * Analyze article text for indicators of potential bias or misleading content
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @param {string} source - Article source
 * @returns {Object} Analysis results
 */
async function detectFakeNews(doc, content, source) {
    try {
        console.log('Analyzing article for potential bias indicators...');
        
        // 1. Check for subjective language (neutral reporting words don't count heavily)
        const subjectiveWords = [
            'believe', 'think', 'feel', 'opinion', 'claim', 'allegedly',
            'reportedly', 'supposedly', 'apparent', 'seemingly'
        ];
        const subjectiveCount = countWordMatches(content, subjectiveWords);
        
        // 2. Check for emotional language
        const emotionalWords = [
            'shocking', 'outrageous', 'incredible', 'amazing', 'terrible', 'horrible',
            'stunning', 'extraordinary', 'unbelievable', 'devastating', 'catastrophic',
            'fantastic', 'wonderful', 'terrific', 'awful', 'disgusting'
        ];
        const emotionalCount = countWordMatches(content, emotionalWords);
        
        // 3. Check for certainty markers (absolute statements)
        const certaintyWords = [
            'always', 'never', 'all', 'none', 'every', 'absolutely',
            'undoubtedly', 'certainly', 'definitely', 'undeniably',
            'obviously', 'without a doubt', 'unquestionably'
        ];
        const certaintyCount = countWordMatches(content, certaintyWords);
        
        // 4. Check for question marks (speculative content)
        const questionCount = (content.match(/\?/g) || []).length;
        
        // 5. Check for exclamation marks (sensationalism)
        const exclamationCount = (content.match(/!/g) || []).length;
        
        // 6. Check for weasel words (vague attributions)
        const weaselWords = [
            'experts say', 'scientists believe', 'many people', 'some say',
            'critics claim', 'sources say', 'it is said', 'it is believed',
            'it is reported', 'it is rumored', 'people are saying'
        ];
        const weaselCount = countPhraseMatches(content, weaselWords);
        
        // 7. Check for quote density (direct quotes are generally good for credibility)
        const quoteCount = (content.match(/"/g) || []).length / 2; // Pairs of quotes
        
        // Calculate a basic score (higher = more potential issues)
        const wordCount = content.split(/\s+/).length;
        const normalizer = Math.max(1, wordCount / 500); // Normalize for article length
        
        // Reduce weight for "said" which is common in news reporting
        const adjustedSubjective = Math.max(0, subjectiveCount - (content.match(/\bsaid\b/gi) || []).length);
        
        const subjectiveScore = (adjustedSubjective / normalizer) * 1.5;
        const emotionalScore = (emotionalCount / normalizer) * 3;
        const certaintyScore = (certaintyCount / normalizer) * 2.5;
        const questionScore = (questionCount / normalizer) * 1;
        const exclamationScore = (exclamationCount / normalizer) * 2;
        const weaselScore = (weaselCount / normalizer) * 3;
        
        // Bonus for having quotes (indicates direct sourcing)
        const quoteBonus = (quoteCount > 3) ? -2 : 0; // Reduce score if article has quotes
        
        const totalScore = subjectiveScore + emotionalScore + certaintyScore + 
                          questionScore + exclamationScore + weaselScore + quoteBonus;
        
        // Determine a simple rating with adjusted thresholds
        let level, rating, explanation;
        if (totalScore < 4) {
            level = 'low';
            rating = 'Low Concern';
            explanation = 'This article uses mostly neutral language with few emotional or subjective terms. It appears to present information in a relatively balanced way.';
        } else if (totalScore < 8) {
            level = 'medium';
            rating = 'Moderate Concern';
            explanation = 'This article contains some subjective or emotional language that may indicate bias. This is common in opinion pieces or political reporting. Consider cross-checking key claims with other sources.';
        } else {
            level = 'high';
            rating = 'Higher Concern';
            explanation = 'This article contains notable emotional language, subjective terms, or absolute statements. This may indicate strong editorial voice, opinion content, or potential bias. Verify key claims with multiple reliable sources.';
        }
        
        // Compile metrics for display
        const metrics = [
            { name: 'Subjective language', value: subjectiveCount, unit: 'instances' },
            { name: 'Emotional terms', value: emotionalCount, unit: 'instances' },
            { name: 'Absolute statements', value: certaintyCount, unit: 'instances' },
            { name: 'Exclamation marks', value: exclamationCount, unit: 'instances' },
            { name: 'Vague attributions', value: weaselCount, unit: 'instances' },
            { name: 'Direct quotes', value: Math.floor(quoteCount), unit: 'instances' }
        ];
        
        return {
            level,
            rating,
            explanation,
            metrics,
            score: totalScore
        };
        
    } catch (error) {
        console.error('Error in fake news detection:', error);
        return {
            level: 'unknown',
            rating: 'Analysis Error',
            explanation: 'Could not complete analysis due to an error.',
            metrics: [],
            score: 0
        };
    }
}

/**
 * Count occurrences of words in content
 * @param {string} content - Text content to analyze
 * @param {Array} wordList - List of words to count
 * @returns {number} Total count of matches
 */
function countWordMatches(content, wordList) {
    let count = 0;
    const lowerContent = content.toLowerCase();
    
    wordList.forEach(word => {
        // Create regex to match whole words only
        const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
        const matches = lowerContent.match(regex);
        if (matches) {
            count += matches.length;
        }
    });
    
    return count;
}

/**
 * Count occurrences of phrases in content
 * @param {string} content - Text content to analyze
 * @param {Array} phraseList - List of phrases to count
 * @returns {number} Total count of matches
 */
function countPhraseMatches(content, phraseList) {
    let count = 0;
    const lowerContent = content.toLowerCase();
    
    phraseList.forEach(phrase => {
        const regex = new RegExp(escapeRegExp(phrase), 'gi');
        const matches = lowerContent.match(regex);
        if (matches) {
            count += matches.length;
        }
    });
    
    return count;
}

/**
 * Escape special characters in string for use in RegExp
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}