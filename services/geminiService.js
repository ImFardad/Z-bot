const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Op } = require('sequelize');
const UserQuestionHistory = require('../db/UserQuestionHistory');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI;
let model;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    const generationConfig = { temperature: 0.9 };
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig });
  } catch (error) {
    console.error('Could not initialize Gemini AI. Please check your API key.', error);
    model = null;
  }
} else {
  console.warn('GEMINI_API_KEY is not set in .env file. Quiz feature will be disabled.');
}

async function generateZombieScenario(userId) {
  if (!model) return null;

  try {
    // 1. Clean up old scenarios for the user
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await UserQuestionHistory.destroy({
      where: {
        userId: userId,
        createdAt: {
          [Op.lt]: twentyFourHoursAgo,
        },
        type: 'zombie',
      },
    });

    // 2. Fetch recent scenarios for the user
    const recentScenarios = await UserQuestionHistory.findAll({
      where: { userId: userId, type: 'zombie' },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['question'], // Using 'question' field to store the scenario
    });
    const recentScenarioList = recentScenarios.map(item => `- ${item.question}`).join('\n');

    // 3. Create the dynamic prompt
    const prompt = `You are a zombie apocalypse scenario generator. Your job is to create a single, realistic survival scenario in Persian that requires a creative but practical solution. The goal is to test the user's real-world survival skills and resourcefulness, not their ability to write a science fiction story.\n\nFollow these rules STRICTLY:\n1.  **Focus on Realism:** The scenario must be grounded in reality. The user should solve the problem with plausible actions and everyday objects. Avoid any sci-fi or fantasy elements.\n2.  **Test Survival Skills:** The problem should be a common survival challenge, such as finding food/water, creating shelter, navigating a dangerous area, first aid, or repairing essential gear.\n3.  **Require Creativity:** The situation should be complex enough that a simple, obvious answer isn't the best one. It should encourage the user to think outside the box.\n4.  **Formatting:** Structure the scenario into at least two paragraphs. Use clear sections like "Situation" and "Challenge". For example: \n\n**موقعیت:** [شرح وضعیت] \n\n**چالش:** [شرح مشکل اصلی]. Your response MUST contain ONLY the scenario text itself. Do NOT include any introductory text, hints, or potential solutions.\n5.  **Avoid Repetition:** DO NOT repeat any of the following scenarios that have been presented recently:\n${recentScenarioList.length > 0 ? recentScenarioList : '(No recent scenarios)'}\n\nExample of a GOOD scenario: "You are in a small library. Your only cutting tool, a knife, just broke. Outside, a horde of zombies is gathering. You need to barricade the weak back door, but the only materials you have are books, shelves, and a librarian's trolley. How do you create a strong barricade?"\n\nExample of a BAD scenario: "You find a mysterious glowing artifact. How do you use its power to defeat the zombies?"\n\nNow, generate a new, unique, and realistic survival scenario.`;

    // 4. Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text.trim();

  } catch (error) {
    console.error('Error in generateZombieScenario function:', error);
    return null;
  }
}

async function evaluateZombieSolution(scenario, userAnswer) {
  if (!model) return null;

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Clean the response to ensure it's a valid JSON
    text = text.replace(/```json/g, '').replace(/```/g, '');

    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      console.error('Failed to parse JSON from Gemini evaluation:', text, e);
      return null; // Or a default error object
    }

  } catch (error) {
    console.error('Error evaluating zombie solution with Gemini:', error);
    return null;
  }
}


module.exports = {
  generateZombieScenario,
  evaluateZombieSolution,
  isEnabled: !!model,
};