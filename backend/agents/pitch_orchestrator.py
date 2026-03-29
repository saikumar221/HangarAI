"""Pitch Analysis Multi-Agent Orchestrator

Graph topology:
    START → run_parallel_agents → synthesize → END

The `run_parallel_agents` node fires the Audio Agent, Video Agent, and
Transcript Agent concurrently via asyncio.gather — each receives raw DB
data and returns structured Gemini-powered insights.  The `synthesize`
node fuses all three outputs into the final three-part report:

  • improvement_roadmap  – prioritised, section-level suggestions
  • confidence_graph     – per-timestamp composite score merged from
                           vocal emotion + visual presence signals
  • verdict              – Pre-Seed Readiness Score + investor-persona
                           summary written in the target investor's voice
"""

import asyncio
import json
import os
from typing import Optional, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph

load_dotenv()


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class PitchAnalysisState(TypedDict):
    # ── inputs ──────────────────────────────────────────────────────────────
    investor_name: str
    investor_company: str
    investor_notes: Optional[str]
    manifest: dict                  # startup manifest fields
    audio_segments: list[dict]      # [{start_time, end_time, emotions: [{name, score}]}]
    video_snapshots: list[dict]     # [{timestamp, eye_contact_score, ...}]
    transcripts: list[dict]         # [{start_time, end_time, text, confidence}]

    # ── intermediate ────────────────────────────────────────────────────────
    audio_insights: Optional[dict]
    video_insights: Optional[dict]
    transcript_insights: Optional[dict]

    # ── output ──────────────────────────────────────────────────────────────
    improvement_roadmap: Optional[list[dict]]
    confidence_graph: Optional[list[dict]]
    verdict: Optional[dict]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def _escape_control_chars_in_strings(s: str) -> str:
    """Walk the JSON text character-by-character and escape literal control
    characters (newline, carriage return, tab) that appear inside string values.
    Gemini sometimes emits multi-paragraph text with raw newlines, which is
    invalid JSON even though it looks fine in a text editor.
    """
    result: list[str] = []
    in_string = False
    escaped = False
    for ch in s:
        if escaped:
            result.append(ch)
            escaped = False
        elif ch == "\\" and in_string:
            result.append(ch)
            escaped = True
        elif ch == '"':
            result.append(ch)
            in_string = not in_string
        elif in_string and ch == "\n":
            result.append("\\n")
        elif in_string and ch == "\r":
            result.append("\\r")
        elif in_string and ch == "\t":
            result.append("\\t")
        else:
            result.append(ch)
    return "".join(result)


def _parse_json_response(raw: str) -> dict | list:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(_escape_control_chars_in_strings(raw))


def _format_manifest(manifest: dict) -> str:
    if not manifest:
        return "No startup manifest available."
    lines = []
    for key, value in manifest.items():
        if value:
            label = key.replace("_", " ").title()
            if isinstance(value, list):
                lines.append(f"{label}: {', '.join(str(v) for v in value)}")
            else:
                lines.append(f"{label}: {value}")
    return "\n".join(lines) if lines else "No startup manifest available."


def _format_audio_timeline(segments: list[dict]) -> str:
    if not segments:
        return "No audio data available."
    lines = []
    for seg in sorted(segments, key=lambda x: x["start_time"]):
        top = seg["emotions"][:3] if seg["emotions"] else []
        emotion_str = ", ".join(f"{e['name']}({e['score']:.2f})" for e in top)
        lines.append(f"  [{seg['start_time']:.1f}s–{seg['end_time']:.1f}s] {emotion_str}")
    return "\n".join(lines)


def _format_video_timeline(snapshots: list[dict]) -> str:
    if not snapshots:
        return "No video data available."
    lines = []
    for snap in sorted(snapshots, key=lambda x: x["timestamp"]):
        lines.append(
            f"  [{snap['timestamp']:.1f}s] "
            f"eye={snap['eye_contact_score']:.2f} "
            f"expr={snap['expression_score']:.2f} "
            f"posture={snap['posture_score']:.2f} "
            f"head_stability={snap['head_movement_score']:.2f}"
        )
    return "\n".join(lines)


def _format_transcript(transcripts: list[dict]) -> str:
    """Format transcript utterances as a timestamped script plus full text."""
    if not transcripts:
        return "No transcript available."
    sorted_segs = sorted(transcripts, key=lambda x: x["start_time"])
    lines = []
    for seg in sorted_segs:
        lines.append(f"  [{seg['start_time']:.1f}s–{seg['end_time']:.1f}s] {seg['text']}")
    full_text = " ".join(seg["text"] for seg in sorted_segs)
    return "\n".join(lines) + f"\n\nFull transcript:\n{full_text}"


# Emotions that lift confidence vs. those that dampen it
_POSITIVE_EMOTIONS = {
    "Determination", "Pride", "Triumph", "Enthusiasm", "Excitement",
    "Interest", "Concentration", "Calmness",
}
_NEGATIVE_EMOTIONS = {
    "Anxiety", "Fear", "Distress", "Doubt", "Embarrassment",
    "Confusion", "Boredom", "Tiredness", "Sadness",
}


def _build_confidence_graph(
    audio_segments: list[dict], video_snapshots: list[dict]
) -> list[dict]:
    """Merge vocal emotion + visual presence signals into a unified confidence timeline.

    Each data point corresponds to a video snapshot timestamp.  The nearest
    audio segment is found and its dominant emotion modifies the raw visual
    composite score by ±15 % depending on positive/negative valence.
    """
    if not video_snapshots:
        return []

    result = []
    for snap in sorted(video_snapshots, key=lambda x: x["timestamp"]):
        ts = snap["timestamp"]

        # Find the audio segment whose window contains this timestamp
        containing = [s for s in audio_segments if s["start_time"] <= ts <= s["end_time"]]
        if not containing:
            # Fall back to nearest segment within ±3 s
            containing = [s for s in audio_segments if abs(s["start_time"] - ts) <= 3.0]

        dominant_emotion: Optional[str] = None
        emotion_score = 0.0
        if containing:
            seg = min(containing, key=lambda s: abs(s["start_time"] - ts))
            if seg["emotions"]:
                top = seg["emotions"][0]
                dominant_emotion = top["name"]
                emotion_score = top["score"]

        # Visual composite: weighted average of the four MediaPipe presence metrics
        visual = (
            snap["eye_contact_score"] * 0.35
            + snap["expression_score"] * 0.25
            + snap["posture_score"] * 0.25
            + snap["head_movement_score"] * 0.15
        )

        # Modulate by vocal emotion valence
        if dominant_emotion in _POSITIVE_EMOTIONS:
            modifier = 1.0 + emotion_score * 0.15
        elif dominant_emotion in _NEGATIVE_EMOTIONS:
            modifier = 1.0 - emotion_score * 0.15
        else:
            modifier = 1.0

        confidence = round(min(1.0, max(0.0, visual * modifier)), 3)

        result.append({
            "timestamp": ts,
            "confidence_score": confidence,
            "dominant_emotion": dominant_emotion,
            "eye_contact": snap["eye_contact_score"],
            "expression": snap["expression_score"],
            "posture": snap["posture_score"],
        })

    return result


# ---------------------------------------------------------------------------
# Agent prompts
# ---------------------------------------------------------------------------

_AUDIO_AGENT_PROMPT = """\
You are an expert vocal performance coach analyzing a startup founder's pitch delivery.

You have prosody emotion data captured every 1.5 seconds during the pitch.
Each segment lists the top emotions detected from the founder's voice, scored 0–1.

## Startup Context
{manifest}

## Pitching To
{investor_name} at {investor_company}

## Vocal Emotion Timeline
{audio_timeline}

Analyze the vocal performance and return a JSON object:
{{
  "vocal_confidence_score": <integer 0-100>,
  "confidence_trend": "<improving|declining|stable|fluctuating>",
  "pacing_score": <integer 0-100>,
  "emotion_highlights": [
    {{"timestamp": <seconds>, "emotion": "<name>", "score": <float 0-1>, "interpretation": "<1 sentence>"}}
  ],
  "key_vocal_patterns": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "vocal_summary": "<2–3 sentence honest assessment of vocal performance>"
}}

Return ONLY valid JSON. No markdown fences.\
"""

_VIDEO_AGENT_PROMPT = """\
You are an expert body language coach analyzing a startup founder's visual presence during a pitch.

Video metrics captured every ~5 seconds (all scored 0–1):
- eye_contact_score: Sustained eye contact with camera
- expression_score: Facial expressiveness and engagement
- posture_score: Upright, confident body positioning
- head_movement_score: Head stability (1 = calm, 0 = excessive movement)

## Startup Context
{manifest}

## Visual Presence Timeline
{video_timeline}

Analyze the visual presence and return a JSON object:
{{
  "visual_presence_score": <integer 0-100>,
  "avg_eye_contact": <float 0-1>,
  "avg_expression": <float 0-1>,
  "avg_posture": <float 0-1>,
  "visual_patterns": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "visual_summary": "<2–3 sentence honest assessment of visual presence>"
}}

Return ONLY valid JSON. No markdown fences.\
"""

_TRANSCRIPT_AGENT_PROMPT = """\
You are an expert pitch coach and content strategist analyzing the spoken content of a startup founder's pitch.

You have a timestamped transcript captured via speech-to-text during the live pitch.

## Startup Context
{manifest}

## Pitching To
{investor_name} at {investor_company}

## Timestamped Transcript
{transcript}

Analyze the pitch content deeply and return a JSON object:
{{
  "content_score": <integer 0-100, overall quality of what was said>,
  "clarity_score": <integer 0-100, how clear and understandable the language was>,
  "structure_score": <integer 0-100, how well-organized the pitch narrative was>,
  "word_count": <integer, approximate total words spoken>,
  "duration_quality": "<too short|adequate|optimal|too long>",
  "key_talking_points": ["<main point 1>", "<main point 2>", "<main point 3>"],
  "missing_elements": ["<important pitch element not addressed 1>", "<element 2>"],
  "filler_word_count": <integer, estimated count of filler words like um, uh, like, you know>,
  "standout_phrases": ["<memorable or effective phrase 1>", "<phrase 2>"],
  "content_patterns": ["<content insight 1>", "<content insight 2>", "<content insight 3>"],
  "transcript_summary": "<2–3 sentence honest assessment of pitch content quality>"
}}

If transcript is empty or very short, return scores of 0 and note the lack of content.
Return ONLY valid JSON. No markdown fences.\
"""

_SYNTHESIS_PROMPT = """\
You are an elite investment analyst delivering industrial-grade feedback on a startup pitch.

## Startup Manifest
{manifest}

## Target Investor
Name: {investor_name}
Company: {investor_company}
Notes: {investor_notes}

## Audio Analysis (Vocal Performance)
{audio_insights}

## Video Analysis (Visual Presence)
{video_insights}

## Transcript Analysis (Content Quality)
{transcript_insights}

Generate a comprehensive post-pitch analysis report as JSON:
{{
  "improvement_roadmap": [
    {{
      "section": "<Problem Statement|Solution|Market Opportunity|Business Model|Traction|Ask & Use of Funds|Overall Delivery>",
      "priority": "<Critical|High|Medium|Low>",
      "issue": "<specific problem identified from the pitch data>",
      "suggestion": "<concrete, actionable improvement step>"
    }}
  ],
  "verdict": {{
    "pre_seed_readiness_score": <integer 0-100>,
    "investor_persona_summary": "<brutal, honest, 2–3 paragraph assessment written in first person as {investor_name} at {investor_company} — reference specific observations from the audio, video, and transcript data, reflect the personality implied by the investor notes>",
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "critical_weaknesses": ["<weakness 1>", "<weakness 2>"],
    "go_decision": "<Strong Pass|Pass|Considering|Interested|Strong Interest>"
  }}
}}

Be brutally honest. Founders learn more from precise criticism than vague encouragement.
Return ONLY valid JSON. No markdown fences.\
"""


# ---------------------------------------------------------------------------
# Individual agent calls (run in parallel)
# ---------------------------------------------------------------------------


async def _run_audio_agent(llm: ChatGoogleGenerativeAI, state: PitchAnalysisState) -> dict:
    prompt = _AUDIO_AGENT_PROMPT.format(
        manifest=_format_manifest(state["manifest"]),
        investor_name=state["investor_name"],
        investor_company=state["investor_company"],
        audio_timeline=_format_audio_timeline(state["audio_segments"]),
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _parse_json_response(response.content)


async def _run_video_agent(llm: ChatGoogleGenerativeAI, state: PitchAnalysisState) -> dict:
    prompt = _VIDEO_AGENT_PROMPT.format(
        manifest=_format_manifest(state["manifest"]),
        video_timeline=_format_video_timeline(state["video_snapshots"]),
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _parse_json_response(response.content)


async def _run_transcript_agent(llm: ChatGoogleGenerativeAI, state: PitchAnalysisState) -> dict:
    prompt = _TRANSCRIPT_AGENT_PROMPT.format(
        manifest=_format_manifest(state["manifest"]),
        investor_name=state["investor_name"],
        investor_company=state["investor_company"],
        transcript=_format_transcript(state["transcripts"]),
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _parse_json_response(response.content)


async def _run_synthesis(
    llm: ChatGoogleGenerativeAI,
    state: PitchAnalysisState,
    audio_insights: dict,
    video_insights: dict,
    transcript_insights: dict,
) -> dict:
    prompt = _SYNTHESIS_PROMPT.format(
        manifest=_format_manifest(state["manifest"]),
        investor_name=state["investor_name"],
        investor_company=state["investor_company"],
        investor_notes=state["investor_notes"] or "No additional notes.",
        audio_insights=json.dumps(audio_insights, indent=2),
        video_insights=json.dumps(video_insights, indent=2),
        transcript_insights=json.dumps(transcript_insights, indent=2),
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return _parse_json_response(response.content)


# ---------------------------------------------------------------------------
# LangGraph nodes
# ---------------------------------------------------------------------------


def _build_graph():
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )

    async def run_parallel_agents(state: PitchAnalysisState) -> dict:
        """Fan-out: audio, video, and transcript agents execute concurrently."""
        audio_insights, video_insights, transcript_insights = await asyncio.gather(
            _run_audio_agent(llm, state),
            _run_video_agent(llm, state),
            _run_transcript_agent(llm, state),
        )
        return {
            "audio_insights": audio_insights,
            "video_insights": video_insights,
            "transcript_insights": transcript_insights,
        }

    async def synthesize(state: PitchAnalysisState) -> dict:
        """Fuse all three agent outputs + raw timeline into the final report."""
        synthesis = await _run_synthesis(
            llm,
            state,
            state["audio_insights"] or {},
            state["video_insights"] or {},
            state["transcript_insights"] or {},
        )
        confidence_graph = _build_confidence_graph(
            state["audio_segments"],
            state["video_snapshots"],
        )
        return {
            "improvement_roadmap": synthesis.get("improvement_roadmap", []),
            "confidence_graph": confidence_graph,
            "verdict": synthesis.get("verdict", {}),
        }

    graph = StateGraph(PitchAnalysisState)
    graph.add_node("run_parallel_agents", run_parallel_agents)
    graph.add_node("synthesize", synthesize)
    graph.add_edge(START, "run_parallel_agents")
    graph.add_edge("run_parallel_agents", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


# Compiled once at import time and reused across all requests
_graph = _build_graph()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


async def analyze_pitch(
    investor_name: str,
    investor_company: str,
    investor_notes: Optional[str],
    manifest: dict,
    audio_segments: list[dict],
    video_snapshots: list[dict],
    transcripts: list[dict],
) -> PitchAnalysisState:
    """Run the full multi-agent orchestration and return the final state."""
    initial: PitchAnalysisState = {
        "investor_name": investor_name,
        "investor_company": investor_company,
        "investor_notes": investor_notes,
        "manifest": manifest,
        "audio_segments": audio_segments,
        "video_snapshots": video_snapshots,
        "transcripts": transcripts,
        "audio_insights": None,
        "video_insights": None,
        "transcript_insights": None,
        "improvement_roadmap": None,
        "confidence_graph": None,
        "verdict": None,
    }
    return await _graph.ainvoke(initial)
