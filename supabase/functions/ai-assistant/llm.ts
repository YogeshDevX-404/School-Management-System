// ============================================================
// LLM INTEGRATION — Google Gemini with function calling
// Multi-step reasoning loop: LLM calls tools, we execute,
// feed results back, LLM continues until it produces a final answer.
// ============================================================

import { executeTool, TOOL_DEFINITIONS, type ToolContext } from "./tools.ts";

const GEMINI_MODEL = "gemini-2.0-flash";

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: any };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

const SYSTEM_INSTRUCTION = `You are the AI School Copilot for a School ERP system. You help school administrators, principals, teachers, and accountants by answering questions using live school data.

## Your Capabilities
You have access to backend tools that query the school database securely. You MUST use these tools to fetch real data — NEVER make up or guess data.

## Rules
1. ALWAYS use tools to fetch data before answering. Never generate fake numbers or student names.
2. If a question requires multiple pieces of information, call multiple tools in sequence.
3. Format responses beautifully using Markdown:
   - Use **bold** for headers and key metrics
   - Use Markdown tables for tabular data
   - Use bullet lists for items
   - Use emoji icons for visual appeal (📊 📅 👨‍🎓 👨‍🏫 💰 📢 etc.)
4. After presenting data, provide SMART RECOMMENDATIONS when relevant:
   - If attendance is low, recommend sending warning notices or parent meetings
   - If fees are pending, recommend generating reminder letters
   - If a class has low attendance, recommend follow-up actions
5. For document generation requests (notice, circular, agenda, summary), use the generateDocumentDraft tool. Always clarify that it's a DRAFT and ask for confirmation before any action.
6. NEVER expose SQL queries, database schema, or technical implementation details.
7. If a tool returns an error (e.g., permission denied), politely inform the user they don't have access to that information.
8. Understand context from conversation history. If user says "inme" (in these), "isme" (in this), "bhi" (also), refer to previous context.
9. Support English, Hindi, and Hinglish naturally. Respond in the same language style as the user.

## Response Style
- Be professional, friendly, and concise
- Lead with the key answer, then provide details
- Use tables for lists of students/teachers/payments
- Include summary statistics (totals, rates, percentages)
- Add actionable recommendations at the end when appropriate`;

function toGeminiTools(): GeminiFunctionDeclaration[] {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: "object",
      properties: t.parameters,
      required: Object.keys(t.parameters).filter((k) => !t.parameters[k].description.includes("Optional") && !t.parameters[k].description.includes("default") && !t.parameters[k].description.includes("defaults")),
    },
  }));
}

async function callGemini(
  contents: GeminiContent[],
  tools: GeminiFunctionDeclaration[],
  apiKey: string
): Promise<{ candidates: { content: { parts: GeminiPart[] } }[] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: [{ function_declarations: tools }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  return res.json();
}

export interface LLMResponse {
  response: string;
  intent: string;
  toolsUsed: string[];
  toolResults?: any[];
}

export async function runLLMWithTools(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  ctx: ToolContext,
  apiKey: string
): Promise<LLMResponse> {
  const tools = toGeminiTools();
  const toolsUsed: string[] = [];
  const toolResults: any[] = [];

  // Build conversation history for Gemini
  const contents: GeminiContent[] = [];

  // Add recent history (last 10 messages for context)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  // Add current message
  contents.push({ role: "user", parts: [{ text: message }] });

  // Multi-step reasoning loop (max 5 tool-call rounds)
  for (let round = 0; round < 5; round++) {
    const result = await callGemini(contents, tools, apiKey);
    const candidate = result.candidates?.[0];
    if (!candidate) throw new Error("No response from LLM");

    const parts = candidate.content?.parts || [];

    // Check if the model wants to call functions
    const functionCalls = parts.filter((p) => p.functionCall);
    const textParts = parts.filter((p) => p.text);

    if (functionCalls.length > 0) {
      // Execute each function call
      const functionResponses: GeminiPart[] = [];

      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall!;
        toolsUsed.push(name);

        const toolResult = await executeTool(name, args || {}, ctx);
        toolResults.push({ tool: name, result: toolResult });

        functionResponses.push({
          functionResponse: {
            name,
            response: toolResult,
          },
        });
      }

      // Add model's function call to conversation
      contents.push({ role: "model", parts: functionCalls });

      // Add function responses to conversation
      contents.push({ role: "user", parts: functionResponses });

      // Continue loop — LLM will process tool results
      continue;
    }

    // No function calls — this is the final response
    const responseText = textParts.map((p) => p.text || "").join("\n").trim();

    if (!responseText) {
      // Fallback if model returned empty
      return {
        response: "I apologize, but I couldn't generate a response. Please try rephrasing your question.",
        intent: "llm_empty",
        toolsUsed,
        toolResults,
      };
    }

    return {
      response: responseText,
      intent: toolsUsed.length > 0 ? "llm_tool_call" : "llm_direct",
      toolsUsed,
      toolResults,
    };
  }

  // Max rounds reached — return whatever we have
  return {
    response: "I've gathered the relevant information. Could you please rephrase your question so I can provide a more specific answer?",
    intent: "llm_max_rounds",
    toolsUsed,
    toolResults,
  };
}
