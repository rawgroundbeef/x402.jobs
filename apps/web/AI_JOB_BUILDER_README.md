# AI-Powered Job Builder

Future feature: Let users create workflows from natural language prompts.

## Overview

**User says:** "Generate a meme about Bitcoin using the latest price data"

**AI (Jobputer) does:**
1. Understands intent → "Get BTC price, generate meme image with that context"
2. Finds relevant resources → Price API + Image generator
3. Wires them together → Price output → Image prompt input
4. Handles transforms → Format price data into a prompt string

---

## Architecture: Jobputer Tool Calls

Jobputer already has command/tool infrastructure. We extend it with workflow-building tools:

### Discovery Tools

```typescript
search_resources({ query: string, network?: string })
  → [{ id, name, description, price, inputSchema, outputSchema }]

get_resource_details({ resource_id: string })
  → { full schema, example inputs/outputs }

list_my_jobs()
  → [{ id, name, network, node_count }]
```

### Building Tools

```typescript
create_workflow({ name: string, network: string })
  → { job_id, trigger_node_id }

add_resource_node({ job_id, resource_id, position? })
  → { node_id }

add_transform_node({ job_id, type: "code" | "combine", config })
  → { node_id }

connect_nodes({ job_id, from_node, to_node, field_mapping? })
  → { edge_id }

set_trigger_params({ job_id, params: [...] })
  → { updated }
```

### Validation Tools

```typescript
validate_workflow({ job_id })
  → { valid: boolean, errors?: [...], estimated_cost? }

preview_workflow({ job_id })
  → { nodes, edges, summary }
```

---

## Example Conversation

```
User: "Build me a job that gets the price of a token and generates 
       a meme about whether it's up or down"

Jobputer: [calls search_resources({ query: "token price" })]
          Found: dexscreener/price, coingecko/price, birdeye/token-info
          
          [calls search_resources({ query: "image generation meme" })]
          Found: pfpputer/pfp, memeputer/meme-generate
          
          I'll use dexscreener for price data and memeputer for the meme.
          
          [calls create_workflow({ name: "Token Meme Generator", network: "solana" })]
          [calls set_trigger_params({ params: [{ name: "token_address", type: "string" }] })]
          [calls add_resource_node({ resource_id: "dexscreener/price" })]
          [calls add_resource_node({ resource_id: "memeputer/meme-generate" })]
          [calls add_transform_node({ type: "code", config: { code: "..." } })]
          [calls connect_nodes(...)]
          [calls validate_workflow(...)]
          
          ✅ Created "Token Meme Generator"
          - Trigger: token_address (string)
          - Step 1: Get price from DexScreener ($0.01)
          - Step 2: Transform price into meme prompt
          - Step 3: Generate meme ($0.05)
          
          Estimated cost per run: $0.06
          
          Want me to open it in the editor?
```

---

## Key Components

### 1. Resource Knowledge Base

The AI needs to understand what each resource does. Options:
- Embed resource descriptions + schemas → vector search
- Build a structured catalog with categories/tags
- Let the LLM reason over raw 402 response schemas

### 2. Planning Layer

Given user intent + available resources, produce a DAG:

```
User: "Get trending memecoins and generate a report"

Plan:
1. [Trigger] → params: none
2. [Resource: dexscreener/trending] → get list
3. [Transform: extract top 5] → filter/map
4. [Resource: marketputer/analyze] → for each coin
5. [Transform: format as markdown] → combine
6. [Output] → final report
```

Approaches:
- ReAct-style reasoning
- Tree of thought for complex flows
- Few-shot prompting with examples

### 3. Schema Matching

Connecting outputs to inputs:

```
Resource A outputs: { data: { items: [{ symbol, price }] } }
Resource B expects: { token_symbol: string }

AI needs to generate transform:
  input.data.items[0].symbol → token_symbol
```

---

## Implementation Plan

### Phase 1: Basic Tools
- `search_resources` - query resources by description
- `get_resource_details` - get full schema
- `create_workflow` - create empty job
- `add_resource_node` - add a resource to the job

### Phase 2: Wiring
- `connect_nodes` - connect two nodes
- `add_transform_node` - add code/combine transforms
- `validate_workflow` - check for errors

### Phase 3: Intelligence
- Auto-generate transform code for schema mismatches
- Suggest resources based on intent
- Learn from user corrections

---

## Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Too many resources | RAG/embeddings, categories |
| Schema mismatch | Transform node generation |
| Multi-step reasoning | Chain-of-thought, examples |
| Cost estimation | Pre-calculate from resource prices |
| Errors at runtime | Validate before run, suggest fixes |
| User trust | Show reasoning, let them edit |

---

## API Endpoints Needed

Most of these exist or are easy to add:

```
GET  /api/resources/search?q=...     # Already exists (list with filter)
GET  /api/resources/:id              # Already exists
POST /api/jobs                       # Already exists (create job)
POST /api/jobs/:id/nodes             # New - add node to job
POST /api/jobs/:id/edges             # New - connect nodes
POST /api/jobs/:id/validate          # New - validate workflow
GET  /api/jobs/:id/preview           # New - get summary
```

---

## Notes

- Start with curated 20-30 well-documented resources
- Template-based generation as fallback
- Human-in-the-loop: AI suggests, user confirms
- Learn from manual builds to inform AI suggestions

