import os
import json
from typing import TypedDict, Literal, Optional

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

load_dotenv()

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Phase = Literal["exploring", "challenging", "finalizing"]


class ManifestDict(TypedDict, total=False):
    one_liner: Optional[str]
    problem: Optional[str]
    solution: Optional[str]
    target_customer: Optional[str]
    market_size: Optional[str]
    competitors: Optional[list]
    differentiators: Optional[list]
    key_assumptions: Optional[list]


class AgentState(TypedDict):
    # Full conversation history passed to Gemini on every turn
    messages: list[BaseMessage]
    # Current phase of the brainstorm session
    phase: Phase
    # Extracted manifest — populated once the session reaches finalizing phase
    manifest: ManifestDict


# ---------------------------------------------------------------------------
# Phase logic
# ---------------------------------------------------------------------------

# Number of human turns required before advancing to the next phase
_PHASE_THRESHOLDS: dict[Phase, int] = {
    "exploring": 5,
    "challenging": 10,
}


def _next_phase(current: Phase, human_turn_count: int) -> Phase:
    # Stay in finalizing once reached — no threshold defined for it
    threshold = _PHASE_THRESHOLDS.get(current)
    if threshold is None:
        return current
    if human_turn_count >= threshold:
        if current == "exploring":
            return "challenging"
        if current == "challenging":
            return "finalizing"
    return current


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_SYSTEM_PROMPTS: dict[Phase, str] = {
    "exploring": (
        "You are an expert startup consultant helping a founder develop their idea. "
        "Your job right now is to EXPLORE and UNDERSTAND the idea deeply. "
        "Ask one focused, open-ended question per turn to uncover: the core problem, "
        "who suffers from it, why existing solutions fall short, and what the founder's "
        "proposed solution is. Be curious and encouraging. Never ask more than one question at a time."
    ),
    "challenging": (
        "You are a sharp startup consultant stress-testing a founder's idea. "
        "Your job now is to CHALLENGE every assumption rigorously. Push back on: "
        "who the real competitors are (including indirect ones), whether the target customer "
        "will actually pay, the size and reachability of the market, the core monetization model, "
        "and the riskiest assumptions. Be direct and intellectually honest — a bad idea caught "
        "early saves years of wasted effort. Ask one hard question per turn."
    ),
    "finalizing": (
        "You are a startup consultant wrapping up an ideation session. "
        "Your job is to synthesize everything discussed into a clear, confident summary. "
        "Highlight the strongest aspects of the idea, name the two or three most important "
        "risks the founder must address, and end with an encouraging but honest verdict. "
        "Keep your response concise and actionable."
    ),
}

# ---------------------------------------------------------------------------
# Manifest extraction
# ---------------------------------------------------------------------------

# Double braces {{ }} are used so .format() doesn't treat JSON keys as placeholders
_MANIFEST_EXTRACTION_PROMPT = (
    "Based on the conversation below, extract a structured startup manifest as JSON. "
    "Return ONLY valid JSON with these exact keys (use null for anything not yet discussed):\n"
    '{{"one_liner": null, "problem": null, "solution": null, "target_customer": null, '
    '"market_size": null, "competitors": [], "differentiators": [], "key_assumptions": []}}\n\n'
    "Conversation:\n{conversation}"
)


def _extract_manifest(llm: ChatGoogleGenerativeAI, messages: list[BaseMessage]) -> ManifestDict:
    # Format the full conversation as plain text for the extraction prompt
    conversation = "\n".join(
        f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
        for m in messages
    )
    prompt = _MANIFEST_EXTRACTION_PROMPT.format(conversation=conversation)
    response = llm.invoke([HumanMessage(content=prompt)])
    raw = response.content.strip()

    # Strip markdown code fences if Gemini wraps the JSON in ```json ... ```
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# LangGraph node
# ---------------------------------------------------------------------------

def _build_graph() -> StateGraph:
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )

    def consultant_node(state: AgentState) -> AgentState:
        # Determine phase based on how many human turns have happened
        human_turn_count = sum(1 for m in state["messages"] if isinstance(m, HumanMessage))
        phase = _next_phase(state["phase"], human_turn_count)

        # Send full conversation history + phase-specific system prompt to Gemini
        system_prompt = SystemMessage(content=_SYSTEM_PROMPTS[phase])
        response = llm.invoke([system_prompt] + state["messages"])
        new_messages = state["messages"] + [AIMessage(content=response.content)]

        # Only extract manifest once we're in the finalizing phase
        manifest = state.get("manifest", {})
        if phase == "finalizing":
            manifest = _extract_manifest(llm, new_messages)

        return {
            "messages": new_messages,
            "phase": phase,
            "manifest": manifest,
        }

    # Single-node graph: one invocation = one turn, no loops
    graph = StateGraph(AgentState)
    graph.add_node("consultant", consultant_node)
    graph.add_edge(START, "consultant")
    graph.add_edge("consultant", END)
    return graph.compile()


# Graph is compiled once at import time and reused across all requests
_graph = _build_graph()

# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def initial_state() -> AgentState:
    return {
        "messages": [],
        "phase": "exploring",
        "manifest": {},
    }


def chat(state: AgentState, user_input: str) -> AgentState:
    # Append user message to history before invoking the graph
    state_with_input: AgentState = {
        **state,
        "messages": state["messages"] + [HumanMessage(content=user_input)],
    }
    return _graph.invoke(state_with_input)
