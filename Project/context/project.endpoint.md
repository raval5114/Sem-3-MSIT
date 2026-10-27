# Dual-Purpose Backend: REST API & MCP Server

This project delivers a unified backend architecture providing a single source of truth for your business logic through two distinct interfaces:
1. **REST API (`/api/*`)**: Used by standard web/mobile client applications.
2. **Model Context Protocol (MCP) Server (`/mcp/*`)**: Used by LLM-powered AI agents and chatbots to dynamically execute backend functions as AI tools over HTTP Server-Sent Events (SSE).

---

## 🛠️ Tech Stack Options

Choose the implementation stack that aligns with your infrastructure:

### Option 1: Node.js (Express)
* **Runtime**: Node.js (v18+)
* **Framework**: Express
* **Protocols**: `@modelcontextprotocol/sdk` (SSE transport), Axios

### Option 2: Java (Spring Boot)
* **Runtime**: Java 17+ / Maven
* **Framework**: Spring Boot 3.x+
* **Protocols**: Spring AI MCP Server Starter (`streamable-http`)

---

## 🚀 Getting Started

### 🟢 Running the Node.js Server

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the application:**
   ```bash
   node server.js
   ```
* The server will boot up on `http://localhost:3000`.

### 🟤 Running the Spring Boot Server

1. **Build the project:**
   ```bash
   mvn clean package
   ```
2. **Start the application:**
   ```bash
   mvn spring-boot:run
   ```
* The server will boot up on `http://localhost:8080`.

---

## 📡 API Endpoints (For App Use Cases)

Test the standard REST endpoints using `curl` or any API client (like Postman):

```bash
# Node.js
curl http://localhost:3000/api/users/usr_12345

# Spring Boot
curl http://localhost:8080/api/users/usr_12345
```

**Expected JSON Response:**
```json
{
  "userId": "usr_12345",
  "status": "Active",
  "tier": "Premium",
  "lastLogin": "2026-09-04"
}
```

---

## 🤖 Connecting the Chatbot Agent (MCP)

AI agents connect to this backend via **HTTP Server-Sent Events (SSE)**. This allows the chatbot to dynamically discover endpoints as "tools" and call them based on conversational context.

### Endpoint Mapping
* **SSE Connection Endpoint:** `http://localhost:3000/mcp/sse` (or `:8080/mcp/sse` for Spring)
* **Client Post-Message Endpoint:** `http://localhost:3000/mcp/messages` (or `:8080/mcp/messages`)

### Available Tools Exposed to the Agent
The agent automatically reads your application's capability schemas. The following tool is exposed out-of-the-box:

* **`get_user_profile`**
  * *Description*: Get user metadata, membership tier, and login history.
  * *Arguments*: `{ "userId": "string" }`

### Chatbot Workflow Example
User (Chatbot UI)  ──>  "Can you verify if my account is in good standing?"│AI Agent            ──>  Reads query, extracts target userId, and maps intentto 'get_user_profile' tool.│MCP SSE Connection ──>  Agent fires the tool over the HTTP network layer.│Your Backend Service──>  Executes shared database logic, returning JSON response.│AI Agent            ──>  Converts JSON into conversational text:User (Chatbot UI)  ──<  "Yes! Your Premium tier account is currently Active."}
