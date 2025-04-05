from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = Flask(__name__)
CORS(app)

# Global variables for model and tokenizer
model = None
tokenizer = None

def load_model():
    print("Loading model...")
    model_name = "microsoft/phi-2"
    
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32
    )
    
    # Force CPU usage
    print("Using CPU for inference")
    model = model.to('cpu')
    
    return model, tokenizer

def generate_text(prompt, max_length=200):
    formatted_prompt = f"Question: {prompt}\nAnswer:"
    
    inputs = tokenizer(
        formatted_prompt,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=max_length,
        return_attention_mask=True
    )
    
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    outputs = model.generate(
        input_ids=inputs["input_ids"],
        attention_mask=inputs["attention_mask"],
        max_length=max_length,
        num_return_sequences=1,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
        top_p=0.9,
        repetition_penalty=1.2
    )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = response.split("Answer:")[-1].strip()
    
    return response

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    try:
        response = generate_text(prompt)
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    print("Initializing model...")
    model, tokenizer = load_model()
    print("Model loaded successfully!")
    app.run(debug=True, port=5000) 