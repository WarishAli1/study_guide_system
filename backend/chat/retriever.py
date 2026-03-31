import os
import json
import logging
import numpy as np
from typing import List, Dict, Optional

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

def _find_all_json_files(directory: str) -> List[str]:
    """Find ALL .json files in a directory."""
    if not os.path.isdir(directory):
        return []
    return [
        os.path.join(directory, f)
        for f in sorted(os.listdir(directory))
        if f.endswith(".json")
    ]


def load_chapter_data(subject_name: str) -> List[Dict]:
    """Load ALL chapter JSON files for a subject."""
    chapter_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    paths = _find_all_json_files(chapter_dir)
    if not paths:
        logger.warning(f"No chapter JSON found for '{subject_name}' in {chapter_dir}")
        return []

    all_chapters = []
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                all_chapters.extend(data)
            elif isinstance(data, dict):
                all_chapters.append(data)
            logger.info(f"[Retriever] Loaded {path}: "
                        f"{len(data) if isinstance(data, list) else 1} chapter(s)")
        except Exception as e:
            logger.error(f"[Retriever] Failed to load {path}: {e}")

    logger.info(f"[Retriever] Total chapters loaded for '{subject_name}': {len(all_chapters)}")
    return all_chapters


def _find_all_json_files(directory: str) -> List[str]:
    """Find ALL .json files in a directory."""
    if not os.path.isdir(directory):
        return []
    return [
        os.path.join(directory, f)
        for f in sorted(os.listdir(directory))
        if f.endswith(".json")
    ]


def load_question_data(subject_name: str) -> List[Dict]:
    """Load ALL question JSON files for a subject."""
    question_dir = os.path.join(Config.QUESTION_JSON_DIR, subject_name)
    paths = _find_all_json_files(question_dir)
    if not paths:
        logger.warning(f"No question JSON found for '{subject_name}'")
        return []

    all_questions = []
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                all_questions.extend(data.get("questions", []))
            elif isinstance(data, list):
                all_questions.extend(data)
        except Exception as e:
            logger.error(f"[Retriever] Failed to load {path}: {e}")

    logger.info(f"[Retriever] Total questions loaded for '{subject_name}': {len(all_questions)}")
    return all_questions


def load_syllabus_data(subject_name: str) -> Dict:
    """Load syllabus JSON for a subject."""
    syllabus_dir = os.path.join(Config.SYLLABUS_JSON_DIR, subject_name)
    paths = _find_all_json_files(syllabus_dir)
    if not paths:
        return {}
    # Syllabus is typically one file, but merge if multiple
    merged = {"chapters": []}
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                if "chapters" in data:
                    merged["chapters"].extend(data["chapters"])
                else:
                    merged.update(data)
        except Exception as e:
            logger.error(f"[Retriever] Failed to load syllabus {path}: {e}")
    return merged

def _extract_query_keywords(query: str, top_n: int = 10) -> List[str]:
    """Extract keywords from the user query using KeyBERT."""
    try:
        from keybert import KeyBERT

        model = _get_sentence_model()
        kw_model = KeyBERT(model=model)
        results = kw_model.extract_keywords(
            query,
            keyphrase_ngram_range=(1, 3),
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


def _build_all_subtopics(chapters: List[Dict]) -> List[Dict]:
    """Flatten all chapters into a list of subtopic dicts with metadata."""
    all_subtopics = []
    for chapter in chapters:
        chapter_id = chapter.get("chapter_id", "?")
        chapter_name = chapter.get("chapter_name", "Unknown")
        chapter_keywords = chapter.get("keywords", [])

        for subtopic in chapter.get("subtopics", []):
            paragraph = subtopic.get("paragraph", "")
            if not paragraph or len(paragraph.strip()) < 20:
                continue
            all_subtopics.append({
                "chapter_id": chapter_id,
                "chapter_name": chapter_name,
                "chapter_keywords": chapter_keywords,
                "subtopic_id": subtopic.get("subtopic_id", ""),
                "subtopic_name": subtopic.get("subtopic_name", ""),
                "paragraph": paragraph,
                "keywords": subtopic.get("keywords", []),
            })
    return all_subtopics


_cross_encoder = None


def _get_cross_encoder():
    """Lazy-load cross-encoder for reranking."""
    global _cross_encoder
    if _cross_encoder is None:
        from sentence_transformers import CrossEncoder
        _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        logger.info("[Retriever] CrossEncoder loaded.")
    return _cross_encoder


def _hybrid_retrieve(
    query: str,
    query_keywords: List[str],
    all_subtopics: List[Dict],
    top_k: int = 5,
) -> List[Dict]:
    """
    Three-stage hybrid retrieval:
    1. Bi-encoder: compute keyword + semantic scores for ALL subtopics
    2. Select top-20 candidates
    3. Cross-encoder rerank: score query-document pairs together for true top-k

    The cross-encoder sees query and document simultaneously,
    making it dramatically more accurate than bi-encoder alone.
    """
    if not all_subtopics:
        return []

    model = _get_sentence_model()

    # ── Stage 1: Bi-encoder scoring (fast, broad) ────────────────

    for sub in all_subtopics:
        ch_kw_score = _keyword_overlap_score(query_keywords, sub.get("chapter_keywords", [])) * 0.3
        sub_kw_score = _keyword_overlap_score(query_keywords, sub["keywords"])
        name_words = sub["subtopic_name"].lower().split()
        name_overlap = _keyword_overlap_score(query_keywords, name_words) * 0.5
        sub["keyword_score"] = sub_kw_score + ch_kw_score + name_overlap

    texts = [f"{sub['subtopic_name']}. {sub['paragraph'][:500]}" for sub in all_subtopics]
    query_embedding = model.encode([query], normalize_embeddings=True)[0]
    candidate_embeddings = model.encode(texts, normalize_embeddings=True, batch_size=64)
    semantic_scores = np.dot(candidate_embeddings, query_embedding)

    max_kw = max((sub["keyword_score"] for sub in all_subtopics), default=1.0)
    if max_kw == 0:
        max_kw = 1.0

    for i, sub in enumerate(all_subtopics):
        kw_normalized = sub["keyword_score"] / max_kw
        semantic = float(semantic_scores[i])
        sub["semantic_score"] = semantic
        sub["biencoder_score"] = 0.25 * kw_normalized + 0.75 * semantic

    # ── Stage 2: Select top-20 for cross-encoder ─────────────────

    all_subtopics_sorted = sorted(all_subtopics, key=lambda x: x["biencoder_score"], reverse=True)
    top_candidates = all_subtopics_sorted[:20]

    logger.info(f"[Retriever] Stage 1 (bi-encoder): top-20 from "
                f"{len(set(str(s['chapter_id']) for s in top_candidates))} chapters")

    # ── Stage 3: Cross-encoder reranking (accurate, slow) ────────

    try:
        cross_encoder = _get_cross_encoder()

        pairs = [
            [query, f"{sub['subtopic_name']}. {sub['paragraph'][:800]}"]
            for sub in top_candidates
        ]

        cross_scores = cross_encoder.predict(pairs)

        for i, sub in enumerate(top_candidates):
            sub["cross_score"] = float(cross_scores[i])

        # Sort by cross-encoder score (most accurate)
        top_candidates.sort(key=lambda x: x["cross_score"], reverse=True)

        logger.info(f"[Retriever] Stage 2 (cross-encoder): reranked, "
                    f"top chapter = Ch {top_candidates[0]['chapter_id']}")

    except Exception as e:
        logger.warning(f"[Retriever] Cross-encoder failed, falling back to bi-encoder: {e}")
        # Fall back to bi-encoder scores
        for sub in top_candidates:
            sub["cross_score"] = sub["biencoder_score"]

    # ── Stage 4: Diversity-aware selection ────────────────────────

    selected = []
    chapter_counts: Dict[str, int] = {}
    max_per_chapter = max(3, top_k // 2)

    for sub in top_candidates:
        ch_key = str(sub["chapter_id"])
        current_count = chapter_counts.get(ch_key, 0)

        if current_count < max_per_chapter:
            selected.append(sub)
            chapter_counts[ch_key] = current_count + 1
            if len(selected) >= top_k:
                break

    # Fill remaining if diversity constraint was too strict
    if len(selected) < top_k:
        selected_ids = {(s["chapter_id"], s["subtopic_id"]) for s in selected}
        for sub in top_candidates:
            key = (sub["chapter_id"], sub["subtopic_id"])
            if key not in selected_ids:
                selected.append(sub)
                selected_ids.add(key)
                if len(selected) >= top_k:
                    break

    # Use cross_score as the final combined_score
    for sub in selected:
        sub["combined_score"] = sub.get("cross_score", sub.get("biencoder_score", 0))

    logger.info(
        f"[Retriever] Final: {len(selected)} chunks from chapters "
        f"{sorted(set(str(s['chapter_id']) for s in selected))}"
    )

    return selected


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
    Hybrid retrieval pipeline.

    1. Flatten all subtopics from all chapters
    2. Compute keyword + semantic scores for ALL subtopics
    3. Combine with semantic-heavy weighting (0.25 keyword, 0.75 semantic)
    4. Apply chapter diversity constraint
    5. Return top-k chunks

    Returns
    -------
    dict with keys:
        - chunks: list of retrieved context chunks
        - related_questions: list of related past paper questions
        - metadata: retrieval metadata
    """
    chapters = load_chapter_data(subject_name)
    questions = load_question_data(subject_name)

    if not chapters:
        return {
            "chunks": [],
            "related_questions": [],
            "metadata": {"error": f"No chapter data found for '{subject_name}'"},
        }

    # Build flat list of all subtopics
    all_subtopics = _build_all_subtopics(chapters)
    logger.info(f"[Retriever] Total subtopics across all chapters: {len(all_subtopics)}")

    # Extract query keywords
    query_keywords = _extract_query_keywords(query)
    logger.info(f"[Retriever] Query keywords: {query_keywords}")

    # Hybrid retrieval
    reranked = _hybrid_retrieve(query, query_keywords, all_subtopics, top_k=top_k)

    # Find related questions
    related_questions = _find_related_questions(query, questions, top_k=3)

    # Build output chunks
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
            "total_subtopics": len(all_subtopics),
            "chapters_retrieved": list(set(str(c["chapter_id"]) for c in chunks)),
            "subject": subject_name,
        },
    }