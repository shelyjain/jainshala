import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/auth';
import { UserAvatar } from '@/components/user-avatar';
import { AppLogo } from '@/components/app-logo';
import { useFocusEffect } from 'expo-router';

type UserData = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  badgeCount?: number;
};

type League = {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  icon: string;
  range: string;
  min: number;
  max: number;
  color: string;
};

const LEAGUES: Record<'bronze' | 'silver' | 'gold', League> = {
  bronze: { id: 'bronze', name: 'Bronze League', icon: '🥉', range: '0–4 Badges', min: 0, max: 4, color: '#cd7f32' },
  silver: { id: 'silver', name: 'Silver League', icon: '🥈', range: '5–9 Badges', min: 5, max: 9, color: '#c0c0c0' },
  gold: { id: 'gold', name: 'Gold League', icon: '🥇', range: '10+ Badges', min: 10, max: Infinity, color: '#ffd700' },
};

function getLeagueForCount(count: number): League {
  if (count >= 10) return LEAGUES.gold;
  if (count >= 5) return LEAGUES.silver;
  return LEAGUES.bronze;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setError(null);
      // Query users collection
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const list: UserData[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(list);
    } catch (err: any) {
      console.warn('[Leaderboard] fetch error:', err);
      if (err?.code === 'permission-denied' || String(err).includes('permission')) {
        setError(
          'Firestore security rules need to be updated. To enable this screen, ensure your deployed `firestore.rules` allows authenticated users to read profiles.\n\nUpdate rule to:\nallow read: if request.auth != null;'
        );
      } else {
        setError(err?.message || 'Could not fetch leaderboard. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  // Find current user's data
  const currentUserData = useMemo(() => {
    if (!user) return null;
    return users.find((u) => u.id === user.uid) || {
      id: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      badgeCount: 0,
    };
  }, [users, user]);

  const currentUserBadgeCount = currentUserData?.badgeCount ?? 0;
  const currentUserLeague = getLeagueForCount(currentUserBadgeCount);

  // Group and sort users by league and count
  const rankedUsersInActiveLeague = useMemo(() => {
    const filtered = users.filter((u) => {
      const count = u.badgeCount ?? 0;
      return count >= LEAGUES[activeLeagueId].min && count <= LEAGUES[activeLeagueId].max;
    });

    // Sort by badgeCount descending, then alphabetically by displayName
    return filtered.sort((a, b) => {
      const countA = a.badgeCount ?? 0;
      const countB = b.badgeCount ?? 0;
      if (countA !== countB) return countB - countA;
      
      const nameA = a.displayName || a.email || '';
      const nameB = b.displayName || b.email || '';
      return nameA.localeCompare(nameB);
    });
  }, [users, activeLeagueId]);

  // Determine current user rank in the active league (if they are in it)
  const currentUserRankInActiveLeague = useMemo(() => {
    if (!user) return null;
    const index = rankedUsersInActiveLeague.findIndex((u) => u.id === user.uid);
    return index !== -1 ? index + 1 : null;
  }, [rankedUsersInActiveLeague, user]);

  // Calculate league progress details
  const leagueProgressMessage = useMemo(() => {
    const count = currentUserBadgeCount;
    if (count < 5) {
      const diff = 5 - count;
      return `${diff} more badge${diff > 1 ? 's' : ''} to level up to Silver League!`;
    } else if (count < 10) {
      const diff = 10 - count;
      return `${diff} more badge${diff > 1 ? 's' : ''} to level up to Gold League!`;
    }
    return "You've achieved the highest league status! Outstanding devotion.";
  }, [currentUserBadgeCount]);

  const leagueProgressBarPercent = useMemo(() => {
    const count = currentUserBadgeCount;
    if (count < 5) return (count / 5) * 100;
    if (count < 10) return ((count - 5) / 5) * 100;
    return 100;
  }, [currentUserBadgeCount]);

  const listHeader = useMemo(() => {
    if (error) return null;

    return (
      <View style={styles.headerContainer}>
        {/* Current User Standing Card */}
        <View style={styles.userProgressCard}>
          <View style={styles.userCardRow}>
            <UserAvatar
              photoURL={user?.photoURL}
              displayName={user?.displayName}
              email={user?.email}
              size={56}
            />
            <View style={styles.userCardTextCol}>
              <Text style={styles.userCardGreeting}>Your standing</Text>
              <View style={styles.leagueTagRow}>
                <Text style={[styles.leagueTagText, { color: currentUserLeague.color }]}>
                  {currentUserLeague.icon} {currentUserLeague.name}
                </Text>
                <Text style={styles.userBadgeCountSub}>
                  • {currentUserBadgeCount} Badge{currentUserBadgeCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressSeparator} />

          <Text style={styles.progressMessage}>{leagueProgressMessage}</Text>
          {currentUserBadgeCount < 10 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${leagueProgressBarPercent}%` }]} />
              </View>
            </View>
          )}
        </View>

        {/* League Navigation Tabs */}
        <View style={styles.tabsContainer}>
          {(Object.keys(LEAGUES) as Array<keyof typeof LEAGUES>).map((key) => {
            const league = LEAGUES[key];
            const isActive = activeLeagueId === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.tabButton,
                  isActive && styles.tabButtonActive,
                  { borderColor: league.color + '55' },
                ]}
                activeOpacity={0.85}
                onPress={() => setActiveLeagueId(key)}
              >
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                  {league.icon}
                </Text>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {league.name.split(' ')[0]}
                </Text>
                <Text style={[styles.tabRangeText, isActive && styles.tabRangeTextActive]}>
                  {league.range.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* League Info Section */}
        <View style={styles.leagueHeaderRow}>
          <Text style={styles.leagueSectionHeading}>
            {LEAGUES[activeLeagueId].icon} {LEAGUES[activeLeagueId].name} rankings
          </Text>
          <Text style={styles.leagueSubtext}>
            {rankedUsersInActiveLeague.length} Participant{rankedUsersInActiveLeague.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  }, [
    user,
    error,
    currentUserBadgeCount,
    currentUserLeague,
    leagueProgressMessage,
    leagueProgressBarPercent,
    activeLeagueId,
    rankedUsersInActiveLeague.length,
  ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#a0522d" />
        <Text style={styles.loadingText}>Fetching rankings…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        style={styles.errorScreen}
        contentContainerStyle={styles.errorContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.titleRow}>
          <AppLogo size={44} />
          <Text style={styles.heading}>Leaderboard</Text>
        </View>
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Configuration Required</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchUsers(); }}>
            <Text style={styles.retryButtonText}>Retry Sync</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <AppLogo size={44} />
        <Text style={styles.heading}>Leaderboard</Text>
      </View>

      <FlatList
        data={rankedUsersInActiveLeague}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a0522d" />
        }
        renderItem={({ item, index }) => {
          const isMe = item.id === user?.uid;
          const rank = index + 1;

          // Rank icon/medals style
          let rankIcon = null;
          let rankCircleStyle = styles.rankCircleDefault;
          let rankTextStyle: any = styles.rankTextDefault;

          if (rank === 1) {
            rankIcon = '🥇';
            rankCircleStyle = styles.rankCircleGold;
            rankTextStyle = styles.rankTextTop;
          } else if (rank === 2) {
            rankIcon = '🥈';
            rankCircleStyle = styles.rankCircleSilver;
            rankTextStyle = styles.rankTextTop;
          } else if (rank === 3) {
            rankIcon = '🥉';
            rankCircleStyle = styles.rankCircleBronze;
            rankTextStyle = styles.rankTextTop;
          }

          const fallbackName = (item.email || '').split('@')[0] || 'Learner';
          const finalName = item.displayName?.trim() || fallbackName;

          return (
            <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
              <View style={styles.rankColLeft}>
                {rankIcon ? (
                  <View style={[styles.rankCircle, rankCircleStyle]}>
                    <Text style={[styles.rankText, rankTextStyle]}>{rankIcon}</Text>
                  </View>
                ) : (
                  <View style={[styles.rankCircle, rankCircleStyle]}>
                    <Text style={[styles.rankText, rankTextStyle]}>{rank}</Text>
                  </View>
                )}

                <UserAvatar
                  photoURL={item.photoURL}
                  displayName={finalName}
                  email={item.email}
                  size={42}
                />

                <View style={styles.userNameCol}>
                  <Text style={[styles.userName, isMe && styles.userNameMe]} numberOfLines={1}>
                    {finalName}
                  </Text>
                  {isMe && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>You</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.rankColRight}>
                <Text style={styles.userBadgeCount}>{item.badgeCount ?? 0}</Text>
                <Text style={styles.userBadgeUnit}>Badge{item.badgeCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🍃</Text>
            <Text style={styles.emptyTitle}>No users in this league yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to enter by earning badges in the progress tab!
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#a0522d', fontWeight: '600' },
  
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  heading: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerContainer: {
    paddingVertical: 14,
  },

  // User Standing Card
  userProgressCard: {
    backgroundColor: '#fffdfa',
    borderWidth: 1.5,
    borderColor: '#e8d5c4',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#a0522d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userCardTextCol: {
    flex: 1,
  },
  userCardGreeting: {
    fontSize: 13,
    color: '#8a7d73',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  leagueTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leagueTagText: {
    fontSize: 18,
    fontWeight: '800',
  },
  userBadgeCountSub: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  progressSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8dfd6',
    marginVertical: 12,
  },
  progressMessage: {
    fontSize: 13,
    color: '#6e5e53',
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 8,
  },
  progressContainer: {
    height: 8,
    width: '100%',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f0e6df',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#a0522d',
    borderRadius: 4,
  },

  // Tabs / League Selector
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#a0522d',
    borderColor: '#a0522d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  tabIconActive: {
    transform: [{ scale: 1.08 }],
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabRangeText: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  tabRangeTextActive: {
    color: '#fdf8f4',
    opacity: 0.9,
  },

  // League Section Title
  leagueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  leagueSectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  leagueSubtext: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  // Ranking Rows
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffdfc',
    borderWidth: 1,
    borderColor: '#e8dfd6',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  rankRowMe: {
    backgroundColor: '#fffbf4',
    borderColor: '#e8c49a',
    borderWidth: 1.5,
    shadowColor: '#a0522d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rankColLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCircleGold: {
    backgroundColor: '#fffdf0',
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  rankCircleSilver: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#c0c0c0',
  },
  rankCircleBronze: {
    backgroundColor: '#fffbf7',
    borderWidth: 1,
    borderColor: '#cd7f32',
  },
  rankCircleDefault: {
    backgroundColor: '#f5ebe2',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rankTextTop: {
    fontSize: 18,
    marginTop: -2,
  },
  rankTextDefault: {
    color: '#a0522d',
  },
  userNameCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2a241c',
  },
  userNameMe: {
    fontWeight: '700',
    color: '#a0522d',
  },
  youBadge: {
    backgroundColor: '#a0522d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rankColRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  userBadgeCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#a0522d',
    lineHeight: 20,
  },
  userBadgeUnit: {
    fontSize: 10,
    color: '#8a7d73',
    fontWeight: '700',
    marginTop: 1,
  },

  // Empty List State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  // Error Screen
  errorScreen: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 56,
  },
  errorContent: {
    paddingBottom: 40,
  },
  errorCard: {
    margin: 20,
    backgroundColor: '#fff9f6',
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  errorEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#d32f2f',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#a0522d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
