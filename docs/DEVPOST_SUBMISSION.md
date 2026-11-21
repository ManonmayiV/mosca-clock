# Devpost submission text: Mosca Clock

Paste each section into the matching Devpost field. Items in [brackets] need your input before you submit.

---

## Project title

Mosca Clock: a post-quantum exposure planner for AI workloads

## Tagline (short description)

List where your AI system moves data, and find out which flows a future quantum computer can already read.

---

## Inspiration

My DBA dissertation asks how enterprises can move AI systems to post-quantum cryptography without breaking performance or overwhelming the teams who run them. While writing the proposal I kept returning to one inequality from Michele Mosca: if migration time plus the years data must stay secret is greater than the years until a quantum computer can break RSA and elliptic curves, you are already losing that data. Somebody is recording the traffic now.

The literature has the formula. It does not have a way for a team to apply it to the dozen data flows inside an AI system on a Tuesday afternoon.

The moment it clicked was in August, while I was drafting the interview guide for the second phase of my study. That phase puts 15 to 20 CISOs and senior architects in front of me for an hour each and asks them to react to post-quantum tradeoffs in their own AI systems. I wrote the opening question, "Which of your AI data flows would you migrate first?", and realised I could not answer it myself for even one made-up system. Not without a spreadsheet and a free afternoon. A CISO with sixty minutes on the calendar was not going to do better.

So I built the thing I wanted to put on the table in those interviews.

## What it does

Mosca Clock takes an inventory of AI data flows and scores each one against a quantum timeline you choose.

You pick a workload type (training data upload, model weights replication, inference API, RAG retrieval, model signing, federated learning, agent tool calls), then record its key exchange, signature algorithm, bulk cipher, how many years the data must stay secret, and how many years migration will take. The app returns:

- a status per flow: Critical, High, Medium, Low or Ready
- a Mosca chart that draws migration time and shelf life against the quantum line
- a ranked migration plan with specific replacements, such as X25519 to X25519MLKEM768
- the byte cost of those replacements per handshake and per day
- a Markdown report to hand to an architecture review

Drag the quantum-year slider from 2035 to 2030 and the fictional sample hospital goes from one Critical flow to three.

## The problem

Most AI security work looks at the model: prompt injection, poisoning, model theft. The encryption underneath gets treated as solved. It is not solved for data with a long shelf life. Medical images used for training, embeddings of internal documents, gradients in federated learning (which can be inverted back into training examples): all of it moves over TLS secured by key exchange that Shor's algorithm breaks.

NIST published the replacement standards, FIPS 203, 204 and 205, in August 2024. Knowing the standards exist does not tell a team which of their AI flows to migrate first.

## Who it helps

Security architects and platform teams running AI in regulated industries, where data retention runs 10 to 25 years. Also students and researchers who want a hands-on way to understand harvest-now-decrypt-later beyond a slide.

## What makes it different

It separates the two quantum risks that most checklists merge. Key exchange can be harvested today and decrypted later, so shelf life matters. Signatures cannot be harvested; they only fail once the quantum computer exists, so shelf life is irrelevant and only migration speed counts. A model-signing pipeline with a 4-year migration plan is a different problem from a training upload with 25-year medical records, and the tool scores them differently.

It is also honest about cost. Moving one handshake from X25519 with ECDSA P-256 to X25519MLKEM768 with ML-DSA-65 grows the cryptographic payload from 192 bytes to 7,597. At a million inference handshakes a day that is about 7.4 GB. Teams need that number before they argue about rollout.

## How I built it

Plain HTML, CSS and JavaScript ES modules. No framework, no backend, no API keys. The scoring model lives in one file with no browser code, so the same logic runs in the page and in 17 Node unit tests. Algorithm sizes come straight from the FIPS documents and the IETF hybrid key exchange draft. Data stays in the browser's local storage.

I used an AI coding assistant to write most of the code and tests from my specification. The model, the workload categories and the scoring rules come from my dissertation framework. I reviewed the output, checked the byte sizes against the standards, and ran the tests.

## Challenges

Choosing the quantum year. Any default looks like a prediction. I settled on 2035 because draft NIST IR 8547 proposes disallowing RSA and ECC after 2035, and I labelled it as a policy date, not a forecast. The slider exists because the honest answer is "nobody knows".

## What I would argue against my own tool

The output is only as good as two guesses: shelf life and migration time. A team that writes "1 year" for migration because it sounds good will get a green chart and a false sense of safety. I could not engineer that away. The tool makes the guess visible, and that is the most it can do. It also scores one flow at a time; if a RAG index is built from the same records as the training upload, the real exposure is the longer of the two, and the tool will not catch that for you.

## What I learned

I had the cost backwards.

My proposal leans on ML-KEM's larger keys, so I expected key exchange to be the expensive part of the migration. Then I worked the handshake sizes out of FIPS 203 and 204. Moving from X25519 to the hybrid X25519MLKEM768 adds about 2.3 KB. Moving from ECDSA P-256 to ML-DSA-65 adds about 5.1 KB. Signatures carry more than two thirds of the extra bytes, and they are the half with no harvest-now risk.

That changes how I would sequence a migration. Key exchange still goes first, because that is where data is leaking today. But the team should budget for signatures being the heavier change on the wire. It also handed me a hypothesis to test in the benchmarking phase of my dissertation, instead of an assumption I would have carried in.

## What's next

- Use the tool in the qualitative phase of my dissertation, as a prompt in expert interviews
- Import a real cryptographic inventory (CycloneDX CBOM) instead of typing flows by hand
- Link flows that share data so exposure carries over between them
- Measured, not calculated, latency overhead from the benchmarking phase of my study

## Built with

HTML, CSS, JavaScript (ES modules), SVG, Node.js test runner, GitHub Pages, AI coding assistant

## Links

- Live demo: [https://manonmayiv.github.io/mosca-clock/#sample]
- Source: [https://github.com/manonmayiv/mosca-clock]
- Demo video: [YouTube or Loom link]

## Team

Manonmayi Vedam (solo)
