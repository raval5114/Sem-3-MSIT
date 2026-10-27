# Full Implementation Guide: Dual-Purpose Backend (REST + MCP) with FastAPI & LangChain Chatbot

This comprehensive document contains the complete codebase, system architecture, and integration instructions to build a **Unified API Layer with Dual Interfaces** alongside a **LangChain + FastAPI Chatbot Agent** acting as an MCP Client.

---

## 🏗️ System Architecture

```
                       ┌─────────────────────────┐
                       │  Mobile / Web App UI    │
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │ (REST API Call)   (HTTP POST /chat)
                  ▼                                   ▼
      ┌───────────────────────┐           ┌───────────────────────┐
      │  Core REST Endpoints  │           │   FastAPI Chatbot     │
      │  (App Port: 3000/8080)│           │   Gateway (Port 5000) │
      └───────────┬───────────┘           └───────────┬───────────┘
                  │                                   │
                  │ (Direct Call)                     │ (MCP Client over HTTP SSE)
                  ▼                                   ▼
      ┌───────────────────────────────────────────────────────────┐
      │                   Shared Service Layer                    │
      │        (Unified Core Business & Database Logic)           │
      └───────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step 1: Core Service Layer (Choose Node.js or Spring Boot)

This component contains your underlying business logic and exposes it as a standard JSON REST API and an MCP network endpoint using **Server-Sent Events (SSE)**.

### Option A: Node.js (Express + MCP SDK)

#### `package.json`
```json
{
  "name": "mcp-dual-backend-node",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "axios": "^1.7.9",
    "express": "^4.21.2"
  }
}
```

#### `userService.js` (Shared Logic)
```javascript
// Single source of truth for both Web App and AI Chatbot
export async function getProfileData(userId) {
  // Replace this boilerplate with live database queries or upstream microservices
  return { 
    userId: userId, 
    status: "Active", 
    tier: "Premium", 
    lastLogin: "2026-09-04" 
  };
}
```

#### `server.js` (Dual HTTP & MCP Setup)
```javascript
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getProfileData } from "./userService.js";

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────
// INTERFACE 1: Standard REST API for Web/Mobile Application
// ─────────────────────────────────────────────────────────
app.get("/api/users/:id", async (req, res) => {
  try {
    const data = await getProfileData(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// INTERFACE 2: MCP Server over HTTP SSE for AI Chatbots
// ─────────────────────────────────────────────────────────
const mcpServer = new Server(
  { name: "dual-use-service", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 1. Describe tools dynamically to connecting Agents
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "get_user_profile",
    description: "Get user metadata, membership tier, and login history.",
    inputSchema: {
      type: "object",
      properties: { 
        userId: { type: "string", description: "The unique ID of the user account" } 
      },
      required: ["userId"]
    }
  }]
}));

// 2. Handle actual Tool Execution calls from the Agent Client
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_user_profile") {
    const { userId } = request.params.arguments;
    const data = await getProfileData(userId);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  throw new Error("Tool not found");
});

// 3. Bind MCP Transport Layer to Express Router
let transport;
app.get("/mcp/sse", async (req, res) => {
  transport = new SSEServerTransport("/mcp/messages", res);
  await mcpServer.connect(transport);
});

app.post("/mcp/messages", async (req, res) => {
  if (transport) {
    await transport.handleMessage(req, res);
  } else {
    res.status(500).send("MCP Transport has not been initialized yet.");
  }
});

// Start unified web application
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 [REST API] running at http://localhost:${PORT}/api/users/:id`);
  console.log(`🤖 [MCP Server] SSE Endpoint running at http://localhost:${PORT}/mcp/sse`);
});
```

---

### Option B: Java (Spring Boot & Spring AI)

#### `pom.xml` (Dependencies Snippet)
```xml
<dependencies>
    <!-- Standard Web MVC Starter for Application Endpoints -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <!-- Native Spring AI MCP Starter for Tool Transformations -->
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-mcp-server-spring-boot-starter</artifactId>
        <version>1.0.0-M1</version>
    </dependency>
</dependencies>
```

#### `application.yml`
```yaml
server:
  port: 8080

spring:
  ai:
    mcp:
      server:
        transport: streamable-http # Automatically maps endpoints to /mcp/sse
```

#### `UserService.java` (Shared Logic)
```java
package com.example.demo.service;

import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class UserService {
    public Map<String, Object> getUserProfile(String userId) {
        return Map.of(
            "userId", userId,
            "status", "Active",
            "tier", "Premium",
            "lastLogin", "2026-09-04"
        );
    }
}
```

#### `AppController.java` (App Endpoints)
```java
package com.example.demo.controller;

import com.example.demo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppController {

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getAppUser(@PathVariable String id) {
        return ResponseEntity.ok(userService.getUserProfile(id));
    }
}
```

#### `AgentToolController.java` (MCP Tool Endpoints)
```java
package com.example.demo.controller;

import com.example.demo.service.UserService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class AgentToolController {

    @Autowired
    private UserService userService;

    @Tool(name = "get_user_profile", description = "Get user metadata, membership tier, and login history.")
    public Map<String, Object> getAgentUser(String userId) {
        // Intercepts intent and points back to the exact same shared database service
        return userService.getUserProfile(userId);
    }
}
```

---

## 🛠️ Step 2: The FastAPI Chatbot Middleware Layer (MCP Client)

This isolated service manages the **LangChain AI brain**. On initialization, it reads what tools are hosted on your backend over SSE, converts them dynamically into native function-calling formats, and runs a conversational route.

#### `requirements.txt`
```text
fastapi>=0.110.0
uvicorn>=0.30.0
langchain>=0.1.0
langchain-openai>=0.1.0
mcp-python-client>=1.0.0
pydantic>=2.6.0
```

#### `main.py`
```python
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# LangChain Orchestration Core
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

# MCP Networking Utilities
from mcp import ClientSession
from mcp.client.sse import sse_client

# Environment validation
if not os.environ.get("OPENAI_API_KEY"):
    raise ValueError("System Missing Environment Variable: OPENAI_API_KEY must be configured.")

# Global References
mcp_session = None
agent_executor = None

# Configure path pointing to your active Node or Spring Core Backend Service
MCP_SERVER_SSE_URL = "http://localhost:3000/mcp/sse" 

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles asynchronous connection tracking to the MCP Server during startup and shutdown."""
    global mcp_session, agent_executor
    
    print(f"🔗 Establishing Handshake with Core Service MCP Endpoint: {MCP_SERVER_SSE_URL}...")
    try:
        async with sse_client(MCP_SERVER_SSE_URL) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                mcp_session = session
                await session.initialize()
                
                # Fetch schemas from backend
                mcp_tools = await session.list_tools()
                langchain_tools = []

                # Convert Server endpoints into executable Agent functions dynamically
                for mcp_tool in mcp_tools.tools:
                    @tool(name=mcp_tool.name, description=mcp_tool.description)
                    async def dynamic_mcp_tool(arguments: dict, name=mcp_tool.name) -> str:
                        # Fires real-time RPC calls over the network back to core logic
                        result = await mcp_session.call_tool(name, arguments)
                        return result.content.text
                    
                    langchain_tools.append(dynamic_mcp_tool)

                print(f"✅ Dynamic Synchronization Complete. Hooked {len(langchain_tools)} Backend Tools into AI Model Context.")

                # Initialize Assistant Architecture
                llm = ChatOpenAI(model="gpt-4o", temperature=0.2)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are an intelligent chatbot embedded in our application interface. Always use provided tools to cross-reference data accurately."),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("human", "{input}"),
                    MessagesPlaceholder(variable_name="agent_scratchpad"),
                ])
                
                agent = create_openai_functions_agent(llm, langchain_tools, prompt)
                agent_executor = AgentExecutor(agent=agent, tools=langchain_tools, verbose=True)
                
                yield # Serves client threads continuously until process termination
                
    except Exception as e:
        print(f"❌ Initialization Failed. Ensure Core Service is running first: {str(e)}")
        yield

# Initialize Web Services
app = FastAPI(title="AI Chatbot Agent Gateway", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    user_id: str

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat_handler(request: ChatRequest):
    global agent_executor
    if not agent_executor:
        raise HTTPException(status_code=503, detail="AI Brain or Core MCP Connection currently disconnected.")
    
    try:
        # Implicit context embedding injection
        contextualized_input = f"[User Session ID Context: {request.user_id}] {request.message}"
        
        # Invoke LangChain Execution Loop
        response = await agent_executor.ainvoke({
            "input": contextualized_input,
            "chat_history": [] # Map active local thread arrays if supporting long memory loops
        })
        
        return ChatResponse(reply=response["output"])
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference Execution Error: {str(e)}")
```

---

## 🏃‍♂️ Verification and Testing Guide

### 1. Boot up the Main Data Backend Service
* **For Node.js:** Execute `npm install` and run `node server.js` (Listens on port `3000`).
* **For Spring Boot:** Execute `mvn spring-boot:run` (Listens on port `8080`).

### 2. Verify Application View Layer Endpoint (REST)
Test that your core front-end system can read static application payloads normally:
```bash
curl http://localhost:3000/api/users/usr_998877
```

### 3. Boot up Chatbot Interface Middleware (FastAPI)
Ensure environment tokens are loaded first:
```bash
export OPENAI_API_KEY="your-api-key-here"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### 4. Send Message from Chatbot UI Front-End
Simulate a user query targeting conversational logic. Watch the terminal logs to see the LLM automatically interpret the text, call your exposed service tool, and convert raw JSON data back into conversational text.
```bash
curl -X POST http://localhost:5000/api/chat      -H "Content-Type: application/json"      -d '{"user_id": "usr_998877", "message": "Can you check what my account profile status looks like right now?"}'
```

**Output Payload Recieved:**
```json
{
  "reply": "I've checked the logs for your account (ID: usr_998877). Your Premium tier profile is currently Active and functioning normally!"
}
```
