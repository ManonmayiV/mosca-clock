# Demo video script (about 2.5 minutes)

Record with Loom or OBS. Show the live app, not slides. Open `http://127.0.0.1:8080/` with an empty inventory (clear local storage first) so you can load the sample on camera.

## 0:00 to 0:20 Who and why

Screen: app header.

"I'm Manonmayi Vedam. I'm a DBA candidate, and my dissertation is about moving AI systems to post-quantum cryptography. This is Mosca Clock. It answers one question: which of my AI system's data flows could a future quantum computer already read?"

## 0:20 to 0:45 The formula

Screen: section 1, point at the formula line.

"It's built on Mosca's inequality. Migration time plus how long the data must stay secret. If that's longer than the time until a quantum computer can break RSA and elliptic curves, you have a problem today, because attackers can record the traffic now and decrypt it later."

## 0:45 to 1:15 Load the sample

Click "Load sample (fictional health system)". Scroll to results.

"This is a made-up hospital with six AI flows. At a 2035 quantum year, one is Critical: patient imaging uploaded for training. Those records must stay private for 25 years. The quantum line is 9 years out. That traffic is already harvestable."

Point at the chart: blue is migration, orange is shelf life, the dashed red line is the quantum year.

## 1:15 to 1:40 What-if

Click the "2030: aggressive" preset.

"Nobody knows the real date, so it's a slider. Move it to 2030 and three flows go Critical, including the RAG retrieval over clinical notes."

Click back to 2035.

## 1:40 to 2:05 The plan

Scroll to the migration plan, first item.

"Each flow gets concrete steps. Move key exchange to the hybrid X25519MLKEM768 in TLS 1.3, swap RSA signatures for ML-DSA. And the cost: about 7 KB more per handshake. For the chat API at a million handshakes a day that's around 7 GB. Teams need that number before rollout."

Point at "Radiology model release signing": "Signatures are scored differently. They can't be harvested, so only migration speed matters."

## 2:05 to 2:20 Add your own, export

Pick "Inference API" in the form, type a name, click Add workload. Click "Download report (Markdown)".

## 2:20 to 2:35 Tech and next

"Plain JavaScript, no backend, data stays in your browser. Seventeen unit tests on the scoring model. I used an AI coding assistant to build it from my specification. Next, I'll use it in the interview phase of my dissertation and add import from a cryptographic bill of materials."
