from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional

UBS_LABELS = [
    "plan_contact",
    "schedule_meeting",
    "update_contact_info_non_postal",
    "update_contact_info_postal_address",
    "update_kyc_activity",
    "update_kyc_origin_of_assets",
    "update_kyc_purpose_of_businessrelation",
    "update_kyc_total_assets",
]

class Evidence(BaseModel):
    start: int
    end: int
    text: str
    score: float

class LabelPrediction(BaseModel):
    label: Literal[tuple(UBS_LABELS)]
    score: float
    decision: bool
    evidence: List[Evidence] = Field(default_factory=list)

class PredictRequest(BaseModel):
    transcript: str
    provider: Literal["hf", "apertus"] = "hf"
    model_size: Literal["small", "large"] = "small"
    thresholds: Dict[str, float] = Field(default_factory=dict)

class PredictResponseMeta(BaseModel):
    provider: str
    modelId: Optional[str] = None
    runtimeMs: int

class PredictResponse(BaseModel):
    labels: List[LabelPrediction]
    meta: PredictResponseMeta

class EvaluateRequest(BaseModel):
    y_true: List[List[str]]
    y_pred: List[List[str]]
