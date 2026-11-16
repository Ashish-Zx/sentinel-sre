"""A minimal LangGraph-style DAG orchestrator.

Models the multi-agent investigation as a graph of nodes with dependencies,
and runs them topologically. Nodes with no ordering constraint at the same
depth are fanned out concurrently (matching LangGraph's ``Send()`` semantics).
"""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Node:
    key: str
    fn: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
    deps: list[str] = field(default_factory=list)


class Graph:
    def __init__(self) -> None:
        self._nodes: dict[str, Node] = {}

    def add_node(self, node: Node) -> "Graph":
        self._nodes[node.key] = node
        return self

    def _topological_levels(self) -> list[list[str]]:
        levels: list[list[str]] = []
        remaining = set(self._nodes)
        while remaining:
            level = [
                key
                for key in remaining
                if all(dep not in remaining for dep in self._nodes[key].deps)
            ]
            if not level:
                # cycle guard - just drain whatever is left
                level = list(remaining)
            levels.append(level)
            remaining -= set(level)
        return levels

    async def run(self, seed: dict[str, Any]) -> dict[str, Any]:
        state: dict[str, Any] = dict(seed)
        for level in self._topological_levels():
            # Concurrent fan-out for nodes in the same level
            results = await asyncio.gather(
                *(self._nodes[key].fn(state) for key in level)
            )
            for key, result in zip(level, results):
                state[key] = result
        return state
