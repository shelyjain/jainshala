import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProgress } from '../../hooks/use-progress';
import { API_URL } from '../../constants/api';
import { fetchJson } from '../../lib/fetch-json';
import { AppLogo } from '@/components/app-logo';
import { MASTER_BADGE, hasEarnedMasterBadge } from '@/constants/master-badge';

type SongLine = {
  timestamp_ms: number;
  gujarati: string;
  transliteration: string;
  translation_en: string;
};

type Song = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  lines: SongLine[];
};

const DEFAULT_SONGS: Song[] = [
  {
    id: 'aarti',
    title: 'Shree Adinath Aarti',
    artist: 'Traditional',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lines: [
      {
        timestamp_ms: 0,
        gujarati: 'જય જય આરતી આદિ જિણંદા, નાભિરાયા મરૂદેવીકા નંદા.',
        transliteration: 'Jaya Jaya Aarti Aadi Jinanda, Naabhiraya Maroodevika Nanda. Jaya Jaya Aarti Aadi Jinanda.',
        translation_en: 'Victory, victory to the first Jina, Lord Adinath, the beloved son of King Nabhi and Queen Marudevi.'
      },
      {
        timestamp_ms: 6000,
        gujarati: 'પહેલી આરતી પૂજા કીજે, નર ભવ પામી ને લહાવો લીજે.',
        transliteration: 'Pehli Aarti Puja Kije, Nar Bhav Paami Ne Lahavo Leeje.',
        translation_en: 'Perform the first aarti and worship the Lord; having attained this rare human life, earn the spiritual profit.'
      },
      {
        timestamp_ms: 12000,
        gujarati: 'દુસરી આરતી દિન દયાલા, ધુલેવા મંડપ મા જગ અજવાલા.',
        transliteration: 'Dusri Aarti Din Dayala, Dhuleva Mandap Ma Jag Ajwala.',
        translation_en: 'The second aarti is to the merciful Lord of the humble, whose presence illuminates the great temple at Dhuleva.'
      },
      {
        timestamp_ms: 18000,
        gujarati: 'તીસરી આરતી ત્રિભુવન દેવા, સુર નર ઇન્દ્ર કરે તોરી સેવા.',
        transliteration: 'Teesri Aarti Tribhuvan Deva, Sur Nar Indra Kare Tori Seva.',
        translation_en: 'The third aarti is to the Lord of the three worlds, whom gods, humans, and Indras serve with devotion.'
      },
      {
        timestamp_ms: 24000,
        gujarati: 'ચોથી આરતી ચૌગતિ ચુરે, મન વાંછિત ફલ શિવ સુખ પુરે.',
        transliteration: 'Chauthi Aarti Chaugati Chure, Mann Vanchhiit Fal Shiv Sukh Pure.',
        translation_en: 'The fourth aarti destroys the cycle of the four destinies, fulfilling all pure desires and granting the bliss of liberation.'
      },
      {
        timestamp_ms: 30000,
        gujarati: 'પંચમી આરતી પુણ્ય ઉપાયો, મૂલચંદે ઋષભ ગુણ ગાયો.',
        transliteration: 'Panchmi Aarti Punya Upaayo, Mulchande Rushabh Gun Gaayo. Jaya Jaya Aarti Aadi Jinanda.',
        translation_en: 'Through the fifth aarti, spiritual merit is earned. The devotee Mulchand sings the glorious virtues of Lord Rishabhdev.'
      },
      {
        timestamp_ms: 36000,
        gujarati: 'નાભિરાયા મરૂદેવીકા નંદા.',
        transliteration: 'Naabhiraya Maroodevika Nanda.',
        translation_en: 'The beloved son of King Nabhi and Queen Marudevi.'
      }
    ]
  },
  {
    id: 'mangal-deevo',
    title: 'Mangal Deevo',
    artist: 'Kumarpal',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    lines: [
      {
        timestamp_ms: 0,
        gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારી ને બહુ ચિરંજીવો.',
        transliteration: 'Deevo re deevo prabhu mangalika deevo, Aarati utari ne bahu chiranjeevo.',
        translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
      },
      {
        timestamp_ms: 7000,
        gujarati: 'સોહામણું ઘર પર્વ દિવાલી, અંબર ખેલે અમરા બાલી.',
        transliteration: 'Sohamanu ghar parva dewali, Ambar khele amra bali.',
        translation_en: 'The festival is as beautiful as Diwali in our homes, and the young gods in heaven celebrate with joy.'
      },
      {
        timestamp_ms: 14000,
        gujarati: 'દીપાલ ભણે અને એ કલિ કાલે, આરતી ઉતારી રાજા કુમારપાલે.',
        transliteration: 'Depal bhane ane ae kali kale, Arati utari raja kumarpale.',
        translation_en: 'The poet Depal sings that in this dark age of Kali-yuga, King Kumarpal performed this auspicious aarti.'
      },
      {
        timestamp_ms: 21000,
        gujarati: 'અમા ઘર મંગલીક, તુમ ઘર મંગલીક, મંગલીક ચતુર્વિધ સંઘ ને હોજો.',
        transliteration: 'Ama ghar mangalika, tum ghar mangalika, Mangalika chaturvidha sangh ne hojo.',
        translation_en: 'May there be auspiciousness in our homes, in your homes, and may there be auspiciousness for the entire four-fold Jain community.'
      },
      {
        timestamp_ms: 28000,
        gujarati: 'દીવો રે દીવો પ્રભુ મંગલીક દીવો, આરતી ઉતારણા બહુ ચિરંજીવો.',
        transliteration: 'Divo re divo prabhu magalic divo, Arati utarana bahu chiranjivo.',
        translation_en: 'This is the lamp, O Lord, the auspicious lamp. Having performed this waving ritual, may you attain eternal life.'
      }
    ]
  }
];

type Line = {
  line_number: number;
  transliteration: string;
  translation_en: string;
};

type Sutra = {
  id: string;
  title: string;
  category: string;
  sutra_number: number;
  original_gu: string;
  original_hi: string;
  lines: Line[];
  interpretation: string;
  tags: string[];
};

type Milestone = {
  sutra: Sutra;
  stepsDone: number;
  fullyDone: boolean;
  isCongratsCard?: boolean;
  id?: string;
  title?: string;
};

const STEP_KEYS = ['read', 'listen', 'learn', 'learn_fill', 'recite'] as const;
const TOTAL_STEPS = STEP_KEYS.length;

const SPINE_W = 44;
const SPINE_TRACK_W = 10;
const FOOTER_SPINE_BRIDGE = 22;

function countSteps(p: Record<(typeof STEP_KEYS)[number], boolean>): number {
  return STEP_KEYS.reduce((n, k) => n + (p[k] ? 1 : 0), 0);
}

export default function HomeScreen() {
  const [sutras, setSutras] = useState<Sutra[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<'pratikraman1' | 'pratikraman2' | 'songs' | null>(null);
  const router = useRouter();
  const { completed, getStepProgress } = useProgress();

  useFocusEffect(useCallback(() => {}, [completed]));

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    const loadData = async () => {
      try {
        const sutraData = await fetchJson<Sutra[]>(`${API_URL}/sutras`);
        if (!cancelled) setSutras(sutraData);

        try {
          const snapshot = await getDocs(collection(db, 'songs'));
          const songList: Song[] = [];
          snapshot.forEach(doc => {
            songList.push({ id: doc.id, ...doc.data() } as Song);
          });
          if (!cancelled) {
            setSongs(songList.length ? songList : DEFAULT_SONGS);
          }
        } catch (dbErr) {
          console.warn('Could not load songs from Firestore, using defaults.', dbErr);
          if (!cancelled) setSongs(DEFAULT_SONGS);
        }

        if (!cancelled) setLoading(false);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load sutras');
          setSutras([]);
          setSongs(DEFAULT_SONGS);
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (selectedPath === null) return;
    if (selectedPath === 'songs') return; // Firestore list is already complete

    const url =
      query.trim() === ''
        ? `${API_URL}/sutras`
        : `${API_URL}/search?q=${encodeURIComponent(query)}`;

    fetchJson<Sutra[]>(url)
      .then(data => {
        if (!cancelled) setSutras(data);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Request failed');
          setSutras([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, selectedPath]);

  const ordered = useMemo(() => {
    return [...sutras].sort((a, b) => (a.sutra_number ?? 0) - (b.sutra_number ?? 0));
  }, [sutras]);

  const milestones: Milestone[] = useMemo(() => {
    return ordered.map(sutra => {
      const done = completed.includes(sutra.id);
      const stepProgress = getStepProgress(sutra.id);
      const stepsDone = countSteps({
        read: stepProgress.read,
        listen: stepProgress.listen,
        learn: stepProgress.learn,
        learn_fill: stepProgress.learn_fill,
        recite: stepProgress.recite,
      });
      const fullyDone = done || stepsDone >= TOTAL_STEPS;
      return { sutra, stepsDone, fullyDone };
    });
  }, [ordered, completed, getStepProgress]);

  const songMilestones = useMemo(() => {
    return songs.map((song, idx) => {
      const done = completed.includes(song.id);
      const stepProgress = getStepProgress(song.id);
      const stepsDone = (stepProgress.listen ? 1 : 0) +
                        (stepProgress.learn_fill ? 1 : 0) +
                        (stepProgress.recite ? 1 : 0);
      const fullyDone = done || stepsDone >= 3;

      const mappedSutra: Sutra = {
        id: song.id,
        title: song.title,
        category: song.artist || 'Traditional',
        sutra_number: idx + 1,
        original_gu: '',
        original_hi: '',
        lines: song.lines.map((l, i) => ({
          line_number: i + 1,
          transliteration: l.transliteration,
          translation_en: l.translation_en,
        })),
        interpretation: '',
        tags: [],
      };

      return { sutra: mappedSutra, stepsDone, fullyDone };
    });
  }, [songs, completed, getStepProgress]);

  const p1Milestones = useMemo(() => milestones.filter(m => m.sutra.category.includes('Pratikraman 1')), [milestones]);
  const p2Milestones = useMemo(() => milestones.filter(m => m.sutra.category.includes('Pratikraman 2')), [milestones]);

  const p1Completed = useMemo(() => p1Milestones.filter(m => m.fullyDone).length, [p1Milestones]);
  const p2Completed = useMemo(() => p2Milestones.filter(m => m.fullyDone).length, [p2Milestones]);
  const songsCompleted = useMemo(() => songMilestones.filter(m => m.fullyDone).length, [songMilestones]);

  const catalogIds = useMemo(() => ordered.map(s => s.id), [ordered]);
  const hasMasterBadge = hasEarnedMasterBadge(catalogIds, completed);
  
  const completedCount = milestones.filter(m => m.fullyDone).length + songMilestones.filter(m => m.fullyDone).length;
  const progressPct = (ordered.length + songs.length) ? (completedCount / (ordered.length + songs.length)) * 100 : 0;

  const milestonesWithCongrats = useMemo(() => {
    if (!selectedPath) return [];
    if (selectedPath === 'songs') return songMilestones;
    
    const activeList = selectedPath === 'pratikraman1' ? p1Milestones : p2Milestones;
    
    if (query.trim() !== '') return activeList;

    const list: any[] = [];
    activeList.forEach((m) => {
      list.push(m);
      if (m.sutra.sutra_number === 22) {
        const isPart1Completed = activeList
          .filter(x => x.sutra.sutra_number <= 22)
          .every(x => x.fullyDone);

        list.push({
          id: 'congrats_part1',
          isCongratsCard: true,
          title: 'Part 1 Completed',
          fullyDone: isPart1Completed,
        });
      }
    });
    return list;
  }, [p1Milestones, p2Milestones, songMilestones, selectedPath, query]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a0522d" />
        </View>
      </SafeAreaView>
    );
  }

  // Dashboard Selector State
  if (selectedPath === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView style={styles.listFill} contentContainerStyle={styles.selectorContent} showsVerticalScrollIndicator={false}>
          <View style={styles.selectorHeader}>
            <AppLogo size={64} />
            <Text style={styles.selectorMainHeading}>Jain Shala</Text>
            <Text style={styles.selectorSubheading}>Your daily spiritual and sutra learning companion</Text>
          </View>

          {loadError ? (
            <Text style={styles.errorText}>
              Could not reach API at {API_URL}. From the project folder run: cd backend then uvicorn main:app --reload
              --host 0.0.0.0 --port 8000. Then reload the app.{'\n'}
              {loadError}
            </Text>
          ) : null}

          {/* Overall Stats Card */}
          <View style={styles.statsCard}>
            <Text style={styles.statsCardTitle}>Overall Learning Progress</Text>
            <Text style={styles.statsCardPctText}>{Math.round(progressPct)}% Mastered</Text>
            <View style={styles.statsTrack}>
              <View style={[styles.statsFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.statsCountText}>{completedCount} / {ordered.length} total sutras learned</Text>
          </View>

          {/* Section 1: Pratikraman */}
          <Text style={styles.sectionTitle}>Pratikraman</Text>
          <Text style={styles.sectionSubtitle}>Complete timeline for path learning</Text>

          <View style={styles.singleCardContainer}>
            {/* Pratikraman 2 Card */}
            <TouchableOpacity
              style={[styles.selectorCard, styles.selectorCardPratikraman]}
              activeOpacity={0.85}
              onPress={() => setSelectedPath('pratikraman2')}
            >
              <View style={styles.selectorCardHeader}>
                <Text style={styles.selectorCardBadge}>PATH 2</Text>
                <Text style={styles.selectorCardIcon}>🗺️</Text>
              </View>
              <Text style={styles.selectorCardTitle}>Pratikraman 2</Text>
              <Text style={styles.selectorCardDesc}>Includes all 51 sutras. A complete path for practice, recitation, and tracking your daily progress.</Text>
              <View style={styles.cardProgressRow}>
                <Text style={styles.cardProgressText}>{p2Completed} / {p2Milestones.length} Done</Text>
                <View style={styles.cardProgressTrack}>
                  <View style={[styles.cardProgressFill, { width: `${p2Milestones.length ? (p2Completed / p2Milestones.length) * 100 : 0}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Section 2: Vidhi */}
          <Text style={styles.sectionTitle}>Vidhi & Prayers (Songs)</Text>
          <Text style={styles.sectionSubtitle}>Devotional hymns and rituals with audio karaoke</Text>

          <View style={styles.singleCardContainer}>
            {/* Devotional Songs Card */}
            <TouchableOpacity
              style={[styles.selectorCard, styles.selectorCardVidhi]}
              activeOpacity={0.85}
              onPress={() => setSelectedPath('songs')}
            >
              <View style={styles.selectorCardHeader}>
                <Text style={[styles.selectorCardBadge, styles.selectorCardBadgeVidhi]}>SONGS PATH</Text>
                <Text style={styles.selectorCardIcon}>🎵</Text>
              </View>
              <Text style={styles.selectorCardTitle}>Devotional Songs</Text>
              <Text style={styles.selectorCardDesc}>Learn Shree Adinath Aarti and Mangal Deevo with synced karaoke scrolling, word reveal, and quizzes.</Text>
              <View style={styles.cardProgressRow}>
                <Text style={styles.cardProgressText}>{songsCompleted} / {songMilestones.length} Done</Text>
                <View style={styles.cardProgressTrack}>
                  <View style={[styles.cardProgressFill, { backgroundColor: '#c9a227', width: `${songMilestones.length ? (songsCompleted / songMilestones.length) * 100 : 0}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Timeline Roadmap View (when a path is selected)
  const currentPathMilestones = selectedPath === 'songs' ? songMilestones : (selectedPath === 'pratikraman1' ? p1Milestones : p2Milestones);
  const currentPathCompleted = selectedPath === 'songs' ? songsCompleted : (selectedPath === 'pratikraman1' ? p1Completed : p2Completed);
  const pathProgressPct = currentPathMilestones.length ? (currentPathCompleted / currentPathMilestones.length) * 100 : 0;

  const listHeader = (
    <>
      <TouchableOpacity onPress={() => { setSelectedPath(null); setQuery(''); }} style={styles.backToHomeBtn} hitSlop={12}>
        <Text style={styles.backToHomeText}>← Back to Sections</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <AppLogo size={48} />
        <Text style={styles.heading}>
          {selectedPath === 'songs' ? 'Devotional Songs' : (selectedPath === 'pratikraman1' ? 'Pratikraman 1' : 'Pratikraman 2')}
        </Text>
      </View>
      {loadError && selectedPath !== 'songs' ? (
        <Text style={styles.errorText}>
          Could not reach API at {API_URL}. From the project folder run: cd backend then uvicorn main:app --reload
          --host 0.0.0.0 --port 8000. Then reload the app.{'\n'}
          {loadError}
        </Text>
      ) : null}
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          Path Progress: {currentPathCompleted} / {currentPathMilestones.length} completed
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, selectedPath === 'songs' ? { backgroundColor: '#c9a227', width: `${pathProgressPct}%` } : { width: `${pathProgressPct}%` }]} />
        </View>
      </View>
      <Text style={styles.pathLabel}>Learning roadmap</Text>
      <Text style={styles.pathHint}>
        {selectedPath === 'songs' ? 'Stops represent devotional songs. Tap a song to start learning.' : 'Stops follow sutra order. Progress is on each card. Tap a card to open that sutra.'}
      </Text>
      {selectedPath !== 'songs' && (
        <TextInput
          style={styles.searchBar}
          placeholder="Search sutras…"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
        />
      )}
    </>
  );

  const listFooter =
    currentPathMilestones.length === 0 ? null : (
      <View style={styles.footerWrap}>
        <View style={styles.finishRow}>
          <View style={styles.finishSideSpacer} />
          <View style={styles.spineColumn}>
            <View
              style={[
                styles.footerSpineBridge,
                {
                  backgroundColor:
                    currentPathMilestones.length > 0 && currentPathMilestones[currentPathMilestones.length - 1].fullyDone
                      ? '#b8895e'
                      : '#c4bbb1',
                },
              ]}
            />
            <View
              style={[
                styles.finishNode,
                hasMasterBadge && styles.finishNodeEarned,
              ]}
            >
              <Text style={styles.finishNodeEmoji}>{MASTER_BADGE.emoji}</Text>
              {!hasMasterBadge ? (
                <View style={styles.finishLock}>
                  <Text style={styles.finishLockIcon}>🔒</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.finishSideSpacer} />
        </View>
        <TouchableOpacity
          style={[styles.finishCard, hasMasterBadge && styles.finishCardEarned]}
          onPress={() => router.push('/badges')}
          activeOpacity={0.9}
        >
          <Text style={styles.finishRibbon}>{MASTER_BADGE.ribbon}</Text>
          <Text style={styles.finishTitle}>{MASTER_BADGE.title}</Text>
          <Text style={styles.finishSub}>
            {hasMasterBadge
              ? MASTER_BADGE.subtitle
              : `Master all ${currentPathMilestones.length} ${selectedPath === 'songs' ? 'songs' : 'sutras'} on this path to unlock this jewel.`}
          </Text>
          <Text style={styles.finishCta}>{hasMasterBadge ? 'View badges →' : 'See progress →'}</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={milestonesWithCongrats}
        keyExtractor={item => item.isCongratsCard ? item.id : item.sutra.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        style={styles.listFill}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          if (item.isCongratsCard) {
            const isUnlocked = item.fullyDone;
            const cardOnRight = index % 2 === 0;

            const spineInactive = '#c4bbb1';
            const spineActive = '#b8895e';
            const upperColor = isUnlocked ? spineActive : spineInactive;
            
            const nextItem = index < milestonesWithCongrats.length - 1 ? milestonesWithCongrats[index + 1] : null;
            const lowerColor = (nextItem && nextItem.fullyDone) ? spineActive : spineInactive;

            const congratsCard = (
              <View style={[styles.congratsCard, isUnlocked && styles.congratsCardUnlocked, styles.roadCardSpacing]}>
                <Text style={[styles.congratsTitle, isUnlocked && styles.congratsTitleUnlocked]}>
                  {isUnlocked ? '🎉 Part 1 Completed!' : '🔒 Part 1 Milestone'}
                </Text>
                <Text style={styles.congratsBody}>
                  {isUnlocked
                    ? 'you have completed part 1 of the pratikaman'
                    : 'Complete all 22 sutras in Part 1 to unlock this milestone.'}
                </Text>
              </View>
            );

            return (
              <View style={styles.roadRow}>
                <View style={styles.roadSide}>
                  {!cardOnRight ? congratsCard : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
                </View>

                <View style={styles.spineColumn}>
                  <View style={[styles.spineFlexFill, { backgroundColor: upperColor }]} />
                  <View
                    style={[
                      styles.nodeOuter,
                      isUnlocked && styles.nodeOuterDone,
                      {
                        borderColor: '#c9a227',
                        backgroundColor: isUnlocked ? '#fffbf0' : '#f3f0eb',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{isUnlocked ? '🏆' : '🔒'}</Text>
                  </View>
                  <View style={[styles.spineFlexFill, { backgroundColor: lowerColor }]} />
                </View>

                <View style={styles.roadSide}>
                  {cardOnRight ? congratsCard : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
                </View>
              </View>
            );
          }

          const { sutra, stepsDone, fullyDone } = item;
          
          let prevDone = false;
          for (let i = index - 1; i >= 0; i--) {
            const prevItem = milestonesWithCongrats[i];
            if (prevItem && !prevItem.isCongratsCard) {
              prevDone = !!prevItem.fullyDone;
              break;
            }
          }

          const spineInactive = '#c4bbb1';
          const spineActive = '#b8895e';
          const upperColor =
            index === 0 ? 'transparent' : prevDone ? spineActive : spineInactive;
          const lowerColor = fullyDone ? spineActive : spineInactive;
          const cardOnRight = index % 2 === 0;

          const card = (
            <TouchableOpacity
              style={[styles.roadCard, fullyDone && styles.roadCardDone, styles.roadCardSpacing]}
              onPress={() => router.push(selectedPath === 'songs' ? `/song/${sutra.id}` : `/sutra/${sutra.id}`)}
              activeOpacity={0.88}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardCategory} numberOfLines={1}>
                  {sutra.category}
                </Text>
                {fullyDone ? (
                  <Text style={styles.badge}>🏅 Done</Text>
                ) : stepsDone > 0 ? (
                  <Text style={[styles.badge, styles.badgePartial]}>
                    {stepsDone}/{selectedPath === 'songs' ? 3 : TOTAL_STEPS}
                  </Text>
                ) : (
                  <Text style={[styles.badge, styles.badgeLocked]}>🔒 Start</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {sutra.title}
              </Text>
            </TouchableOpacity>
          );

          return (
            <View style={styles.roadRow}>
              <View style={styles.roadSide}>
                {!cardOnRight ? card : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
              </View>

              <View style={styles.spineColumn}>
                <View
                  style={[
                    styles.spineFlexFill,
                    {
                      backgroundColor: upperColor === 'transparent' ? 'transparent' : upperColor,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.nodeOuter,
                    fullyDone && styles.nodeOuterDone,
                    !fullyDone && stepsDone > 0 && styles.nodeOuterProgress,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeStopNum,
                      fullyDone && styles.nodeStopNumDone,
                      !fullyDone && stepsDone > 0 && styles.nodeStopNumProgress,
                      !fullyDone && stepsDone === 0 && styles.nodeStopNumLocked,
                    ]}
                  >
                    {sutra.sutra_number}
                  </Text>
                  {!fullyDone && stepsDone === 0 ? (
                    <View style={styles.nodeLockBadge}>
                      <Text style={styles.nodeLockBadgeIcon}>🔒</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.spineFlexFill, { backgroundColor: lowerColor }]} />
              </View>

              <View style={styles.roadSide}>
                {cardOnRight ? card : <View style={[styles.roadCardSpacer, styles.roadCardSpacing]} />}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf8f5' },
  listFill: { flex: 1, backgroundColor: '#faf8f5' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heading: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },

  progressBar: { marginBottom: 8 },
  progressText: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#ebe6e0', borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: '#a0522d', borderRadius: 4 },

  pathLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  pathHint: { fontSize: 12, color: '#888', marginBottom: 12 },

  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e8dfd6',
  },
  errorText: {
    fontSize: 14,
    color: '#b00020',
    marginBottom: 12,
    lineHeight: 20,
  },

  roadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 0,
  },
  roadSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  roadCardSpacer: { minHeight: 88 },
  spineColumn: {
    width: SPINE_W,
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'column',
    zIndex: 1,
  },
  spineFlexFill: {
    flex: 1,
    width: SPINE_TRACK_W,
    minHeight: 6,
    alignSelf: 'center',
  },
  footerSpineBridge: {
    width: SPINE_TRACK_W,
    height: FOOTER_SPINE_BRIDGE,
    alignSelf: 'center',
  },
  nodeOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f0eb',
    borderWidth: 3,
    borderColor: '#b8aea2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nodeOuterProgress: {
    borderColor: '#c9a227',
    backgroundColor: '#fffbf0',
  },
  nodeOuterDone: {
    borderColor: '#8d4a28',
    backgroundColor: '#a0522d',
  },
  nodeStopNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5c534a',
  },
  nodeStopNumDone: { color: '#fff' },
  nodeStopNumProgress: { color: '#8b6914' },
  nodeStopNumLocked: { color: '#b0a89e' },
  nodeLockBadge: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  nodeLockBadgeIcon: { fontSize: 9 },

  roadCardSpacing: {
    marginVertical: 8,
  },
  roadCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0d8cf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 88,
  },
  roadCardDone: {
    borderColor: '#c9a227',
    borderWidth: 1.5,
    backgroundColor: '#fffdfb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardCategory: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  badge: { fontSize: 11, color: '#a0522d', fontWeight: '700' },
  badgePartial: { color: '#888', fontWeight: '600' },
  badgeLocked: { fontSize: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 21,
  },

  footerWrap: { marginTop: 0, marginBottom: 16 },
  finishRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  finishSideSpacer: { flex: 1 },
  finishNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f0eb',
    borderWidth: 3,
    borderColor: '#cfc7bc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  finishNodeEarned: {
    backgroundColor: '#fffbf4',
    borderColor: '#c9a227',
  },
  finishNodeEmoji: { fontSize: 22, opacity: 0.85 },
  finishLock: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  finishLockIcon: { fontSize: 10 },

  finishCard: {
    marginHorizontal: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dcd3c8',
  },
  finishCardEarned: {
    borderStyle: 'solid',
    borderColor: '#c9a227',
    backgroundColor: '#fffbf4',
  },
  finishRibbon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b6914',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  finishTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  finishSub: {
    fontSize: 13,
    color: '#5c4a2e',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 10,
  },
  finishCta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a0522d',
    textAlign: 'center',
  },

  /* Section style home screen styles */
  selectorContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  selectorHeader: {
    alignItems: 'center',
    marginVertical: 24,
  },
  selectorMainHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 12,
  },
  selectorSubheading: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    marginBottom: 28,
    shadowColor: '#a0522d',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statsCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statsCardPctText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  statsTrack: {
    height: 8,
    backgroundColor: '#ebe6e0',
    borderRadius: 4,
    marginVertical: 12,
  },
  statsFill: {
    height: 8,
    backgroundColor: '#a0522d',
    borderRadius: 4,
  },
  statsCountText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  selectorGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },
  singleCardContainer: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  selectorCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8dfd6',
    minHeight: 180,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  selectorCardPratikraman: {
    borderColor: '#e8dfd6',
  },
  selectorCardVidhi: {
    borderColor: '#e8dfd6',
  },
  selectorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorCardBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a0522d',
    backgroundColor: '#fdf0e8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectorCardBadgeVidhi: {
    color: '#c9a227',
    backgroundColor: '#fffbf0',
  },
  selectorCardIcon: {
    fontSize: 20,
  },
  selectorCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  selectorCardDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
    flex: 1,
    marginBottom: 12,
  },
  cardProgressRow: {
    marginTop: 'auto',
  },
  cardProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  cardProgressTrack: {
    height: 6,
    backgroundColor: '#ebe6e0',
    borderRadius: 3,
  },
  cardProgressFill: {
    height: 6,
    backgroundColor: '#a0522d',
    borderRadius: 3,
  },
  selectorCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a0522d',
    marginTop: 'auto',
  },
  backToHomeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backToHomeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a0522d',
  },

  /* Congratulations Event Card Styles */
  congratsCard: {
    backgroundColor: '#fdfbfa',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e8dfd6',
    borderStyle: 'dashed',
    minHeight: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  congratsCardUnlocked: {
    backgroundColor: '#fffdf0',
    borderColor: '#c9a227',
    borderStyle: 'solid',
  },
  congratsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8a8078',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  congratsTitleUnlocked: {
    color: '#c9a227',
  },
  congratsBody: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontWeight: '600',
  },
});
