"""
Chapter JSON Generator for Marker + Ollama
Uses pre-structured data from Ollama for better accuracy.

Location: backend/data/chapter_json_marker.py
"""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Keyword extraction libraries
try:
    from keybert import KeyBERT
    KEYBERT_AVAILABLE = True
except ImportError:
    KEYBERT_AVAILABLE = False

try:
    import yake
    YAKE_AVAILABLE = True
except ImportError:
    YAKE_AVAILABLE = False

# Import config
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config


class ChapterJSONGeneratorMarker:
    """Generate chapter JSON using Ollama-structured data."""
    
    def __init__(self, method='keybert', num_keywords=25):
        """Initialize the chapter JSON generator."""
        self.method = method.lower()
        self.num_keywords = num_keywords
        
        # Initialize keyword extractor
        if self.method == 'keybert' and KEYBERT_AVAILABLE:
            self.kw_model = KeyBERT()
            print("✓ Using KeyBERT for keyword extraction")
        elif self.method == 'yake' and YAKE_AVAILABLE:
            self.kw_extractor = yake.KeywordExtractor(
                lan="en",
                n=3,
                dedupLim=0.9,
                top=num_keywords,
                features=None
            )
            print("✓ Using YAKE for keyword extraction")
        else:
            print(f"⚠️  Method '{method}' not available. Using fallback TF-IDF.")
            self.method = 'tfidf'
    
    def process_subject_notes(self, subject: str) -> int:
        """
        Process all notes for a subject and generate chapter JSONs.
        Uses Ollama's pre-structured data when available.
        
        Args:
            subject: Subject name (e.g., 'AI', 'CN')
            
        Returns:
            Number of chapters processed
        """
        subject = subject.upper()
        
        # Get paths
        notes_dir = Config.RAW_TEXT_DIR / subject / 'notes'
        output_dir = Config.CHAPTER_JSON_DIR / subject
        
        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"✓ Output directory: {output_dir}")
        
        # Check if notes directory exists
        if not notes_dir.exists():
            print(f"✗ Notes directory not found: {notes_dir}")
            return 0
        
        # Get all JSON files
        json_files = list(notes_dir.glob('*.json'))
        
        if not json_files:
            print(f"✗ No JSON files found in: {notes_dir}")
            return 0
        
        print(f"\n{'='*70}")
        print(f"Processing {len(json_files)} note files for: {subject}")
        print(f"{'='*70}\n")
        
        processed_count = 0
        
        for json_file in json_files:
            try:
                print(f"\nProcessing: {json_file.name}")
                
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                raw_text = data.get('raw_text', '')
                
                if not raw_text or len(raw_text.strip()) < 100:
                    print(f"  ⚠️  Insufficient text, skipping")
                    continue
                
                # Check if we have Ollama-structured data
                structured_data = data.get('structured_data')
                
                if structured_data:
                    # Use Ollama's pre-structured data
                    print("  ✓ Using Ollama-structured data")
                    chapter_number = structured_data.get('chapter_number')
                    chapter_name = structured_data.get('chapter_name')
                    content = structured_data.get('content', raw_text)
                else:
                    # Fallback: detect from filename/text
                    print("  ⚠️  No structured data, detecting chapter info")
                    chapter_info = self.detect_chapter_info(
                        data.get('file_name', json_file.name),
                        raw_text
                    )
                    chapter_number = chapter_info['chapter_id']
                    chapter_name = chapter_info['chapter_name']
                    content = raw_text
                
                print(f"  Chapter ID: {chapter_number}")
                print(f"  Chapter Name: {chapter_name}")
                
                # Extract keywords (DNA)
                print(f"  Extracting keywords using {self.method}...")
                keywords = self.extract_keywords(content)
                
                if not keywords:
                    print(f"  ⚠️  No keywords extracted")
                    continue
                
                print(f"  ✓ Extracted {len(keywords)} keywords")
                print(f"  Top keywords: {', '.join(keywords[:5])}")
                
                # Create chapter JSON structure
                chapter_json = {
                    'subject': subject,
                    'chapter_id': chapter_number,
                    'chapter_name': chapter_name,
                    'text': content,
                    'keywords': keywords,
                    'metadata': {
                        'source_file': data.get('file_name'),
                        'uploaded_by': data.get('uploaded_by'),
                        'upload_time': data.get('upload_time'),
                        'character_count': len(content),
                        'word_count': len(content.split()),
                        'keyword_extraction_method': self.method,
                        'num_keywords': len(keywords),
                        'processed_at': datetime.now().isoformat(),
                        'used_ollama_structure': structured_data is not None
                    }
                }
                
                # Generate output filename
                safe_chapter_name = re.sub(r'[^\w\s-]', '', chapter_name)
                safe_chapter_name = re.sub(r'[-\s]+', '_', safe_chapter_name)
                output_filename = f"chapter_{chapter_number}_{safe_chapter_name}.json"
                output_path = output_dir / output_filename
                
                # Save chapter JSON
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(chapter_json, f, ensure_ascii=False, indent=2)
                
                print(f"  ✓ Saved to: {output_path}")
                processed_count += 1
                
            except Exception as e:
                print(f"  ✗ Error processing {json_file.name}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"\n{'='*70}")
        print(f"✓ Processed {processed_count}/{len(json_files)} chapters for {subject}")
        print(f"{'='*70}\n")
        
        return processed_count
    
    def extract_keywords(self, text: str) -> List[str]:
        """Extract keywords using configured method."""
        if self.method == 'keybert':
            return self.extract_keywords_keybert(text)
        elif self.method == 'yake':
            return self.extract_keywords_yake(text)
        else:
            return self.extract_keywords_tfidf(text)
    
    def extract_keywords_keybert(self, text: str) -> List[str]:
        """Extract keywords using KeyBERT."""
        try:
            keywords = self.kw_model.extract_keywords(
                text,
                keyphrase_ngram_range=(1, 3),
                stop_words='english',
                top_n=self.num_keywords,
                diversity=0.7
            )
            return [kw[0] for kw in keywords]
        except Exception as e:
            print(f"  ✗ KeyBERT extraction failed: {e}")
            return []
    
    def extract_keywords_yake(self, text: str) -> List[str]:
        """Extract keywords using YAKE."""
        try:
            keywords = self.kw_extractor.extract_keywords(text)
            return [kw[0] for kw in keywords[:self.num_keywords]]
        except Exception as e:
            print(f"  ✗ YAKE extraction failed: {e}")
            return []
    
    def extract_keywords_tfidf(self, text: str) -> List[str]:
        """Simple TF-IDF based keyword extraction (fallback)."""
        from collections import Counter
        import string
        
        text = text.lower()
        text = text.translate(str.maketrans('', '', string.punctuation))
        words = text.split()
        
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                     'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                     'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
                     'can', 'could', 'may', 'might', 'must', 'it', 'its', 'that', 'this'}
        
        words = [w for w in words if w not in stop_words and len(w) > 3]
        counter = Counter(words)
        
        return [word for word, _ in counter.most_common(self.num_keywords)]
    
    def detect_chapter_info(self, filename: str, text: str) -> Dict[str, Any]:
        """Detect chapter number and name from filename or text."""
        chapter_id = None
        chapter_name = None
        
        # Try filename patterns
        filename_patterns = [
            r'[Cc]hapter[-_\s]*(\d+)',
            r'[Cc]h[-_\s]*(\d+)',
            r'unit[-_\s]*(\d+)',
        ]
        
        for pattern in filename_patterns:
            match = re.search(pattern, filename)
            if match:
                chapter_id = int(match.group(1))
                break
        
        # Try text patterns
        text_pattern = r'[Cc]hapter[-_\s]*(\d+)\s*[:|\-]\s*([^\n]+)'
        match = re.search(text_pattern, text[:500])
        
        if match:
            if chapter_id is None:
                chapter_id = int(match.group(1))
            chapter_name = match.group(2).strip()
        
        # Default values
        if chapter_id is None:
            chapter_id = abs(hash(filename)) % 10000
        
        if chapter_name is None:
            lines = text.split('\n')
            for line in lines[:20]:
                line = line.strip()
                if line and len(line) < 100 and not line.endswith('.'):
                    chapter_name = line
                    break
        
        if chapter_name is None:
            chapter_name = Path(filename).stem.replace('_', ' ').title()
        
        return {
            'chapter_id': chapter_id,
            'chapter_name': chapter_name
        }
    
    def process_all_subjects(self) -> Dict[str, int]:
        """Process all subjects in raw_text directory."""
        results = {}
        
        if not Config.RAW_TEXT_DIR.exists():
            print(f"✗ Raw text directory not found: {Config.RAW_TEXT_DIR}")
            return results
        
        subject_dirs = [d for d in Config.RAW_TEXT_DIR.iterdir() if d.is_dir()]
        
        for subject_dir in subject_dirs:
            subject = subject_dir.name
            count = self.process_subject_notes(subject)
            results[subject] = count
        
        print("\n" + "="*70)
        print("PROCESSING SUMMARY")
        print("="*70)
        for subject, count in results.items():
            print(f"  {subject}: {count} chapters processed")
        print("="*70 + "\n")
        
        return results


def main():
    """CLI for chapter JSON generation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate Chapter JSONs using Marker+Ollama data')
    parser.add_argument('--subject', type=str, help='Process specific subject')
    parser.add_argument('--method', type=str, default='keybert',
                       choices=['keybert', 'yake', 'tfidf'])
    parser.add_argument('--num-keywords', type=int, default=25)
    
    args = parser.parse_args()
    
    generator = ChapterJSONGeneratorMarker(
        method=args.method,
        num_keywords=args.num_keywords
    )
    
    if args.subject:
        count = generator.process_subject_notes(args.subject)
        print(f"\n✓ Processed {count} chapters for {args.subject}")
    else:
        results = generator.process_all_subjects()
        total = sum(results.values())
        print(f"\n✓ Total chapters processed: {total}")


if __name__ == "__main__":
    main()