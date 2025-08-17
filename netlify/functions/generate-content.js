// netlify/functions/generate-content.js
const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  // Handle CORS preflight
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

  // Only POST allowed
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { type, data } = JSON.parse(event.body || "{}");

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Google API key not configured" }),
      };
    }

    let prompt, responseStructure;

    if (type === "case-study") {
      prompt = `Create a professional marketing case study based on this info:

Project Title: ${data.projectTitle}
Client: ${data.client}
Industry: ${data.industry}
Objectives: ${data.objectives}
Tactics Used: ${data.tactics}
Results Achieved: ${data.results}

Sections needed:
1. Introduction (2–3 sentences)
2. Challenge (2–3 sentences)
3. Solution (2–3 sentences)
4. Results (2–3 sentences)

Respond ONLY in JSON with this structure:
{
  "case_study": {
    "introduction": "",
    "challenge": "",
    "solution": "",
    "results": ""
  }
}`;
      responseStructure = {
        case_study: {
          introduction: "",
          challenge: "",
          solution: "",
          results: "",
        },
      };
    } else if (type === "proposal") {
      prompt = `Create a marketing proposal outline based on this info:

Company Name: ${data.companyName}
Business Type: ${data.businessType}
Marketing Goals: ${data.marketingGoals}
Current Challenges: ${data.currentChallenges}
Budget Range: ${data.budget}
Timeline: ${data.timeline}

Sections needed:
1. Executive Summary
2. Recommended Strategy
3. Key Deliverables
4. Timeline & Investment
5. Next Steps

Respond ONLY in JSON with this structure:
{
  "proposal_outline": {
    "executive_summary": "",
    "strategy": "",
    "deliverables": "",
    "timeline_investment": "",
    "next_steps": ""
  }
}`;
      responseStructure = {
        proposal_outline: {
          executive_summary: "",
          strategy: "",
          deliverables: "",
          timeline_investment: "",
          next_steps: "",
        },
      };
    } else {
      throw new Error("Invalid content type");
    }

    // ✅ Call Gemini 2.0 Flash API (Google AI Studio key via X-goog-api-key)
    const geminiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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

    const rawText = await geminiResp.text();

    if (!geminiResp.ok) {
      console.error("Gemini API error:", rawText);
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Gemini API error",
          details: rawText,
        }),
      };
    }

    // Parse Gemini response safely
    let aiResult;
    try {
      aiResult = JSON.parse(rawText);
    } catch {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid JSON from Gemini",
          details: rawText,
        }),
      };
    }

    let generatedContent;
    try {
      const aiContent =
        aiResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      generatedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : responseStructure;
    } catch (err) {
      console.error("JSON parse fallback:", err);
      generatedContent = responseStructure;
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generatedContent),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Failed to generate content",
        details: error.message,
      }),
    };
  }
};
