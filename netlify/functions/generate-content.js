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

  // Allow only POST
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
    const { type, data } = JSON.parse(event.body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "OpenAI API key not configured" }),
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

Respond in JSON with this structure:
${JSON.stringify(
  {
    case_study: {
      introduction: "",
      challenge: "",
      solution: "",
      results: "",
    },
  },
  null,
  2
)}`;

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

Respond in JSON with this structure:
${JSON.stringify(
  {
    proposal_outline: {
      executive_summary: "",
      strategy: "",
      deliverables: "",
      timeline_investment: "",
      next_steps: "",
    },
  },
  null,
  2
)}`;

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

    // Call OpenAI
    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are an expert marketing strategist. Always respond in **valid JSON** format.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      }
    );

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const aiResult = await openAIResponse.json();

    let generatedContent;
    try {
      const aiContent = aiResult.choices[0].message.content.trim();
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      generatedContent = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : JSON.parse(aiContent);
    } catch (err) {
      console.error("JSON parse error:", err);
      // fallback default
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
