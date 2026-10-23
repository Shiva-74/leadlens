\# LeadLens: Voice-First Lead Triage \& Call Loop Workspace



\## What I built

LeadLens is a voice-first, AI-assisted lead triage workspace built for real-estate salespeople in India. Salespeople rarely want to type long notes before or after a customer call. With LeadLens, a salesperson can speak a 30-second voice note (in English or Hinglish) or upload a call recording, verify the editable transcript, and turn it into a structured, scored lead. Before calling the customer, LeadLens generates a 30-second pre-call brief. After the call, the salesperson records a quick voice debrief to automatically re-score the lead, track promises made on the call, and draft the follow-up WhatsApp message.



In production at a voice AI company, audio would arrive directly from the telephony/call system; the browser voice recorder and file upload box serve as the stand-in for this demo.



\## Live demo URL

`\[Placeholder: Insert your Render / Cloud Run live URL here]`



\## Architecture overview



```text

+-----------------------------------------------------------------------+

|                        Browser (React + Vite)                         |

|  - Today's Queue, All Leads, New Lead (Form / Paste / Voice Note)     |

|  - Lead Detail Workspace: Analysis + Grounded Chat + Voice Call Loop  |

+-----------------------------------+-----------------------------------+

&#x20;                                   | HTTPS (JSON + Multipart Audio)

&#x20;                                   v

+-----------------------------------------------------------------------+

|                     Node.js + Express + TypeScript                    |

|  - Anonymous Session Cookie (leadlens\_sid)                            |

|  - Zod Request \& AI Schema Validation + Deterministic Scoring Engine  |

+-----------------+-----------------------------------+-----------------+

&#x20;                 |                                   |

&#x20;                 v                                   v

+-----------------------------------+   +-------------------------------+

|       Text AI Provider Chain      |   |   Voice Transcription Chain   |

| 1. NVIDIA Nemotron 3.5 Super 120B |   | 1. Groq whisper-large-v3-turbo|

| 2. Google Gemini 3.8 Flash        |   | 2. Groq whisper-large-v3      |

| 3. Groq Llama 4 Scout             |   | 3. Gemini Audio Inline        |

+-----------------+-----------------+   +-------------------------------+

&#x20;                 |

&#x20;                 v

+-----------------------------------------------------------------------+

|                       Neon Serverless PostgreSQL                      |

|  Tables: sessions, leads, chat\_messages, call\_events                  |

+-----------------------------------------------------------------------+

