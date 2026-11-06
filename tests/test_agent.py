"""The agent loop, with the built-in brain and with a stand-in for Claude."""

from __future__ import annotations

import json

import pytest

from warehouse_planner.agent import BUILT_IN, run_agent
from warehouse_planner.guard import ungrounded
from warehouse_planner.llm import Reply, ToolCall


def test_the_rules_take_every_step_in_order(plan):
    tools = [s.tool for s in plan.steps if s.kind == "act"]
    assert tools == [
        "read_orders",
        "check_yesterday",
        "compare_forecast_methods",
        "forecast_demand",
        "find_skus_in_demand",
        "plan_replenishment",
        "plan_workers",
        "check_plan",
    ]
    kinds = [s.kind for s in plan.steps]
    assert kinds.count("decide") == 2
    assert kinds[-1] == "report"
    assert plan.brain == BUILT_IN
    assert plan.decisions["method"] == plan.results["methods"]["best"]


def test_the_plan_is_plain_json(plan):
    data = json.loads(json.dumps(plan.as_dict()))
    assert data["brief"] == plan.brief
    assert {"forecast", "skus", "replenishment", "workers", "checks", "steps"} <= set(data)


def test_every_number_in_the_rules_brief_comes_from_a_tool(plan):
    assert ungrounded(plan.brief, plan.results) == []


def test_too_little_history_is_sent_to_a_person(warehouse):
    plan = run_agent(warehouse, warehouse.days[5], brain="rules")
    assert plan.steps[1].kind == "escalate"
    assert not plan.results["forecast"]


def test_staffing_goes_high_after_a_run_of_busy_days(warehouse):
    for day in warehouse.plan_days():
        plan = run_agent(warehouse, day, brain="rules")
        if plan.results["yesterday"]["days_above_forecast_of_last_5"] >= 4:
            assert plan.decisions["staff_to"] == "high"
            break
    else:
        pytest.fail("no busy run in the records")


class StandIn:
    """Replays a script of replies, and keeps what the agent sent back."""

    name = "stand-in"

    def __init__(self, turns):
        self.turns = list(turns)
        self.sent = []

    def reply(self, system, messages, tools):
        self.sent.append(messages[-1])
        assert {t["name"] for t in tools} >= {"forecast_demand", "plan_workers"}
        return self.turns.pop(0)


def call(*names_and_args):
    calls = [ToolCall(str(i), name, args) for i, (name, args) in enumerate(names_and_args)]
    return Reply(text="", tool_calls=calls, stop_reason="tool_use", content=["placeholder"])


FULL = [
    call(("read_orders", {}), ("check_yesterday", {})),
    call(("compare_forecast_methods", {})),
    call(("forecast_demand", {"method": "last_week"})),
    call(("find_skus_in_demand", {}), ("plan_replenishment", {})),
    call(("plan_workers", {"staff_to": "high"})),
    call(("check_plan", {})),
]


def test_claude_chooses_and_a_clean_brief_is_kept(warehouse, day):
    brief = "A steady day. Bring the listed boxes down before picking, nearest first."
    model = StandIn([*FULL, Reply(text=brief)])
    plan = run_agent(warehouse, day, brain="claude", model=model)
    assert plan.brief == brief
    assert plan.brain == "Claude (stand-in)"
    assert plan.decisions == {
        "method": "last_week",
        "staff_to": "high",
        "method_name": "Same weekday last week",
    }
    assert any("Every number" in s.text for s in plan.steps if s.kind == "check")


def test_a_brief_with_an_invented_number_is_thrown_out(warehouse, day):
    model = StandIn([*FULL, Reply(text="Expect 987,654 pairs today.")])
    plan = run_agent(warehouse, day, brain="claude", model=model)
    assert "987" not in plan.brief
    assert any("987654" in s.text for s in plan.steps if s.kind == "check")
    assert ungrounded(plan.brief, plan.results) == []


def test_a_tool_called_too_early_is_refused_and_explained(warehouse, day):
    model = StandIn([call(("plan_replenishment", {})), *FULL, Reply(text="Done.")])
    run_agent(warehouse, day, brain="claude", model=model)
    refusal = model.sent[1]["content"][0]
    assert refusal["is_error"] is True
    assert "forecast_demand first" in refusal["content"]


def test_what_claude_skips_the_rules_complete(warehouse, day):
    model = StandIn([call(("read_orders", {})), Reply(text="Nothing to add.")])
    plan = run_agent(warehouse, day, brain="claude", model=model)
    assert plan.results["workers"]["staff_to"] == "expected"
    assert plan.results["replenishment"]["moves"]
    notes = " ".join(s.text for s in plan.steps if s.kind == "check")
    assert "Claude did not forecast" in notes and "Claude skipped plan_replenishment" in notes


def test_asking_for_claude_without_a_key_says_so(warehouse, day):
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        run_agent(warehouse, day, brain="claude")


def test_auto_without_a_key_uses_the_rules(warehouse, day):
    assert run_agent(warehouse, day).brain == BUILT_IN
