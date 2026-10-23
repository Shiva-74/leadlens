import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MessageSquareText,
  Mic,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { useToast } from '../lib/toast';
import { LeadSource } from '../lib/types';

const TIMELINE_OPTIONS = [
  '',
  'Immediately',
  'Within 1 month',
  '1 to 3 months',
  '3 to 6 months',
  '6+ months',
  'Not sure',
];

const MESSY_HINGLISH_EXAMPLE = {
  name: 'Nikhil Malhotra',
  location: 'Whitefield, Bengaluru',
  property_requirement: '3 BHK apartment, ready to move',
  budget_text: '1.25 Cr to 1.35 Cr',
  timeline: 'Within 1 month',
  customer_message:
    'Bhai we are looking for 3 BHK in Whitefield close to Hoodi or Hopefarm metro. Budget around 1.25 to 1.35 cr max all inclusive. Kid school starts next month so ready-to-move ya immediate possession hi chahiye. HDFC loan pre-approved hai. Can we visit this Sunday morning? Also confirm if OC is received.',
};

const SAMPLE_VOICE_TRANSCRIPT =
  'Spoke with Mrs. Kavita Nair at the property expo. Unko Gachibowli ya Kokapet Hyderabad mein 3 BHK flat chahiye, around 1800 sq ft. Budget bol rahe the 1.45 se 1.60 crore ke beech mein. Husband IT mein hain, SBI home loan lenge. Unka lease agle do mahine mein khatam ho raha hai so within 1 to 3 months shift karna chahte hain. Main concern hai ki society mein kids play area aur 100% power backup hona chahiye, aur RERA registered project hi dekhenge. Saturday shaam 4 baje site visit ke liye bola hai.';

export function NewLeadPage({ onLeadCreated }: { onLeadCreated?: () => void }) {
  const [activeTab, setActiveTab] = useState<'form' | 'paste' | 'voice'>('form');
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Form fields
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [propertyRequirement, setPropertyRequirement] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [timeline, setTimeline] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [source, setSource] = useState<LeadSource>('form');

  // Unclear fields marked 'Please confirm' after extraction
  const [pleaseConfirmFields, setPleaseConfirmFields] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Paste & Voice state
  const [pastedText, setPastedText] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSampleVoice, setIsSampleVoice] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Analyze state & step text
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('Reading message');

  const fillExample = () => {
    setName(MESSY_HINGLISH_EXAMPLE.name);
    setLocation(MESSY_HINGLISH_EXAMPLE.location);
    setPropertyRequirement(MESSY_HINGLISH_EXAMPLE.property_requirement);
    setBudgetText(MESSY_HINGLISH_EXAMPLE.budget_text);
    setTimeline(MESSY_HINGLISH_EXAMPLE.timeline);
    setCustomerMessage(MESSY_HINGLISH_EXAMPLE.customer_message);
    setSource('form');
    setPleaseConfirmFields({});
    setErrors({});
  };

  const handleExtractAndFill = async (rawText: string, originSource: 'transcript' | 'voice') => {
    if (!rawText || rawText.trim().length < 4) {
      showToast('Please provide a transcript or chat message first.', 'error');
      return;
    }

    setExtracting(true);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not extract fields');
      }

      const data = json.data;
      const confirmMap: Record<string, boolean> = {};

      setName(data.name || '');
      if (!data.name) confirmMap.name = true;

      setLocation(data.location || '');
      if (!data.location) confirmMap.location = true;

      setPropertyRequirement(data.property_requirement || '');
      if (!data.property_requirement) confirmMap.property_requirement = true;

      setBudgetText(data.budget_text || '');
      if (!data.budget_text) confirmMap.budget_text = true;

      const matchedTimeline = TIMELINE_OPTIONS.includes(data.timeline || '')
        ? data.timeline
        : 'Not sure';
      setTimeline(matchedTimeline || '');
      if (!data.timeline) confirmMap.timeline = true;

      setCustomerMessage(data.customer_message || rawText);
      setSource(originSource);
      setPleaseConfirmFields(confirmMap);
      setErrors({});
      setActiveTab('form');
      showToast('Extracted lead details. Please review and click Analyze lead.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Extraction failed. Please enter details manually.', 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Customer name is required';
    if (!location.trim()) newErrors.location = 'Location is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setAnalyzing(true);
    setAnalyzeStep('Reading message');

    const t1 = window.setTimeout(() => setAnalyzeStep('Scoring'), 1800);
    const t2 = window.setTimeout(() => setAnalyzeStep('Drafting reply'), 3600);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          property_requirement: propertyRequirement.trim() || null,
          budget_text: budgetText.trim() || null,
          timeline: timeline || null,
          customer_message: customerMessage.trim() || null,
          source,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save lead');
      }

      if (data.warning) {
        showToast(data.warning, 'info');
      } else {
        showToast('Lead analyzed and scored!', 'success');
      }

      onLeadCreated?.();
      navigate(`/leads/${data.lead.id}`);
    } catch (err: any) {
      showToast(err.message || 'Could not analyze lead', 'error');
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setAnalyzing(false);
    }
  };

  const PleaseConfirmBadge = ({ field }: { field: string }) =>
    pleaseConfirmFields[field] ? (
      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#FEF3E2] text-[#B54708]">
        Please confirm
      </span>
    ) : null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Three Tabs */}
      <div className="flex flex-wrap gap-2 mb-5 border-b border-[#E7E5E0] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === 'form'
              ? 'bg-[#0F766E] text-white'
              : 'bg-white border border-[#E7E5E0] text-[#5F5C55] hover:text-[#1C1B19]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Enter details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('paste')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === 'paste'
              ? 'bg-[#0F766E] text-white'
              : 'bg-white border border-[#E7E5E0] text-[#5F5C55] hover:text-[#1C1B19]'
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          <span>Paste a call or chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === 'voice'
              ? 'bg-[#0F766E] text-white'
              : 'bg-white border border-[#E7E5E0] text-[#5F5C55] hover:text-[#1C1B19]'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>Voice note</span>
        </button>
      </div>

      {/* TAB 1: ENTER DETAILS */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmitForm} className="card-surface p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#E7E5E0] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#1C1B19]">Lead information</h2>
              <p className="text-xs text-[#5F5C55]">
                Enter the buyer's details or click "Try an example" to test with a Hinglish inquiry.
              </p>
            </div>
            <button
              type="button"
              onClick={fillExample}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Try an example</span>
            </button>
          </div>

          {source === 'voice' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E6F2F0] border border-[#0F766E]/30 text-xs text-[#0F766E] font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Prefilled from Voice Note transcript. Confirm any highlighted fields below.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                Name <span className="text-[#B42318]">*</span>
                <PleaseConfirmBadge field="name" />
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setPleaseConfirmFields((p) => ({ ...p, name: false }));
                }}
                placeholder="e.g. Rohit Sharma"
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
              />
              {errors.name && (
                <p className="text-xs text-[#B42318] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                Location <span className="text-[#B42318]">*</span>
                <PleaseConfirmBadge field="location" />
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPleaseConfirmFields((p) => ({ ...p, location: false }));
                }}
                placeholder="Whitefield, Bengaluru"
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
              />
              {errors.location && (
                <p className="text-xs text-[#B42318] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.location}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                Property requirement
                <PleaseConfirmBadge field="property_requirement" />
              </label>
              <input
                type="text"
                value={propertyRequirement}
                onChange={(e) => setPropertyRequirement(e.target.value)}
                placeholder="3 BHK apartment, ready to move"
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                Budget
                <PleaseConfirmBadge field="budget_text" />
              </label>
              <input
                type="text"
                value={budgetText}
                onChange={(e) => setBudgetText(e.target.value)}
                placeholder="1.2 cr or 80-90 lakhs"
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
              />
              <span className="text-[11px] text-[#8C8980] block mt-1">
                Write it naturally, like 1.2 cr or 80-90 lakhs
              </span>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
                Buying timeline
                <PleaseConfirmBadge field="timeline" />
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
              >
                <option value="">Select timeline...</option>
                {TIMELINE_OPTIONS.filter(Boolean).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1B19] mb-1">
              Customer message
            </label>
            <textarea
              rows={5}
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              placeholder="Paste the inquiry, WhatsApp message, or call summary..."
              className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
            />
            <span className="text-[11px] text-[#8C8980] block mt-1">
              Paste the inquiry or chat exactly as received
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={analyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-sm font-medium transition cursor-pointer disabled:opacity-60"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{analyzeStep}...</span>
                </>
              ) : (
                <span>Analyze lead</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: PASTE A CALL OR CHAT */}
      {activeTab === 'paste' && (
        <div className="card-surface p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#1C1B19]">Paste a call transcript or WhatsApp chat</h2>
            <p className="text-xs text-[#5F5C55]">
              We will extract the buyer's name, location, budget, requirement, and timeline into the form so you can verify before scoring.
            </p>
          </div>

          <textarea
            rows={7}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Example: Spoke to Sneha Patil from Pune. Looking for 2 BHK in Baner or Pashan around 90 lakhs, shifting in 2 months..."
            className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleExtractAndFill(pastedText, 'transcript')}
              disabled={extracting || !pastedText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-sm font-medium transition cursor-pointer disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting fields...</span>
                </>
              ) : (
                <span>Extract and fill form</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: VOICE NOTE */}
      {activeTab === 'voice' && (
        <div className="card-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E5E0] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#1C1B19]">Voice note to structured lead</h2>
              <p className="text-xs text-[#5F5C55]">
                Speak a quick 30-second voice note or upload a call recording.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setVoiceTranscript(SAMPLE_VOICE_TRANSCRIPT);
                setIsSampleVoice(true);
                showToast('Loaded sample Hinglish voice note transcript.', 'info');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-[#F7F7F5] hover:bg-[#EAE8E1] text-xs font-medium text-[#1C1B19] cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Use a sample voice note</span>
            </button>
          </div>

          <VoiceRecorder
            onTranscriptReady={(text, provider) => {
              setVoiceTranscript(text);
              setIsSampleVoice(false);
              showToast(`Transcribed via ${provider || 'Speech-to-Text'}`, 'success');
            }}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#1C1B19]">
                Editable transcript
              </label>
              {isSampleVoice && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF3E2] text-[#B54708]">
                  Sample
                </span>
              )}
            </div>
            <textarea
              rows={5}
              value={voiceTranscript}
              onChange={(e) => setVoiceTranscript(e.target.value)}
              placeholder="Your transcribed voice note will appear here. You can edit any names or numbers before extracting..."
              className="w-full px-3 py-2 rounded-lg border border-[#E7E5E0] bg-white text-sm text-[#1C1B19]"
            />
            <span className="text-[11px] text-[#8C8980] block mt-1">
              Check the transcript and fix any mistakes before continuing
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleExtractAndFill(voiceTranscript, 'voice')}
              disabled={extracting || !voiceTranscript.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-sm font-medium transition cursor-pointer disabled:opacity-50"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting fields...</span>
                </>
              ) : (
                <span>Extract and fill form</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}