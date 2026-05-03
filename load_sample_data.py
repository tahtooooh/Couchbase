import json
from couchbase.cluster import Cluster
from couchbase.auth import PasswordAuthenticator
from couchbase.options import ClusterOptions
from dotenv import load_dotenv
import os

load_dotenv()

CLUSTER_URL = os.getenv('COUCHBASE_URL', 'couchbase://127.0.0.1')
USERNAME = os.getenv('COUCHBASE_USERNAME', 'Administrator')
PASSWORD = os.getenv('COUCHBASE_PASSWORD', 'password')
BUCKET_NAME = os.getenv('COUCHBASE_BUCKET', 'default')
SCOPE_NAME = os.getenv('COUCHBASE_SCOPE', '_default')
COLLECTION_NAME = os.getenv('COUCHBASE_COLLECTION', '_default')

cluster = Cluster(CLUSTER_URL, ClusterOptions(PasswordAuthenticator(USERNAME, PASSWORD)))
bucket = cluster.bucket(BUCKET_NAME)
scope = bucket.scope(SCOPE_NAME)
collection = scope.collection(COLLECTION_NAME)

sample_data = [
    {"id": "user_001", "type": "user", "name": "Alice Johnson", "email": "alice@example.com", "age": 28, "role": "admin", "active": True},
    {"id": "user_002", "type": "user", "name": "Bob Smith", "email": "bob@example.com", "age": 34, "role": "user", "active": True},
    {"id": "user_003", "type": "user", "name": "Charlie Brown", "email": "charlie@example.com", "age": 22, "role": "user", "active": False},
    {"id": "user_004", "type": "user", "name": "Diana Prince", "email": "diana@example.com", "age": 31, "role": "moderator", "active": True},

    {"id": "product_001", "type": "product", "name": "MacBook Pro 16\"", "category": "electronics", "price": 2499.99, "stock": 45, "rating": 4.8},
    {"id": "product_002", "type": "product", "name": "iPhone 15 Pro", "category": "electronics", "price": 1199.99, "stock": 120, "rating": 4.9},
    {"id": "product_003", "type": "product", "name": "AirPods Pro", "category": "accessories", "price": 249.99, "stock": 200, "rating": 4.7},
    {"id": "product_004", "type": "product", "name": "Sony WH-1000XM5", "category": "accessories", "price": 349.99, "stock": 80, "rating": 4.6},
    {"id": "product_005", "type": "product", "name": "Dell Monitor 27\"", "category": "electronics", "price": 499.99, "stock": 30, "rating": 4.5},

    {"id": "order_001", "type": "order", "userId": "user_001", "items": [{"productId": "product_001", "quantity": 1, "price": 2499.99}], "total": 2499.99, "status": "completed", "date": "2026-04-15"},
    {"id": "order_002", "type": "order", "userId": "user_002", "items": [{"productId": "product_002", "quantity": 1, "price": 1199.99}, {"productId": "product_003", "quantity": 2, "price": 249.99}], "total": 1699.97, "status": "shipped", "date": "2026-04-20"},
    {"id": "order_003", "type": "order", "userId": "user_001", "items": [{"productId": "product_004", "quantity": 1, "price": 349.99}], "total": 349.99, "status": "pending", "date": "2026-05-01"},
    {"id": "order_004", "type": "order", "userId": "user_003", "items": [{"productId": "product_005", "quantity": 2, "price": 499.99}], "total": 999.98, "status": "cancelled", "date": "2026-05-02"},
]

print(f"Loading {len(sample_data)} documents into Couchbase...")

for doc in sample_data:
    doc_id = doc.pop("id")
    try:
        collection.upsert(doc_id, doc)
        print(f"  Loaded: {doc_id}")
    except Exception as e:
        print(f"  Failed {doc_id}: {e}")

print(f"\nDone! All {len(sample_data)} documents loaded.")
print(f"Open http://127.0.0.1:5000 to view them in the web app.")
