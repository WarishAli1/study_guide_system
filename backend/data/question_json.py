"""
Question JSON Generator for Marker + Ollama
Uses pre-structured data from Ollama for better accuracy.

Location: backend/data/question_json_marker.py
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

# ML libraries
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics.pairwise import cosine_similarity
    CLUSTERING_AVAILABLE = True
except ImportError:
    CLUSTERING_AVAILABLE = False
    print("⚠️  Clustering libraries not available")

# Import config
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config


class QuestionJSONGeneratorMarker:
    """Generate question JSON using Ollama-structured data."""
    
    def __init__(self, similarity_threshold=0.75):
        """Initialize the question JSON generator."""
        self.similarity_threshold = similarity_threshold
        
        if CLUSTERING_AVAILABLE:
            print("Loading sentence transformer model...")
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✓ Model loaded successfully")
        else:
            self.model = None
    
    def process_subject_questions(self, subject: str) -> int:
        """
        Process all question papers for a subject.
        Uses Ollama's pre-structured data when available.
        
        Args:
            subject: Subject name (e.g., 'AI', 'CN')
            
        Returns:
            Number of question clusters processed
        """
        subject = subject.upper()
        
        # Get paths
        questions_dir = Config.RAW_TEXT_DIR / subject / 'questions'
        output_dir = Config.QUESTION_JSON_DIR / subject
        
        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"✓ Output directory: {output_dir}")
        
        # Check if questions directory exists
        if not questions_dir.exists():
            print(f"✗ Questions directory not found: {questions_dir}")
            return 0
        
        # Get all JSON files
        json_files = list(questions_dir.glob('*.json'))
        
        if not json_files:
            print(f"✗ No JSON files found in: {questions_dir}")
            return 0
        
        print(f"\n{'='*70}")
        print(f"Processing {len(json_files)} question papers for: {subject}")
        print(f"{'='*70}\n")
        
        # Load chapter keywords for mapping
        chapters = self.load_chapter_keywords(subject)
        
        # Collect all questions from all years
        all_questions = []
        
        for json_file in json_files:
            try:
                print(f"\nProcessing: {json_file.name}")
                
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check if we have Ollama-structured data
                structured_data = data.get('structured_data')
                
                if structured_data and 'questions' in structured_data:
                    # Use Ollama's pre-structured data (MUCH better!)
                    print("  ✓ Using Ollama-structured data")
                    year = structured_data.get('year', self._extract_year_from_filename(json_file.name))
                    
                    for q in structured_data['questions']:
                        all_questions.append({
                            'question': q.get('text', q.get('question', '')),
                            'marks': q.get('marks'),
                            'year': year,
                            'has_subparts': q.get('has_subparts', False),
                            'question_number': q.get('number', 0)
                        })
                    
                    print(f"  ✓ Parsed {len(structured_data['questions'])} questions from Ollama")
                
                else:
                    # Fallback: parse from raw_text
                    print("  ⚠️  No structured data, falling back to text parsing")
                    raw_text = data.get('raw_text', '')
                    
                    if not raw_text or len(raw_text.strip()) < 100:
                        print(f"  ⚠️  Insufficient text, skipping")
                        continue
                    
                    year = self._extract_year_from_filename(json_file.name)
                    questions = self._parse_questions_from_text(raw_text, year)
                    all_questions.extend(questions)
                    print(f"  ✓ Parsed {len(questions)} questions from text")
                
            except Exception as e:
                print(f"  ✗ Error processing {json_file.name}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if not all_questions:
            print("\n✗ No questions collected")
            return 0
        
        print(f"\n{'='*70}")
        print(f"Total questions collected: {len(all_questions)}")
        print(f"{'='*70}\n")
        
        # Cluster similar questions
        print("Clustering similar questions...")
        clustered_questions = self.cluster_similar_questions(all_questions)
        
        # Map questions to chapters
        if chapters:
            print("\nMapping questions to chapters...")
            for question_data in clustered_questions:
                chapter_id = self.map_question_to_chapter(
                    question_data['question'],
                    chapters
                )
                question_data['mapped_chapter'] = chapter_id
                
                if chapter_id and chapter_id in chapters:
                    question_data['chapter_name'] = chapters[chapter_id].get('chapter_name')
        
        # Create question JSON structure
        question_json = {
            'subject': subject,
            'total_questions': len(all_questions),
            'unique_clusters': len(clustered_questions),
            'questions': clustered_questions,
            'metadata': {
                'processed_at': datetime.now().isoformat(),
                'similarity_threshold': self.similarity_threshold,
                'total_source_files': len(json_files),
                'chapter_mapping_available': len(chapters) > 0,
                'questions_with_years': sum(1 for q in clustered_questions if q.get('years')),
                'questions_with_marks': sum(1 for q in clustered_questions if q.get('marks')),
                'questions_with_subparts': sum(1 for q in clustered_questions if q.get('has_subparts', False))
            }
        }
        
        # Save question JSON
        output_filename = f"{subject}_questions.json"
        output_path = output_dir / output_filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(question_json, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Saved to: {output_path}")
        print(f"✓ Clustered {len(all_questions)} questions into {len(clustered_questions)} unique questions")
        print(f"✓ {question_json['metadata']['questions_with_years']} questions have year information")
        print(f"✓ {question_json['metadata']['questions_with_marks']} questions have marks assigned")
        
        return len(clustered_questions)
    
    def _parse_questions_from_text(self, text: str, year: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fallback method to parse questions from raw text."""
        questions = []
        
        # Pattern to match questions
        question_pattern = r'(?:^|\n)\s*(\d+)\.?\s+(.+?)(?=(?:\n\s*\d+\.)|$)'
        
        matches = re.finditer(question_pattern, text, re.DOTALL | re.MULTILINE)
        
        for match in matches:
            q_num = match.group(1)
            q_text = match.group(2).strip()
            
            if len(q_text) < 10 or len(q_text) > 1000:
                continue
            
            marks = self._extract_marks(q_text)
            has_subparts = bool(re.search(r'[i]{1,3}\)', q_text))
            
            # Clean question text
            q_text_clean = re.sub(r'\[[\d\s\+x]+\]', '', q_text).strip()
            
            questions.append({
                'question_number': int(q_num),
                'question': q_text_clean,
                'marks': marks,
                'year': year,
                'has_subparts': has_subparts
            })
        
        return questions
    
    def _extract_marks(self, text: str) -> Optional[int]:
        """Extract marks from question text."""
        mark_patterns = [
            r'\[(\d+)\]',
            r'\[(\d+)\+',  # [2+6] -> extract first number
            r'\((\d+)\)',
            r'(\d+)\s*marks?'
        ]
        
        for pattern in mark_patterns:
            match = re.search(pattern, text)
            if match:
                marks = int(match.group(1))
                if 1 <= marks <= 20:  # Validate reasonable range
                    return marks
        
        return None
    
    def _extract_year_from_filename(self, filename: str) -> Optional[str]:
        """Extract year from filename."""
        year_patterns = [
            r'(20\d{2})',  # 2070, 2075, etc.
        ]
        
        for pattern in year_patterns:
            match = re.search(pattern, filename)
            if match:
                year = match.group(1)
                if 2000 <= int(year) <= 2100:
                    return year
        
        return None
    
    def cluster_similar_questions(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Cluster similar questions using embeddings."""
        if not CLUSTERING_AVAILABLE or not questions or len(questions) < 2:
            return questions
        
        question_texts = [q['question'] for q in questions]
        
        print(f"  Generating embeddings for {len(question_texts)} questions...")
        embeddings = self.model.encode(question_texts)
        
        print(f"  Clustering with threshold {self.similarity_threshold}...")
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=1 - self.similarity_threshold,
            metric='cosine',
            linkage='average'
        )
        cluster_labels = clustering.fit_predict(embeddings)
        
        # Group questions by cluster
        clusters = defaultdict(list)
        for idx, label in enumerate(cluster_labels):
            clusters[label].append(questions[idx])
        
        print(f"  ✓ Found {len(clusters)} unique question clusters")
        
        # Create clustered question list
        clustered_questions = []
        for cluster_id, cluster_questions in clusters.items():
            # Use longest question as representative
            main_question = max(cluster_questions, key=lambda x: len(x['question']))
            
            # Aggregate years
            years = []
            for q in cluster_questions:
                if q.get('year'):
                    years.append(q['year'])
            
            # Most common marks value
            marks_list = [q.get('marks') for q in cluster_questions if q.get('marks')]
            marks = max(set(marks_list), key=marks_list.count) if marks_list else None
            
            # Check if any have subparts
            has_subparts = any(q.get('has_subparts', False) for q in cluster_questions)
            
            clustered_questions.append({
                'question': main_question['question'],
                'frequency': len(cluster_questions),
                'years': sorted(list(set(years))),
                'marks': marks,
                'has_subparts': has_subparts,
                'variations': [q['question'] for q in cluster_questions if q != main_question],
                'cluster_id': int(cluster_id)
            })
        
        # Sort by frequency
        clustered_questions.sort(key=lambda x: x['frequency'], reverse=True)
        
        return clustered_questions
    
    def load_chapter_keywords(self, subject: str) -> Dict[int, Dict[str, Any]]:
        """Load chapter keywords for mapping."""
        subject = subject.upper()
        chapter_dir = Config.CHAPTER_JSON_DIR / subject
        
        if not chapter_dir.exists():
            print(f"  ⚠️  No chapter data found for {subject}")
            return {}
        
        chapters = {}
        for json_file in chapter_dir.glob('*.json'):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    chapter_data = json.load(f)
                    chapter_id = chapter_data.get('chapter_id')
                    if chapter_id is not None:
                        chapters[chapter_id] = chapter_data
            except Exception as e:
                print(f"  ✗ Error loading {json_file.name}: {e}")
                continue
        
        print(f"  ✓ Loaded {len(chapters)} chapters for {subject}")
        return chapters
    
    def map_question_to_chapter(
        self,
        question: str,
        chapters: Dict[int, Dict[str, Any]]
    ) -> Optional[int]:
        """Map question to chapter using cosine similarity."""
        if not CLUSTERING_AVAILABLE or not chapters:
            return None
        
        question_embedding = self.model.encode([question])[0]
        
        best_chapter_id = None
        best_similarity = 0.0
        
        for chapter_id, chapter_data in chapters.items():
            keywords = chapter_data.get('keywords', [])
            if not keywords:
                continue
            
            chapter_text = ' '.join(keywords[:20])
            chapter_embedding = self.model.encode([chapter_text])[0]
            
            similarity = cosine_similarity(
                [question_embedding],
                [chapter_embedding]
            )[0][0]
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_chapter_id = chapter_id
        
        if best_similarity > 0.3:
            return best_chapter_id
        
        return None
    
    def process_all_subjects(self) -> Dict[str, int]:
        """Process all subjects in raw_text directory."""
        results = {}
        
        if not Config.RAW_TEXT_DIR.exists():
            print(f"✗ Raw text directory not found: {Config.RAW_TEXT_DIR}")
            return results
        
        subject_dirs = [d for d in Config.RAW_TEXT_DIR.iterdir() if d.is_dir()]
        
        for subject_dir in subject_dirs:
            subject = subject_dir.name
            count = self.process_subject_questions(subject)
            results[subject] = count
        
        print("\n" + "="*70)
        print("PROCESSING SUMMARY")
        print("="*70)
        for subject, count in results.items():
            print(f"  {subject}: {count} question clusters")
        print("="*70 + "\n")
        
        return results


def main():
    """CLI for question JSON generation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate Question JSONs using Marker+Ollama data')
    parser.add_argument('--subject', type=str, help='Process specific subject')
    parser.add_argument('--threshold', type=float, default=0.75)
    
    args = parser.parse_args()
    
    generator = QuestionJSONGeneratorMarker(similarity_threshold=args.threshold)
    
    if args.subject:
        count = generator.process_subject_questions(args.subject)
        print(f"\n✓ Processed {count} question clusters for {args.subject}")
    else:
        results = generator.process_all_subjects()
        total = sum(results.values())
        print(f"\n✓ Total question clusters: {total}")


if __name__ == "__main__":
    main()