import numpy as np

# Dummy embedding generator (for testing RAG pipeline)
def generate_embedding(text: str):
    np.random.seed(abs(hash(text)) % (10**8))
    return np.random.rand(384).astype("float32")