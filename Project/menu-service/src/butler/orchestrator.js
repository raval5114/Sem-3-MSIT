const { randomUUID } = require("node:crypto");
const { executeTool } = require("../mcp-server");
const { CHAT_ERROR_CODES } = require("./contracts");

const conversationState = new Map();

function getConversation(conversationId) {
  if (!conversationId) {
    const generatedId = randomUUID();
    const state = { id: generatedId, drafts: [], turns: [] };
    conversationState.set(generatedId, state);
    return state;
  }

  if (!conversationState.has(conversationId)) {
    const state = { id: conversationId, drafts: [], turns: [] };
    conversationState.set(conversationId, state);
  }
  return conversationState.get(conversationId);
}

function coerceText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePriceCandidates(message) {
  const matches = [...message.matchAll(/(?:rs\.?|₹|inr)\s*([0-9]+(?:\.[0-9]+)?)/gi)];
  const prices = matches.map((match) => Number(match[1])).filter((n) => Number.isFinite(n));
  if (prices.length === 0) {
    const fallback = [...message.matchAll(/\b([0-9]+(?:\.[0-9]+)?)\b/g)].map((match) => Number(match[1]));
    return fallback.filter((n) => Number.isFinite(n));
  }
  return prices;
}

function parseDietaryTags(message) {
  const lower = message.toLowerCase();
  const tags = [];
  const tagLookup = {
    vegetarian: "vegetarian",
    vegan: "vegan",
    spicy: "spicy",
    glutenfree: "gluten-free",
    gluten: "gluten-free",
    protein: "high-protein",
    dairy: "dairy-free",
    dairyfree: "dairy-free",
  };

  Object.entries(tagLookup).forEach(([keyword, tag]) => {
    if (lower.includes(keyword)) tags.push(tag);
  });

  if (lower.includes("non veg") || lower.includes("non-veg") || lower.includes("nonveg")) {
    tags.push("non-vegetarian");
  }

  return [...new Set(tags)];
}

function parseAllergens(message) {
  const lower = message.toLowerCase();
  const allergens = [];
  const patterns = [
    ["milk", "MILK"],
    ["dairy", "MILK"],
    ["peanut", "PEANUT"],
    ["nuts", "NUTS"],
    ["egg", "EGG"],
    ["wheat", "WHEAT"],
    ["gluten", "WHEAT"],
    ["soy", "SOY"],
    ["sesame", "SESAME"],
  ];

  patterns.forEach(([keyword, value]) => {
    if (lower.includes(keyword)) allergens.push(value);
  });

  return [...new Set(allergens)];
}

function parseCreatePayload(message, existing = {}) {
  const normalizedMessage = message || "";
  const payload = { ...existing };
  const prices = parsePriceCandidates(normalizedMessage);
  const dietaryTags = parseDietaryTags(normalizedMessage);
  if (dietaryTags.length) payload.dietaryTags = dietaryTags;

  if (!payload.name) {
    const match = normalizedMessage.match(/(?:create|add|new)\s+([a-z0-9\s-]+?)(?:\s+for\s+|\s+at\s+|\s+priced\s+|$)/i);
    if (match) {
      payload.name = match[1].trim();
    }
  }

  if (!payload.basePrice && prices.length > 0) {
    payload.basePrice = prices[0];
  }

  if (!payload.categoryId) {
    const categoryMatch = normalizedMessage.match(/category(?:\s+id)?\s*[:=]?\s*([a-z0-9_-]+)/i);
    if (categoryMatch) {
      payload.categoryId = categoryMatch[1];
    }
  }

  if (!payload.description) {
    const descriptionMatch = normalizedMessage.match(/(?:for|with|includes|description)\s+(.+)$/i);
    if (descriptionMatch && descriptionMatch[1]) {
      payload.description = descriptionMatch[1].trim();
    }
  }

  return payload;
}

function buildSearchArgs(message, restaurantId) {
  const normalizedMessage = message || "";
  const prices = parsePriceCandidates(normalizedMessage);
  const dietaryTags = parseDietaryTags(normalizedMessage);
  const allergens = parseAllergens(normalizedMessage);
  const args = { restaurantId };

  const queryMatch = normalizedMessage.match(/(?:find|search|show|recommend|suggest)\s+(?:me\s+)?(.+?)(?:\s+under\s+|\s+between\s+|\s+in\s+|$)/i);
  if (queryMatch && coerceText(queryMatch[1])) {
    args.query = queryMatch[1].trim();
  }

  if (prices.length >= 2) {
    args.minPrice = Math.min(...prices);
    args.maxPrice = Math.max(...prices);
  } else if (prices.length === 1) {
    args.maxPrice = prices[0];
  }

  if (dietaryTags.length) {
    args.dietaryTags = dietaryTags;
  }

  if (allergens.length) {
    args.excludeAllergens = allergens;
  }

  if (!args.query) {
    const cleaned = normalizedMessage
      .replace(/\b(find|search|show|recommend|suggest|me|for|under|between|under\s+rs|₹|inr|rs\.?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) {
      args.query = cleaned;
    }
  }

  return args;
}

async function invokeGroqModel({ system, message, model, temperature = 0.1, maxTokens = 512 }) {
  if (!process.env.GROQ_API_KEY) return null;

  const payload = {
    model: model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: message },
    ],
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content || null;
}

async function processButlerChat({ message, confirmation, conversationId, callerContext = {} } = {}) {
  const userMessage = coerceText(message);
  const conversation = getConversation(conversationId || userMessage);
  const restaurantId = callerContext.restaurantId || callerContext.restaurant_id;

  if (!restaurantId) {
    return {
      success: false,
      conversationId: conversation.id,
      reply: "Butler is not available for this restaurant context yet. Please contact your DineFlow administrator to activate the feature.",
      role: "assistant",
      error: {
        code: CHAT_ERROR_CODES.FEATURE_NOT_ENTITLED,
        message: "Restaurant context is required to evaluate Butler entitlement.",
      },
    };
  }

  if (confirmation) {
    const draft = (conversation.drafts || []).find((item) => item.actionId === confirmation.actionId);
    if (!draft) {
      return {
        success: false,
        conversationId: conversation.id,
        reply: "That draft no longer exists. Please confirm the latest review card again.",
        role: "assistant",
        error: {
          code: CHAT_ERROR_CODES.ACTION_EXPIRED,
          message: "The action draft has expired or was already handled.",
        },
      };
    }

    conversation.drafts = conversation.drafts.filter((item) => item.actionId !== draft.actionId);

    if (confirmation.confirmed === false) {
      return {
        success: true,
        conversationId: conversation.id,
        reply: `I discarded the draft for ${draft.toolName}.`,
        role: "assistant",
        toolCalls: [
          {
            toolName: draft.toolName,
            status: "AWAITING_CONFIRMATION",
            summary: "User cancelled the proposed draft action.",
          },
        ],
      };
    }

    try {
      const result = await executeTool(draft.toolName, { ...draft.payload, restaurantId }, {
        ...callerContext,
        restaurantId,
        checkEntitlement: true,
      });

      return {
        success: true,
        conversationId: conversation.id,
        reply: `Confirmed. ${draft.summary} The operation completed successfully.`,
        role: "assistant",
        toolCalls: [
          {
            toolName: draft.toolName,
            status: "EXECUTED",
            summary: `Executed confirmed action for ${draft.toolName}.`,
          },
        ],
        result,
      };
    } catch (error) {
      return {
        success: false,
        conversationId: conversation.id,
        reply: `I could not complete the confirmed action. ${error.message || "The server rejected the mutation."}`,
        role: "assistant",
        error: {
          code: error.message?.includes("INSUFFICIENT_PRIVILEGES")
            ? CHAT_ERROR_CODES.INSUFFICIENT_PRIVILEGES
            : error.message?.includes("FEATURE_NOT_ENTITLED")
              ? CHAT_ERROR_CODES.FEATURE_NOT_ENTITLED
              : CHAT_ERROR_CODES.INVALID_ARGUMENTS,
          message: error.message || "Tool execution failed.",
        },
      };
    }
  }

  const lowerMessage = userMessage.toLowerCase();
  const shouldDraftMenu = /\b(create|add|new)\b/i.test(userMessage)
    && !/\b(find|search|show|recommend|suggest|get)\b/i.test(userMessage);
  const shouldSearch = /(?:find|search|show|recommend|suggest|get)\b/i.test(userMessage)
    || /under\s*(?:₹|rs\.?|inr)?\s*[0-9]/i.test(userMessage)
    || /between\s*[0-9]/i.test(userMessage)
    || /meal|dish|menu|item/i.test(userMessage);

  if (shouldDraftMenu) {
    const draftPayload = parseCreatePayload(userMessage, { restaurantId });
    const missingFields = ["categoryId", "name", "basePrice"].filter((field) => !draftPayload[field]);

    if (missingFields.length > 0) {
      const draft = {
        actionId: `act_${Date.now()}_${randomUUID().slice(0, 8)}`,
        toolName: "create_menu_item",
        summary: `Create a new menu item${draftPayload.name ? `: ${draftPayload.name}` : ""}`,
        payload: draftPayload,
        requiresConfirmation: true,
      };
      conversation.drafts = [...(conversation.drafts || []), draft];

      return {
        success: true,
        conversationId: conversation.id,
        reply: `I can create that menu item. I still need ${missingFields.join(", ")}. Please send the missing values or confirm the draft after I assemble it.`,
        role: "assistant",
        draftAction: {
          actionId: draft.actionId,
          toolName: draft.toolName,
          summary: draft.summary,
          payload: draft.payload,
          requiresConfirmation: true,
        },
        toolCalls: [{ toolName: "create_menu_item", status: "AWAITING_CONFIRMATION", summary: "Draft created for menu-item review." }],
      };
    }

    const draft = {
      actionId: `act_${Date.now()}_${randomUUID().slice(0, 8)}`,
      toolName: "create_menu_item",
      summary: `Create ${draftPayload.name} for ₹${draftPayload.basePrice}`,
      payload: draftPayload,
      requiresConfirmation: true,
    };
    conversation.drafts = [...(conversation.drafts || []), draft];

    return {
      success: true,
      conversationId: conversation.id,
      reply: `Here is the draft for ${draftPayload.name}. Please confirm this action to save it to the restaurant menu.`,
      role: "assistant",
      draftAction: {
        actionId: draft.actionId,
        toolName: draft.toolName,
        summary: draft.summary,
        payload: draft.payload,
        requiresConfirmation: true,
      },
      toolCalls: [{ toolName: "create_menu_item", status: "AWAITING_CONFIRMATION", summary: "Draft action generated for final confirmation." }],
    };
  }

  if (shouldSearch) {
    const searchArgs = buildSearchArgs(userMessage, restaurantId);

    try {
      const result = await executeTool("search_menu", searchArgs, {
        ...callerContext,
        restaurantId,
        checkEntitlement: true,
      });

      const items = Array.isArray(result) ? result : result?.items || [];
      const summary = items.length
        ? `I found ${items.length} matching dishes: ${items.slice(0, 3).map((item) => item.name).join(", ")}${items.length > 3 ? ", and more" : ""}.`
        : "I couldn't find any matching dishes for that search. I can widen the price range or relax the dietary filters.";

      return {
        success: true,
        conversationId: conversation.id,
        reply: summary,
        role: "assistant",
        toolCalls: [{ toolName: "search_menu", status: "EXECUTED", summary: `Searched for menu items with filters derived from the prompt.` }],
        results: items,
      };
    } catch (error) {
      return {
        success: false,
        conversationId: conversation.id,
        reply: "I could not fetch live menu data right now, so I cannot confirm the results. Please try again in a moment.",
        role: "assistant",
        error: {
          code: error.message?.includes("FEATURE_NOT_ENTITLED") ? CHAT_ERROR_CODES.FEATURE_NOT_ENTITLED : CHAT_ERROR_CODES.MODEL_UNAVAILABLE,
          message: error.message || "Menu search failed.",
        },
      };
    }
  }

  if (/(ingredient|allergen|dairy|vegan|vegetarian|gluten|peanut|milk)/i.test(userMessage)) {
    const productId = /product\s*[:=]?\s*([a-zA-Z0-9_-]+)/i.exec(userMessage)?.[1];
    const allergens = parseAllergens(userMessage);

    if (productId || allergens.length) {
      try {
        const result = await executeTool("check_dietary_safety", {
          productId: productId || "",
          allergens,
          restaurantId,
        }, { ...callerContext, restaurantId, checkEntitlement: true });

        return {
          success: true,
          conversationId: conversation.id,
          reply: result?.notes || "I checked the available allergen data and it is incomplete for that item.",
          role: "assistant",
          toolCalls: [{ toolName: "check_dietary_safety", status: "EXECUTED", summary: "Checked the item against structured dietary/allergen data." }],
          result,
        };
      } catch (error) {
        return {
          success: false,
          conversationId: conversation.id,
          reply: "I cannot verify dietary safety from incomplete data. I should not promise allergy safety without authoritative ingredient records.",
          role: "assistant",
          error: {
            code: CHAT_ERROR_CODES.MODEL_UNAVAILABLE,
            message: error.message || "Dietary safety check failed.",
          },
        };
      }
    }
  }

  try {
    const response = await invokeGroqModel({
      system: "You are Butler, a role-aware restaurant assistant. Keep replies brief, grounded in the menu, and never claim facts the service data does not support.",
      message: userMessage,
    });

    return {
      success: true,
      conversationId: conversation.id,
      reply: response || "I can help with menu discovery, item drafts, and restaurant status. Ask me a question about the menu or an item requirement.",
      role: "assistant",
      toolCalls: [],
    };
  } catch {
    return {
      success: true,
      conversationId: conversation.id,
      reply: "I can help with menu discovery, item drafts, and restaurant status. Ask me a question about the menu or an item requirement.",
      role: "assistant",
      toolCalls: [],
    };
  }
}

module.exports = {
  processButlerChat,
  conversationState,
  invokeGroqModel,
};
