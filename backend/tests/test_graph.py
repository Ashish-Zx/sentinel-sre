import asyncio
from datetime import datetime

import pytest

from backend.services.graph import Graph, Node


async def test_empty_graph_runs():
    g = Graph()
    assert await g.run({}) == {}


async def test_parallel_fanout_runs_all_nodes():
    g = Graph()
    ran = []

    async def mk(name):
        async def fn(state, _name=name):
            await asyncio.sleep(0.01)
            ran.append(_name)
            return {_name: f"done-{_name}"}
        return Node(key=name, fn=fn)

    for n in ["a", "b", "c", "d"]:
        g.add_node(await mk(n))

    state = await g.run({})
    assert set(ran) == {"a", "b", "c", "d"}
    for n in ["a", "b", "c", "d"]:
        assert state[n] == {n: f"done-{n}"}


async def test_topological_dependency_ordering():
    g = Graph()
    order = []

    async def mk(name):
        async def fn(state, _name=name):
            order.append(_name)
            return {_name: True}
        return Node(key=name, fn=fn)

    # C depends on A and B
    a = await mk("A")
    b = await mk("B")
    c = Node(key="C", fn=(await mk("C")).fn, deps=["A", "B"])
    g.add_node(a).add_node(b).add_node(c)

    await g.run({})
    assert order.index("A") < order.index("C")
    assert order.index("B") < order.index("C")


async def test_dependency_results_available_to_dependents():
    g = Graph()

    a = Node(key="A", fn=lambda state: _ret(state, {"val": 5}))
    b = Node(key="B", fn=lambda state: _ret(state, {"seen": state["A"]["val"]}), deps=["A"])
    g.add_node(a).add_node(b)

    state = await g.run({})
    assert state["B"]["seen"] == 5


async def _ret(state, payload):
    return payload
