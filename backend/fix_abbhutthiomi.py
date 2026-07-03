import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('firebase-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

MEANING = (
    "Oh! Respected Guru Maharaj, I may have caused unhappiness or bitterness to you in regards to "
    "serving food or water. I may not have taken proper care of you. I may have disrespected you by "
    "sitting at a higher level than you or at the same level as you. I may have interrupted you while "
    "you were talking, talked back to you, or tried to prove you wrong. I may have exhibited "
    "impoliteness to you, which I may not be aware of. I beg your pardon for all the wrong doings "
    "that I may have committed during the day."
)

new_lines = [
    { "line_number": 1, "transliteration": "icchä-kärena sandisaha bhagavan !",                                                                                                           "translation_en": MEANING },
    { "line_number": 2, "transliteration": "abbhutthiomi, abbhintara-devasiam khämeum?",                                                                                                  "translation_en": MEANING },
    { "line_number": 3, "transliteration": "iccham, khämemi devasiam.",                                                                                                                   "translation_en": MEANING },
    { "line_number": 4, "transliteration": "jam kinci apattiam, para-pattiam; bhatte, päne;",                                                                                             "translation_en": MEANING },
    { "line_number": 5, "transliteration": "vinae, veyävacce; äläve, samläve; uccäsane, samäsane; antara-bhäsäe, uvari-bhäsäe; jam kinci majjha", "translation_en": MEANING },
    { "line_number": 6, "transliteration": "vinaya-parihinam, suhumam vä, bäyaram vä;",                                                                                                   "translation_en": MEANING },
    { "line_number": 7, "transliteration": "tubbhe jänaha, aham na jänämi;",                                                                                                              "translation_en": MEANING },
    { "line_number": 8, "transliteration": "tassa micchä mi dukkadam",                                                                                                                    "translation_en": MEANING },
]

# Find sutra #5 and update it
docs = db.collection('sutras').where('sutra_number', '==', 5).stream()
updated = 0
for doc in docs:
    doc.reference.update({ 'lines': new_lines })
    print(f'✓ Updated sutra 5 (doc id: {doc.id})')
    updated += 1

if updated == 0:
    print('✗ No sutra with sutra_number=5 found. Check your Firestore field name.')
