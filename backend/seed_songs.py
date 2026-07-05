import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('firebase-service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

def gs_to_https(gs_url):
    # gs://bucket/file -> https://firebasestorage.googleapis.com/v0/b/bucket/o/file?alt=media
    path = gs_url.replace('gs://', '')
    bucket, *parts = path.split('/')
    filename = '%2F'.join(parts)
    return f'https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{filename}?alt=media'

BASE = 'gs://jainshala-28136.firebasestorage.app'

MEANINGS = [
    'With this lighted lamp (arati), I pray that Lord Adinath, Beloved son of King Nabhi and Queen Marudevi, be victorious',
    'With this lighted lamp (arati), I pray that Lord Adinath, Beloved son of King Nabhi and Queen Marudevi, be victorious',
    'With this first arati puja, I am participating in this auspicious activity in this human life',
    'With this first arati puja, I am participating in this auspicious activity in this human life',
    'With this second arati, I pray to Lord Adinath, who is merciful to the poor and whose virtues enlighten even poorly lit places',
    'With this second arati, I pray to Lord Adinath, who is merciful to the poor and whose virtues enlighten even poorly lit places',
    'With this third arati, I pray to Adinath, Lord of the three universes, who is worshipped by deities, humans and their kings',
    'With this third arati, I pray to Adinath, Lord of the three universes, who is worshipped by deities, humans and their kings',
    'With this fourth arati, I pray that Lord Adinath helps me eliminate wandering in four life forms and to be able to obtain the eternal happiness of moksha',
    'With this fourth arati, I pray that Lord Adinath helps me eliminate wandering in four life forms and to be able to obtain the eternal happiness of moksha',
    'With this fifth arati, according to Mulchand (the poet), by praising the virtues of Lord Rushabh Dev, the worshipper generates punya (good karmas)',
    'With this fifth arati, according to Mulchand (the poet), by praising the virtues of Lord Rushabh Dev, the worshipper generates punya (good karmas)',
]

lines = [
    { 'transliteration': 'Jaya jaya arati adi jinanda',      'audio': f'{BASE}/song1line1.mp3',  'meaning': MEANINGS[0]  },
    { 'transliteration': 'Nabhi raya Marudevi ko nanda',     'audio': f'{BASE}/song1line2.mp3',  'meaning': MEANINGS[1]  },
    { 'transliteration': 'Paheli arati puja kije',           'audio': f'{BASE}/song1line3.mp3',  'meaning': MEANINGS[2]  },
    { 'transliteration': 'Narabhava pamine lavho lije',      'audio': f'{BASE}/song1line4.mp3',  'meaning': MEANINGS[3]  },
    { 'transliteration': 'Dusari arati din-dayala',          'audio': f'{BASE}/song1line5.mp3',  'meaning': MEANINGS[4]  },
    { 'transliteration': 'Dhuleva nagar mahen jaga ujiyala', 'audio': f'{BASE}/song1line6.mp3',  'meaning': MEANINGS[5]  },
    { 'transliteration': 'Teesari arati tribhuvana deva',    'audio': f'{BASE}/song1line7.mp3',  'meaning': MEANINGS[6]  },
    { 'transliteration': 'Sura nara Indra kare tori seva',   'audio': f'{BASE}/song1line8.mp3',  'meaning': MEANINGS[7]  },
    { 'transliteration': 'Chauthi aarti chau gati chure',    'audio': f'{BASE}/song1line9.mp3',  'meaning': MEANINGS[8]  },
    { 'transliteration': 'Mana vanchhit phala shiva sukha pure', 'audio': f'{BASE}/song1line10.mp3', 'meaning': MEANINGS[9]  },
    { 'transliteration': 'Panchami arati punya upayo',       'audio': f'{BASE}/song1line11.mp3', 'meaning': MEANINGS[10] },
    { 'transliteration': 'Mulachanda Rishabha guna gayo',    'audio': f'{BASE}/song1line12.mp3', 'meaning': MEANINGS[11] },
]

song = {
    'title': 'Adinath Aarti',
    'artist': 'Traditional Jain',
    'lines': [
        {
            'transliteration': l['transliteration'],
            'gujarati': '',
            'translation_en': l['meaning'],
            'audio_url': gs_to_https(l['audio']) if l['audio'] else '',
        }
        for l in lines
    ]
}

db.collection('songs').add(song)
print('✓ Adinath Aarti seeded successfully')
