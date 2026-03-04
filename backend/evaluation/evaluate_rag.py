"""
RAG Evaluation Script
=====================
Evaluates the RAG pipeline using the generated dataset.

Metrics:
1. Context Recall    — Do retrieved chunks cover the ground truth context?
2. Answer Relevancy  — Is the generated answer relevant to the question?
3. Faithfulness      — Is the answer grounded in retrieved chunks (not hallucinated)?
4. Answer Correctness — Does the generated answer match the ground truth answer?

All metrics use cosine similarity (sentence-transformers). No LLM needed.

Usage:
    cd backend
    python -m evaluation.evaluate_rag --subject AI --samples 20
    python -m evaluation.evaluate_rag --all --samples 10
"""

import os
import sys
import json
import time
import logging
import argparse
import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config
from chat.chat_engine import chat
from chat.retriever import retrieve

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)

# ── Sentence model ──────────────────────────────────────────────────

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("[Eval] SentenceTransformer loaded.")
    return _model


# ── Similarity helpers ──────────────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def semantic_similarity(text_a: str, text_b: str) -> float:
    """Compute semantic similarity between two texts."""
    model = _get_model()
    embeddings = model.encode([text_a, text_b], normalize_embeddings=True)
    return cosine_similarity(embeddings[0], embeddings[1])


def chunk_similarity(text: str, chunks: List[str]) -> float:
    """
    Max similarity between a text and a list of chunks.
    Measures how well the chunks cover the text.
    """
    if not chunks:
        return 0.0
    model = _get_model()
    text_emb = model.encode([text], normalize_embeddings=True)[0]
    chunk_embs = model.encode(chunks, normalize_embeddings=True)
    similarities = np.dot(chunk_embs, text_emb)
    return float(np.max(similarities))


def coverage_score(ground_truth: str, chunks: List[str], window_size: int = 3) -> float:
    """
    Measures how well retrieved chunks cover the ground truth context.
    Splits ground truth into sentences and checks coverage.
    """
    if not chunks or not ground_truth.strip():
        return 0.0

    import re
    sentences = re.split(r'(?<=[.!?])\s+', ground_truth)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

    if not sentences:
        return chunk_similarity(ground_truth, chunks)

    model = _get_model()
    combined_chunks = " ".join(chunks)

    # For efficiency, compute sentence-level coverage
    sent_embs = model.encode(sentences, normalize_embeddings=True)
    chunk_embs = model.encode(chunks, normalize_embeddings=True)

    covered = 0
    for sent_emb in sent_embs:
        sims = np.dot(chunk_embs, sent_emb)
        if np.max(sims) > 0.4:  # threshold for "covered"
            covered += 1

    return covered / len(sentences) if sentences else 0.0


# ── Faithfulness (grounding check) ──────────────────────────────────

def faithfulness_score(answer: str, retrieved_chunks: List[str]) -> float:
    """
    Measures whether the answer is grounded in the retrieved chunks.
    Splits answer into sentences and checks if each is supported by chunks.
    """
    if not answer.strip() or not retrieved_chunks:
        return 0.0

    import re
    # Remove markdown formatting
    clean_answer = re.sub(r'[#*`]', '', answer)
    clean_answer = re.sub(r'\[\d+\]', '', clean_answer)  # remove citations

    sentences = re.split(r'(?<=[.!?])\s+', clean_answer)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

    if not sentences:
        return 1.0  # very short answer, assume grounded

    model = _get_model()
    sent_embs = model.encode(sentences, normalize_embeddings=True)
    chunk_embs = model.encode(retrieved_chunks, normalize_embeddings=True)

    grounded = 0
    for sent_emb in sent_embs:
        sims = np.dot(chunk_embs, sent_emb)
        if np.max(sims) > 0.45:  # threshold for "grounded"
            grounded += 1

    return grounded / len(sentences)


# ── Load dataset ────────────────────────────────────────────────────

def load_dataset(subject_name: str) -> List[Dict]:
    """Load the generated dataset for a subject."""
    path = os.path.join(
        Config.DATASETS_DIR, "generated_datasets", f"{subject_name}_dataset.json"
    )
    if not os.path.exists(path):
        logger.error(f"Dataset not found: {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def get_available_subjects() -> List[str]:
    """Get list of subjects that have datasets."""
    dataset_dir = os.path.join(Config.DATASETS_DIR, "generated_datasets")
    if not os.path.isdir(dataset_dir):
        return []
    subjects = []
    for f in sorted(os.listdir(dataset_dir)):
        if f.endswith("_dataset.json"):
            name = f.replace("_dataset.json", "")
            subjects.append(name)
    return subjects


# ── Single sample evaluation ────────────────────────────────────────

def evaluate_sample(
    question: str,
    ground_truth_context: str,
    ground_truth_answer: str,
    subject_name: str,
) -> Dict:
    """
    Evaluate a single Q&A sample through the RAG pipeline.

    Returns dict with all metric scores.
    """
    # Step 1: Run retrieval
    retrieval_result = retrieve(question, subject_name, top_k=8)
    retrieved_chunks = [c.get("content", "") for c in retrieval_result["chunks"]]
    retrieved_metadata = [
        {
            "chapter_id": c.get("chapter_id"),
            "chapter_name": c.get("chapter_name"),
            "subtopic_name": c.get("subtopic_name"),
            "score": c.get("score", 0),
        }
        for c in retrieval_result["chunks"]
    ]

    # Step 2: Run full chat pipeline
    try:
        chat_result = chat(query=question, subject_name=subject_name)
        generated_answer = chat_result["answer"]
    except Exception as e:
        logger.warning(f"Chat failed for question: {question[:50]}... Error: {e}")
        generated_answer = ""

    # Step 3: Compute metrics

    # Metric 1: Context Recall
    # How well do retrieved chunks cover the ground truth context?
    ctx_recall = coverage_score(ground_truth_context, retrieved_chunks)

    # Metric 2: Answer Relevancy
    # Is the generated answer relevant to the question?
    ans_relevancy = semantic_similarity(question, generated_answer) if generated_answer else 0.0

    # Metric 3: Faithfulness
    # Is the generated answer grounded in the retrieved chunks?
    faith = faithfulness_score(generated_answer, retrieved_chunks) if generated_answer else 0.0

    # Metric 4: Answer Correctness
    # Does the generated answer match the ground truth answer?
    ans_correct = semantic_similarity(ground_truth_answer, generated_answer) if generated_answer else 0.0

    # Metric 5: Context Precision (bonus)
    # Are the top retrieved chunks actually relevant to the question?
    ctx_precision = chunk_similarity(question, retrieved_chunks) if retrieved_chunks else 0.0

    return {
        "question": question,
        "ground_truth_answer_preview": ground_truth_answer[:200],
        "generated_answer_preview": generated_answer[:200],
        "num_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chapters": [m["chapter_name"] for m in retrieved_metadata],
        "metrics": {
            "context_recall": round(ctx_recall, 4),
            "context_precision": round(ctx_precision, 4),
            "answer_relevancy": round(ans_relevancy, 4),
            "faithfulness": round(faith, 4),
            "answer_correctness": round(ans_correct, 4),
        },
    }


# ── Full evaluation ────────────────────────────────────────────────

def evaluate_subject(
    subject_name: str,
    max_samples: int = 20,
    delay: float = 2.0,
) -> Dict:
    """
    Evaluate the RAG pipeline for a subject using its dataset.

    Parameters
    ----------
    subject_name : str
        Subject name matching the dataset file.
    max_samples : int
        Maximum number of samples to evaluate.
    delay : float
        Delay between API calls to avoid rate limiting.

    Returns
    -------
    dict with per-sample results and aggregate metrics.
    """
    dataset = load_dataset(subject_name)
    if not dataset:
        return {"error": f"No dataset found for '{subject_name}'"}

    # Filter samples that have all required fields
    valid_samples = [
        d for d in dataset
        if d.get("question") and d.get("context") and d.get("answer")
    ]

    if not valid_samples:
        return {"error": f"No valid samples in dataset for '{subject_name}'"}

    # Sample selection: spread across the dataset
    import random
    random.seed(42)  # reproducible
    if len(valid_samples) > max_samples:
        # Take evenly spaced samples
        step = len(valid_samples) / max_samples
        indices = [int(i * step) for i in range(max_samples)]
        selected = [valid_samples[i] for i in indices]
    else:
        selected = valid_samples

    logger.info(f"[Eval] Evaluating {len(selected)} samples for '{subject_name}'")

    results = []
    for i, sample in enumerate(selected):
        logger.info(f"[Eval] Sample {i + 1}/{len(selected)}: {sample['question'][:60]}...")

        try:
            result = evaluate_sample(
                question=sample["question"],
                ground_truth_context=sample["context"],
                ground_truth_answer=sample["answer"],
                subject_name=subject_name,
            )
            results.append(result)
        except Exception as e:
            logger.error(f"[Eval] Failed on sample {i + 1}: {e}")
            results.append({
                "question": sample["question"][:100],
                "error": str(e),
                "metrics": {
                    "context_recall": 0,
                    "context_precision": 0,
                    "answer_relevancy": 0,
                    "faithfulness": 0,
                    "answer_correctness": 0,
                },
            })

        # Rate limit delay
        if delay > 0 and i < len(selected) - 1:
            time.sleep(delay)

    # Aggregate metrics
    metric_keys = ["context_recall", "context_precision", "answer_relevancy", "faithfulness", "answer_correctness"]
    aggregates = {}
    for key in metric_keys:
        values = [r["metrics"][key] for r in results if key in r.get("metrics", {})]
        if values:
            aggregates[key] = {
                "mean": round(np.mean(values), 4),
                "std": round(np.std(values), 4),
                "min": round(np.min(values), 4),
                "max": round(np.max(values), 4),
                "median": round(np.median(values), 4),
            }

    return {
        "subject": subject_name,
        "total_samples": len(results),
        "evaluated_at": datetime.now().isoformat(),
        "aggregate_metrics": aggregates,
        "per_sample_results": results,
    }


def print_report(evaluation: Dict):
    """Print a formatted evaluation report."""
    if "error" in evaluation:
        print(f"\n❌ Error: {evaluation['error']}")
        return

    print("\n" + "=" * 70)
    print(f"  RAG EVALUATION REPORT — {evaluation['subject'].upper()}")
    print(f"  Samples: {evaluation['total_samples']}  |  {evaluation['evaluated_at']}")
    print("=" * 70)

    agg = evaluation.get("aggregate_metrics", {})

    print("\n  METRIC                    MEAN    STD     MIN     MAX     MEDIAN")
    print("  " + "-" * 64)

    labels = {
        "context_recall": "Context Recall",
        "context_precision": "Context Precision",
        "answer_relevancy": "Answer Relevancy",
        "faithfulness": "Faithfulness",
        "answer_correctness": "Answer Correctness",
    }

    for key, label in labels.items():
        if key in agg:
            m = agg[key]
            print(
                f"  {label:<24s} {m['mean']:.4f}  {m['std']:.4f}  "
                f"{m['min']:.4f}  {m['max']:.4f}  {m['median']:.4f}"
            )

    # Overall score (weighted average)
    weights = {
        "context_recall": 0.2,
        "context_precision": 0.15,
        "answer_relevancy": 0.2,
        "faithfulness": 0.25,
        "answer_correctness": 0.2,
    }
    overall = sum(
        agg[k]["mean"] * w for k, w in weights.items() if k in agg
    )
    total_weight = sum(w for k, w in weights.items() if k in agg)
    if total_weight > 0:
        overall /= total_weight
    print(f"\n  {'OVERALL SCORE':<24s} {overall:.4f}")

    # Grade
    if overall >= 0.8:
        grade = "A (Excellent)"
    elif overall >= 0.65:
        grade = "B (Good)"
    elif overall >= 0.5:
        grade = "C (Fair)"
    elif overall >= 0.35:
        grade = "D (Poor)"
    else:
        grade = "F (Very Poor)"
    print(f"  {'GRADE':<24s} {grade}")

    print("\n" + "=" * 70)

    # Show worst samples
    results = evaluation.get("per_sample_results", [])
    if results:
        print("\n  BOTTOM 3 SAMPLES (lowest answer correctness):")
        print("  " + "-" * 64)
        sorted_results = sorted(
            results,
            key=lambda r: r.get("metrics", {}).get("answer_correctness", 0),
        )
        for r in sorted_results[:3]:
            q = r.get("question", "")[:80]
            ac = r.get("metrics", {}).get("answer_correctness", 0)
            faith = r.get("metrics", {}).get("faithfulness", 0)
            print(f"  [{ac:.3f}] {q}...")
            print(f"          faithfulness={faith:.3f}")

    print()


# ── Save results ────────────────────────────────────────────────────

def save_results(evaluation: Dict, subject_name: str):
    """Save evaluation results to JSON."""
    output_dir = os.path.join(Config.DATASETS_DIR, "evaluation_results")
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{subject_name}_eval_{timestamp}.json"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(evaluation, f, indent=2, ensure_ascii=False)

    logger.info(f"[Eval] Results saved to {filepath}")
    return filepath


# ── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Evaluate the RAG pipeline")
    parser.add_argument(
        "--subject", type=str, default=None,
        help="Subject name (e.g., AI, DBMS, os). Omit for --all.",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Evaluate all available subjects.",
    )
    parser.add_argument(
        "--samples", type=int, default=10,
        help="Max samples per subject (default: 10).",
    )
    parser.add_argument(
        "--delay", type=float, default=3.0,
        help="Delay between API calls in seconds (default: 3.0).",
    )
    parser.add_argument(
        "--save", action="store_true", default=True,
        help="Save results to JSON (default: True).",
    )

    args = parser.parse_args()

    if args.all:
        subjects = get_available_subjects()
        if not subjects:
            print("No datasets found in generated_datasets/")
            return
        print(f"Found {len(subjects)} subjects: {', '.join(subjects)}")
    elif args.subject:
        subjects = [args.subject]
    else:
        subjects = get_available_subjects()
        if not subjects:
            print("No datasets found. Specify --subject or ensure datasets exist.")
            return
        print(f"Found {len(subjects)} subjects: {', '.join(subjects)}")
        print("Use --subject NAME to evaluate one, or --all for all.\n")
        # Default: evaluate first subject
        subjects = [subjects[0]]

    all_results = {}
    for subject in subjects:
        print(f"\n{'━' * 70}")
        print(f"  Evaluating: {subject}")
        print(f"{'━' * 70}")

        evaluation = evaluate_subject(
            subject_name=subject,
            max_samples=args.samples,
            delay=args.delay,
        )

        print_report(evaluation)

        if args.save:
            save_results(evaluation, subject)

        all_results[subject] = evaluation

    # Summary across all subjects
    if len(subjects) > 1:
        print("\n" + "=" * 70)
        print("  CROSS-SUBJECT SUMMARY")
        print("=" * 70)
        print(f"\n  {'SUBJECT':<15s} {'CTX_RCL':>8s} {'CTX_PRC':>8s} {'ANS_REL':>8s} {'FAITH':>8s} {'ANS_COR':>8s} {'OVERALL':>8s}")
        print("  " + "-" * 63)

        for subject, ev in all_results.items():
            if "error" in ev:
                print(f"  {subject:<15s} ERROR: {ev['error']}")
                continue
            agg = ev.get("aggregate_metrics", {})
            vals = {k: agg.get(k, {}).get("mean", 0) for k in [
                "context_recall", "context_precision", "answer_relevancy",
                "faithfulness", "answer_correctness"
            ]}
            weights = {"context_recall": 0.2, "context_precision": 0.15,
                       "answer_relevancy": 0.2, "faithfulness": 0.25, "answer_correctness": 0.2}
            overall = sum(vals[k] * weights[k] for k in weights) / sum(weights.values())
            print(
                f"  {subject:<15s} {vals['context_recall']:>8.4f} {vals['context_precision']:>8.4f} "
                f"{vals['answer_relevancy']:>8.4f} {vals['faithfulness']:>8.4f} "
                f"{vals['answer_correctness']:>8.4f} {overall:>8.4f}"
            )
        print()


if __name__ == "__main__":
    main()