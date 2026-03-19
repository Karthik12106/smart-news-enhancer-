// js/article-processor.js
/**
 * Article Processor Module
 * 
 * This module coordinates between the different NLP feature modules and handles
 * the processing pipeline for article analysis. It serves as an integration layer
 * between the UI and the individual feature modules.
 */

/**
 * Process an article URL by fetching content and analyzing it
 * @param {string} url - URL of the article to process
 * @returns {Object} Processing results
 */

/**
 * Extract main content from parsed HTML document
 * @param {Document} doc - Parsed HTML document
 * @returns {string} Extracted main content
 */
function extractMainContent(doc) {
    // Try common selectors for main article content
    const selectors = ['article', '[role="article"]', '.article-body', '.post-content', '.entry-content', 'main'];
    let mainElement = null;
    
    for (const selector of selectors) {
        mainElement = doc.querySelector(selector);
        if (mainElement) break;
    }
    
    // If no specific container found, use the body
    const targetElement = mainElement || doc.body;
    
    // Get all paragraphs within the target element
    const paragraphs = Array.from(targetElement.querySelectorAll('p'));
    
    // Filter and join paragraphs
    const content = paragraphs
        .map(p => p.textContent.trim())
        .filter(text => text.length > 20 && !text.toLowerCase().includes('copyright')) // Filter short/copyright lines
        .join('\n\n');
        
    // Fallback if paragraph extraction failed
    if (content.length < 100) {
        return doc.body.textContent.replace(/\s+/g, ' ').trim(); // Basic text extraction
    }
    
    return content;
}

/**
 * Process article text directly
 * @param {string} text - Article text to process
 * @returns {Object} Processing results
 */
async function processArticleText(text) {
    try {
        // Basic validation
        if (text.length < 100) {
            throw new Error('Pasted text is too short to be analyzed effectively.');
        }
        
        // Extract a title from the first line or use default
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const title = lines.length > 0 ? lines[0] : 'Untitled Article';
        
        // Use the rest as content
        const content = lines.length > 1 ? lines.slice(1).join('\n\n') : text;
        
        // Process the content
        return await processArticleContent(title, content, 'Direct Input');
        
    } catch (error) {
        console.error('Error processing text:', error);
        throw new Error(`Failed to process pasted text: ${error.message}`);
    }
}

/**
 * Process article content with all enhancement features
 * @param {string} title - Article title
 * @param {string} content - Article content
 * @param {string} source - Article source
 * @returns {Object} Processing results with all enhancements
 */
async function processArticleContent(title, content, source) {
    try {
        console.log('Processing article...');
        console.log('Content length:', content.length);
        
        // Check if compromise library is loaded with multiple attempts
        let attempts = 0;
        const maxAttempts = 10;
        
        while (typeof nlp === 'undefined' && attempts < maxAttempts) {
            console.log(`Waiting for NLP library... attempt ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 300));
            attempts++;
        }
        
        // If still not loaded, check for compromise in window
        if (typeof nlp === 'undefined') {
            if (typeof window.nlp !== 'undefined') {
                window.nlp = window.nlp;
                console.log('Found nlp in window object');
            } else if (typeof compromise !== 'undefined') {
                window.nlp = compromise;
                console.log('Found compromise, setting as nlp');
            } else {
                console.error('NLP library still not available after waiting');
                console.log('Window keys:', Object.keys(window).filter(k => k.toLowerCase().includes('nlp') || k.toLowerCase().includes('compromise')));
                throw new Error('NLP library (compromise.js) failed to load. Please refresh the page and try again.');
            }
        }
        
        console.log('NLP library loaded successfully');
        
        // Initialize the NLP document with compromise.js
        const doc = nlp(content);
        
        console.log('NLP doc created successfully');
        
        // Process with each enhancement module in parallel for efficiency
        console.log('Starting parallel processing...');
        const [fakeNewsResults, summaryResults, entities, contextInfo] = await Promise.all([
            detectFakeNews(doc, content, source),
            summarizeText(doc, content),
            recognizeEntities(doc, content),
            getContextInfo(doc, title, content)
        ]);
        
        console.log('Processing complete. Entities found:', entities.length);
        
        // Return combined results
        return {
            title,
            content,
            source,
            fakeNewsResults,
            summaryResults,
            entities,
            contextInfo
        };
        
    } catch (error) {
        console.error('Error in processing content:', error);
        throw error;
    }
}