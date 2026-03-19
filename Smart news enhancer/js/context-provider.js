// js/context-provider.js
/**
 * Context Provider Module
 * 
 * This module retrieves contextual information and backstory for the main topics
 * in an article using the Wikipedia API.
 */

/**
 * Get contextual information for the main topic of the article
 * @param {Object} doc - compromise.js document
 * @param {string} title - Article title
 * @param {string} content - Article content
 * @returns {Object} Context information
 */
async function getContextInfo(doc, title, content) {
    try {
        console.log('Retrieving context information...');
        
        const mainTopic = identifyMainTopic(doc, title, content);
        
        if (!mainTopic) {
            return {
                found: false,
                message: 'Could not identify a clear main topic for this article.'
            };
        }
        
        console.log('Main topic identified:', mainTopic);
        
        const contextInfo = await fetchWikipediaInfo(mainTopic, content);
        
        return contextInfo;
        
    } catch (error) {
        console.error('Error getting context information:', error);
        return {
            found: false,
            message: 'Error retrieving context information.'
        };
    }
}

/**
 * Identify the main topic of the article
 * @param {Object} doc - compromise.js document
 * @param {string} title - Article title
 * @param {string} content - Article content
 * @returns {string|null} Main topic or null if not found
 */
function identifyMainTopic(doc, title, content) {
    try {
        const genericLocations = ['india', 'pakistan', 'china', 'america', 'usa', 'russia', 'uk', 'europe', 'asia', 'africa', 'world'];
        const genericWords = ['today', 'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'week', 'month', 'year', 'day', 'night', 'morning', 'evening', 'time', 'article', 'report', 'news'];
        
        const people = doc.people().out('array');
        const places = doc.places().out('array');
        const organizations = doc.organizations().out('array');
        
        const entityCounts = {};
        
        organizations.forEach(entityText => {
            const name = entityText.trim();
            const nameLower = name.toLowerCase();
            if (name.length > 2 && name.split(' ').length < 6 && !genericWords.includes(nameLower)) {
                const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const occurrences = (content.match(regex) || []).length;
                if (occurrences >= 1) {
                    entityCounts[name] = (entityCounts[name] || 0) + (occurrences * 5);
                }
            }
        });
        
        people.forEach(entityText => {
            const name = entityText.trim();
            const nameLower = name.toLowerCase();
            if (name.length > 2 && name.split(' ').length >= 2 && name.split(' ').length < 4 && !genericWords.includes(nameLower)) {
                const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const occurrences = (content.match(regex) || []).length;
                if (occurrences >= 1) {
                    entityCounts[name] = (entityCounts[name] || 0) + (occurrences * 4);
                }
            }
        });
        
        places.forEach(entityText => {
            const name = entityText.trim();
            const nameLower = name.toLowerCase();
            if (name.length > 2 && !genericLocations.includes(nameLower) && !genericWords.includes(nameLower)) {
                const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const occurrences = (content.match(regex) || []).length;
                if (occurrences >= 2) {
                    entityCounts[name] = (entityCounts[name] || 0) + (occurrences * 2);
                }
            }
        });
        
        const titleCleaned = title.replace(/[^\w\s]/g, ' ').trim();
        const titleWords = titleCleaned.split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
        
        for (let len = 5; len >= 2; len--) {
            for (let i = 0; i <= titleWords.length - len; i++) {
                const phrase = titleWords.slice(i, i + len).join(' ');
                const phraseLower = phrase.toLowerCase();
                
                if (genericLocations.includes(phraseLower) || genericWords.includes(phraseLower)) continue;
                
                const commonWords = ['and', 'the', 'but', 'for', 'with', 'from', 'about', 'after', 'before'];
                if (phrase.split(' ').every(w => commonWords.includes(w.toLowerCase()))) continue;
                
                const phraseRegex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = (content.match(phraseRegex) || []).length;
                
                if (matches >= 1) {
                    entityCounts[phrase] = (entityCounts[phrase] || 0) + (matches * 6);
                }
            }
        }
        
        const sortedEntities = Object.keys(entityCounts)
            .filter(entity => entityCounts[entity] >= 4)
            .sort((a, b) => entityCounts[b] - entityCounts[a]);
        
        console.log('Entity counts:', entityCounts);
        console.log('Top candidates:', sortedEntities.slice(0, 5));
        
        if (sortedEntities.length > 0) {
            const multiWordTopics = sortedEntities.filter(e => e.split(' ').length >= 2);
            if (multiWordTopics.length > 0) {
                console.log('Selected multi-word topic:', multiWordTopics[0]);
                return multiWordTopics[0];
            }
            console.log('Selected single-word topic:', sortedEntities[0]);
            return sortedEntities[0];
        }
        
        console.log('No topic found with sufficient occurrences');
        return null;
    } catch (error) {
        console.error("Error identifying main topic:", error);
        return null;
    }
}

/**
 * Fetch information about a topic from Wikipedia
 * @param {string} topic - Topic to search for
 * @param {string} content - Article content for context
 * @returns {Object} Wikipedia information
 */
async function fetchWikipediaInfo(topic, content) {
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*&srlimit=5`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`Wikipedia search failed with status ${searchResponse.status}`);
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
            return {
                found: false,
                message: `No Wikipedia information found for "${topic}".`
            };
        }
        
        const searchResults = searchData.query.search;
        console.log('Search results:', searchResults.map(r => r.title));
        
        let bestMatch = null;
        
        if (searchResults.length > 1) {
            bestMatch = selectBestMatch(searchResults, content, topic);
        } else {
            bestMatch = searchResults[0].title;
        }
        
        if (!bestMatch) {
            bestMatch = searchResults[0].title;
        }
        
        console.log('Selected best match:', bestMatch);
        
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch.replace(/ /g, '_'))}`;
        
        const summaryResponse = await fetch(summaryUrl, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!summaryResponse.ok) {
            return {
                found: false,
                message: `Could not fetch details for "${bestMatch}".`
            };
        }
        
        const data = await summaryResponse.json();
        
        if (data.type === 'disambiguation') {
            console.log(`${bestMatch} is a disambiguation page`);
            return {
                found: false,
                message: `"${topic}" has multiple meanings. Could not determine the specific context.`
            };
        }
        
        const extractLower = data.extract.toLowerCase();
        const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        let relevanceScore = 0;
        topicWords.forEach(word => {
            if (extractLower.includes(word)) {
                relevanceScore++;
            }
        });
        
        const relevanceRatio = topicWords.length > 0 ? relevanceScore / topicWords.length : 0;
        console.log(`Wikipedia extract validated (${(relevanceRatio * 100).toFixed(0)}% relevance)`);
        
        return {
            found: true,
            title: data.title,
            extract: data.extract,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
            thumbnail: data.thumbnail?.source
        };
        
    } catch (error) {
        console.error('Error fetching from Wikipedia:', error);
        return {
            found: false,
            message: 'Error retrieving context information from Wikipedia.'
        };
    }
}

/**
 * Select the best matching Wikipedia result
 * @param {Array} searchResults - Wikipedia search results
 * @param {string} content - Article content
 * @param {string} topic - Original topic query
 * @returns {string} Best matching title
 */
function selectBestMatch(searchResults, content, topic) {
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    const scoredResults = searchResults.map(result => {
        let score = 0;
        const titleLower = result.title.toLowerCase();
        const snippetLower = result.snippet.toLowerCase().replace(/<[^>]*>/g, '');
        
        if (titleLower === topicLower) {
            score += 50;
        } else if (titleLower.includes(topicLower) || topicLower.includes(titleLower)) {
            score += 30;
        }
        
        const titleWords = titleLower.split(/\s+/).filter(w => w.length > 3);
        let titleWordMatches = 0;
        titleWords.forEach(word => {
            if (contentLower.includes(word)) {
                titleWordMatches++;
                score += 3;
            }
        });
        
        const titleMatchRatio = titleWords.length > 0 ? titleWordMatches / titleWords.length : 0;
        if (titleMatchRatio < 0.3) {
            score -= 15;
        }
        
        const snippetWords = snippetLower.split(/\s+/).filter(w => w.length > 4);
        let snippetMatches = 0;
        snippetWords.slice(0, 15).forEach(word => {
            if (contentLower.includes(word)) {
                snippetMatches++;
                score += 1;
            }
        });
        
        const snippetMatchRatio = snippetWords.length > 0 ? snippetMatches / Math.min(15, snippetWords.length) : 0;
        if (snippetMatchRatio < 0.15) {
            score -= 5;
        }
        
        if (result.title.match(/^[A-Z]/)) {
            score += 2;
        }
        
        if (result.title.length > 60) {
            score -= 5;
        }
        
        if (result.title.length < 10 && titleLower !== topicLower) {
            score -= 5;
        }
        
        if (contentLower.includes(titleLower)) {
            score += 15;
        }
        
        if (result.title.match(/\(disambiguation\)/i)) {
            score -= 100;
        }
        
        if (result.title.match(/\d{4}/)) {
            score -= 3;
        }
        
        console.log(`Score for "${result.title}": ${score}`);
        
        return {
            title: result.title,
            score: score
        };
    });
    
    scoredResults.sort((a, b) => b.score - a.score);
    
    if (scoredResults[0].score >= 5) {
        console.log(`Selected: "${scoredResults[0].title}" with score ${scoredResults[0].score}`);
        return scoredResults[0].title;
    }
    
    console.log('Using first result despite low score');
    return scoredResults[0].title;
}