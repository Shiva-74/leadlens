export interface SeedLeadInput {
  name: string;
  location: string;
  property_requirement: string;
  budget_text: string;
  timeline: string;
  customer_message: string;
  source: 'sample';
}

export const SAMPLE_LEADS: SeedLeadInput[] = [
  // 1) Hot Hinglish WhatsApp lead, exact budget, site-visit date
  {
    name: 'Rohit Verma',
    location: 'Whitefield, Bengaluru',
    property_requirement: '3 BHK Apartment, Ready to Move',
    budget_text: '1.35 Cr',
    timeline: 'Within 1 month',
    customer_message:
      'Hi bhai, saw your listing near Hopefarm metro Whitefield. Need 3BHK ready to move for family, shifting next month. Max budget 1.35 cr all inclusive. HDFC home loan sanction letter ready hai for 1 cr. Can we do site visit this Saturday 11 AM? Also share RERA number please.',
    source: 'sample',
  },

  // 2) Rambling English email from an investor asking about rental yield
  {
    name: 'Vikramaditya Nair',
    location: 'Gachibowli, Hyderabad',
    property_requirement: '2 BHK investment unit in gated society',
    budget_text: '95 Lakhs to 1.1 Cr',
    timeline: '1 to 3 months',
    customer_message:
      'Hello team, I am currently rebalancing my portfolio and looking at residential assets around Financial District or Gachibowli. My primary criterion is rental yield—ideally 4.5%+ from IT tenants—and builder track record on timely delivery. I can deploy between 95L and 1.10 Cr if the pre-EMI scheme or rental guarantee makes sense. Could you send a comparison sheet of 2 BHK units, current maintenance charges per sq ft, and historical appreciation in that micro-market?',
    source: 'sample',
  },

  // 3) Vague 'just checking prices' lead, huge budget, no intent or timeline
  {
    name: 'Karanveer Singhania',
    location: 'Worli, Mumbai',
    property_requirement: '4 BHK Sea View or Penthouse',
    budget_text: '12 Cr',
    timeline: 'Not sure',
    customer_message:
      'Just checking current rates in Worli side. Nothing urgent, just browsing what is available in luxury towers right now. Send brochure on WhatsApp if you have.',
    source: 'sample',
  },

  // 4) Unrealistic budget for the stated area
  {
    name: 'Sandeep Kulkarni',
    location: 'Powai, Mumbai',
    property_requirement: '3 BHK with balcony and 2 car parking in new tower',
    budget_text: '65 Lakhs',
    timeline: '1 to 3 months',
    customer_message:
      'Looking for a spacious 3 BHK in Powai Hiranandani or nearby gated complex with clubhouse, swimming pool and 2 covered parkings. My strict budget is 65 lakhs all inclusive. Let me know ready options.',
    source: 'sample',
  },

  // 5) Conflicting form and message (form says 2 BHK, message says 3 BHK)
  {
    name: 'Priya Deshmukh',
    location: 'Wakad, Pune',
    property_requirement: '2 BHK Apartment',
    budget_text: '85 Lakhs',
    timeline: 'Immediately',
    customer_message:
      'Actually humne pehle 2 BHK socha tha form bharne time, par ab in-laws bhi saath rahenge toh strictly 3 BHK hi chahiye in Wakad or Baner border. Budget hum stretch karke 1.05 Cr tak ja sakte hain if possession is within 2 months. Vastu east facing entrance must hai.',
    source: 'sample',
  },

  // 6) Worried about RERA registration and home-loan approval
  {
    name: 'Ananya Chatterjee',
    location: 'Sarjapur Road, Bengaluru',
    property_requirement: '2.5 or 3 BHK under construction',
    budget_text: '1.15 Cr',
    timeline: '3 to 6 months',
    customer_message:
      'We liked the layout on Sarjapur road, budget around 1.15 Cr works, but honestly very worried because our cousin got stuck in a delayed project without OC. Is the phase 2 RERA certificate out? And is this project approved by SBI and ICICI for home loan? We will only pay booking amount after seeing SBI APF number and RERA certificate.',
    source: 'sample',
  },

  // 7) NRI buying for parents, formal English
  {
    name: 'Arjun & Meera Krishnan',
    location: 'Kalyani Nagar, Pune',
    property_requirement: '3 BHK senior-friendly low floor apartment',
    budget_text: '1.6 Cr to 1.8 Cr',
    timeline: '1 to 3 months',
    customer_message:
      'Good day. I am writing from Singapore. My wife and I wish to purchase a ready-to-move 3 BHK in Kalyani Nagar for my retired parents. Wheelchair access, stretcher lift, power backup, and proximity to a multi-specialty hospital are non-negotiable. Budget is 1.6 to 1.8 Cr via NRE account. My father can visit the property next Tuesday afternoon if you can arrange a dedicated representative.',
    source: 'sample',
  },

  // 8) Nearly empty one-line message
  {
    name: 'Deepak Yadav',
    location: 'Hinjewadi, Pune',
    property_requirement: '2 BHK',
    budget_text: '',
    timeline: 'Not sure',
    customer_message: '2bhk price detail send karo',
    source: 'sample',
  },
];