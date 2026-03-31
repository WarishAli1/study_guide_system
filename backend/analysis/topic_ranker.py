"""
Topic Importance Ranker
=======================
Uses TF-IDF to weight topics and a co-occurrence graph with PageRank
to identify the most important topics across all chapters.

This is a fully unsupervised approach — no LLM involved.

The idea:
1. Extract all subtopic paragraphs
2. Build TF-IDF matrix across subtopics
3. Build a co-occurrence graph: if two subtopics share significant terms,
   they are connected (weighted by TF-IDF cosine similarity)
4. Run PageRank on this graph to find the most "central" topics
5. Topics that connect to many other topics are ranked higher

This helps identify foundational topics that underpin multiple chapters.
"""

import os
import json
import logging
import numpy as np
from typing import List, Dict, Tuple
from collections import defaultdict

from config import Config

logger = logging.getLogger(__name__)


def _load_chapters(subject_name: str) -> List[Dict]:
    chapter_dir = os.path.join(Config.CHAPTER_JSON_DIR, subject_name)
    if not os.path.isdir(chapter_dir):
        return []
    all_chapters = []
    for f in sorted(os.listdir(chapter_dir)):
        if f.endswith(".json"):
            path = os.path.join(chapter_dir, f)
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, list):
                all_chapters.extend(data)
            elif isinstance(data, dict):
                all_chapters.append(data)
    return all_chapters


def build_topic_graph(subject_name: str) -> Dict:
    """
    Build a topic importance graph using TF-IDF and PageRank.

    Returns
    -------
    dict with:
        - ranked_topics: list of topics sorted by PageRank score
        - cross_chapter_topics: topics that appear relevant across multiple chapters
        - topic_connections: adjacency info showing which topics relate to each other
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    chapters = _load_chapters(subject_name)
    if not chapters:
        return {"error": f"No chapters found for '{subject_name}'"}

    # Flatten all subtopics
    subtopics = []
    for ch in chapters:
        ch_id = ch.get("chapter_id", "?")
        ch_name = ch.get("chapter_name", "")
        for sub in ch.get("subtopics", []):
            para = sub.get("paragraph", "").strip()
            name = sub.get("subtopic_name", "")
            if para and len(para) > 30:
                subtopics.append({
                    "chapter_id": ch_id,
                    "chapter_name": ch_name,
                    "subtopic_name": name,
                    "text": f"{name}. {para}",
                    "keywords": sub.get("keywords", []),
                })

    if len(subtopics) < 3:
        return {"error": "Not enough subtopics to build graph"}

    # Step 1: TF-IDF vectorization
    texts = [s["text"] for s in subtopics]
    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
    )
    tfidf_matrix = vectorizer.fit_transform(texts)

    # Step 2: Compute pairwise cosine similarity
    sim_matrix = cosine_similarity(tfidf_matrix)

    # Step 3: Build adjacency matrix (threshold similarity > 0.15)
    n = len(subtopics)
    threshold = 0.15
    adjacency = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i][j] > threshold:
                adjacency[i][j] = sim_matrix[i][j]
                adjacency[j][i] = sim_matrix[i][j]

    # Step 4: PageRank
    pagerank_scores = _pagerank(adjacency, damping=0.85, max_iter=100)

    # Step 5: Build results
    for i, sub in enumerate(subtopics):
        sub["pagerank_score"] = round(float(pagerank_scores[i]), 6)
        sub["connections"] = int(np.sum(adjacency[i] > 0))

    # Sort by PageRank
    ranked = sorted(subtopics, key=lambda x: x["pagerank_score"], reverse=True)

    # Find cross-chapter topics (connected to subtopics in other chapters)
    cross_chapter = []
    for i, sub in enumerate(subtopics):
        connected_chapters = set()
        for j in range(n):
            if adjacency[i][j] > 0:
                connected_chapters.add(subtopics[j]["chapter_id"])
        connected_chapters.discard(sub["chapter_id"])
        if connected_chapters:
            cross_chapter.append({
                "subtopic_name": sub["subtopic_name"],
                "chapter_name": sub["chapter_name"],
                "chapter_id": sub["chapter_id"],
                "connected_to_chapters": sorted(connected_chapters),
                "pagerank_score": sub["pagerank_score"],
            })

    cross_chapter.sort(key=lambda x: x["pagerank_score"], reverse=True)

    return {
        "subject": subject_name,
        "total_subtopics": n,
        "ranked_topics": [
            {
                "rank": i + 1,
                "subtopic_name": t["subtopic_name"],
                "chapter_name": t["chapter_name"],
                "chapter_id": t["chapter_id"],
                "pagerank_score": t["pagerank_score"],
                "connections": t["connections"],
            }
            for i, t in enumerate(ranked[:30])
        ],
        "cross_chapter_topics": cross_chapter[:15],
    }


def _pagerank(
    adjacency: np.ndarray,
    damping: float = 0.85,
    max_iter: int = 100,
    tol: float = 1e-6,
) -> np.ndarray:
    """
    Compute PageRank scores from an adjacency matrix.
    Implemented from scratch — no external dependency.
    """
    n = adjacency.shape[0]
    if n == 0:
        return np.array([])

    # Normalize columns
    col_sums = adjacency.sum(axis=0)
    col_sums[col_sums == 0] = 1  # avoid division by zero
    transition = adjacency / col_sums

    # Initialize uniform scores
    scores = np.ones(n) / n

    for _ in range(max_iter):
        new_scores = (1 - damping) / n + damping * transition.dot(scores)
        if np.linalg.norm(new_scores - scores) < tol:
            break
        scores = new_scores

    # Normalize to sum to 1
    total = scores.sum()
    if total > 0:
        scores = scores / total

    return scores

def extractive_summary(
    subject_name: str,
    chapter_id: int = None,
    num_sentences: int = 5,
) -> Dict:
    """
    Generate an extractive summary using TextRank.
    Selects the most important sentences without any LLM.

    TextRank works by:
    1. Splitting text into sentences
    2. Computing TF-IDF similarity between all sentence pairs
    3. Building a sentence similarity graph
    4. Running PageRank to find the most "central" sentences
    5. Selecting top-N sentences in their original order
    """
    import re
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    chapters = _load_chapters(subject_name)
    if not chapters:
        return {"error": "No chapters found"}

    # Get text from specified chapter or all chapters
    texts = []
    target_chapters = []
    for ch in chapters:
        if chapter_id is not None and ch.get("chapter_id") != chapter_id:
            continue
        target_chapters.append(ch)
        for sub in ch.get("subtopics", []):
            para = sub.get("paragraph", "").strip()
            if para:
                texts.append(para)

    if not texts:
        return {"error": "No content found"}

    # Split into sentences
    full_text = " ".join(texts)
    sentences = re.split(r'(?<=[.!?])\s+', full_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    if len(sentences) < 3:
        return {"summary": full_text[:500], "method": "too_short_for_textrank"}

    # TF-IDF + similarity matrix
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf = vectorizer.fit_transform(sentences)
    sim_matrix = cosine_similarity(tfidf)

    # PageRank on sentence graph
    scores = _pagerank(sim_matrix, damping=0.85)

    # Select top sentences, maintain original order
    ranked_indices = np.argsort(scores)[::-1][:num_sentences]
    selected = sorted(ranked_indices)  # restore original order

    summary_sentences = [sentences[i] for i in selected]

    return {
        "subject": subject_name,
        "chapter_id": chapter_id,
        "chapter_name": target_chapters[0].get("chapter_name", "") if target_chapters else "",
        "summary": " ".join(summary_sentences),
        "num_sentences": len(summary_sentences),
        "total_sentences": len(sentences),
        "method": "textrank_extractive",
    }