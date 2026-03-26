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


def _hybrid_retrieve(
    query: str,
    query_keywords: List[str],
    all_subtopics: List[Dict],
    top_k: int = 5,
) -> List[Dict]:
    """
    Hybrid retrieval: combine keyword scores and semantic scores
    across ALL subtopics (not pre-filtered).

    This ensures subtopics from any chapter can be retrieved
    even if keywords don't match.
    """
    if not all_subtopics:
        return []

    model = _get_sentence_model()

    # Step 1: Compute keyword scores for all subtopics
    for sub in all_subtopics:
        ch_kw_score = _keyword_overlap_score(query_keywords, sub["chapter_keywords"]) * 0.3
        sub_kw_score = _keyword_overlap_score(query_keywords, sub["keywords"])

        # Also check keyword overlap against subtopic_name and paragraph text
        name_words = sub["subtopic_name"].lower().split()
        name_overlap = _keyword_overlap_score(query_keywords, name_words) * 0.5

        sub["keyword_score"] = sub_kw_score + ch_kw_score + name_overlap

    # Step 2: Compute semantic scores for ALL subtopics
    texts = []
    for sub in all_subtopics:
        # Include subtopic name prominently for better semantic matching
        text = f"{sub['subtopic_name']}. {sub['paragraph'][:500]}"
        texts.append(text)

    query_embedding = model.encode([query], normalize_embeddings=True)[0]
    candidate_embeddings = model.encode(texts, normalize_embeddings=True, batch_size=64)
    semantic_scores = np.dot(candidate_embeddings, query_embedding)

    # Step 3: Combine scores
    # Normalize keyword scores
    max_kw = max((sub["keyword_score"] for sub in all_subtopics), default=1.0)
    if max_kw == 0:
        max_kw = 1.0

    for i, sub in enumerate(all_subtopics):
        kw_normalized = sub["keyword_score"] / max_kw
        semantic = float(semantic_scores[i])
        sub["semantic_score"] = semantic

        # Weight semantic much higher to prevent keyword bias
        # Keyword acts as a small bonus, not a filter
        sub["combined_score"] = 0.25 * kw_normalized + 0.75 * semantic

    # Step 4: Sort by combined score and pick top-k
    # But ensure diversity: don't pick too many from the same chapter
    all_subtopics_sorted = sorted(all_subtopics, key=lambda x: x["combined_score"], reverse=True)

    selected = []
    chapter_counts: Dict[str, int] = {}
    max_per_chapter = max(2, top_k // 2)  # allow at most half from one chapter

    for sub in all_subtopics_sorted:
        ch_key = str(sub["chapter_id"])
        current_count = chapter_counts.get(ch_key, 0)

        if current_count < max_per_chapter:
            selected.append(sub)
            chapter_counts[ch_key] = current_count + 1
            if len(selected) >= top_k:
                break

    # If not enough due to diversity constraint, fill from remaining
    if len(selected) < top_k:
        selected_ids = {(s["chapter_id"], s["subtopic_id"]) for s in selected}
        for sub in all_subtopics_sorted:
            key = (sub["chapter_id"], sub["subtopic_id"])
            if key not in selected_ids:
                selected.append(sub)
                selected_ids.add(key)
                if len(selected) >= top_k:
                    break

    logger.info(
        f"[Retriever] Hybrid retrieval: {len(selected)} chunks from chapters "
        f"{list(set(str(s['chapter_id']) for s in selected))}"
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