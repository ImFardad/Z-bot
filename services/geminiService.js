const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Op } = require('sequelize');
const UserQuestionHistory = require('../db/UserQuestionHistory');
require('dotenv').config();

// --- API Key Rotation Setup ---
let apiKeys = [];
let currentApiKeyIndex = 0;
let allKeysExhausted = false;
let genAI;
let model;

// Define the model name from environment variables or use a default
const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash';

// Initialize API keys and the first model instance
const keysString = process.env.GEMINI_API_KEYS;
if (keysString) {
  apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k);
  if (apiKeys.length > 0) {
    console.log(`Loaded ${apiKeys.length} Gemini API key(s).`);
    try {
      genAI = new GoogleGenerativeAI(apiKeys[currentApiKeyIndex]);
      const generationConfig = { temperature: 0.9 };
      // The user mentioned they fixed the issue with this model name
      model = genAI.getGenerativeModel({ model: modelName, generationConfig });
    } catch (error) {
      console.error(`Could not initialize Gemini AI with key at index ${currentApiKeyIndex}.`, error);
      model = null;
    }
  } else {
    console.warn('GEMINI_API_KEYS was found in .env, but it contains no keys.');
    model = null;
  }
} else {
  console.warn('GEMINI_API_KEYS is not set in .env file. Gemini features will be disabled.');
  model = null;
}

/**
 * A wrapper for model.generateContent that handles API key rotation.
 * @param {string} prompt The prompt to send to the model.
 * @returns {Promise<string|null>} The generated text or null if all keys are exhausted.
 */
async function generateWithRotation(prompt) {
  if (allKeysExhausted || !model) {
    console.error('Aborting generation: All API keys are exhausted or model is not initialized.');
    return null;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // Check for quota error (429 is the standard code, but check message for 'quota' as a fallback)
    if (error.status === 429 || (error.message && error.message.toLowerCase().includes('quota'))) {
      console.warn(`API key at index ${currentApiKeyIndex} is exhausted or rate-limited.`);
      currentApiKeyIndex++;

      if (currentApiKeyIndex >= apiKeys.length) {
        console.error('All available Gemini API keys have been exhausted.');
        allKeysExhausted = true;
        return null;
      }

      // Switch to the next key
      console.log(`Switching to API key at index ${currentApiKeyIndex}.`);
      try {
        genAI = new GoogleGenerativeAI(apiKeys[currentApiKeyIndex]);
        const generationConfig = { temperature: 0.9 };
        model = genAI.getGenerativeModel({ model: modelName, generationConfig });
        
        // Retry the request with the new key
        return generateWithRotation(prompt);
      } catch (initError) {
        console.error(`Failed to initialize Gemini with new key at index ${currentApiKeyIndex}.`, initError);
        // Try the next key in the list
        return generateWithRotation(prompt); // This recursive call will handle further key switching
      }
    } else {
      // It's a different, unexpected error
      console.error('An unexpected error occurred during Gemini content generation:', error);
      throw error; // Re-throw for the calling function to handle
    }
  }
}


async function generateZombieScenario(userId) {
  if (allKeysExhausted || !model) return null;

  try {
    const historyLimit = parseInt(process.env.SCENARIO_HISTORY_LIMIT, 10) || 5;

    // 1. Clean up scenarios older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await UserQuestionHistory.destroy({
      where: {
        userId: userId,
        createdAt: { [Op.lt]: twentyFourHoursAgo },
        type: 'zombie',
      },
    });

    // 2. Fetch recent scenarios to avoid repetition
    const recentScenarios = await UserQuestionHistory.findAll({
      where: { userId: userId, type: 'zombie' },
      order: [['createdAt', 'DESC']],
      limit: historyLimit,
      attributes: ['question'],
    });
    const recentScenarioList = recentScenarios.map(item => `- ${item.question}`).join('\n');

    // 3. Create the new, improved dynamic prompt
    const prompt = `You are a creative and unforgiving survival simulation master. Your goal is to generate a unique, realistic, and thought-provoking survival scenario in a post-apocalyptic zombie world. The scenario must test the user's problem-solving skills, resourcefulness, and ethical decision-making.\n\n**Your Thought Process (Follow these steps):**\n1.  **Choose a Core Survival Theme:** Pick one theme from the following list. Do NOT always default to simple scarcity (like lack of water/food).\n    *   **Technical/Mechanical Failure:** A crucial piece of gear breaks (vehicle, generator, water purifier, weapon).\n    *   **Environmental Hazard:** A natural disaster occurs (flash flood, fire, extreme cold), complicated by the presence of zombies.\n    *   **Social/Ethical Dilemma:** The user encounters other survivors, leading to a difficult choice (e.g., share limited resources, trust a stranger, deal with a conflict within their group).\n    *   **Medical Emergency:** The user or an ally is injured or sick, requiring immediate and improvised medical attention.\n    *   **Stealth/Infiltration:** The user needs to get something from a heavily infested area without being detected.\n    *   **Fortification/Defense:** The user's current safe spot is about to be overrun, and they need to creatively reinforce it or escape.\n\n2.  **Establish the Context:** Briefly describe the user's location and immediate situation. Make it specific (e.g., "a half-flooded subway station," "the rooftop of a hospital," "a dense, foggy forest").\n\n3.  **Create the Challenge:** Based on the chosen theme and context, present a clear, urgent problem. The solution should not be obvious.\n\n**Strict Output Rules:**\n-   The scenario must be in Persian.\n-   Structure the output into two sections: **موقعیت:** (Situation) and **چالش:** (Challenge).\n-   Your response MUST contain ONLY the scenario text itself. No pre-amble, no hints, no solutions.\n-   **CRITICAL:** Do NOT generate a scenario similar to these recent ones:\n    ${recentScenarioList.length > 0 ? recentScenarioList : '(No recent scenarios)'}\n\nNow, execute your thought process and generate the scenario.`;

    // 4. Generate content using the rotation helper
    const text = await generateWithRotation(prompt);
    
    if (!text) {
      return null; // All keys exhausted or other generation error
    }

    const newScenario = text.trim();

    // 5. Save the new scenario to history
    await UserQuestionHistory.create({
      question: newScenario,
      userId: userId,
      type: 'zombie',
    });

    // 6. Prune old scenarios, keeping only the newest ones up to the limit
    try {
      const userScenarios = await UserQuestionHistory.findAll({
          where: { userId: userId, type: 'zombie' },
          order: [['createdAt', 'DESC']],
          attributes: ['id']
      });

      if (userScenarios.length > historyLimit) {
          const idsToDelete = userScenarios.slice(historyLimit).map(s => s.id);
          await UserQuestionHistory.destroy({
              where: {
                  id: {
                      [Op.in]: idsToDelete
                  }
              }
          });
          console.log(`Pruned ${idsToDelete.length} old scenarios for user ${userId}.`);
      }
    } catch (pruneError) {
        console.error('Error pruning old scenarios:', pruneError);
    }

    return newScenario;

  } catch (error) {
    console.error('Error in generateZombieScenario function:', error);
    return null;
  }
}

async function evaluateZombieSolution(scenario, userAnswer) {
  if (allKeysExhausted || !model) return null;

  const prompt = `You are an AI assistant for evaluating survival solutions in a zombie apocalypse. The user was given a scenario and provided a solution. Your task is to analyze their solution and return a JSON object with scores for various criteria.

Follow these rules STRICTLY:
1.  Your response MUST be a single, valid JSON object and nothing else.
2.  The JSON object must contain the following keys: "practicality", "creativity", "efficiency", "speed", "risk_assessment".
3.  Each key must have a value which is an integer between 0 and 100.
4.  Provide a brief, one-sentence "feedback" in Persian inside the JSON object.

JSON Structure:
{
  "practicality": <score_0_to_100>,
  "creativity": <score_0_to_100>,
  "efficiency": <score_0_to_100>,
  "speed": <score_0_to_100>,
  "risk_assessment": <score_0_to_100>,
  "feedback": "<one_sentence_feedback_in_persian>"
}

Scenario: "${scenario}"
User's Solution: "${userAnswer}"

Now, evaluate the user's solution and provide the JSON response.`;

  try {
    const text = await generateWithRotation(prompt);
    if (!text) return null; // All keys exhausted

    // Clean the response to ensure it's a valid JSON
    const cleanedText = text.trim().replace(/```json/g, '').replace(/```/g, '');

    try {
      const parsed = JSON.parse(cleanedText);
      return parsed;
    } catch (e) {
      console.error('Failed to parse JSON from Gemini evaluation:', cleanedText, e);
      return null;
    }

  } catch (error) {
    console.error('Error evaluating zombie solution with Gemini:', error);
    return null;
  }
}

module.exports = {
  generateZombieScenario,
  evaluateZombieSolution,
  // A way for handlers to know if the service is disabled
  isEnabled: () => !allKeysExhausted && model,
};
