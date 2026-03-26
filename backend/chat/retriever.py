import os
import json
import logging
import numpy as np
from typing import List, Dict, Optional, Tuple

from config import Config

logger = logging.getLogger(__name__)

_sentence_model = None


def _get_sentence_model():
    """Lazy-load the sentence-transformers model (same one KeyBERT uses)."""
    global _sentence_model
    if _sentence_model is None:
        from sentence_transformers import SentenceTransformer
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("[Retriever] SentenceTransformer loaded.")
    return _sentence_model


def _find_json_file(directory: str) -> Optional[str]:
    """Find first .json file in a directory."""
    if not os.path.isdir(directory):
        return None
    for f in sorted(os.listdir(directory)):
        if f.endswith(".json"):
            return os.path.join(directory, f)
    return None


def load_chapter_data(subject_name: str) -> List[Dict]:
    """Load chapter JSON for a subject."""
    chapter_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    path = _find_json_file(chapter_dir)
    if not path:
        logger.warning(f"No chapter JSON found for '{subject_name}'")
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def load_question_data(subject_name: str) -> List[Dict]:
    """Load question JSON for a subject."""
    question_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    path = _find_json_file(question_dir)
    if not path:
        logger.warning(f"No question JSON found for '{subject_name}'")
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return data.get("questions", [])
    return data if isinstance(data, list) else []


def load_syllabus_data(subject_name: str) -> Dict:
    """Load syllabus JSON for a subject."""
    syllabus_dir = os.path.join(Config.SYLLABUS_JSON_DIR, subject_name)
    path = _find_json_file(syllabus_dir)
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _extract_query_keywords(query: str, top_n: int = 10) -> List[str]:
    """Extract keywords from the user query using KeyBERT."""
    try:
        from keybert import KeyBERT

        model = _get_sentence_model()
        kw_model = KeyBERT(model=model)
        results = kw_model.extract_keywords(
            query,
            keyphrase_ngram_range=(1, 2),
            stop_words="english",
            use_mmr=True,
            diversity=0.5,
            top_n=top_n,
        )
        return [kw.lower() for kw, _ in results]
    except Exception as e:
        logger.warning(f"KeyBERT extraction failed: {e}")
        stop_words = {
            "what", "is", "the", "a", "an", "of", "in", "to", "and",
            "for", "how", "why", "explain", "describe", "define", "list",
            "give", "write", "discuss", "about", "with", "can", "do",
            "does", "are", "was", "were", "be", "been", "being", "have",
            "has", "had", "will", "would", "could", "should", "may",
            "might", "shall", "this", "that", "these", "those", "it",
            "its", "my", "your", "our", "their", "me", "you", "us",
        }
        words = query.lower().split()
        return [w.strip("?.,!") for w in words if w.strip("?.,!") not in stop_words and len(w.strip("?.,!")) > 2]


def _keyword_overlap_score(query_keywords: List[str], target_keywords: List[str]) -> float:
    """Calculate keyword overlap between query and target keyword lists."""
    if not query_keywords or not target_keywords:
        return 0.0
    query_set = set(query_keywords)
    target_set = set(target_keywords)

    exact = len(query_set & target_set)

    partial = 0
    for qk in query_set:
        for tk in target_set:
            if qk != tk and (qk in tk or tk in qk):
                partial += 0.5

    return exact + partial


def _get_candidate_subtopics(
    query_keywords: List[str],
    chapters: List[Dict],
    top_k: int = 15,
) -> List[Dict]:
    """
    Stage 1: Score every subtopic by keyword overlap with the query.
    Returns top-K candidate subtopics with their metadata.
    """
    scored = []

    for chapter in chapters:
        chapter_id = chapter.get("chapter_id", "?")
        chapter_name = chapter.get("chapter_name", "Unknown")
        chapter_keywords = chapter.get("keywords", [])

        chapter_score = _keyword_overlap_score(query_keywords, chapter_keywords) * 0.3

        for subtopic in chapter.get("subtopics", []):
            sub_keywords = subtopic.get("keywords", [])
            sub_score = _keyword_overlap_score(query_keywords, sub_keywords)

            total_score = sub_score + chapter_score

            if total_score > 0:
                scored.append({
                    "chapter_id": chapter_id,
                    "chapter_name": chapter_name,
                    "subtopic_id": subtopic.get("subtopic_id", ""),
                    "subtopic_name": subtopic.get("subtopic_name", ""),
                    "paragraph": subtopic.get("paragraph", ""),
                    "keywords": sub_keywords,
                    "keyword_score": total_score,
                })

    scored.sort(key=lambda x: x["keyword_score"], reverse=True)
    return scored[:top_k]


def _semantic_rerank(
    query: str,
    candidates: List[Dict],
    top_k: int = 5,
) -> List[Dict]:
    if not candidates:
        return []

    model = _get_sentence_model()

    texts = []
    for c in candidates:
        text = f"{c['subtopic_name']}: {c['paragraph']}"
        texts.append(text)

    query_embedding = model.encode([query], normalize_embeddings=True)[0]
    candidate_embeddings = model.encode(texts, normalize_embeddings=True)

    similarities = np.dot(candidate_embeddings, query_embedding)

    max_kw = max(c["keyword_score"] for c in candidates) if candidates else 1.0
    if max_kw == 0:
        max_kw = 1.0

    for i, candidate in enumerate(candidates):
        kw_normalized = candidate["keyword_score"] / max_kw
        semantic = float(similarities[i])
        candidate["semantic_score"] = semantic
        candidate["combined_score"] = 0.4 * kw_normalized + 0.6 * semantic

    candidates.sort(key=lambda x: x["combined_score"], reverse=True)
    return candidates[:top_k]


def _find_related_questions(
    query: str,
    questions: List[Dict],
    top_k: int = 3,
) -> List[Dict]:
    """Find past paper questions related to the user's query."""
    if not questions:
        return []

    model = _get_sentence_model()

    question_texts = [q.get("question", "") for q in questions]
    if not question_texts:
        return []

    query_emb = model.encode([query], normalize_embeddings=True)[0]
    q_embs = model.encode(question_texts, normalize_embeddings=True)

    similarities = np.dot(q_embs, query_emb)

    scored = []
    for i, q in enumerate(questions):
        if similarities[i] > 0.3:
            scored.append({
                "question": q.get("question", ""),
                "similarity": float(similarities[i]),
                "freq": q.get("freq", 1),
                "years": q.get("years", []),
                "marks": q.get("marks", []),
                "chapter_id": q.get("chapter_id", []),
            })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]


def retrieve(
    query: str,
    subject_name: str,
    top_k: int = 5,
) -> Dict:
    """
    Full two-stage retrieval pipeline.

    Returns
    -------
    dict with keys:
        - chunks: list of retrieved context chunks (subtopic paragraphs)
        - related_questions: list of related past paper questions
        - metadata: retrieval metadata (scores, chapter info)
    """
    chapters = load_chapter_data(subject_name)
    questions = load_question_data(subject_name)

    if not chapters:
        return {
            "chunks": [],
            "related_questions": [],
            "metadata": {"error": f"No chapter data found for '{subject_name}'"},
        }

    query_keywords = _extract_query_keywords(query)
    logger.info(f"[Retriever] Query keywords: {query_keywords}")

    candidates = _get_candidate_subtopics(query_keywords, chapters, top_k=15)
    logger.info(f"[Retriever] Stage 1: {len(candidates)} keyword candidates")

    if not candidates:
        logger.info("[Retriever] No keyword matches, falling back to full semantic search")
        candidates = []
        for chapter in chapters:
            for subtopic in chapter.get("subtopics", []):
                candidates.append({
                    "chapter_id": chapter.get("chapter_id", "?"),
                    "chapter_name": chapter.get("chapter_name", "Unknown"),
                    "subtopic_id": subtopic.get("subtopic_id", ""),
                    "subtopic_name": subtopic.get("subtopic_name", ""),
                    "paragraph": subtopic.get("paragraph", ""),
                    "keywords": subtopic.get("keywords", []),
                    "keyword_score": 0.0,
                })

    reranked = _semantic_rerank(query, candidates, top_k=top_k)
    logger.info(f"[Retriever] Stage 2: {len(reranked)} final chunks")
    related_questions = _find_related_questions(query, questions, top_k=3)

    chunks = []
    for r in reranked:
        chunks.append({
            "chapter_id": r["chapter_id"],
            "chapter_name": r["chapter_name"],
            "subtopic_id": r["subtopic_id"],
            "subtopic_name": r["subtopic_name"],
            "content": r["paragraph"],
            "score": round(r.get("combined_score", 0), 4),
        })

    return {
        "chunks": chunks,
        "related_questions": related_questions,
        "metadata": {
            "query_keywords": query_keywords,
            "total_candidates": len(candidates),
            "subject": subject_name,
        },
    }