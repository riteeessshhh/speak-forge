# ⚡ SpeakForge LLM Evaluation Report
**Timestamp**: 2026-11-07T14:06:28.423Z  
**Overall Pass Rate**: 100% (8/8)  
**Schema Conformance**: 100%  
**Average Latency**: 2478ms  

| ID | Name | Status | Latency | Conf | Clar | Struct | Fillers | STAR | Failures |
|---|---|---|---|---|---|---|---|---|---|
| `tc_01_star_method_high_performer` | STAR Behavioral High Performer | ✅ PASS | 3187ms | 8 | 8 | 8 | 0 | true | None |
| `tc_02_rambling_heavy_filler` | Rambling Answer with Heavy Fillers | ✅ PASS | 2597ms | 5 | 6 | 4 | 6 | - | None |
| `tc_03_filler_context_disambiguation` | Grammatical 'like' vs Filler Crutch | ✅ PASS | 2459ms | 6 | 7 | 5 | 0 | - | None |
| `tc_04_potato_salad_adversarial` | Adversarial Off-Topic ('Potato Salad' Test) | ✅ PASS | 2180ms | 0 | 0 | 0 | 0 | - | None |
| `tc_05_invalid_session_silence` | Invalid Session / Under 3 Words Silence | ✅ PASS | 1482ms | 0 | 0 | 0 | 0 | - | None |
| `tc_06_senior_system_design` | Senior Architecture & Technical Depth | ✅ PASS | 2898ms | 8 | 9 | 8 | 0 | - | None |
| `tc_07_vague_junior_answer` | Vague Junior Answer (Lacks Depth) | ✅ PASS | 2357ms | 4 | 5 | 3 | 0 | - | None |
| `tc_08_startup_pitch` | Startup Pitch Track (Hook, Value Prop & CTA) | ✅ PASS | 2666ms | 9 | 9 | 8 | 0 | - | None |
