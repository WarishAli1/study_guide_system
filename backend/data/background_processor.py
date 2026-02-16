import os
import sys
from pathlib import Path
from threading import Thread
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config
from data.chapter_json import ChapterJSONGeneratorMarker
from data.question_json import QuestionJSONGeneratorMarker


class BackgroundProcessorMarker:
    def __init__(self):
        self.chapter_generator = None
        self.question_generator = None
        self.processing = False
    
    def _initialize_generators(self):
        if self.chapter_generator is None:
            print("Initializing Chapter JSON Generator (Marker+Ollama)...")
            try:
                self.chapter_generator = ChapterJSONGeneratorMarker(
                    method='keybert',
                    num_keywords=25
                )
            except Exception as e:
                print(f"⚠️  Chapter generator initialization failed: {e}")
                self.chapter_generator = ChapterJSONGeneratorMarker(
                    method='tfidf',
                    num_keywords=25
                )
        
        if self.question_generator is None:
            print("Initializing Question JSON Generator (Marker+Ollama)...")
            try:
                self.question_generator = QuestionJSONGeneratorMarker(
                    similarity_threshold=0.75
                )
            except Exception as e:
                print(f"⚠️  Question generator initialization failed: {e}")
                self.question_generator = QuestionJSONGeneratorMarker()
    
    def process_subject_async(self, subject: str):
        def _process():
            try:
                self.processing = True
                subject_upper = subject.upper()
                
                print(f"\n{'='*70}")
                print(f"BACKGROUND PROCESSING (Marker+Ollama): {subject_upper}")
                print(f"{'='*70}\n")
                
                self._initialize_generators()
                
                notes_dir = Config.RAW_TEXT_DIR / subject_upper / 'notes'
                if notes_dir.exists() and any(notes_dir.glob('*.json')):
                    print(f"\n[1/2] Processing NOTES for {subject_upper}...")
                    try:
                        chapter_count = self.chapter_generator.process_subject_notes(subject_upper)
                        print(f"✓ Generated {chapter_count} chapter JSONs")
                    except Exception as e:
                        print(f"✗ Error processing notes: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"⚠️  No notes found for {subject_upper}")
                
                time.sleep(2)
                
                questions_dir = Config.RAW_TEXT_DIR / subject_upper / 'questions'
                if questions_dir.exists() and any(questions_dir.glob('*.json')):
                    print(f"\n[2/2] Processing QUESTIONS for {subject_upper}...")
                    try:
                        question_count = self.question_generator.process_subject_questions(subject_upper)
                        print(f"✓ Generated {question_count} question clusters")
                    except Exception as e:
                        print(f"✗ Error processing questions: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"⚠️  No questions found for {subject_upper}")
                
                print(f"\n{'='*70}")
                print(f"BACKGROUND PROCESSING COMPLETE: {subject_upper}")
                print(f"{'='*70}\n")
                
            except Exception as e:
                print(f"✗ Background processing error for {subject}: {e}")
                import traceback
                traceback.print_exc()
            finally:
                self.processing = False

        thread = Thread(target=_process, daemon=True)
        thread.start()
        print(f"✓ Background processing started for {subject}")
    
    def process_all_subjects_async(self):
        def _process_all():
            try:
                self.processing = True
                
                if not Config.RAW_TEXT_DIR.exists():
                    print("✗ Raw text directory not found")
                    return
                
                subject_dirs = [d for d in Config.RAW_TEXT_DIR.iterdir() if d.is_dir()]
                
                if not subject_dirs:
                    print("✗ No subjects found")
                    return

                self._initialize_generators()
                
                for subject_dir in subject_dirs:
                    subject = subject_dir.name
                    
                    print(f"\n{'='*70}")
                    print(f"PROCESSING: {subject}")
                    print(f"{'='*70}\n")
                    
                    try:
                        chapter_count = self.chapter_generator.process_subject_notes(subject)
                        print(f"✓ {subject}: {chapter_count} chapters")
                    except Exception as e:
                        print(f"✗ {subject} notes error: {e}")
                    
                    try:
                        question_count = self.question_generator.process_subject_questions(subject)
                        print(f"✓ {subject}: {question_count} question clusters")
                    except Exception as e:
                        print(f"✗ {subject} questions error: {e}")
                    
                    time.sleep(1)
                
                print(f"\n{'='*70}")
                print("ALL SUBJECTS PROCESSED")
                print(f"{'='*70}\n")
                
            except Exception as e:
                print(f"✗ Batch processing error: {e}")
                import traceback
                traceback.print_exc()
            finally:
                self.processing = False
        
        thread = Thread(target=_process_all, daemon=True)
        thread.start()
        print("✓ Batch background processing started")
    
    def is_processing(self) -> bool:
        """Check if processor is currently running."""
        return self.processing


_processor = None

def get_processor() -> BackgroundProcessorMarker:
    """Get or create the global processor instance."""
    global _processor
    if _processor is None:
        _processor = BackgroundProcessorMarker()
    return _processor


def trigger_processing(subject: str):
    processor = get_processor()
    if not processor.is_processing():
        processor.process_subject_async(subject)
    else:
        print(f"⚠️  Processor already running, will process {subject} later")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Background processor (Marker+Ollama)')
    parser.add_argument('--subject', type=str, help='Process specific subject')
    parser.add_argument('--all', action='store_true', help='Process all subjects')
    
    args = parser.parse_args()
    
    processor = get_processor()
    
    if args.all:
        processor.process_all_subjects_async()
        while processor.is_processing():
            time.sleep(1)
    elif args.subject:
        processor.process_subject_async(args.subject)
        while processor.is_processing():
            time.sleep(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()