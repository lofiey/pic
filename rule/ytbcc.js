/*
 * YouTube Subtitle Translation Script for Quantumult X
 *
 * This script intercepts YouTube's subtitle data, translates the text
 * to a specified language, and returns the modified subtitle file.
 *
 * Author: Gemini
 * Version: 1.0
 * Last Updated: 2025-10-02
 *
 * How to use:
 * 1. Create this script locally in Quantumult X.
 * 2. Add a rewrite rule:
 * ^https?:\/\/www\.youtube\.com\/api\/timedtext url script-response-body yt_translate.js
 * 3. Make sure MitM for www.youtube.com is enabled.
 */

// ========== CONFIGURATION ==========
// Set your desired target language here.
// Common codes:
// "zh-CN" for Simplified Chinese
// "zh-TW" for Traditional Chinese
// "en" for English
// "ja" for Japanese
const TARGET_LANGUAGE = "zh-CN";
// ===================================


// Main function to execute the translation logic
async function translateSubtitles() {
    // Check if the response body exists
    if (!$response.body) {
        console.log("YouTube Subtitle: No response body found. Aborting.");
        $done({});
        return;
    }

    try {
        // The original body is XML content in string format
        let originalBody = $response.body;

        // Extract all text nodes from the XML.
        // YouTube subtitles use <p> tags for each line.
        // Example: <p t="1000" d="2500">Hello world</p>
        const textNodes = originalBody.match(/<p.*?>(.*?)<\/p>/gs);

        if (!textNodes || textNodes.length === 0) {
            console.log("YouTube Subtitle: No text nodes found to translate.");
            $done({ body: originalBody }); // Return original body if no text
            return;
        }

        // Extract the actual text content from the nodes
        // Also, decode XML entities like &amp;, &lt;, etc.
        const originalTexts = textNodes.map(node => {
            let text = node.replace(/<p.*?>/s, "").replace(/<\/p>/s, "");
            return decodeXmlEntities(text);
        });

        // Join texts with a unique separator for a single API call to improve efficiency
        const separator = "\n|||\n";
        const combinedText = originalTexts.join(separator);

        // Call the translation service
        const translatedCombinedText = await translate(combinedText, TARGET_LANGUAGE);
        
        if (!translatedCombinedText) {
             throw new Error("Translation API returned empty content.");
        }

        const translatedTexts = translatedCombinedText.split(separator.trim());

        // Ensure we got the same number of lines back
        if (originalTexts.length !== translatedTexts.length) {
            throw new Error(`Translation line count mismatch. Original: ${originalTexts.length}, Translated: ${translatedTexts.length}`);
        }

        // Replace original texts with translated texts
        let index = 0;
        let newBody = originalBody.replace(/<p.*?>(.*?)<\/p>/gs, (match) => {
            const translatedText = translatedTexts[index] ? encodeXmlEntities(translatedTexts[index]) : '';
            index++;
            // Preserve the original <p> tag with its attributes (like timecodes)
            return match.replace(/>.*?</s, `>${translatedText}<`);
        });

        console.log(`YouTube Subtitle: Successfully translated ${index} lines to ${TARGET_LANGUAGE}.`);
        $done({ body: newBody });

    } catch (error) {
        console.error("YouTube Subtitle Script Error: " + error.message);
        $done({}); // On error, return the original response to avoid breaking subtitles
    }
}

// Function to call a free Google Translate API
function translate(text, targetLang) {
    return new Promise((resolve, reject) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        $httpClient.get(url, (err, response, data) => {
            if (err) {
                return reject(new Error("HTTP request failed: " + err));
            }
            try {
                const json = JSON.parse(data);
                // Extract translated text from the complex JSON structure
                const translatedText = json[0].map(item => item[0]).join('');
                resolve(translatedText);
            } catch (e) {
                reject(new Error("Failed to parse translation API response."));
            }
        });
    });
}

// Helper functions for handling XML special characters
function encodeXmlEntities(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
}

function decodeXmlEntities(text) {
    return text.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&apos;/g, "'");
}


// Execute the main function
translateSubtitles();
