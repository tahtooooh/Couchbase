from flask import Flask, request, jsonify, render_template, send_from_directory
from couchbase.cluster import Cluster
from couchbase.auth import PasswordAuthenticator
from couchbase.options import ClusterOptions
from couchbase.exceptions import DocumentNotFoundException
from dotenv import load_dotenv
import os
import time
import re
import json
import urllib.request
import urllib.parse
from werkzeug.utils import secure_filename
import base64

load_dotenv()

app = Flask(__name__, static_folder='public', static_url_path='/public', template_folder='templates')

CLUSTER_URL = os.getenv('COUCHBASE_URL', 'couchbase://localhost')
USERNAME = os.getenv('COUCHBASE_USERNAME', 'Administrator')
PASSWORD = os.getenv('COUCHBASE_PASSWORD', 'password')
BUCKET_NAME = os.getenv('COUCHBASE_BUCKET', 'default')
SCOPE_NAME = os.getenv('COUCHBASE_SCOPE', '_default')
COLLECTION_NAME = os.getenv('COUCHBASE_COLLECTION', '_default')

cluster = Cluster(
    CLUSTER_URL,
    ClusterOptions(PasswordAuthenticator(USERNAME, PASSWORD))
)

bucket = cluster.bucket(BUCKET_NAME)
scope = bucket.scope(SCOPE_NAME)
collection = scope.collection(COLLECTION_NAME)

def get_collection(bucket_name=None, scope_name=None, collection_name=None):
    b = cluster.bucket(bucket_name or BUCKET_NAME)
    s = b.scope(scope_name or SCOPE_NAME)
    return s.collection(collection_name or COLLECTION_NAME)

def get_all_docs(bucket_name=None):
    bn = bucket_name or BUCKET_NAME
    url = f'http://localhost:8091/pools/default/buckets/{bn}/docs'
    auth = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    auth.add_password(None, url, USERNAME, PASSWORD)
    handler = urllib.request.HTTPBasicAuthHandler(auth)
    opener = urllib.request.build_opener(handler)
    resp = opener.open(url)
    data = json.loads(resp.read())

    b = cluster.bucket(bn)
    s = b.scope(SCOPE_NAME)
    col = s.collection(COLLECTION_NAME)

    docs = []
    for row in data.get('rows', []):
        doc_id = row['id']
        try:
            result = col.get(doc_id)
            content = result.content_as[dict]
            content['id'] = doc_id
            docs.append(content)
        except DocumentNotFoundException:
            pass
    return docs

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/buckets', methods=['GET'])
def get_buckets():
    try:
        buckets = cluster.buckets().get_all_buckets()
        return jsonify([b['name'] for b in buckets])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/collections', methods=['GET'])
def get_collections():
    try:
        bucket_name = request.args.get('bucket', BUCKET_NAME)
        scope_name = request.args.get('scope', SCOPE_NAME)
        b = cluster.bucket(bucket_name)
        scopes = b.collections().get_all_scopes()
        scope_data = next((s for s in scopes if s.name == scope_name), None)
        if scope_data:
            return jsonify([c.name for c in scope_data.collections])
        return jsonify([])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents', methods=['GET'])
def get_documents():
    try:
        bucket = request.args.get('bucket')
        scope_name = request.args.get('scope')
        collection_name = request.args.get('collectionName')
        query = request.args.get('query')

        col = get_collection(bucket, scope_name, collection_name)

        if query:
            all_docs = get_all_docs(bucket or BUCKET_NAME)
            where_match = re.search(r'WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)', query, re.IGNORECASE | re.DOTALL)
            if where_match:
                condition = where_match.group(1).strip()
                field_match = re.match(r'(\w+)\s*=\s*["\']([^"\']*)["\']', condition)
                if field_match:
                    field, value = field_match.groups()
                    all_docs = [d for d in all_docs if str(d.get(field, '')).lower() == value.lower()]
            return jsonify(all_docs)
        else:
            docs = get_all_docs(bucket or BUCKET_NAME)
            return jsonify(docs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<doc_id>', methods=['GET'])
def get_document(doc_id):
    try:
        result = collection.get(doc_id)
        content = result.content_as[dict]
        return jsonify({'id': doc_id, **content})
    except DocumentNotFoundException:
        return jsonify({'error': 'Document not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents', methods=['POST'])
def create_document():
    try:
        data = request.json
        doc_id = data.pop('id', None) or f"doc_{int(time.time() * 1000)}"
        collection.insert(doc_id, data)
        return jsonify({'id': doc_id, **data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<doc_id>', methods=['PUT'])
def update_document(doc_id):
    try:
        collection.upsert(doc_id, request.json)
        return jsonify({'id': doc_id, **request.json})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    try:
        collection.remove(doc_id)
        return jsonify({'message': 'Document deleted successfully'})
    except DocumentNotFoundException:
        return jsonify({'error': 'Document not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        data = request.json
        image_data = data.get('image')
        filename = data.get('filename', 'poster')

        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400

        if ',' in image_data:
            header, image_data = image_data.split(',', 1)

        image_bytes = base64.b64decode(image_data)

        safe_name = secure_filename(filename)
        if not safe_name:
            safe_name = f"poster_{int(time.time())}"

        ext = '.png'
        if 'jpeg' in header.lower() or 'jpg' in safe_name.lower():
            ext = '.jpg'
        elif 'png' in header.lower() or 'png' in safe_name.lower():
            ext = '.png'
        elif 'webp' in header.lower():
            ext = '.webp'

        filename = f"{safe_name}{ext}"
        filepath = os.path.join('public', 'images', filename)

        with open(filepath, 'wb') as f:
            f.write(image_bytes)

        image_url = f"/public/images/{filename}"
        return jsonify({'url': image_url, 'filename': filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images', methods=['GET'])
def list_images():
    try:
        images_dir = os.path.join('public', 'images')
        if not os.path.exists(images_dir):
            return jsonify([])

        files = os.listdir(images_dir)
        images = []
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                filepath = os.path.join(images_dir, f)
                size = os.path.getsize(filepath)
                images.append({
                    'filename': f,
                    'url': f"/public/images/{f}",
                    'size': size,
                    'sizeFormatted': f"{size / 1024:.1f} KB"
                })
        return jsonify(sorted(images, key=lambda x: x['filename']))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images/<filename>', methods=['DELETE'])
def delete_image(filename):
    try:
        safe_name = secure_filename(filename)
        filepath = os.path.join('public', 'images', safe_name)

        if not os.path.exists(filepath):
            return jsonify({'error': 'Image not found'}), 404

        os.remove(filepath)
        return jsonify({'message': 'Image deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    os.makedirs(os.path.join('public', 'images'), exist_ok=True)
    app.run(debug=True, port=5000)
