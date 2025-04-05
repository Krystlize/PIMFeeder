from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

def load_model():
    print("Loading model...")
    # Using a better model for general queries
    model_name = "microsoft/phi-2"  # Better model for general queries
    
    # Load tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32
    )
    
    # Move model to CPU if no GPU is available
    if not torch.cuda.is_available():
        print("No GPU available, using CPU")
        model = model.to('cpu')
    else:
        print("GPU available, using GPU")
        model = model.to('cuda')
    
    return model, tokenizer

def generate_text(prompt, model, tokenizer, max_length=200):
    # Format the prompt to get better responses
    formatted_prompt = f"Question: {prompt}\nAnswer:"
    
    # Encode the input prompt with attention mask
    inputs = tokenizer(
        formatted_prompt,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=max_length,
        return_attention_mask=True
    )
    
    # Move inputs to the same device as the model
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    # Generate text with better parameters
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
    
    # Decode and return the generated text
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Clean up the response to only show the answer part
    response = response.split("Answer:")[-1].strip()
    
    return response

def main():
    print("Initializing...")
    model, tokenizer = load_model()
    
    while True:
        # Get user input
        prompt = input("\nEnter your prompt (or 'quit' to exit): ")
        if prompt.lower() == 'quit':
            break
            
        # Generate response
        print("\nGenerating response...")
        response = generate_text(prompt, model, tokenizer)
        print("\nResponse:", response)

if __name__ == "__main__":
    main() 