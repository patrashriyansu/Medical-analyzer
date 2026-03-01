import os
import faiss
import numpy as np
from embedding import generate_embedding

DIMENSION = 384

class MedicalRetriever:
    def __init__(self, knowledge_path="knowledge_base"):
        self.knowledge_path = knowledge_path
        self.documents = []
        self.index = faiss.IndexFlatL2(DIMENSION)
        self._load_knowledge()

    def _load_knowledge(self):
        for filename in os.listdir(self.knowledge_path):
            if filename.endswith(".txt"):
                with open(os.path.join(self.knowledge_path, filename), "r", encoding="utf-8") as f:
                    content = f.read()
                    self.documents.append(content)
                    embedding = generate_embedding(content)
                    self.index.add(np.array([embedding]))

    def retrieve(self, query_text, top_k=2):
        query_embedding = generate_embedding(query_text)
        distances, indices = self.index.search(
            np.array([query_embedding]), top_k
        )

        results = []
        for idx in indices[0]:
            results.append(self.documents[idx])

        return results