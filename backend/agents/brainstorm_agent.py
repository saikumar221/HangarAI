import os
from typing import TypedDict, Literal, Optional, Annotated

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

from core.utils import parse_json_response

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
    # add_messages reducer appends incoming messages instead of replacing the list
    messages: Annotated[list[BaseMessage], add_messages]
    phase: Phase
    manifest: ManifestDict
    # set to True only during finalize flow to trigger manifest extraction
    do_extract: bool


# ---------------------------------------------------------------------------
# Phase logic
# ---------------------------------------------------------------------------

# Cumulative human-turn thresholds: exploring ends after 3 turns, challenging after 6 total
def _compute_next_phase(current: Phase, total_human_turns: int) -> Phase:
    if current == "exploring" and total_human_turns > 3:
        return "challenging"
    if current == "challenging" and total_human_turns > 6:
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

_MANIFEST_EXTRACTION_PROMPT = (
    "Based on the conversation below, extract a structured startup manifest as JSON. "
    "Return ONLY valid JSON with these exact keys (use null for anything not yet discussed):\n"
    '{{"one_liner": null, "problem": null, "solution": null, "target_customer": null, '
    '"market_size": null, "competitors": [], "differentiators": [], "key_assumptions": []}}\n\n'
    "Conversation:\n{conversation}"
)


async def _extract_manifest(llm: ChatGroq, messages: list[BaseMessage]) -> ManifestDict:
    conversation = "\n".join(
        f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
        for m in messages
    )
    prompt = _MANIFEST_EXTRACTION_PROMPT.format(conversation=conversation)
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    try:
        return parse_json_response(response.content)
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# LLM (initialized once at import)
# ---------------------------------------------------------------------------

_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
)

# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def _make_phase_node(phase: Phase):
    async def node(state: AgentState) -> dict:
        total_human_turns = sum(1 for m in state["messages"] if isinstance(m, HumanMessage))
        new_phase = _compute_next_phase(phase, total_human_turns)
        response = await _llm.ainvoke(
            [SystemMessage(content=_SYSTEM_PROMPTS[phase])] + state["messages"]
        )
        return {
            "messages": [AIMessage(content=response.content)],
            "phase": new_phase,
        }
    return node


async def _extract_manifest_node(state: AgentState) -> dict:
    manifest = await _extract_manifest(_llm, state["messages"])
    return {"manifest": manifest, "do_extract": False}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def _route_phase(state: AgentState) -> str:
    return state.get("phase", "exploring")


def _route_after_finalizing(state: AgentState) -> str:
    return "extract_manifest" if state.get("do_extract") else END


# ---------------------------------------------------------------------------
# Graph definition
# ---------------------------------------------------------------------------

def _build_graph_def() -> StateGraph:
    g = StateGraph(AgentState)

    g.add_node("exploring", _make_phase_node("exploring"))
    g.add_node("challenging", _make_phase_node("challenging"))
    g.add_node("finalizing", _make_phase_node("finalizing"))
    g.add_node("extract_manifest", _extract_manifest_node)

    g.add_conditional_edges(START, _route_phase, {
        "exploring": "exploring",
        "challenging": "challenging",
        "finalizing": "finalizing",
    })

    g.add_edge("exploring", END)
    g.add_edge("challenging", END)
    g.add_conditional_edges("finalizing", _route_after_finalizing, {
        "extract_manifest": "extract_manifest",
        END: END,
    })
    g.add_edge("extract_manifest", END)

    return g


_graph_def = _build_graph_def()
compiled_graph = None  # set by init() during app startup


def init(checkpointer) -> None:
    global compiled_graph
    compiled_graph = _graph_def.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def chat(session_id: str, user_input: str) -> AgentState:
    config = {"configurable": {"thread_id": session_id}}
    return await compiled_graph.ainvoke(
        {"messages": [HumanMessage(content=user_input)]},
        config=config,
    )


async def finalize(session_id: str) -> AgentState:
    """Run the finalizing prompt and extract the manifest in one graph invocation."""
    config = {"configurable": {"thread_id": session_id}}
    return await compiled_graph.ainvoke(
        {
            "messages": [HumanMessage(content="Please finalize my idea")],
            "phase": "finalizing",
            "do_extract": True,
        },
        config=config,
    )
