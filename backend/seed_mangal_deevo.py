import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('firebase-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

def gs_to_https(gs_url):
    path = gs_url.replace('gs://', '')
    bucket, *parts = path.split('/')
    filename = '%2F'.join(parts)
    return f'https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{filename}?alt=media'

BASE = 'gs://jainshala-28136.firebasestorage.app'

lines = [
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line1.mp3',
    },
    {
        'transliteration': 'Aarti Utaran Re Bahu Chiranjivo Re',
        'translation_en': 'Long live the performer of arati',
        'audio': f'{BASE}/song2line2.mp3',
    },
    {
        'transliteration': 'Hey Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line3.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line4.mp3',
    },
    {
        'transliteration': 'Sohamanau Gher Parv Diwali',
        'translation_en': 'At Diwali celebrations, houses are decorated',
        'audio': f'{BASE}/song2line5.mp3',
    },
    {
        'transliteration': 'Ambar Khele Ambrapali',
        'translation_en': 'Goddesses rejoice in the heavens',
        'audio': f'{BASE}/song2line6.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line7.mp3',
    },
    {
        'transliteration': 'Shripal Bhale Ene Kul Ajavali',
        'translation_en': 'The devotee says that performing the arati makes the family proud',
        'audio': f'{BASE}/song2line8.mp3',
    },
    {
        'transliteration': 'Bhave Bhagte Vigan Nivari',
        'translation_en': 'And overcomes obstacles through devotion',
        'audio': f'{BASE}/song2line9.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line10.mp3',
    },
    {
        'transliteration': 'Shripal Bhale Ene E Kali Kale',
        'translation_en': 'In Kaliyug, the devotee says',
        'audio': f'{BASE}/song2line11.mp3',
    },
    {
        'transliteration': 'Aarti Utari Raja Kumar Pale',
        'translation_en': 'King Kumarpal performed the arati',
        'audio': f'{BASE}/song2line12.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line13.mp3',
    },
    {
        'transliteration': 'Am Gher Manglik Tum Gher Manglik',
        'translation_en': 'Let there be bliss in our house, in your house',
        'audio': f'{BASE}/song2line14.mp3',
    },
    {
        'transliteration': 'Manglik Chaturvidh Sangh Ne Hojo',
        'translation_en': 'And in the entire four-fold community',
        'audio': f'{BASE}/song2line15.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line16.mp3',
    },
    {
        'transliteration': 'Aarti Utaran Re Bahu Chiranjivo Re',
        'translation_en': 'Long live the performer of the arati',
        'audio': f'{BASE}/song2line17.mp3',
    },
    {
        'transliteration': 'Divo Divo Divo Re Prabhu Manglik Divo Re',
        'translation_en': 'Oh Lord! This is the auspicious lamp',
        'audio': f'{BASE}/song2line18.mp3',
    },
]

song = {
    'title': 'Mangal Deevo',
    'artist': 'Traditional Jain',
    'lines': [
        {
            'transliteration': l['transliteration'],
            'gujarati': '',
            'translation_en': l['translation_en'],
            'audio_url': gs_to_https(l['audio']),
        }
        for l in lines
    ]
}

db.collection('songs').add(song)
print('✓ Mangal Deevo seeded successfully')
