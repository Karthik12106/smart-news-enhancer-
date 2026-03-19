// js/summarizer.js
/**
 * Summarizer Module
 * 
 * This module generates concise summaries of article text at different lengths
 * following specific guidelines for each type:
 * - Short: 2-4 sentences - polished news brief style (who, what, why, outcome)
 * - Medium: 5-8 sentences - professional news editor style (smooth, factual, cohesive)
 * - Long: 2-3 paragraphs - feature article style (logical, natural, objective)
 */

/**
 * Generate summaries of article text at different lengths
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Object} Summaries at different lengths (short, medium, long)
 */
async function summarizeText(doc, content) {
    try {
        console.log('Generating article summaries...');
        
        // For initial load, generate only medium summary
        const mediumSummary = await generateSummaryForType(doc, content, 'medium');
        
        return {
            medium: mediumSummary,
            doc: doc,
            content: content,
            originalLength: doc.sentences().out('array').length
        };
        
    } catch (error) {
        console.error('Error in text summarization:', error);
        return {
            medium: 'Error generating summary.',
            doc: doc,
            content: content,
            originalLength: 0
        };
    }
}

/**
 * Generate a fresh summary for a specific type
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @param {string} type - Summary type (short, medium, long)
 * @returns {string} Generated summary
 */
async function generateSummaryForType(doc, content, type) {
    try {
        const sentencesArray = doc.sentences().out('array');
        
        if (sentencesArray.length === 0) {
            return 'No sentences found to summarize.';
        }
        
        const validSentences = sentencesArray
            .map(sentence => sentence.trim())
            .filter(sentence => sentence.length > 10)
            .map((sentence, index) => {
                if (!sentence.match(/[.!?]$/)) {
                    sentence = sentence + '.';
                }
                return sentence;
            });
        
        if (validSentences.length === 0) {
            return 'No valid sentences found to summarize.';
        }
        
        const scoredSentences = validSentences.map((sentence, index) => {
            const sentenceDoc = nlp(sentence);
            
            const wordCount = sentence.split(/\s+/).length;
            const isFirstSentence = index === 0;
            const isSecondSentence = index === 1;
            const isLastSentence = index === validSentences.length - 1;
            
            const peopleCount = sentenceDoc.people().length;
            const placesCount = sentenceDoc.places().length;
            const orgsCount = sentenceDoc.organizations().length;
            const totalEntities = peopleCount + placesCount + orgsCount;
            
            const keywords = extractKeywords(doc, content);
            let keywordMatches = 0;
            keywords.forEach(keyword => {
                if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
                    keywordMatches++;
                }
            });
            
            const relativePosition = index / Math.max(1, validSentences.length - 1);
            
            const hasQuote = sentence.includes('"') || sentence.includes('"') || sentence.includes('"');
            const hasNumbers = /\d+/.test(sentence);
            
            const sentenceLower = sentence.toLowerCase();
            const hasActionVerb = /\b(announced|said|stated|reported|declared|confirmed|revealed|launched|signed|agreed|decided|ruled|ordered|arrested|released|killed|injured|attacked|defended|accused|claimed|argued|proposed|rejected)\b/.test(sentenceLower);
            const hasOutcomeWords = /\b(result|outcome|consequence|impact|effect|led to|caused|resulted in|following|aftermath)\b/.test(sentenceLower);
            const hasSignificanceWords = /\b(important|significant|major|critical|key|crucial|essential|vital|historic|unprecedented|notable|remarkable)\b/.test(sentenceLower);
            const hasContextWords = /\b(because|since|due to|following|after|before|background|context|previously|earlier|historically)\b/.test(sentenceLower);
            const hasReactionWords = /\b(reaction|response|criticized|praised|welcomed|condemned|supported|opposed|expressed|described)\b/.test(sentenceLower);
            const hasFutureWords = /\b(will|would|could|may|might|future|expect|plan|intend|forecast|outlook|next|upcoming)\b/.test(sentenceLower);
            
            return {
                sentence,
                index,
                wordCount,
                isFirstSentence,
                isSecondSentence,
                isLastSentence,
                totalEntities,
                keywordMatches,
                relativePosition,
                hasQuote,
                hasNumbers,
                hasActionVerb,
                hasOutcomeWords,
                hasSignificanceWords,
                hasContextWords,
                hasReactionWords,
                hasFutureWords,
                score: 0
            };
        });
        
        let selectedSentences;
        switch (type) {
            case 'short':
                selectedSentences = scoreForShort(scoredSentences);
                break;
            case 'long':
                selectedSentences = scoreForLong(scoredSentences);
                break;
            default:
                selectedSentences = scoreForMedium(scoredSentences);
                break;
        }
        
        const orderedSentences = selectedSentences.sort((a, b) => a.index - b.index);
        
        const summary = orderedSentences
            .map(item => item.sentence.trim())
            .filter(sentence => sentence.length > 0)
            .join(' ');
        
        return summary || 'Unable to generate summary from the provided content.';
        
    } catch (error) {
        console.error('Error generating summary for type:', type, error);
        return 'Error generating summary. Please try again.';
    }
}

/**
 * Score sentences for SHORT summary (2-4 sentences)
 * Style: Polished news brief by a journalist
 * Focus: Essential facts only - who, what, why, main outcome
 * No opinions or minor details
 */
function scoreForShort(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(4, Math.max(2, Math.ceil(totalSentences * 0.07))); // Strict 2-4 sentences
    
    console.log(`Short summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // First sentence is essential (usually WHO and WHAT)
        if (sentence.isFirstSentence) {
            score += 20;
        }
        
        // Second sentence often has key details
        if (sentence.isSecondSentence) {
            score += 12;
        }
        
        // Early sentences in lead paragraph
        if (sentence.relativePosition <= 0.15) {
            score += 10;
        }
        
        // Entities = WHO (people, orgs, places)
        score += sentence.totalEntities * 5;
        
        // Action verbs = WHAT happened
        if (sentence.hasActionVerb) {
            score += 10;
        }
        
        // Significance = WHY it matters
        if (sentence.hasSignificanceWords) {
            score += 12;
        }
        
        // Outcome words = MAIN OUTCOME
        if (sentence.hasOutcomeWords) {
            score += 10;
        }
        
        // Numbers add factual weight
        if (sentence.hasNumbers) {
            score += 4;
        }
        
        // Keywords indicate core content
        score += sentence.keywordMatches * 3;
        
        // Prefer journalist-style sentence length (12-28 words)
        if (sentence.wordCount >= 12 && sentence.wordCount <= 28) {
            score += 6;
        } else if (sentence.wordCount < 10 || sentence.wordCount > 35) {
            score -= 6;
        }
        
        // AVOID quotes (not essential facts)
        if (sentence.hasQuote) {
            score -= 10;
        }
        
        // AVOID minor details (context/background not needed)
        if (sentence.hasContextWords) {
            score -= 5;
        }
        
        // Avoid reactions (not essential)
        if (sentence.hasReactionWords) {
            score -= 4;
        }
        
        sentence.score = score;
    });
    
    const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Ensure first sentence is included
    let selected = [];
    const firstSentence = scoredSentences[0];
    if (firstSentence && firstSentence.wordCount >= 10) {
        selected.push(firstSentence);
    }
    
    // Add highest scoring sentences
    sortedSentences.forEach(sentence => {
        if (selected.length < targetCount && !selected.some(s => s.index === sentence.index)) {
            selected.push(sentence);
        }
    });
    
    console.log(`Short summary selected ${selected.length} sentences`);
    return selected.slice(0, targetCount);
}

/**
 * Score sentences for MEDIUM summary (5-8 sentences, one paragraph)
 * Style: Professional news editor - smooth, factual, cohesive
 * Focus: Key event, important people/orgs, background context, reason it matters
 */
function scoreForMedium(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(8, Math.max(5, Math.ceil(totalSentences * 0.18))); // 5-8 sentences
    
    console.log(`Medium summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // Lead sentence for key event
        if (sentence.isFirstSentence) {
            score += 12;
        }
        
        // Early sentences capture main event
        if (sentence.relativePosition <= 0.25) {
            score += 8;
        }
        
        // Important people and organizations
        score += sentence.totalEntities * 4;
        
        // Key event indicators
        if (sentence.hasActionVerb) {
            score += 6;
        }
        
        // Background context (essential for editor-style summary)
        if (sentence.hasContextWords) {
            score += 8;
        }
        
        // Reason it matters
        if (sentence.hasSignificanceWords) {
            score += 8;
        }
        
        // Outcomes add completeness
        if (sentence.hasOutcomeWords) {
            score += 6;
        }
        
        // Numbers support factual tone
        if (sentence.hasNumbers) {
            score += 4;
        }
        
        // Keywords for cohesion
        score += sentence.keywordMatches * 3;
        
        // Middle content with substance
        if (sentence.relativePosition > 0.25 && sentence.relativePosition < 0.7) {
            if (sentence.totalEntities > 0 || sentence.keywordMatches > 1) {
                score += 5;
            }
        }
        
        // Quotes acceptable but not priority
        if (sentence.hasQuote) {
            score += 2;
        }
        
        // Professional sentence length (15-32 words for smooth reading)
        if (sentence.wordCount >= 15 && sentence.wordCount <= 32) {
            score += 5;
        } else if (sentence.wordCount < 10) {
            score -= 4;
        }
        
        sentence.score = score;
    });
    
    const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    const selected = sortedSentences.slice(0, targetCount);
    
    console.log(`Medium summary selected ${selected.length} sentences`);
    return selected;
}

/**
 * Score sentences for LONG summary (10-15 sentences, 2-3 paragraphs)
 * Style: Feature article - logical, natural, objective
 * Focus: Main event, background, quotes/reactions, future implications
 * No repetition or unnecessary words
 */
function scoreForLong(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(15, Math.max(10, Math.ceil(totalSentences * 0.32))); // 10-15 sentences
    
    console.log(`Long summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // Opening for main event
        if (sentence.isFirstSentence) {
            score += 10;
        }
        
        // Logical structure across article sections
        const section = Math.floor(sentence.relativePosition * 5);
        
        switch (section) {
            case 0: // Lead/Main Event (0-20%)
                score += 8;
                if (sentence.hasActionVerb) score += 4;
                break;
            case 1: // Background Information (20-40%)
                score += 7;
                if (sentence.hasContextWords) score += 6;
                break;
            case 2: // Development/Details (40-60%)
                score += 6;
                if (sentence.hasNumbers) score += 4;
                break;
            case 3: // Quotes/Reactions (60-80%)
                score += 7;
                if (sentence.hasQuote) score += 8; // Key quotes important
                if (sentence.hasReactionWords) score += 6;
                break;
            case 4: // Future Implications (80-100%)
                score += 8;
                if (sentence.hasFutureWords) score += 7;
                if (sentence.hasSignificanceWords) score += 5;
                break;
        }
        
        // Entities for comprehensive coverage
        score += sentence.totalEntities * 3;
        
        // Action verbs for natural flow
        if (sentence.hasActionVerb) {
            score += 4;
        }
        
        // Background information
        if (sentence.hasContextWords) {
            score += 5;
        }
        
        // Quotes add depth (feature article style)
        if (sentence.hasQuote) {
            score += 7;
        }
        
        // Reactions provide perspective
        if (sentence.hasReactionWords) {
            score += 6;
        }
        
        // Future implications (essential for feature)
        if (sentence.hasFutureWords) {
            score += 6;
        }
        
        // Significance for context
        if (sentence.hasSignificanceWords) {
            score += 5;
        }
        
        // Outcomes for completeness
        if (sentence.hasOutcomeWords) {
            score += 5;
        }
        
        // Numbers for objectivity
        if (sentence.hasNumbers) {
            score += 4;
        }
        
        // Keywords for coherence
        score += sentence.keywordMatches * 2;
        
        // Last sentence for conclusion
        if (sentence.isLastSentence && sentence.wordCount > 12) {
            score += 6;
        }
        
        // Natural article sentence length (12-35 words)
        if (sentence.wordCount >= 12 && sentence.wordCount <= 35) {
            score += 4;
        } else if (sentence.wordCount < 8) {
            score -= 3;
        }
        
        sentence.score = score;
    });
    
    // Ensure logical flow by selecting from each section
    const sections = [
        scoredSentences.filter(s => s.relativePosition <= 0.2),
        scoredSentences.filter(s => s.relativePosition > 0.2 && s.relativePosition <= 0.4),
        scoredSentences.filter(s => s.relativePosition > 0.4 && s.relativePosition <= 0.6),
        scoredSentences.filter(s => s.relativePosition > 0.6 && s.relativePosition <= 0.8),
        scoredSentences.filter(s => s.relativePosition > 0.8)
    ];
    
    const selected = [];
    const perSection = Math.ceil(targetCount / 5);
    
    sections.forEach(sectionSentences => {
        const topFromSection = sectionSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, perSection);
        selected.push(...topFromSection);
    });
    
    // Fill remaining with highest scoring
    if (selected.length < targetCount) {
        const sortedAll = [...scoredSentences].sort((a, b) => b.score - a.score);
        sortedAll.forEach(sentence => {
            if (selected.length < targetCount && !selected.some(s => s.index === sentence.index)) {
                selected.push(sentence);
            }
        });
    }
    
    console.log(`Long summary selected ${selected.length} sentences`);
    return selected.slice(0, targetCount);
}

/**
 * Extract important keywords from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of important keywords
 */
function extractKeywords(doc, content) {
    try {
        const nouns = doc.nouns().not('#Person').not('#Place').not('#Organization').out('array');
        
        const wordFreq = {};
        nouns.forEach(noun => {
            const word = noun.toLowerCase();
            if (word.length > 3) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        const sortedWords = Object.keys(wordFreq)
            .filter(word => wordFreq[word] > 1)
            .sort((a, b) => wordFreq[b] - wordFreq[a]);
        
        return sortedWords.slice(0, 10);
    } catch (error) {
        console.error("Error extracting keywords:", error);
        return [];
    }
}

// Make the function globally available
window.generateSummaryForType = generateSummaryForType;// js/summarizer.js
/**
 * Summarizer Module
 * 
 * This module generates concise summaries of article text at different lengths
 * following specific guidelines for each type:
 * - Short: 2-4 sentences focusing on key facts (who, what, why, impact)
 * - Medium: 5-8 sentences with main event, context, key players, significance
 * - Long: 2-3 paragraphs with comprehensive coverage including quotes and implications
 */

/**
 * Generate summaries of article text at different lengths
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Object} Summaries at different lengths (short, medium, long)
 */
async function summarizeText(doc, content) {
    try {
        console.log('Generating article summaries...');
        
        // For initial load, generate only medium summary
        const mediumSummary = await generateSummaryForType(doc, content, 'medium');
        
        return {
            medium: mediumSummary,
            doc: doc,
            content: content,
            originalLength: doc.sentences().out('array').length
        };
        
    } catch (error) {
        console.error('Error in text summarization:', error);
        return {
            medium: 'Error generating summary.',
            doc: doc,
            content: content,
            originalLength: 0
        };
    }
}

/**
 * Generate a fresh summary for a specific type
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @param {string} type - Summary type (short, medium, long)
 * @returns {string} Generated summary
 */
async function generateSummaryForType(doc, content, type) {
    try {
        const sentencesArray = doc.sentences().out('array');
        
        if (sentencesArray.length === 0) {
            return 'No sentences found to summarize.';
        }
        
        const validSentences = sentencesArray
            .map(sentence => sentence.trim())
            .filter(sentence => sentence.length > 10)
            .map((sentence, index) => {
                if (!sentence.match(/[.!?]$/)) {
                    sentence = sentence + '.';
                }
                return sentence;
            });
        
        if (validSentences.length === 0) {
            return 'No valid sentences found to summarize.';
        }
        
        const scoredSentences = validSentences.map((sentence, index) => {
            const sentenceDoc = nlp(sentence);
            
            const wordCount = sentence.split(/\s+/).length;
            const isFirstSentence = index === 0;
            const isLastSentence = index === validSentences.length - 1;
            
            const peopleCount = sentenceDoc.people().length;
            const placesCount = sentenceDoc.places().length;
            const orgsCount = sentenceDoc.organizations().length;
            const totalEntities = peopleCount + placesCount + orgsCount;
            
            const keywords = extractKeywords(doc, content);
            let keywordMatches = 0;
            keywords.forEach(keyword => {
                if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
                    keywordMatches++;
                }
            });
            
            const relativePosition = index / Math.max(1, validSentences.length - 1);
            
            const hasQuote = sentence.includes('"') || sentence.includes('"') || sentence.includes('"');
            const hasNumbers = /\d+/.test(sentence);
            
            const sentenceLower = sentence.toLowerCase();
            const hasActionVerb = /\b(announced|said|reported|stated|declared|confirmed|revealed|launched|signed|agreed|decided)\b/.test(sentenceLower);
            const hasImpactWords = /\b(significant|important|major|critical|key|essential|impact|effect|result|consequence)\b/.test(sentenceLower);
            const hasContextWords = /\b(because|since|due to|following|after|before|background|context|history)\b/.test(sentenceLower);
            
            return {
                sentence,
                index,
                wordCount,
                isFirstSentence,
                isLastSentence,
                totalEntities,
                keywordMatches,
                relativePosition,
                hasQuote,
                hasNumbers,
                hasActionVerb,
                hasImpactWords,
                hasContextWords,
                score: 0
            };
        });
        
        let selectedSentences;
        switch (type) {
            case 'short':
                selectedSentences = scoreForShort(scoredSentences);
                break;
            case 'long':
                selectedSentences = scoreForLong(scoredSentences);
                break;
            default:
                selectedSentences = scoreForMedium(scoredSentences);
                break;
        }
        
        const orderedSentences = selectedSentences.sort((a, b) => a.index - b.index);
        
        const summary = orderedSentences
            .map(item => item.sentence.trim())
            .filter(sentence => sentence.length > 0)
            .join(' ');
        
        return summary || 'Unable to generate summary from the provided content.';
        
    } catch (error) {
        console.error('Error generating summary for type:', type, error);
        return 'Error generating summary. Please try again.';
    }
}

/**
 * Score sentences for SHORT summary (2-4 sentences)
 * Focus: Key facts - who did what, why it matters, impact
 * Style: BBC news brief - concise, no extras or quotes
 */
function scoreForShort(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(4, Math.max(2, Math.ceil(totalSentences * 0.06))); // 2-4 sentences
    
    console.log(`Short summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // First sentence is critical (usually has WHO and WHAT)
        if (sentence.isFirstSentence) {
            score += 15;
        }
        
        // Early sentences (first 20%) get priority
        if (sentence.relativePosition <= 0.2) {
            score += 10;
        }
        
        // Key facts: entities (WHO)
        score += sentence.totalEntities * 4;
        
        // Action verbs (WHAT happened)
        if (sentence.hasActionVerb) {
            score += 8;
        }
        
        // Impact words (WHY it matters)
        if (sentence.hasImpactWords) {
            score += 10;
        }
        
        // Numbers add factual weight
        if (sentence.hasNumbers) {
            score += 3;
        }
        
        // Keywords indicate importance
        score += sentence.keywordMatches * 2;
        
        // PENALIZE quotes (no quotes in BBC-style brief)
        if (sentence.hasQuote) {
            score -= 8;
        }
        
        // Prefer concise sentences (10-25 words ideal)
        if (sentence.wordCount >= 10 && sentence.wordCount <= 25) {
            score += 5;
        } else if (sentence.wordCount < 8 || sentence.wordCount > 35) {
            score -= 5;
        }
        
        // Penalize overly long sentences
        if (sentence.wordCount > 40) {
            score -= 10;
        }
        
        sentence.score = score;
    });
    
    const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Always include first sentence if it's substantial
    let selected = [];
    const firstSentence = scoredSentences[0];
    if (firstSentence && firstSentence.wordCount >= 8) {
        selected.push(firstSentence);
    }
    
    sortedSentences.forEach(sentence => {
        if (selected.length < targetCount && !selected.some(s => s.index === sentence.index)) {
            selected.push(sentence);
        }
    });
    
    console.log(`Short summary selected ${selected.length} sentences`);
    return selected.slice(0, targetCount);
}

/**
 * Score sentences for MEDIUM summary (5-8 sentences, one paragraph)
 * Focus: Main event, background context, key people/orgs, significance
 * Style: Professional news summary - factual and neutral
 */
function scoreForMedium(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(8, Math.max(5, Math.ceil(totalSentences * 0.15))); // 5-8 sentences
    
    console.log(`Medium summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // First sentence for main event
        if (sentence.isFirstSentence) {
            score += 10;
        }
        
        // Early sentences (first 25%)
        if (sentence.relativePosition <= 0.25) {
            score += 6;
        }
        
        // Context sentences (background)
        if (sentence.hasContextWords) {
            score += 7;
        }
        
        // Key people and organizations
        score += sentence.totalEntities * 3;
        
        // Action verbs for main event
        if (sentence.hasActionVerb) {
            score += 5;
        }
        
        // Significance indicators
        if (sentence.hasImpactWords) {
            score += 6;
        }
        
        // Numbers add professional credibility
        if (sentence.hasNumbers) {
            score += 3;
        }
        
        // Keywords indicate relevance
        score += sentence.keywordMatches * 2;
        
        // Middle content with substance
        if (sentence.relativePosition > 0.25 && sentence.relativePosition < 0.75) {
            if (sentence.totalEntities > 0 || sentence.keywordMatches > 0) {
                score += 4;
            }
        }
        
        // Moderate quote preference (some quotes ok, not too many)
        if (sentence.hasQuote) {
            score += 2; // Slight bonus, not penalty
        }
        
        // Prefer substantial sentences
        if (sentence.wordCount >= 12 && sentence.wordCount <= 30) {
            score += 4;
        } else if (sentence.wordCount < 8) {
            score -= 3;
        }
        
        sentence.score = score;
    });
    
    const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    const selected = sortedSentences.slice(0, targetCount);
    
    console.log(`Medium summary selected ${selected.length} sentences`);
    return selected;
}

/**
 * Score sentences for LONG summary (2-3 paragraphs)
 * Focus: All major points, historical context, quotes/reactions, future implications
 * Style: Clear and informative journalistic tone with logical flow
 */
function scoreForLong(scoredSentences) {
    const totalSentences = scoredSentences.length;
    const targetCount = Math.min(15, Math.max(10, Math.ceil(totalSentences * 0.30))); // 10-15 sentences
    
    console.log(`Long summary: targeting ${targetCount} sentences`);
    
    scoredSentences.forEach((sentence) => {
        let score = 0;
        
        // First sentence for introduction
        if (sentence.isFirstSentence) {
            score += 8;
        }
        
        // Distribute across sections for logical flow
        const section = Math.floor(sentence.relativePosition * 4);
        
        switch (section) {
            case 0: // Introduction (0-25%)
                score += 6;
                break;
            case 1: // Background/Context (25-50%)
                score += 5;
                if (sentence.hasContextWords) {
                    score += 4; // Historical context
                }
                break;
            case 2: // Reactions/Details (50-75%)
                score += 4;
                if (sentence.hasQuote) {
                    score += 5; // Quotes and reactions important here
                }
                break;
            case 3: // Implications (75-100%)
                score += 5;
                if (sentence.hasImpactWords) {
                    score += 4; // Future implications
                }
                break;
        }
        
        // Entities for comprehensive coverage
        score += sentence.totalEntities * 2;
        
        // Action verbs
        if (sentence.hasActionVerb) {
            score += 3;
        }
        
        // Numbers for factual accuracy
        if (sentence.hasNumbers) {
            score += 4;
        }
        
        // Keywords for relevance
        score += sentence.keywordMatches * 2;
        
        // Context words for background
        if (sentence.hasContextWords) {
            score += 4;
        }
        
        // Impact words for significance
        if (sentence.hasImpactWords) {
            score += 4;
        }
        
        // Quotes add depth (important for long summary)
        if (sentence.hasQuote) {
            score += 6;
        }
        
        // Last sentence for conclusion
        if (sentence.isLastSentence && sentence.wordCount > 10) {
            score += 5;
        }
        
        // Be inclusive of different lengths
        if (sentence.wordCount >= 10) {
            score += 3;
        }
        
        sentence.score = score;
    });
    
    const sortedSentences = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Ensure coverage across all sections
    const selected = [];
    const sections = [
        sortedSentences.filter(s => s.relativePosition <= 0.25),
        sortedSentences.filter(s => s.relativePosition > 0.25 && s.relativePosition <= 0.5),
        sortedSentences.filter(s => s.relativePosition > 0.5 && s.relativePosition <= 0.75),
        sortedSentences.filter(s => s.relativePosition > 0.75)
    ];
    
    const perSection = Math.ceil(targetCount / 4);
    
    sections.forEach(sectionSentences => {
        const topFromSection = sectionSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, perSection);
        selected.push(...topFromSection);
    });
    
    // Fill remaining slots with highest scoring
    const remaining = targetCount - selected.length;
    if (remaining > 0) {
        sortedSentences.forEach(sentence => {
            if (selected.length < targetCount && !selected.some(s => s.index === sentence.index)) {
                selected.push(sentence);
            }
        });
    }
    
    console.log(`Long summary selected ${selected.length} sentences`);
    return selected.slice(0, targetCount);
}

/**
 * Extract important keywords from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of important keywords
 */
function extractKeywords(doc, content) {
    try {
        const nouns = doc.nouns().not('#Person').not('#Place').not('#Organization').out('array');
        
        const wordFreq = {};
        nouns.forEach(noun => {
            const word = noun.toLowerCase();
            if (word.length > 3) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        const sortedWords = Object.keys(wordFreq)
            .filter(word => wordFreq[word] > 1)
            .sort((a, b) => wordFreq[b] - wordFreq[a]);
        
        return sortedWords.slice(0, 10);
    } catch (error) {
        console.error("Error extracting keywords:", error);
        return [];
    }
}

// Make the function globally available
window.generateSummaryForType = generateSummaryForType;