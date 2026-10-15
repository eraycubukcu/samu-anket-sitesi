"""/analyze istek modeli (sözleşme: docs/specs/faz-3-ml-servisi.md)."""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field

AnswerValue = Union[int, float, str, list[str], None]


class CourseInfo(BaseModel):
    code: str
    name: str = ""
    term: str = ""
    topics: list[str] = Field(default_factory=list)


class QuestionInfo(BaseModel):
    id: str
    type: Literal["rating", "radio", "checkbox", "text"]
    topic: str = ""
    dimension: str = ""
    options: list[str] = Field(default_factory=list)


class ResponseInfo(BaseModel):
    respondent: str = ""
    answers: dict[str, AnswerValue] = Field(default_factory=dict)


class PreviousTerm(BaseModel):
    term: str
    questions: list[QuestionInfo] = Field(default_factory=list)
    responses: list[ResponseInfo] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    course: CourseInfo
    questions: list[QuestionInfo]
    responses: list[ResponseInfo]
    previous_terms: list[PreviousTerm] = Field(default_factory=list)
    benchmarks: dict[str, list[float]] = Field(default_factory=dict)
