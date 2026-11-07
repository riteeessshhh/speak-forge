# ⚡ SpeakForge LLM Evaluation Report
**Timestamp**: 2026-11-07T14:45:04.605Z  
**Overall Pass Rate**: 100% (8/8)  
**Schema Conformance**: 100%  
**Average Latency**: 5833ms  

| ID | Name | Status | Latency | Conf | Clar | Struct | Fillers | STAR | Failures |
|---|---|---|---|---|---|---|---|---|---|
| `tc_01_star_method_high_performer` | STAR Behavioral High Performer | ✅ PASS | 3686ms | 8 | 9 | 8 | 0 | true | None |
| `tc_02_rambling_heavy_filler` | Rambling Answer with Heavy Fillers | ✅ PASS | 16047ms | 4 | 5 | 4 | 9 | - | None |
| `tc_03_filler_context_disambiguation` | Grammatical 'like' vs Filler Crutch | ✅ PASS | 6590ms | 6 | 7 | 5 | 0 | - | None |
| `tc_04_potato_salad_adversarial` | Adversarial Off-Topic ('Potato Salad' Test) | ✅ PASS | 8584ms | 0 | 0 | 0 | 0 | - | None |
| `tc_05_invalid_session_silence` | Invalid Session / Under 3 Words Silence | ✅ PASS | 2559ms | 0 | 0 | 0 | 0 | - | None |
| `tc_06_senior_system_design` | Senior Architecture & Technical Depth | ✅ PASS | 3362ms | 8 | 9 | 8 | 0 | - | None |
| `tc_07_vague_junior_answer` | Vague Junior Answer (Lacks Depth) | ✅ PASS | 3053ms | 5 | 6 | 4 | 0 | - | None |
| `tc_08_startup_pitch` | Startup Pitch Track (Hook, Value Prop & CTA) | ✅ PASS | 2782ms | 9 | 9 | 8 | 0 | - | None |
