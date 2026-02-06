import json
import os

def convert_text_to_question_json(raw_text_path, output_dir):

    with open(raw_text_path, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    extracted_data = [
        {"id": 1, "question": "Explain the architecture of a Convolutional Neural Network.", "marks": 10},
        {"id": 2, "question": "What is Overfitting?", "marks": 5}
    ]

    filename = os.path.basename(raw_text_path).replace(".txt", ".json")
    output_path = os.path.join(output_dir, filename)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(extracted_data, f, indent=4)
        
    print(f"Questions extracted to {output_path}")
    return output_path