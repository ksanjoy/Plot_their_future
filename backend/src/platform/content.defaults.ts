import type { IntroScreen, LocalizedText } from '../models/types.js';

const t = (en: string, hi: string, te: string): LocalizedText => ({ en, hi, te });

export const DEFAULT_DISCLAIMER = t(
  [
    'A Message from PlotTheirFuture',
    'PlotTheirFuture is pleased to host this celebration registry on behalf of the couple and their families. We believe that an invited guest\'s presence, warmth and blessings are always the greatest and most meaningful gifts. Gifting on this platform is completely voluntary, and invitees are under no obligation whatsoever.',
    '1. Blessings First. Your presence at the celebrations is cherished above all material tokens.',
    '2. Zero Obligation. This registry is purely optional; every guest is welcomed with open arms.',
    '3. Mindful Gifting. If you choose to gift, sponsor a square foot of their first home rather than boxed items.',
    'A square foot (or brick) is a symbolic unit toward the couple\'s home down payment. It is not ownership of property.',
    'Voluntary contributions are held for the couple\'s home down payment. Escrow and tax wording must match the live payment arrangement and a chartered accountant\'s advice.',
    'Empowering loved ones to lay the foundation for a lifetime of memories.',
    'Issued by PlotTheirFuture.in on behalf of the Celebrating Families.',
  ].join('\n\n'),
  [
    'PlotTheirFuture की ओर से संदेश',
    'PlotTheirFuture यह उत्सव रजिस्ट्री दंपति और उनके परिवार की ओर से होस्ट करता है। आमंत्रित अतिथि की उपस्थिति, स्नेह और आशीर्वाद सबसे बड़ा उपहार हैं। इस मंच पर उपहार देना पूरी तरह स्वैच्छिक है। किसी भी अतिथि पर कोई दायित्व नहीं है।',
    '1. आशीर्वाद पहले। उत्सव में आपकी उपस्थिति हर भौतिक चीज़ से ऊपर है।',
    '2. शून्य दायित्व। यह रजिस्ट्री पूरी तरह वैकल्पिक है।',
    '3. समझदारी से उपहार। यदि आप दें, तो बॉक्स में बंद सामान के बजाय उनके पहले घर का एक वर्ग फुट।',
    'एक वर्ग फुट या ईंट उनके घर के डाउन पेमेंट की ओर एक प्रतीकात्मक इकाई है। यह संपत्ति का स्वामित्व नहीं है।',
    'स्वैच्छिक योगदान दंपति के घर के डाउन पेमेंट के लिए रखे जाते हैं। एस्क्रो और कर की अंतिम भाषा कानूनी सलाह के अनुसार होगी।',
  ].join('\n\n'),
  [
    'PlotTheirFuture తరఫున సందేశం',
    'PlotTheirFuture ఈ వేడుక రిజిస్ట్రీని జంట మరియు వారి కుటుంబాల తరఫున నిర్వహిస్తుంది. ఆహ్వానిత అతిథి హాజరు, ప్రేమ మరియు ఆశీర్వాదమే గొప్ప బహుమతి. ఈ వేదికపై బహుమతి పూర్తిగా స్వచ్ఛందం. ఎలాంటి బాధ్యత లేదు.',
    '1. ఆశీర్వాదమే మొదట. మీ హాజరు ఏ వస్తువు కంటే విలువైనది.',
    '2. బాధ్యత లేదు. ఈ రిజిస్ట్రీ ఐచ్ఛికం.',
    '3. స్పృహతో బహుమతి. ఇవ్వాలనుకుంటే పెట్టెల్లోని వస్తువుల బదులు వారి మొదటి ఇంటి ఒక చదరపు అడుగు.',
    'ఒక చదరపు అడుగు లేదా ఇటుక అనేది డౌన్ పేమెంట్ వైపు ప్రతీకాత్మక యూనిట్. ఇది ఆస్తి యాజమాన్యం కాదు.',
    'స్వచ్ఛంద విరాళాలు జంట ఇంటి డౌన్ పేమెంట్ కోసం ఉంచబడతాయి. ఎస్క్రో మరియు పన్ను పదాలు న్యాయ సలహా తర్వాత ఖరారు అవుతాయి.',
  ].join('\n\n'),
);

export const DEFAULT_INTRO: IntroScreen[] = [
  {
    title: t('The wedding gift that becomes their forever', 'वह शादी का उपहार जो उनका हमेशा बन जाए', 'వారి శాశ్వత బహుమతి అయ్యే పెళ్లి బహుమతి'),
    body: t(
      'PlotTheirFuture is a wedding gift registry built around a home. Loved ones contribute toward the couple\'s first home instead of duplicate appliances and forgotten envelopes.',
      'PlotTheirFuture घर के सपने पर बनी शादी की गिफ्ट रजिस्ट्री है। अपनों का योगदान दंपति के पहले घर की नींव बनता है।',
      'PlotTheirFuture ఇల్లు అనే కల చుట్టూ నిర్మించిన పెళ్లి గిఫ్ట్ రిజిస్ట్రీ. ప్రియమైనవారి సహాయం జంట మొదటి ఇంటి పునాది అవుతుంది.',
    ),
  },
  {
    title: t('For the couple', 'दंपति के लिए', 'జంట కోసం'),
    body: t(
      'Register your wedding, choose a flat the admin has listed, and after approval invite guests, track RSVPs, logistics and every square foot they gift.',
      'अपनी शादी दर्ज करें, एडमिन की फ्लैट सूची से घर चुनें, और मंजूरी के बाद निमंत्रण, RSVP, ठहराव और उपहार देखें।',
      'మీ పెళ్లిని నమోదు చేసి, అడ్మిన్ జాబితాలోని ఫ్లాట్ ఎంచుకోండి. ఆమోదం తర్వాత ఆహ్వానాలు, RSVP, బస మరియు బహుమతులు చూడండి.',
    ),
  },
  {
    title: t('For the guest', 'अतिथि के लिए', 'అతిథి కోసం'),
    body: t(
      'Open the wedding link, RSVP, share stay and food needs, and if you wish gift a square foot or a few bricks. There is no obligation.',
      'शादी का लिंक खोलें, RSVP करें, ठहराव और भोजन बताएं, और चाहें तो एक वर्ग फुट या कुछ ईंटें उपहार दें। कोई बाध्यता नहीं।',
      'పెళ్లి లింక్ తెరిచి RSVP చేయండి, బస మరియు భోజనం చెప్పండి. కోరితే ఒక చదరపు అడుగు లేదా కొన్ని ఇటుకలు ఇవ్వండి. బాధ్యత లేదు.',
    ),
  },
  {
    title: t('Celebrate the wedding. Build the future.', 'शादी मनाएं। भविष्य बनाएं।', 'వేడుక చేయండి. భవిష్యత్తు నిర్మించండి.'),
    body: t(
      'Don\'t just attend their wedding. Be part of their foundation.',
      'सिर्फ शादी में शामिल न हों। उनकी नींव का हिस्सा बनें।',
      'పెళ్లికి హాజరు మాత్రమే కాదు. వారి పునాదిలో భాగం అవ్వండి.',
    ),
  },
];

export const DEFAULT_TERMS = t(
  'These terms are a working draft for counsel review before launch. A square foot or brick is a symbolic contribution toward the couple\'s home down payment, not a sale of real estate or fractional ownership. Gifting is voluntary. Refunds, if a wedding is cancelled or a payment cannot be applied to the registry, are reviewed by the platform and the payment partner. Payouts require identity and bank verification of the receiving party. Contact the support address published in the app for grievances.',
  'ये शर्तें लॉन्च से पहले कानूनी समीक्षा के लिए एक कार्यशील मसौदा हैं। वर्ग फुट या ईंट घर के डाउन पेमेंट की ओर प्रतीकात्मक योगदान है, संपत्ति की बिक्री नहीं। उपहार स्वैच्छिक है। रिफंड और भुगतान की शर्तें प्लेटफ़ॉर्म और भुगतान साझेदार तय करते हैं। भुगतान से पहले पहचान और बैंक सत्यापन ज़रूरी है।',
  'ఈ నిబంధనలు ప్రారంభానికి ముందు న్యాయ సమీక్ష కోసం పని చిత్తు. చదరపు అడుగు లేదా ఇటుక అనేది డౌన్ పేమెంట్ వైపు ప్రతీకాత్మక విరాళం, ఆస్తి అమ్మకం కాదు. బహుమతి స్వచ్ఛందం. చెల్లింపులకు గుర్తింపు మరియు బ్యాంక్ ధృవీకరణ అవసరం.',
);

export const DEFAULT_PRIVACY = t(
  'We store your mobile number, name, occupation and, if you set one, a hashed password. Wedding hosts see guest RSVP and logistics responses. Contacts are imported only after you grant permission and confirm who to invite. You can opt out of reminder messages and ask us to erase your profile. Payment data is handled by the payment partner. This notice is a draft and must be aligned with the Digital Personal Data Protection Act, 2023 before launch.',
  'हम आपका मोबाइल, नाम, पेशा और पासवर्ड का हैश रखते हैं। मेज़बान RSVP और ठहराव की जानकारी देखते हैं। संपर्क केवल आपकी अनुमति के बाद जुड़ते हैं। आप संदेशों से ऑप्ट आउट कर सकते हैं और प्रोफ़ाइल मिटाने को कह सकते हैं। यह सूचना लॉन्च से पहले DPDP अधिनियम 2023 के अनुरूप होनी चाहिए।',
  'మేము మీ మొబైల్, పేరు, వృత్తి మరియు పాస్‌వర్డ్ హాష్ ఉంచుతాం. హోస్ట్ RSVP మరియు బస వివరాలు చూస్తారు. పరిచయాలు మీ అనుమతి తర్వాతే. మీరు సందేశాల నుండి నిష్క్రమించవచ్చు మరియు ప్రొఫైల్ తొలగింపు అడగవచ్చు. ఇది DPDP చట్టం 2023కి అనుగుణంగా ఖరారు కావాలి.',
);

export function pickLocale(text: LocalizedText | undefined, locale: string | undefined): string {
  if (!text) return '';
  if (locale === 'hi' && text.hi) return text.hi;
  if (locale === 'te' && text.te) return text.te;
  return text.en;
}
