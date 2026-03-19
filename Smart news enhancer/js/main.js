// js/main.js
/**
 * Main JavaScript file for News Enhancer Website
 * Handles UI interactions and coordinates between modules
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('News Enhancer initialized');
    
    // Initialize form handlers
    initFormHandlers();
    
    // Initialize UI interaction handlers
    initUIHandlers();
});

/**
 * Initialize form submission handlers
 */
function initFormHandlers() {
    
    // Text form submission
    const textForm = document.getElementById('text-form');
    const articleText = document.getElementById('article-text');
    
    if (textForm && articleText) {
        // Handle Enter key to submit (removed Ctrl requirement)
        articleText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textForm.dispatchEvent(new Event('submit'));
            }
        });
        
        textForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const textInput = document.getElementById('article-text');
            if (!textInput) return;
            
            const text = textInput.value.trim();
            
            if (text) {
                try {
                    showLoading(true);
                    const results = await processArticleText(text);
                    displayResults(results);
                } catch (error) {
                    showError(error.message);
                } finally {
                    showLoading(false);
                }
            }
        });
    }
    
    // Clear button handler
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn && articleText) {
        clearBtn.addEventListener('click', () => {
            articleText.value = '';
            articleText.focus();
            
            // Hide results section if visible
            const resultsSection = document.getElementById('results-section');
            if (resultsSection && !resultsSection.classList.contains('d-none')) {
                resultsSection.classList.add('d-none');
            }
        });
    }
}

/**
 * Initialize UI interaction handlers
 */
function initUIHandlers() {
    // Toggle annotations visibility
    const toggleAnnotations = document.getElementById('toggle-annotations');
    if (toggleAnnotations) {
        toggleAnnotations.addEventListener('change', () => {
            const articleContent = document.getElementById('article-content');
            if (articleContent) {
                if (toggleAnnotations.checked) {
                    articleContent.classList.remove('hide-annotations');
                } else {
                    articleContent.classList.add('hide-annotations');
                }
            }
        });
    }
    
    // Summary length radio buttons
    const summaryRadios = document.querySelectorAll('input[name="summary-length"]');
    summaryRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const length = e.target.id.replace('summary-', '');
                await updateSummaryLength(length);
            }
        });
    });
}

/**
 * Display all processing results in the UI
 * @param {Object} results - Combined results from all modules
 */
function displayResults(results) {
    // Display the analysis results
    displaySummary(results.summaryResults);
    displayFakeNewsResults(results.fakeNewsResults);
    displayContext(results.contextInfo);
    displayEntities(results.entities);

    // Show the results section
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
        resultsSection.classList.remove('d-none');
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Display the original article with title and source
 * @param {string} title - Article title
 * @param {string} content - Article content
 * @param {string} source - Article source
 */
function displayArticle(title, content, source) {
    const titleElement = document.getElementById('article-title');
    const sourceElement = document.getElementById('article-source');
    const contentElement = document.getElementById('article-content');
    
    if (titleElement) titleElement.textContent = title;
    if (sourceElement) sourceElement.textContent = `Source: ${source}`;
    if (contentElement) {
        // Split into paragraphs and create paragraph elements
        const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
        contentElement.innerHTML = paragraphs
            .map(p => `<p>${escapeHTML(p)}</p>`)
            .join('');
    }
}

/**
 * Display fake news detection results
 * @param {Object} results - Fake news detection results
 */
function displayFakeNewsResults(results) {
    const container = document.getElementById('fakeness-content');
    if (!container) return;
    
    let levelClass = '';
    switch (results.level) {
        case 'low':
            levelClass = 'analysis-low';
            break;
        case 'medium':
            levelClass = 'analysis-medium';
            break;
        case 'high':
            levelClass = 'analysis-high';
            break;
    }
    
    container.innerHTML = `
        <div class="analysis-result ${levelClass}">
            <h5>Analysis Result: ${escapeHTML(results.rating)}</h5>
            <p>${escapeHTML(results.explanation)}</p>
            <div class="mt-3">
                <h6>Detected Patterns:</h6>
                <ul>
                    ${results.metrics.map(metric => `<li>${escapeHTML(metric.name)}: ${escapeHTML(metric.value)} ${escapeHTML(metric.unit)}</li>`).join('')}
                </ul>
            </div>
            <p class="disclaimer">Note: This analysis is based on linguistic patterns only and is not a definitive fact-check.</p>
        </div>
    `;
}

/**
 * Display summary results
 * @param {Object} results - Summary results with different lengths
 */
function displaySummary(results) {
    const container = document.getElementById('summary-content');
    if (!container) return;
    
    // Store the original content and doc for regenerating summaries
    window.currentArticleDoc = results.doc;
    window.currentArticleContent = results.content;
    
    // Display medium summary by default (the only one initially generated)
    container.innerHTML = `<p>${escapeHTML(results.medium)}</p>`;
    
    // Make sure medium is selected by default
    const mediumRadio = document.getElementById('summary-medium');
    if (mediumRadio) {
        mediumRadio.checked = true;
    }
}

/**
 * Update summary based on selected length
 * @param {string} length - Summary length (short, medium, long)
 */
async function updateSummaryLength(length) {
    const container = document.getElementById('summary-content');
    if (!container || !window.currentArticleDoc || !window.currentArticleContent) return;
    
    // Show loading indicator for summary
    container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Generating new summary...</div>';
    
    try {
        // Check if the global function is available
        if (typeof window.generateSummaryForType !== 'function') {
            throw new Error('Summary generation function not available');
        }
        
        // Generate a fresh summary for the selected type
        const newSummary = await window.generateSummaryForType(window.currentArticleDoc, window.currentArticleContent, length);
        container.innerHTML = `<p>${escapeHTML(newSummary)}</p>`;
    } catch (error) {
        console.error('Error generating summary:', error);
        container.innerHTML = '<p>Error generating summary. Please try again.</p>';
    }
}

/**
 * Display entity recognition results
 * @param {Array} entities - Recognized entities
 */
function displayEntities(entities) {
    const container = document.getElementById('entities-content');
    if (!container) return;
    
    // Group entities by type (exclude 'term' type)
    const groupedEntities = {
        person: entities.filter(e => e.type === 'person'),
        place: entities.filter(e => e.type === 'place'),
        organization: entities.filter(e => e.type === 'organization')
    };
    
    // Create HTML for each entity type (excluding terms)
    let html = '';
    
    if (groupedEntities.person.length > 0) {
        html += `
            <h6>People</h6>
            <div class="mb-3">
                ${groupedEntities.person.map(e => 
                    `<span class="entity-tag entity-tag-person">${escapeHTML(e.text)}</span>`
                ).join('')}
            </div>
        `;
    }
    
    if (groupedEntities.place.length > 0) {
        html += `
            <h6>Places</h6>
            <div class="mb-3">
                ${groupedEntities.place.map(e => 
                    `<span class="entity-tag entity-tag-place">${escapeHTML(e.text)}</span>`
                ).join('')}
            </div>
        `;
    }
    
    if (groupedEntities.organization.length > 0) {
        html += `
            <h6>Organizations</h6>
            <div class="mb-3">
                ${groupedEntities.organization.map(e => 
                    `<span class="entity-tag entity-tag-organization">${escapeHTML(e.text)}</span>`
                ).join('')}
            </div>
        `;
    }
    
    if (html === '') {
        html = '<p>No significant entities detected in this article.</p>';
    }
    
    container.innerHTML = html;
    
    // Also annotate entities in the original article (all types including terms for highlighting)
    annotateEntitiesInArticle(entities);
}

/**
 * Annotate entities in the original article
 * @param {Array} entities - List of entities to annotate
 */
function annotateEntitiesInArticle(entities) {
    const articleContent = document.getElementById('article-content');
    if (!articleContent) return;
    
    // Get all paragraph elements
    const paragraphs = articleContent.querySelectorAll('p');
    
    // Process each paragraph
    paragraphs.forEach(paragraph => {
        let originalHTML = paragraph.innerHTML;
        let annotatedHTML = originalHTML;
        
        // Sort entities by length (descending) to handle nested entities
        const sortedEntities = [...entities].sort((a, b) => 
            b.text.length - a.text.length
        );
        
        // Replace entity mentions with annotated spans
        sortedEntities.forEach(entity => {
            // Use a regex that avoids matching inside HTML tags
            const regex = new RegExp(`(?<!<[^>]*)\b${escapeRegExp(entity.text)}\b(?![^<]*>)`, 'gi');
            annotatedHTML = annotatedHTML.replace(regex, match => {
                return `<span class="entity entity-${entity.type}" data-entity-id="${entity.id}">
                    ${escapeHTML(match)}
                    <div class="entity-tooltip">
                        <strong>${escapeHTML(match)}</strong> (${formatEntityType(entity.type)})
                        ${entity.description ? `<br>${escapeHTML(entity.description)}` : ''}
                    </div>
                </span>`;
            });
        });
        
        // Update the paragraph HTML only if changes were made
        if (annotatedHTML !== originalHTML) {
            paragraph.innerHTML = annotatedHTML;
        }
    });
}

/**
 * Display context/backstory information
 * @param {Object} contextInfo - Context information
 */
function displayContext(contextInfo) {
    const container = document.getElementById('context-content');
    if (!container) return;
    
    if (contextInfo.found) {
        container.innerHTML = `
            <h5>${escapeHTML(contextInfo.title)}</h5>
            <p>${escapeHTML(contextInfo.extract)}</p>
            ${contextInfo.url ? `<p><a href="${escapeHTML(contextInfo.url)}" target="_blank" rel="noopener">Read more on Wikipedia</a></p>` : ''}
        `;
    } else {
        container.innerHTML = `
            <p>${escapeHTML(contextInfo.message || 'No specific context information found.')}</p>
            <p>Try clicking on highlighted entities in the article for more information.</p>
        `;
    }
}

/**
 * Show or hide loading indicator
 * @param {boolean} isLoading - Whether to show or hide loading
 */
function showLoading(isLoading) {
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    
    if (loadingIndicator) {
        if (isLoading) {
            loadingIndicator.classList.remove('d-none');
        } else {
            loadingIndicator.classList.add('d-none');
        }
    }
    
    if (resultsSection && isLoading) {
        resultsSection.classList.add('d-none');
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert.alert-danger');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${escapeHTML(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insert at the top of the main content
    const mainContent = document.querySelector('main.container');
    if (mainContent) {
        mainContent.insertBefore(alertDiv, mainContent.firstChild);
    }
    
    // Hide loading indicator
    showLoading(false);
    
    // Auto-dismiss after 7 seconds
    setTimeout(() => {
        const currentAlert = document.querySelector('.alert.alert-danger');
        if (currentAlert) {
            const bsAlert = new bootstrap.Alert(currentAlert);
            bsAlert.close();
        }
    }, 7000);
}

/**
 * Format entity type for display
 * @param {string} type - Entity type
 * @returns {string} Formatted entity type
 */
function formatEntityType(type) {
    switch (type) {
        case 'person': return 'Person';
        case 'place': return 'Place';
        case 'organization': return 'Organization';
        case 'term': return 'Term';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
}

/**
 * Escape special characters in string for use in RegExp
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML characters to prevent XSS
 * @param {string} unsafe - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}