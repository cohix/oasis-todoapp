# GenAI Rules

> Source of truth: `aspec/genai/agents.md`

## Agents
Each agent is defined in `aspec/genai/agents.md` with:
- Name and purpose
- Model and provider (Anthropic, OpenAI, Ollama, etc.)
- Description and guidance

Only use models and providers defined for each agent.
Do not add new agents without a corresponding entry in `aspec/genai/agents.md`.
Follow the per-agent guidance when implementing or modifying agent behaviour.