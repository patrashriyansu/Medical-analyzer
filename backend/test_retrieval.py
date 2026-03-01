from retrieval import MedicalRetriever

retriever = MedicalRetriever()

query = "High LDL cholesterol detected in patient report."
results = retriever.retrieve(query)

print("Retrieved Documents:\n")
for doc in results:
    print(doc)
    print("-" * 50)