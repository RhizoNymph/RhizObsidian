import os
import re
import io
import base64
import logging
import hashlib
import subprocess
import tempfile
import imghdr
import torch
import librosa
import json

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image
from transformers import WhisperProcessor, WhisperForConditionalGeneration

from byaldi import RAGMultiModalModel
from ragatouille import RAGPretrainedModel
from claudette import *

app = Flask(__name__)
CORS(app)

os.environ["ANTHROPIC_API_KEY"] = ""

# File to store hashes
HASH_FILE = 'indexed_file_hashes.json'
if not os.path.exists(HASH_FILE) or os.path.getsize(HASH_FILE) == 0:
    with open(HASH_FILE, 'w') as f:
        json.dump([], f)

# In-memory set of file hashes
indexed_files = set()

def load_indexed_files():
    global indexed_files
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, 'r') as f:
            indexed_files = set(json.load(f))

def save_indexed_files():
    with open(HASH_FILE, 'w') as f:
        json.dump(list(indexed_files), f)

def calculate_sha256(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def validate_image(base64_data):
    try:
        image_bytes = base64.b64decode(base64_data)
        image_type = imghdr.what(None, h=image_bytes)
        if image_type:
            image = Image.open(io.BytesIO(image_bytes))
            image.verify()  # Verify that it is, in fact, an image
            return image_type
        else:
            return None
    except Exception as e:
        print(f"Image validation failed: {e}")
        return None

@app.route('/get_indexed_hashes', methods=['GET'])
def get_indexed_hashes():
    try:
        with open(HASH_FILE, 'r') as f:
            hashes = json.load(f)
        return jsonify(hashes)
    except json.JSONDecodeError:
        return jsonify([])  # Return an empty list if the file is empty or invalid
    except Exception as e:
        app.logger.error(f"Error fetching indexed hashes: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json

    messages = data.get('messages', [])
    model = data.get('model', 'claude-3-5-sonnet-20240620')

    # Initialize Claudette Chat object
    chat = Chat(model)

    # Process messages to handle images and text
    processed_messages = []
    for message in messages:
        if message['type'] == 'image_url':
            # Decode base64 image and add to content
            image_data = message['image_url']['url']
            image_type = validate_image(image_data)
            if not image_type:
                return jsonify({"error": "Invalid image data"}), 400
            media_type = f"image/{image_type}"
            processed_messages.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_data
                }
            })
        elif message['type'] == 'text':
            processed_messages.append({"type": "text", "text": message['text']})

    response = chat(processed_messages)

    # Extract relevant information from the Result object
    formatted_response = {
        "choices": [{
            "message": {
                "content": response.content[0].text if response.content else "",
                "role": "assistant"
            }
        }],
        "usage": {
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens if response.usage else 0
        }
    }

    return jsonify(formatted_response)

@app.route('/search', methods=['POST'])
def search():
    data = request.json

    query = data.get('query', "")
    if query == "":
        return "Search query required"

    topk = data.get('topk', 10)

    image_results = []
    text_results = []

    if os.path.exists('./.byaldi/obsidian'):
        MultiRAG = RAGMultiModalModel.from_index("obsidian", verbose=1)
        image_results = MultiRAG.search(query, k=topk)
        # Convert image_results to a list of dictionaries
        image_results = [{"score": result.score, "doc_id": result.doc_id, "page_num": result.page_num, "metadata": result.metadata, "base64": result.base64} for result in image_results]

    if os.path.exists('./.ragatouille/obsidian'):
        TextRAG = RAGPretrainedModel.from_index("obsidian", verbose=1)
        text_results = TextRAG.search(query, k=topk)
        # Convert text_results to a list of dictionaries
        text_results = [{"score": result.score, "doc_id": result.doc_id, "page_num": result.page_num, "metadata": result.metadata} for result in text_results]

    return jsonify({ "images": image_results, "texts": text_results})

@app.route('/indexPDF', methods=['POST'])
def index_pdf():
    data = request.json
    if not data or 'pdf_content' not in data or 'filename' not in data:
        return jsonify({'error': 'Missing PDF content or filename'}), 400

    filename = secure_filename(data['filename'])
    pdf_content = base64.b64decode(data['pdf_content'])

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        temp_file.write(pdf_content)
        file_path = temp_file.name

    file_hash = calculate_sha256(file_path)
    if file_hash in indexed_files:
        os.remove(file_path)
        return jsonify({'message': 'File already indexed'})

    if os.path.exists('./.byaldi/obsidian'):
        RAG = RAGMultiModalModel.from_index("obsidian", verbose=1)
        RAG.add_to_index(
            input_item=file_path,
            store_collection_with_index=True
        )
    else:
        RAG = RAGMultiModalModel.from_pretrained("vidore/colpali-v1.2", verbose=1)
        RAG.index(
            input_path=file_path,
            index_name="obsidian",
            store_collection_with_index=True,
            overwrite=False
        )

    indexed_files.add(file_hash)
    save_indexed_files()

    os.remove(file_path)
    return jsonify({'message': 'File indexed successfully'})

TEXT_HASH_FILE = 'indexed_text_hashes.json'
indexed_texts = set()

def load_indexed_texts():
    global indexed_texts
    if os.path.exists(TEXT_HASH_FILE):
        with open(TEXT_HASH_FILE, 'r') as f:
            indexed_texts = set(json.load(f))

def save_indexed_texts():
    with open(TEXT_HASH_FILE, 'w') as f:
        json.dump(list(indexed_texts), f)

def calculate_text_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()

@app.route('/indexText', methods=['POST'])
def index_text():
    data = request.json
    index_name = data.get('index_name', 'obsidian')
    texts = data.get('texts', [])

    if not texts:
        return jsonify({"error": "No texts provided"}), 400

    try:
        new_texts = []
        for text in texts:
            text_hash = calculate_text_hash(text)
            if text_hash not in indexed_texts:
                new_texts.append(text)
                indexed_texts.add(text_hash)

        if not new_texts:
            return jsonify({"message": "All texts have already been indexed"}), 200

        if os.path.exists(f'./.ragatouille/{index_name}'):
            RAG = RAGPretrainedModel.from_index(index_name, verbose=1)
            RAG.add_to_index(index_name=index_name, new_collection=new_texts)
        else:
            RAG = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0", verbose=1)
            RAG.index(index_name=index_name, collection=new_texts)

        save_indexed_texts()
        return jsonify({"success": True, "message": f"Indexed {len(new_texts)} new texts"})
    except Exception as e:
        app.logger.exception("An error occurred during indexing")
        return jsonify({"error": str(e)}), 500

@app.route('/indexMarkdown', methods=['POST'])
def index_markdown():
    data = request.json
    if not data or 'content' not in data or 'filename' not in data:
        return jsonify({'error': 'Missing content or filename'}), 400

    content = data['content']
    filename = secure_filename(data['filename'])

    text_hash = calculate_text_hash(content)
    if text_hash not in indexed_texts:
        try:
            if os.path.exists('./.ragatouille/obsidian'):
                RAG = RAGPretrainedModel.from_index("obsidian", verbose=1)
                RAG.add_to_index(index_name="obsidian", new_collection=[content], new_document_ids=[filename])
            else:
                RAG = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0", verbose=1)
                RAG.index(index_name="obsidian", collection=[content], document_ids=[filename])

            indexed_texts.add(text_hash)
            save_indexed_texts()
            return jsonify({'message': 'Markdown indexed successfully'})
        except Exception as e:
            app.logger.exception("An error occurred during indexing")
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({'message': 'Markdown already indexed'})

def update_markdown_links(markdown_content, image_folder):
    pattern = r'!\[(.*?)\]\((.*?)\)'
    def replace_link(match):
        alt_text, image_path = match.groups()
        new_path = os.path.join(image_folder, os.path.basename(image_path))
        return f'![{alt_text}]({new_path})'

    return re.sub(pattern, replace_link, markdown_content)

@app.route('/convert', methods=['POST'])
def convert_pdf():
    app.logger.debug(f"Received request: {request.headers}")
    app.logger.debug(f"Request data: {request.data[:100]}...")  # Log first 100 characters of request data

    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json
    if 'file' not in data or 'filename' not in data:
        return jsonify({"error": "Missing 'file' or 'filename' in request JSON"}), 400

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            file_data = data['file']
            file_name = secure_filename(data['filename'])
            input_path = os.path.join(temp_dir, file_name)

            # Check if the file data is base64 encoded
            if file_data.startswith('data:application/pdf;base64,'):
                file_data = file_data.split(',')[1]

            try:
                pdf_content = base64.b64decode(file_data)
            except Exception as e:
                app.logger.error(f"Failed to decode base64 data: {e}")
                return jsonify({"error": "Invalid base64 data"}), 400

            with open(input_path, 'wb') as f:
                f.write(pdf_content)

            output_folder = os.path.join(temp_dir, 'output')
            os.makedirs(output_folder, exist_ok=True)

            command = f"marker_single {input_path} {output_folder} --batch_multiplier 2 --langs English"
            app.logger.debug(f"Running command: {command}")
            process = subprocess.run(command, shell=True, capture_output=True, text=True)

            if process.returncode == 0:
                images_folder = os.path.join(output_folder, os.path.splitext(file_name)[0], 'images')
                os.makedirs(images_folder, exist_ok=True)

                files_data = []

                # Process markdown files
                for root, _, files in os.walk(output_folder):
                    for file in files:
                        if file.lower().endswith('.md'):
                            md_path = os.path.join(root, file)
                            with open(md_path, 'r', encoding='utf-8') as md_file:
                                content = md_file.read()

                            updated_content = update_markdown_links(content, 'images')

                            files_data.append({
                                "name": file,
                                "type": "markdown",
                                "content": updated_content
                            })

                # Process image files
                for root, _, files in os.walk(output_folder):
                    for file in files:
                        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                            img_path = os.path.join(root, file)
                            with open(img_path, 'rb') as img_file:
                                img_content = base64.b64encode(img_file.read()).decode('utf-8')

                            files_data.append({
                                "name": os.path.join('images', file),
                                "type": "image",
                                "content": img_content
                            })

                app.logger.info(f"Successfully processed PDF. Found {len(files_data)} files.")
                return jsonify({"success": True, "files": files_data})
            else:
                app.logger.error(f"Conversion failed: {process.stderr}")
                return jsonify({"error": "Conversion failed", "details": process.stderr}), 500
        except Exception as e:
            app.logger.exception("An error occurred during processing")
            return jsonify({"error": str(e)}), 500

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'file' not in request.files:
        app.logger.error("No file part in the request")
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    app.logger.debug(f"Received file: {file.filename}, size: {file.content_length}")

    if file:
        filename = secure_filename(file.filename)
        model_size = request.form.get('model_size', 'base')
        chunk_length = int(request.form.get('chunk_length', 30))
        stride_length = int(request.form.get('stride_length', 5))
        temperature = float(request.form.get('temperature', 0.2))
        repetition_penalty = float(request.form.get('repetition_penalty', 1.3))

        try:
            transcription = transcribe_audio_from_file(
                file,
                model_size=model_size,
                chunk_length=chunk_length,
                stride_length=stride_length,
                temperature=temperature,
                repetition_penalty=repetition_penalty
            )

            return jsonify({"success": True, "transcription": transcription})
        except Exception as e:
            app.logger.exception("An error occurred during transcription")
            return jsonify({"error": str(e)}), 500

def transcribe_audio_from_file(file, model_size="base", chunk_length=30, stride_length=5, temperature=0.0, repetition_penalty=1.0):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        file.save(temp_file.name)
        temp_file_path = temp_file.name

    try:
        # Load model and processor
        processor = WhisperProcessor.from_pretrained(f"openai/whisper-{model_size}")
        model = WhisperForConditionalGeneration.from_pretrained(f"openai/whisper-{model_size}")

        # Use GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)

        # Load the entire audio file
        audio, sr = librosa.load(temp_file_path, sr=16000)

        # Calculate chunk size and stride in samples
        chunk_size = int(chunk_length * sr)
        stride_size = int(stride_length * sr)

        transcription = ""
        for i in range(0, len(audio), stride_size):
            chunk = audio[i:i + chunk_size]
            input_features = processor(chunk, return_tensors="pt", sampling_rate=16000).input_features
            input_features = input_features.to(device)

            # Generate token ids with custom parameters
            predicted_ids = model.generate(
                input_features,
                temperature=temperature,
                repetition_penalty=repetition_penalty,
                do_sample=temperature > 0.0,
            )

            # Decode token ids to text
            chunk_transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
            transcription += chunk_transcription + " "

        return transcription.strip()

    finally:
        # Clean up the temporary file
        os.unlink(temp_file_path)

if __name__ == '__main__':
    load_indexed_texts()
    load_indexed_files()
    app.run(port=5000, host="0.0.0.0")
