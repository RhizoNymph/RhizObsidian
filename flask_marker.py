from flask import Flask, request, jsonify
import subprocess
import os
import tempfile
import re
import base64
import logging
from werkzeug.utils import secure_filename

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)