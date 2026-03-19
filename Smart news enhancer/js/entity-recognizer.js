// js/entity-recognizer.js
/**
 * Entity Recognizer Module
 * 
 * This module identifies and extracts named entities (people, places, organizations)
 * and key terms from article text using compromise.js. It provides functionality
 * for annotating these entities in the original text and displaying additional
 * information about them.
 */

/**
 * Recognize and extract entities from article text
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of recognized entities
 */
async function recognizeEntities(doc, content) {
    try {
        console.log('Recognizing entities in article...');
        console.log('Content preview:', content.substring(0, 200));
        
        // Extract different types of entities
        const people = extractPeople(doc, content);
        const places = extractPlaces(doc, content);
        const organizations = extractOrganizations(doc, content);
        const terms = extractKeyTerms(doc, content);
        
        console.log('Extracted entities:', {
            people: people.length,
            places: places.length,
            organizations: organizations.length,
            terms: terms.length
        });
        
        // Combine all entities
        const allEntities = [
            ...people,
            ...places,
            ...organizations,
            ...terms
        ];
        
        console.log('Total entities before deduplication:', allEntities.length);
        
        // If no entities found at all, use fallback extraction
        if (allEntities.length === 0) {
            console.log('No entities found with compromise.js, using fallback...');
            return extractEntitiesFallback(content);
        }
        
        // Remove duplicates and similar entities
        const uniqueEntities = removeDuplicateAndSimilarEntities(allEntities);
        
        // Generate unique IDs for each entity
        uniqueEntities.forEach((entity, index) => {
            entity.id = `entity-${index}`;
        });
        
        console.log(`Total unique entities found: ${uniqueEntities.length}`);
        
        return uniqueEntities;
        
    } catch (error) {
        console.error('Error recognizing entities:', error);
        // Try fallback on error
        return extractEntitiesFallback(content);
    }
}

/**
 * Normalize entity text by removing punctuation and possessives
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeEntityText(text) {
    return text.trim()
        .replace(/^["''""`']+|["''""`']+$/g, '') // Remove ALL types of quotes (straight and curly)
        .replace(/["''""`']/g, '') // Remove quotes from middle too
        .replace(/['']s\b/gi, '') // Remove possessive 's (case insensitive)
        .replace(/[,\.;:!?…\-–—]+$/g, '') // Remove ALL trailing punctuation including dashes
        .replace(/[,\.;:!?…]+/g, ' ') // Replace internal punctuation with spaces
        .replace(/\s+/g, ' ') // Normalize all whitespace to single space
        .trim();
}

/**
 * Calculate similarity score between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // One completely contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
        const shorter = Math.min(s1.length, s2.length);
        const longer = Math.max(s1.length, s2.length);
        return shorter / longer; // Returns high score if lengths are similar
    }
    
    // Word-based comparison
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    // Jaccard similarity
    return intersection.size / union.size;
}

/**
 * Check if two entities are similar enough to be considered duplicates
 * @param {string} entity1 - First entity
 * @param {string} entity2 - Second entity
 * @returns {boolean} True if similar
 */
function areEntitiesSimilar(entity1, entity2) {
    const similarity = calculateSimilarity(entity1, entity2);
    
    // Consider entities similar if:
    // 1. Similarity score > 0.7 (70% overlap)
    // 2. OR one contains the other with >60% length ratio
    if (similarity > 0.7) return true;
    
    const e1Lower = entity1.toLowerCase();
    const e2Lower = entity2.toLowerCase();
    
    if (e1Lower.includes(e2Lower) || e2Lower.includes(e1Lower)) {
        const shorter = Math.min(entity1.length, entity2.length);
        const longer = Math.max(entity1.length, entity2.length);
        return (shorter / longer) > 0.6; // 60% threshold
    }
    
    return false;
}

/**
 * Fallback entity extraction using simple pattern matching
 * @param {string} content - Article content
 * @returns {Array} List of extracted entities
 */
function extractEntitiesFallback(content) {
    console.log('Using fallback entity extraction...');
    const entities = [];
    
    try {
        // Extract capitalized words (potential proper nouns)
        const words = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
        
        // Count frequency
        const wordFreq = {};
        words.forEach(word => {
            const normalized = normalizeEntityText(word);
            wordFreq[normalized] = (wordFreq[normalized] || 0) + 1;
        });
        
        // Get words that appear more than once
        const significantWords = Object.keys(wordFreq)
            .filter(word => wordFreq[word] >= 2 && word.length > 3)
            .sort((a, b) => wordFreq[b] - wordFreq[a])
            .slice(0, 10); // Top 10
        
        significantWords.forEach(word => {
            entities.push({
                text: word,
                type: 'term',
                description: `Mentioned ${wordFreq[word]} times in the article.`,
                id: `entity-fallback-${entities.length}`
            });
        });
        
        // Also extract common nouns as key terms
        const commonWords = content.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 4);
        
        const commonFreq = {};
        commonWords.forEach(word => {
            commonFreq[word] = (commonFreq[word] || 0) + 1;
        });
        
        const topCommon = Object.keys(commonFreq)
            .filter(word => commonFreq[word] >= 3)
            .sort((a, b) => commonFreq[b] - commonFreq[a])
            .slice(0, 5);
        
        topCommon.forEach(word => {
            const displayWord = word.charAt(0).toUpperCase() + word.slice(1);
            if (!entities.some(e => e.text.toLowerCase() === word)) {
                entities.push({
                    text: displayWord,
                    type: 'term',
                    description: `Key term mentioned ${commonFreq[word]} times.`,
                    id: `entity-fallback-${entities.length}`
                });
            }
        });
        
        console.log('Fallback extraction found:', entities.length, 'entities');
        
    } catch (error) {
        console.error('Error in fallback extraction:', error);
    }
    
    return entities;
}

/**
 * Extract people from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of people entities
 */
function extractPeople(doc, content) {
    try {
        const people = doc.people().out('array');
        console.log('Raw people extracted:', people);
        
        // Exclusion list - things that are NOT people
        const exclusionPatterns = [
            /\bcup\b/i, /\btrophy\b/i, /\bchampionship\b/i, /\bleague\b/i,
            /\btournament\b/i, /\bseries\b/i, /\baward\b/i, /\bteam\b/i,
            /\bcommittee\b/i, /\bgovernment\b/i, /\bministry\b/i, /\bdepartment\b/i,
            /\bcompany\b/i, /\bcorporation\b/i, /^when\b/i, /^where\b/i,
            /^what\b/i, /^which\b/i, /^that\b/i, /^this\b/i, /^the\b/i,
            /^after\b/i, /^before\b/i, /^during\b/i
        ];
        
        const commonWords = ['india', 'pakistan', 'america', 'china', 'russia', 'europe', 'asia', 'africa'];
        
        // If compromise.js doesn't find people, try manual extraction
        if (people.length === 0) {
            console.log('Compromise found no people, trying manual extraction...');
            const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
            const matches = content.match(namePattern) || [];
            const peopleMap = new Map();
            
            matches.forEach(name => {
                let normalized = normalizeEntityText(name);
                const lowerName = normalized.toLowerCase();
                const key = lowerName;
                
                if (commonWords.some(word => lowerName.includes(word))) return;
                if (exclusionPatterns.some(pattern => pattern.test(normalized))) return;
                if (normalized.split(' ').length < 2) return;
                
                if (!peopleMap.has(key)) {
                    peopleMap.set(key, {
                        text: normalized,
                        type: 'person',
                        description: `Person mentioned in the article.`
                    });
                }
            });
            
            const uniqueNames = Array.from(peopleMap.values()).slice(0, 10);
            console.log('Manual extraction found:', uniqueNames.length);
            return uniqueNames;
        }
        
        // Use Map for better deduplication with normalization
        const peopleMap = new Map();
        
        people.forEach(name => {
            let normalized = normalizeEntityText(name);
            const lowerName = normalized.toLowerCase();
            const key = lowerName;
            
            // Apply all filters
            if (commonWords.includes(lowerName)) {
                console.log(`Excluding "${normalized}" - common country/region name`);
                return;
            }
            
            const firstWord = normalized.split(' ')[0].toLowerCase();
            if (['when', 'where', 'what', 'which', 'that', 'this', 'the', 'after', 'before', 'during'].includes(firstWord)) {
                console.log(`Excluding "${normalized}" - starts with non-person word`);
                return;
            }
            
            if (exclusionPatterns.some(pattern => pattern.test(normalized))) {
                console.log(`Excluding "${normalized}" - matches exclusion pattern`);
                return;
            }
            
            const words = normalized.split(' ');
            if (words.length === 1) {
                const isValid = normalized.length >= 3 && 
                              /^[A-Z][a-z]+$/.test(normalized) && 
                              !commonWords.includes(lowerName);
                if (!isValid) {
                    console.log(`Excluding single-word "${normalized}" - doesn't meet person criteria`);
                    return;
                }
            }
            
            if (words.length < 2) {
                console.log(`Excluding "${normalized}" - less than 2 words`);
                return;
            }
            
            const properlyCapitalized = words.every(word => /^[A-Z][a-z]+$/.test(word));
            if (!properlyCapitalized) {
                console.log(`Excluding "${normalized}" - not properly capitalized`);
                return;
            }
            
            if (!peopleMap.has(key)) {
                peopleMap.set(key, {
                    text: normalized,
                    type: 'person',
                    description: `Person mentioned in the article.`
                });
            }
        });
        
        const uniquePeople = Array.from(peopleMap.values());
        console.log('Filtered people:', uniquePeople.length);
        return uniquePeople;
    } catch (error) {
        console.error("Error extracting people:", error);
        return [];
    }
}

/**
 * Extract places from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of place entities
 */
function extractPlaces(doc, content) {
    try {
        const places = doc.places().out('array');
        console.log('Raw places extracted:', places);
        
        if (places.length === 0) {
            console.log('Compromise found no places, trying manual extraction...');
            const placeKeywords = [
                'United States', 'America', 'China', 'Russia', 'India', 'Pakistan', 
                'Bangladesh', 'Sri Lanka', 'Afghanistan', 'Nepal',
                'Europe', 'Asia', 'Africa', 'Australia', 'Antarctica',
                'New York', 'New York City', 'London', 'Paris', 'Tokyo', 'Washington', 
                'Moscow', 'Beijing', 'Delhi', 'New Delhi', 'Mumbai', 'Karachi', 'Lahore',
                'Dubai', 'Singapore', 'Hong Kong', 'Bangkok', 'Jakarta'
            ];
            const foundPlaces = [];
            const addedPlaces = new Set();
            
            placeKeywords.forEach(place => {
                const placeLower = place.toLowerCase();
                if (content.includes(place) && !addedPlaces.has(placeLower)) {
                    foundPlaces.push({
                        text: place,
                        type: 'place',
                        description: `Location mentioned in the article.`
                    });
                    addedPlaces.add(placeLower);
                }
            });
            console.log('Manual place extraction found:', foundPlaces.length);
            return foundPlaces;
        }
        
        const placeMap = new Map();
        
        places.forEach(place => {
            let normalized = normalizeEntityText(place);
            const key = normalized.toLowerCase();
            
            if (!placeMap.has(key) && normalized.length > 1) {
                placeMap.set(key, {
                    text: normalized,
                    type: 'place',
                    description: `Location mentioned in the article.`
                });
            }
        });
        
        const uniquePlaces = Array.from(placeMap.values());
        console.log('Filtered places:', uniquePlaces.length);
        return uniquePlaces;
    } catch (error) {
        console.error("Error extracting places:", error);
        return [];
    }
}

/**
 * Extract organizations from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of organization entities
 */
function extractOrganizations(doc, content) {
    try {
        const organizations = doc.organizations().out('array');
        console.log('Raw organizations extracted:', organizations);
        
        if (organizations.length === 0) {
            console.log('Compromise found no organizations, trying manual extraction...');
            // Enhanced pattern to capture full organization names
            const orgPatterns = [
                // Pattern 1: Organizations with institutional keywords
                /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6}(?:\s+(?:Institute|University|College|Corporation|Company|Organization|Organisation|Association|Department|Agency|Commission|Council|Foundation|Society|Academy|Ministry|Bureau|Center|Centre|Board|Committee|Service|Authority|Bank|Group|Trust)))\b/g,
                // Pattern 2: Acronyms (2-6 capital letters)
                /\b([A-Z]{2,6})\b/g,
                // Pattern 3: "The X of Y" pattern
                /\b(The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g
            ];
            
            const orgMap = new Map();
            
            orgPatterns.forEach(pattern => {
                const matches = content.match(pattern) || [];
                matches.forEach(org => {
                    let normalized = normalizeEntityText(org);
                    
                    // Skip if too short or just numbers
                    if (normalized.length < 3 || /^\d+$/.test(normalized)) return;
                    
                    // Skip common words that aren't organizations
                    const skipWords = ['the', 'and', 'but', 'for', 'with', 'from', 'this', 'that'];
                    if (skipWords.includes(normalized.toLowerCase())) return;
                    
                    const key = normalized.toLowerCase();
                    
                    if (!orgMap.has(key)) {
                        orgMap.set(key, {
                            text: normalized,
                            type: 'organization',
                            description: `Organization mentioned in the article.`
                        });
                    }
                });
            });
            
            const uniqueOrgs = Array.from(orgMap.values()).slice(0, 15);
            console.log('Manual org extraction found:', uniqueOrgs.length);
            return uniqueOrgs;
        }
        
        const orgMap = new Map();
        
        organizations.forEach(name => {
            let normalized = normalizeEntityText(name);
            
            // Skip if too short
            if (normalized.length < 2) {
                console.log(`Excluding org "${normalized}" - too short`);
                return;
            }
            
            const key = normalized.toLowerCase();
            
            if (!orgMap.has(key)) {
                orgMap.set(key, {
                    text: normalized,
                    type: 'organization',
                    description: `Organization mentioned in the article.`
                });
            }
        });
        
        const uniqueOrgs = Array.from(orgMap.values());
        console.log('Filtered organizations:', uniqueOrgs.length);
        return uniqueOrgs;
    } catch (error) {
        console.error("Error extracting organizations:", error);
        return [];
    }
}

/**
 * Extract key terms from the document
 * @param {Object} doc - compromise.js document
 * @param {string} content - Original article text
 * @returns {Array} List of key term entities
 */
function extractKeyTerms(doc, content) {
    try {
        const nouns = doc.nouns().not('#Person').not('#Place').not('#Organization').out('array');
        console.log('Raw nouns extracted:', nouns.length);
        
        const stopWords = new Set([
            'time', 'day', 'week', 'month', 'year', 'thing', 'people', 'person', 'man', 'woman',
            'way', 'part', 'place', 'case', 'fact', 'point', 'hand', 'number', 'group',
            'problem', 'question', 'answer', 'side', 'end', 'reason', 'result', 'change',
            'moment', 'line', 'area', 'room', 'form', 'body', 'face', 'others', 'level',
            'attempt', 'attempts', 'effort', 'efforts', 'work', 'works', 'night', 'morning',
            'evening', 'article', 'report', 'story', 'news', 'piece', 'section', 'part'
        ]);
        
        const wordFreq = {};
        nouns.forEach(noun => {
            const word = normalizeEntityText(noun).toLowerCase();
            if (word.length > 4 && !stopWords.has(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        console.log('Word frequencies calculated:', Object.keys(wordFreq).length);
        
        const sortedWords = Object.keys(wordFreq)
            .filter(word => wordFreq[word] >= 3 && word.length > 5)
            .sort((a, b) => wordFreq[b] - wordFreq[a]);
        
        console.log('Frequent substantial words:', sortedWords.slice(0, 10));
        
        const topTerms = sortedWords.slice(0, 6).map(term => {
            const displayTerm = term.charAt(0).toUpperCase() + term.slice(1);
            return {
                text: displayTerm,
                type: 'term',
                description: `Key term mentioned ${wordFreq[term]} times in the article.`
            };
        });
        
        console.log('Top terms selected:', topTerms);
        return topTerms;
    } catch (error) {
        console.error("Error extracting key terms:", error);
        return [];
    }
}

/**
 * Remove duplicate and similar entities with comprehensive logic
 * @param {Array} entities - List of entities
 * @returns {Array} Deduplicated list of entities
 */
function removeDuplicateAndSimilarEntities(entities) {
    const typePriority = { 'person': 4, 'organization': 3, 'place': 2, 'term': 1 };
    
    // Known geographic locations (not organizations)
    const knownPlaces = new Set([
        'india', 'pakistan', 'china', 'russia', 'america', 'usa', 'uk', 'japan',
        'germany', 'france', 'italy', 'spain', 'brazil', 'canada', 'australia',
        'mexico', 'argentina', 'egypt', 'turkey', 'iran', 'iraq', 'syria',
        'europe', 'asia', 'africa', 'america', 'oceania', 'antarctica',
        'delhi', 'new delhi', 'mumbai', 'karachi', 'beijing', 'tokyo', 'london', 'paris',
        'new york', 'new york city', 'los angeles', 'chicago', 'houston', 'washington',
        'moscow', 'berlin', 'rome', 'madrid', 'barcelona', 'singapore', 'dubai',
        'california', 'texas', 'florida', 'england', 'scotland', 'wales'
    ]);
    
    // Organization indicator words - if entity contains these, it's likely an organization
    const orgIndicators = [
        'institute', 'university', 'college', 'corporation', 'company', 'corp',
        'organization', 'organisation', 'association', 'department', 'agency',
        'commission', 'council', 'foundation', 'society', 'academy', 'ministry',
        'bureau', 'center', 'centre', 'board', 'committee', 'service', 'authority',
        'bank', 'group', 'trust', 'federation', 'union', 'party', 'club', 'team',
        'inc', 'ltd', 'llc', 'limited', 'international', 'national', 'global',
        'network', 'alliance', 'league', 'office', 'division', 'wing', 'branch'
    ];
    
    // Person indicator patterns
    const personTitlePatterns = [
        /^(mr|mrs|ms|miss|dr|prof|professor|sir|lord|lady|president|minister|senator|judge|justice)\b/i,
        /\b(jr|sr|ii|iii|iv|md|phd|esq)$/i
    ];

    // First pass: Intelligent reclassification based on content analysis
    entities.forEach(entity => {
        const textLower = entity.text.toLowerCase();
        const words = textLower.split(/\s+/);
        
        // Check if it contains organization indicators
        const hasOrgIndicator = orgIndicators.some(indicator => textLower.includes(indicator));
        
        // Check if it's a known place
        const isKnownPlace = knownPlaces.has(textLower);
        
        // Check if it has person title indicators
        const hasPersonTitle = personTitlePatterns.some(pattern => pattern.test(entity.text));
        
        // Reclassification logic with priority
        if (hasOrgIndicator && entity.type === 'place') {
            // Organization indicators override place classification
            entity.type = 'organization';
            entity.description = 'Organization mentioned in the article.';
            console.log(`Reclassified "${entity.text}" from place to organization (has org indicator)`);
        } else if (hasOrgIndicator && entity.type === 'person') {
            // Organization indicators override person classification
            entity.type = 'organization';
            entity.description = 'Organization mentioned in the article.';
            console.log(`Reclassified "${entity.text}" from person to organization (has org indicator)`);
        } else if (isKnownPlace && (entity.type === 'person' || entity.type === 'term')) {
            // Known places override other types
            entity.type = 'place';
            entity.description = 'Location mentioned in the article.';
            console.log(`Reclassified "${entity.text}" to place (known location)`);
        } else if (hasPersonTitle && entity.type !== 'person') {
            // Person titles indicate it's a person
            entity.type = 'person';
            entity.description = 'Person mentioned in the article.';
            console.log(`Reclassified "${entity.text}" to person (has title)`);
        } else if (entity.type === 'place' && !isKnownPlace) {
            // Additional check: multi-word "places" that aren't known locations might be orgs
            if (words.length >= 3 && !textLower.includes('city') && !textLower.includes('town') && !textLower.includes('state') && !textLower.includes('country')) {
                // Check if it looks more like an organization (capitalized multi-word entity)
                const isProperlyCapitalized = entity.text.split(/\s+/).every(word => /^[A-Z]/.test(word));
                if (isProperlyCapitalized) {
                    // Could be an organization that was misclassified as place
                    // Keep as place unless we have strong evidence it's an org
                    console.log(`Reviewing "${entity.text}" - marked as place but might be organization`);
                }
            }
        }
        
        // Additional check: Single-word all-caps entities are likely acronyms (organizations)
        if (words.length === 1 && /^[A-Z]{2,6}$/.test(entity.text) && entity.type !== 'organization') {
            entity.type = 'organization';
            entity.description = 'Organization mentioned in the article.';
            console.log(`Reclassified "${entity.text}" to organization (acronym)`);
        }
    });
    
    // Second pass: Remove duplicates and merge similar entities
    const finalEntities = [];
    
    for (let i = 0; i < entities.length; i++) {
        const currentEntity = entities[i];
        let shouldAdd = true;
        let replacementIndex = -1;
        
        // Check against all entities already in final list
        for (let j = 0; j < finalEntities.length; j++) {
            const existingEntity = finalEntities[j];
            
            if (areEntitiesSimilar(currentEntity.text, existingEntity.text)) {
                shouldAdd = false;
                
                // Decide which one to keep based on:
                // 1. Type priority (but now smarter - org indicators override)
                // 2. Length (prefer longer, more complete names)
                // 3. Capitalization quality
                
                const currentPriority = typePriority[currentEntity.type];
                const existingPriority = typePriority[existingEntity.type];
                
                let replaceExisting = false;
                
                // Special case: if types differ, prefer the one with org indicators
                if (currentEntity.type !== existingEntity.type) {
                    const currentHasOrgIndicator = orgIndicators.some(ind => 
                        currentEntity.text.toLowerCase().includes(ind)
                    );
                    const existingHasOrgIndicator = orgIndicators.some(ind => 
                        existingEntity.text.toLowerCase().includes(ind)
                    );
                    
                    if (currentHasOrgIndicator && !existingHasOrgIndicator) {
                        replaceExisting = true;
                    } else if (!currentHasOrgIndicator && existingHasOrgIndicator) {
                        replaceExisting = false;
                    } else if (currentPriority > existingPriority) {
                        replaceExisting = true;
                    }
                } else if (currentPriority > existingPriority) {
                    // Higher priority type wins
                    replaceExisting = true;
                } else if (currentPriority === existingPriority) {
                    // Same type - prefer longer and better formatted
                    if (currentEntity.text.length > existingEntity.text.length) {
                        replaceExisting = true;
                    } else if (currentEntity.text.length === existingEntity.text.length) {
                        // Prefer version with proper capitalization
                        const currentCapitalized = /^[A-Z]/.test(currentEntity.text);
                        const existingCapitalized = /^[A-Z]/.test(existingEntity.text);
                        if (currentCapitalized && !existingCapitalized) {
                            replaceExisting = true;
                        }
                    }
                }
                
                if (replaceExisting) {
                    replacementIndex = j;
                    shouldAdd = true;
                    console.log(`Replacing "${existingEntity.text}" with "${currentEntity.text}"`);
                }
                
                break;
            }
        }
        
        if (shouldAdd) {
            if (replacementIndex >= 0) {
                // Replace existing entity
                finalEntities[replacementIndex] = currentEntity;
            } else {
                // Add new entity
                finalEntities.push(currentEntity);
            }
        }
    }
    
    console.log(`Deduplication: ${entities.length} → ${finalEntities.length} entities`);
    return finalEntities;
}