"""Claude through the official Anthropic SDK.

The agent runs without it. With ``ANTHROPIC_API_KEY`` set and the ``anthropic``
package installed, Claude becomes the agent's brain: it chooses the tools and
writes the brief, while the tools still do every calculation.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Protocol, cast


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class Reply:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = "end_turn"
    content: Any = None  # the assistant turn exactly as returned, to send back


class Model(Protocol):
    name: str

    def reply(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> Reply: ...


class Claude:
    """A thin wrapper so the agent loop can also run against a stand-in in tests."""

    def __init__(self, api_key: str, model: str, max_tokens: int = 2048) -> None:
        import anthropic

        self.name = model
        self._max_tokens = max_tokens
        self._client = anthropic.Anthropic(api_key=api_key)

    def reply(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> Reply:
        response = self._client.messages.create(
            model=self.name,
            max_tokens=self._max_tokens,
            system=system,
            messages=cast(Any, messages),
            tools=cast(Any, tools),
        )
        if response.stop_reason == "refusal":
            return Reply(text="", stop_reason="refusal", content=response.content)
        text = "".join(block.text for block in response.content if block.type == "text")
        calls = [
            ToolCall(id=block.id, name=block.name, arguments=dict(block.input))
            for block in response.content
            if block.type == "tool_use"
        ]
        return Reply(
            text=text,
            tool_calls=calls,
            stop_reason=response.stop_reason or "end_turn",
            content=response.content,
        )


def connect(model: str) -> Model | None:
    """Claude when a key and the SDK are both present, otherwise nothing."""
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return None
    try:
        return Claude(key, model)
    except ImportError:
        return None
