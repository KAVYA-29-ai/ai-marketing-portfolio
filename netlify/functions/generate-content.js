const fetch = require("node-fetch");

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { type, data } = JSON.parse(event.body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY missing");
    }

    let prompt;
    let fallbackResponse;

    // =============================
    // PROMPT BUILDING
    // =============================
    if (type === "case-study") {
      prompt = `
Create a professional marketing case study.

Project Title: ${data.projectTitle}
Client: ${data.client}
Industry: ${data.industry}
Objectives: ${data.objectives}
Tactics Used: ${data.tactics}
Results Achieved: ${data.results}

Return JSON only in this format:
{
  "case_study": {
    "introduction": "",
    "challenge": "",
    "solution": "",
    "results": ""
  }
}
`;

      fallbackResponse = {
        case_study: {
          introduction: "",
          challenge: "",
          solution: "",
          results: "",
        },
      };
    } else if (type === "proposal") {
      prompt = `
Create a marketing proposal.

Company Name: ${data.companyName}
Business Type: ${data.businessType}
Goals: ${data.marketingGoals}
Challenges: ${data.currentChallenges}
Budget: ${data.budget}
Timeline: ${data.timeline}

Return JSON only:
{
  "proposal_outline": {
    "executive_summary": "",
    "strategy": "",
    "deliverables": "",
    "timeline_investment": "",
    "next_steps": ""
  }
}
`;

      fallbackResponse = {
        proposal_outline: {
          executive_summary: "",
          strategy: "",
          deliverables: "",
          timeline_investment: "",
          next_steps: "",
        },
      };
    } else {
      throw new Error("Invalid type");
    }

    // =============================
    // GEMINI 2.5 FLASH CALL
    // =============================
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", err);
      throw new Error("Gemini API failed");
    }

    const result = await response.json();

    const rawText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON safely
    let finalData;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      finalData = match ? JSON.parse(match[0]) : fallbackResponse;
    } catch {
      finalData = fallbackResponse;
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalData),
    };
  } catch (error) {
    console.error("ERROR:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Generation failed",
        message: error.message,
      }),
    };
  }
};
